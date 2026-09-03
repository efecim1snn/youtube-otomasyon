// TREND ARAMA — YouTube + Instagram + TikTok, tek raporda.
//
// Kullanim:
//   node trend-ara.js "konu"                 ucu birden
//   node trend-ara.js "konu" --dil tr        Turkce icerik
//   node trend-ara.js "konu" --min 500000    izlenme esigi
//   node trend-ara.js "konu" --platform yt   sadece YouTube (yt | ig | tt)
//   node trend-ara.js "konu" --siki         YouTube'da tum kelimeler gecsin
//   node trend-ara.js                        konu vermeden genel trend
//
// Cikti: trend/<tarih>-<konu>.md
//
// YouTube tarafi HIZ olcer (saatlik izlenme) — su an ne patliyor.
// Instagram/TikTok tarafi ASIRI PERFORMANS olcer — hesabin kendi ortalamasini
// kac kat asmis. Ikisi ayni sey degil, o yuzden ayri bolumlerde duruyor.
"use strict";
const https = require("https");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;
const argv = process.argv.slice(2);
const bayrak = (a, v) => { const i = argv.indexOf(a); return i >= 0 ? argv[i + 1] : v; };
const KONU = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--"))) || "";
const DIL = bayrak("--dil", "en");
const ESIK = Number(bayrak("--min", "200000"));      // Instagram/TikTok izlenme esigi
// YouTube trending TAZE videoya bakar; toplam izlenme esigi koymak yanlis.
// Saatte 2800 izlenme alan yeni bir video 500 bine henuz ulasmamis olur ve
// esige takilip listeden dusuyordu. Trendde olculen sey HIZ.
const VPH = Number(bayrak("--vph", "150"));           // YouTube saatlik izlenme esigi
const PLATFORM = bayrak("--platform", "hepsi");
// --siki : YouTube tarafinda basligin TUM kelimeleri gecsin. Anlamsal arama
// gevsek oldugu icin "animal comparison" sorgusuna Godzilla ve anime
// karsilastirmalari da geliyordu. Dar konularda bunu ac.
const SIKI = argv.includes("--siki");

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
  console.log("- vidIQ anahtari yok. Panel > Kaynaklar sekmesinden ekle:");
  console.log("  app.vidiq.com/account/settings/mcp");
  process.exit(0);
}

// ---------- MCP istemcisi ----------
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

// Yapisal veri structuredContent'te durur; content[0].text insan icin ozet.
const yapisal = s => (s && s.structuredContent) || null;
function metin(s) {
  const t = s && s.content && s.content.find(x => x.type === "text");
  return t ? t.text : "";
}

const bicim = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
              : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n || 0);
const ortanca = a => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

