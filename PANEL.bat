@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Otomasyon Paneli
setlocal enabledelayedexpansion

echo.
echo   ============================================
echo    OTOMASYON PANELI
echo   ============================================
echo.

REM ===========================================================
REM  Bu dosya eksik olan her seyi KENDISI kurar.
REM  Kullanicidan beklenen tek sey: bu dosyaya cift tiklamak.
REM ===========================================================

REM --- winget var mi (Windows 10 1809+ ve Windows 11'de hazir gelir) ---
set OTOKUR=1
where winget >nul 2>nul
if errorlevel 1 set OTOKUR=0

REM --- 1) NODE.JS ---
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js bulunamadi.
  if "!OTOKUR!"=="1" (
    echo   Kuruluyor... ^(birkac dakika surebilir^)
    echo.
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    echo.
    REM winget kurdu ama bu pencerenin PATH'i eski. Bilinen yeri ekliyoruz.
    if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;!PATH!"
    if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;!PATH!"
    where node >nul 2>nul
    if errorlevel 1 (
      echo   [!] Node kuruldu ama bu pencere goremiyor.
      echo       Bu pencereyi KAPAT, dosyaya tekrar cift tikla. Hepsi bu.
      echo.
      pause
      exit /b 0
    )
    echo   Node.js kuruldu.
    echo.
  ) else (
    echo   [X] Otomatik kurulum yapilamiyor ^(winget yok^).
    echo       Elle kur:  https://nodejs.org   ^(LTS^)
    echo.
    pause
    exit /b 1
  )
)

REM --- 2) FFMPEG ---
REM ff-yol.js yaygin kurulum yerlerine bakar; bulursa 0 ile cikar.
node ff-yol.js >nul 2>nul
if errorlevel 1 (
  echo   ffmpeg bulunamadi.
  if "!OTOKUR!"=="1" (
    echo   Kuruluyor... ^(birkac dakika surebilir^)
    echo.
    winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements --silent
    echo.
    node ff-yol.js >nul 2>nul
    if errorlevel 1 (
      echo   [!] ffmpeg kuruldu ama henuz gorunmuyor.
      echo       Bu pencereyi KAPAT, dosyaya tekrar cift tikla.
      echo.
      pause
      exit /b 0
    )
    echo   ffmpeg kuruldu.
    echo.
  ) else (
    echo   [X] Otomatik kurulum yapilamiyor ^(winget yok^).
    echo       Elle kur:  https://www.gyan.dev/ffmpeg/builds/
    echo.
    pause
    exit /b 1
  )
)

REM --- 3) BAGIMLILIKLAR ---
if not exist "node_modules\msedge-tts" (
  echo   Ilk kurulum yapiliyor...
  echo.
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo.
    echo   [X] Kurulum basarisiz. Internet baglantini kontrol et.
    echo.
    pause
    exit /b 1
  )
  echo   Kurulum tamam.
  echo.
)

REM --- 4) AYAR DOSYASI ---
REM .env yoksa ornekten olustur. Anahtarlar zorunlu degil; panelin
REM "Kaynaklar" sekmesinden de girilebiliyor.
if not exist ".env" (
  if exist ".env.ornek" copy /y ".env.ornek" ".env" >nul
)

REM --- 5) BASLAT ---
REM Once sunucu kalksin, SONRA tarayici acilsin. Tersi olunca
REM kullanici "baglanamadi" sayfasi gorup calismiyor saniyordu.
start "" /b node panel.js
echo   Panel baslatiliyor...
timeout /t 3 /nobreak >nul
start "" http://localhost:4173
echo.
echo   Hazir:  http://localhost:4173
echo.
echo   Kapatmak icin bu pencereyi kapat.
echo.
node -e "setInterval(function(){},1073741824)"
