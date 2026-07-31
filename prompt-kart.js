// Prompt / komut / skill kartlari — koyu terminal estetiginde, videoya gomulecek gorseller.
// Tamamen yerel, bedava. Kullanim: node prompt-kart.js <is-klasoru>
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const JOB = process.argv[2] || "007-claude-quantum";
const FF = process.env.LOCALAPPDATA + "\\Microsoft\\WinGet\\Links\\ffmpeg.exe";
const BASE = path.join(__dirname, "uretim", JOB);
const VIS = path.join(BASE, "Visuals");

const MONO = "C\\:/Windows/Fonts/consola.ttf";
const MONOB = "C\\:/Windows/Fonts/consolab.ttf";
const BD = "C\\:/Windows/Fonts/arialbd.ttf";

const W = 1920, H = 1080;
// ffmpeg drawtext icin kacis
const esc = s => String(s)
  .replace(/\\/g, "\\\\").replace(/'/g, "\u2019")
  .replace(/:/g, "\\:").replace(/%/g, "\\%");

(async () => {
  const konu = JSON.parse(fs.readFileSync(path.join(BASE, "konu.json"), "utf8"));
  const list = konu.promptlar || [];
  if (!list.length) { console.log("konu.json icinde 'promptlar' yok."); return; }

  list.forEach((p, i) => {
    const dir = path.join(VIS, p.hedef || "90-promptlar");
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "95-prompt-" + String(i + 1).padStart(2, "0") + ".jpg");

    const PAD = 130;              // pencere kenar boslugu
    const winY = 180, winH = 760;
    const barH = 62;
    const lh = 46;                // satir yuksekligi
    const startY = winY + barH + 46;

    let f = "";
    // pencere govdesi + baslik cubugu
    f += `drawbox=x=${PAD}:y=${winY}:w=${W-2*PAD}:h=${winH}:color=0x0B1017@0.94:t=fill,`;
    f += `drawbox=x=${PAD}:y=${winY}:w=${W-2*PAD}:h=${barH}:color=0x161D28@1.0:t=fill,`;
    f += `drawbox=x=${PAD}:y=${winY+winH-3}:w=${W-2*PAD}:h=3:color=0x6FD8FF@0.9:t=fill,`;
    // pencere noktalari
    [0,1,2].forEach(k => {
      const cols = ["0xFF5F57","0xFEBC2E","0x28C840"];
      f += `drawbox=x=${PAD+34+k*30}:y=${winY+barH/2-7}:w=14:h=14:color=${cols[k]}@0.9:t=fill,`;
    });
    // baslik
    f += `drawtext=fontfile='${MONOB}':text='${esc(p.baslik)}':fontcolor=0x9FE6FF:fontsize=30:` +
         `x=${PAD+140}:y=${winY+barH/2-16},`;
    // satirlar
    (p.satirlar || []).forEach((ln, k) => {
      const y = startY + k * lh;
      let col = "0xE6EDF3";                 // normal metin
      let font = MONO;
      let t = ln;
      if (/^\$ /.test(ln)) { col = "0x7CE38B"; font = MONOB; }        // komut
      else if (/^#/.test(ln)) { col = "0x6E7B8B"; }                   // yorum
      else if (/^>/.test(ln)) { col = "0xFFD479"; }                   // cikti
      else if (/^\[/.test(ln)) { col = "0x6FD8FF"; font = MONOB; }    // etiket
      f += `drawtext=fontfile='${font}':text='${esc(t)}':fontcolor=${col}:fontsize=32:` +
           `x=${PAD+56}:y=${y},`;
    });
    // alt etiket
    if (p.alt) {
      f += `drawtext=fontfile='${BD}':text='${esc(p.alt)}':fontcolor=0x8A97A6:fontsize=30:` +
           `x=(w-text_w)/2:y=${winY+winH+34},`;
    }
    f = f.replace(/,$/, "");

    execFileSync(FF, ["-y", "-f", "lavfi", "-i", `color=c=0x04060B:s=${W}x${H}`,
      "-vf", `format=rgb24,${f}`, "-frames:v", "1", out],
      { stdio: ["ignore", "ignore", "pipe"] });
    process.stdout.write(".");
  });

  console.log(`\n${list.length} prompt karti uretildi.`);
})();
