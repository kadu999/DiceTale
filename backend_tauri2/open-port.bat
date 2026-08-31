@echo off
setlocal
cd /d "%~dp0"

REM 用法：open-port.bat [端口]，默认从 server\config.json 读取（缺省 1420）
REM 放行 Windows 防火墙 TCP 端口，使同一 WiFi 下的手机/设备可以访问本机后端（需管理员，自动提权）。

REM ---- 确定端口 ----
set "PORT=%~1"
if "%PORT%"=="" (
    for /f "tokens=2 delims=:, " %%p in ('findstr /i "port" server\config.json 2^>nul') do set "PORT=%%p"
)
if "%PORT%"=="" set "PORT=1420"
echo [open-port] 端口: %PORT%

REM ---- 非管理员则自动提权（UAC） ----
net session >nul 2>&1
if errorlevel 1 (
    echo [open-port] 需要管理员权限，正在请求提权（请在弹出的 UAC 窗口点"是"）...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%PORT%' -Verb RunAs"
    exit /b 0
)

REM ---- 添加防火墙规则（幂等：先删再建） ----
set "RULE_NAME=DiceTale GM %PORT%"
netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1
netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT% profile=any >nul 2>&1
if errorlevel 1 (
    echo [open-port] 添加防火墙规则失败。
    pause
    exit /b 1
)

echo [open-port] 已放行 TCP %PORT% 端口。同一 WiFi 下的设备现在可以连接。
echo [open-port] 手机端填电脑局域网 IP + 端口，例如 http://192.168.1.33:%PORT%/
pause