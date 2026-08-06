// ff-yol.js — ffmpeg ve ffprobe'u nerede olursa bulur.
//
// Once WinGet konumuna bakar, sonra yaygin kurulum yerlerine, en son
// PATH'e duser. Boylece ffmpeg'i nasil kurdugun fark etmez.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function adaylar(ad) {
  const exe = process.platform === "win32" ? ad + ".exe" : ad;
  const L = process.env.LOCALAPPDATA, P = process.env.ProgramFiles;
  return [
    L && path.join(L, "Microsoft", "WinGet", "Links", exe),        // winget
    L && path.join(L, "Programs", "ffmpeg", "bin", exe),
    P && path.join(P, "ffmpeg", "bin", exe),                        // elle kurulum
    "C:\\ffmpeg\\bin\\" + exe,
    "C:\\ProgramData\\chocolatey\\bin\\" + exe,                     // chocolatey
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, "scoop", "shims", exe), // scoop
    "/usr/bin/" + ad, "/usr/local/bin/" + ad, "/opt/homebrew/bin/" + ad, // linux / mac
  ].filter(Boolean);
}

function calisiyorMu(yol) {
  try { execFileSync(yol, ["-version"], { stdio: "ignore", timeout: 8000 }); return true; }
  catch (e) { return false; }
}

function bul(ad) {
  for (const y of adaylar(ad)) if (fs.existsSync(y)) return y;
  if (calisiyorMu(ad)) return ad;            // PATH'te varsa dogrudan adiyla cagir
  console.error("");
  console.error("✗ " + ad + " bulunamadi.");
  console.error("");
  console.error("  Windows : winget install Gyan.FFmpeg");
  console.error("  Mac     : brew install ffmpeg");
  console.error("  Linux   : sudo apt install ffmpeg");
  console.error("");
  console.error("  Kurduktan sonra terminali KAPATIP yeniden ac.");
  console.error("");
  process.exit(1);
}

let _ff = null, _fp = null;
module.exports = {
  get ffmpeg()  { return _ff || (_ff = bul("ffmpeg")); },
  get ffprobe() { return _fp || (_fp = bul("ffprobe")); },
};

// Dogrudan calistirilinca kontrol amaclidir: ffmpeg varsa yolu yazip 0 ile,
// yoksa kurulum talimatiyla 1 ile cikar. PANEL.bat bunu kullaniyor.
// (Getter'lar tembel oldugu icin sadece require etmek kontrol yapmiyordu.)
if (require.main === module) {
  const ff = module.exports.ffmpeg;      // bulunamazsa bul() zaten cikis yapar
  const fp = module.exports.ffprobe;
  console.log(ff);
  console.log(fp);
}
