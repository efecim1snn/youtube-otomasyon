// VIRAL SHORTS ANALIZI — bu hafta patlayan Shorts'lari bulur ve NEDEN
// patladiklarini cikarir.
//
// Kullanim:
//   node viral-analiz.js                       # bu hafta, 10M+, genel
//   node viral-analiz.js "animal comparison"   # konuya gore
//   node viral-analiz.js "" tr                 # Turkce basliklar
//   node viral-analiz.js "" en 5000000         # esik degistir
//
// Cikti: viral-analiz/<tarih>.md  — video listesi + cikarilan kaliplar
//
// NOT: Bu arac ANALIZ icindir. Baskasinin videosunu indirip yeniden yuklemek
// telif ihlalidir ve kanal kapatir. Buradaki amac kalibi gormek: hangi sure,
// hangi format, hangi ilk saniye, hangi baslik yapisi calisiyor — sonra o
// kalipla KENDI videonu yapmak.
"use strict";
const https = require("https");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;
const KONU = process.argv[2] || "";
const DIL = process.argv[3] || "en";
const ESIK = Number(process.argv[4] || 10000000);

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
  console.log("— vidIQ anahtari yok. Kaynaklar sekmesinden ekle:");
  console.log("  app.vidiq.com/account/settings/mcp");
  process.exit(0);
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

function icerik(s) {
  if (!s) return null;
  if (s.structuredContent) return s.structuredContent;
  const t = s.content && s.content.find(x => x.type === "text");
  if (!t) return null;
  try { return JSON.parse(t.text); } catch (e) { return t.text; }
}

// ---------- kalip cikarimi ----------
const ortanca = a => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const sayiBicim = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M"
                    : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : String(n);

