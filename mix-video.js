// MIX VIDEOSU — animasyonlu gunbatimi gradyani + batan gunes + sese tepkili dalga
//                + degisen parca adi.  Tamamen prosedurel, telifsiz.
// Kullanim: node mix-video.js "<mix.mp3>" "<tracklist.txt>" "<cikti.mp4>"
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "ffmpeg.exe");
const FP = path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "ffprobe.exe");

const MP3 = path.resolve(process.argv[2]);
const TL  = path.resolve(process.argv[3]);
const OUT = path.resolve(process.argv[4] || "MIX-VIDEO.mp4");
const TMP = path.join(path.dirname(OUT), "_mv");

const W = 1920, H = 1080, FPS = 30;
const BD = "C\\:/Windows/Fonts/arialbd.ttf";
const RG = "C\\:/Windows/Fonts/arial.ttf";

const run = a => {
  try { return execFileSync(FF, a, { stdio:["ignore","ignore","pipe"], maxBuffer:1<<26 }); }
  catch (e) {
    const s = (e.stderr||Buffer.alloc(0)).toString();
    console.log("\n!! FFMPEG: " + (s.split("\n").filter(l=>/error|invalid/i.test(l)).slice(0,3).join(" | ") || s.slice(-400)));
    throw e;
  }
};
const esc = s => String(s).replace(/\\/g,"\\\\").replace(/'/g,"\u2019").replace(/:/g,"\\:").replace(/%/g,"\\%");

// ---- tracklist'ten cue noktalarini oku ----
function cueOku() {
  const txt = fs.readFileSync(TL, "utf8");
  const cue = [];
  for (const ln of txt.split(/\r?\n/)) {
    const m = ln.match(/^\s*(\d+):(\d{2})\s{2,}(.+?)\s{2,}[\d.]+\s*BPM/);
    if (m) cue.push({ t: Number(m[1])*60 + Number(m[2]), ad: m[3].trim() });
  }
  return cue;
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const SURE = Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", MP3]).toString().trim());
  const cue = cueOku();
  console.log(`Mix: ${(SURE/60).toFixed(1)} dakika | ${cue.length} parca`);

  // ---- 1) GUNES DISKI (bir kez uretilir) ----
  const gunes = path.join(TMP, "gunes.png");
  const R = 150, S = 900;                       // tuval genis: halo kenarda sifira insin
  if (!fs.existsSync(gunes)) {
    const d = `hypot(X-${S/2},Y-${S/2})`;
    const core = `exp(-pow(max(0,${d}-${R}),2)/900)`;
    const halo = `exp(-pow(${d},2)/${(R*R*2.2).toFixed(0)})`;
    // kenar kesme: tuval yarisina yaklastikca alfa zorla sifirlanir (kare kenar gitsin)
    const kes = `max(0,1-pow(${d}/${(S/2-10).toFixed(0)},3))`;
    run(["-y","-f","lavfi","-i",`color=c=black@0:s=${S}x${S}`,"-vf",
      `format=rgba,geq=`+
      `r='clip(255*(1.0*${core}+0.55*${halo}),0,255)':`+
      `g='clip(255*(0.72*${core}+0.28*${halo}),0,255)':`+
      `b='clip(255*(0.38*${core}+0.12*${halo}),0,255)':`+
      `a='clip(255*(1.0*${core}+0.45*${halo})*${kes},0,255)'`,
      "-frames:v","1",gunes]);
    console.log("  gunes diski uretildi");
  }

  // ---- 2) PARCA ADI KATMANLARI ----
  let adKatman = "";
  cue.forEach((c, i) => {
    const bit = i < cue.length - 1 ? cue[i+1].t : SURE;
    const gir = c.t, cik = bit;
    adKatman +=
      `,drawtext=fontfile='${BD}':text='${esc(c.ad.toUpperCase())}':fontcolor=white@0.92:fontsize=44:` +
      `x=90:y=h-150:shadowcolor=black@0.8:shadowx=3:shadowy=3:` +
      `enable='between(t,${gir},${cik})'`;
    adKatman +=
      `,drawtext=fontfile='${RG}':text='${String(i+1).padStart(2,"0")} / ${String(cue.length).padStart(2,"0")}':` +
      `fontcolor=0xFFB37A@0.85:fontsize=30:x=90:y=h-100:` +
      `enable='between(t,${gir},${cik})'`;
  });

  // ---- 3) TEK GECISTE RENDER ----
  // gradyan: yavas hareketli gunbatimi paleti
  const grad = `gradients=s=${W}x${H}:c0=0x140A24:c1=0xFF6B35:c2=0x2B1B4A:c3=0xFFB357:` +
               `x0=${W/2}:y0=${Math.round(H*0.72)}:x1=${W/2}:y1=0:nb_colors=4:` +
               `speed=0.0015:duration=${Math.ceil(SURE)}:rate=${FPS}`;

  // gunesin y konumu: %28 -> %68 arasi, sure boyunca yavasca iniyor
  const y0 = Math.round(H*0.28), y1 = Math.round(H*0.68);
  const gunesY = `${y0}+(${y1}-${y0})*t/${SURE.toFixed(1)}`;

  const fc = [
    `[0:v]format=rgb24,noise=alls=6:allf=t,vignette=angle=PI/5[bg]`,
    `[1:v]format=rgba[sun]`,
    `[bg][sun]overlay=x=(W-w)/2:y='${gunesY}':eval=frame:format=auto[v1]`,
    // sese tepkili dalga — altta, sicak renkte
    `[2:a]showwaves=s=${W}x140:mode=cline:colors=0xFFB37A|0xFF6B35:rate=${FPS}:scale=sqrt,` +
      `format=rgba,colorchannelmixer=aa=0.55[wav]`,
    `[v1][wav]overlay=x=0:y=H-140:format=auto[v2]`,
    // ust bilgi + parca adlari
    `[v2]drawtext=fontfile='${BD}':text='${esc("A F R O   H O U S E")}':fontcolor=white@0.9:fontsize=40:x=90:y=80` +
      `,drawtext=fontfile='${RG}':text='${esc("S U N S E T   S E T")}':fontcolor=0xFFB37A@0.8:fontsize=28:x=90:y=138` +
      adKatman + `,format=yuv420p[vout]`
  ];
  const fcFile = path.join(TMP, "fc.txt");
  fs.writeFileSync(fcFile, fc.join(";\n"), "utf8");

  console.log("Render basliyor (uzun surebilir)...");
  run(["-y",
    "-f","lavfi","-i",grad,
    "-loop","1","-i",gunes,
    "-i",MP3,
    "-filter_complex_script",fcFile,
    "-map","[vout]","-map","2:a",
    "-c:v","libx264","-preset","veryfast","-crf","23","-pix_fmt","yuv420p",
    "-c:a","aac","-b:a","256k","-r",String(FPS),"-shortest",...(process.env.TEST?["-t",process.env.TEST]:[]), OUT]);

  const d = Number(execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", OUT]).toString().trim());
  console.log(`\n=== VIDEO HAZIR ===`);
  console.log(`  ${OUT}`);
  console.log(`  Sure: ${Math.floor(d/60)}:${String(Math.round(d%60)).padStart(2,"0")}`);
  console.log(`  Boyut: ${(fs.statSync(OUT).size/1048576).toFixed(0)} MB`);
})();
