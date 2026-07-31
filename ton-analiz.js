// TON (KEY) + BPM ANALIZI
// Chroma (Goertzel) + Krumhansl-Schmuckler profil eslestirmesi ile ton tespiti,
// enerji zarfi + otokorelasyon ile BPM. Camelot kodu uretir.
// Kullanim: node ton-analiz.js <klasor>
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("./ff-yol").ffmpeg;
const FP = require("./ff-yol").ffprobe;
const DIR = path.resolve(process.argv[2] || ".");
const SR = 22050, HOP = 512;

const NOTA = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
// Camelot: major ve minor icin perde sinifindan kod
const CAM_MAJ = { 0:8, 1:3, 2:10, 3:5, 4:12, 5:7, 6:2, 7:9, 8:4, 9:11, 10:6, 11:1 };
const CAM_MIN = { 9:8, 10:3, 11:10, 0:5, 1:12, 2:7, 3:2, 4:9, 5:4, 6:11, 7:6, 8:1 };

// Krumhansl-Schmuckler ton profilleri
const P_MAJ = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const P_MIN = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function pcm(file, saniye = 60) {
  const d = Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", file]).toString().trim());
  const bas = Math.max(0, d / 2 - saniye / 2);
  const buf = execFileSync(FF, ["-v","error","-ss",String(bas),"-t",String(saniye),"-i",file,
    "-ac","1","-ar",String(SR),"-f","s16le","-"], { maxBuffer: 1 << 28 });
  const n = Math.floor(buf.length / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
  return { x, d };
}

// --- Goertzel: tek frekansta enerji ---
function goertzel(x, freq, sr) {
  const k = 2 * Math.cos(2 * Math.PI * freq / sr);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < x.length; i++) { s0 = x[i] + k * s1 - s2; s2 = s1; s1 = s0; }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}

// --- kromagram: 12 perde sinifi, 5 oktav ---
function chroma(x) {
  const c = new Float64Array(12);
  // hesap yuku icin ortadan 20 saniye yeter
  const par = x.subarray(0, Math.min(x.length, SR * 20));
  for (let pc = 0; pc < 12; pc++) {
    let s = 0;
    for (let okt = 2; okt <= 6; okt++) {
      const f = 440 * Math.pow(2, (pc - 9) / 12 + (okt - 4));
      if (f > SR / 2.2) continue;
      s += goertzel(par, f, SR);
    }
    c[pc] = s;
  }
  // normalize
  let m = 0; for (const v of c) m += v;
  if (m > 0) for (let i = 0; i < 12; i++) c[i] /= m;
  return c;
}

function korelasyon(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const u = a[i] - ma, v = b[i] - mb;
    num += u * v; da += u * u; db += v * v;
  }
  return (da && db) ? num / Math.sqrt(da * db) : 0;
}

function tonBul(c) {
  let best = { skor: -2 };
  for (let kok = 0; kok < 12; kok++) {
    const dondur = new Array(12);
    for (let i = 0; i < 12; i++) dondur[i] = c[(kok + i) % 12];
    const sM = korelasyon(dondur, P_MAJ);
    const sm = korelasyon(dondur, P_MIN);
    if (sM > best.skor) best = { skor: sM, kok, mod: "maj" };
    if (sm > best.skor) best = { skor: sm, kok, mod: "min" };
  }
  const cam = best.mod === "maj" ? CAM_MAJ[best.kok] : CAM_MIN[best.kok];
  return {
    ton: NOTA[best.kok] + (best.mod === "min" ? "m" : ""),
    camelot: cam + (best.mod === "maj" ? "B" : "A"),
    camNo: cam, camHarf: best.mod === "maj" ? "B" : "A",
    guven: Math.round(best.skor * 100) / 100
  };
}

// --- BPM ---
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
  let m = 0; for (const v of on) m += v; m /= frames;
  for (let f = 0; f < frames; f++) on[f] = Math.max(0, on[f] - m);
  return on;
}
function bpmBul(on) {
  const fps = SR / HOP, min = 70, max = 165;
  const lagMin = Math.floor(fps * 60 / max), lagMax = Math.ceil(fps * 60 / min);
  let best = 0, bestLag = lagMin;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0, n = 0;
    for (let i = 0; i + lag < on.length; i++) { s += on[i] * on[i + lag]; n++; }
    const v = n ? s / n : 0;
    if (v > best) { best = v; bestLag = lag; }
  }
  let bpm = fps * 60 / bestLag;
  while (bpm < 100) bpm *= 2;
  while (bpm > 165) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

const files = fs.readdirSync(DIR)
  .filter(f => /\.(mp3|wav|flac|m4a)$/i.test(f) && !/MIX\.mp3$/i.test(f))
  .sort();

console.log(`${files.length} dosya analiz ediliyor (BPM + ton)...\n`);
const sonuc = [];
for (const f of files) {
  const p = path.join(DIR, f);
  try {
    const { x, d } = pcm(p);
    const bpm = bpmBul(onsetEnvelope(x));
    const t = tonBul(chroma(x));
    sonuc.push({ f, d, bpm, ...t });
    console.log(`  ${String(bpm).padStart(5)} BPM | ${t.camelot.padStart(3)} (${t.ton.padEnd(3)}) | ${Math.floor(d/60)}:${String(Math.round(d%60)).padStart(2,"0")} | ${f}`);
  } catch (e) {
    console.log(`  ! atlandi: ${f}`);
  }
}
fs.writeFileSync(path.join(DIR, "_analiz.json"), JSON.stringify(sonuc, null, 2), "utf8");
console.log(`\n_analiz.json yazildi (${sonuc.length} parca).`);
