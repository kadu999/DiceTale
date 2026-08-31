@echo off
setlocal
cd /d "%~dp0"

REM 用法：serve-web.bat [端口]，默认 1421
echo [serve] 正在启动网页端预览服务器...
call npm run serve -- %~1

pause
