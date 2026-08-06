// baslik-analiz.js <is>
// vidIQ ile BASLIK PUANLAMA + ANAHTAR KELIME ARASTIRMASI.
// vidIQ'nun gercekten iyi oldugu is bu — senaryo yazmak degil.
//
// TAMAMEN ISTEGE BAGLI. vidIQ anahtari yoksa bu adim atlanir,
// video yine de uretilir. Sadece SEO onerisi almazsin.

const https = require("https");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;
const is = process.argv[2];
if (!is) { console.error("kullanim: node baslik-analiz.js <is-adi>"); process.exit(1); }

const KLASOR = path.join(KOK, "uretim", is);
if (!fs.existsSync(KLASOR)) { console.error("is bulunamadi: " + is); process.exit(1); }

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
  console.log("— vidIQ anahtari yok, baslik analizi atlandi (zorunlu degil).");
  console.log("  Istersen: app.vidiq.com/account/settings/mcp");
  process.exit(0);                       // 0 ile cik: zincir DURMASIN
}

// ---------- minik MCP istemcisi ----------
let OTURUM = null, sayac = 0;
function istek(govde, bildirim) {
  return new Promise((coz, red) => {
    const veri = JSON.stringify(govde);
    const h = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": "Bearer " + ANAHTAR,
      "Content-Length": Buffer.byteLength(veri),
    };
    if (OTURUM) h["Mcp-Session-Id"] = OTURUM;
    const r = https.request({ hostname: "mcp.vidiq.com", path: "/mcp", method: "POST", headers: h }, res => {
      if (res.headers["mcp-session-id"]) OTURUM = res.headers["mcp-session-id"];
      let g = "";
      res.on("data", c => g += c);
      res.on("end", () => {
        if (res.statusCode === 401) return red(new Error("vidIQ anahtari kabul edilmedi"));
        if (bildirim) return coz(null);
        let j = null;
        if (/^\s*\{/.test(g)) { try { j = JSON.parse(g); } catch (e) {} }
        if (!j) for (const s of g.split(/\r?\n/)) {
          const m = s.match(/^data:\s*(\{.*\})\s*$/);
          if (m) { try { const p = JSON.parse(m[1]); if (p.result || p.error) j = p; } catch (e) {} }
        }
        if (!j) return red(new Error("vidIQ yaniti okunamadi"));
        if (j.error) return red(new Error(j.error.message || "vidIQ hatasi"));
        coz(j.result);
      });
    });
    r.on("error", red); r.write(veri); r.end();
  });
}
const cagir = (ad, arg) =>
  istek({ jsonrpc: "2.0", id: ++sayac, method: "tools/call", params: { name: ad, arguments: arg } });

// vidIQ yapisal veriyi `structuredContent`te dondurur;
// `content[0].text` sadece insan icin Markdown ozet — JSON degil.
function icerik(s) {
  if (!s) return null;
  const t = s.content && s.content.find(x => x.type === "text");
  const metin = t ? t.text : "";
  if (s.isError || /^MCP error|Input validation error/i.test(metin))
    throw new Error("vidIQ reddetti: " + metin.replace(/\s+/g, " ").slice(0, 200));
  if (s.structuredContent) return s.structuredContent;
  if (!t) return null;
  try { return JSON.parse(metin); } catch (e) { return metin; }
}

