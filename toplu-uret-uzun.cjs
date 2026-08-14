/*
 * toplu-uret-uzun.cjs — senaryo manifestinden TOPLU UZUN VIDEO uretir (16:9, 15+ dk).
 * Iki serit: [hazirlik] seslendir -> gorsel-bul (sirali, API nezaketi)
 *            [render]   hazirligi biten is GPU'da render edilir
 *
 * Kullanim: node toplu-uret-uzun.cjs <senaryolar.json>
 * Manifest: [{ "slug":"021-ornek", "baslik_en":"...", "paragraflar":["...", ...] }, ...]
 * Ornek:    uretim/SON-15-SENARYO.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const OTO = __dirname;
const URETIM = path.join(OTO, 'uretim');
const MANIFEST = process.argv[2];
if (!MANIFEST || !fs.existsSync(MANIFEST)) { console.error('kullanim: node uretim-15.cjs <senaryolar.json>'); process.exit(1); }

const isler = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
console.log(`${isler.length} is yuklendi\n`);

function calistir(script, arg) {
  return new Promise((coz) => {
    const p = spawn('node', [script, arg], { cwd: OTO, windowsHide: true });
    let log = '';
    p.stdout.on('data', (d) => log += d);
    p.stderr.on('data', (d) => log += d);
    p.on('close', (kod) => coz({ kod, log }));
    p.on('error', (e) => coz({ kod: -1, log: String(e) }));
  });
}

// 1) dosyalari yaz
for (const is of isler) {
  const B = path.join(URETIM, is.slug);
  fs.mkdirSync(path.join(B, 'Voice'), { recursive: true });
  fs.writeFileSync(path.join(B, 'konu.json'), JSON.stringify({
    baslik_en: is.baslik_en,
    kanal: 'SINGULARITY HORIZON',
    format: 'long',
    aspect: '16:9',
    geriSayim: 5,
    intro: 10,
    konuKarti: 3,
    outro: 12,
    muzikSeviyesi: 0.4,
    hedefSaniye: 930,
    renk: 'sinematik',
    gecis: 'dissolve',
  }, null, 2));
  fs.writeFileSync(path.join(B, 'Voice', 'SESLENDIRME-TAM-METIN.txt'),
    is.paragraflar.join('\n\n') + '\n');
}
console.log('konu.json + senaryo dosyalari yazildi\n');

// 2) iki serit
const hazir = [];        // render bekleyenler
const durum = {};        // slug -> asama
let hazirlikBitti = false;

async function hazirlikSeridi() {
  for (const is of isler) {
    // yarim kalan kosudan devam: bitmis videoyu atla
    const sonMp4 = path.join(URETIM, is.slug, 'Videos', is.slug + '.mp4');
    if (fs.existsSync(sonMp4)) {
      durum[is.slug] = 'BITTI';
      console.log(`[hazirlik] ${is.slug} zaten uretilmis, atlandi`);
      continue;
    }
    const t0 = Date.now();
    durum[is.slug] = 'seslendirme';
    console.log(`[hazirlik] ${is.slug} seslendiriliyor...`);
    let r = await calistir('seslendir.js', is.slug);
    if (r.kod !== 0) { console.log(`[HATA] ${is.slug} seslendirme:\n${r.log.slice(-400)}`); durum[is.slug] = 'HATA-ses'; continue; }

    // gorseller onceden inikse (pilot) tekrar cekme
    const visKlasor = path.join(URETIM, is.slug, 'Visuals');
    let mevcutGorsel = 0;
    try {
      for (const d of fs.readdirSync(visKlasor)) {
        const alt = path.join(visKlasor, d);
        if (fs.statSync(alt).isDirectory())
          mevcutGorsel += fs.readdirSync(alt).filter((x) => /\.(jpg|png)$/i.test(x)).length;
      }
    } catch {}
    if (mevcutGorsel >= 6) {
      console.log(`[hazirlik] ${is.slug} gorseller zaten var (${mevcutGorsel}), atlandi`);
    } else {
      durum[is.slug] = 'gorsel';
      console.log(`[hazirlik] ${is.slug} gorseller cekiliyor...`);
      r = await calistir('gorsel-bul.js', is.slug);
      if (r.kod !== 0) { console.log(`[HATA] ${is.slug} gorsel:\n${r.log.slice(-400)}`); durum[is.slug] = 'HATA-gorsel'; continue; }
    }

    durum[is.slug] = 'render-bekliyor';
    hazir.push(is.slug);
    console.log(`[hazirlik] ${is.slug} HAZIR (${((Date.now()-t0)/1000|0)} sn) — render kuyrugunda`);
  }
  hazirlikBitti = true;
}

async function renderSeridi() {
  const bitti = [];
  while (!hazirlikBitti || hazir.length) {
    const slug = hazir.shift();
    if (!slug) { await new Promise((z) => setTimeout(z, 3000)); continue; }
    const t0 = Date.now();
    durum[slug] = 'render';
    console.log(`[render] ${slug} basladi...`);
    const r = await calistir('video-yap.js', slug);
    if (r.kod !== 0) { console.log(`[HATA] ${slug} render:\n${r.log.slice(-600)}`); durum[slug] = 'HATA-render'; continue; }
    const mp4 = path.join(URETIM, slug, 'Videos', slug + '.mp4');
    const varMi = fs.existsSync(mp4);
    durum[slug] = varMi ? 'BITTI' : 'HATA-mp4yok';
    bitti.push(slug);
    console.log(`[render] ${slug} ${varMi ? 'BITTI' : 'mp4 bulunamadi!'} (${((Date.now()-t0)/1000|0)} sn) — ${bitti.length}/${isler.length}`);
  }
  return bitti;
}

(async () => {
  const t0 = Date.now();
  const [, bitti] = await Promise.all([hazirlikSeridi(), renderSeridi()]);
  console.log('\n========== OZET ==========');
  for (const is of isler) console.log(`  ${is.slug}: ${durum[is.slug] || '?'}`);
  console.log(`Toplam: ${bitti.length}/${isler.length} video, ${((Date.now()-t0)/60000).toFixed(1)} dk`);
})();
