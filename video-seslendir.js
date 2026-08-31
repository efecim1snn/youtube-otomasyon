// VAR OLAN VIDEOYA SESLENDIRME + ALTYAZI EKLER
//
// Elindeki bir videoya Turkce (ya da baska dilde) anlatim ve altyazi bindirir.
// Kendi videon ya da kullanma iznin olan bir video icin.
//
// Kullanim:
//   node video-seslendir.js <video.mp4> <senaryo.txt> [cikti.mp4]
//
// Secenekler:
//   --ses tr-TR-AhmetNeural     erkek (varsayilan) · tr-TR-EmelNeural kadin
//   --hiz +0%                   konusma hizi
//   --orijinal 0.12             orijinal sesin seviyesi (0 = tamamen kapat)
//   --altyazi 0                 altyaziyi gomme
//   --punto 22                  altyazi boyutu
//
// SENARYO DOSYASI: duz metin, paragraflar bos satirla ayrilir.
// Her paragraf bir altyazi blogu ve bir konusma parcasi olur.
//
// ZAMANLAMA: Anlatim videodan kisaysa paragraf aralarina bosluk dagitilir,
// boylece anlatim videonun tamamina yayilir. Uzunsa konusma hizi otomatik
// artirilir. Ikisi de olmazsa uyari verir.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { ffmpeg: FF, ffprobe: FP } = require("./ff-yol.js");

let MsEdgeTTS, OUTPUT_FORMAT;
try { ({ MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts")); }
catch (e) { console.error("msedge-tts yok. Once: npm install"); process.exit(1); }

const argv = process.argv.slice(2);
const bayrak = (a, v) => { const i = argv.indexOf(a); return i >= 0 ? argv[i + 1] : v; };
const konum = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));

// MUTLAK YOL SART: son ffmpeg cagrisi SRT klasorunde calisiyor (Windows
// surucu harfi altyazi filtresini bozdugu icin). Goreli yol orada kirilir.
const VIDEO = konum[0] ? path.resolve(konum[0]) : null;
const SENARYO = konum[1] ? path.resolve(konum[1]) : null;
if (!VIDEO || !SENARYO) {
  console.error("kullanim: node video-seslendir.js <video.mp4> <senaryo.txt> [cikti.mp4]");
  process.exit(1);
}
for (const f of [VIDEO, SENARYO])
  if (!fs.existsSync(f)) { console.error("dosya yok: " + f); process.exit(1); }

const CIKTI = path.resolve(konum[2] || VIDEO.replace(/\.[^.]+$/, "") + " - seslendirilmis.mp4");
const SES = bayrak("--ses", "tr-TR-AhmetNeural");
let HIZ = bayrak("--hiz", "+0%");
const ORIJINAL = Number(bayrak("--orijinal", "0.12"));
const ALTYAZI = bayrak("--altyazi", "1") !== "0";
const PUNTO = Number(bayrak("--punto", "22"));

const TMP = path.join(os.tmpdir(), "video-seslendir-" + Date.now());
fs.mkdirSync(TMP, { recursive: true });

try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}

