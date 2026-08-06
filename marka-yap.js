// KANAL MARKA URETICI — profil resmi + banner (fotograf tabanli, sinematik)
// Kullanim: node marka-yap.js "KANAL ADI" "SLOGAN" [cikis-klasoru]
//
// Ilk surum duz renk uzerine yaziydi ve ucuz duruyordu. Bu surum kanalin kendi
// gorsellerini kullaniyor: bolunmus kompozisyon, sicak/soguk renk
// ayrimi, vinyet, altin degrade yazi, simsek ayrac.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { ffmpeg: FF } = require("./ff-yol.js");

const AD = process.argv[2] || "CHANNEL NAME";
const SLOGAN = process.argv[3] || "";
// Cikis klasoru: 3. argumanla verilir, verilmezse repo icinde "marka/".
const CIKIS = process.argv[4] || path.join(__dirname, "marka");
const URETIM = path.join(__dirname, "uretim");
const TMP = path.join(CIKIS, ".tmp");
fs.mkdirSync(CIKIS, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const IMP = "C\\:/Windows/Fonts/impact.ttf";
const BD  = "C\\:/Windows/Fonts/arialbd.ttf";
const q = s => String(s).replace(/\\/g, "\\\\").replace(/'/g, "").replace(/:/g, "\\:")
                        .replace(/%/g, "\\%").replace(/,/g, "\\,");

function run(argv, etiket) {
  try { execFileSync(FF, ["-y","-hide_banner","-loglevel","error", ...argv], { stdio: "pipe", timeout: 240000 }); }
  catch (e) {
    console.error("!! " + etiket + "\n" + ((e.stderr && e.stderr.toString()) || e.message).slice(-1400));
    throw e;
  }
}

// GORSELLER
// Marka, kanalin kendi videolarindaki gorsellerden kurulur — boylece kanal
// sayfasi ve videolar ayni yerden gorunur.
//
// Kaynak klasoru MARKA_GORSEL degiskeniyle verilir; verilmezse uretim/
// altindaki tum islerin Images ve Visuals klasorleri taranir.
//   MARKA_GORSEL=C:/gorseller node marka-yap.js "KANAL" "SLOGAN"
//
// En az 2 gorsel gerekir (profil resmi icin), banner 4 tanesini kullanir.
function gorselleriTopla() {
  const elle = process.env.MARKA_GORSEL;
  const kokler = elle ? [elle] : (fs.existsSync(URETIM)
    ? fs.readdirSync(URETIM).flatMap(is =>
        ["Images", "Visuals"].map(a => path.join(URETIM, is, a)))
    : []);
  const bulunan = [];
  const tara = (d, derinlik) => {
    if (derinlik > 2 || !fs.existsSync(d)) return;
    for (const ad of fs.readdirSync(d)) {
      const t = path.join(d, ad);
      let st; try { st = fs.statSync(t); } catch (e) { continue; }
      if (st.isDirectory()) tara(t, derinlik + 1);
      else if (/\.(jpe?g|png)$/i.test(ad) && st.size > 40000) bulunan.push(t);
    }
  };
  for (const k of kokler) tara(k, 0);
  return bulunan;
}

const HAVUZ = gorselleriTopla();
if (HAVUZ.length < 2) {
  console.error("En az 2 gorsel gerekiyor. Once bir video uret, ya da:");
  console.error("  MARKA_GORSEL=<klasor> node marka-yap.js \"KANAL ADI\" \"SLOGAN\"");
  process.exit(1);
}
// profil: ilk iki gorsel · banner: ilk dort (yeterince yoksa basa doner)
const sec = i => HAVUZ[i % HAVUZ.length];

// ucgen dalga toplami — videolardaki ayni simsek
function zikzak(genlikOlcek, periyotOlcek) {
  const t = (p, a) => {
    const P = Math.max(3, Math.round(p * periyotOlcek)), A = (a * genlikOlcek).toFixed(2);
    return `${A}*(2*(2*abs(X/${P}-floor(X/${P}+0.5)))-1)`;
  };
  return `(${t(97, 30)}+${t(41, 15)}+${t(17, 7)})`;
}

// ---------------------------------------------------------------------------
// ALTIN DEGRADE YAZI
// Once koyu kalin konturu tabana ciziyoruz, sonra sadece harf govdesini
// maske yapip uzerine altin degradeyi bindiriyoruz. Tek drawtext ile
// degrade dolgu yapilamiyor.
// ---------------------------------------------------------------------------
function altinYazi(taban, cikti, W, H, metin, punto, y, konturKalinlik, font) {
  const mask = path.join(TMP, "mask.png");
  const grad = path.join(TMP, "grad.png");
  run(["-f","lavfi","-i", `color=c=black:s=${W}x${H}`,
    "-vf", `drawtext=fontfile='${font || IMP}':text='${q(metin)}':fontcolor=white:` +
           `fontsize=${punto}:x=(w-text_w)/2:y=${y}`,
    "-frames:v","1", mask], "yazi maskesi");
  run(["-f","lavfi","-i",
    `gradients=s=${W}x${H}:c0=0xFFF3C4:c1=0xE0A42B:type=linear:x0=0:y0=${y}:x1=0:y1=${y + punto}`,
    "-frames:v","1", grad], "altin degrade");
  run(["-i", taban, "-i", grad, "-i", mask,
    "-filter_complex",
      // kontur + govde golgesi
      `[0:v]drawtext=fontfile='${font || IMP}':text='${q(metin)}':fontcolor=0x0A0D10:` +
        `fontsize=${punto}:x=(w-text_w)/2:y=${y}:borderw=${konturKalinlik}:bordercolor=0x0A0D10:` +
        `shadowcolor=black@0.75:shadowx=6:shadowy=8[b];` +
      `[1:v][2:v]alphamerge[g];[b][g]overlay=0:0`,
    "-frames:v","1", cikti], "altin yazi bindirme");
}

// ---------------------------------------------------------------------------
// PROFIL RESMI 800x800
// YouTube daireye kirpiyor: onemli her sey merkezdeki daire icinde.
// ---------------------------------------------------------------------------
function profil() {
  // 1024 — YouTube bazi ekranlarda "en az 1024x576" istiyor, 800x800 reddediliyor.
  // Kare kalmali (daireye kirpiliyor), o yuzden 1024x1024.
  const S = 1024, M = S / 2, k = S / 800;   // k: 800'e gore olceklenen olculer
  const z = zikzak(0.55 * k, 0.62 * k);
  const a1 = path.join(TMP, "pp-a.png"), a2 = path.join(TMP, "pp-b.png");

  run([
    "-i", sec(0), "-i", sec(1),
    "-filter_complex", [
      // ust yari — sicak, kontrastli
      `[0:v]scale=${S}:${M}:force_original_aspect_ratio=increase,crop=${S}:${M},` +
        `eq=contrast=1.22:saturation=1.35:brightness=-0.03,` +
        `colorbalance=rs=.10:rm=.10:bs=-.06,unsharp=5:5:0.7[t]`,
      // alt yari — soguk govde, ust yaridan ayrilsin
      `[1:v]scale=${S}:${M}:force_original_aspect_ratio=increase,crop=${S}:${M},` +
        `eq=contrast=1.22:saturation=1.20:brightness=-0.06,` +
        `colorbalance=rs=-.06:bs=.12:bm=.06,unsharp=5:5:0.7[b]`,
      `[t][b]vstack=inputs=2[v0]`,
      // merkeze odaklayan vinyet + hafif karartma
      `[v0]vignette=angle=PI/3.4:x0=${M}:y0=${M},eq=brightness=-0.05[v1]`,
      // simsek ayrac: halo + cekirdek
      `[v1]geq=` +
        `r='if(lt(abs(Y-${M}-${z}),3.2),245,if(lt(abs(Y-${M}-${z}),11),140,r(X,Y)))':` +
        `g='if(lt(abs(Y-${M}-${z}),3.2),252,if(lt(abs(Y-${M}-${z}),11),190,g(X,Y)))':` +
        `b='if(lt(abs(Y-${M}-${z}),3.2),255,if(lt(abs(Y-${M}-${z}),11),210,b(X,Y)))'[v2]`,
      // daire kirpma sinirinda altin halka (kirpik icinde kalir)
      `[v2]geq=` +
        `r='if(between(hypot(X-${M},Y-${M}),${Math.round(372*k)},${Math.round(384*k)}),224,r(X,Y))':` +
        `g='if(between(hypot(X-${M},Y-${M}),${Math.round(372*k)},${Math.round(384*k)}),164,g(X,Y))':` +
        `b='if(between(hypot(X-${M},Y-${M}),${Math.round(372*k)},${Math.round(384*k)}),43,b(X,Y))'`,
    ].join(";"),
    "-frames:v","1", a1,
  ], "pp taban");

  // VS — altin degrade, kalin kontur
  altinYazi(a1, a2, S, S, "VS", Math.round(300*k), Math.round(M - 178*k), Math.round(18*k));

  // alt kenara kanal adi
  const dosya = path.join(CIKIS, `Profile Picture ${S}x${S}.png`);
  run(["-i", a2, "-vf",
    `drawtext=fontfile='${BD}':text='${q(AD)}':fontcolor=white:fontsize=${Math.round(46*k)}` +
      `:x=(w-text_w)/2:y=${Math.round(S - 150*k)}:borderw=${Math.round(7*k)}:bordercolor=0x0A0D10` +
      `:shadowcolor=black@0.8:shadowx=3:shadowy=4`,
    "-frames:v","1", dosya], "pp ad");
  return dosya;
}

// ---------------------------------------------------------------------------
// BANNER 2560x1440
// Guvenli alan 1546x423 (telefonda SADECE o gorunuyor) — yazilar orada.
// Kenarlardaki gorseller masaustunde gorunur, bu alanin dogru kullanimi.
// ---------------------------------------------------------------------------
function banner() {
  const W = 2560, H = 1440, MY = H / 2;
  // 6 dar sutun ozneleri taninmaz hale getiriyordu. 4 x 640 = tam 2560 ve
  // her gorsel seciliyor.
  const SIRA = [sec(0), sec(1), sec(2), sec(3)];
  const TW = Math.ceil(W / SIRA.length);          // 427
  const z = zikzak(1.9, 2.1);
  const a1 = path.join(TMP, "bn-a.png"), a2 = path.join(TMP, "bn-b.png");

  const girisler = [];
  SIRA.forEach(f => { girisler.push("-i", f); });

  const f = [];
  SIRA.forEach((_, i) => {
    f.push(`[${i}:v]scale=${TW}:${H}:force_original_aspect_ratio=increase,crop=${TW}:${H},` +
           `eq=contrast=1.14:saturation=0.80:brightness=-0.06,setsar=1[p${i}]`);
  });
  f.push(SIRA.map((_, i) => `[p${i}]`).join("") + `hstack=inputs=${SIRA.length}[strip]`);
  // 6 x 427 = 2562, iki piksel fazla. crop yerine scale: hstack cikis genisligi
  // kaynak oranlarina gore degisebiliyor, crop o durumda "too big" diye patliyor.
  f.push(`[strip]scale=${W}:${H}[bg]`);
  // merkeze dogru koyulasan perde — yazinin okunmasi icin
  // Genis merkez karartmasi resmi camura ceviriyordu. Yerine yazinin arkasina
  // tasarlanmis bir sinema bandi: her yerde okunur ve kasitli duruyor.
  f.push(`[bg]geq=` +
    `r='r(X,Y)*min(1, 0.52 + 0.00042*abs(X-${W/2}))':` +
    `g='g(X,Y)*min(1, 0.52 + 0.00042*abs(X-${W/2}))':` +
    `b='b(X,Y)*min(1, 0.54 + 0.00042*abs(X-${W/2}))'[dim]`);
  f.push(`[dim]vignette=angle=PI/4.2,eq=brightness=-0.04,` +
    `drawbox=x=0:y=${MY-310}:w=${W}:h=620:color=0x080B0E@0.80:t=fill,` +
    `drawbox=x=0:y=${MY-310}:w=${W}:h=3:color=0xE0A42B@0.55:t=fill,` +
    `drawbox=x=0:y=${MY+307}:w=${W}:h=3:color=0xE0A42B@0.55:t=fill[v1]`);
  // simsek
  f.push(`[v1]geq=` +
    `r='if(lt(abs(Y-${MY}-${z}),4.5),245,if(lt(abs(Y-${MY}-${z}),16),135,r(X,Y)))':` +
    `g='if(lt(abs(Y-${MY}-${z}),4.5),252,if(lt(abs(Y-${MY}-${z}),16),186,g(X,Y)))':` +
    `b='if(lt(abs(Y-${MY}-${z}),4.5),255,if(lt(abs(Y-${MY}-${z}),16),206,b(X,Y)))'`);

  run([...girisler, "-filter_complex", f.join(";"), "-frames:v","1", a1], "banner taban");

  // kanal adi — altin degrade
  altinYazi(a1, a2, W, H, AD, 210, MY - 232, 16);

  const dosya = path.join(CIKIS, "Banner 2560x1440.png");
  run(["-i", a2, "-vf", [
    // altin cizgiler
    `drawbox=x=${W/2 - 430}:y=${MY + 26}:w=860:h=4:color=0xE0A42B@0.95:t=fill`,
    `drawbox=x=${W/2 - 240}:y=${MY + 168}:w=480:h=3:color=0xE0A42B@0.55:t=fill`,
    `drawtext=fontfile='${BD}':text='${q(SLOGAN)}':fontcolor=white:fontsize=66` +
      `:x=(w-text_w)/2:y=${MY + 62}:borderw=8:bordercolor=0x0A0D10` +
      `:shadowcolor=black@0.8:shadowx=3:shadowy=4`,
    `drawtext=fontfile='${BD}':text='${q("NEW MATCHUP EVERY WEEK")}':fontcolor=0xD8C79A:fontsize=42` +
      `:x=(w-text_w)/2:y=${MY + 196}:borderw=6:bordercolor=0x0A0D10`,
  ].join(","), "-frames:v","1", dosya], "banner yazi");
  return dosya;
}

function kontrol(bannerDosya) {
  const dosya = path.join(CIKIS, "_banner-guvenli-alan-kontrol.png");
  run(["-i", bannerDosya, "-vf",
    `drawbox=x=${(2560-1546)/2}:y=${(1440-423)/2}:w=1546:h=423:color=0xFF3B30@0.9:t=5,` +
    `drawbox=x=${(2560-1855)/2}:y=${(1440-423)/2}:w=1855:h=423:color=0xFFCC00@0.7:t=3,` +
    `drawtext=fontfile='${BD}':text='kirmizi = telefon   sari = tablet   disi = masaustu':` +
      `fontcolor=white:fontsize=42:x=40:y=40:borderw=5:bordercolor=black`,
    "-frames:v","1", dosya], "kontrol");
  return dosya;
}

const p = profil();
const b = banner();
const k = kontrol(b);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
console.log("KANAL: " + AD);
console.log("  " + p);
console.log("  " + b);
console.log("  " + k + "   (yuklenmez)");
