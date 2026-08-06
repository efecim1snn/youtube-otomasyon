# Otomasyon Paneli — konudan bitmiş videoya

Bir konu yaz, başlık yaz, **ÜRET**'e bas. Senaryoyu yazar, görselleri bulur, seslendirir, videoyu kurar. Bitmiş MP4 çıkar.

Kurgu programı yok. Abonelik yok. Her şey kendi bilgisayarında çalışır.

```
konu + başlık
   ↓
senaryo yazımı      → vidIQ
görsel bulma        → Pexels · Pixabay · Wikimedia · Openverse · NASA
seslendirme         → Microsoft Edge nöral sesler (ücretsiz)
video kurulumu      → ffmpeg
   ↓
bitmiş MP4 + altyazı
```

---

## Ne yapabilir

- **Herhangi bir konu.** Spor, reklam, tarih, bilim, tanıtım — fark etmez. Görsel arama kelimelerini senaryodan kendisi çıkarır.
- **Dört format:** YouTube uzun video (16:9, en az 15 dk) · YouTube Shorts (9:16, max 45 sn) · **Instagram Reels** (9:16, varsayılan 3 dk) · **TikTok** (9:16, varsayılan 60 sn). Süre sınırları otomatik uygulanır; Reels ve TikTok'ta abone-ol kapanışı çıkarılır.
- **İki dilli altyazı.** İngilizce seslendirme + Türkçe gömülü altyazı.
- **Prosedürel intro/outro.** Marka animasyonu, sinematik geri sayım, abone ol kapanışı — hepsi ffmpeg ile üretilir, hazır dosya gerekmez.
- **33 geçiş tipi, 5 hareket efekti, 6 renk tonu.** Panelden seçilir.
- **Türkçe seslendirme.** `konu.json`'a `"ses": "tr-TR-AhmetNeural"` yazınca hem seslendirme hem altyazı Türkçe olur. Konuşma hızı otomatik ayarlanır (Türkçe 113, İngilizce 151 kelime/dk).
- **GPU hızlandırma.** Açılışta NVIDIA/AMD donanım kodlayıcısını dener; varsa kullanır, yoksa sessizce CPU'ya döner. Ayar gerekmez.
- **Bilgisayarı kilitlemez.** Render düşük öncelikte çalışır; tarayıcı, mesajlaşma uygulaması normal açılır.

## Gereksinimler

