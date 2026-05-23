@echo off
cd /d "%~dp0"
start "C盘安心管家" /min node server.js
timeout /t 2 >nul
start http://localhost:4317
