@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  DiceTale 后台端口防火墙放行（Windows Defender 防火墙）
REM  默认端口从 config.json 读取；也可用参数指定：
REM    open-port.bat [端口]       例如：open-port.bat 8088
REM  需要管理员权限；未提权时自动弹出 UAC 提权重启。
REM  可重复运行（先删旧规则再添加，幂等）。
REM ============================================================

REM ---- 1. 确定端口：参数 > config.json > 兜底 8088 ----
set "PORT=%~1"
if "%PORT%"=="" (
    for /f "tokens=2 delims=:, " %%p in ('findstr /i "port" config.json 2^>nul') do set "PORT=%%p"
)
if "%PORT%"=="" set "PORT=8088"
echo [firewall] 目标端口: %PORT%

REM ---- 2. 检查管理员权限，未提权则自动提权重启 ----
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [firewall] 需要管理员权限，正在请求提权...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%PORT%' -Verb RunAs"
    exit /b 0
)

REM ---- 3. 删除旧规则（幂等），再添加 TCP 入站放行 ----
set "RULE_NAME=DiceTale Backend %PORT%"
netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1
netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT% profile=any >nul 2>&1

if %errorlevel% equ 0 (
    echo [firewall] 完成：TCP 入站端口 %PORT% 已放行（规则名: %RULE_NAME%）
    echo.
    netsh advfirewall firewall show rule name="%RULE_NAME%"
) else (
    echo [firewall] 失败：添加防火墙规则出错，请确认以管理员身份运行
)

pause
