// senaryo-yaz.js <is>
// Konudan seslendirme metnini URETIR. vidIQ MCP sunucusunu kullanir.
// Anahtar: .env icindeki VIDIQ_KEY  (panel > Kaynaklar sekmesinden girilir)
// Sifir bagimlilik — sadece node built-in.

const https = require("https");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;
const URETIM = path.join(KOK, "uretim");
const is = process.argv[2];
if (!is) { console.error("kullanim: node senaryo-yaz.js <is-adi>"); process.exit(1); }

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

const ANAHTAR = env("VIDIQ_KEY");
if (!ANAHTAR) {
  console.error("✗ VIDIQ_KEY yok.");
  console.error("  Panel > Kaynaklar sekmesine vidIQ anahtarini yapistir.");
  console.error("  Anahtari buradan al: https://app.vidiq.com/account/settings/mcp");
  process.exit(1);
}

// ---------- minik MCP istemcisi (streamable HTTP) ----------
let OTURUM = null;
let sayac = 0;

function istek(govde, bildirim) {
  return new Promise((coz, red) => {
    const veri = JSON.stringify(govde);
    const basliklar = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": "Bearer " + ANAHTAR,
      "Content-Length": Buffer.byteLength(veri),
    };
    if (OTURUM) basliklar["Mcp-Session-Id"] = OTURUM;

    const r = https.request({
      hostname: "mcp.vidiq.com", path: "/mcp", method: "POST", headers: basliklar,
    }, res => {
      const sid = res.headers["mcp-session-id"];
      if (sid) OTURUM = sid;
      let g = "";
      res.on("data", c => g += c);
      res.on("end", () => {
        if (res.statusCode === 401 || res.statusCode === 403)
          return red(new Error("vidIQ anahtari kabul edilmedi (" + res.statusCode + "). Anahtari kontrol et."));
        if (bildirim) return coz(null);
        if (res.statusCode >= 400) return red(new Error("vidIQ HTTP " + res.statusCode + ": " + g.slice(0, 200)));

        // yanit ya duz JSON ya da SSE ("data: {...}") olabilir
        let j = null;
        if (/^\s*\{/.test(g)) { try { j = JSON.parse(g); } catch (e) {} }
        if (!j) {
          for (const satir of g.split(/\r?\n/)) {
            const m = satir.match(/^data:\s*(\{.*\})\s*$/);
            if (m) { try { const p = JSON.parse(m[1]); if (p.result || p.error) j = p; } catch (e) {} }
          }
        }
        if (!j) return red(new Error("vidIQ yaniti okunamadi: " + g.slice(0, 200)));
        if (j.error) return red(new Error("vidIQ: " + (j.error.message || JSON.stringify(j.error))));
        coz(j.result);
      });
    });
    r.on("error", red);
    r.write(veri);
    r.end();
  });
}

const cagir = (ad, arg) =>
  istek({ jsonrpc: "2.0", id: ++sayac, method: "tools/call", params: { name: ad, arguments: arg } });

// vidIQ araclari sonucu metin icerigi olarak dondurur; JSON'u cikar
function icerik(sonuc) {
  if (!sonuc) return null;
  const t = sonuc.content && sonuc.content.find(x => x.type === "text");
  if (!t) return null;
  try { return JSON.parse(t.text); } catch (e) { return t.text; }
}

const bekle = ms => new Promise(r => setTimeout(r, ms));

