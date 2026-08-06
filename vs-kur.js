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
{ id: "102-kaplan-vs-aslan", baslik: "SIBERIAN TIGER vs AFRICAN LION",
  ust: { ad: "SIBERIAN TIGER", renk: "FF8A2B", ara: "siberian tiger" },
  alt: { ad: "AFRICAN LION",   renk: "FFD24A", ara: "male lion mane" },
  olculer: [
    { ad: "WEIGHT",       u: 300, uM: "300 kg", a: 272, aM: "272 kg", k: "ust", n: "heaviest wild males recorded" },
    { ad: "BODY LENGTH",  u: 280, uM: "2.8 m",  a: 210, aM: "2.1 m",  k: "ust", n: "nose to base of tail" },
    { ad: "BITE FORCE",   u: 1050, uM: "1050 PSI", a: 650, aM: "650 PSI", k: "ust", n: "at the canine tip" },
    { ad: "CANINE LENGTH",u: 9,   uM: "9 cm",   a: 6.4, aM: "6.4 cm", k: "ust", n: "longest canines of any big cat" },
    { ad: "TOP SPEED",    u: 65,  uM: "65 km/h",a: 80,  aM: "80 km/h",k: "alt", n: "the lion is the faster sprinter" },
    { ad: "PAW STRIKE",   u: 4,   uM: "~4 kN",  a: 3,   aM: "~3 kN",  k: "ust", n: "a single swipe can break bone" },
    { ad: "FIGHT RECORD", u: 3,   uM: "SOLITARY", a: 2, aM: "PRIDE",  k: "ust", n: "the tiger fights alone every day" },
  ], kazanan: "ust",
  sonuc: "Mass and bite decide it.", sonuc2: "The lion's mane helps. Not enough." },

{ id: "103-boz-ayi-vs-goril", baslik: "GRIZZLY BEAR vs SILVERBACK GORILLA",
  ust: { ad: "GRIZZLY BEAR", renk: "C98A4B", ara: "grizzly bear" },
  alt: { ad: "SILVERBACK",   renk: "9AA7B4", ara: "silverback gorilla" },
  olculer: [
    { ad: "WEIGHT",      u: 400, uM: "400 kg", a: 220, aM: "220 kg", k: "ust", n: "large males, upper range" },
    { ad: "STANDING HEIGHT", u: 240, uM: "2.4 m", a: 175, aM: "1.75 m", k: "ust", n: "reach decides who lands first" },
    { ad: "BITE FORCE",  u: 975, uM: "975 PSI", a: 1300, aM: "1300 PSI", k: "alt", n: "the gorilla has the stronger jaw" },
    { ad: "CLAW LENGTH", u: 10,  uM: "10 cm",  a: 2,   aM: "2 cm",   k: "ust", n: "built for digging through frozen ground" },
    { ad: "TOP SPEED",   u: 56,  uM: "56 km/h",a: 40,  aM: "40 km/h",k: "ust", n: "faster than a sprinting human" },
    { ad: "ARM STRENGTH",u: 3,   uM: "HIGH",   a: 4,   aM: "EXTREME", k: "alt", n: "the gorilla wins on raw pulling power" },
    { ad: "WEAPONS",     u: 4,   uM: "CLAWS + JAW", a: 2, aM: "JAW ONLY", k: "ust", n: "gorillas do not fight to kill" },
  ], kazanan: "ust",
  sonuc: "Stronger jaw. Wrong weapons.", sonuc2: "Twice the mass and 10 cm claws end it." },

