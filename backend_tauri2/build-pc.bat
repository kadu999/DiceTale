@echo off
setlocal
cd /d "%~dp0"

echo [build] 正在安装 npm 依赖...
call npm install --no-fund --no-audit
if errorlevel 1 goto :fail

echo [build] 正在编译 PC 版（tauri build）...
call npm run build
if errorlevel 1 goto :fail

echo [build] 完成。安装包：src-tauri\target\release\bundle\（msi / nsis）
echo [build] 运行 dev-pc.bat 或 serve-web.bat 启动。
pause
exit /b 0

:fail
echo [build] 编译失败，请查看上方错误信息。
pause
exit /b 1
