@echo off
setlocal
cd /d "%~dp0"

echo [dev] 正在启动 Tauri PC 开发模式（热更新）...
echo [dev] 关闭应用窗口或按 Ctrl+C 停止。
call npm run dev

pause
