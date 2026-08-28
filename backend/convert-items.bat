@echo off
cd /d "%~dp0"

echo ============================================
echo   DiceTale item data converter
echo   config\item.xlsx  -^>  public\items.json
echo ============================================
echo(

if not exist "config\item.xlsx" (
    echo [ERROR] config\item.xlsx not found.
    echo         Please put the file under backend\config first.
    pause
    exit /b 1
)

set "PYTHON_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
    set "PYTHON_CMD=py"
    where py >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python not found. Please install Python 3 and check "Add to PATH".
        pause
        exit /b 1
    )
)

echo Converting...
echo(
"%PYTHON_CMD%" ..\tools\convert_items.py
if errorlevel 1 (
    echo(
    echo [FAILED] Conversion error, see messages above.
) else (
    echo(
    echo [OK] Converted: public\items.json
    echo     Refresh the admin page to see new data ^(no restart needed^).
)
echo(
pause