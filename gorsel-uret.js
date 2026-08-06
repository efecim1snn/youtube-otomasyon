// GORSEL URETECI — ucretsiz AI modelleriyle sahne gorseli uretir.
//
// Stok fotograf bulunamayan ya da anlamsiz kalan soyut sahneler icin.
// "kuantum dolanikligi", "sinir agi", "hicligin icinden cikan madde" gibi
// kavramlarin stok fotografi yoktur; bunlar uretilir. Gercek seyler
// (bir hayvan, bir bilim insani, bir bina) stok fotograftan gelmeli —
// uretilmis gorsel orada yalan soyler.
//
// Kullanim:
//   node gorsel-uret.js <is>                 # "uret:" ile isaretli sahneler
//   node gorsel-uret.js <is> --hepsi         # tum sahneler
//   node gorsel-uret.js --istem "..." --cikti out.jpg
//
// konu.json'da bir sahneyi uretime isaretlemek:
//   "sahneKelimeleri": [
//     ["polar bear arctic"],                        <- stok fotograf
//     ["uret: a lattice of light, dark background"] <- AI uretimi
//   ]
//
// Servisler (sirayla denenir, ilk calisan kullanilir):
//   1. Pollinations     — anahtar GEREKMEZ, varsayilan
//   2. Cloudflare       — CF_ACCOUNT_ID + CF_API_TOKEN  (ucretsiz kademe)
//   3. Together         — TOGETHER_KEY                  (ucretsiz kademe)
//   4. Hugging Face     — HF_TOKEN                      (ucretsiz)
"use strict";
const https = require("https");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;

function env(ad) {
  if (process.env[ad]) return process.env[ad].trim();
  try {
    for (const l of fs.readFileSync(path.join(KOK, ".env"), "utf8").split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === ad) return m[2].trim();
    }
  } catch (e) {}
  return "";
}

const bekle = ms => new Promise(r => setTimeout(r, ms));

function indir(u, baslik, gonder) {
  return new Promise((coz, red) => {
    const url = new URL(u);
    const opt = {
      hostname: url.hostname, path: url.pathname + url.search,
      method: gonder ? "POST" : "GET",
      headers: Object.assign({ "User-Agent": "Mozilla/5.0" }, baslik || {}),
      timeout: 120000,
    };
    if (gonder) {
      opt.headers["Content-Type"] = "application/json";
      opt.headers["Content-Length"] = Buffer.byteLength(gonder);
    }
    const r = https.request(opt, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return indir(res.headers.location, baslik).then(coz, red);
      }
      const c = [];
      res.on("data", d => c.push(d));
      res.on("end", () => {
        const b = Buffer.concat(c);
        if (res.statusCode !== 200) {
          return red(Object.assign(new Error("HTTP " + res.statusCode + " " + b.toString("utf8").slice(0, 160)),
                                   { kod: res.statusCode }));
        }
        coz({ govde: b, tip: res.headers["content-type"] || "" });
      });
    });
    r.on("timeout", () => { r.destroy(new Error("zaman asimi")); });
    r.on("error", red);
    if (gonder) r.write(gonder);
    r.end();
  });
}

const gorselMi = b =>
  b.length > 3000 &&
  (b.slice(0, 2).toString("hex") === "ffd8" || b.slice(1, 4).toString() === "PNG");

// ---------------------------------------------------------------------------
// SERVISLER
// Her biri {ad, hazir(), uret(istem, en, boy, tohum)} dondurur.
// ---------------------------------------------------------------------------
const SERVISLER = [
  {
    ad: "Pollinations",
    anahtarGerekli: false,
    hazir: () => true,
    async uret(istem, en, boy, tohum) {
      const u = "https://image.pollinations.ai/prompt/" + encodeURIComponent(istem) +
                `?width=${en}&height=${boy}&nologo=true&seed=${tohum}`;
      const { govde } = await indir(u);
      if (!gorselMi(govde)) throw new Error("gorsel donmedi");
      return govde;
    },
  },
  {
    ad: "Cloudflare",
    anahtarGerekli: true,
    hazir: () => !!(env("CF_ACCOUNT_ID") && env("CF_API_TOKEN")),
    async uret(istem, en, boy) {
      const hesap = env("CF_ACCOUNT_ID"), jeton = env("CF_API_TOKEN");
      const u = `https://api.cloudflare.com/client/v4/accounts/${hesap}` +
                `/ai/run/@cf/black-forest-labs/flux-1-schnell`;
      const { govde } = await indir(u, { Authorization: "Bearer " + jeton },
        JSON.stringify({ prompt: istem, width: en, height: boy }));
      // Cloudflare base64 JSON donduruyor
      try {
        const j = JSON.parse(govde.toString("utf8"));
        const b64 = j.result && (j.result.image || j.result.images && j.result.images[0]);
        if (b64) {
          const b = Buffer.from(b64, "base64");
          if (gorselMi(b)) return b;
        }
      } catch (e) {}
      if (gorselMi(govde)) return govde;
      throw new Error("gorsel donmedi");
    },
  },
  {
    ad: "Together",
    anahtarGerekli: true,
    hazir: () => !!env("TOGETHER_KEY"),
    async uret(istem, en, boy) {
      const { govde } = await indir("https://api.together.xyz/v1/images/generations",
        { Authorization: "Bearer " + env("TOGETHER_KEY") },
        JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell-Free",
          prompt: istem, width: en, height: boy, n: 1, response_format: "b64_json",
        }));
      const j = JSON.parse(govde.toString("utf8"));
      const b64 = j.data && j.data[0] && j.data[0].b64_json;
      if (!b64) throw new Error("gorsel donmedi");
      const b = Buffer.from(b64, "base64");
      if (!gorselMi(b)) throw new Error("bozuk gorsel");
      return b;
    },
  },
  {
    ad: "HuggingFace",
    anahtarGerekli: true,
    hazir: () => !!env("HF_TOKEN"),
    async uret(istem) {
      const { govde } = await indir(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        { Authorization: "Bearer " + env("HF_TOKEN") },
        JSON.stringify({ inputs: istem }));
      if (!gorselMi(govde)) throw new Error("gorsel donmedi (model yukleniyor olabilir)");
      return govde;
    },
  },
];

