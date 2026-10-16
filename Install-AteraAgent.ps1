# ========================================================
# Atera RMM Unified Endpoint Agent Windows Installer (PowerShell)
# ========================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "      Atera RMM Agent Automated One-Click Setup         " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

$InstallDir = "C:\Program Files\AteraAgent"
$SourceScript = Join-Path $PSScriptRoot "AteraAgent.ps1"
$TargetScript = Join-Path $InstallDir "AteraAgent.ps1"

if (-not (Test-Path $InstallDir)) {
    Write-Host "[1/4] Creating Directory: $InstallDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Write-Host "[2/4] Copying Agent Binary..." -ForegroundColor Yellow
if (Test-Path $SourceScript) {
    Copy-Item -Path $SourceScript -Destination $TargetScript -Force
} else {
    Invoke-WebRequest -Uri "http://localhost:5005/api/agent/download/powershell" -OutFile $TargetScript -UseBasicParsing
}

Write-Host "[3/4] Creating Automated Scheduled Task..." -ForegroundColor Yellow
$TaskName = "AteraRmmAgent"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$TargetScript`" -Loop"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Write-Host "[4/4] Starting Agent background task..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# Execute initial scan
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$TargetScript" -Once

Write-Host "========================================================" -ForegroundColor Green
Write-Host " SUCCESS: Atera RMM Agent is now active and monitoring! " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