{ id: "104-beyaz-kopekbaligi-vs-timsah", baslik: "GREAT WHITE SHARK vs SALTWATER CROCODILE",
  ust: { ad: "GREAT WHITE", renk: "5FC8FF", ara: "great white shark" },
  alt: { ad: "SALTWATER CROC", renk: "7BC24A", ara: "saltwater crocodile" },
  olculer: [
    { ad: "LENGTH",     u: 610, uM: "6.1 m",   a: 630, aM: "6.3 m",   k: "alt", n: "largest reliably measured of each" },
    { ad: "WEIGHT",     u: 2000, uM: "2000 kg", a: 1300, aM: "1300 kg", k: "ust", n: "the shark is the heavier animal" },
    { ad: "BITE FORCE", u: 4000, uM: "~4000 PSI", a: 3700, aM: "3700 PSI", k: "alt", n: "the croc figure is measured. the shark's is modelled" },
    { ad: "TOP SPEED",  u: 40,  uM: "40 km/h", a: 29,  aM: "29 km/h", k: "ust", n: "in short bursts" },
    { ad: "TEETH",      u: 300, uM: "300 TEETH", a: 66, aM: "66 TEETH", k: "ust", n: "serrated, and replaced for life" },
    { ad: "ARMOUR",     u: 2,   uM: "TOUGH SKIN", a: 4, aM: "BONY PLATES", k: "alt", n: "osteoderms under the scales" },
    { ad: "BREATH HOLD",u: 4,   uM: "UNLIMITED", a: 1, aM: "1 HOUR",   k: "ust", n: "in open water the croc has to surface" },
  ], kazanan: "ust",
  sonuc: "In open water, the shark.", sonuc2: "In a river, this flips completely." },

{ id: "105-hipopotam-vs-nil-timsahi", baslik: "HIPPO vs NILE CROCODILE",
  ust: { ad: "HIPPO", renk: "D4808F", ara: "hippopotamus" },
  alt: { ad: "NILE CROCODILE", renk: "8FBF4A", ara: "nile crocodile" },
  olculer: [
    { ad: "WEIGHT",     u: 2000, uM: "2000 kg", a: 750, aM: "750 kg", k: "ust", n: "nearly 3x the crocodile" },
    { ad: "LENGTH",     u: 400, uM: "4.0 m",   a: 550, aM: "5.5 m",   k: "alt", n: "the croc is longer but far lighter" },
    { ad: "BITE FORCE", u: 1800, uM: "1800 PSI", a: 3000, aM: "3000 PSI", k: "alt", n: "the croc bites harder" },
    { ad: "GAPE",       u: 150, uM: "150 DEGREES", a: 80, aM: "80 DEGREES", k: "ust", n: "the widest gape of any land mammal" },
    { ad: "CANINE LENGTH", u: 50, uM: "50 cm",  a: 13,  aM: "13 cm",  k: "ust", n: "self-sharpening tusks" },
    { ad: "LAND SPEED", u: 30,  uM: "30 km/h", a: 17,  aM: "17 km/h", k: "ust", n: "for a 2 tonne animal" },
    { ad: "OBSERVED OUTCOME", u: 4, uM: "DOMINANT", a: 1, aM: "AVOIDS", k: "ust", n: "crocodiles move away from hippo pods" },
  ], kazanan: "ust",
  sonuc: "The croc bites harder and still loses.", sonuc2: "Filmed repeatedly in the wild." },

