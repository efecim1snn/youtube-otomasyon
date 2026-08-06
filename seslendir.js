// Seslendirme + altyazi (SRT) uretici — Microsoft Edge neural sesleri, BEDAVA, anahtar yok
// Kullanim: node seslendir.js <is-klasoru>
"use strict";
const fs = require("fs");
const path = require("path");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const JOB = process.argv[2] || "001-time-travel";
const BASE = path.join(__dirname, "uretim", JOB);

// Ses ve hiz konu.json'dan okunur; komut satiri onu ezer.
// Boylece zincir (panel) Turkce videoda Turkce sesi kendiliginden kullanir.
//   "ses": "tr-TR-AhmetNeural"   (Turkce erkek)
//   "ses": "tr-TR-EmelNeural"    (Turkce kadin)
//   "sesHizi": "+7%"
let K_SES = null, K_HIZ = null;
try {
  const k = JSON.parse(fs.readFileSync(path.join(BASE, "konu.json"), "utf8"));
  if (k.ses) K_SES = k.ses;
  if (k.sesHizi) K_HIZ = k.sesHizi;
} catch (e) {}

const VOICE = process.argv[3] || K_SES || "en-US-ChristopherNeural";
const RATE = process.argv[4] || K_HIZ || "+7%";   // Osman'in istegi: -10%'dan %19 daha akici

const VOICE_DIR = path.join(BASE, "Voice");
const PARTS = path.join(VOICE_DIR, "parts");
const TXT = path.join(VOICE_DIR, "SESLENDIRME-TAM-METIN.txt");

function srtTime(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000), x = Math.floor(ms % 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`;
}

function synth(tts, text) {
  return new Promise((resolve, reject) => {
    const words = [];
    const chunks = [];
    let res;
    try {
      res = tts.toStream(text, { rate: RATE });
    } catch (e) { return reject(e); }
    const { audioStream, metadataStream } = res;
    if (!audioStream) return reject(new Error("audioStream yok"));

    if (metadataStream) metadataStream.on("data", d => {
      try {
        // msedge-tts metadatayi Buffer olarak yolluyor (string degil).
        // Buffer'i cozmeden JSON.parse atlanirsa kelime zamanlari HIC yakalanmaz.
        const obj = Buffer.isBuffer(d) ? JSON.parse(d.toString("utf8"))
                  : typeof d === "string" ? JSON.parse(d)
                  : d;
        const list = obj.Metadata || (Array.isArray(obj) ? obj : [obj]);
        for (const m of list) {
          if (m.Type === "WordBoundary" && m.Data) {
            words.push({
              t: m.Data.Offset / 10000,               // 100ns -> ms
              d: (m.Data.Duration || 0) / 10000,
              w: (m.Data.text && m.Data.text.Text) || ""
            });
          }
        }
      } catch (e) { /* yoksay */ }
    });

    audioStream.on("data", c => chunks.push(c));
    audioStream.on("end", () => resolve({ buf: Buffer.concat(chunks), words }));
    audioStream.on("error", reject);
  });
}

(async () => {
  fs.mkdirSync(PARTS, { recursive: true });
  const raw = fs.readFileSync(TXT, "utf8").replace(/\r\n/g, "\n");
  const paras = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  console.log(`${paras.length} paragraf, ses: ${VOICE}, hiz: ${RATE}`);

  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: true,
    sentenceBoundaryEnabled: false,
  });

  const allWords = [];
  const fileList = [];
  let offset = 0;

  for (let i = 0; i < paras.length; i++) {
    let out = null;
    for (let a = 0; a < 3 && !out; a++) {
      try { out = await synth(tts, paras[i]); }
      catch (e) { console.log(`  ! ${i+1} deneme ${a+1} hata: ${e.message}`); await new Promise(r => setTimeout(r, 1500)); }
    }
    if (!out || !out.buf.length) { console.log(`  !! paragraf ${i+1} atlandi`); continue; }

    const f = path.join(PARTS, String(i).padStart(3, "0") + ".mp3");
    fs.writeFileSync(f, out.buf);
    fileList.push(f);

    let last = 0;
    for (const w of out.words) { allWords.push({ t: offset + w.t, d: w.d, w: w.w }); last = Math.max(last, w.t + w.d); }
    offset += last + 350;   // paragraf arasi nefes payi
    process.stdout.write(".");
  }

  console.log(`\n${fileList.length} parca uretildi, tahmini sure: ${(offset/60000).toFixed(1)} dk`);

  // ffmpeg concat listesi
  const listFile = path.join(PARTS, "list.txt");
  fs.writeFileSync(listFile, fileList.map(f => "file '" + f.replace(/\\/g, "/") + "'").join("\n"), "utf8");

  // SRT — kelimeleri satirlara grupla
  const lines = [];
  let cur = [];
  for (const w of allWords) {
    cur.push(w);
    const text = cur.map(x => x.w).join(" ");
    const endsSentence = /[.!?]$/.test(w.w);
    if (text.length >= 38 || endsSentence || cur.length >= 9) {
      lines.push({ start: cur[0].t, end: w.t + w.d, text: text.trim() });
      cur = [];
    }
  }
  if (cur.length) lines.push({ start: cur[0].t, end: cur[cur.length-1].t + cur[cur.length-1].d, text: cur.map(x=>x.w).join(" ").trim() });

  const srt = lines.map((l, i) =>
    `${i+1}\n${srtTime(l.start)} --> ${srtTime(Math.max(l.end, l.start+700))}\n${l.text}\n`
  ).join("\n");
  fs.writeFileSync(path.join(VOICE_DIR, "altyazi.srt"), srt, "utf8");

  console.log(`SRT: ${lines.length} altyazi satiri`);
  console.log("Sonraki: ffmpeg ile parcalari birlestir");
})();
