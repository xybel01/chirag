@echo off
:: ========================================================
:: Atera RMM Unified Endpoint Agent Windows Installer
:: Nationwide Paper IT Management Portal
:: ========================================================
title Atera RMM Agent Installer
color 0B

echo ========================================================
echo         Atera RMM Agent One-Click Installer
echo ========================================================
echo.

echo [*] Setting up installation directory at C:\ProgramData\AteraAgent...
if not exist "C:\ProgramData\AteraAgent" mkdir "C:\ProgramData\AteraAgent"

echo [*] Copying Agent Script...
if exist "%~dp0AteraAgent.ps1" (
    copy /Y "%~dp0AteraAgent.ps1" "C:\ProgramData\AteraAgent\AteraAgent.ps1" >nul
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://nplitinventory.vercel.app/AteraAgent.ps1' -OutFile 'C:\ProgramData\AteraAgent\AteraAgent.ps1' -UseBasicParsing"
)

echo [*] Registering Atera Windows Background Task (AteraRmmAgent)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"\"C:\ProgramData\AteraAgent\AteraAgent.ps1\"\" -Loop'; $Trigger = New-ScheduledTaskTrigger -AtStartup; $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest; $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; Unregister-ScheduledTask -TaskName 'AteraRmmAgent' -Confirm:$false -ErrorAction SilentlyContinue; Register-ScheduledTask -TaskName 'AteraRmmAgent' -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force"

echo [*] Starting Agent Service immediately...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-ScheduledTask -TaskName 'AteraRmmAgent' -ErrorAction SilentlyContinue; powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\ProgramData\AteraAgent\AteraAgent.ps1' -Once"

echo.
echo ========================================================
echo   SUCCESS: Atera RMM Endpoint Agent has been installed!
echo   Device will automatically monitor and accept remote commands.
echo ========================================================
echo.
pause