// ---------------------------------------------------------------------------
// TEK GORSEL URET — servisleri sirayla dener
// ---------------------------------------------------------------------------
async function uretBir(istem, en, boy, tohum, sessiz) {
  const acik = SERVISLER.filter(s => s.hazir());
  let sonHata = null;
  for (const s of acik) {
    for (let deneme = 0; deneme < 2; deneme++) {
      try {
        const b = await s.uret(istem, en, boy, tohum);
        return { govde: b, servis: s.ad };
      } catch (e) {
        sonHata = e;
        if (e.kod === 429 || /rate|limit|busy|loading/i.test(e.message)) await bekle(2500);
        else break;
      }
    }
    if (!sessiz) console.log(`  (${s.ad} olmadi: ${String(sonHata && sonHata.message).slice(0, 60)})`);
  }
  throw sonHata || new Error("hicbir servis calismadi");
}

// Sahne kelimesinden tam istem kurar. Stil konu.json > uretStil ile verilir.
function istemKur(metin, stil) {
  const temiz = String(metin).replace(/^uret:\s*/i, "").trim();
  const varsayilanStil =
    "cinematic, dramatic lighting, high detail, photographic, 35mm, shallow depth of field";
  return temiz + ", " + (stil || varsayilanStil);
}

// ---------------------------------------------------------------------------
module.exports = { uretBir, istemKur, SERVISLER };

if (require.main === module) (async () => {
  const argv = process.argv.slice(2);
  const bayrak = a => argv.includes(a);
  const deger = a => { const i = argv.indexOf(a); return i >= 0 ? argv[i + 1] : null; };

  const acik = SERVISLER.filter(s => s.hazir());
  console.log("Acik servisler: " + acik.map(s => s.ad).join(", "));
  if (!acik.length) { console.error("Hicbir servis acik degil."); process.exit(1); }

  // --- tek istem modu ---
  const istem = deger("--istem");
  if (istem) {
    const cikti = deger("--cikti") || "uretilen.jpg";
    const en = Number(deger("--en") || 1280), boy = Number(deger("--boy") || 720);
    const { govde, servis } = await uretBir(istemKur(istem, deger("--stil")), en, boy, 1);
    fs.writeFileSync(cikti, govde);
    console.log(`✓ ${cikti}  (${servis}, ${(govde.length / 1024) | 0} KB)`);
    return;
  }

  // --- is modu ---
  const IS = argv.find(a => !a.startsWith("--"));
  if (!IS) {
    console.error("kullanim: node gorsel-uret.js <is-adi> [--hepsi]");
    console.error("          node gorsel-uret.js --istem \"...\" --cikti out.jpg");
    process.exit(1);
  }
  const BASE = path.join(KOK, "uretim", IS);
  if (!fs.existsSync(BASE)) { console.error("is bulunamadi: " + IS); process.exit(1); }

  const konu = JSON.parse(fs.readFileSync(path.join(BASE, "konu.json"), "utf8"));
  const dikey = konu.aspect === "9:16";
  const EN = dikey ? 768 : 1280, BOY = dikey ? 1344 : 720;
  const VIS = path.join(BASE, "Visuals");
  fs.mkdirSync(VIS, { recursive: true });

  const kelimeler = konu.sahneKelimeleri || [];
  if (!kelimeler.length) { console.error("konu.json'da sahneKelimeleri yok."); process.exit(1); }

  const hepsi = bayrak("--hepsi");
  const basina = Number(konu.uretAdet || 2);   // sahne basina kac gorsel

  let uretilen = 0, atlanan = 0;
  for (let i = 0; i < kelimeler.length; i++) {
    const k = kelimeler[i];
    const ilk = Array.isArray(k) ? k[0] : String(k);
    const isaretli = /^uret:/i.test(ilk);
    if (!isaretli && !hepsi) { atlanan++; continue; }

    const no = String(i + 1).padStart(2, "0");
    const ad = no + "-uretilen";
    const klasor = path.join(VIS, ad);
    fs.mkdirSync(klasor, { recursive: true });

    const istemMetni = istemKur(ilk, konu.uretStil);
    process.stdout.write(`${no} ${istemMetni.slice(0, 52)}… `);
    for (let n = 0; n < basina; n++) {
      const hedef = path.join(klasor, `${no}-${n + 1}.jpg`);
      if (fs.existsSync(hedef) && fs.statSync(hedef).size > 20000) { process.stdout.write("·"); continue; }
      try {
        const { govde } = await uretBir(istemMetni, EN, BOY, i * 100 + n + 1, true);
        fs.writeFileSync(hedef, govde);
        uretilen++;
        process.stdout.write("+");
      } catch (e) {
        process.stdout.write("x");
      }
      await bekle(400);   // servise nazik davran
    }
    console.log("");
  }

  console.log("");
  console.log(`✓ ${uretilen} gorsel uretildi` + (atlanan ? `, ${atlanan} sahne atlandi (uret: isareti yok)` : ""));
  if (atlanan && !hepsi)
    console.log("  Tum sahneleri uretmek icin: node gorsel-uret.js " + IS + " --hepsi");
})().catch(e => { console.error("HATA: " + e.message); process.exit(1); });
