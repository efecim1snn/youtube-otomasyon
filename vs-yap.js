// VS MOTORU — "dovusseler kim kazanirdi" Shorts'u (9:16, bolunmus ekran, simsek ayrac)
// Kullanim: node vs-yap.js <is-adi>
//
// Girdi : uretim/<is>/vs.json  +  uretim/<is>/Images/ust.jpg, alt.jpg
// Cikti : uretim/<is>/Videos/<is>.mp4
//
// HIZ NOTU: gorseller ve simsek katmani BIR KEZ hazirlanip her bolumde
// yeniden kullaniliyor. Ilk surumde her karede 32 MP jpeg olceklenip simsek
// geq ile yeniden hesaplaniyordu — 36 sn'lik video 10 dakika suruyordu.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { ffmpeg: FF, ffprobe: FP } = require("./ff-yol.js");

const IS = process.argv[2];
if (!IS) { console.error("kullanim: node vs-yap.js <is-adi>"); process.exit(1); }

const BASE = path.join(__dirname, "uretim", IS);
const IMG = path.join(BASE, "Images");
const OUT = path.join(BASE, "Videos");
const TMP = path.join(BASE, "tmp-vs");
if (!fs.existsSync(BASE)) { console.error("is bulunamadi: " + IS); process.exit(1); }
for (const d of [OUT, TMP]) fs.mkdirSync(d, { recursive: true });

const V = JSON.parse(fs.readFileSync(path.join(BASE, "vs.json"), "utf8"));

const W = 1080, H = 1920, ORTA = H / 2, YARIM = H / 2, FPS = 30;
const BD = "C\\:/Windows/Fonts/arialbd.ttf";
const IMP = "C\\:/Windows/Fonts/impact.ttf";
const BPM = 140;

try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}

function kodekSec() {
  for (const a of [
    { ad: "NVIDIA NVENC", argv: ["-c:v","h264_nvenc","-preset","p4","-cq","21"] },
    { ad: "AMD AMF",      argv: ["-c:v","h264_amf","-quality","balanced","-rc","cqp","-qp_i","21","-qp_p","23"] },
  ]) {
    try {
      execFileSync(FF, ["-y","-hide_banner","-loglevel","error","-f","lavfi",
        "-i","testsrc2=s=640x360:r=30:d=1", ...a.argv, "-an","-f","null",
        process.platform === "win32" ? "NUL" : "/dev/null"], { stdio: "ignore", timeout: 25000 });
      return a;
    } catch (e) {}
  }
  return null;
}
const GPU = kodekSec();
const KODEK = GPU ? GPU.argv : ["-c:v","libx264","-preset","veryfast","-crf","19"];

function run(argv, etiket) {
  try {
    execFileSync(FF, ["-y","-hide_banner","-loglevel","error", ...argv], { stdio: "pipe", timeout: 900000 });
  } catch (e) {
    const err = (e.stderr && e.stderr.toString()) || e.message;
    console.error("\n!! ffmpeg hatasi (" + etiket + "):\n" + err.slice(-1500));
    throw e;
  }
}

