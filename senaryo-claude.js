// senaryo-claude.js <is>
// Konudan seslendirme metnini Claude API ile yazar.
// Anahtar: .env icindeki ANTHROPIC_API_KEY
//   -> console.anthropic.com/settings/keys adresinden alinir
//
// 15 dakikalik video ~2265 kelime eder. Claude tek seferde yazabiliyor,
// vidIQ'daki gibi parca parca uzatmaya gerek yok.

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;
const URETIM = path.join(KOK, "uretim");
const is = process.argv[2];
if (!is) { console.error("kullanim: node senaryo-claude.js <is-adi>"); process.exit(1); }

const KLASOR = path.join(URETIM, is);
if (!fs.existsSync(KLASOR)) { console.error("is bulunamadi: " + is); process.exit(1); }

// ---------- .env ----------
function env(ad) {
  try {
    for (const l of fs.readFileSync(path.join(KOK, ".env"), "utf8").split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === ad) return m[2].trim();
    }
  } catch (e) {}
  return "";
}

const ANAHTAR = env("ANTHROPIC_API_KEY") || process.env.ANTHROPIC_API_KEY;
if (!ANAHTAR) {
  console.error("✗ ANTHROPIC_API_KEY yok.");
  console.error("  Panel > Kaynaklar sekmesine yapistir.");
  console.error("  Anahtari buradan al: https://console.anthropic.com/settings/keys");
  process.exit(1);
}

const kelimeSay = s => s.split(/\s+/).filter(Boolean).length;

