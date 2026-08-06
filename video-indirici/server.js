/*
 * Video Indirici - localhost paneli
 * Sifir bagimlilik (npm install YOK). Sadece Node + yt-dlp + ffmpeg.
 * Baslat: BASLAT.bat  ->  http://localhost:4190
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const KOK = __dirname;
const PORT = 4190;
const AYAR_DOSYA = path.join(KOK, 'ayarlar.json');

// ---------------------------------------------------------------- ayarlar
const varsayilanAyar = {
  klasor: path.join(KOK, 'indirilenler'),
  kalite: 'en-iyi',
  cerez: false,
};
let ayar = { ...varsayilanAyar };
try {
  Object.assign(ayar, JSON.parse(fs.readFileSync(AYAR_DOSYA, 'utf8')));
} catch { /* ilk calistirma */ }

function ayarKaydet() {
  try { fs.writeFileSync(AYAR_DOSYA, JSON.stringify(ayar, null, 2)); } catch {}
}
function klasorGarantile() {
  try { fs.mkdirSync(ayar.klasor, { recursive: true }); } catch {}
}
klasorGarantile();

// ---------------------------------------------------------------- yt-dlp bulma
const COCUK_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
let YT = null; // {cmd, base:[], surum}

function komutCalistir(cmd, args, { onLine, cwd } = {}) {
  return new Promise((resolve) => {
    let p;
    try {
      p = spawn(cmd, args, { cwd: cwd || KOK, env: COCUK_ENV, windowsHide: true });
    } catch (e) {
      return resolve({ kod: -1, cikti: '', hata: String(e && e.message || e) });
    }
    let cikti = '', hata = '', tampon = '', hTampon = '';
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', (d) => {
      cikti += d;
      if (!onLine) return;
      tampon += d;
      const satirlar = tampon.split(/\r?\n/);
      tampon = satirlar.pop();
      for (const s of satirlar) onLine(s, 'out');
    });
    p.stderr.on('data', (d) => {
      hata += d;
      if (!onLine) return;
      hTampon += d;
      const satirlar = hTampon.split(/\r?\n/);
      hTampon = satirlar.pop();
      for (const s of satirlar) onLine(s, 'err');
    });
    p.on('error', (e) => resolve({ kod: -1, cikti, hata: hata + String(e && e.message || e) }));
    p.on('close', (kod) => {
      if (onLine) { if (tampon) onLine(tampon, 'out'); if (hTampon) onLine(hTampon, 'err'); }
      resolve({ kod, cikti, hata, surec: p });
    });
    resolve.surec = p;
  });
}

function pythonScriptsKlasorleri() {
  const yollar = [];
  const la = process.env.LOCALAPPDATA;
  if (la) {
    const kok = path.join(la, 'Programs', 'Python');
    try {
      for (const d of fs.readdirSync(kok)) yollar.push(path.join(kok, d, 'Scripts', 'yt-dlp.exe'));
    } catch {}
    yollar.push(path.join(la, 'Packages'));
  }
  for (const v of ['312', '311', '313', '310']) {
    yollar.push(path.join('C:\\', 'Program Files', 'Python' + v, 'Scripts', 'yt-dlp.exe'));
    yollar.push(path.join('C:\\', 'Python' + v, 'Scripts', 'yt-dlp.exe'));
  }
  yollar.push(path.join(KOK, 'yt-dlp.exe'));
  return yollar;
}

async function ytDlpBul() {
  const adaylar = [{ cmd: 'yt-dlp', base: [] }];
  for (const y of pythonScriptsKlasorleri()) {
    if (y.endsWith('.exe') && fs.existsSync(y)) adaylar.push({ cmd: y, base: [] });
  }
  adaylar.push({ cmd: 'python', base: ['-m', 'yt_dlp'] });
  adaylar.push({ cmd: 'py', base: ['-3', '-m', 'yt_dlp'] });

  for (const a of adaylar) {
    const r = await komutCalistir(a.cmd, [...a.base, '--version']);
    if (r.kod === 0 && r.cikti.trim()) return { ...a, surum: r.cikti.trim().split(/\r?\n/)[0] };
  }
  return null;
}

async function ffmpegVar() {
  const r = await komutCalistir('ffmpeg', ['-version']);
  return r.kod === 0;
}

// ---------------------------------------------------------------- isler
let sayac = 0;
const isler = new Map();          // id -> is
const kuyruk = [];                // bekleyen is id'leri
const ES_ZAMANLI = 2;
let aktif = 0;