// Ayni sesi/konsepti kullanan videolar: baslik kelimelerinin buyuk kismi ortak
function kumeleV(videolar) {
  const anahtarla = v => (v.videoTitle || "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter(w => w.length > 3 && !/^(shorts?|viral|trending|video|youtube)$/.test(w))
    .slice(0, 6).sort().join(" ");
  const kume = new Map();
  for (const v of videolar) {
    const k = anahtarla(v);
    let esles = null;
    for (const [mevcut] of kume) {
      const a = new Set(mevcut.split(" ")), b = k.split(" ");
      const ortak = b.filter(w => a.has(w)).length;
      if (b.length && ortak / b.length >= 0.5) { esles = mevcut; break; }
    }
    const anahtar = esles || k;
    if (!kume.has(anahtar)) kume.set(anahtar, []);
    kume.get(anahtar).push(v);
  }
  return [...kume.values()].sort((a, b) => b.length - a.length);
}

(async () => {
  await istek({
    jsonrpc: "2.0", id: ++sayac, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "viral-analiz", version: "1.0" } },
  });
  await istek({ jsonrpc: "2.0", method: "notifications/initialized" }, true);

  console.log(`viral Shorts araniyor — ${sayiBicim(ESIK)}+ izlenme, bu hafta` +
              (KONU ? `, konu: "${KONU}"` : "") + `, dil: ${DIL}`);

  const arg = {
    contentType: "short", language: DIL, publishedWithin: "thisWeek",
    minViews: ESIK, limit: 25, sort: "viewCount",
  };
  if (KONU) arg.keyword = KONU;

  let videolar = [];
  try {
    const d = icerik(await cagir("vidiq_outliers", arg));
    videolar = (d && d.videos) || [];
  } catch (e) { console.log("vidIQ hatasi: " + e.message); process.exit(1); }

  if (!videolar.length) {
    console.log("Bu esikte sonuc yok. Esigi dusur:  node viral-analiz.js \"\" en 1000000");
    process.exit(0);
  }

  // --- istatistikler ---
  const sureler = videolar.map(v => v.videoDuration).filter(Boolean);
  const aboneler = videolar.map(v => v.subscriberCount).filter(n => n > 0);
  const etkilesim = videolar.map(v => v.engagementRate).filter(n => typeof n === "number");
  const kumeler = kumeleV(videolar);
  const enBuyukKume = kumeler[0] || [];

  const satir = [];
  const y = s => satir.push(s);

  y("# Viral Shorts Analizi");
  y("");
  y(`Esik: **${sayiBicim(ESIK)}+ izlenme** · Donem: bu hafta · Dil: ${DIL}` + (KONU ? ` · Konu: ${KONU}` : ""));
  y(`Bulunan: ${videolar.length} video`);
  y("");
  y("> Bu rapor ANALIZ icindir. Baskasinin videosunu indirip yeniden yuklemek");
  y("> telif ihlalidir. Amac kalibi gormek, o kalipla kendi videonu yapmak.");
  y("");

  y("## Cikan kaliplar");
  y("");
  y(`**Sure.** Ortanca ${ortanca(sureler)} saniye. En kisa ${Math.min(...sureler)}, en uzun ${Math.max(...sureler)}.`);
  const kisa = sureler.filter(s => s <= 15).length;
  y(`${kisa}/${sureler.length} video 15 saniye ve altinda.` +
    (kisa / sureler.length > 0.5 ? " **Kisa olan kazaniyor.**" : ""));
  y("");
  y(`**Abone sayisi neredeyse onemsiz.** En kucuk kanal ${sayiBicim(Math.min(...aboneler))} aboneyle listede.`);
  const kucuk = videolar.filter(v => v.subscriberCount < 50000);
  if (kucuk.length) {
    y(`50 binden az aboneli ${kucuk.length} kanal bu esigi gecmis. En carpicisi:`);
    const en = kucuk.sort((a, b) => b.viewCount - a.viewCount)[0];
    y(`- ${sayiBicim(en.subscriberCount)} abone -> **${sayiBicim(en.viewCount)} izlenme** (${en.channelTitle})`);
  }
  y("");
  if (etkilesim.length) {
    const ortE = (etkilesim.reduce((a, b) => a + b, 0) / etkilesim.length * 100).toFixed(2);
    y(`**Etkilesim orani ortalama %${ortE}.** ` +
      (Number(ortE) < 1
        ? "Cok dusuk — bu videolar izlenme aliyor ama begeni/yorum almiyor. " +
          "Bu tur izlenme abone ve gelire iyi donusmez. Not et."
        : "Saglikli."));
    y("");
  }

  if (enBuyukKume.length > 2) {
    y(`**Ayni konsept ${enBuyukKume.length} farkli kanaldan listede.**`);
    y("");
    y("Bu, Shorts'ta en guclu buyume mekanigi: bir ses ya da format trend olur,");
    y("herkes kendi versiyonunu yapar, algoritma hepsini dagitir. Kimse kimsenin");
    y("videosunu kopyalamiyor — ayni sesin uzerine kendi gorseli konuyor.");
    y("");
    for (const v of enBuyukKume.slice(0, 6))
      y(`- ${sayiBicim(v.viewCount).padStart(6)} — ${v.channelTitle} (${sayiBicim(v.subscriberCount)} abone, ${v.videoDuration} sn)`);
    y("");
    y("**Yapilacak:** bu sesi/formati bul, kendi nisinle birlestir, ayni hafta icinde yayinla.");
    y("Trend penceresi genelde 1-2 hafta.");
    y("");
  }

  const kategori = {};
  for (const v of videolar) {
    const k = v.mainCategory || "?";
    kategori[k] = (kategori[k] || 0) + 1;
  }
  y("**Kategoriler:** " + Object.entries(kategori).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} (${n})`).join(" · "));
  y("");

  y("## Videolar");
  y("");
  y("| izlenme | sure | abone | kanal | baslik |");
  y("|---|---|---|---|---|");
  for (const v of videolar) {
    const b = (v.videoTitle || "").replace(/\|/g, "/").slice(0, 60);
    y(`| ${sayiBicim(v.viewCount)} | ${v.videoDuration}sn | ${sayiBicim(v.subscriberCount)} | ${v.channelTitle} | [${b}](https://youtube.com/shorts/${v.videoId}) |`);
  }
  y("");
  y("Baslıklara tiklayip izle — ilk 2 saniyede ne yaptigina bak. Kalip orada.");

  const klasor = path.join(KOK, "viral-analiz");
  fs.mkdirSync(klasor, { recursive: true });
  const ad = `${new Date().toISOString().slice(0, 10)}${KONU ? "-" + KONU.replace(/[^a-z0-9]+/gi, "-") : ""}.md`;
  const dosya = path.join(klasor, ad);
  fs.writeFileSync(dosya, satir.join("\n"), "utf8");

  console.log("");
  console.log(satir.slice(satir.indexOf("## Cikan kaliplar"), satir.indexOf("## Videolar")).join("\n"));
  console.log("✓ rapor: " + dosya);
})().catch(e => { console.error("HATA: " + e.message); process.exit(1); });
