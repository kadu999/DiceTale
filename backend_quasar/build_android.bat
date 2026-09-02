@echo off
setlocal

cd /d "%~dp0..\android-app"
call build.bat
if errorlevel 1 (
    echo [build_android] Build failed.
    exit /b 1
)

echo [build_android] APK ready: ..\android-app\app\build\outputs\apk\debug\app-debug.apk
exit /b 0
