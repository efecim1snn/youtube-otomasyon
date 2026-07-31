// BPM + ses seviyesi analizi — mix siralamasi icin.
// Kullanim: node muzik-analiz.js <klasor>
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("./ff-yol").ffmpeg;
const FP = require("./ff-yol").ffprobe;
const DIR = path.resolve(process.argv[2] || ".");
const SR = 22050, HOP = 512;

function pcm(file) {
  // ortadan 60 saniye al (giris/cikis BPM'i bozar)
  const d = Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", file]).toString().trim());
  const bas = Math.max(0, d / 2 - 30);
  const buf = execFileSync(FF, ["-v","error","-ss",String(bas),"-t","60","-i",file,
    "-ac","1","-ar",String(SR),"-f","s16le","-"], { maxBuffer: 1 << 28 });
  const n = Math.floor(buf.length / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
  return x;
}

// enerji zarfi -> onset gucu
function onsetEnvelope(x) {
  const frames = Math.floor((x.length - HOP) / HOP);
  const en = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * HOP; i < f * HOP + HOP; i++) s += x[i] * x[i];
    en[f] = Math.sqrt(s / HOP);
  }
  const on = new Float32Array(frames);
  for (let f = 1; f < frames; f++) on[f] = Math.max(0, en[f] - en[f - 1]);
  // ortalamayi cikar
  let m = 0; for (const v of on) m += v; m /= frames;
  for (let f = 0; f < frames; f++) on[f] = Math.max(0, on[f] - m);
  return on;
}

function bpmBul(on) {
  const fps = SR / HOP;                 // saniyedeki cerceve
  const min = 70, max = 165;
  const lagMin = Math.floor(fps * 60 / max);
  const lagMax = Math.ceil(fps * 60 / min);
  let best = 0, bestLag = lagMin;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0, n = 0;
    for (let i = 0; i + lag < on.length; i++) { s += on[i] * on[i + lag]; n++; }
    const v = n ? s / n : 0;
    if (v > best) { best = v; bestLag = lag; }
  }
  let bpm = fps * 60 / bestLag;
  // 70-165 araligina katla; dans muzigi icin 110-140'a cek
  while (bpm < 100) bpm *= 2;
  while (bpm > 165) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

function lufs(file) {
  try {
    const out = execFileSync(FF, ["-i", file, "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
      { stdio: ["ignore","ignore","pipe"], maxBuffer: 1 << 26 });
    return null;
  } catch (e) {
    const s = (e.stderr || Buffer.alloc(0)).toString();
    const m = s.match(/I:\s*(-?\d+\.?\d*)\s*LUFS/g);
    if (m && m.length) return Number(m[m.length - 1].match(/(-?\d+\.?\d*)/)[1]);
    return null;
  }
}

const files = fs.readdirSync(DIR).filter(f => /\.(mp3|wav|flac|m4a)$/i.test(f)).sort();
console.log(`${files.length} dosya analiz ediliyor...\n`);
const sonuc = [];
for (const f of files) {
  const p = path.join(DIR, f);
  try {
    const d = Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", p]).toString().trim());
    const bpm = bpmBul(onsetEnvelope(pcm(p)));
    const I = lufs(p);
    sonuc.push({ f, d, bpm, I });
    console.log(`  ${String(bpm).padStart(5)} BPM | ${(I===null?"  ?  ":I.toFixed(1)).padStart(6)} LUFS | ${Math.floor(d/60)}:${String(Math.floor(d%60)).padStart(2,"0")} | ${f}`);
  } catch (e) {
    console.log(`  ! atlandi: ${f} (${e.message.slice(0,40)})`);
  }
}
fs.writeFileSync(path.join(DIR, "_analiz.json"), JSON.stringify(sonuc, null, 2), "utf8");
console.log(`\n_analiz.json yazildi.`);
