@echo off
cd /d "%~dp0"
start "C盘安心管家后台" /min node server.js
timeout /t 2 >nul
powershell -ExecutionPolicy Bypass -File "%~dp0启动独立窗口.ps1"
