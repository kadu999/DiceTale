@echo off
setlocal
cd /d "%~dp0"

REM ---- 1. Generate local.properties (Android SDK path) if missing ----
if not exist "local.properties" (
    echo [build] Creating local.properties with default SDK path...
    echo sdk.dir=C\:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk> local.properties
    echo [build] If your Android SDK is elsewhere, edit local.properties.
)

REM ---- 2. Ensure a usable JAVA_HOME ----
set "DEFAULT_JDK=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"

if defined JAVA_HOME (
    if not exist "%JAVA_HOME%\bin\java.exe" (
        echo [build] JAVA_HOME is invalid: %JAVA_HOME%
        set "JAVA_HOME="
    )
)

if not defined JAVA_HOME (
    if exist "%DEFAULT_JDK%\bin\java.exe" (
        set "JAVA_HOME=%DEFAULT_JDK%"
    )
)

if not defined JAVA_HOME (
    echo [build] No usable JDK found. Install JDK 17 and set JAVA_HOME.
    exit /b 1
)

echo [build] Using JAVA_HOME=%JAVA_HOME%

REM ---- 3. Build ----
echo [build] Building debug APK...
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo [build] Build failed.
    exit /b 1
)

echo [build] Done. APK: app\build\outputs\apk\debug\app-debug.apk
exit /b 0
