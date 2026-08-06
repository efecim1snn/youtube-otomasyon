/*
 * kesfet-derle.cjs — vidIQ ciktisini panelin okudugu kesfet-veri.json'a cevirir.
 *
 * Kullanim:
 *   node arac/kesfet-derle.cjs <vidiq-ig-tiktok-dump.json> <youtube-shorts.json>
 *
 * youtube-shorts.json = vidiq_trending_videos ciktisi ({"videos":[...]})
 * ig/tiktok dump      = vidiq_instagram_tiktok_outlier_search ciktisi (metin bloklari)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const [, , igYol, ytYol] = process.argv;

/* ---------------------------------------------- yardimcilar */
function sayiyaCevir(s) {
  // "5.3M" -> 5300000 ,  "327.2K" -> 327200
  const m = /^([\d.,]+)\s*([KMB])?$/i.exec(String(s).trim());
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const c = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(n * c);
}

/* ---------------------------------------------- IG + TikTok */
function igTiktokAyristir(yol) {
  if (!yol || !fs.existsSync(yol)) return [];
  let ham = fs.readFileSync(yol, 'utf8');
  try {
    const j = JSON.parse(ham);
    if (Array.isArray(j)) ham = j.map((x) => x.text || '').join('\n');
  } catch { /* duz metin olabilir */ }

  const satirlar = ham.split('\n');
  const sonuc = [];
  let platform = null;
  let acik = null;

  const bitir = () => {
    if (acik && acik.url) sonuc.push(acik);
    acik = null;
  };

  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];

    if (/^##\s*Instagram/i.test(s)) { bitir(); platform = 'instagram'; continue; }
    if (/^##\s*TikTok/i.test(s)) { bitir(); platform = 'tiktok'; continue; }

    // **@handle** — "aciklama"
    const bas = /^\*\*@([^*]+)\*\*\s*[—-]\s*"?(.*?)"?\s*$/.exec(s);
    if (bas) {
      bitir();
      acik = {
        platform, kanal: '@' + bas[1].trim(),
        baslik: (bas[2] || '').replace(/\.\.\.$/, '').trim(),
        izlenme: 0, takipci: 0, sure: 0, katsayi: 0, konu: '', url: '',
      };
      continue;
    }
    if (!acik) continue;

    // 5.3M views (2731.8x their median of 1.9K) · 258 followers · 16s
    const olcu = /^\s+([\d.,]+[KMB]?)\s+views(?:\s*\(([\d.,]+)x[^)]*\))?/.exec(s);
    if (olcu) {
      acik.izlenme = sayiyaCevir(olcu[1]);
      acik.katsayi = olcu[2] ? parseFloat(olcu[2].replace(/,/g, '')) : 0;
      const tak = /·\s*([\d.,]+[KMB]?)\s+followers/.exec(s);
      if (tak) acik.takipci = sayiyaCevir(tak[1]);
      const sr = /·\s*(\d+)s\s*$/.exec(s);
      if (sr) acik.sure = Number(sr[1]);
      continue;
    }

    const tt = /^\s*(https:\/\/www\.tiktok\.com\/@[^\s/]+\/video\/\d+)/.exec(s);
    if (tt) { acik.url = tt[1]; continue; }

    const ig = /^\s*reel:([A-Za-z0-9_-]+)/.exec(s);
    if (ig) { acik.url = `https://www.instagram.com/reel/${ig[1]}/`; continue; }

    const konu = /^\s*\*\*niche\*\*:\s*(.+)$/.exec(s);
    if (konu) { acik.konu = konu[1].trim(); continue; }
  }
  bitir();
  return sonuc;
}

/* ---------------------------------------------- YouTube */
function youtubeAyristir(yol) {
  if (!yol || !fs.existsSync(yol)) return [];
  const j = JSON.parse(fs.readFileSync(yol, 'utf8'));
  const v = j.videos || j.results || (Array.isArray(j) ? j : []);
  return v.map((x) => ({
    platform: 'youtube',
    baslik: x.videoTitle || '',
    kanal: x.channelTitle || '',
    izlenme: x.viewCount || 0,
    takipci: x.subscriberCount || 0,
    sure: x.videoDuration || 0,
    saatlik: Math.round(x.vph || 0),
    begeni: x.likeCount || 0,
    tarih: x.videoPublishedAt || '',
    konu: '',
    kapak: `https://i.ytimg.com/vi/${x.videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${x.videoId}`,
  }));
}

/* ---------------------------------------------- derle */
const kayitlar = [...youtubeAyristir(ytYol), ...igTiktokAyristir(igYol)]
  .filter((k) => k.url && k.izlenme > 0)
  .sort((a, b) => b.izlenme - a.izlenme);

const cikti = {
  guncellendi: new Date().toISOString(),
  kaynak: 'vidIQ',
  adet: kayitlar.length,
  videolar: kayitlar,
};

const hedef = path.join(KOK, 'kesfet-veri.json');
fs.writeFileSync(hedef, JSON.stringify(cikti, null, 1));

const say = (p) => kayitlar.filter((k) => k.platform === p).length;
console.log(`kesfet-veri.json yazildi -> ${kayitlar.length} video`);
console.log(`  YouTube  : ${say('youtube')}`);
console.log(`  TikTok   : ${say('tiktok')}`);
console.log(`  Instagram: ${say('instagram')}`);
