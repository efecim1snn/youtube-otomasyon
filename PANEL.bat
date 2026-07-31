@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Panel baslatiliyor... tarayicida acilacak.
echo.
start "" http://localhost:4173
node panel.js
pause
