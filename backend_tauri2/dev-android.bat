@echo off
setlocal
cd /d "%~dp0"

echo [dev-android] 正在启动 Android 开发模式（模拟器 / 已连接设备）...
echo [dev-android] 按 Ctrl+C 停止。
call npm run dev:android

pause
