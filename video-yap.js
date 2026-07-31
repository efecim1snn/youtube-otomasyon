// VIDEO KURUCU — gorseller + seslendirme + altyazi -> bitmis mp4
// Kademeli: 1) her gorsel -> klip  2) klipler -> gruplar (gecisli)  3) gruplar -> final (+altyazi+ses)
// Tamamen yerel ffmpeg. Kredi harcamaz.
// Kullanim: node video-yap.js <is-klasoru>
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const JOB = process.argv[2] || "001-time-travel";
const FF = process.env.LOCALAPPDATA + "\\Microsoft\\WinGet\\Links\\ffmpeg.exe";
const FP = process.env.LOCALAPPDATA + "\\Microsoft\\WinGet\\Links\\ffprobe.exe";

const BASE = path.join(__dirname, "uretim", JOB);
const VOICE_DIR = path.join(BASE, "Voice");
const PARTS = path.join(VOICE_DIR, "parts");
const VIS = path.join(BASE, "Visuals");
const VID = path.join(BASE, "Videos");
const TMP = path.join(BASE, "_tmp");

// konu.json varsa en-boy oranini oradan al (16:9 varsayilan, 9:16 = Shorts)
// MUSIC_VOL 0.11 cok kisikti (duyulmuyordu) -> 0.30
let ASPECT = "16:9", MUSIC_VOL = 0.25, KONU_BASLIK = "", KANAL = "SINGULARITY HORIZON";
let INTRO_D = null, TOPIC_D = null, OUTRO_D = null, SUNUCU = false, CD_D = null;
let GECIS = "fade", CF_OZEL = null, EFEKT = "zoom", RENK = "sinematik";

// --- renk tonlari ---
const RENKLER = {
  sinematik: "eq=brightness=-0.10:contrast=1.10:saturation=0.82,colorbalance=bs=0.10:bm=0.05:rh=-0.03,vignette=angle=PI/5",
  sicak:     "eq=brightness=-0.04:contrast=1.08:saturation=1.12,colorbalance=rs=0.08:rm=0.05:bh=-0.04,vignette=angle=PI/5",
  soguk:     "eq=brightness=-0.08:contrast=1.12:saturation=0.90,colorbalance=bs=0.14:bm=0.08:rh=-0.05,vignette=angle=PI/5",
  canli:     "eq=brightness=0.02:contrast=1.16:saturation=1.30",
  siyahbeyaz:"hue=s=0,eq=contrast=1.20:brightness=-0.03,vignette=angle=PI/5",
  yok:       "null"
};
const KONU = path.join(BASE, "konu.json");
if (fs.existsSync(KONU)) {
  try {
    const k = JSON.parse(fs.readFileSync(KONU, "utf8"));
    if (k.aspect) ASPECT = k.aspect;
    if (typeof k.muzikSeviyesi === "number") MUSIC_VOL = k.muzikSeviyesi;
    if (k.baslik_en) KONU_BASLIK = k.baslik_en;
    if (k.kanal) KANAL = k.kanal;
    if (typeof k.intro === "number") INTRO_D = k.intro;
    if (typeof k.konuKarti === "number") TOPIC_D = k.konuKarti;
    if (typeof k.outro === "number") OUTRO_D = k.outro;
    if (typeof k.geriSayim === "number") CD_D = k.geriSayim;
    if (k.gecis) GECIS = k.gecis;                 // xfade tipi
    if (typeof k.gecisSure === "number") CF_OZEL = k.gecisSure;
    if (k.efekt) EFEKT = k.efekt;                 // hareket stili
    if (k.renk) RENK = k.renk;                    // renk tonu
    // sunucu figuru KALDIRILDI (Osman: altyaziyi engelliyordu)
  } catch (e) { console.log("konu.json okunamadi:", e.message); }
}
const DIKEY = ASPECT === "9:16";
const W = DIKEY ? 1080 : 1920, H = DIKEY ? 1920 : 1080;
const SW = DIKEY ? 1440 : 2560, SH2 = DIKEY ? 2560 : 1440;   // zoom icin buyuk ara olcek
const FPS = 30, GROUP = 8;
let CF = DIKEY ? 0.4 : 0.8;
// NOT: libass PlayResY=288 varsayar; Fontsize/MarginV bu olcege gore verilir (piksel DEGIL).
// MarginV=75 -> 75/288 * kare yuksekligi kadar alttan bosluk.
const SUB_SIZE = DIKEY ? 13 : 22, SUB_MARGIN = DIKEY ? 75 : 55;

