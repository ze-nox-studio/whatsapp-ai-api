@echo off
chcp 65001 >nul
title WhatsApp AI API ve MCP Sunucusu
cd /d "%~dp0"
echo ============================================================
echo   WHATSAPP AI API VE MCP KOPRUSU BASLATILIYOR...
echo   Tarayicida Kontrol Paneli Aciliyor: http://localhost:3000
echo ============================================================
start "" "http://localhost:3000"
node server.js
pause
