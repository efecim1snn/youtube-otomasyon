// MASAUSTU KONTROL PANELI — sifir bagimlilik, tarayicida calisir.
// Baslat: PANEL.bat  (cift tikla)
"use strict";
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const KOK = __dirname;
const URETIM = path.join(KOK, "uretim");
const PUBLIC = path.join(KOK, "panel-public");
const PORT = 4173;

// calisan islerin ciktilarini tutar
const LOGLAR = new Map();   // id -> { satirlar:[], bitti:bool, kod:number, komut:string }
let sayac = 0;

const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".png":"image/png", ".jpg":"image/jpeg", ".ico":"image/x-icon" };

const guvenli = s => typeof s === "string" && /^[A-Za-z0-9._-]+$/.test(s);

function json(res, kod, obj) {
  res.writeHead(kod, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function govde(req) {
  return new Promise(r => {
    let d = ""; req.on("data", c => { d += c; if (d.length > 5e6) req.destroy(); });
    req.on("end", () => { try { r(d ? JSON.parse(d) : {}); } catch (e) { r({}); } });
  });
}

// --- bir isin durumunu cikar ---
function isDurumu(ad) {
  const b = path.join(URETIM, ad);
  const say = p => { try { return fs.readdirSync(p).length; } catch (e) { return 0; } };
  const dosyaVar = p => { try { return fs.statSync(p).size > 0; } catch (e) { return false; } };

  let konu = null;
  try { konu = JSON.parse(fs.readFileSync(path.join(b, "konu.json"), "utf8")); } catch (e) {}

  let gorsel = 0;
  const vis = path.join(b, "Visuals");
  try {
    for (const d of fs.readdirSync(vis)) {
      const p = path.join(vis, d);
      if (fs.statSync(p).isDirectory()) gorsel += fs.readdirSync(p).filter(x => /\.jpe?g|\.png$/i.test(x)).length;
    }
  } catch (e) {}

  const sesParca = say(path.join(b, "Voice", "parts"));
  const senaryo = dosyaVar(path.join(b, "Voice", "SESLENDIRME-TAM-METIN.txt"));
  const trAlt = dosyaVar(path.join(b, "Voice", "ALTYAZI-TR.txt"));

  let video = null;
  try {
    const v = fs.readdirSync(path.join(b, "Videos")).filter(x => x.endsWith(".mp4"));
    if (v.length) {
      const st = fs.statSync(path.join(b, "Videos", v[0]));
      video = { ad: v[0], mb: Math.round(st.size / 1048576) };
    }
  } catch (e) {}

  let kelime = 0;
  try {
    kelime = fs.readFileSync(path.join(b, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8")
      .split(/\s+/).filter(Boolean).length;
  } catch (e) {}

  return {
    ad, baslik: (konu && konu.baslik_en) || ad,
    format: (konu && konu.format) === "reels" ? "reels"
          : (konu && konu.aspect) === "9:16" ? "short" : "long",
    konuVar: !!konu, senaryo, trAlt, kelime,
    dakika: kelime ? Math.round((kelime / 151 + 0.5) * 10) / 10 : 0,
    gorsel, sesParca, video
  };
}

// --- script calistir ---
function calistir(komut, argv) {
  const id = "r" + (++sayac);
  const kayit = { satirlar: [], bitti: false, kod: null, komut: komut + " " + argv.join(" ") };
  LOGLAR.set(id, kayit);
  const p = spawn(process.execPath, [path.join(KOK, komut), ...argv], { cwd: KOK });
  kayit.surec = p;
  const ekle = d => {
    const t = d.toString().replace(/\r/g, "\n");
    for (const l of t.split("\n")) if (l.trim()) kayit.satirlar.push(l);
    if (kayit.satirlar.length > 400) kayit.satirlar.splice(0, kayit.satirlar.length - 400);
  };
  p.stdout.on("data", ekle);
  p.stderr.on("data", ekle);
  p.on("close", k => {
    kayit.surec = null; kayit.bitti = true; kayit.kod = k;
    kayit.satirlar.push(kayit.iptal ? "■ DURDURULDU" : k === 0 ? "✓ BITTI" : "✗ HATA (kod " + k + ")");
  });
  return id;
}

// --- calisan islemi (ve alt islemlerini) durdur ---
// ffmpeg node'un TORUNU oldugu icin sadece node'u oldurmek yetmez:
// Windows'ta taskkill /T ile tum agac kapatilir.
function durdur(id) {
  const kayit = LOGLAR.get(id);
  if (!kayit || kayit.bitti) return false;
  kayit.iptal = true;
  const p = kayit.surec;
  if (!p || !p.pid) { kayit.bitti = true; kayit.satirlar.push("■ DURDURULDU"); return true; }
  try {
    spawn("taskkill", ["/PID", String(p.pid), "/T", "/F"], { windowsHide: true });
  } catch (e) { try { p.kill(); } catch (e2) {} }
  return true;
}

// --- birden fazla scripti sirayla calistir, hepsi tek log'a yazsin ---
// adimlar: [{ ad, komut, argv, atla? }]  atla()=true ise o adim gecilir
function zincir(adimlar) {
  const id = "r" + (++sayac);
  const kayit = { satirlar: [], bitti: false, kod: null, komut: "zincir: " + adimlar.map(a => a.ad).join(" -> ") };
  LOGLAR.set(id, kayit);

  const yaz = t => {
    for (const l of String(t).replace(/\r/g, "\n").split("\n")) if (l.trim()) kayit.satirlar.push(l);
    if (kayit.satirlar.length > 800) kayit.satirlar.splice(0, kayit.satirlar.length - 800);
  };

  let i = 0;
  const sonraki = () => {
    if (i >= adimlar.length) {
      kayit.bitti = true; kayit.kod = 0;
      yaz("✓ ZINCIR TAMAM — video hazir");
      return;
    }
    if (kayit.iptal) { kayit.surec = null; kayit.bitti = true; yaz("■ DURDURULDU"); return; }
    const a = adimlar[i++];
    if (a.atla && a.atla()) { yaz("— " + a.ad + " atlandi (gerekmiyor)"); return sonraki(); }

    yaz("");
    yaz("▶ " + (i) + "/" + adimlar.length + " — " + a.ad);
    const p = spawn(process.execPath, [path.join(KOK, a.komut), ...a.argv], { cwd: KOK });
    kayit.surec = p;
    p.stdout.on("data", d => yaz(d));
    p.stderr.on("data", d => yaz(d));
    p.on("close", k => {
      kayit.surec = null;
      if (kayit.iptal) { kayit.bitti = true; kayit.kod = -1; yaz("■ DURDURULDU — " + a.ad + " yarida kesildi"); return; }
      if (k !== 0) {
        kayit.bitti = true; kayit.kod = k;
        yaz("✗ " + a.ad + " HATA verdi (kod " + k + ") — zincir durdu");
        return;
      }
      yaz("✓ " + a.ad + " bitti");
      sonraki();
    });
  };
  sonraki();
  return id;
}

// --- .env'den bir anahtar oku ---
function anahtar(ad) {
  try {
    for (const l of fs.readFileSync(path.join(KOK, ".env"), "utf8").split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === ad) return m[2].trim();
    }
  } catch (e) {}
  return "";
}

// --- senaryo dosyasi dolu mu ---
function senaryoVar(is) {
  try {
    return fs.readFileSync(path.join(URETIM, is, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8").trim().length >= 50;
  } catch (e) { return false; }
}

// --- bir isin konu.json'una gore hangi adimlar gerekli ---
function zincirAdimlari(is) {
  const b = path.join(URETIM, is);
  let k = {};
  try { k = JSON.parse(fs.readFileSync(path.join(b, "konu.json"), "utf8")); } catch (e) {}

  const varMi = alan => Array.isArray(k[alan]) && k[alan].length > 0;
  const adimlar = [];

  // Senaryo motoru: Claude API varsa o (kaliteli), yoksa vidIQ (yedek).
  if (!senaryoVar(is)) {
    const claudeVar = !!anahtar("ANTHROPIC_API_KEY");
    adimlar.push({
      ad: claudeVar ? "Senaryo yazimi (Claude)" : "Senaryo yazimi (vidIQ)",
      komut: claudeVar ? "senaryo-claude.js" : "senaryo-yaz.js",
      argv: [is],
    });
  }

  // gorseller: konu ne olursa olsun senaryodan cikarilip bulunur
  adimlar.push({ ad: "Gorsel bulma", komut: "gorsel-bul.js", argv: [is] });

  // kartlar sadece konu.json'da elle tanimlanmissa (eski isler)
  if (varMi("formuller")) adimlar.push({ ad: "Formul kartlari", komut: "formul-kart.js", argv: [is] });
  if (varMi("promptlar")) adimlar.push({ ad: "Prompt kartlari", komut: "prompt-kart.js", argv: [is] });
  adimlar.push({ ad: "Seslendirme", komut: "seslendir.js", argv: [is] });
  adimlar.push({ ad: "Video kurulumu", komut: "video-yap.js", argv: [is] });
  // vidIQ varsa baslik + etiket analizi (istege bagli, hata verse de zinciri durdurmaz)
  if (anahtar("VIDIQ_KEY"))
    adimlar.push({ ad: "Baslik & etiket analizi", komut: "baslik-analiz.js", argv: [is] });
  return adimlar;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const yol = u.pathname;

  if (yol === "/api/isler") {
    let liste = [];
    try {
      liste = fs.readdirSync(URETIM, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => isDurumu(d.name))
        .sort((a, b) => a.ad.localeCompare(b.ad));
    } catch (e) {}
    return json(res, 200, { isler: liste });
  }

  // --- genel ayarlar (kanal adi vs) ---
  const AYAR_P = path.join(KOK, "panel-ayar.json");
  const ayarOku = () => { try { return JSON.parse(fs.readFileSync(AYAR_P, "utf8")); }
                          catch (e) { return { kanal: "KANALIM", nasa: true, wikimedia: true }; } };
  if (yol === "/api/ayarlar") {
    if (req.method === "POST") {
      const b = await govde(req);
      fs.writeFileSync(AYAR_P, JSON.stringify(b, null, 2), "utf8");
      return json(res, 200, { ok: true });
    }
    return json(res, 200, ayarOku());
  }

  if (yol === "/api/yeni" && req.method === "POST") {
    const b = await govde(req);
    const ad = String(b.ad || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!ad) return json(res, 400, { hata: "gecersiz ad" });
    const dir = path.join(URETIM, ad);
    if (fs.existsSync(dir)) return json(res, 409, { hata: "bu isim zaten var" });
    fs.mkdirSync(path.join(dir, "Voice"), { recursive: true });
    // long  = YouTube uzun video, 16:9, en az 15 dk
    // short = YouTube Shorts,     9:16, en fazla 45 sn
    // reels = Instagram Reels,    9:16, en fazla 90 sn
    const reels = b.format === "reels";
    const short = b.format === "short";
    const dikey = short || reels;
    const ay = ayarOku();

    // Sahne / arama kelimesi TANIMLANMAZ — gorsel-bul.js bunlari
    // senaryodan kendisi cikarir. Kullanici sadece konu + baslik verir.
    const konu = {
      baslik_en: b.baslik || ad,
      kanal: b.kanal || ay.kanal || "KANALIM",
      format: reels ? "reels" : short ? "short" : "long",
      aspect: dikey ? "9:16" : "16:9",
      geriSayim: dikey ? 0 : (b.geriSayim === false ? 0 : 5),
      intro: dikey ? 1.5 : 10,
      konuKarti: dikey ? 0 : 3,
      // Reels'te abone-ol kapanisi yok — Instagram'da anlamsiz
      outro: reels ? 0 : short ? 3 : 12,
      muzikSeviyesi: 0.25,
      // Sureyi kullanici belirler. Varsayilanlar:
      //   Shorts 40 sn  — YouTube 45 sn siniri
      //   Reels 180 sn  — Instagram 3 dk ustunu takipcisi olmayanlara onermiyor
      //   Uzun  15 dk   — Osman'in standardi, altina dusmez
      hedefSaniye: Math.round(60 * (Number(b.sureDk) > 0 ? Number(b.sureDk)
                                  : reels ? 3 : short ? 0.67 : 15)),
      _not: String(b.nis || "").trim() || undefined,
    };

    fs.writeFileSync(path.join(dir, "konu.json"), JSON.stringify(konu, null, 2), "utf8");
    fs.writeFileSync(path.join(dir, "Voice", "SESLENDIRME-TAM-METIN.txt"), "", "utf8");
    return json(res, 200, { ok: true, ad });
  }

  if (yol === "/api/dosya") {
    const is = u.searchParams.get("is"), tur = u.searchParams.get("tur");
    if (!guvenli(is)) return json(res, 400, { hata: "gecersiz is" });
    const harita = { konu: "konu.json", senaryo: "Voice/SESLENDIRME-TAM-METIN.txt", altyazi: "Voice/ALTYAZI-TR.txt" };
    const rel = harita[tur]; if (!rel) return json(res, 400, { hata: "gecersiz tur" });
    const p = path.join(URETIM, is, rel);
    if (req.method === "POST") {
      const b = await govde(req);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, String(b.icerik || ""), "utf8");
      return json(res, 200, { ok: true });
    }
    let icerik = ""; try { icerik = fs.readFileSync(p, "utf8"); } catch (e) {}
    return json(res, 200, { icerik });
  }

  if (yol === "/api/calistir" && req.method === "POST") {
    const b = await govde(req);
    const izin = {
      senaryo:  [anahtar("ANTHROPIC_API_KEY") ? "senaryo-claude.js" : "senaryo-yaz.js", [b.is]],
      senaryoV: ["senaryo-yaz.js",   [b.is]],   // vidIQ ile (yedek)
      baslik:   ["baslik-analiz.js", [b.is]],
      gorsel:  ["gorsel-bul.js",  [b.is]],
      nasa:    ["gorsel-cek.js",  [b.is, String(b.adet || 12)]],
      portre:  ["portre-cek.js",  [b.is]],
      formul:  ["formul-kart.js", [b.is]],
      prompt:  ["prompt-kart.js", [b.is]],
      ses:     ["seslendir.js",   [b.is]],
      video:   ["video-yap.js",   [b.is]],
      tonMuzik:["ton-analiz.js",  [b.klasor]],
      mix:     ["mix-pro.js",     [b.klasor, b.mixAd || "DJ MIX"]],
    };
    if (b.is && !guvenli(b.is)) return json(res, 400, { hata: "gecersiz is" });

    // tek tus: konudan bitmis videoya kadar hepsi (senaryo dahil)
    if (b.tur === "hepsi") {
      if (!senaryoVar(b.is) && !anahtar("ANTHROPIC_API_KEY") && !anahtar("VIDIQ_KEY"))
        return json(res, 400, {
          hata: "Senaryo yazmak icin bir anahtar gerekiyor.\n\n" +
                "Kaynaklar sekmesine git:\n" +
                "  • Claude (onerilen, kaliteli) → console.anthropic.com/settings/keys\n" +
                "  • vidIQ (yedek) → app.vidiq.com/account/settings/mcp"
        });
      return json(res, 200, { id: zincir(zincirAdimlari(b.is)) });
    }

    const g = izin[b.tur];
    if (!g) return json(res, 400, { hata: "gecersiz islem" });
    return json(res, 200, { id: calistir(g[0], g[1]) });
  }

  if (yol === "/api/log") {
    const id = u.searchParams.get("id");
    const k = LOGLAR.get(id);
    if (!k) return json(res, 404, { hata: "yok" });
    // surec nesnesi JSON'a cevrilemez, disarida birak
    return json(res, 200, { satirlar: k.satirlar, bitti: k.bitti, kod: k.kod, komut: k.komut, iptal: !!k.iptal });
  }

  if (yol === "/api/durdur" && req.method === "POST") {
    const b = await govde(req);
    return json(res, 200, { ok: durdur(b.id) });
  }

  // --- gorunum ayarlari: konu.json'daki belirli anahtarlari gunceller ---
  if (yol === "/api/gorunum" && req.method === "POST") {
    const b = await govde(req);
    if (!guvenli(b.is)) return json(res, 400, { hata: "gecersiz is" });
    const p = path.join(URETIM, b.is, "konu.json");
    let k = {}; try { k = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) {}
    const izinli = ["gecis","gecisSure","efekt","renk","muzikSeviyesi","intro","outro","konuKarti","geriSayim","kanal"];
    for (const a of izinli) if (b[a] !== undefined && b[a] !== "") {
      k[a] = (typeof k[a] === "number" || ["gecisSure","muzikSeviyesi","intro","outro","konuKarti","geriSayim"].includes(a))
             ? Number(b[a]) : b[a];
    }
    fs.writeFileSync(p, JSON.stringify(k, null, 2), "utf8");
    return json(res, 200, { ok: true });
  }

  // --- bir isin gorselleri: listele / sil ---
  if (yol === "/api/gorseller") {
    const is = u.searchParams.get("is");
    if (!guvenli(is)) return json(res, 400, { hata: "gecersiz is" });
    const vis = path.join(URETIM, is, "Visuals");
    const out = [];
    try {
      for (const d of fs.readdirSync(vis)) {
        const dp = path.join(vis, d);
        if (!fs.statSync(dp).isDirectory()) continue;
        for (const f of fs.readdirSync(dp)) {
          if (/\.(jpe?g|png)$/i.test(f)) out.push({ sahne: d, ad: f });
        }
      }
    } catch (e) {}
    return json(res, 200, { gorseller: out });
  }
  if (yol === "/api/gorsel-sil" && req.method === "POST") {
    const b = await govde(req);
    if (!guvenli(b.is) || !guvenli(b.sahne) || !b.ad) return json(res, 400, { hata: "gecersiz" });
    const p = path.join(URETIM, b.is, "Visuals", b.sahne, b.ad);
    if (!p.startsWith(path.join(URETIM, b.is))) return json(res, 400, { hata: "gecersiz" });
    try { fs.unlinkSync(p); } catch (e) {}
    return json(res, 200, { ok: true });
  }
  // gorsel onizleme
  if (yol.startsWith("/onizle/")) {
    const [, , is, sahne, ...rest] = yol.split("/");
    const ad = decodeURIComponent(rest.join("/"));
    if (!guvenli(is) || !guvenli(sahne)) { res.writeHead(400); return res.end(); }
    const p = path.join(URETIM, is, "Visuals", sahne, ad);
    if (!p.startsWith(URETIM)) { res.writeHead(403); return res.end(); }
    return fs.readFile(p, (e, buf) => {
      if (e) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "image/jpeg", "Cache-Control": "max-age=60" });
      res.end(buf);
    });
  }

  // --- API anahtarlari (.env) ---
  if (yol === "/api/anahtarlar") {
    const envP = path.join(KOK, ".env");
    if (req.method === "POST") {
      const b = await govde(req);
      // mevcut anahtarlari koru — sadece gonderilenleri guncelle (yoksa digerleri silinir)
      const mevcut = {};
      try {
        for (const l of fs.readFileSync(envP, "utf8").split(/\r?\n/)) {
          const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m) mevcut[m[1]] = m[2];
        }
      } catch (e) {}
      for (const [k, v] of Object.entries(b)) {
        if (/^[A-Z0-9_]+$/.test(k) && typeof v === "string" && v.trim()) mevcut[k] = v.trim();
      }
      fs.writeFileSync(envP, Object.entries(mevcut).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", "utf8");
      return json(res, 200, { ok: true });
    }
    const cikti = {};
    try {
      for (const l of fs.readFileSync(envP, "utf8").split(/\r?\n/)) {
        const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) cikti[m[1]] = m[2] ? "••••••" + m[2].slice(-4) : "";
      }
    } catch (e) {}
    return json(res, 200, cikti);
  }

  // --- anahtarlari canli test et ---
  if (yol === "/api/anahtar-test") {
    const sonuc = {};

    // vidIQ
    const vk = anahtar("VIDIQ_KEY");
    if (!vk) sonuc.vidiq = { ok: false, mesaj: "anahtar girilmemiş" };
    else sonuc.vidiq = await new Promise(coz => {
      const g = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "panel", version: "1.0" } } });
      const r = https.request({
        hostname: "mcp.vidiq.com", path: "/mcp", method: "POST", timeout: 20000,
        headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                   "Authorization": "Bearer " + vk, "Content-Length": Buffer.byteLength(g) },
      }, res => {
        let b = ""; res.on("data", c => b += c);
        res.on("end", () => {
          if (res.statusCode === 200) return coz({ ok: true, mesaj: "çalışıyor — senaryo motoru hazır" });
          let d = ""; try { d = JSON.parse(b).detail || ""; } catch (e) {}
          coz({ ok: false, mesaj: res.statusCode === 401
            ? "anahtar geçersiz (" + (d || "reddedildi") + ") — vidIQ'dan yeni anahtar al"
            : "HTTP " + res.statusCode });
        });
      });
      r.on("timeout", () => { r.destroy(); coz({ ok: false, mesaj: "vidIQ yanıt vermedi" }); });
      r.on("error", e => coz({ ok: false, mesaj: e.message }));
      r.write(g); r.end();
    });

    // Pexels
    const pk = anahtar("PEXELS_KEY");
    if (!pk) sonuc.pexels = { ok: false, mesaj: "anahtar girilmemiş (isteğe bağlı)" };
    else sonuc.pexels = await new Promise(coz => {
      const r = https.request({
        hostname: "api.pexels.com", path: "/v1/search?query=test&per_page=1", method: "GET",
        headers: { "Authorization": pk }, timeout: 20000,
      }, res => {
        res.resume();
        coz(res.statusCode === 200
          ? { ok: true, mesaj: "çalışıyor — yüksek kaliteli görseller açık" }
          : { ok: false, mesaj: res.statusCode === 401 ? "anahtar geçersiz" : "HTTP " + res.statusCode });
      });
      r.on("timeout", () => { r.destroy(); coz({ ok: false, mesaj: "Pexels yanıt vermedi" }); });
      r.on("error", e => coz({ ok: false, mesaj: e.message }));
      r.end();
    });

    // Pixabay
    const bk = anahtar("PIXABAY_KEY");
    if (!bk) sonuc.pixabay = { ok: false, mesaj: "anahtar girilmemiş (isteğe bağlı)" };
    else sonuc.pixabay = await new Promise(coz => {
      const r = https.get("https://pixabay.com/api/?key=" + encodeURIComponent(bk) +
        "&q=test&image_type=photo&per_page=3", { timeout: 20000 }, res => {
        res.resume();
        coz(res.statusCode === 200
          ? { ok: true, mesaj: "çalışıyor — geniş arşiv açık" }
          : { ok: false, mesaj: "anahtar geçersiz (HTTP " + res.statusCode + ")" });
      });
      r.on("timeout", () => { r.destroy(); coz({ ok: false, mesaj: "Pixabay yanıt vermedi" }); });
      r.on("error", e => coz({ ok: false, mesaj: e.message }));
    });

    return json(res, 200, sonuc);
  }

  if (yol === "/api/ac" && req.method === "POST") {
    const b = await govde(req);
    if (!guvenli(b.is)) return json(res, 400, { hata: "gecersiz" });
    const d = path.join(URETIM, b.is, b.klasor === "video" ? "Videos" : "");
    spawn("explorer.exe", [d], { detached: true });
    return json(res, 200, { ok: true });
  }

  // statik
  let f = yol === "/" ? "/panel.html" : yol;
  const dosya = path.join(PUBLIC, path.normalize(f).replace(/^(\.\.[/\\])+/, ""));
  if (!dosya.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(dosya, (e, buf) => {
    if (e) { res.writeHead(404); return res.end("yok"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(dosya)] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log("\n  ============================================");
  console.log("   YOUTUBE OTOMASYON PANELI");
  console.log("  ============================================\n");
  console.log("   http://localhost:" + PORT + "\n");
  console.log("   Kapatmak icin bu pencereyi kapat.\n");
});
