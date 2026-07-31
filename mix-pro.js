// PROFESYONEL DJ MIX
// - Camelot cemberine gore armonik siralama (ton uyumu)
// - Tempo esitleme (atempo, perdeyi bozmadan, ±%6 sinirinda)
// - Esit-guc crossfade, BPM farkina gore uyarlanan sure
// - -14 LUFS normalize + limiter
// Kullanim: node mix-pro.js <klasor> [cikti-adi]
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("./ff-yol").ffmpeg;
const FP = require("./ff-yol").ffprobe;
const DIR = path.resolve(process.argv[2] || ".");
const AD = process.argv[3] || "DJ MIX";
const TMP = path.join(DIR, "_mixtmp");
const MAX_STRETCH = 0.03;      // ±%3 — daha guvenli, bozulma duyulmaz

const run = (a) => {
  try { return execFileSync(FF, a, { stdio:["ignore","ignore","pipe"], maxBuffer:1<<26 }); }
  catch (e) {
    const s = (e.stderr||Buffer.alloc(0)).toString();
    console.log("\n!! FFMPEG: " + (s.split("\n").filter(l=>/error|invalid/i.test(l)).slice(0,2).join(" | ") || s.slice(-300)));
    throw e;
  }
};
const dur = f => Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", f]).toString().trim());
const mmss = s => `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}`;

// --- Camelot mesafesi: 0 = ayni ton, 1 = mukemmel gecis, 2+ = zorlama ---
function camMesafe(a, b) {
  if (!a || !b) return 3;
  const dn = Math.min(Math.abs(a.camNo - b.camNo), 12 - Math.abs(a.camNo - b.camNo));
  return a.camHarf === b.camHarf ? dn : dn + 1;
}

// --- iki komsu arasi gecis maliyeti ---
function gecisMaliyet(a, b) {
  const bpmFark = Math.abs(b.bpm - a.bpm);
  const ton = camMesafe(a, b);
  const geri = b.bpm < a.bpm - 0.5 ? 5 : 0;       // tempo geri gitmesin
  // ton mesafesi 3+ ise agir ceza: DJ kulagina yanlis gelir
  const tonCeza = ton <= 1 ? ton * 2 : ton <= 2 ? 7 : 25 + ton * 5;
  return bpmFark * 1.2 + tonCeza + geri;
}
function toplamMaliyet(s) {
  let m = 0;
  for (let i = 0; i < s.length - 1; i++) m += gecisMaliyet(s[i], s[i+1]);
  return m;
}

// --- acgozlu + 2-opt iyilestirme ---
function sirala(list) {
  let enIyi = null, enIyiM = Infinity;

  // her parcayi baslangic yapip dene
  for (let bas = 0; bas < list.length; bas++) {
    const kalan = list.filter((_, i) => i !== bas);
    const s = [list[bas]];
    while (kalan.length) {
      const son = s[s.length - 1];
      let k = 0, km = Infinity;
      kalan.forEach((c, i) => { const m = gecisMaliyet(son, c); if (m < km) { km = m; k = i; } });
      s.push(kalan.splice(k, 1)[0]);
    }
    // baslangic tempo dusuk olsun (enerji yukselsin) -> hafif odul
    const m = toplamMaliyet(s) + s[0].bpm * 0.25;
    if (m < enIyiM) { enIyiM = m; enIyi = s; }
  }

  // 2-opt: iki noktayi ters cevirip iyilesme var mi bak
  let s = enIyi, iyilesti = true, tur = 0;
  while (iyilesti && tur < 60) {
    iyilesti = false; tur++;
    for (let i = 1; i < s.length - 2; i++) {
      for (let j = i + 1; j < s.length - 1; j++) {
        const yeni = s.slice(0, i).concat(s.slice(i, j+1).reverse(), s.slice(j+1));
        if (toplamMaliyet(yeni) + yeni[0].bpm * 0.25 < toplamMaliyet(s) + s[0].bpm * 0.25 - 0.01) {
          s = yeni; iyilesti = true;
        }
      }
    }
  }
  return s;
}

