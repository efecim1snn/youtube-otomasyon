@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   YouTube Otomasyon paneli baslatiliyor...
echo   Tarayicida acilacak: http://localhost:4173
echo   Kapatmak icin bu pencereyi kapatin (ya da Ctrl+C).
echo.
start "" http://localhost:4173
node server.js
pause
