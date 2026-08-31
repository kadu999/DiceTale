@echo off
setlocal
cd /d "%~dp0"

REM 用法：install-apk.bat [apk路径]
REM 不带参数时自动使用最新构建的 APK（优先 debug 版，带签名可直接安装）。

REM ---- 1. 定位 adb ----
set "ADB="
where adb >nul 2>&1 && set "ADB=adb"
if not defined ADB (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
)
if not defined ADB (
    echo [install] 未找到 adb。请安装 Android SDK platform-tools，或把 adb 加入 PATH。
    pause
    exit /b 1
)
echo [install] 使用 adb: %ADB%

REM ---- 2. 检测设备 ----
echo [install] 正在检测 Android 设备...
"%ADB%" devices | findstr /r "device$" >nul 2>&1
if errorlevel 1 (
    echo [install] 未检测到已连接的 Android 设备，请先连接设备或启动模拟器。
    pause
    exit /b 1
)

REM ---- 3. 确定 APK（参数优先；否则自动找最新，debug 优先） ----
set "APK=%~1"
if not defined APK (
    for /f "delims=" %%f in ('dir /b /o-d /s "src-tauri\gen\android\app\build\outputs\apk\universal\debug\*.apk" 2^>nul') do set "APK=%%f"
)
if not defined APK (
    for /f "delims=" %%f in ('dir /b /o-d /s "src-tauri\gen\android\app\build\outputs\apk\*.apk" 2^>nul') do set "APK=%%f"
)
if not defined APK (
    echo [install] 未找到 APK。请先运行 build-android.bat 构建，或指定路径：install-apk.bat ^<apk路径^>
    pause
    exit /b 1
)

echo [install] 安装: %APK%
"%ADB%" install -r -d "%APK%"
if errorlevel 1 (
    echo [install] 安装失败，请检查 APK 是否已签名（debug 版可直接安装）。
    pause
    exit /b 1
)

echo [install] 安装完成。
pause