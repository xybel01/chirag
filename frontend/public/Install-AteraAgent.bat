@echo off
:: ========================================================
:: Atera RMM Unified Endpoint Agent Windows Installer
:: ========================================================
title Atera RMM Agent Installer
color 0B

echo ========================================================
echo         Atera RMM Agent One-Click Installer
echo ========================================================
echo.

:: Check for Administrator elevation
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This installer requires Administrator privileges.
    echo Please right-click Install-AteraAgent.bat and select "Run as administrator".
    pause
    exit /b 1
)

echo [*] Setting up installation directory at C:\Program Files\AteraAgent...
if not exist "C:\Program Files\AteraAgent" mkdir "C:\Program Files\AteraAgent"

echo [*] Copying Agent Script...
copy /Y "%~dp0AteraAgent.ps1" "C:\Program Files\AteraAgent\AteraAgent.ps1" >nul

echo [*] Registering Atera Windows Background Task (AteraRmmAgent)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"\"C:\Program Files\AteraAgent\AteraAgent.ps1\"\" -Loop'; $Trigger = New-ScheduledTaskTrigger -AtStartup; $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest; $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; Unregister-ScheduledTask -TaskName 'AteraRmmAgent' -Confirm:$false -ErrorAction SilentlyContinue; Register-ScheduledTask -TaskName 'AteraRmmAgent' -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force"

echo [*] Starting Agent Service immediately...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-ScheduledTask -TaskName 'AteraRmmAgent' -ErrorAction SilentlyContinue; powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Program Files\AteraAgent\AteraAgent.ps1' -Once"

echo.
echo ========================================================
echo   SUCCESS: Atera RMM Endpoint Agent has been installed!
echo   Device will automatically monitor and accept remote commands.
echo ========================================================
echo.
pause
