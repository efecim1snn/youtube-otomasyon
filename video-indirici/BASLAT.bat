@echo off
title Video Indirici
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js bulunamadi. https://nodejs.org adresinden kurup tekrar dene.
  echo.
  pause
  exit /b 1
)

start "" http://localhost:4190
node server.js

echo.
echo   Sunucu durdu.
pause