// ---------- senaryoyu temizle: sadece seslendirilecek metin kalsin ----------
function temizle(ham) {
  let s = String(ham);

  // JSON geldiyse metin alanini bul
  if (typeof ham === "object" && ham) {
    s = ham.script || ham.text || ham.content || ham.body || JSON.stringify(ham);
  }

  return s
    .replace(/\r/g, "")
    // [B-ROLL: ...], (pause), [VISUAL: ...] gibi yonergeler
    .replace(/^\s*[\[(][^\])\n]{0,120}[\])]\s*$/gm, "")
    .replace(/[\[(](?:b-?roll|visual|cut to|sfx|music|pause|beat|on screen|graphic|text)[^\])\n]*[\])]/gi, "")
    // ## Basliklar, **kalin**, markdown
    .replace(/^#{1,6}\s.*$/gm, "")
    // "**Title: ...**" satiri — ** temizlendikten sonra kaliyordu
    .replace(/^\s*\**\s*(?:title|baslik|video title)\s*:.*$/gim, "")
    .replace(/^\s*(?:HOOK|INTRO|OUTRO|BODY|SECTION|PART|SEGMENT|CTA|CONCLUSION)\s*\d*\s*[:\-—]?\s*$/gim, "")
    // 00:15 gibi zaman damgalari
    .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*[-—:]?\s*/gm, "")
    .replace(/^\s*(?:NARRATOR|VOICEOVER|VO|HOST)\s*[:\-]\s*/gim, "")
    .replace(/\*\*/g, "").replace(/[*_`]/g, "")
    .replace(/^\s*[-–—>]\s+/gm, "")
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(p => p.length > 25)
    .join("\n\n")
    .trim();
}

function kelimeSay(s) { return s.split(/\s+/).filter(Boolean).length; }

// Shorts icin sert kirp: 45 sn = ~95 kelime (olculen ~137 kel/dk kisa cumlelerde)
function shortsKirp(metin, hedef) {
  const cumleler = metin.replace(/\n+/g, " ").match(/[^.!?]+[.!?]+/g) || [metin];
  const alinan = [];
  let n = 0;
  for (const c of cumleler) {
    const k = kelimeSay(c);
    if (n + k > hedef) {
      // cok kisa kalmisssak son cumleyi yine de al (45 sn butcesi 105 kelimeye kadar guvenli)
      if (n < hedef * 0.7 && n + k <= hedef * 1.1) { alinan.push(c.trim()); n += k; }
      break;
    }
    alinan.push(c.trim()); n += k;
  }
  if (!alinan.length) alinan.push(cumleler[0].trim());
  // 3 paragrafa bol (altyazi ritmi icin)
  const par = Math.max(1, Math.ceil(alinan.length / 3));
  const cikti = [];
  for (let i = 0; i < alinan.length; i += par) cikti.push(alinan.slice(i, i + par).join(" "));
  return cikti.join("\n\n");
}

// ---------- ana akis ----------
(async () => {
  let konu = {};
  try { konu = JSON.parse(fs.readFileSync(path.join(KLASOR, "konu.json"), "utf8")); } catch (e) {}

  const baslik = konu.baslik_en || is;
  const notKonu = (konu._not || "").replace(/^Konu:\s*/i, "").replace(/^Nis:\s*/i, "").trim();
  const kisa = konu.aspect === "9:16" || konu.format === "short";
  const hedefDk = Math.max(1, konu.hedefDakika || 12);
  // OLCULEN: vidIQ istenen dakikanin ~1.55 kati metin yaziyor
  // (3 dk istendi -> 716 kelime = 4.7 dk @151 kel/dk). O yuzden bolerek istiyoruz.
  const dakika = kisa ? 1 : Math.min(60, Math.max(1, Math.round(hedefDk / 1.55)));

  if (!notKonu) {
    console.error("✗ Konu yazilmamis. konu.json icindeki \"_not\" alani bos.");
    console.error("  Panelde yeni video olustururken 'Konu' kutusunu doldur.");
    process.exit(1);
  }

  console.log("konu    : " + notKonu.slice(0, 90));
  console.log("baslik  : " + baslik);
  console.log("format  : " + (kisa ? "Shorts (<=45 sn)" : "hedef ~" + hedefDk + " dk (vidIQ'dan " + dakika + " isteniyor)"));
  console.log("vidIQ'ya gonderiliyor…");

  await istek({
    jsonrpc: "2.0", id: ++sayac, method: "initialize",
    params: {
      protocolVersion: "2024-11-05", capabilities: {},
      clientInfo: { name: "otomasyon-paneli", version: "1.0" },
    },
  });
  await istek({ jsonrpc: "2.0", method: "notifications/initialized" }, true);

  const gonder = await cagir("vidiq_generate_script", {
    topic: notKonu,
    title: baslik,
    concept: (konu.aciklamaBrief ||
      "Faceless, narration-only video. No presenter, no talking head, no camera directions. " +
      "Spoken narration ONLY — it will be read aloud by a text-to-speech voice over still images. " +
      "Do not write scene headings, b-roll notes, timestamps or speaker labels. " +
      "Plain paragraphs of spoken English, separated by blank lines.") +
      (kisa ? " Very short: under 40 seconds of speech, roughly 90 words total." : ""),
    research: konu.arastirma || notKonu,
    lengthMinutes: dakika,
    tone: konu.ton || "cinematic documentary, measured, no hype",
  });

  const g = icerik(gonder);
  const isId = g && (g.mcpJobId || g.jobId);
  let ham = null;

  if (isId) {
    console.log("is kuyrukta: " + isId);
    for (let i = 0; i < 90; i++) {
      await bekle(4000);
      const d = icerik(await cagir("vidiq_job_poll", { mcpJobId: isId }));
      if (!d) continue;
      if (d.status === "completed") { ham = d.result; break; }
      if (d.status === "failed" || d.status === "expired")
        throw new Error("vidIQ uretimi basarisiz (" + (d.errorCode || d.status) + "). Krediler iade edildi.");
      if (i % 5 === 0) console.log("  … uretiliyor (" + ((i + 1) * 4) + " sn)");
    }
    if (!ham) throw new Error("vidIQ 6 dakikada bitmedi — tekrar dene.");
  } else {
    ham = g;
  }

  let metin = temizle(ham);
  if (!metin || kelimeSay(metin) < 20) throw new Error("vidIQ bos senaryo dondurdu.");

  if (kisa) metin = shortsKirp(metin, 95);

  const k = kelimeSay(metin);
  const sn = Math.round((k / 151) * 60);

  const sesDizin = path.join(KLASOR, "Voice");
  fs.mkdirSync(sesDizin, { recursive: true });
  const hedef = path.join(sesDizin, "SESLENDIRME-TAM-METIN.txt");

  // eskisini ezmeden once yedekle
  if (fs.existsSync(hedef) && fs.readFileSync(hedef, "utf8").trim())
    fs.copyFileSync(hedef, hedef.replace(/\.txt$/, "-onceki.txt"));

  fs.writeFileSync(hedef, metin + "\n", "utf8");
  fs.writeFileSync(path.join(sesDizin, "SENARYO-HAM-VIDIQ.txt"),
    typeof ham === "string" ? ham : JSON.stringify(ham, null, 2), "utf8");

  console.log("");
  console.log("✓ senaryo yazildi: Voice/SESLENDIRME-TAM-METIN.txt");
  console.log("  " + k + " kelime · ~" + Math.floor(sn / 60) + " dk " + (sn % 60) + " sn");
  console.log("  " + metin.split(/\n\s*\n/).length + " paragraf");
  if (kisa && sn > 45) console.log("  ⚠ 45 saniyeyi asiyor — kisalt");
})().catch(e => { console.error("✗ " + e.message); process.exit(1); });