{ id: "106-harpi-vs-kartal", baslik: "HARPY EAGLE vs GOLDEN EAGLE",
  ust: { ad: "HARPY EAGLE", renk: "B9C6D2", ara: "harpy eagle" },
  alt: { ad: "GOLDEN EAGLE", renk: "E0A93F", ara: "golden eagle" },
  olculer: [
    { ad: "WEIGHT",      u: 9,   uM: "9 kg",    a: 6.5, aM: "6.5 kg", k: "ust", n: "females of both species" },
    { ad: "WINGSPAN",    u: 224, uM: "2.24 m",  a: 234, aM: "2.34 m", k: "alt", n: "the harpy has shorter wings on purpose" },
    { ad: "TALON LENGTH",u: 12.5,uM: "12.5 cm", a: 6,   aM: "6 cm",   k: "ust", n: "as long as a grizzly bear's claws" },
    { ad: "GRIP FORCE",  u: 530, uM: "~530 PSI", a: 440, aM: "440 PSI", k: "ust", n: "enough to crush a monkey's skull" },
    { ad: "DIVE SPEED",  u: 80,  uM: "80 km/h", a: 320, aM: "320 km/h", k: "alt", n: "the golden eagle is a missile" },
    { ad: "PREY WEIGHT", u: 8,   uM: "8 kg",    a: 5,   aM: "5 kg",   k: "ust", n: "sloths and monkeys, lifted in flight" },
    { ad: "MANOEUVRE",   u: 4,   uM: "FOREST",  a: 2,   aM: "OPEN SKY", k: "ust", n: "short wings turn inside a forest" },
  ], kazanan: "ust",
  sonuc: "In the open sky, the golden eagle.", sonuc2: "Anywhere else, those talons win." },

{ id: "107-komodo-vs-bal-porsugu", baslik: "KOMODO DRAGON vs HONEY BADGER",
  ust: { ad: "KOMODO DRAGON", renk: "9E8B5E", ara: "komodo dragon" },
  alt: { ad: "HONEY BADGER",  renk: "D9D9D9", ara: "honey badger" },
  olculer: [
    { ad: "WEIGHT",     u: 166, uM: "166 kg",  a: 16,  aM: "16 kg",   k: "ust", n: "10x heavier" },
    { ad: "LENGTH",     u: 304, uM: "3.04 m",  a: 100, aM: "1.0 m",   k: "ust", n: "the largest lizard alive" },
    { ad: "BITE FORCE", u: 600, uM: "~600 PSI", a: 400, aM: "~400 PSI", k: "ust", n: "serrated teeth built to tear" },
    { ad: "VENOM",      u: 4,   uM: "YES",     a: 0,   aM: "NONE",    k: "ust", n: "anticoagulant glands in the lower jaw" },
    { ad: "SKIN",       u: 3,   uM: "OSTEODERMS", a: 4, aM: "LOOSE HIDE", k: "alt", n: "the badger can turn inside its own skin" },
    { ad: "VENOM RESISTANCE", u: 1, uM: "LOW", a: 4, aM: "HIGH",      k: "alt", n: "it survives cobra bites" },
    { ad: "AGGRESSION", u: 2,   uM: "AMBUSH",  a: 4,   aM: "RELENTLESS", k: "alt", n: "it attacks lions" },
  ], kazanan: "ust",
  sonuc: "Courage is not a weight class.", sonuc2: "10x the mass ends this quickly." },

{ id: "108-jaguar-vs-anakonda", baslik: "JAGUAR vs GREEN ANACONDA",
  ust: { ad: "JAGUAR", renk: "E9A93A", ara: "jaguar animal" },
  alt: { ad: "GREEN ANACONDA", renk: "6FAF54", ara: "anaconda snake" },
  olculer: [
    { ad: "WEIGHT",     u: 158, uM: "158 kg",  a: 227, aM: "227 kg",  k: "alt", n: "the anaconda is the heavier animal" },
    { ad: "LENGTH",     u: 185, uM: "1.85 m",  a: 670, aM: "6.7 m",   k: "alt", n: "body only, tail excluded" },
    { ad: "BITE FORCE", u: 1500, uM: "1500 PSI", a: 90, aM: "~90 PSI", k: "ust", n: "the strongest bite of any big cat for its size" },
    { ad: "KILL METHOD",u: 4,   uM: "SKULL BITE", a: 3, aM: "CONSTRICTION", k: "ust", n: "it bites straight through the braincase" },
    { ad: "SPEED ON LAND", u: 80, uM: "80 km/h", a: 8, aM: "8 km/h",  k: "ust", n: "a 10x difference" },
    { ad: "IN WATER",   u: 2,   uM: "STRONG",   a: 4,  aM: "DOMINANT", k: "alt", n: "the anaconda is built for it" },
    { ad: "OBSERVED OUTCOME", u: 4, uM: "PREDATOR", a: 1, aM: "PREY", k: "ust", n: "jaguars are filmed killing anacondas" },
  ], kazanan: "ust",
  sonuc: "On land, the jaguar. Every time.", sonuc2: "Drag it into deep water and it reverses." },