(async () => {
  await istek({
    jsonrpc: "2.0", id: ++sayac, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "trend-ara", version: "1.0" } },
  });
  await istek({ jsonrpc: "2.0", method: "notifications/initialized" }, true);

  const satir = [], y = s => satir.push(s);
  y("# Trend Arama" + (KONU ? " - " + KONU : ""));
  y("");
  y(`Tarih: ${new Date().toISOString().slice(0, 10)} - Dil: ${DIL}`);
  y(`YouTube esigi: ${VPH} izlenme/saat - Instagram/TikTok esigi: ${bicim(ESIK)}+ izlenme`);
  y("");

  const yap = PLATFORM === "hepsi" || PLATFORM === "yt";
  const sos = PLATFORM === "hepsi" || PLATFORM === "ig" || PLATFORM === "tt";

  // ================= YOUTUBE =================
  if (yap) for (const [etiket, format] of [["Shorts", "short"], ["Uzun video", "long"]]) {
    process.stdout.write(`YouTube ${etiket} araniyor... `);
    try {
      const arg = { videoFormat: format, limit: 12, sortBy: "vph", vphMin: VPH };
      if (KONU) { arg.titleQuery = KONU; arg.requireAllTitleTerms = SIKI; }
      arg.videoTitleLanguage = DIL;
      const d = yapisal(await cagir("vidiq_trending_videos", arg));
      const v = (d && d.videos) || [];
      console.log(v.length + " video");
      if (!v.length) {
        // Sessiz bosluk birakmak yerine NEDEN bos oldugunu yaz.
        y("## YouTube - " + etiket);
        y("");
        y("Bu esikte sonuc yok. Su anda " + DIL + " dilinde, saatte " + VPH +
          "+ izlenme alan" + (KONU ? " ve \"" + KONU + "\" ile ilgili" : "") +
          " trend video bulunamadi.");
        y("");
        y("Deneyebilecekleri:");
        y("- esigi dusur: `--vph 50`");
        y("- konuyu genellestir ya da bos birak");
        y("- dili degistir: `--dil tr`");
        y("");
        continue;
      }

      y(`## YouTube - ${etiket}`);
      y("");
      const sureler = v.map(x => x.videoDuration).filter(Boolean);
      const abone = v.map(x => x.subscriberCount).filter(n => n > 0);
      if (sureler.length && abone.length) {
        y(`Ortanca sure **${ortanca(sureler)} sn** - en kucuk kanal **${bicim(Math.min(...abone))} abone**`);
        y("");
      }
      y("| izlenme | izl/saat | sure | abone | video |");
      y("|---|---|---|---|---|");
      for (const x of v) {
        const b = String(x.videoTitle || "").replace(/\|/g, "/").slice(0, 56);
        y(`| ${bicim(x.viewCount)} | ${Math.round(x.vph || 0)} | ${x.videoDuration}sn | ` +
          `${bicim(x.subscriberCount)} | [${b}](https://youtube.com/watch?v=${x.videoId}) |`);
      }
      y("");
    } catch (e) { console.log("olmadi: " + String(e.message).slice(0, 70)); }
  }

  // ================= INSTAGRAM + TIKTOK =================
  if (sos) {
    process.stdout.write("Instagram + TikTok araniyor... ");
    try {
      const bolge = DIL === "tr" ? "Turkey/Turkish" : "Global/English";
      const kuresel = DIL === "tr" ? "false" : "true";
      const kitle = `Culture/Region: ${bolge}; Global: ${kuresel}; ` +
                    `Demographics: general audience interested in ${KONU || "trending short video content"};`;
      const arg = {
        query: KONU || "trending short form video",
        audienceQuery: kitle,
        resultsPerPlatform: 6,
        viewsMin: ESIK,
      };
      if (DIL !== "en") arg.descriptionLanguage = [DIL];
      const s = await cagir("vidiq_instagram_tiktok_outlier_search", arg);
      const ozet = metin(s);
      console.log(ozet ? "geldi" : "bos");
      if (ozet) {
        // Bu arac zaten zengin bir Markdown ozet donduruyor: ilk uc saniye,
        // format, emek ve ses karisimi analizi dahil. Yeniden bicimlemek
        // bilgi kaybettirir, oldugu gibi koyuyoruz (basliklari bir kademe indirip).
        y("## Instagram + TikTok - asiri performans gosterenler");
        y("");
        y("> `Nx median` degeri, videonun o hesabin kendi ortalamasini kac kat");
        y("> astigini gosterir. Buyuk hesap olmak gerekmiyor; kalibi tutan");
        y("> kucuk hesap da listeye giriyor.");
        y("");
        y(ozet.replace(/^## /gm, "### "));
        y("");
      }
    } catch (e) { console.log("olmadi: " + String(e.message).slice(0, 90)); }
  }

  y("---");
  y("");
  y("## Nasil okunur");
  y("");
  y("1. **Ortanca sureye bak.** Kendi videon ondan cok uzunsa izlenme orani duser.");
  y("");
  y("YouTube bolumundeki **izl/saat** sutunu asil sinyaldir: toplam izlenme");
  y("videonun kac gunluk oldugunu da yansitir, saatlik hiz ise su anda ne");
  y("kadar hizli buyudugunu gosterir.");
  y("");
  y("2. **`hook_0_3s` alanini oku.** Ilk uc saniyede ekranda ne oldugunu ve ne");
  y("   yazdigini soyluyor. Kalip orada.");
  y("3. **`format` ve `effort` alanlarina bak.** Bir sey bir saatlik emekle");
  y("   milyonlar aliyorsa, o formati kendi konunla tekrarlamak en hizli yol.");
  y("4. **Ayni kalip iki farkli hesapta varsa** o bir trend. Bir kere gorduysen");
  y("   tesadüf olabilir.");
  y("");
  y("Kalibi kopyala, icerigi kendin uret: ayni format, ayni sure, ayni hook yapisi.");

  const klasor = path.join(KOK, "trend");
  fs.mkdirSync(klasor, { recursive: true });
  const ad = new Date().toISOString().slice(0, 10) +
             (KONU ? "-" + KONU.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "-genel") + ".md";
  const dosya = path.join(klasor, ad);
  fs.writeFileSync(dosya, satir.join("\n"), "utf8");
  console.log("");
  console.log("rapor: " + dosya);
})().catch(e => { console.error("HATA: " + e.message); process.exit(1); });
