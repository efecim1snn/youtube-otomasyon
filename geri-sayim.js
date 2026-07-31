// Film lideri geri sayimi (5-4-3-2-1) — donen supurme, film greni, "dit" bipleri.
// Kullanim: node geri-sayim.js <cikti.mp4> [genislik] [yukseklik]
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("./ff-yol").ffmpeg;
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "tmp-test", "geri-sayim.mp4"));
const W = Number(process.argv[3] || 1920), H = Number(process.argv[4] || 1080);
const FPS = 30, N = 5;                       // 5 saniye
const cx = Math.round(W/2), cy = Math.round(H/2);
const rOut = Math.round(Math.min(W,H) * 0.40);
const rIn  = Math.round(Math.min(W,H) * 0.28);
const BD = "C\\:/Windows/Fonts/arialbd.ttf";

const run = (a) => {
  try {
    return execFileSync(FF, a, { stdio: ["ignore","ignore","pipe"], maxBuffer: 1<<26 });
  } catch (e) {
    const err = (e.stderr || Buffer.alloc(0)).toString("utf8");
    console.log("\n!! FFMPEG HATASI:");
    console.log(err.split("\n").filter(l => /error|invalid|no such|failed/i.test(l)).slice(0,5).join("\n") || err.slice(-800));
    throw new Error("ffmpeg basarisiz");
  }
};

// --- pixel aci: tepeden saat yonunde 0..2PI ---
const A = `mod(atan2(X-${cx},${cy}-Y)+2*PI,2*PI)`;
const P = `mod(T,1)*2*PI`;                    // her saniye bir tam tur
const ring = (r,s) => `exp(-pow(hypot(X-${cx},Y-${cy})-${r},2)/${s})`;
// supurulen sektor biraz daha aydinlik
const wedge = `lt(${A},${P})*0.10`;
const base = (b) => `clip(${b} + 210*${ring(rOut,70)} + 210*${ring(rIn,45)} + 255*${wedge},0,255)`;

const vf =
  `format=rgb24,` +
  `geq=r='${base(13)}':g='${base(13)}':b='${base(15)}',` +
  `drawbox=x=0:y=${cy-2}:w=${W}:h=4:color=0xE8E8E8@0.7:t=fill,` +
  `drawbox=x=${cx-2}:y=0:w=4:h=${H}:color=0xE8E8E8@0.7:t=fill,` +
  // rakamlar
  [5,4,3,2,1].map((n,i) =>
    `drawtext=fontfile='${BD}':text='${n}':fontcolor=0xF2F2F2:fontsize=${Math.round(H*0.42)}:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-${Math.round(H*0.03)}:enable='between(t,${i},${i+1})'`
  ).join(",") + "," +
  // film greni + hafif titresim + vinyet
  `noise=alls=14:allf=t,eq=contrast=1.12:brightness=-0.02,vignette=angle=PI/4.5,` +
  `format=yuv420p`;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = path.join(path.dirname(OUT), "_gs");
  fs.mkdirSync(tmp, { recursive: true });

  // --- SES: her saniyede kisa 1kHz "dit" ---
  const beep = path.join(tmp, "beep.wav");
  const gap  = path.join(tmp, "gap.wav");
  run(["-y","-f","lavfi","-i","sine=frequency=1000:duration=0.07","-af","afade=t=out:st=0.05:d=0.02","-ar","48000","-ac","2",beep]);
  run(["-y","-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-t","0.93",gap]);
  const lst = path.join(tmp, "seq.txt");
  let lines = [];
  for (let i = 0; i < N; i++) {
    lines.push("file '" + beep.replace(/\\/g,"/") + "'");
    lines.push("file '" + gap.replace(/\\/g,"/") + "'");
  }
  fs.writeFileSync(lst, lines.join("\n"), "utf8");
  const beeps = path.join(tmp, "beeps.wav");
  run(["-y","-f","concat","-safe","0","-i",lst,"-c:a","pcm_s16le",beeps]);

  // --- gerilim yukselisi (riser) geri sayim boyunca ---
  const riser = path.join(tmp, "riser.wav");
  run(["-y",
    "-f","lavfi","-i",`sine=frequency=55:duration=${N}`,
    "-f","lavfi","-i",`sine=frequency=110:duration=${N}`,
    "-f","lavfi","-i",`anoisesrc=d=${N}:c=brown:a=0.25`,
    "-filter_complex",
      `[0]volume=0.55[a];[1]volume=0.30,tremolo=f=2:d=0.35[b];`+
      `[2]lowpass=f=220,volume=0.40[c];`+
      `[a][b][c]amix=inputs=3:duration=longest,`+
      `volume='0.25+0.75*t/${N}':eval=frame,lowpass=f=900`,
    "-ar","48000","-ac","2",riser]);

  // --- ses birlestir ---
  const aud = path.join(tmp, "ses.wav");
  // loudnorm ile yayin seviyesine getir — yoksa bip sesi duyulmuyor
  run(["-y","-i",beeps,"-i",riser,"-filter_complex",
       "[0]volume=1.0[b];[1]volume=0.55[r];[b][r]amix=inputs=2:duration=first,"+
       "loudnorm=I=-15:TP=-1.5:LRA=11",
       "-ar","48000","-ac","2",aud]);

  // --- video + ses ---
  run(["-y","-f","lavfi","-i",`color=c=0x0D0D0D:s=${W}x${H}:r=${FPS}:d=${N}`,
       "-i",aud,"-vf",vf,"-c:v","libx264","-preset","veryfast","-crf","18",
       "-c:a","aac","-b:a","192k","-shortest",OUT]);

  console.log("Geri sayim uretildi: " + OUT);
})();