// Intro / konu karti / outro sureleri (Shorts'ta kisa, uzun videoda tam)
if (INTRO_D === null) INTRO_D = DIKEY ? 1.5 : 8;
if (TOPIC_D === null) TOPIC_D = DIKEY ? 0 : 2.5;
if (OUTRO_D === null) OUTRO_D = DIKEY ? 3 : 12;
if (CD_D === null) CD_D = DIKEY ? 0 : 5;
if (CF_OZEL !== null) CF = CF_OZEL;   // film lideri geri sayimi (Shorts'ta yok)
const OFFSET = CD_D + INTRO_D + TOPIC_D;   // seslendirme bu kadar gec baslar
const BD = "C\\:/Windows/Fonts/arialbd.ttf";
const RG = "C\\:/Windows/Fonts/arial.ttf";
const sp = s => s.split("").join(" ");     // harf arasi bosluk

const run = (args, cwd) => execFileSync(FF, args, { cwd, stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 26 });
const dur = f => Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", f]).toString().trim());
const srtTime = ms => {
  const h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000), s=Math.floor(ms%60000/1000), x=Math.floor(ms%1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`;
};

// gecisli birlestirme: N girdi -> tek cikti
function xfadeMerge(files, outFile, extra = []) {
  const inputs = [];
  files.forEach(f => inputs.push("-i", f));
  const ds = files.map(dur);
  const fc = [];
  files.forEach((_, i) => fc.push(`[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p[c${i}]`));
  let last = "c0", acc = ds[0];
  for (let i = 1; i < files.length; i++) {
    const off = acc - CF;
    const out = i === files.length - 1 ? "vm" : `m${i}`;
    fc.push(`[${last}][c${i}]xfade=transition=${GECIS}:duration=${CF}:offset=${off.toFixed(3)}[${out}]`);
    last = out; acc = off + CF + ds[i] - CF + CF;   // acc = off + ds[i]
    acc = off + ds[i];
  }
  if (files.length === 1) fc.push(`[c0]null[vm]`);
  const fcFile = path.join(TMP, "fc_" + path.basename(outFile) + ".txt");
  fs.writeFileSync(fcFile, fc.concat(extra.filter(Boolean)).join(";\n"), "utf8");
  const args = ["-y", ...inputs];
  if (extra.audio) args.push("-i", extra.audio);
  return { args, fcFile };
}

// ---- marka gorseli: ufuk cizgisi + patlayan tekillik (profil/banner ile ayni dil) ----
function markaGeq(cx, cy, sc) {
  const line = `exp(-pow(Y-${cy},2)/${(55*sc*sc).toFixed(0)})*exp(-pow(X-${cx},2)/${(520000*sc*sc).toFixed(0)})`;
  const core = `exp(-pow(hypot(X-${cx},Y-${cy}),2)/${(2600*sc*sc).toFixed(0)})`;
  const halo = `exp(-pow(hypot(X-${cx},Y-${cy}),2)/${(150000*sc*sc).toFixed(0)})`;
  return `geq=r='clip(255*(0.50*${line}+0.80*${core}+0.08*${halo}),0,255)':`+
         `g='clip(255*(0.84*${line}+0.92*${core}+0.18*${halo}),0,255)':`+
         `b='clip(255*(1.0*${line}+1.0*${core}+0.28*${halo}),0,255)'`;
}

// Metni satirlara bol (uzun basliklar icin)
function wrap(text, max) {
  const w = text.split(/\s+/); const out = []; let cur = "";
  for (const x of w) { if ((cur + " " + x).trim().length > max) { out.push(cur.trim()); cur = x; } else cur += " " + x; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

(async () => {
  fs.mkdirSync(VID, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  // ---------- 1) SES ----------
  const partFiles = fs.readdirSync(PARTS).filter(f => /^\d+\.mp3$/.test(f)).sort();
  if (!partFiles.length) throw new Error("Ses parcasi yok. Once: node seslendir.js " + JOB);
  const durations = partFiles.map(f => dur(path.join(PARTS, f)));
  const GAP = 0.35;

  const silence = path.join(PARTS, "_gap.mp3");
  run(["-y","-f","lavfi","-i","anullsrc=r=24000:cl=mono","-t",String(GAP),"-q:a","9",silence]);
  const lines = [];
  partFiles.forEach((f, i) => {
    lines.push("file '" + path.join(PARTS, f).replace(/\\/g,"/") + "'");
    if (i < partFiles.length - 1) lines.push("file '" + silence.replace(/\\/g,"/") + "'");
  });
  const listPath = path.join(PARTS, "concat.txt");
  fs.writeFileSync(listPath, lines.join("\n"), "utf8");
  const voiceOut = path.join(VOICE_DIR, "seslendirme.mp3");
  run(["-y","-f","concat","-safe","0","-i",listPath,"-c:a","libmp3lame","-q:a","2",voiceOut]);
  const TOTAL = dur(voiceOut);
  console.log(`SES: ${partFiles.length} parca -> ${(TOTAL/60).toFixed(2)} dakika`);

  // ---------- 2) ALTYAZI ----------
  // Altyazi metni: ALTYAZI-TR.txt varsa onu kullan (seslendirme Ingilizce, altyazi Turkce).
  // Paragraf sayisi seslendirme metniyle AYNI olmali; her paragraf kendi ses suresine yayilir.
  const enPath = path.join(VOICE_DIR, "SESLENDIRME-TAM-METIN.txt");
  const trPath = path.join(VOICE_DIR, "ALTYAZI-TR.txt");
  const altPath = fs.existsSync(trPath) ? trPath : enPath;
  const txt = fs.readFileSync(altPath, "utf8").replace(/\r\n/g,"\n");
  const paras = txt.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  if (altPath === trPath) {
    const enN = fs.readFileSync(enPath,"utf8").replace(/\r\n/g,"\n").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean).length;
    console.log(`ALTYAZI KAYNAGI: ALTYAZI-TR.txt (${paras.length} paragraf / seslendirme ${enN} paragraf)`);
    if (paras.length !== enN) console.log("  !!! UYARI: paragraf sayilari farkli, altyazi kayabilir.");
  }
  const subs = []; let clock = 0;
  for (let i = 0; i < partFiles.length; i++) {
    const d = durations[i], p = paras[i] || "";
    const words = p.split(/\s+/).filter(Boolean);
    const chunks = []; let cur = [];
    for (const w of words) { cur.push(w); if (cur.join(" ").length >= 42 || /[.!?]$/.test(w)) { chunks.push(cur.join(" ")); cur = []; } }
    if (cur.length) chunks.push(cur.join(" "));
    const tot = chunks.reduce((a,c)=>a+c.length,0) || 1;
    let t = clock;
    for (const c of chunks) { const cd = d*(c.length/tot); subs.push({s:(t+OFFSET)*1000,e:(t+cd+OFFSET)*1000,t:c}); t += cd; }
    clock += d + (i < partFiles.length-1 ? GAP : 0);
  }
  fs.writeFileSync(path.join(BASE,"altyazi.srt"),
    subs.map((x,i)=>`${i+1}\n${srtTime(x.s)} --> ${srtTime(x.e)}\n${x.t}\n`).join("\n"), "utf8");
  console.log(`ALTYAZI: ${subs.length} satir`);

  // ---------- 3) GORSEL LISTESI ----------
  let imgs = [];
  for (const d of fs.readdirSync(VIS).filter(x=>fs.statSync(path.join(VIS,x)).isDirectory()).sort())
    for (const f of fs.readdirSync(path.join(VIS,d)).filter(x=>/\.(jpg|png)$/i.test(x)).sort())
      imgs.push(path.join(VIS,d,f));
  if (!imgs.length) throw new Error("Gorsel yok.");
  // Gorsel basina sure cok uzun kaliyorsa listeyi tekrarla (izleyici sabit kareden sikilir).
  // Tekrar eden gorsel farkli zoom yonuyle gelir, ayni durmaz.
  const MAX_L = DIKEY ? 6 : 11;
  const ozgun = imgs.length;
  while ((TOTAL + (imgs.length-1)*CF) / imgs.length > MAX_L && imgs.length < ozgun * 4) {
    imgs = imgs.concat(imgs.slice(0, ozgun));
  }
  const N = imgs.length;
  const L = (TOTAL + (N-1)*CF) / N;
  const Lf = Math.round(L*FPS);
  console.log(`GORSEL: ${ozgun} ozgun -> ${N} kare, her biri ${L.toFixed(2)} sn (gecis ${CF} sn)`);

  // ---------- 4) KLIPLER (tek tek, dusuk bellek) ----------
  console.log("1/3 Klipler olusturuluyor...");
  const clips = [];
  for (let i = 0; i < N; i++) {
    const out = path.join(TMP, "clip" + String(i).padStart(3,"0") + ".mp4");
    if (!fs.existsSync(out)) {
      const zin = i % 2 === 0;
      // hareket efekti — konu.json "efekt" alanindan
      let z, xIf;
      if (EFEKT === "yok")          { z = "1"; }
      else if (EFEKT === "yavas")   { z = zin ? `min(1+0.00022*on,1.08)` : `if(lte(on,1),1.08,max(1.08-0.00022*on,1.0))`; }
      else if (EFEKT === "hizli")   { z = zin ? `min(1+0.0009*on,1.30)`  : `if(lte(on,1),1.30,max(1.30-0.0009*on,1.0))`; }
      else if (EFEKT === "kaydir")  { z = "1.14"; xIf = zin ? `(iw-iw/zoom)*on/${Lf}` : `(iw-iw/zoom)*(1-on/${Lf})`; }
      else                          { z = zin ? `min(1+0.00045*on,1.16)` : `if(lte(on,1),1.16,max(1.16-0.00045*on,1.0))`; }
      const xIfade = xIf || `iw/2-(iw/zoom/2)`;
      const renk = RENKLER[RENK] || RENKLER.sinematik;
      // TEK kare besle (-loop YOK): zoompan d=Lf ile tam Lf kare uretir
      run(["-y","-i",imgs[i],
        "-vf",`scale=${SW}:${SH2}:force_original_aspect_ratio=increase,crop=${SW}:${SH2},`+
              `${renk},`+
              `zoompan=z='${z}':d=${Lf}:x='${xIfade}':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p`,
        "-frames:v",String(Lf),
        "-c:v","libx264","-preset","veryfast","-crf","18","-an",out]);
    }
    clips.push(out);
    process.stdout.write(`\r  klip ${i+1}/${N}   `);
  }
  console.log("");

  // ---------- 5) GRUPLAR (gecisli) ----------
  console.log("2/3 Gruplar birlestiriliyor...");
  const groups = [];
  for (let g = 0; g*GROUP < N; g++) {
    const part = clips.slice(g*GROUP, (g+1)*GROUP);
    const out = path.join(TMP, "grp" + String(g).padStart(2,"0") + ".mp4");
    if (!fs.existsSync(out)) {
      const { args, fcFile } = xfadeMerge(part, out);
      run([...args,"-filter_complex_script",fcFile,"-map","[vm]",
           "-c:v","libx264","-preset","veryfast","-crf","18","-an",out], TMP);
    }
    groups.push(out);
    process.stdout.write(`\r  grup ${g+1}   `);
  }
  console.log("");

  // ---------- 5b) INTRO / KONU KARTI / OUTRO ----------
  console.log("2b/3 Intro-outro uretiliyor...");
  const cx = Math.round(W/2), cyI = Math.round(H*0.42), scI = W/2560;
  const TS = k => Math.round(k * W / 2560);   // 2560 genislige gore olcekli font

  // --- INTRO: marka animasyonu (yavas zoom + fade) ---
  const introPng = path.join(TMP, "intro.png");
  run(["-y","-f","lavfi","-i",`color=c=0x04060B:s=${W}x${H}`,"-vf",
    `format=rgb24,${markaGeq(cx, cyI, scI)},`+
    `drawtext=fontfile='${BD}':text='${sp("SINGULARITY")}':fontcolor=white:fontsize=${TS(120)}:x=(w-text_w)/2:y=${Math.round(H*0.53)},`+
    `drawtext=fontfile='${BD}':text='${sp("HORIZON")}':fontcolor=0x6FD8FF:fontsize=${TS(120)}:x=(w-text_w)/2:y=${Math.round(H*0.62)},`+
    `drawtext=fontfile='${RG}':text='AI  ·  SPACETIME  ·  THE FUTURE':fontcolor=0xAAB8C4:fontsize=${TS(42)}:x=(w-text_w)/2:y=${Math.round(H*0.72)}`,
    "-frames:v","1",introPng]);
  const introMp4 = path.join(TMP, "aa-intro.mp4");
  run(["-y","-i",introPng,"-vf",
    `scale=${Math.round(W*1.2/2)*2}:${Math.round(H*1.2/2)*2},zoompan=z='min(1+0.00035*on,1.10)':d=${Math.round(INTRO_D*FPS)}:`+
    `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,`+
    `fade=t=in:st=0:d=1,fade=t=out:st=${(INTRO_D-1).toFixed(2)}:d=1,format=yuv420p`,
    "-frames:v",String(Math.round(INTRO_D*FPS)),"-c:v","libx264","-preset","veryfast","-crf","18","-an",introMp4]);

  // --- KONU KARTI: bu video ne anlatiyor ---
  const cards = [];
  if (TOPIC_D > 0 && KONU_BASLIK) {
    const lines = wrap(KONU_BASLIK.replace(/—/g, "-"), 26);
    const topicPng = path.join(TMP, "topic.png");
    let dt = "";
    lines.forEach((ln, i) => {
      const y = Math.round(H*0.42) + i*TS(120);
      dt += `,drawtext=fontfile='${BD}':text='${ln.replace(/'/g,"")}':fontcolor=white:fontsize=${TS(96)}:x=(w-text_w)/2:y=${y}:shadowcolor=black:shadowx=4:shadowy=4`;
    });
    run(["-y","-i",imgs[0],"-vf",
      `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},`+
      `eq=brightness=-0.22:contrast=1.05,boxblur=6:1`+dt,
      "-frames:v","1",topicPng]);
    const topicMp4 = path.join(TMP, "ab-topic.mp4");
    run(["-y","-i",topicPng,"-vf",
      `scale=${Math.round(W*1.15/2)*2}:${Math.round(H*1.15/2)*2},zoompan=z='min(1+0.0006*on,1.08)':d=${Math.round(TOPIC_D*FPS)}:`+
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,`+
      `fade=t=in:st=0:d=0.5,fade=t=out:st=${(TOPIC_D-0.6).toFixed(2)}:d=0.6,format=yuv420p`,
      "-frames:v",String(Math.round(TOPIC_D*FPS)),"-c:v","libx264","-preset","veryfast","-crf","18","-an",topicMp4]);
    cards.push(topicMp4);
  }

  // --- OUTRO: abone ol + bildirim ---
  const outroPng = path.join(TMP, "outro.png");
  run(["-y","-f","lavfi","-i",`color=c=0x04060B:s=${W}x${H}`,"-vf",
    `format=rgb24,${markaGeq(cx, Math.round(H*0.30), scI)},`+
    `drawtext=fontfile='${BD}':text='SUBSCRIBE':fontcolor=white:fontsize=${TS(170)}:x=(w-text_w)/2:y=${Math.round(H*0.40)}:shadowcolor=black:shadowx=5:shadowy=5,`+
    `drawbox=x=(iw-${TS(760)})/2:y=${Math.round(H*0.40)+TS(200)}:w=${TS(760)}:h=${TS(9)}:color=0x6FD8FF@0.95:t=fill,`+
    `drawtext=fontfile='${BD}':text='${sp("TURN ON NOTIFICATIONS")}':fontcolor=0x6FD8FF:fontsize=${TS(52)}:x=(w-text_w)/2:y=${Math.round(H*0.40)+TS(270)},`+
    `drawtext=fontfile='${RG}':text='New documentaries every week':fontcolor=0xAAB8C4:fontsize=${TS(46)}:x=(w-text_w)/2:y=${Math.round(H*0.40)+TS(370)},`+
    `drawtext=fontfile='${BD}':text='${sp(KANAL)}':fontcolor=white:fontsize=${TS(44)}:x=(w-text_w)/2:y=${Math.round(H*0.83)}`,
    "-frames:v","1",outroPng]);
  const outroMp4 = path.join(TMP, "zz-outro.mp4");
  run(["-y","-i",outroPng,"-vf",
    `scale=${Math.round(W*1.15/2)*2}:${Math.round(H*1.15/2)*2},zoompan=z='max(1.08-0.0003*on,1.0)':d=${Math.round(OUTRO_D*FPS)}:`+
    `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,`+
    `fade=t=in:st=0:d=0.8,fade=t=out:st=${(OUTRO_D-1.2).toFixed(2)}:d=1.2,format=yuv420p`,
    "-frames:v",String(Math.round(OUTRO_D*FPS)),"-c:v","libx264","-preset","veryfast","-crf","18","-an",outroMp4]);

  // --- FILM LIDERI GERI SAYIMI (5-4-3-2-1, sesli "dit") ---
  let cdMp4 = null, cdWav = null;
  if (CD_D > 0) {
    cdMp4 = path.join(TMP, "aa0-geri-sayim.mp4");
    if (!fs.existsSync(cdMp4)) {
      execFileSync(process.execPath, [path.join(__dirname, "geri-sayim.js"), cdMp4, String(W), String(H)],
        { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 26 });
    }
    cdWav = path.join(TMP, "geri-sayim.wav");
    run(["-y", "-i", cdMp4, "-vn", "-ar", "48000", "-ac", "2", cdWav]);
    console.log(`GERI SAYIM: ${CD_D} sn film lideri eklendi`);
  }

  groups.unshift(...(cdMp4 ? [cdMp4] : []), introMp4, ...cards);
  groups.push(outroMp4);
  console.log(`  intro ${INTRO_D}sn + konu ${TOPIC_D}sn + outro ${OUTRO_D}sn eklendi`);

  // ---------- 5c) SESI KAYDIR (intro kadar geciktir) ----------
  const voicePadded = path.join(TMP, "voice-padded.mp3");
  run(["-y","-i",voiceOut,"-af",`adelay=${Math.round(OFFSET*1000)}|${Math.round(OFFSET*1000)},apad=pad_dur=${OUTRO_D + 1}`,
       "-c:a","libmp3lame","-q:a","2",voicePadded]);
  const FULL = OFFSET + TOTAL + OUTRO_D;
  if (DIKEY && FULL > 45) {
    console.log(`\n  !!! UYARI: Shorts ${FULL.toFixed(1)} sn — 45 sn SINIRINI ASIYOR.`);
    console.log(`  !!! Seslendirme metnini kisalt (hedef govde: ${(45 - OFFSET - OUTRO_D).toFixed(0)} sn).\n`);
  }

  // ---------- 6) FINAL (+altyazi +ses) ----------
  console.log("3/3 Final render...");
  const outFile = path.join(VID, JOB + ".mp4");
  // ---------- ANLATICI FIGURU (sese tepki veren agiz) ----------
  // Kredi harcamaz: stilize silüet + seslendirmeden beslenen dalga formu.
  let sunucuPng = null;
  if (SUNUCU) {
    sunucuPng = path.join(TMP, "sunucu.png");
    const PW = Math.round(W * (DIKEY ? 0.26 : 0.13));      // figur genisligi
    const PH = Math.round(PW * 1.30);
    const hx = (PW/2).toFixed(0), hy = (PH*0.30).toFixed(0), hr = (PW*0.27).toFixed(0);
    const sy = (PH*0.99).toFixed(0), sr = (PH*0.42).toFixed(0);
    const kx = (1.55).toFixed(2);                           // omuz genislik orani
    // d<0 -> figurun ici (dolu koyu), d~0 -> parlak camgobegi kenar isigi
    const d = `min(hypot(X-${hx},Y-${hy})-${hr},hypot((X-${hx})/${kx},Y-${sy})-${sr})`;
    const fill = `lt(${d},0)`;
    const rim  = `exp(-pow(${d},2)/55)`;
    run(["-y","-f","lavfi","-i",`color=c=black@0:s=${PW}x${PH}:r=1`,"-vf",
      `format=rgba,geq=`+
      `r='clip(14*${fill}+255*0.44*${rim},0,255)':`+
      `g='clip(20*${fill}+255*0.85*${rim},0,255)':`+
      `b='clip(34*${fill}+255*1.0*${rim},0,255)':`+
      `a='clip(225*${fill}+255*${rim},0,255)'`,
      "-frames:v","1",sunucuPng]);
    console.log("SUNUCU: anlatici figuru hazir (sese tepkili agiz)");
  }

  const sub = `[vm]subtitles=altyazi.srt:force_style='FontName=Arial,Fontsize=${SUB_SIZE},Bold=1,`+
              `PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=${SUB_MARGIN}'[vsub]`;

  // ---------- AMBIENT MUZIK (sentetik, telifsiz, bedava) ----------
  const musicFile = path.join(TMP, "muzik.mp3");
  const MD = (FULL + 2).toFixed(2);
  const fo = Math.max(0, FULL - 5).toFixed(2);
  // GERILIM YATAGI: alt dron + yavas nabiz + soguk parilti
  run(["-y",
    "-f","lavfi","-i",`sine=frequency=55:duration=${MD}`,      // sub dron
    "-f","lavfi","-i",`sine=frequency=82.41:duration=${MD}`,   // besli
    "-f","lavfi","-i",`sine=frequency=110:duration=${MD}`,     // oktav
    "-f","lavfi","-i",`sine=frequency=329.63:duration=${MD}`,  // parilti
    "-f","lavfi","-i",`anoisesrc=d=${MD}:c=brown:a=0.05`,      // doku
    "-filter_complex",
      `[0]volume=0.55,tremolo=f=0.8:d=0.30[a];`+      // yavas nabiz = gerilim
      `[1]volume=0.32,tremolo=f=0.13:d=0.45[b];`+
      `[2]volume=0.18,tremolo=f=0.11:d=0.5[c];`+
      `[3]volume=0.07,tremolo=f=0.17:d=0.6[d];`+
      `[4]lowpass=f=300,volume=0.40[e];`+
      // normalize=0 SART: yoksa amix girdi sayisina boluyor ve muzik yok oluyor.
      // loudnorm ile sabit, duyulur bir yatak seviyesi.
      `[a][b][c][d][e]amix=inputs=5:duration=longest:normalize=0,lowpass=f=1400,`+
      `loudnorm=I=-20:TP=-3:LRA=7,`+
      `afade=t=in:st=${CD_D.toFixed(2)}:d=3,afade=t=out:st=${fo}:d=5`,
    "-c:a","libmp3lame","-q:a","3", musicFile]);
  console.log(`MUZIK: gerilim yatagi uretildi (seviye ${MUSIC_VOL})`);
  const inputs = [];
  groups.forEach(f => inputs.push("-i", f));
  const ds = groups.map(dur);
  const fc = [];
  groups.forEach((_,i)=>fc.push(`[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p[c${i}]`));
  let last="c0", acc=ds[0];
  for (let i=1;i<groups.length;i++){
    const off = acc - CF;
    const o = i===groups.length-1 ? "vm" : `m${i}`;
    fc.push(`[${last}][c${i}]xfade=transition=${GECIS}:duration=${CF}:offset=${off.toFixed(3)}[${o}]`);
    last=o; acc = off + ds[i];
  }
  if (groups.length===1) fc.push(`[c0]null[vm]`);
  fc.push(sub);
  // ses miksi: seslendirme + kisik ambient muzik
  const vi = groups.length, mi = groups.length + 1;
  fc.push(`[${mi}:a]volume=${MUSIC_VOL}[mus]`);

  let sesKaynak = `${vi}:a`;
  if (SUNUCU && sunucuPng) {
    // sesi ikiye bol: biri miks icin, biri agiz dalgasi icin
    fc.push(`[${vi}:a]asplit=2[avoice][amouth]`);
    sesKaynak = "avoice";
    const PW = Math.round(W * (DIKEY ? 0.26 : 0.13));
    const PH = Math.round(PW * 1.30);
    const MW = Math.round(PW * 0.52), MH = Math.round(PH * 0.14);
    const PX = Math.round(W * 0.02);
    const PY = H - PH;                                   // tam alta otursun
    const MX = PX + Math.round(PW/2 - MW/2);
    const MY = PY + Math.round(PH * 0.30 + PW * 0.11);   // agiz hizasi
    fc.push(`[amouth]showwaves=s=${MW}x${MH}:mode=cline:colors=0xBFF0FF:rate=${FPS}:scale=sqrt,`+
            `format=rgba,colorchannelmixer=aa=1.0[wave]`);
    fc.push(`movie='${sunucuPng.replace(/\\/g,"/").replace(/:/g,"\\:")}',format=rgba[fig]`);
    fc.push(`[vsub][fig]overlay=x=${PX}:y=${PY}:eof_action=repeat[vfig]`);
    fc.push(`[vfig][wave]overlay=x=${MX}:y=${MY}:eof_action=pass[vout]`);
  } else {
    fc.push(`[vsub]null[vout]`);
  }
  if (cdWav) {
    // geri sayim sesi (bip + riser) ilk CD_D saniyede
    // normalize=0 -> girdiler bolunmez, seviyeleri volume ile kendimiz veririz
    fc.push(`[${mi + 1}:a]volume=1.0[cd]`);
    fc.push(`[${sesKaynak}][mus][cd]amix=inputs=3:duration=first:dropout_transition=0:normalize=0,`+
            `alimiter=limit=0.95,volume=1.0[aout]`);
  } else {
    fc.push(`[${sesKaynak}][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,`+
            `alimiter=limit=0.95,volume=1.0[aout]`);
  }
  const fcFile = path.join(BASE,"_filter_final.txt");
  fs.writeFileSync(fcFile, fc.join(";\n"), "utf8");

  run(["-y",...inputs,"-i",voicePadded,"-i",musicFile,...(cdWav ? ["-i", cdWav] : []),"-filter_complex_script",fcFile,
       "-map","[vout]","-map","[aout]",
       "-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p",
       "-c:a","aac","-b:a","192k","-r",String(FPS),"-shortest",outFile], BASE);

  console.log("\n=== BITTI ===");
  console.log("  " + outFile);
  console.log("  Sure: " + (dur(outFile)/60).toFixed(2) + " dk");
  console.log("  Boyut: " + (fs.statSync(outFile).size/1048576).toFixed(1) + " MB");
})();
