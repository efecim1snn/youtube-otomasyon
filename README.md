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
- **Üç format:** YouTube uzun video (16:9, en az 15 dk) · YouTube Shorts (9:16, max 45 sn) · **Instagram Reels** (9:16, max 90 sn). Süre sınırları otomatik uygulanır; Reels'te abone-ol kapanışı çıkarılır.
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

## Nasıl çalışıyor

**Senaryo.** vidIQ'nun senaryo üretecine konu, başlık ve hedef süre gider. Dönen markdown temizlenip düz paragraflara indirilir. vidIQ istenen süreden ~1.55 kat uzun yazdığı için hedef süre bu katsayıya bölünerek istenir.

**Görseller.** Her paragraf bir sahne olur. Paragrafın özel isimleri (kişi, takım, yer) ve en ayırt edici kelimeleri arama terimi olarak kullanılır; hiçbiri sonuç vermezse senaryonun genel konusuna düşülür. Böylece hiçbir sahne boş kalmaz. Görsel sayısı konuşma süresinden hesaplanır (~8 saniyeye bir görsel).

**Seslendirme.** `msedge-tts` ile Microsoft'un nöral sesleri kullanılır — ücretsiz, anahtar istemez. Altyazı zamanlaması, her paragrafın gerçek ses süresinden karakter sayısına göre dağıtılarak çıkarılır.

**Render.** Bellek taşmasını önlemek için üç aşamalı: klipler → sekizli gruplar → final. Ken Burns zoom, xfade geçişler, gömülü altyazı, sentezlenmiş fon müziği.

## Lisans

MIT. İstediğin gibi kullan.
