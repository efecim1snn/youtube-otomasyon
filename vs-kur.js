// VS ISLERINI KURAR: vs.json yazar + gorselleri indirir.
// Kullanim: node vs-kur.js            (hepsi)
//           node vs-kur.js 103 105     (sadece bunlar)
"use strict";
const https = require("https");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;
function env(a) {
  try { for (const l of fs.readFileSync(path.join(KOK, ".env"), "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && m[1] === a) return m[2].trim(); } } catch (e) {}
  return "";
}
const PEX = env("PEXELS_KEY"), PIX = env("PIXABAY_KEY");

const get = (u, h) => new Promise((ok, no) => {
  https.get(u, { headers: h || {} }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return get(r.headers.location, h).then(ok, no);
    if (r.statusCode !== 200) return no(new Error("HTTP " + r.statusCode));
    const c = []; r.on("data", d => c.push(d)); r.on("end", () => ok(Buffer.concat(c)));
  }).on("error", no);
});

async function gorselBul(sorgu) {
  let a = [];
  try {
    const d = JSON.parse((await get("https://api.pexels.com/v1/search?query=" + encodeURIComponent(sorgu) +
      "&per_page=25&orientation=portrait", { Authorization: PEX })).toString());
    a = (d.photos || []).map(p => ({ u: p.src.large2x || p.src.original, w: p.width, h: p.height, k: "pexels", alt: p.alt || "" }));
  } catch (e) {}
  if (a.length < 4) try {
    const d = JSON.parse((await get("https://pixabay.com/api/?key=" + PIX + "&q=" + encodeURIComponent(sorgu) +
      "&image_type=photo&per_page=25&orientation=vertical")).toString());
    a = a.concat((d.hits || []).map(p => ({ u: p.largeImageURL, w: p.imageWidth, h: p.imageHeight, k: "pixabay", alt: p.tags || "" })));
  } catch (e) {}
  return a;
}

// ---------------------------------------------------------------------------
// Tum sayilar gercek. Kaynak: yayimlanmis olcumler ve tur profilleri.
// Tahmin olan yerlerde metinde "~" var; olculmus olanlar duz yazilmis.
const ISLER = [
// ---------------------------------------------------------------------------
// ORNEK ESLESMELER
// Kendi konularini buraya ekle. Her olcu icin:
//   u / a     : sayisal deger (bar uzunlugu bundan hesaplanir)
//   uM / aM   : ekranda gorunen metin
//   k         : o turu kim kazaniyor ("ust" | "alt")
//   n         : plakette gorunen tek satirlik not
// ara         : gorsel arama kelimesi
// Sayilari kendin dogrula — ekranda yazan her sey iddiadir.
// ---------------------------------------------------------------------------
{ id: "ornek-1", baslik: "OPTION A vs OPTION B",
  ust: { ad: "OPTION A", renk: "3BE07A", ara: "mountain landscape" },
  alt: { ad: "OPTION B", renk: "FFB020", ara: "desert landscape" },
  olculer: [
    { ad: "HEIGHT",  u: 8848, uM: "8848 m", a: 0,    aM: "sea level", k: "ust", n: "highest point on land" },
    { ad: "AREA",    u: 1,    uM: "small",  a: 9,    aM: "vast",      k: "alt", n: "one covers far more ground" },
    { ad: "RAINFALL",u: 450,  uM: "450 mm", a: 25,   aM: "25 mm",     k: "ust", n: "per year" },
    { ad: "SPECIES", u: 3,    uM: "FEW",    a: 4,    aM: "MANY",      k: "alt", n: "life finds a way" },
  ], kazanan: "ust",
  sonuc: "One wins on extremes.", sonuc2: "The other wins on scale." },
];

// ---------------------------------------------------------------------------
(async () => {
  const sec = process.argv.slice(2);
  const liste = sec.length ? ISLER.filter(x => sec.some(s => x.id.startsWith(s))) : ISLER;
  console.log(liste.length + " is kurulacak\n");

  for (const w of liste) {
    const kok = path.join(KOK, "uretim", w.id);
    const img = path.join(kok, "Images");
    fs.mkdirSync(img, { recursive: true });

    const vs = {
      baslik: w.baslik, altBaslik: "WHO WINS?",
      ust: { ad: w.ust.ad, renk: w.ust.renk },
      alt: { ad: w.alt.ad, renk: w.alt.renk },
      introSure: 4.0, olcuSure: 5.8, sonSure: 7.0,
      olculer: w.olculer.map(o => ({
        ad: o.ad, ustDeger: o.u, ustMetin: o.uM, altDeger: o.a, altMetin: o.aM,
        kazanan: o.k, not: o.n,
      })),
      kazanan: w.kazanan, sonuc: w.sonuc, sonuc2: w.sonuc2,
    };
    fs.writeFileSync(path.join(kok, "vs.json"), JSON.stringify(vs, null, 2), "utf8");

    for (const [taraf, ad] of [[w.ust, "ust.jpg"], [w.alt, "alt.jpg"]]) {
      const hedef = path.join(img, ad);
      if (fs.existsSync(hedef) && fs.statSync(hedef).size > 20000) { console.log("  " + ad + " zaten var"); continue; }
      const a = await gorselBul(taraf.ara);
      const s = a.find(x => x.h >= x.w * 1.1) || a[0];
      if (!s) { console.log("  !! GORSEL YOK: " + taraf.ara); continue; }
      try {
        const b = await get(s.u);
        fs.writeFileSync(hedef, b);
        console.log(`  ${ad}  "${taraf.ara}"  ${s.w}x${s.h} ${s.k}  (${(b.length/1024)|0} KB)`);
      } catch (e) { console.log("  !! indirilemedi: " + taraf.ara + " — " + e.message); }
    }
    console.log(w.id + " hazir (" + vs.olculer.length + " olcu, " +
      (vs.introSure + vs.olcuSure * vs.olculer.length + vs.sonSure).toFixed(1) + " sn)\n");
  }
})();