function run(args, etiket, cwd) {
  try { return execFileSync(FF, ["-y", "-hide_banner", "-loglevel", "error", ...args],
                            { cwd, stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 26 }); }
  catch (e) {
    const err = (e.stderr && e.stderr.toString("utf8")) || e.message || "";
    console.error("\n!! ffmpeg (" + etiket + "):\n" + err.split(/\r?\n/).filter(Boolean).slice(-8).join("\n"));
    throw e;
  }
}
const sure = f => Number(execFileSync(FP,
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

const srtZaman = ms => {
  const h = Math.floor(ms / 3600000), d = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000), x = Math.floor(ms % 1000);
  return `${String(h).padStart(2,"0")}:${String(d).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`;
};

// altyazi satirlarini ~42 karakterde bol
function satirla(metin) {
  const kelimeler = metin.split(/\s+/);
  const satirlar = []; let s = "";
  for (const k of kelimeler) {
    if ((s + " " + k).trim().length > 42) { satirlar.push(s.trim()); s = k; }
    else s = (s + " " + k).trim();
  }
  if (s) satirlar.push(s);
  return satirlar;
}

function seslendir(tts, metin) {
  return new Promise((coz, red) => {
    let r; try { r = tts.toStream(metin, { rate: HIZ }); } catch (e) { return red(e); }
    const c = [];
    r.audioStream.on("data", d => c.push(d));
    r.audioStream.on("end", () => coz(Buffer.concat(c)));
    r.audioStream.on("error", red);
  });
}

(async () => {
  const V_SURE = sure(VIDEO);
  console.log(`video   : ${path.basename(VIDEO)}  ${(V_SURE/60).toFixed(2)} dk`);

  const ham = fs.readFileSync(SENARYO, "utf8").replace(/\r\n/g, "\n");
  const paragraflar = ham.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  if (!paragraflar.length) { console.error("senaryo bos."); process.exit(1); }
  console.log(`senaryo : ${paragraflar.length} paragraf · ${ham.split(/\s+/).filter(Boolean).length} kelime`);
  console.log(`ses     : ${SES}`);

  // --- 1) seslendirme parcalari ---
  const tts = new MsEdgeTTS();
  await tts.setMetadata(SES, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const uret = async () => {
    const parcalar = [];
    for (let i = 0; i < paragraflar.length; i++) {
      let b = null;
      for (let d = 0; d < 3 && !b; d++) {
        try { b = await seslendir(tts, paragraflar[i]); }
        catch (e) { await new Promise(r => setTimeout(r, 1200)); }
      }
      if (!b || !b.length) { console.log(`  !! paragraf ${i+1} seslendirilemedi`); continue; }
      const f = path.join(TMP, String(i).padStart(3, "0") + ".mp3");
      fs.writeFileSync(f, b);
      parcalar.push({ dosya: f, metin: paragraflar[i], sure: sure(f) });
      process.stdout.write(".");
    }
    console.log("");
    return parcalar;
  };

  let parcalar = await uret();
  if (!parcalar.length) { console.error("hic parca uretilemedi."); process.exit(1); }

  // --- 2) zamanlama ---
  // Anlatim videodan uzunsa hizi artirip yeniden uret. Kisaysa aralara
  // bosluk dagit — boylece anlatim videonun tamamina yayilir.
  const KENAR = Math.min(1.5, V_SURE * 0.02);          // basta ve sonda bosluk
  const kullanilabilir = Math.max(1, V_SURE - KENAR * 2);
  let toplam = parcalar.reduce((a, p) => a + p.sure, 0);

  if (toplam > kullanilabilir) {
    const gerekli = toplam / kullanilabilir;
    const yuzde = Math.min(50, Math.ceil((gerekli - 1) * 100) + 3);
    console.log(`anlatim videodan ${(toplam - kullanilabilir).toFixed(1)} sn uzun — hiz +${yuzde}% yapiliyor`);
    HIZ = "+" + yuzde + "%";
    parcalar = await uret();
    toplam = parcalar.reduce((a, p) => a + p.sure, 0);
    if (toplam > kullanilabilir)
      console.log(`  !! hala ${(toplam - kullanilabilir).toFixed(1)} sn uzun — sondan tasacak, senaryoyu kisalt`);
  }

  const bosluk = parcalar.length > 1
    ? Math.max(0, (kullanilabilir - toplam) / (parcalar.length - 1)) : 0;
  console.log(`zamanlama: ${toplam.toFixed(1)} sn anlatim + ${bosluk.toFixed(2)} sn paragraf arasi`);

  // --- 3) sessizlikle birlestirilmis anlatim rayi ---
  const gecikmeler = [];
  let t = KENAR;
  for (const p of parcalar) { gecikmeler.push(t); t += p.sure + bosluk; }

  const girisler = [];
  parcalar.forEach(p => girisler.push("-i", p.dosya));
  const zincir = parcalar
    .map((p, i) => `[${i}:a]adelay=${Math.round(gecikmeler[i] * 1000)}|${Math.round(gecikmeler[i] * 1000)}[a${i}]`)
    .join(";") + ";" + parcalar.map((_, i) => `[a${i}]`).join("") +
    `amix=inputs=${parcalar.length}:duration=longest:normalize=0[mix]`;

  const anlatim = path.join(TMP, "anlatim.wav");
  run([...girisler, "-filter_complex", zincir, "-map", "[mix]",
       "-ar", "48000", "-ac", "2", "-t", String(V_SURE), anlatim], "anlatim birlestirme");

  // --- 4) altyazi ---
  let srt = null;
  if (ALTYAZI) {
    const bloklar = [];
    parcalar.forEach((p, i) => {
      const bas = gecikmeler[i] * 1000, bit = (gecikmeler[i] + p.sure) * 1000;
      const satirlar = satirla(p.metin);
      const parcaSure = (bit - bas) / satirlar.length;
      satirlar.forEach((s, j) => {
        bloklar.push(`${bloklar.length + 1}\n` +
          `${srtZaman(bas + j * parcaSure)} --> ${srtZaman(bas + (j + 1) * parcaSure)}\n${s}\n`);
      });
    });
    srt = path.join(TMP, "altyazi.srt");
    fs.writeFileSync(srt, bloklar.join("\n"), "utf8");
    console.log(`altyazi  : ${bloklar.length} satir`);
  }

  // --- 5) son karisim ---
  // Orijinal ses kisilir (tamamen kapatilmaz — ortam sesi kalsin),
  // anlatim ustune biner. Videoda ses yoksa sadece anlatim kullanilir.
  const sesVar = (() => {
    try {
      return !!execFileSync(FP, ["-v","error","-select_streams","a","-show_entries","stream=index",
                                 "-of","csv=p=0", VIDEO]).toString().trim();
    } catch (e) { return false; }
  })();

  // Altyazi yolu: Windows'ta "C:" ffmpeg filtre sozdiziminde ayirac sayilip
  // "original_size" hatasi veriyor. Cozum: ffmpeg'i SRT'nin klasorunde
  // calistirip sadece dosya adini vermek.
  const vf = [];
  if (srt) {
    vf.push(`subtitles=altyazi.srt:force_style='FontName=Arial,Fontsize=${PUNTO},Bold=1,` +
            `PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=48'`);
  }

  const args = ["-i", VIDEO, "-i", anlatim];
  if (sesVar && ORIJINAL > 0) {
    args.push("-filter_complex",
      `[0:a]volume=${ORIJINAL}[o];[1:a]volume=1.0[n];[o][n]amix=inputs=2:duration=first:normalize=0,` +
      `alimiter=level_in=1:level_out=0.95:limit=0.97,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
      "-map", "0:v", "-map", "[a]");
  } else {
    args.push("-filter_complex",
      `[1:a]alimiter=level_in=1:level_out=0.95:limit=0.97,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
      "-map", "0:v", "-map", "[a]");
  }
  if (vf.length) args.push("-vf", vf.join(","));
  args.push("-c:v", "libx264", "-preset", "medium", "-crf", "19",
            "-c:a", "aac", "-b:a", "192k", "-shortest", CIKTI);

  console.log("son karisim yapiliyor...");
  // ffmpeg SRT klasorunde calisir (Windows surucu harfi filtre sozdizimini bozuyor)
  run(args, "son karisim", TMP);

  const mb = (fs.statSync(CIKTI).size / 1048576).toFixed(1);
  console.log("");
  console.log("=== BITTI ===");
  console.log("  " + CIKTI);
  console.log(`  ${sure(CIKTI).toFixed(1)} sn · ${mb} MB` +
              (sesVar && ORIJINAL > 0 ? ` · orijinal ses %${Math.round(ORIJINAL*100)} seviyede` : " · sadece anlatim"));

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error("HATA: " + e.message); process.exit(1); });
