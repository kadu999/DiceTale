@echo off
setlocal
cd /d "%~dp0"

REM 手机端开发回路：
REM   前端页面由电脑上的后端同源托管（http://<电脑局域网IP>:1420），
REM   Android 壳 APK 只内嵌引导页（首次打开填电脑 IP，之后自动跳转并记住）。
REM   因此前端改动只需在 App 内点右上角"刷新"，无需重打包。
REM   本脚本 = 构建一次 debug APK 并安装；只在首次构建或 Rust/壳变更时才需要。

echo [dev-android] 正在构建 debug APK（引导页壳）...
call npm run build:android
if errorlevel 1 goto :fail

echo [dev-android] 正在安装到已连接设备...
call install-apk.bat
if errorlevel 1 goto :fail

echo [dev-android] 完成。首次打开 App 时填写电脑局域网 IP（如 http://192.168.1.33:1420），
echo [dev-android] 之后前端改动只需在 App 内点右上角"刷新"，不用再重打包。
pause
exit /b 0

:fail
echo [dev-android] 失败，请检查 ANDROID_HOME / JAVA_HOME / 设备连接。
pause
exit /b 1