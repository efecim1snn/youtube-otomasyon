# Video İndirici

Localhost'ta çalışan, reklamsız video indirme + viral keşif paneli.
Link yapıştır → indir. YouTube, TikTok, X (Twitter), Instagram, Facebook, Reddit.

## Kurulum

Gerekenler (hepsi ücretsiz):

| Araç   | Kurulum |
|--------|---------|
| Node.js | https://nodejs.org |
| yt-dlp  | `pip install -U --pre yt-dlp` (**--pre önemli**: TikTok, nightly sürüm ister) |
| ffmpeg  | `winget install ffmpeg` (1080p birleştirme + MP3 için) |

npm install **gerekmez** — sıfır bağımlılık.

## Çalıştırma

`BASLAT.bat` çift tık → tarayıcıda `http://localhost:4190` açılır.

## Özellikler

**⬇ İndir sekmesi**
- Tek veya çoklu link (alt alta yapıştır), kuyruk 2'şerli indirir
- Kalite: En iyi / 4K / 1440p / 1080p / 720p / 480p / MP3 (ses çıkarma)
  — "En iyi" ve 4K/1440p çözünürlük öncelikli; 1080p ve altı H.264 öncelikli (her cihazda açılır)
- Canlı ilerleme (%, hız, kalan süre), kapak görseli
- Oynatma listesi desteği · Chrome çerezleriyle gizli/yaş sınırlı içerik
- Bitince: Oynat / Klasörde göster / Sil

**🔥 Keşfet sekmesi**
- Viral akış: haftanın patlayan videoları (YouTube Shorts + TikTok + Instagram Reels,
  izlenme ve "patlama" katsayılarıyla) — platform ve izlenme barajı (1M/5M/10M/30M+)
  filtreleri, karttan tek tıkla indirme
- **"vidIQ'dan tazele"**: `.env`'deki `VIDIQ_KEY` ile (panel > Kaynaklar sekmesi)
  listeyi canlı günceller — 50 YT Shorts + 25 TikTok + 25 Reels, ~10 vidIQ kredisi.
  Anahtar yoksa depodaki hazır liste gösterilmeye devam eder.
- Canlı arama: YouTube'da dönem (bugün/hafta/ay) + süre (Shorts/uzun) filtreli, izlenmeye göre sıralı arama — yt-dlp ile, ücretsiz ve sınırsız

## Notlar

- İndirilenler `indirilenler/` klasörüne düşer (depoya girmez).
- Viral akış verisi statik bir JSON'dur; `arac/kesfet-derle.cjs` ile vidIQ
  çıktılarından yeniden derlenebilir (dosyanın başındaki kullanım notuna bak).
- TikTok indirme bozulursa ilk çare: `pip install -U --pre yt-dlp`.
- Panel yalnızca `127.0.0.1`'i dinler — dışarıya kapalıdır.
