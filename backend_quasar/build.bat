@echo off
chcp 65001 >nul
pushd "%~dp0"
echo [build] Building backend_quasar SPA...
npm run build
if %errorlevel% neq 0 (
  echo [build] Failed with code %errorlevel%
  popd
  exit /b %errorlevel%
)
echo [build] Done. Artifacts are in dist\spa.
popd
