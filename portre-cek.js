// Wikimedia Commons portre/tarihsel gorsel cekici — BEDAVA, anahtar gerekmez.
// Sadece serbest lisansli (PD / CC) gorselleri indirir.
// Kullanim: node portre-cek.js <is-klasoru>
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const JOB = process.argv[2] || "003-long-ai-scientists";
const BASE = path.join(__dirname, "uretim", JOB);
const OUT = path.join(BASE, "Visuals");

const UA = "video-otomasyon/1.0 (educational video project)";
const bekle = ms => new Promise(r => setTimeout(r, ms));

function get(url, raw) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": UA, "Accept": raw ? "*/*" : "application/json" } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume(); return get(r.headers.location, raw).then(res, rej);
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error("HTTP " + r.statusCode)); }
      const c = [];
      r.on("data", x => c.push(x));
      r.on("end", () => res(Buffer.concat(c)));
    }).on("error", rej);
  });
}

// Serbest lisans mi?
function serbest(meta) {
  const l = ((meta && meta.LicenseShortName && meta.LicenseShortName.value) || "").toLowerCase();
  if (!l) return true;                       // lisans bilgisi yoksa Commons'ta zaten serbest
  return /public domain|pd|cc0|cc by|cc-by|attribution|share alike/.test(l);
}

async function ara(q, limit) {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
    "&gsrsearch=" + encodeURIComponent(q) +
    "&gsrnamespace=6&gsrlimit=" + (limit * 4) +
    "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1800&format=json&origin=*";
  let j = null;
  for (let a = 0; a < 4 && !j; a++) {
    const txt = (await get(url)).toString("utf8");
    if (txt.trim().startsWith("{")) { j = JSON.parse(txt); break; }
    await bekle(4000 * (a + 1));          // hiz siniri -> artan bekleme
  }
  if (!j) throw new Error("API hiz siniri");
  const pages = (j.query && j.query.pages) || {};
  return Object.values(pages)
    .map(p => {
      const ii = p.imageinfo && p.imageinfo[0];
      if (!ii) return null;
      return { title: p.title.replace(/^File:/, ""), url: ii.thumburl || ii.url, meta: ii.extmetadata };
    })
    .filter(Boolean)
    .filter(x => /\.(jpg|jpeg|png)$/i.test(x.title))
    .filter(x => !/logo|icon|map|diagram|chart|signature|stamp|coin|plaque|grave|building/i.test(x.title))
    .filter(x => serbest(x.meta));
}

(async () => {
  const konuPath = path.join(BASE, "konu.json");
  if (!fs.existsSync(konuPath)) throw new Error("konu.json yok: " + konuPath);
  const konu = JSON.parse(fs.readFileSync(konuPath, "utf8"));
  const liste = konu.portreler || [];
  if (!liste.length) { console.log("konu.json icinde 'portreler' yok, atlaniyor."); return; }

  let total = 0;
  for (const sc of liste) {
    const dir = path.join(OUT, sc.n);
    fs.mkdirSync(dir, { recursive: true });
    const per = sc.adet || 3;
    let saved = 0;
    const seen = new Set();

    for (const q of sc.q) {
      if (saved >= per) break;
      let items = [];
      await bekle(1800);                    // aramalar arasi nefes
      try { items = await ara(q, per); } catch (e) { console.log(`  ! arama hatasi (${q}): ${e.message}`); continue; }

      for (const it of items) {
        if (saved >= per) break;
        if (seen.has(it.url)) continue;
        seen.add(it.url);
        let buf = null;
        await bekle(400);
        try { buf = await get(it.url, true); } catch (e) { continue; }
        if (!buf || buf.length < 40000) continue;
        saved++;
        const safe = it.title.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-").slice(0, 45) || "img";
        fs.writeFileSync(path.join(dir, String(saved).padStart(2, "0") + "-" + safe + ".jpg"), buf);
        process.stdout.write(".");
      }
    }
    total += saved;
    console.log(` ${sc.n} -> ${saved}`);
  }
  console.log(`\nTOPLAM ${total} portre/tarihsel gorsel -> ${OUT}`);
})();
