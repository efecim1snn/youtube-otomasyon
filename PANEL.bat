@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Otomasyon Paneli

echo.
echo   ============================================
echo    OTOMASYON PANELI
echo   ============================================
echo.

REM --- 1) Node kurulu mu ---
where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js bulunamadi.
  echo.
  echo       Kur:  https://nodejs.org   ^(LTS surumu^)
  echo       Kurduktan sonra bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b 1
)

REM --- 2) Bagimliliklar kurulu mu ---
REM Ilk calistirmada node_modules yok. Kullanici "npm install" yazmayi
REM bilmek zorunda kalmasin diye burada kendimiz kuruyoruz.
if not exist "node_modules\msedge-tts" (
  echo   Ilk kurulum yapiliyor, birkac dakika surebilir...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [X] Kurulum basarisiz. Internet baglantini kontrol et.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo   Kurulum tamam.
  echo.
)

REM --- 3) ffmpeg var mi ---
REM Video kurgusu ffmpeg olmadan calismaz. Yoksa simdi soyleyelim,
REM 20 dakikalik render sonunda degil.
node ff-yol.js >nul 2>nul
if errorlevel 1 (
  echo   [!] ffmpeg bulunamadi. Panel acilir ama video uretilemez.
  echo.
  echo       Kur:  winget install Gyan.FFmpeg
  echo       Sonra bu pencereyi kapatip tekrar calistir.
  echo.
  pause
)

REM --- 4) Paneli baslat, HAZIR OLUNCA tarayiciyi ac ---
REM Onceki surumde tarayici sunucudan once aciliyordu; kullanici
REM "baglanamadi" sayfasi gorup calismiyor saniyordu.
start "" /b node panel.js
echo   Panel baslatiliyor...
timeout /t 3 /nobreak >nul
start "" http://localhost:4173
echo.
echo   Tarayicida acildi:  http://localhost:4173
echo.
echo   Kapatmak icin bu pencereyi kapat.
echo.

REM pencere acik kalsin ki sunucu calismaya devam etsin
node -e "setInterval(function(){},1073741824)"
