@echo off
chcp 65001 >nul
pushd "%~dp0"
echo [install] Installing backend_quasar dependencies...
npm install
if %errorlevel% neq 0 (
  echo [install] Failed with code %errorlevel%
  popd
  exit /b %errorlevel%
)
echo [install] Done.
popd
