// NASA gorsel cekici — BEDAVA, API anahtari gerekmez, public domain (ticari kullanim serbest)
// Kullanim: node gorsel-cek.js <is-klasoru>
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const JOB = process.argv[2] || "001-time-travel";
const OUT = path.join(__dirname, "uretim", JOB, "Visuals");
const PER_SCENE = Number(process.argv[3] || 12);

// Is klasorunde konu.json varsa onun sahnelerini kullan, yoksa varsayilan 8 sahne
const KONU = path.join(__dirname, "uretim", JOB, "konu.json");
let SCENES = null;
if (fs.existsSync(KONU)) {
  try {
    const k = JSON.parse(fs.readFileSync(KONU, "utf8"));
    if (Array.isArray(k.sahneler) && k.sahneler.length) SCENES = k.sahneler;
  } catch (e) { console.log("konu.json okunamadi, varsayilan kullaniliyor:", e.message); }
}

const DEFAULT_SCENES = [
  { n: "01-hook",        q: ["spiral galaxy", "galaxy nebula", "cosmic vortex"] },
  { n: "02-what-is-time",q: ["star field", "milky way", "deep space stars"] },
  { n: "03-forward-real",q: ["international space station", "astronaut spacewalk", "earth from orbit"] },
  { n: "04-arrow-time",  q: ["supernova", "galaxy collision", "stellar explosion"] },
  { n: "05-wormhole",    q: ["black hole", "gravitational lensing", "quasar"] },
  { n: "06-paradox",     q: ["twin galaxies", "star cluster", "interacting galaxies"] },
  { n: "07-ai",          q: ["supercomputer", "simulation visualization", "data visualization"] },
  { n: "08-finale",      q: ["hubble deep field", "andromeda galaxy", "universe galaxies"] },
];
if (!SCENES) SCENES = DEFAULT_SCENES;

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume(); return get(r.headers.location).then(res, rej);
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error("HTTP " + r.statusCode)); }
      const chunks = [];
      r.on("data", c => chunks.push(c));
      r.on("end", () => res(Buffer.concat(chunks)));
    }).on("error", rej);
  });
}

// Sinematik OLMAYAN gorselleri ele: grafik, sema, laboratuvar, tören, logo vs.
const KARA_LISTE = /simulation|diagram|chart|graph|plot|schematic|spectrum|light curve|illustration of|infographic|logo|patch|insignia|award|ceremony|employee|staff|meeting|conference|briefing|facility|cleanroom|laboratory|technician|engineer|workshop|classroom|interview|portrait of|group photo|test stand|assembly|hardware|instrument|antenna|dish|telescope mirror|launch pad|control room/i;

async function search(q) {
  const url = "https://images-api.nasa.gov/search?q=" + encodeURIComponent(q) + "&media_type=image";
  const buf = await get(url);
  const j = JSON.parse(buf.toString("utf8"));
  return (j.collection.items || [])
    .filter(it => it.links && it.links[0] && it.links[0].href)
    .filter(it => {
      const t = (it.data && it.data[0] && it.data[0].title) || "";
      return !KARA_LISTE.test(t);
    })
    .map(it => ({
      title: (it.data && it.data[0] && it.data[0].title) || "untitled",
      thumb: it.links[0].href,
    }));
}

// thumb -> en buyuk cozunurluk
function bigUrls(thumb) {
  const base = thumb.replace(/~[a-z]+\.(jpg|png)$/i, "");
  return [base + "~orig.jpg", base + "~large.jpg", base + "~medium.jpg", thumb];
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  const report = [];

  for (const sc of SCENES) {
    const dir = path.join(OUT, sc.n);
    fs.mkdirSync(dir, { recursive: true });
    const seen = new Set();
    let saved = 0;

    for (const q of sc.q) {
      if (saved >= PER_SCENE) break;
      let items = [];
      try { items = await search(q); } catch (e) { console.log("  ! arama hatasi:", q, e.message); continue; }

      for (const it of items) {
        if (saved >= PER_SCENE) break;
        if (seen.has(it.thumb)) continue;
        seen.add(it.thumb);

        let buf = null;
        for (const u of bigUrls(it.thumb)) {
          try { buf = await get(u); if (buf && buf.length > 60000) break; buf = null; } catch (e) { /* sonrakini dene */ }
        }
        if (!buf) continue;

        saved++;
        const safe = it.title.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "image";
        const file = path.join(dir, String(saved).padStart(2, "0") + "-" + safe + ".jpg");
        fs.writeFileSync(file, buf);
        process.stdout.write(".");
      }
    }
    total += saved;
    report.push(`${sc.n}: ${saved} gorsel`);
    console.log(` ${sc.n} -> ${saved}`);
  }

  console.log("\n=== TAMAM ===");
  report.forEach(r => console.log("  " + r));
  console.log("  TOPLAM: " + total + " gorsel");
  console.log("  Klasor: " + OUT);
})();
