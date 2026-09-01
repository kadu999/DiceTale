@echo off
setlocal enabledelayedexpansion
REM pnpm shim for Tauri Android Gradle plugin (BuildTask calls: pnpm tauri android android-studio-script ...).
REM This project uses npm; forward args (minus the leading 'tauri') to the tauri CLI.
if not "%1"=="tauri" exit /b 1
set "SKIPFIRST=1"
set "REST="
for %%a in (%*) do if defined SKIPFIRST (set "SKIPFIRST=") else (set "REST=!REST! %%a")
node "%~dp0..\node_modules\@tauri-apps\cli\tauri.js"%REST%
exit /b %errorlevel%
