@echo off
setlocal
cd /d "%~dp0"

if not exist "dist\index.js" (
    echo [start] dist\index.js not found. Running build first...
    call build.bat
    if errorlevel 1 exit /b 1
)

echo [start] Starting DiceTale server...
echo [start] GM console: http://localhost:8088/
call npm start
pause
