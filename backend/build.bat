@echo off
setlocal
cd /d "%~dp0"

echo [build] Installing dependencies...
call npm install --no-fund --no-audit
if errorlevel 1 (
    echo [build] npm install failed.
    exit /b 1
)

echo [build] Compiling TypeScript...
call npm run build
if errorlevel 1 (
    echo [build] TypeScript compilation failed.
    exit /b 1
)

echo [build] Done. Output: dist\index.js
echo [build] Run start.bat to launch the server.
exit /b 0