// ---------- ana akis ----------
(async () => {
  let konu = {};
  try { konu = JSON.parse(fs.readFileSync(path.join(KLASOR, "konu.json"), "utf8")); } catch (e) {}
  const baslik = konu.baslik_en || is;
  const notKonu = String(konu._not || "").slice(0, 400);

  await istek({
    jsonrpc: "2.0", id: ++sayac, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "panel", version: "1.0" } },
  });
  await istek({ jsonrpc: "2.0", method: "notifications/initialized" }, true);

  const tur = (konu.aspect === "9:16" || konu.format === "short") ? "short" : "long";
  const satirlar = ["# Başlık & Anahtar Kelime Analizi", "", "İş: " + is, ""];

  // 1) mevcut basligi puanla  (type ZORUNLU: 'long' | 'short')
  console.log("başlık puanlanıyor: " + baslik);
  try {
    const p = icerik(await cagir("vidiq_score_title", { title: baslik, type: tur }));
    const puan = (p && (p.score ?? p.overallScore ?? p.overall_score));
    console.log("  puan: " + (puan !== undefined ? puan : JSON.stringify(p).slice(0, 120)));
    satirlar.push("## Mevcut başlık", "", "**" + baslik + "**", "",
                  "Puan: **" + (puan !== undefined ? puan : "?") + "**", "",
                  "```json", JSON.stringify(p, null, 2).slice(0, 1500), "```", "");
  } catch (e) { console.log("  başlık puanlama olmadı: " + e.message); }

  // 2) alternatif basliklar uret
  console.log("alternatif başlıklar üretiliyor…");
  try {
    // videoId/title/description'dan en az biri sart — baslik + konuyu veriyoruz
    const a = icerik(await cagir("vidiq_generate_titles", {
      title: baslik,
      description: notKonu || undefined,
      type: tur,
      numTitles: 8,
      language: "en",          // videolar tam Ingilizce — basliklar da Ingilizce olsun
    }));
    const liste = Array.isArray(a) ? a : (a && (a.titles || a.suggestions || a.results)) || [];
    if (liste.length) {
      satirlar.push("## Alternatif başlıklar", "");
      for (const t of liste.slice(0, 12)) {
        const metin = typeof t === "string" ? t : (t.title || t.text || JSON.stringify(t));
        const s = typeof t === "object" ? (t.score ?? t.overallScore) : undefined;
        console.log("  " + (s !== undefined ? "[" + s + "] " : "") + metin);
        satirlar.push("- " + (s !== undefined ? "**" + s + "** — " : "") + metin);
      }
      satirlar.push("");
    }
  } catch (e) { console.log("  başlık üretimi olmadı: " + e.message); }

  // 3) anahtar kelime arastirmasi
  // 'keyword' KISA ve GENEL olmali. Cok spesifik tohum ("gave claude 500 einsteins")
  // sifir arama hacmi doner — bu yuzden genelden ozele birkac tohum deniyoruz.
  // Durak listesi GENIS olmali. Dar tutulunca senaryonun en sik kelimeleri
  // "not than" gibi anlamsiz bir tohum uretiyor, vidIQ da anlamsiz tohuma
  // o anki trendi donduruyor (bir bilim videosuna "anime full episode" geldi).
  const DURAK = new Set(("the a an and or of in on to for is are was were be been being how why what when where " +
    "this that these those with without within from into onto over under about across through " +
    "i we you it its it's my your our their them they he she his her him us me " +
    "just now new best top gave asked found here there then than not no nor so but yet " +
    "s did does do done doing did can could would should will shall may might must " +
    "have has had having get gets got make makes made made take takes took " +
    "one two three first second last next each every all any some many much more most " +
    "very only also even still much less least own same other another such both either neither " +
    "because since while during before after again once ever never always often sometimes " +
    "thing things something anything nothing everything way ways lot lots kind sort " +
    "who whom whose which whether if unless until than as at by out up down off " +
    "like likes look looks say says said see sees seen know knows known think thinks " +
    "come comes came go goes went want wants use uses used using").split(/\s+/));
  const sozcuk = m => String(m).toLowerCase().replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/).filter(w => w.length > 2 && !DURAK.has(w) && !/^\d+$/.test(w));

  // TOHUM INGILIZCE BASLIKTAN ALINIR — konu notundan DEGIL.
  // Konu notu Turkce yazilinca ("yapay zekanin...") vidIQ Turkce YouTube
  // tarafini arayip alakasiz kelimeler donduruyordu (risale-i nur, namaz...).
  // Video Ingilizce; etiketler de Ingilizce olmali.
  const TR = /[çğıöşüÇĞİÖŞÜ]/;
  const ingilizceMi = s => s && !TR.test(s);

  const bs = sozcuk(baslik);
  // Senaryodan da kelime cikar — baslik kisa kalirsa yedek olsun
  let senaryoKelime = [];
  try {
    const sen = fs.readFileSync(path.join(KLASOR, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8");
    const say = {};
    for (const w of sozcuk(sen)) say[w] = (say[w] || 0) + 1;
    senaryoKelime = Object.keys(say).sort((a, b) => say[b] - say[a]).slice(0, 6);
  } catch (e) {}

  const tohumlar = [...new Set([
    bs.slice(0, 2).join(" "),                    // basliktan iki kelime
    senaryoKelime.slice(0, 2).join(" "),         // senaryonun en sik iki kelimesi
    bs[0] || "", senaryoKelime[0] || "",         // tek kelime — en genis
    // konu notu SADECE Ingilizce yazilmissa kullanilir
    ingilizceMi(notKonu) ? sozcuk(notKonu).slice(0, 2).join(" ") : "",
  ].filter(t => t && t.length > 2 && ingilizceMi(t)))];

  // Videonun kendi kelime dagarcigi — donen etiketlerin alakasini olcmek icin.
  const dagarcik = new Set([...bs, ...senaryoKelime]);
  try {
    const sen = fs.readFileSync(path.join(KLASOR, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8");
    for (const w of sozcuk(sen)) dagarcik.add(w);
  } catch (e) {}

  // vidIQ anlamsiz tohuma o anki trendi donduruyor. Donen listenin gercekten
  // bu videoyla ilgili olup olmadigini kontrol et: etiketlerin en az ucte biri
  // videonun kelime dagarciginda gecmiyorsa listeyi cope at, sonraki tohumu dene.
  // DIKKAT: tohumun kendi kelimeleri sayilmamali. Yoksa "material" tohumu
  // Madonna'nin "Material Girl" listesini gecirir — her satirda "material"
  // gectigi icin alakali sanilir. Tohum disinda ortak kelime aranir.
  // Bunlar hemen her senaryoda gecer, dolayisiyla ALAKA KANITI SAYILMAZ.
  // "material world" ornegi: Madonna sarkisi listesi sirf "world" gectigi
  // icin alakali sanildi. Kanit, konuya ozgu bir kelime olmali.
  const COKGENEL = new Set(("world people person time times life live living day days year years " +
    "man men woman women boy girl home house work money god war story full episode official " +
    "video trailer lyrics song music tiktok shorts funny reaction vlog channel subscribe " +
    "part place point number thing name today tomorrow yesterday history future past").split(/\s+/));

  const alakali = (liste, tohum) => {
    const metin = liste.map(x => (x && (x.keyword || x.query || x.text || x.name)) || String(x));
    if (!metin.length) return false;
    const tohumKel = new Set(sozcuk(tohum));
    const kanit = t => sozcuk(t).some(w =>
      !tohumKel.has(w) && !COKGENEL.has(w) && dagarcik.has(w));
    const tutan = metin.filter(kanit).length;
    return tutan / metin.length >= 0.34;
  };

  let kl = [], kullanilanTohum = null;
  for (const tohum of tohumlar) {
    console.log("anahtar kelimeler araştırılıyor: \"" + tohum + "\"");
    try {
      const k = icerik(await cagir("vidiq_keyword_research", {
        mode: "research", keyword: tohum, includeRelated: true,
      }));
      const bulunan = Array.isArray(k) ? k
        : (k && (k.relatedKeywords || k.keywords || k.results)) || [];
      if (bulunan.length && !alakali(bulunan, tohum)) {
        console.log("  " + bulunan.length + " kelime döndü ama konuyla alakasız — atlandı");
        continue;
      }
      if (bulunan.length) { kl = bulunan; kullanilanTohum = tohum; break; }
      console.log("  sonuç yok, daha genel tohum deneniyor…");
    } catch (e) { console.log("  olmadı: " + e.message.slice(0, 80)); }
  }
  if (!kl.length) console.log("anahtar kelime bulunamadı — etiketleri elle yaz.");

  try {
    if (kullanilanTohum) satirlar.push("_Arama tohumu: **" + kullanilanTohum + "**_", "");
    if (kl.length) {
      satirlar.push("## Anahtar kelimeler", "", "| Kelime | Arama | Rekabet | Skor |", "|---|---|---|---|");
      for (const w of kl.slice(0, 25)) {
        const ad = w.keyword || w.term || w.text || String(w);
        satirlar.push("| " + ad + " | " + (w.searchVolume ?? w.volume ?? "-") +
                      " | " + (w.competition ?? "-") + " | " + (w.score ?? w.overallScore ?? "-") + " |");
      }
      satirlar.push("");
      console.log("  " + kl.length + " kelime bulundu");
      // etiket satiri olarak da yaz — YouTube'a dogrudan yapistirilir
      satirlar.push("### Etiketler (YouTube'a yapıştır)", "",
        "```", kl.slice(0, 20).map(w => w.keyword || w.term || w.text).filter(Boolean).join(", "), "```", "");
    }
  } catch (e) { console.log("  kelime araştırması olmadı: " + e.message); }

  const cikti = path.join(KLASOR, "BASLIK-VE-ETIKETLER.md");
  fs.writeFileSync(cikti, satirlar.join("\n"), "utf8");
  console.log("");
  console.log("✓ BASLIK-VE-ETIKETLER.md yazıldı");
})().catch(e => {
  // vidIQ hatasi videoyu DURDURMAZ — bu adim zorunlu degil
  console.log("— başlık analizi yapılamadı: " + e.message);
  console.log("  (video üretimi bundan etkilenmez)");
  process.exit(0);
});