{ id: "109-kutup-ayisi-vs-kaplan", baslik: "POLAR BEAR vs SIBERIAN TIGER",
  ust: { ad: "POLAR BEAR", renk: "DCE9F5", ara: "polar bear" },
  alt: { ad: "SIBERIAN TIGER", renk: "FF8A2B", ara: "siberian tiger snow" },
  olculer: [
    { ad: "WEIGHT",     u: 800, uM: "800 kg",  a: 300, aM: "300 kg",  k: "ust", n: "nearly 3x heavier" },
    { ad: "STANDING HEIGHT", u: 300, uM: "3.0 m", a: 200, aM: "2.0 m", k: "ust", n: "a metre of extra reach" },
    { ad: "BITE FORCE", u: 1200, uM: "1200 PSI", a: 1050, aM: "1050 PSI", k: "ust", n: "close, but the bear edges it" },
    { ad: "TOP SPEED",  u: 40,  uM: "40 km/h", a: 65,  aM: "65 km/h", k: "alt", n: "the tiger is far quicker" },
    { ad: "CLAWS",      u: 5,   uM: "5 cm",    a: 10,  aM: "10 cm",   k: "alt", n: "the tiger's are longer and retractable" },
    { ad: "FAT LAYER",  u: 11,  uM: "11 cm",   a: 2,   aM: "2 cm",    k: "ust", n: "blubber absorbs an enormous amount of damage" },
    { ad: "AMBUSH SKILL", u: 2, uM: "LOW",     a: 4,   aM: "ELITE",   k: "alt", n: "the tiger's only real path to a win" },
  ], kazanan: "ust",
  sonuc: "The tiger has to win in one strike.", sonuc2: "Through 11 cm of blubber, it will not." },

{ id: "110-sirtlan-vs-kurt", baslik: "SPOTTED HYENA vs GRAY WOLF",
  ust: { ad: "SPOTTED HYENA", renk: "C9A96B", ara: "spotted hyena" },
  alt: { ad: "GRAY WOLF",     renk: "A8B4BF", ara: "gray wolf" },
  olculer: [
    { ad: "WEIGHT",     u: 90,  uM: "90 kg",   a: 80,  aM: "80 kg",   k: "ust", n: "females are the largest hyenas" },
    { ad: "BITE FORCE", u: 1100, uM: "1100 PSI", a: 400, aM: "400 PSI", k: "ust", n: "it cracks giraffe bone" },
    { ad: "TOP SPEED",  u: 60,  uM: "60 km/h", a: 60,  aM: "60 km/h", k: "ust", n: "identical, but the hyena holds it longer" },
    { ad: "STAMINA",    u: 4,   uM: "5 km CHASE", a: 4, aM: "10 km CHASE", k: "alt", n: "the wolf is the better distance runner" },
    { ad: "NECK + SHOULDER", u: 4, uM: "MASSIVE", a: 2, aM: "MODERATE", k: "ust", n: "the hyena's front end is built like a wedge" },
    { ad: "PACK SIZE",  u: 80,  uM: "UP TO 80", a: 20, aM: "UP TO 20", k: "ust", n: "clans outnumber packs four to one" },
    { ad: "ONE ON ONE", u: 4,   uM: "FAVOURED", a: 2,  aM: "OUTMATCHED", k: "ust", n: "bone-crushing jaws against a slicing bite" },
  ], kazanan: "ust",
  sonuc: "The wolf runs further.", sonuc2: "The hyena bites through bone." },
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