function isOzet(is) {
  return {
    id: is.id, url: is.url, baslik: is.baslik, kanal: is.kanal, sure: is.sure,
    kapak: is.kapak, site: is.site, durum: is.durum, yuzde: is.yuzde,
    hiz: is.hiz, kalan: is.kalan, boyut: is.boyut, dosya: is.dosya,
    hata: is.hata, kalite: is.kalite, eklendi: is.eklendi,
  };
}

// ---------------------------------------------------------------- SSE
const dinleyiciler = new Set();
function yayinla(tip, veri) {
  const paket = `event: ${tip}\ndata: ${JSON.stringify(veri)}\n\n`;
  for (const r of dinleyiciler) { try { r.write(paket); } catch {} }
}
function isGuncelle(is) { yayinla('is', isOzet(is)); }

// ---------------------------------------------------------------- format secici
function formatSecici(kalite) {
  if (kalite === 'mp3') return null; // ses ayri islenir
  const h = { '2160': 2160, '1440': 1440, '1080': 1080, '720': 720, '480': 480 }[kalite];
  // "En iyi": ne varsa en yuksegi (4K dahil), kodek fark etmez
  if (!h) return 'bv*+ba/b';
  // 1440p+: cozunurluk oncelikli — YouTube 4K'yi sadece VP9/AV1 verir,
  // H.264 sartina takilirsak 1080'e duseriz
  if (h > 1080) return `bv*[height<=${h}]+ba/b[height<=${h}]/b`;
  // 1080p ve alti: once H.264+M4A (her cihazda acilir), yoksa ne varsa
  return `bv*[vcodec^=avc1][height<=${h}]+ba[ext=m4a]/bv*[height<=${h}]+ba/b[height<=${h}]/b`;
}

function siteAdi(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (/youtu/.test(h)) return 'YouTube';
    if (/tiktok/.test(h)) return 'TikTok';
    if (/(twitter|x\.com)/.test(h)) return 'X';
    if (/instagram/.test(h)) return 'Instagram';
    if (/facebook|fb\.watch/.test(h)) return 'Facebook';
    if (/reddit/.test(h)) return 'Reddit';
    return h;
  } catch { return '?'; }
}

function ortakArgs() {
  const a = [];
  if (ayar.cerez) a.push('--cookies-from-browser', 'chrome');
  return a;
}

// ---------------------------------------------------------------- bilgi cekme
async function bilgiCek(url, { liste = false } = {}) {
  const args = [
    ...YT.base, '--dump-single-json', '--no-warnings', '--ignore-config',
    ...(liste ? ['--flat-playlist'] : ['--no-playlist']),
    ...ortakArgs(), url,
  ];
  const r = await komutCalistir(YT.cmd, args);
  if (r.kod !== 0) {
    const m = (r.hata || '').split(/\r?\n/).filter(Boolean).pop() || 'Bilgi alinamadi';
    throw new Error(temizHata(m));
  }
  try { return JSON.parse(r.cikti); }
  catch { throw new Error('Yanit okunamadi (yt-dlp guncel mi?)'); }
}

function temizHata(m) {
  return String(m)
    .replace(/^ERROR:\s*/i, '')
    .replace(/;\s*please report this issue.*/i, '')
    .replace(/\s*Use --list-extractors.*/i, '')
    .trim();
}

