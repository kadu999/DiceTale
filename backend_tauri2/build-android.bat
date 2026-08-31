@echo off
setlocal
cd /d "%~dp0"

echo [build-android] 正在安装 npm 依赖...
call npm install --no-fund --no-audit
if errorlevel 1 goto :fail

echo [build-android] 正在编译 Android APK（tauri android build --apk）...
call npm run build:android
if errorlevel 1 goto :fail

echo [build-android] 完成。APK：src-tauri\gen\android\app\build\outputs\apk\
pause
exit /b 0

:fail
echo [build-android] 编译失败，请检查 ANDROID_HOME / JAVA_HOME。
pause
exit /b 1
