// Formul kartlari — kozmik zemin uzerine sinematik denklem gorselleri. Tamamen yerel, bedava.
// Kullanim: node formul-kart.js <is-klasoru>
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const JOB = process.argv[2] || "003-long-ai-scientists";
const FF = require("./ff-yol").ffmpeg;
const BASE = path.join(__dirname, "uretim", JOB);
const VIS = path.join(BASE, "Visuals");

// Unicode matematik icin Windows'ta guvenli font (Arial'de eksik semboller var)
const MATH = "C\\:/Windows/Fonts/seguisym.ttf";
const BD   = "C\\:/Windows/Fonts/arialbd.ttf";
const RG   = "C\\:/Windows/Fonts/arial.ttf";

const esc = s => String(s).replace(/\\/g, "\\\\").replace(/'/g, "").replace(/:/g, "\\:").replace(/%/g, "\\%");

(async () => {
  const konu = JSON.parse(fs.readFileSync(path.join(BASE, "konu.json"), "utf8"));
  const list = konu.formuller || [];
  if (!list.length) { console.log("konu.json icinde 'formuller' yok."); return; }

  // zemin icin mevcut kozmik gorsellerden birini kullan (yoksa duz koyu)
  let bg = null;
  const visRoot = VIS;
  for (const d of (fs.existsSync(visRoot) ? fs.readdirSync(visRoot) : [])) {
    const p = path.join(visRoot, d);
    if (!fs.statSync(p).isDirectory()) continue;
    const f = fs.readdirSync(p).filter(x => /\.jpg$/i.test(x))[0];
    if (f) { bg = path.join(p, f); break; }
  }

  list.forEach((f, i) => {
    // "hedef" verilmisse formulu o sahne klasorune koy (gorsel akisinda dogru yere dussun)
    const dir = path.join(VIS, f.hedef || "14-formuller");
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "90-formul-" + f.n + ".jpg");
    const dt =
      `drawtext=fontfile='${BD}':text='${esc(f.ust)}':fontcolor=0x6FD8FF:fontsize=46:x=(w-text_w)/2:y=330:` +
      `shadowcolor=black:shadowx=3:shadowy=3,` +
      `drawtext=fontfile='${MATH}':text='${esc(f.ana)}':fontcolor=white:fontsize=132:x=(w-text_w)/2:y=440:` +
      `shadowcolor=black:shadowx=5:shadowy=5,` +
      `drawbox=x=(iw-620)/2:y=630:w=620:h=4:color=0x6FD8FF@0.85:t=fill,` +
      `drawtext=fontfile='${RG}':text='${esc(f.alt)}':fontcolor=0xC8D4DE:fontsize=42:x=(w-text_w)/2:y=680`;

    const pre = bg
      ? ["-i", bg, "-vf", `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=brightness=-0.30:contrast=1.05,boxblur=10:1,${dt}`]
      : ["-f", "lavfi", "-i", "color=c=0x04060B:s=1920x1080", "-vf", `${dt}`];

    execFileSync(FF, ["-y", ...pre, "-frames:v", "1", out], { stdio: ["ignore", "ignore", "pipe"] });
    process.stdout.write(".");
  });

  console.log(`\n${list.length} formul karti -> ${OUT}`);
})();