// ---------------------------------------------------------------- indirme
function indirmeyiBaslat(is) {
  const cikti = path.join(ayar.klasor, '%(title).150B [%(id)s].%(ext)s');
  const args = [
    ...YT.base,
    '--ignore-config', '--no-playlist', '--no-mtime', '--windows-filenames',
    '--newline', '--progress', '--no-simulate',
    '--concurrent-fragments', '4', '--retries', '10', '--fragment-retries', '10',
    '--progress-template',
    'download:@P@%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
    '--print', 'after_move:@F@%(filepath)s',
    '-o', cikti,
    ...ortakArgs(),
  ];

  if (is.kalite === 'mp3') {
    args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    args.push('-f', formatSecici(is.kalite), '--merge-output-format', 'mp4');
  }
  args.push(is.url);

  is.durum = 'indiriliyor';
  is.gunluk = [];
  isGuncelle(is);

  const p = spawn(YT.cmd, args, { cwd: KOK, env: COCUK_ENV, windowsHide: true });
  is.surec = p;

  let tampon = '';
  const satirIsle = (s) => {
    if (!s) return;
    if (s.startsWith('@P@')) {
      const [ind, top, hiz, kalan] = s.slice(3).split('|');
      const i = Number(ind), t = Number(top);
      if (t > 0 && i >= 0) { is.yuzde = Math.min(99.9, (i / t) * 100); is.boyut = t; }
      is.hiz = Number(hiz) || 0;
      is.kalan = Number(kalan) || 0;
      if (is.durum !== 'indiriliyor') is.durum = 'indiriliyor';
      isGuncelle(is);
      return;
    }
    if (s.startsWith('@F@')) { is.dosya = s.slice(3).trim(); return; }
    if (/^\[Merger\]/.test(s)) { is.durum = 'birlestiriliyor'; is.yuzde = 99.9; isGuncelle(is); }
    else if (/^\[ExtractAudio\]/.test(s)) { is.durum = 'sese-cevriliyor'; is.yuzde = 99.9; isGuncelle(is); }
    else if (/^\[(Fixup|VideoConvertor|EmbedThumbnail)/.test(s)) { is.durum = 'isleniyor'; isGuncelle(is); }
    is.gunluk.push(s);
    if (is.gunluk.length > 200) is.gunluk.shift();
  };

  const akisBagla = (akis) => {
    akis.setEncoding('utf8');
    akis.on('data', (d) => {
      tampon += d;
      const satirlar = tampon.split(/\r?\n/);
      tampon = satirlar.pop();
      for (const s of satirlar) satirIsle(s.trim());
    });
  };
  akisBagla(p.stdout);
  akisBagla(p.stderr);

  p.on('error', (e) => {
    is.durum = 'hata';
    is.hata = String(e && e.message || e);
    isGuncelle(is); isBitti(is);
  });

  p.on('close', (kod) => {
    if (tampon) satirIsle(tampon.trim());
    if (is.durum === 'iptal') { isBitti(is); return; }
    if (kod === 0) {
      is.durum = 'bitti';
      is.yuzde = 100;
      is.hiz = 0; is.kalan = 0;
      if (is.dosya) { try { is.boyut = fs.statSync(is.dosya).size; } catch {} }
    } else {
      is.durum = 'hata';
      const satir = is.gunluk.filter((l) => /^ERROR/i.test(l)).pop()
        || is.gunluk.filter(Boolean).pop() || `yt-dlp ${kod} kodu ile cikti`;
      is.hata = temizHata(satir);
    }
    isGuncelle(is);
    isBitti(is);
  });
}

function isBitti(is) {
  is.surec = null;
  aktif = Math.max(0, aktif - 1);
  kuyrugaBak();
}

function kuyrugaBak() {
  while (aktif < ES_ZAMANLI && kuyruk.length) {
    const id = kuyruk.shift();
    const is = isler.get(id);
    if (!is || is.durum === 'iptal') continue;
    aktif++;
    isHazirla(is);
  }
}

async function isHazirla(is) {
  try {
    is.durum = 'bilgi-aliniyor';
    isGuncelle(is);
    const b = await bilgiCek(is.url);
    is.baslik = b.title || is.url;
    is.kanal = b.uploader || b.channel || b.uploader_id || '';
    is.sure = b.duration || 0;
    is.kapak = b.thumbnail || '';
    if (is.durum === 'iptal') { isBitti(is); return; }
    indirmeyiBaslat(is);
  } catch (e) {
    is.durum = 'hata';
    is.hata = String(e && e.message || e);
    isGuncelle(is);
    isBitti(is);
  }
}

function isEkle(url, kalite) {
  const is = {
    id: ++sayac, url: url.trim(), kalite,
    baslik: url.trim(), kanal: '', sure: 0, kapak: '', site: siteAdi(url),
    durum: 'bekliyor', yuzde: 0, hiz: 0, kalan: 0, boyut: 0,
    dosya: '', hata: '', gunluk: [], surec: null, eklendi: Date.now(),
  };
  isler.set(is.id, is);
  kuyruk.push(is.id);
  isGuncelle(is);
  kuyrugaBak();
  return is;
}

// ---------------------------------------------------------------- youtube arama filtresi
/*
 * YouTube'un "sp" parametresi bir protobuf. Elle kuruyoruz:
 *   alan 1 = siralama (3 = izlenmeye gore)
 *   alan 2 = filtre paketi { 1: yukleme tarihi, 2: tur(1=video), 3: sure(1=kisa,2=uzun) }
 */
function youtubeAramaUrl(sorgu, donem, tur) {
  const tarih = { bugun: 2, hafta: 3, ay: 4, yil: 5 }[donem]; // yoksa: tum zamanlar
  const sure = { kisa: 1, uzun: 2 }[tur];                     // kisa = 4 dk alti (Shorts dahil)

  const filtre = [];
  if (tarih) filtre.push(0x08, tarih);
  filtre.push(0x10, 0x01);                                    // sadece video
  if (sure) filtre.push(0x18, sure);

  const bayt = [0x08, 0x03, 0x12, filtre.length, ...filtre];  // siralama: izlenme + filtreler
  const sp = Buffer.from(bayt).toString('base64');

  return 'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(sorgu) + '&sp=' + encodeURIComponent(sp);
}

// ---------------------------------------------------------------- vidIQ canli kesif
/*
 * Otomasyonun .env'indeki VIDIQ_KEY ile mcp.vidiq.com'a baglanir,
 * haftanin viral videolarini ceker (viral-analiz.js'deki istemcinin uyarlamasi).
 * Anahtar: panel > Kaynaklar sekmesi  (app.vidiq.com/account/settings/mcp)
 */
function vidiqAnahtar() {
  if (process.env.VIDIQ_KEY) return process.env.VIDIQ_KEY.trim();
  for (const dosya of [path.join(KOK, '.env'), path.join(KOK, '..', '.env')]) {
    try {
      for (const l of fs.readFileSync(dosya, 'utf8').split(/\r?\n/)) {
        const m = l.match(/^VIDIQ_KEY=(.*)$/);
        if (m && m[1].trim()) return m[1].trim();
      }
    } catch { /* dosya yoksa gec */ }
  }
  return '';
}

let vidiqOturum = null, vidiqSayac = 0;
function vidiqIstek(anahtar, govde, bildirim) {
  return new Promise((coz, red) => {
    const veri = JSON.stringify(govde);
    const h = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': 'Bearer ' + anahtar,
      'Content-Length': Buffer.byteLength(veri),
    };
    if (vidiqOturum) h['Mcp-Session-Id'] = vidiqOturum;
    const r = https.request({ hostname: 'mcp.vidiq.com', path: '/mcp', method: 'POST', headers: h, timeout: 90000 }, (res) => {
      if (res.headers['mcp-session-id']) vidiqOturum = res.headers['mcp-session-id'];
      let g = '';
      res.on('data', (c) => g += c);
      res.on('end', () => {
        if (res.statusCode === 401) return red(new Error('vidIQ anahtari kabul edilmedi — Kaynaklar sekmesinden yenile'));
        if (bildirim) return coz(null);
        let j = null;
        if (/^\s*\{/.test(g)) { try { j = JSON.parse(g); } catch {} }
        if (!j) for (const s of g.split(/\r?\n/)) {
          const m = s.match(/^data:\s*(\{.*\})\s*$/);
          if (m) { try { const p = JSON.parse(m[1]); if (p.result || p.error) j = p; } catch {} }
        }
        if (!j) return red(new Error('vidIQ yaniti okunamadi'));
        if (j.error) return red(new Error(j.error.message || 'vidIQ hatasi'));
        coz(j.result);
      });
    });
    r.on('timeout', () => { r.destroy(new Error('vidIQ zaman asimi (90 sn)')); });
    r.on('error', red);
    r.write(veri); r.end();
  });
}

async function vidiqBaslat(anahtar) {
  vidiqOturum = null;
  await vidiqIstek(anahtar, {
    jsonrpc: '2.0', id: ++vidiqSayac, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'video-indirici', version: '1.0' } },
  });
  await vidiqIstek(anahtar, { jsonrpc: '2.0', method: 'notifications/initialized' }, true);
}
const vidiqCagir = (anahtar, ad, arg) =>
  vidiqIstek(anahtar, { jsonrpc: '2.0', id: ++vidiqSayac, method: 'tools/call', params: { name: ad, arguments: arg } });

