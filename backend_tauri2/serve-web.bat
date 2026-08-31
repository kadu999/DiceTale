@echo off
setlocal
cd /d "%~dp0"

REM 用法：serve-web.bat
REM 单端口方案：自带后端（server\src\index.ts，1420）同时托管 API、WebSocket 与前端页面，
REM 打开 http://localhost:1420/ 即是完整可用的 GM 控制台，无跨域问题，无需额外启动任何服务。

if not exist "node_modules\.bin\tsx.cmd" (
    echo [serve] 首次运行，正在安装依赖...
    call npm install --no-fund --no-audit
    if errorlevel 1 (
        echo [serve] npm install 失败，请检查网络后重试。
        pause
        exit /b 1
    )
)

echo [serve] 正在启动 GM 控制台（后端 + 网页，单端口 1420）...
echo [serve] 浏览器打开: http://localhost:1420/
echo [serve] 按 Ctrl+C 停止。
call node_modules\.bin\tsx.cmd server\src\index.ts

pause