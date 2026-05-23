@echo off
cd /d "%~dp0"
start "CpanCleanerBackend" /min node server.js
timeout /t 2 >nul
powershell -ExecutionPolicy Bypass -File "%~dp0launch-window.ps1"