function mcpYapili(s) {
  if (!s) return null;
  if (s.structuredContent) return s.structuredContent;
  const t = s.content && s.content.find((x) => x.type === 'text');
  if (!t) return null;
  try { return JSON.parse(t.text); } catch { return t.text; }
}
function mcpMetin(s) {
  if (!s || !s.content) return '';
  return s.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
}

// "5.3M" -> 5300000 , "327.2K" -> 327200
function kisaltmaSayi(s) {
  const m = /^([\d.,]+)\s*([KMB])?$/i.exec(String(s).trim());
  if (!m) return 0;
  const c = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(parseFloat(m[1].replace(/,/g, '')) * c);
}

// vidIQ'nun IG/TikTok arama ciktisi markdown metin doner — ayristir.
// (arac/kesfet-derle.cjs ile ayni mantik)
function igTiktokAyristir(ham) {
  const satirlar = String(ham).split('\n');
  const sonuc = [];
  let platform = null, acik = null;
  const bitir = () => { if (acik && acik.url) sonuc.push(acik); acik = null; };

  for (const s of satirlar) {
    if (/^##\s*Instagram/i.test(s)) { bitir(); platform = 'instagram'; continue; }
    if (/^##\s*TikTok/i.test(s)) { bitir(); platform = 'tiktok'; continue; }
    const bas = /^\*\*@([^*]+)\*\*\s*[—-]\s*"?(.*?)"?\s*$/.exec(s);
    if (bas) {
      bitir();
      acik = { platform, kanal: '@' + bas[1].trim(), baslik: (bas[2] || '').replace(/\.\.\.$/, '').trim(),
        izlenme: 0, takipci: 0, sure: 0, katsayi: 0, url: '' };
      continue;
    }
    if (!acik) continue;
    const olcu = /^\s+([\d.,]+[KMB]?)\s+views(?:\s*\(([\d.,]+)x[^)]*\))?/.exec(s);
    if (olcu) {
      acik.izlenme = kisaltmaSayi(olcu[1]);
      acik.katsayi = olcu[2] ? parseFloat(olcu[2].replace(/,/g, '')) : 0;
      const tak = /·\s*([\d.,]+[KMB]?)\s+followers/.exec(s);
      if (tak) acik.takipci = kisaltmaSayi(tak[1]);
      const sr = /·\s*(\d+)s\s*$/.exec(s);
      if (sr) acik.sure = Number(sr[1]);
      continue;
    }
    const tt = /^\s*(https:\/\/www\.tiktok\.com\/@[^\s/]+\/video\/\d+)/.exec(s);
    if (tt) { acik.url = tt[1]; continue; }
    const ig = /^\s*reel:([A-Za-z0-9_-]+)/.exec(s);
    if (ig) { acik.url = 'https://www.instagram.com/reel/' + ig[1] + '/'; continue; }
  }
  bitir();
  return sonuc;
}

// ---------------------------------------------------------------- dosyalar
const VIDEO_UZANTI = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4a', '.mp3', '.opus', '.wav', '.avi']);

function indirilenler() {
  klasorGarantile();
  let liste = [];
  try {
    liste = fs.readdirSync(ayar.klasor)
      .filter((a) => VIDEO_UZANTI.has(path.extname(a).toLowerCase()))
      .map((a) => {
        const t = path.join(ayar.klasor, a);
        const s = fs.statSync(t);
        return { ad: a, boyut: s.size, tarih: s.mtimeMs };
      })
      .sort((x, y) => y.tarih - x.tarih)
      .slice(0, 200);
  } catch {}
  return liste;
}

function guvenliYol(ad) {
  const temiz = path.basename(String(ad || ''));
  const tam = path.join(ayar.klasor, temiz);
  const kok = path.resolve(ayar.klasor) + path.sep;
  if (!path.resolve(tam).startsWith(kok)) return null;
  return tam;
}

function explorerdaAc(hedef) {
  spawn('explorer.exe', hedef ? ['/select,', hedef] : [ayar.klasor], { windowsHide: false, detached: true }).unref();
}
function varsayilanUygulamaylaAc(hedef) {
  spawn('cmd', ['/c', 'start', '', hedef], { windowsHide: true, detached: true }).unref();
}

// ---------------------------------------------------------------- http
function govdeOku(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
}
function json(res, veri, kod = 200) {
  const g = Buffer.from(JSON.stringify(veri));
  res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': g.length });
  res.end(g);
}

const sunucu = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const yol = u.pathname;

  try {
    // --- arayuz
    if (yol === '/' || yol === '/index.html') {
      const g = fs.readFileSync(path.join(KOK, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(g);
    }

    // --- canli akis
    if (yol === '/api/akis') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 2000\n\n');
      dinleyiciler.add(res);
      for (const is of isler.values()) res.write(`event: is\ndata: ${JSON.stringify(isOzet(is))}\n\n`);
      const nabiz = setInterval(() => { try { res.write(': nabiz\n\n'); } catch {} }, 20000);
      req.on('close', () => { clearInterval(nabiz); dinleyiciler.delete(res); });
      return;
    }

    if (yol === '/api/durum') {
      return json(res, {
        ytdlp: YT ? YT.surum : null,
        ffmpeg: global.__ffmpeg === true,
        ayar: { klasor: ayar.klasor, kalite: ayar.kalite, cerez: ayar.cerez },
        isler: [...isler.values()].map(isOzet),
        dosyalar: indirilenler(),
      });
    }

    if (yol === '/api/indir' && req.method === 'POST') {
      if (!YT) return json(res, { hata: 'yt-dlp bulunamadi' }, 500);
      const g = await govdeOku(req);
      const kalite = String(g.kalite || ayar.kalite);
      const liste = !!g.liste;
      const ham = String(g.url || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      const linkler = ham.filter((s) => /^https?:\/\//i.test(s));
      if (!linkler.length) return json(res, { hata: 'Gecerli bir link bulamadim (http ile baslamali)' }, 400);

      ayar.kalite = kalite; ayarKaydet();

      const eklenen = [];
      for (const l of linkler) {
        if (liste && /list=|\/playlist|\/@|\/channel\//i.test(l)) {
          try {
            const b = await bilgiCek(l, { liste: true });
            const girdiler = (b.entries || []).filter((e) => e && (e.url || e.id));
            if (girdiler.length) {
              for (const e of girdiler) {
                const tekil = e.url && /^https?:/.test(e.url) ? e.url
                  : `https://www.youtube.com/watch?v=${e.id}`;
                eklenen.push(isEkle(tekil, kalite).id);
              }
              continue;
            }
          } catch { /* liste degilmis, tekil dene */ }
        }
        eklenen.push(isEkle(l, kalite).id);
      }
      return json(res, { tamam: true, adet: eklenen.length });
    }

    if (yol === '/api/iptal' && req.method === 'POST') {
      const g = await govdeOku(req);
      const is = isler.get(Number(g.id));
      if (!is) return json(res, { hata: 'is yok' }, 404);
      const bekliyordu = !is.surec;
      is.durum = 'iptal';
      if (is.surec) { try { is.surec.kill(); } catch {} }
      else {
        const i = kuyruk.indexOf(is.id);
        if (i >= 0) kuyruk.splice(i, 1);
      }
      isGuncelle(is);
      if (bekliyordu) kuyrugaBak();
      return json(res, { tamam: true });
    }

    if (yol === '/api/tekrar' && req.method === 'POST') {
      const g = await govdeOku(req);
      const eski = isler.get(Number(g.id));
      if (!eski) return json(res, { hata: 'is yok' }, 404);
      const yeni = isEkle(eski.url, eski.kalite);
      return json(res, { tamam: true, id: yeni.id });
    }

    if (yol === '/api/temizle' && req.method === 'POST') {
      for (const [id, is] of [...isler]) {
        if (['bitti', 'hata', 'iptal'].includes(is.durum)) { isler.delete(id); yayinla('sil', { id }); }
      }
      return json(res, { tamam: true });
    }

    if (yol === '/api/klasor' && req.method === 'POST') {
      const g = await govdeOku(req);
      const hedef = g.dosya ? guvenliYol(g.dosya) : null;
      klasorGarantile();
      explorerdaAc(hedef && fs.existsSync(hedef) ? hedef : null);
      return json(res, { tamam: true });
    }

    if (yol === '/api/oynat' && req.method === 'POST') {
      const g = await govdeOku(req);
      const hedef = guvenliYol(g.dosya);
      if (!hedef || !fs.existsSync(hedef)) return json(res, { hata: 'dosya yok' }, 404);
      varsayilanUygulamaylaAc(hedef);
      return json(res, { tamam: true });
    }

    if (yol === '/api/sil' && req.method === 'POST') {
      const g = await govdeOku(req);
      const hedef = guvenliYol(g.dosya);
      if (!hedef || !fs.existsSync(hedef)) return json(res, { hata: 'dosya yok' }, 404);
      fs.unlinkSync(hedef);
      return json(res, { tamam: true });
    }

    if (yol === '/api/ayar' && req.method === 'POST') {
      const g = await govdeOku(req);
      if (typeof g.klasor === 'string' && g.klasor.trim()) {
        const y = g.klasor.trim();
        try { fs.mkdirSync(y, { recursive: true }); ayar.klasor = y; }
        catch (e) { return json(res, { hata: 'Klasor acilamadi: ' + e.message }, 400); }
      }
      if (typeof g.cerez === 'boolean') ayar.cerez = g.cerez;
      if (typeof g.kalite === 'string') ayar.kalite = g.kalite;
      ayarKaydet();
      return json(res, { tamam: true, ayar });
    }

    if (yol === '/api/guncelle' && req.method === 'POST') {
      const r = await komutCalistir('python', ['-m', 'pip', 'install', '-U', '--disable-pip-version-check', 'yt-dlp']);
      YT = await ytDlpBul();
      return json(res, { tamam: r.kod === 0, surum: YT ? YT.surum : null, cikti: (r.cikti + r.hata).slice(-1500) });
    }

    if (yol === '/api/gunluk') {
      const is = isler.get(Number(u.searchParams.get('id')));
      return json(res, { gunluk: is ? is.gunluk.slice(-80) : [] });
    }

    // --- kesfet: hazir viral akis (vidIQ verisi, kesfet-veri.json)
    if (yol === '/api/kesfet') {
      try {
        const g = JSON.parse(fs.readFileSync(path.join(KOK, 'kesfet-veri.json'), 'utf8'));
        return json(res, g);
      } catch {
        return json(res, { guncellendi: null, videolar: [], adet: 0 });
      }
    }

    // --- kesfet: vidIQ'dan CANLI viral tazeleme (VIDIQ_KEY gerekir, ~10 kredi)
    if (yol === '/api/kesfet-yenile' && req.method === 'POST') {
      const anahtar = vidiqAnahtar();
      if (!anahtar) {
        return json(res, {
          hata: 'VIDIQ_KEY girilmemis. Otomasyon panelinin Kaynaklar sekmesinden ekle ' +
                '(anahtar: app.vidiq.com/account/settings/mcp). O zamana kadar hazir liste gosterilir.',
        }, 400);
      }
      const g = await govdeOku(req);
      const minYT = Number(g.minIzlenme) || 1000000;
      const hatalar = [];
      let ytListe = [], sosyalListe = [];
      try {
        await vidiqBaslat(anahtar);

        // 1) YouTube Shorts — bu haftanin patlayanlari (izlenmeye gore)
        try {
          const d = mcpYapili(await vidiqCagir(anahtar, 'vidiq_outliers', {
            contentType: 'short', language: 'en', publishedWithin: 'thisWeek',
            minViews: minYT, limit: 50, sort: 'viewCount',
          }));
          ytListe = ((d && d.videos) || []).map((v) => ({
            platform: 'youtube', baslik: v.videoTitle || '', kanal: v.channelTitle || '',
            izlenme: v.viewCount || 0, takipci: v.subscriberCount || 0, sure: v.videoDuration || 0,
            saatlik: Math.round(v.vph || 0), katsayi: v.breakoutScore || 0, tarih: v.videoPublishedAt || '',
            kapak: 'https://i.ytimg.com/vi/' + v.videoId + '/hqdefault.jpg',
            url: 'https://www.youtube.com/watch?v=' + v.videoId,
          }));
        } catch (e) { hatalar.push('YouTube: ' + e.message); }

        // 2) TikTok + Instagram — son 7 gunun patlayanlari
        try {
          const hafta = new Date(Date.now() - 7 * 86400000).toISOString();
          const s = await vidiqCagir(anahtar, 'vidiq_instagram_tiktok_outlier_search', {
            query: 'viral trending video everyone is sharing this week',
            audienceQuery: 'Culture/Region: Global; Global: true; Demographics: general audience 18-45, entertainment, humor;',
            resultsPerPlatform: 25, viewsMin: 3000000, datePostedAfter: hafta, collapseByCreator: true,
          });
          sosyalListe = igTiktokAyristir(mcpMetin(s));
        } catch (e) { hatalar.push('TikTok/IG: ' + e.message); }
      } catch (e) {
        return json(res, { hata: 'vidIQ baglantisi: ' + String(e && e.message || e) }, 502);
      }

      const videolar = [...ytListe, ...sosyalListe]
        .filter((v) => v.url && v.izlenme > 0)
        .sort((a, b) => b.izlenme - a.izlenme);
      if (!videolar.length) {
        return json(res, { hata: 'vidIQ sonuc dondurmedi' + (hatalar.length ? ' — ' + hatalar.join(' · ') : '') }, 502);
      }

      const cikti = {
        guncellendi: new Date().toISOString(), kaynak: 'vidIQ (canli)',
        adet: videolar.length, videolar,
      };
      try { fs.writeFileSync(path.join(KOK, 'kesfet-veri.json'), JSON.stringify(cikti, null, 1)); } catch {}
      return json(res, { ...cikti, uyari: hatalar.length ? hatalar.join(' · ') : undefined });
    }

    // --- kesfet: canli YouTube aramasi (yt-dlp, bedava, sinirsiz)
    if (yol === '/api/kesfet-ara' && req.method === 'POST') {
      if (!YT) return json(res, { hata: 'yt-dlp bulunamadi' }, 500);
      const g = await govdeOku(req);
      const sorgu = String(g.sorgu || '').trim();
      if (!sorgu) return json(res, { hata: 'Aranacak kelime yaz' }, 400);
      try {
        const url = youtubeAramaUrl(sorgu, g.donem, g.tur);
        const r = await komutCalistir(YT.cmd, [
          ...YT.base, '-J', '--flat-playlist', '--no-warnings', '--ignore-config',
          '--playlist-end', String(Math.min(Number(g.adet) || 60, 100)), url,
        ]);
        if (r.kod !== 0) throw new Error(temizHata((r.hata || '').split(/\r?\n/).filter(Boolean).pop() || 'arama basarisiz'));
        const b = JSON.parse(r.cikti.replace(/^﻿/, ''));
        const min = Number(g.minIzlenme) || 0;
        const videolar = (b.entries || [])
          .filter((e) => e && e.id && e.view_count >= min)
          .map((e) => ({
            platform: 'youtube', baslik: e.title || '', kanal: e.channel || e.uploader || '',
            izlenme: e.view_count || 0, sure: e.duration || 0, takipci: e.channel_follower_count || 0,
            kapak: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${e.id}`,
          }))
          .sort((x, y) => y.izlenme - x.izlenme);
        return json(res, { videolar, adet: videolar.length });
      } catch (e) {
        return json(res, { hata: String(e && e.message || e) }, 500);
      }
    }

    // --- indirilen dosyayi tarayicida onizle (range destekli)
    if (yol.startsWith('/dosya/')) {
      const hedef = guvenliYol(decodeURIComponent(yol.slice('/dosya/'.length)));
      if (!hedef || !fs.existsSync(hedef)) { res.writeHead(404); return res.end('yok'); }
      const st = fs.statSync(hedef);
      const uz = path.extname(hedef).toLowerCase();
      const tip = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
        '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg' }[uz] || 'application/octet-stream';
      const aralik = req.headers.range;
      if (aralik) {
        const m = /bytes=(\d*)-(\d*)/.exec(aralik) || [];
        const bas = m[1] ? parseInt(m[1], 10) : 0;
        const son = m[2] ? parseInt(m[2], 10) : st.size - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${bas}-${son}/${st.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': son - bas + 1,
          'Content-Type': tip,
        });
        return fs.createReadStream(hedef, { start: bas, end: son }).pipe(res);
      }
      res.writeHead(200, { 'Content-Length': st.size, 'Content-Type': tip, 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(hedef).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bulunamadi');
  } catch (e) {
    try { json(res, { hata: String(e && e.message || e) }, 500); } catch {}
  }
});

// ---------------------------------------------------------------- acilis
(async () => {
  YT = await ytDlpBul();
  global.__ffmpeg = await ffmpegVar();

  sunucu.listen(PORT, '127.0.0.1', () => {
    const c = (s) => s;
    console.log('');
    console.log('  ' + c('VIDEO INDIRICI'));
    console.log('  ------------------------------------------');
    console.log('  Panel    : http://localhost:' + PORT);
    console.log('  Klasor   : ' + ayar.klasor);
    console.log('  yt-dlp   : ' + (YT ? YT.surum + '  (' + YT.cmd + ')' : 'BULUNAMADI  ->  panelden "Kur/Guncelle"'));
    console.log('  ffmpeg   : ' + (global.__ffmpeg ? 'var' : 'YOK (1080p birlestirme calismaz)'));
    console.log('  ------------------------------------------');
    console.log('  Kapatmak icin bu pencereyi kapat.');
    console.log('');
  });
})();
