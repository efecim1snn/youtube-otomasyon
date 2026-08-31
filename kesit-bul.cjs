/*
 * kesit-bul.cjs — paragraf indekslerinden, final videonun altyazi zamanlamasina gore
 * Shorts kesit araliklari uretir. Yontem: SRT kelime akisi ile senaryo kelime akisini hizalar.
 * Kullanim: node kesit-bul.cjs <is-slug> <secim.json> <cikti-kesitler.json>
 * secim.json: [{ "ad":"giyotin", "bas":0, "son":1 }, ...]  (paragraf indeksleri, dahil)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const [, , JOB, SECIM, CIKTI] = process.argv;
const BASE = path.join(__dirname, 'uretim', JOB);

const paragraflar = JSON.parse(fs.readFileSync(path.join(BASE, 'paragraflar.json'), 'utf8'));
let srtYol = path.join(BASE, 'altyazi.srt'), kaydirma = 0;
if (!fs.existsSync(srtYol)) { srtYol = path.join(BASE, 'Voice', 'altyazi.srt'); kaydirma = 19; }
const srt = fs.readFileSync(srtYol, 'utf8').replace(/\r/g, '');
const zaman = (t) => { const m = /(\d+):(\d+):(\d+),(\d+)/.exec(t); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000; };
const normal = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

// SRT -> kelime akisi (her kelime hangi cue'dan)
const cueler = [];
for (const blok of srt.split(/\n\n+/)) {
  const s = blok.trim().split('\n'); if (s.length < 3) continue;
  const z = /(\S+) --> (\S+)/.exec(s[1]); if (!z) continue;
  cueler.push({ bas: zaman(z[1]) + kaydirma, son: zaman(z[2]) + kaydirma, metin: s.slice(2).join(' ') });
}
const srtKelime = []; // {k, cue}
cueler.forEach((c, ci) => normal(c.metin).forEach((k) => srtKelime.push({ k, cue: ci })));

// senaryo -> kelime akisi (her kelime hangi paragraftan)
const senKelime = [];
paragraflar.forEach((p, pi) => normal(p).forEach((k) => senKelime.push({ k, par: pi })));

// hizalama: ayni metin oldugu icin indeksler buyuk oranda ortusur; sapmayi pencereyle duzelt
function cueIndeksi(senIdx) {
  const hedef = senKelime[senIdx].k;
  const oran = srtKelime.length / senKelime.length;
  const tahmin = Math.round(senIdx * oran);
  // tahmin etrafinda +-120 kelimelik pencerede, 3 kelimelik dizi eslesmesi ara
  const dizi = senKelime.slice(senIdx, senIdx + 3).map((x) => x.k).join(' ');
  for (let d = 0; d <= 120; d++) {
    for (const j of [tahmin - d, tahmin + d]) {
      if (j < 0 || j + 2 >= srtKelime.length) continue;
      const aday = srtKelime.slice(j, j + 3).map((x) => x.k).join(' ');
      if (aday === dizi) return srtKelime[j].cue;
    }
  }
  // tek kelime esleme (son care)
  for (let d = 0; d <= 60; d++) for (const j of [tahmin - d, tahmin + d])
    if (j >= 0 && j < srtKelime.length && srtKelime[j].k === hedef) return srtKelime[j].cue;
  throw new Error('kelime hizalanamadi: ' + hedef + ' (senaryo kelime #' + senIdx + ')');
}

const parBas = [], parSon = [];
senKelime.forEach((x, i) => { if (parBas[x.par] === undefined) parBas[x.par] = i; parSon[x.par] = i; });

const secim = JSON.parse(fs.readFileSync(SECIM, 'utf8'));
const kesitler = [];
for (const s of secim) {
  const c1 = cueIndeksi(parBas[s.bas]);
  const c2 = cueIndeksi(parSon[s.son]);
  const bas = Math.max(0, cueler[c1].bas - 0.25);
  const son = cueler[c2].son + 0.45;
  kesitler.push({ ad: s.ad, bas: +bas.toFixed(2), sure: +(son - bas).toFixed(2) });
  console.log(`${s.ad.padEnd(22)} par ${s.bas}-${s.son}  ${bas.toFixed(1)}s -> ${son.toFixed(1)}s  (${(son - bas).toFixed(1)} sn)  | "${cueler[c1].metin.slice(0, 28)}…${cueler[c2].metin.slice(-22)}"`);
}
fs.writeFileSync(CIKTI, JSON.stringify(kesitler, null, 1));
console.log('kesitler yazildi (' + (kaydirma ? 'Voice SRT +19s' : 'final SRT') + ')');