const q = s => String(s).replace(/\\/g, "\\\\").replace(/'/g, "").replace(/:/g, "\\:")
                        .replace(/%/g, "\\%").replace(/,/g, "\\,");

// ---- HAZIRLIK (bir kez) ----------------------------------------------------
const ustPng = path.join(TMP, "ust-yari.png");
const altPng = path.join(TMP, "alt-yari.png");
const simsekMov = path.join(TMP, "simsek.mov");

function hazirla() {
  for (const [kaynak, hedef] of [["ust.jpg", ustPng], ["alt.jpg", altPng]]) {
    run(["-i", path.join(IMG, kaynak),
      "-vf", `scale=${W}:${YARIM}:force_original_aspect_ratio=increase,crop=${W}:${YARIM},` +
             `eq=brightness=-0.06:saturation=1.12,setsar=1`,
      "-frames:v","1", hedef], "gorsel hazirlik " + kaynak);
  }

  // Uc ucgen dalganin toplami = duzensiz zikzak. Tek dalga fazla duzenli duruyor.
  const t = (p, a) => `${a}*(2*(2*abs(X/${p}-floor(X/${p}+0.5)))-1)`;
  const z = `(${t(97, 30)}+${t(41, 15)}+${t(17, 7)})`;
  const kal = `(4.5+1.8*sin(2*PI*T*9))`;
  const d = `abs(Y-${ORTA}-${z})`;
  // 1 saniyelik dongu; her bolumde -stream_loop ile tekrarlanir
  run(["-f","lavfi","-i", `color=c=black@0:s=${W}x${H}:r=${FPS}:d=1`,
    "-vf", `format=rgba,geq=r='210':g='245':b='255':` +
           `a='if(lt(${d},${kal}),255,if(lt(${d},${kal}*3.4),110,0))',gblur=sigma=1.2`,
    "-c:v","qtrle", simsekMov], "simsek katmani");
}

// ---- BOLUM RENDER ----------------------------------------------------------
function bolumYap(dosya, sure, katman) {
  const f = [
    `[0:v][1:v]vstack=inputs=2[bg]`,
    `[bg][2:v]overlay=0:0:shortest=0[base]`,
    `[base]${katman},format=yuv420p[v]`,
  ].join(";");
  run([
    "-loop","1","-t",String(sure),"-i", ustPng,
    "-loop","1","-t",String(sure),"-i", altPng,
    "-stream_loop","-1","-t",String(sure),"-i", simsekMov,
    "-filter_complex", f, "-map","[v]",
    "-r",String(FPS), ...KODEK, "-t",String(sure), dosya,
  ], path.basename(dosya));
}

// ---- KATMANLAR -------------------------------------------------------------
// Yerleşim: isimler en uc noktalarda, barlar kendi yarilarinin icinde,
// olcu adi ORTADA simsegin uzerinde bir plaket olarak. Ilk surumde olcu serdi
// ust hayvanin yuzunu kesiyordu.
const PLAK_W = 720, PLAK_X = (W - PLAK_W) / 2, PLAK_Y = ORTA - 82, PLAK_H = 168;
const BARW = 820, BX = (W - BARW) / 2, BARH = 78;
const UST_BAR_Y = 560, ALT_BAR_Y = 1290;

function isimler(V) {
  return [
    `drawtext=fontfile='${IMP}':text='${q(V.ust.ad)}':fontcolor=0x${V.ust.renk}` +
      `:fontsize=74:x=(w-text_w)/2:y=54:borderw=7:bordercolor=black`,
    `drawtext=fontfile='${IMP}':text='${q(V.alt.ad)}':fontcolor=0x${V.alt.renk}` +
      `:fontsize=74:x=(w-text_w)/2:y=h-text_h-54:borderw=7:bordercolor=black`,
  ].join(",");
}

// Metin plakete sigmazsa punto kucultulur. Arial/Impact'te ortalama karakter
// genisligi ~0.52 x punto; uzun cumleler yoksa plaketin disina tasiyor.
function sigdir(metin, istenen, oran) {
  const g = (PLAK_W - 40) / (String(metin).length * (oran || 0.52));
  return Math.max(24, Math.min(istenen, Math.floor(g)));
}

function plaket(satir1, satir2, boy1, boy2) {
  boy1 = sigdir(satir1, boy1 || 68, 0.50);
  if (satir2) boy2 = sigdir(satir2, boy2 || 38, 0.52);
  const p = [
    `drawbox=x=${PLAK_X}:y=${PLAK_Y}:w=${PLAK_W}:h=${PLAK_H}:color=black@0.80:t=fill`,
    `drawbox=x=${PLAK_X}:y=${PLAK_Y}:w=${PLAK_W}:h=5:color=0xB4F0FF@0.9:t=fill`,
    `drawbox=x=${PLAK_X}:y=${PLAK_Y + PLAK_H - 5}:w=${PLAK_W}:h=5:color=0xB4F0FF@0.9:t=fill`,
    `drawtext=fontfile='${IMP}':text='${q(satir1)}':fontcolor=white:fontsize=${boy1}` +
      `:x=(w-text_w)/2:y=${PLAK_Y + 22}:borderw=5:bordercolor=black`,
  ];
  if (satir2) p.push(
    `drawtext=fontfile='${BD}':text='${q(satir2)}':fontcolor=0xBFE6F5:fontsize=${boy2}` +
      `:x=(w-text_w)/2:y=${PLAK_Y + 104}:borderw=4:bordercolor=black`);
  return p.join(",");
}

function introKatman(V) {
  return [
    isimler(V),
    // buyuk gelip yerine oturan VS
    `drawtext=fontfile='${IMP}':text='VS':fontcolor=white` +
      `:fontsize='if(lt(t,0.5),300-160*min(1\\,max(0\\,t/0.5)),140)'` +
      `:x=(w-text_w)/2:y=(h-text_h)/2:borderw=10:bordercolor=black`,
    `drawtext=fontfile='${IMP}':text='${q(V.altBaslik || "WHO WINS?")}':fontcolor=0xFFE04A` +
      `:fontsize=58:x=(w-text_w)/2:y=${ORTA + 130}:borderw=6:bordercolor=black` +
      `:enable='gte(t,1.15)'`,
  ].join(",");
}

function olcuKatman(o, V) {
  // Bar olcegi: dogrusal olunca 11 cm / 559 cm gorunmez oluyor, log olunca
  // fark yok gibi duruyor. 0.35 kuvvet ikisinin arasinda dogru duruyor.
  const enB = Math.max(o.ustDeger, o.altDeger) || 1;
  const oran = d => Math.max(0.07, Math.pow(Math.max(d, 0) / enB, 0.35));
  const uW = Math.round(BARW * oran(o.ustDeger));
  const aW = Math.round(BARW * oran(o.altDeger));
  const buyu = w => `'min(${w},${w}*(t/0.8))'`;

  const kaz = (taraf, y) => o.kazanan === taraf
    ? `drawtext=fontfile='${IMP}':text='WINNER':fontcolor=0xFFE04A:fontsize=44` +
      `:x=${BX}:y=${y}:borderw=6:bordercolor=black:enable='gte(t,1.1)'`
    : null;

  return [
    // ust taraf
    `drawtext=fontfile='${IMP}':text='${q(o.ustMetin)}':fontcolor=white:fontsize=68` +
      `:x=${BX}:y=${UST_BAR_Y - 88}:borderw=6:bordercolor=black`,
    `drawbox=x=${BX}:y=${UST_BAR_Y}:w=${BARW}:h=${BARH}:color=black@0.58:t=fill`,
    `drawbox=x=${BX}:y=${UST_BAR_Y}:w=${buyu(uW)}:h=${BARH}:color=0x${V.ust.renk}@0.94:t=fill`,
    kaz("ust", UST_BAR_Y + BARH + 14),
    // orta plaket
    plaket(o.ad, o.not),
    // alt taraf
    `drawbox=x=${BX}:y=${ALT_BAR_Y}:w=${BARW}:h=${BARH}:color=black@0.58:t=fill`,
    `drawbox=x=${BX}:y=${ALT_BAR_Y}:w=${buyu(aW)}:h=${BARH}:color=0x${V.alt.renk}@0.94:t=fill`,
    `drawtext=fontfile='${IMP}':text='${q(o.altMetin)}':fontcolor=white:fontsize=68` +
      `:x=${BX}:y=${ALT_BAR_Y + BARH + 16}:borderw=6:bordercolor=black`,
    kaz("alt", ALT_BAR_Y - 58),
    isimler(V),
  ].filter(Boolean).join(",");
}

function kazananKatman(V) {
  const kazanan = V.kazanan === "ust" ? V.ust : V.alt;
  const karart = V.kazanan === "ust"
    ? `drawbox=x=0:y=${ORTA}:w=${W}:h=${ORTA}:color=black@0.62:t=fill`
    : `drawbox=x=0:y=0:w=${W}:h=${ORTA}:color=black@0.62:t=fill`;
  const y = V.kazanan === "ust" ? 470 : 1180;
  return [
    karart,
    `drawtext=fontfile='${IMP}':text='WINNER':fontcolor=0xFFE04A:fontsize=100` +
      `:x=(w-text_w)/2:y=${y}:borderw=9:bordercolor=black`,
    `drawtext=fontfile='${IMP}':text='${q(kazanan.ad)}':fontcolor=white:fontsize=96` +
      `:x=(w-text_w)/2:y=${y + 118}:borderw=9:bordercolor=black`,
    plaket(V.sonuc || "", V.sonuc2 || "", 46, 40),
    isimler(V),
  ].filter(Boolean).join(",");
}

// ---- DOVUS MUZIGI ----------------------------------------------------------
// Osman'in tekrar eden sikayeti: muzik duyulmuyor. Sebep sub-basta kalmasi.
// Vurus bilerek ORTA banda tasindi: trampet gurultusu + 165-330 Hz riff.
function muzik(sure) {
  const v = 60 / BPM;
  const m = `mod(t,${v})`, m2 = `mod(t,${v * 2})`, m4 = `mod(t,${v * 4})`;
  const ifade =
    `0.62*sin(2*PI*60*t)*exp(-${m}*13)` +                                   // kick govde
    `+0.30*sin(2*PI*700*t)*exp(-${m}*90)` +                                 // kick tik
    `+0.42*(random(0)*2-1)*exp(-mod(t+${v},${v * 2})*26)` +                 // trampet
    `+0.20*sin(2*PI*164.81*t)*(0.55+0.45*sin(2*PI*t/${v * 8}))` +           // E riff
    `+0.16*sin(2*PI*246.94*t)*exp(-${m2}*2.2)` +                            // B
    `+0.13*sin(2*PI*329.63*t)*exp(-${m4}*1.6)` +                            // E oktav
    `+0.13*(random(0)*2-1)*exp(-mod(t,${v / 2})*150)`;                      // hi-hat
  return `aevalsrc='${ifade}':s=44100:d=${sure},` +
         `highpass=f=45,alimiter=level_in=1:level_out=0.92:limit=0.95,` +
         `loudnorm=I=-14:TP=-1.2:LRA=9`;
}

// ---- AKIS ------------------------------------------------------------------
(async () => {
  for (const f of ["ust.jpg", "alt.jpg"])
    if (!fs.existsSync(path.join(IMG, f))) { console.error("gorsel eksik: Images/" + f); process.exit(1); }

  console.log("KODLAYICI: " + (GPU ? GPU.ad + " (GPU)" : "CPU libx264"));
  const t0 = Date.now();
  hazirla();

  const INTRO = V.introSure || 4.0;
  const OLCU  = V.olcuSure  || 5.8;
  const SON   = V.sonSure   || 7.0;
  const N = V.olculer.length;
  const parcalar = [];

  let f0 = path.join(TMP, "00-intro.mp4");
  bolumYap(f0, INTRO, introKatman(V)); parcalar.push(f0);
  process.stdout.write("  bolum giris");

  V.olculer.forEach((o, i) => {
    const f = path.join(TMP, String(i + 1).padStart(2, "0") + ".mp4");
    bolumYap(f, OLCU, olcuKatman(o, V)); parcalar.push(f);
    process.stdout.write(" · " + o.ad);
  });

  const fk = path.join(TMP, "99-kazanan.mp4");
  bolumYap(fk, SON, kazananKatman(V)); parcalar.push(fk);
  console.log(" · kazanan");

  const liste = path.join(TMP, "liste.txt");
  fs.writeFileSync(liste, parcalar.map(p => "file '" + p.replace(/\\/g, "/") + "'").join("\n"), "utf8");
  const sessiz = path.join(TMP, "sessiz.mp4");
  run(["-f","concat","-safe","0","-i",liste,"-c","copy",sessiz], "birlestirme");

  const toplam = INTRO + OLCU * N + SON;
  const cikti = path.join(OUT, IS + ".mp4");
  run(["-i", sessiz, "-f","lavfi","-i", muzik(toplam + 0.5),
    "-map","0:v","-map","1:a","-shortest","-c:v","copy","-c:a","aac","-b:a","192k", cikti], "ses");

  const sure = execFileSync(FP, ["-v","error","-show_entries","format=duration","-of","csv=p=0", cikti]).toString().trim();
  console.log("=== BITTI === " + Number(sure).toFixed(1) + " sn · " +
              (fs.statSync(cikti).size / 1048576).toFixed(1) + " MB · render " +
              ((Date.now() - t0) / 1000).toFixed(0) + " sn");
  console.log("  " + cikti);
})().catch(e => { console.error("HATA: " + e.message); process.exit(1); });
