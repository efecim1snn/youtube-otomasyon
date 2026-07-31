// PROFESYONEL MIX KURUCU
// - her parcayi -14 LUFS'a normalize eder (seviye zipla­malari biter)
// - esit-guc (equal power) crossfade ile birlestirir
// - BPM farkina gore gecis suresini ayarlar
// - tracklist'i zaman damgalariyla yazar
// Kullanim: node mix-yap.js <klasor> [cikti-adi]
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = process.env.LOCALAPPDATA + "\\Microsoft\\WinGet\\Links\\ffmpeg.exe";
const FP = process.env.LOCALAPPDATA + "\\Microsoft\\WinGet\\Links\\ffprobe.exe";
const DIR = path.resolve(process.argv[2] || ".");
const AD = process.argv[3] || "MIX";
const TMP = path.join(DIR, "_mixtmp");

const run = (a) => {
  try { return execFileSync(FF, a, { stdio: ["ignore","ignore","pipe"], maxBuffer: 1<<26 }); }
  catch (e) {
    const s = (e.stderr||Buffer.alloc(0)).toString();
    console.log("\n!! FFMPEG:", s.split("\n").filter(l=>/error|invalid|no such/i.test(l)).slice(0,3).join(" | ") || s.slice(-400));
    throw e;
  }
};
const dur = f => Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", f]).toString().trim());
const mmss = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

// ---- sira dosyasi: SIRA.txt varsa onu kullan, yoksa _analiz.json'dan BPM'e gore diz ----
function sirayiAl() {
  const siraTxt = path.join(DIR, "SIRA.txt");
  if (fs.existsSync(siraTxt)) {
    return fs.readFileSync(siraTxt, "utf8").split(/\r?\n/)
      .map(s => s.trim()).filter(s => s && !s.startsWith("#"));
  }
  const an = JSON.parse(fs.readFileSync(path.join(DIR, "_analiz.json"), "utf8"));
  return an.sort((a,b) => a.bpm - b.bpm).map(x => x.f);
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const sira = sirayiAl();
  const bpmMap = {};
  try {
    JSON.parse(fs.readFileSync(path.join(DIR, "_analiz.json"), "utf8")).forEach(x => bpmMap[x.f] = x.bpm);
  } catch (e) {}

  console.log(`\n${sira.length} parca, sirayla:\n`);
  sira.forEach((f, i) => console.log(`  ${String(i+1).padStart(2)}. ${String(bpmMap[f]||"?").padStart(5)} BPM  ${f}`));

  // ---------- 1) NORMALIZE ----------
  console.log("\n1/3 Seviyeler esitleniyor (-14 LUFS)...");
  const norm = [];
  for (let i = 0; i < sira.length; i++) {
    const src = path.join(DIR, sira[i]);
    if (!fs.existsSync(src)) { console.log(`  ! bulunamadi: ${sira[i]}`); continue; }
    const out = path.join(TMP, String(i).padStart(2,"0") + ".wav");
    if (!fs.existsSync(out)) {
      run(["-y","-i",src,"-af","loudnorm=I=-14:TP=-1.0:LRA=11","-ar","48000","-ac","2","-c:a","pcm_s16le",out]);
    }
    norm.push({ f: out, ad: sira[i], bpm: bpmMap[sira[i]] || null, d: dur(out) });
    process.stdout.write(`\r  ${i+1}/${sira.length}   `);
  }
  console.log("");

  // ---------- 2) GECIS SURELERI ----------
  // BPM farki kucukse uzun gecis, buyukse kisa (uyumsuz tempo duyulmasin)
  const gecis = [];
  for (let i = 0; i < norm.length - 1; i++) {
    const a = norm[i].bpm, b = norm[i+1].bpm;
    let d = 8;
    if (a && b) {
      const fark = Math.abs(a - b);
      d = fark <= 1.5 ? 12 : fark <= 5 ? 8 : fark <= 12 ? 4 : 2.5;
    }
    d = Math.min(d, norm[i].d * 0.25, norm[i+1].d * 0.25);
    gecis.push(Math.round(d * 10) / 10);
  }

  // ---------- 3) BIRLESTIR ----------
  console.log("2/3 Crossfade zinciri kuruluyor...");
  const inputs = [];
  norm.forEach(n => inputs.push("-i", n.f));
  const fc = [];
  let last = "0:a";
  for (let i = 1; i < norm.length; i++) {
    const out = i === norm.length - 1 ? "mix" : `x${i}`;
    fc.push(`[${last}][${i}:a]acrossfade=d=${gecis[i-1]}:c1=qsin:c2=qsin[${out}]`);
    last = out;
  }
  if (norm.length === 1) fc.push(`[0:a]anull[mix]`);
  fc.push(`[mix]alimiter=limit=0.97,aresample=48000[out]`);

  const fcFile = path.join(TMP, "fc.txt");
  fs.writeFileSync(fcFile, fc.join(";\n"), "utf8");

  const mp3 = path.join(DIR, AD + ".mp3");
  console.log("3/3 Render...");
  run(["-y", ...inputs, "-filter_complex_script", fcFile, "-map", "[out]",
       "-c:a","libmp3lame","-b:a","320k", mp3]);

  // ---------- TRACKLIST ----------
  let t = 0;
  const satir = [];
  norm.forEach((n, i) => {
    satir.push(`${mmss(t)}  ${n.ad.replace(/\.(mp3|wav|flac|m4a)$/i,"")}${n.bpm ? `  (${n.bpm} BPM)` : ""}`);
    t += n.d - (gecis[i] || 0);
  });
  const toplam = dur(mp3);
  const tl = `TRACKLIST — ${AD}\n${"=".repeat(40)}\n\n` + satir.join("\n") +
             `\n\nToplam sure: ${mmss(toplam)}\nParca sayisi: ${norm.length}\n` +
             `Seviye: -14 LUFS (YouTube standardi)\n`;
  fs.writeFileSync(path.join(DIR, AD + " - TRACKLIST.txt"), tl, "utf8");

  console.log(`\n=== MIX HAZIR ===`);
  console.log(`  ${mp3}`);
  console.log(`  Sure: ${mmss(toplam)}  |  ${norm.length} parca`);
  console.log(`  Tracklist: ${AD} - TRACKLIST.txt`);
})();