// --- tempo esitleme: komsulari birbirine yaklastir, ±%6 sinirinda ---
function tempoHesapla(sira) {
  const hedef = sira.map(x => x.bpm);
  // 3 gecis: her parcayi komsularinin ortalamasina dogru cek
  for (let tur = 0; tur < 3; tur++) {
    for (let i = 0; i < hedef.length; i++) {
      const onc = i > 0 ? hedef[i-1] : hedef[i];
      const son = i < hedef.length-1 ? hedef[i+1] : hedef[i];
      const ort = (onc + son) / 2;
      hedef[i] = hedef[i] * 0.65 + ort * 0.35;
    }
  }
  return sira.map((x, i) => {
    let oran = hedef[i] / x.bpm;
    oran = Math.max(1 - MAX_STRETCH, Math.min(1 + MAX_STRETCH, oran));
    return Math.round(oran * 10000) / 10000;
  });
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const analiz = JSON.parse(fs.readFileSync(path.join(DIR, "_analiz.json"), "utf8"));
  const sira = sirala(analiz);
  const oranlar = tempoHesapla(sira);

  console.log(`\n${sira.length} parca — armonik siralama:\n`);
  sira.forEach((x, i) => {
    const yeni = Math.round(x.bpm * oranlar[i] * 10) / 10;
    const fark = oranlar[i] === 1 ? "" : `  ->${yeni} BPM (${oranlar[i] > 1 ? "+" : ""}${Math.round((oranlar[i]-1)*1000)/10}%)`;
    const gecis = i > 0 ? `  [ton mesafesi ${camMesafe(sira[i-1], x)}]` : "";
    console.log(`  ${String(i+1).padStart(2)}. ${String(x.bpm).padStart(5)} BPM  ${x.camelot.padStart(3)}  ${x.f}${fark}${gecis}`);
  });

  // ---------- normalize + tempo ----------
  console.log("\n1/3 Normalize + tempo esitleme...");
  const hazir = [];
  for (let i = 0; i < sira.length; i++) {
    const src = path.join(DIR, sira[i].f);
    const out = path.join(TMP, String(i).padStart(2,"0") + ".wav");
    if (!fs.existsSync(out)) {
      const af = [`loudnorm=I=-14:TP=-1.0:LRA=11`];
      if (oranlar[i] !== 1) af.push(`atempo=${oranlar[i]}`);
      run(["-y","-i",src,"-af",af.join(","),"-ar","48000","-ac","2","-c:a","pcm_s16le",out]);
    }
    hazir.push({ ...sira[i], yol: out, d: dur(out), oran: oranlar[i],
                 yeniBpm: Math.round(sira[i].bpm * oranlar[i] * 10) / 10 });
    process.stdout.write(`\r  ${i+1}/${sira.length}   `);
  }
  console.log("");

  // ---------- gecis sureleri ----------
  const gecis = [];
  for (let i = 0; i < hazir.length - 1; i++) {
    const fark = Math.abs(hazir[i].yeniBpm - hazir[i+1].yeniBpm);
    const ton = camMesafe(hazir[i], hazir[i+1]);
    let d = fark <= 1 ? (ton <= 1 ? 14 : 10) : fark <= 3 ? 10 : fark <= 8 ? 6 : 3;
    d = Math.min(d, hazir[i].d * 0.22, hazir[i+1].d * 0.22);
    gecis.push(Math.round(d * 10) / 10);
  }

  // ---------- birlestir ----------
  console.log("2/3 Crossfade zinciri...");
  const inputs = [];
  hazir.forEach(h => inputs.push("-i", h.yol));
  const fc = [];
  let last = "0:a";
  for (let i = 1; i < hazir.length; i++) {
    const out = i === hazir.length - 1 ? "mix" : `x${i}`;
    fc.push(`[${last}][${i}:a]acrossfade=d=${gecis[i-1]}:c1=qsin:c2=qsin[${out}]`);
    last = out;
  }
  if (hazir.length === 1) fc.push(`[0:a]anull[mix]`);
  fc.push(`[mix]alimiter=limit=0.97,aresample=48000[out]`);
  const fcFile = path.join(TMP, "fc.txt");
  fs.writeFileSync(fcFile, fc.join(";\n"), "utf8");

  const mp3 = path.join(DIR, AD + ".mp3");
  console.log("3/3 Render (uzun surebilir)...");
  run(["-y", ...inputs, "-filter_complex_script", fcFile, "-map", "[out]",
       "-c:a","libmp3lame","-b:a","320k", mp3]);

  // ---------- tracklist ----------
  let t = 0;
  const satir = [];
  hazir.forEach((h, i) => {
    satir.push(`${mmss(t).padStart(6)}   ${h.f.replace(/\.(mp3|wav|flac|m4a)$/i,"").padEnd(28)} ${String(h.yeniBpm).padStart(5)} BPM   ${h.camelot.padStart(3)} (${h.ton})`);
    t += h.d - (gecis[i] || 0);
  });
  const toplam = dur(mp3);
  const tl =
`TRACKLIST — ${AD}
${"=".repeat(70)}

${satir.join("\n")}

${"=".repeat(70)}
Toplam sure   : ${mmss(toplam)}
Parca sayisi  : ${hazir.length}
Seviye        : -14 LUFS (YouTube standardi)
Siralama      : Camelot armonik uyum + yukselen tempo
Tempo         : parcalar birbirine ±%6 icinde esitlendi (perde korundu)
`;
  fs.writeFileSync(path.join(DIR, AD + " - TRACKLIST.txt"), tl, "utf8");

  console.log(`\n=== MIX HAZIR ===`);
  console.log(`  ${mp3}`);
  console.log(`  Sure: ${mmss(toplam)}  |  ${hazir.length} parca`);
})();
