@echo off
chcp 65001 >nul
pushd "%~dp0"
echo [start] Starting production server (npm run serve)...
npm run serve
if %errorlevel% neq 0 (
  echo [start] Server exited with code %errorlevel%
  popd
  exit /b %errorlevel%
)
popd
