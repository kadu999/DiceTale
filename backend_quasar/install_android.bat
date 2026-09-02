@echo off
setlocal

set "APK=%~dp0..\android-app\app\build\outputs\apk\debug\app-debug.apk"

if not exist "%APK%" (
    echo [install_android] APK not found: %APK%
    echo [install_android] Run build_android.bat first.
    exit /b 1
)

where adb >nul 2>nul
if errorlevel 1 (
    echo [install_android] adb not found in PATH.
    echo [install_android] Make sure Android platform-tools is installed and in PATH.
    exit /b 1
)

echo [install_android] Installing %APK%...
adb install -r "%APK%"
if errorlevel 1 (
    echo [install_android] Install failed.
    exit /b 1
)

echo [install_android] Done.
exit /b 0