| | |
|---|---|
| **Node.js** | 18+ ([nodejs.org](https://nodejs.org)) |
| **ffmpeg** | Windows: `winget install Gyan.FFmpeg` · Mac: `brew install ffmpeg` · Linux: `sudo apt install ffmpeg`<br>Nasıl kurduğun fark etmez — PATH'te veya yaygın kurulum yerlerinde arar. |
| **vidIQ anahtarı** | Senaryo yazımı + başlık puanlama — [app.vidiq.com/account/settings/mcp](https://app.vidiq.com/account/settings/mcp) |

**Senaryo motoru iki seçenek:** vidIQ (üyeliğin varsa ek ücret yok) veya Anthropic API (senaryo başına ~10 sent, daha iyi kalite). İkisinden biri yeterli — Anthropic anahtarı girilirse panel onu tercih eder.

Görsel kaynakları için anahtar **zorunlu değil** — Wikimedia ve NASA anahtarsız çalışır. Pexels/Pixabay anahtarı eklersen görsel kalitesi belirgin şekilde artar (ikisi de ücretsiz).

## Kurulum

```bash
git clone https://github.com/efecim1snn/youtube-otomasyon.git
cd youtube-otomasyon
npm install
```

Sonra `.env.ornek` dosyasını `.env` olarak kopyala ve anahtarlarını yaz — ya da paneli açıp **Kaynaklar** sekmesinden gir.

## Çalıştırma

Windows'ta `PANEL.bat` dosyasına çift tıkla. Ya da:

```bash
node panel.js
```

Tarayıcıda `http://localhost:4173` açılır.

## Tek tek kullanım

Panel istemiyorsan her adım ayrı çalışır:

```bash
node senaryo-yaz.js <is-adi>     # konudan senaryo
node gorsel-bul.js  <is-adi>     # senaryodan görseller
node seslendir.js   <is-adi>     # seslendirme + altyazı zamanlaması
node video-yap.js   <is-adi>     # kurgu ve render
```

İşler `uretim/<is-adi>/` altında durur. Ayarlar o klasördeki `konu.json` dosyasında.

## Karşılaştırma Shorts'u (VS formatı)

Belgesel akışından farklı, ikinci bir video tipi: ekran ortadan ikiye bölünür, iki
konu yarışır, arada şimşek ayraç, altta animasyonlu ölçü barları ve dövüş müziği.
YouTube Shorts ve Instagram Reels için 9:16.

```bash
node vs-kur.js                   # örnek eşleşmeleri kurar + görselleri indirir
node vs-yap.js <is-adi>          # 9:16 VS videosunu render eder
node vs-gorsel-duzelt.js         # yanlış tür gelen görselleri değiştirir
```

Eşleşmeler `vs-kur.js` içindeki `ISLER` dizisinde tanımlı; yeni bir tane eklemek
için bir satır yazmak yeterli. Her ölçü için `ustDeger`/`altDeger` sayısal,
`ustMetin`/`altMetin` ekranda görünen metin, `kazanan` o turu kim alıyor.

Bar uzunluğu 0.35 kuvvetiyle ölçeklenir — doğrusal olsaydı 11 cm ile 5.59 m yan
yana çizilince kısa bar görünmez olurdu, logaritmik olsaydı aradaki fark yok gibi
dururdu.

**Görsel uyarısı:** stok siteleri bazen yanlış tür döndürüyor (bal porsuğu yerine
bronz heykel, kutup ayısı yerine müze maketi). `vs-gorsel-duzelt.js` aday metnini
eleyip Wikimedia'nın tür sayfalarından çekiyor.

## Kanal markası

```bash
node marka-yap.js "KANAL ADI" "SLOGAN" [cikis-klasoru]
```

Profil resmi (1024x1024, daireye kırpılınca doğru duracak şekilde) ve banner
(2560x1440, yazılar 1546x423 güvenli alanın içinde) üretir. Kanalın kendi
görsellerini kullanır, videolardaki şimşek ve VS rozetiyle aynı dili taşır.

Yanında çıkan `_banner-guvenli-alan-kontrol.png` yüklenmez — telefon/tablet
sınırlarını gösteren kontrol kopyasıdır.

## Nasıl çalışıyor

**Senaryo.** vidIQ'nun senaryo üretecine konu, başlık ve hedef süre gider. Dönen markdown temizlenip düz paragraflara indirilir. vidIQ istenen süreden ~1.55 kat uzun yazdığı için hedef süre bu katsayıya bölünerek istenir.

**Görseller.** Her paragraf bir sahne olur. Paragrafın özel isimleri (kişi, takım, yer) ve en ayırt edici kelimeleri arama terimi olarak kullanılır; hiçbiri sonuç vermezse senaryonun genel konusuna düşülür. Böylece hiçbir sahne boş kalmaz. Görsel sayısı konuşma süresinden hesaplanır (~8 saniyeye bir görsel).

**Seslendirme.** `msedge-tts` ile Microsoft'un nöral sesleri kullanılır — ücretsiz, anahtar istemez. Altyazı zamanlaması, her paragrafın gerçek ses süresinden karakter sayısına göre dağıtılarak çıkarılır.

**Render.** Bellek taşmasını önlemek için üç aşamalı: klipler → sekizli gruplar → final. Ken Burns zoom, xfade geçişler, gömülü altyazı, sentezlenmiş fon müziği.

## AI görsel üretimi

Stok fotoğrafın bulamadığı soyut sahneler için. `konu.json`'da bir sahne
kelimesini `uret:` ile başlatman yeterli — zincir onu otomatik üretir, kalan
sahneler stok fotoğraftan gelmeye devam eder.

```json
"uretStil": "cinematic, dark background, volumetric light, high detail",
"uretAdet": 2,
"sahneKelimeleri": [
  ["polar bear arctic"],                                    // stok fotoğraf
  ["uret: a lattice of glowing light suspended in darkness"] // AI üretimi
]
```

Ayrı da çalışır:

```bash
node gorsel-uret.js <is-adi>            # "uret:" ile işaretli sahneler
node gorsel-uret.js <is-adi> --hepsi    # tüm sahneler
node gorsel-uret.js --istem "..." --cikti out.jpg
```

**Servisler** — sırayla denenir, ilk çalışan kullanılır:

| servis | anahtar | not |
|---|---|---|
| **Pollinations** | **gerekmez** | varsayılan, ~1 sn |
| Cloudflare Workers AI | `CF_ACCOUNT_ID` + `CF_API_TOKEN` | FLUX, ücretsiz kademe |
| Together | `TOGETHER_KEY` | FLUX.1 schnell, ücretsiz kademe |
| Hugging Face | `HF_TOKEN` | ücretsiz, yavaş olabilir |

Hiç anahtar girmezsen de çalışır.

**Ne zaman üretme:** gerçek bir şey anlatıyorsan — bir hayvan, bir bilim insanı,
bir bina, bir olay — stok fotoğraf kullan. Üretilmiş görsel orada yalan söyler.
Üretim soyut kavramlar için: "kuantum dolanıklığı", "sinir ağı", "hiçliğin
içinden çıkan yapı".

## Viral Shorts analizi

```bash
node viral-analiz.js                      # bu hafta, 10M+ izlenen Shorts
node viral-analiz.js "animal comparison"  # konuya göre
node viral-analiz.js "" tr 1000000        # Türkçe başlıklar, 1M+ eşik
```

O hafta patlayan Shorts'ları bulur ve **neden** patladıklarını çıkarır: ortanca
süre, abone sayısının gerçekte ne kadar etkilediği, etkileşim oranı, ve aynı
sesi/formatı kullanan kanal kümeleri. Rapor `viral-analiz/<tarih>.md` olarak yazılır.

Son çalıştırmadan çıkan örnek bulgu: ilk 20'nin 7'si **aynı sesin** farklı
kanallardaki versiyonuydu — 12 bin aboneli bir kanal 44 milyon izlenme aldı.
Shorts'ta abone sayısı neredeyse önemsiz; trend penceresini yakalamak her şey.

Amaç kalıbı görmek — hangi süre, hangi format, ilk iki saniyede ne oluyor — ve o
kalıpla kendi videonu yapmak. Araç video indirmez; indirmek için `video-indirici/` var.

## Video İndirici

Ayrı bir mini panel: link yapıştır → indir. Reklamlı indirme sitelerine son.

```bash
cd video-indirici
BASLAT.bat        # → http://localhost:4190
```

- YouTube, TikTok, X, Instagram, Facebook, Reddit — tek kutu
- Kalite seçimi (1080p/720p/480p) + MP3 çıkarma, oynatma listesi desteği
- **Keşfet** sekmesi: haftanın viral videoları (YouTube Shorts + TikTok + Reels,
  30M+ filtreli) ve canlı YouTube araması — karttan tek tıkla indirme
- npm install gerekmez; motor `yt-dlp` (`pip install -U --pre yt-dlp`) + ffmpeg

Detay: [video-indirici/README.md](video-indirici/README.md)

## Lisans

MIT. İstediğin gibi kullan.