// ---------- ciktiyi temizle: sadece seslendirilecek metin ----------
function temizle(ham) {
  return String(ham)
    .replace(/\r/g, "")
    .replace(/^\s*[\[(][^\])\n]{0,120}[\])]\s*$/gm, "")     // [B-ROLL: ...] gibi yonergeler
    .replace(/^#{1,6}\s.*$/gm, "")                           // ## Basliklar
    .replace(/^\s*\**\s*(?:title|baslik)\s*:.*$/gim, "")
    .replace(/^\s*(?:HOOK|INTRO|OUTRO|SECTION|PART|CTA|CONCLUSION)\s*\d*\s*[:\-—]?\s*$/gim, "")
    .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*[-—:]?\s*/gm, "")
    .replace(/^\s*(?:NARRATOR|VOICEOVER|VO|HOST)\s*[:\-]\s*/gim, "")
    .replace(/\*\*/g, "").replace(/[*_`]/g, "")
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(p => p.length > 25)
    .join("\n\n")
    .trim();
}

// ---------- ana akis ----------
(async () => {
  let konu = {};
  try { konu = JSON.parse(fs.readFileSync(path.join(KLASOR, "konu.json"), "utf8")); } catch (e) {}

  const baslik = konu.baslik_en || is;
  const notKonu = String(konu._not || "").trim();
  // Sure tek kaynaktan gelir: konu.json > hedefSaniye (kullanici belirler).
  const dikey = konu.aspect === "9:16";
  const hedefSn = konu.hedefSaniye || (konu.hedefDakika ? konu.hedefDakika * 60 : (dikey ? 40 : 900));
  const hedefDk = hedefSn / 60;
  const kisa = hedefSn <= 60;                       // sert kelime tavani sadece burada
  const kelimeHiz = kisa ? 137 : 151;
  const hedefKelime = Math.round(hedefSn / 60 * kelimeHiz);

  if (!notKonu) {
    console.error("✗ Konu yazilmamis (konu.json > _not bos).");
    console.error("  Panelde 'Ne istiyorsun?' kutusunu doldur.");
    process.exit(1);
  }

  console.log("konu    : " + notKonu.slice(0, 100));
  console.log("baslik  : " + baslik);
  const formatAd = konu.format === "reels" ? "Instagram Reels"
                 : konu.format === "short" ? "YouTube Shorts" : "YouTube uzun video";
  console.log("hedef   : " + formatAd + " · " +
    (hedefSn < 60 ? hedefSn + " sn" : hedefDk.toFixed(1) + " dk") + " (~" + hedefKelime + " kelime)");
  console.log("model   : claude-opus-5");
  console.log("");

  const client = new Anthropic({ apiKey: ANAHTAR });

  const sistem = [
    "You write narration scripts for faceless documentary videos.",
    "",
    "The text you produce is read aloud by a text-to-speech voice over still images.",
    "There is no presenter and no camera. Therefore:",
    "- Output ONLY the spoken words. Nothing else.",
    "- No scene headings, no [B-ROLL] notes, no timestamps, no speaker labels,",
    "  no markdown headers, no bold, no bullet points, no stage directions.",
    "- Plain paragraphs separated by a blank line. Each paragraph is one scene.",
    "- Write ENTIRELY IN ENGLISH.",
    "",
    "Craft rules:",
    "- Open with a concrete hook in the first two sentences — a specific image,",
    "  number, or tension. Never open with 'In this video' or 'Have you ever'.",
    "- Every claim must be true. If something is contested, say so plainly.",
    "  Never invent studies, quotes, people, or events.",
    "- Prefer specifics over adjectives: numbers, names, dates, mechanisms.",
    "- Vary sentence length. Short sentences land hard; use them at turns.",
    "- Sentences must be easy to read aloud. No parentheses, no semicolons,",
    "  no abbreviations the voice would mangle. Write numbers as words when spoken",
    "  naturally ('two thousand' not '2,000') unless it is a year.",
    "- End on an idea, not a summary. No 'in conclusion'.",
  ].join("\n");

  const istek = kisa
    ? [
        "Write a YouTube Shorts narration script.",
        "",
        "TOPIC: " + notKonu,
        "TITLE: " + baslik,
        "",
        "HARD LIMIT: about " + hedefKelime + " words TOTAL. This is a strict ceiling —",
        "the video must stay under " + hedefSn + " seconds. Count your words.",
        "Structure: hook (1 sentence) → the substance (2-3 sentences) → a turn that",
        "makes the viewer sit up (1 sentence). Three short paragraphs.",
      ].join("\n")
    : [
        "Write a long-form documentary narration script.",
        "",
        "TOPIC: " + notKonu,
        "TITLE: " + baslik,
        "",
        "LENGTH: " + hedefKelime + " words MINIMUM. This is the single most important",
        "requirement — the video must run " + hedefDk.toFixed(1) + " minutes. A shorter script is a",
        "failed script. Write the full length; do not summarise, do not stop early,",
        "do not write an outline.",
        "",
        "Structure it as roughly " + Math.round(hedefKelime / 160) + " paragraphs, each a distinct scene that",
        "moves the argument forward. Go deep: origins and background, then the",
        "mechanism and concrete specifics, then consequences and honest objections,",
        "then where it leads. Bring real detail — names, numbers, dates, examples.",
        "",
        "Write the whole script now, start to finish.",
      ].join("\n");

  process.stdout.write("Claude yaziyor");
  let ham = "";
  const akis = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 32000,
    system: sistem,
    output_config: { effort: "high" },
    messages: [{ role: "user", content: istek }],
  });

  let nokta = 0;
  akis.on("text", t => {
    ham += t;
    if (++nokta % 40 === 0) process.stdout.write(".");
  });

  const sonuc = await akis.finalMessage();
  console.log("");

  if (sonuc.stop_reason === "refusal") {
    throw new Error("Claude bu konuyu reddetti. Konuyu farkli ifade edip tekrar dene.");
  }
  if (sonuc.stop_reason === "max_tokens") {
    console.log("  ⚠ metin token sinirinda kesildi — yine de yazilacak");
  }

  let metin = temizle(ham);
  if (!metin || kelimeSay(metin) < 20) throw new Error("Bos senaryo dondu.");

  const k = kelimeSay(metin);
  const sn = Math.round((k / 151) * 60);

  if (!kisa && k < hedefKelime * 0.8) {
    throw new Error("Senaryo " + k + " kelimede kaldi (~" + (sn / 60).toFixed(1) + " dk), hedef " +
      hedefDk.toFixed(1) + " dk. Konuyu biraz daha ayrintili yazip tekrar dene.");
  }

  const sesDizin = path.join(KLASOR, "Voice");
  fs.mkdirSync(sesDizin, { recursive: true });
  const hedefDosya = path.join(sesDizin, "SESLENDIRME-TAM-METIN.txt");
  if (fs.existsSync(hedefDosya) && fs.readFileSync(hedefDosya, "utf8").trim())
    fs.copyFileSync(hedefDosya, hedefDosya.replace(/\.txt$/, "-onceki.txt"));
  fs.writeFileSync(hedefDosya, metin + "\n", "utf8");

  const u = sonuc.usage || {};
  const maliyet = ((u.input_tokens || 0) / 1e6 * 5) + ((u.output_tokens || 0) / 1e6 * 25);

  console.log("");
  console.log("✓ senaryo yazildi: Voice/SESLENDIRME-TAM-METIN.txt");
  console.log("  " + k + " kelime · ~" + Math.floor(sn / 60) + " dk " + (sn % 60) + " sn · " +
              metin.split(/\n\s*\n/).length + " paragraf");
  console.log("  maliyet: ~$" + maliyet.toFixed(3));
  if (sn > hedefSn * 1.15) console.log("  ⚠ hedefi asiyor (" + hedefSn + " sn) — kisalt");
  if (konu.format === "reels" && sn > 180)
    console.log("  ⓘ 3 dakikayi asiyor: Instagram bunu takipcin olmayanlara onermez.");
})().catch(e => {
  console.error("✗ " + (e.status === 401 ? "ANTHROPIC_API_KEY gecersiz." : e.message));
  process.exit(1);
});
