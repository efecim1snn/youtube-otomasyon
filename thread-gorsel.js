// Thread icin gorsel kartlari uretir — gercek verilerle, marka diliyle.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("./ff-yol").ffmpeg;
const OUT = "C:\\Users\\Administrator\\Desktop\\THREAD GORSELLERI";
const MONO = "C\\:/Windows/Fonts/consola.ttf";
const MONOB = "C\\:/Windows/Fonts/consolab.ttf";
const BD = "C\\:/Windows/Fonts/arialbd.ttf";
const RG = "C\\:/Windows/Fonts/arial.ttf";
const W = 1600, H = 900;

const esc = s => String(s).replace(/\\/g,"\\\\").replace(/'/g,"\u2019").replace(/:/g,"\\:").replace(/%/g,"\\%");
const run = a => execFileSync(FF, a, { stdio:["ignore","ignore","pipe"], maxBuffer:1<<26 });

// terminal penceresi kart
function terminalKart(dosya, baslik, satirlar, alt) {
  const PAD = 90, winY = 130, winH = 640, barH = 56, lh = 42, startY = winY + barH + 40;
  let f = `drawbox=x=${PAD}:y=${winY}:w=${W-2*PAD}:h=${winH}:color=0x0B1017@0.96:t=fill,`;
  f += `drawbox=x=${PAD}:y=${winY}:w=${W-2*PAD}:h=${barH}:color=0x161D28:t=fill,`;
  f += `drawbox=x=${PAD}:y=${winY+winH-3}:w=${W-2*PAD}:h=3:color=0x6FD8FF@0.9:t=fill,`;
  ["0xFF5F57","0xFEBC2E","0x28C840"].forEach((c,k)=>{
    f += `drawbox=x=${PAD+28+k*26}:y=${winY+barH/2-6}:w=12:h=12:color=${c}:t=fill,`;
  });
  f += `drawtext=fontfile='${MONOB}':text='${esc(baslik)}':fontcolor=0x9FE6FF:fontsize=27:x=${PAD+120}:y=${winY+barH/2-14},`;
  satirlar.forEach((ln,k)=>{
    let col = "0xE6EDF3", font = MONO;
    if (/^\$ /.test(ln)) { col="0x7CE38B"; font=MONOB; }
    else if (/^#/.test(ln)) col = "0x6E7B8B";
    else if (/^>/.test(ln)) col = "0xFFD479";
    else if (/^\[/.test(ln)) { col="0x6FD8FF"; font=MONOB; }
    f += `drawtext=fontfile='${font}':text='${esc(ln)}':fontcolor=${col}:fontsize=29:x=${PAD+44}:y=${startY+k*lh},`;
  });
  if (alt) f += `drawtext=fontfile='${BD}':text='${esc(alt)}':fontcolor=0x8A97A6:fontsize=28:x=(w-text_w)/2:y=${winY+winH+34},`;
  f = f.replace(/,$/,"");
  run(["-y","-f","lavfi","-i",`color=c=0x04060B:s=${W}x${H}`,"-vf",`format=rgb24,${f}`,"-frames:v","1",path.join(OUT,dosya)]);
  console.log("  " + dosya);
}

// baslik + buyuk rakam karti
function rakamKart(dosya, ust, ana, alt, renk="0x6FD8FF") {
  let f = `drawtext=fontfile='${BD}':text='${esc(ust)}':fontcolor=${renk}:fontsize=42:x=(w-text_w)/2:y=250,`;
  f += `drawtext=fontfile='${BD}':text='${esc(ana)}':fontcolor=white:fontsize=130:x=(w-text_w)/2:y=340:shadowcolor=black:shadowx=4:shadowy=4,`;
  f += `drawbox=x=(iw-620)/2:y=520:w=620:h=4:color=${renk}@0.9:t=fill,`;
  f += `drawtext=fontfile='${RG}':text='${esc(alt)}':fontcolor=0xC8D4DE:fontsize=38:x=(w-text_w)/2:y=570`;
  run(["-y","-f","lavfi","-i",`color=c=0x04060B:s=${W}x${H}`,"-vf",`format=rgb24,${f}`,"-frames:v","1",path.join(OUT,dosya)]);
  console.log("  " + dosya);
}

// karsilastirma karti (once/sonra)
function kiyasKart(dosya, baslik, sol, solD, sag, sagD) {
  let f = `drawtext=fontfile='${BD}':text='${esc(baslik)}':fontcolor=0x6FD8FF:fontsize=46:x=(w-text_w)/2:y=140,`;
  f += `drawbox=x=110:y=280:w=620:h=360:color=0x0B1017@0.96:t=fill,`;
  f += `drawbox=x=870:y=280:w=620:h=360:color=0x0B1017@0.96:t=fill,`;
  f += `drawbox=x=110:y=280:w=620:h=5:color=0xFF5F57:t=fill,`;
  f += `drawbox=x=870:y=280:w=620:h=5:color=0x28C840:t=fill,`;
  f += `drawtext=fontfile='${RG}':text='${esc(sol)}':fontcolor=0xC8D4DE:fontsize=30:x=140:y=340,`;
  f += `drawtext=fontfile='${BD}':text='${esc(solD)}':fontcolor=0xFF7B72:fontsize=110:x=140:y=440,`;
  f += `drawtext=fontfile='${RG}':text='${esc(sag)}':fontcolor=0xC8D4DE:fontsize=30:x=900:y=340,`;
  f += `drawtext=fontfile='${BD}':text='${esc(sagD)}':fontcolor=0x7CE38B:fontsize=110:x=900:y=440`;
  run(["-y","-f","lavfi","-i",`color=c=0x04060B:s=${W}x${H}`,"-vf",`format=rgb24,${f}`,"-frames:v","1",path.join(OUT,dosya)]);
  console.log("  " + dosya);
}

fs.mkdirSync(OUT, { recursive: true });
console.log("Thread gorselleri uretiliyor...\n");

// POST 1 — sonuc
rakamKart("post-1-sonuc.jpg", "SIFIR MALIYET", "15 VIDEO", "2 saat 40 dakika icerik + 26 dakikalik mix");

// POST 2 — kurulum komutlari
terminalKart("post-2-kurulum.jpg", "PowerShell — kurulum", [
  "# 1) Node.js kuruldu mu?",
  "$ node --version",
  "> v20.11.0",
  "",
  "# 2) ffmpeg kur",
  "$ winget install Gyan.FFmpeg",
  "",
  "# 3) klasore gec ve kutuphaneyi kur",
  "$ cd \"$env:USERPROFILE\\Desktop\\youtube otomasyon\"",
  "$ npm init -y",
  "$ npm install msedge-tts"
], "Kurulum — 30 dakika");

// POST 3 — NASA
terminalKart("post-3-nasa.jpg", "images-api.nasa.gov", [
  "# API anahtari GEREKMIYOR",
  "",
  "$ curl \"https://images-api.nasa.gov/search?q=nebula",
  "         &media_type=image\"",
  "",
  "> 100 sonuc",
  "> public domain",
  "> ticari kullanim serbest",
  "> 2000-4000 piksel",
  "",
  "# Tek istekte 100 gorsel. Bedava."
], "Gorsel kaynagi — NASA acik arsivi");

// POST 4 — TTS
terminalKart("post-4-seslendirme.jpg", "seslendir.js", [
  "$ npm install msedge-tts",
  "",
  "# Microsoft Edge neural sesleri",
  "# ucretsiz - anahtar yok - limit yok",
  "",
  "ses  : en-US-ChristopherNeural",
  "etiket: Reliable, Authority",
  "hiz  : +7%",
  "",
  "> olculen: dakikada ~151 kelime",
  "> 2400 kelime = ~16 dakika video"
], "Seslendirme — ElevenLabs'e para vermeden");

// POST 5 — render hatti
terminalKart("post-5-kurgu.jpg", "video-yap.js — 3 asama", [
  "[1] Her gorsel -> 9 saniyelik klip",
  "     scale -> Ken Burns zoom -> renk",
  "",
  "[2] Klipler -> 8'erli gruplar",
  "     0.8 sn crossfade",
  "",
  "[3] Gruplar -> final",
  "     altyazi yakma + ses miksi",
  "",
  "# Tek seferde yapinca: bellek yetmedi",
  "# Kademeli yapinca: sorunsuz"
], "Kurgu — CapCut yok, Premiere yok");

// POST 6 — amix hatasi
kiyasKart("post-6-amix-hatasi.jpg", "MUZIK NEDEN DUYULMUYORDU?",
  "amix (varsayilan)", "-51 dB", "amix=normalize=0", "-28 dB");

// POST 7 — BPM
terminalKart("post-7-bpm.jpg", "muzik-analiz.js", [
  "$ node muzik-analiz.js ./muzik",
  "",
  "  103.4 BPM | 4:21 | Omo, She No Come Back",
  "  117.5 BPM | 3:19 | afroooooo",
  "    123 BPM | 3:13 | Aya Malembe",
  "    123 BPM | 3:54 | No Chains On My Soul",
  "  129.2 BPM | 2:59 | Saltwave Dialects",
  "  129.2 BPM | 3:02 | Shekere Syncopation",
  "",
  "> 42 sarki, 3 dakikada analiz edildi"
], "BPM tespiti — enerji zarfi + otokorelasyon");

// POST 8 — vidIQ
kiyasKart("post-8-vidiq.jpg", "AYNI VIDEO. FARKLI BASLIK.",
  "\"AI Is Learning to Rewire Your Mind\"", "67", "\"AI Mind Reading Already Works.\"", "94");

console.log("\nBitti -> " + OUT);
