# =======================================================
# Atera RMM Unified Agent Automated One-Click Installer
# =======================================================

param(
    [string]$ServerUrl = ""
)

$ErrorActionPreference = "Stop"

# Ensure TLS 1.2 and 1.3 support
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11
} catch {}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Atera RMM Agent Automated Installer    " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

# Determine Server URL if not provided
if (-not $ServerUrl) {
    # Check if local office Atera server 192.168.10.88 is reachable
    try {
        $test = Invoke-WebRequest -Uri "http://192.168.10.88:5005/api/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($test.StatusCode -eq 200) {
            $ServerUrl = "http://192.168.10.88:5005"
            Write-Host "[*] Auto-detected local network Atera Server at $ServerUrl" -ForegroundColor Green
        }
    } catch {}
}

if (-not $ServerUrl) {
    $ServerUrl = "http://192.168.10.88:5005"
}

$InstallDir = "C:\Program Files\AteraAgent"
$AgentScriptPath = Join-Path $InstallDir "AteraAgent.ps1"

if (-not (Test-Path $InstallDir)) {
    Write-Host "[1/4] Creating installation directory: $InstallDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Write-Host "[2/4] Downloading latest Atera RMM Agent script..." -ForegroundColor Yellow
$DownloadUrls = @(
    "https://nplitinventory.vercel.app/AteraAgent.ps1",
    "http://192.168.10.88:5005/api/agent/download/powershell"
)

$Downloaded = $false
foreach ($Url in $DownloadUrls) {
    try {
        Invoke-WebRequest -Uri $Url -OutFile $AgentScriptPath -UseBasicParsing -TimeoutSec 8
        $Downloaded = $true
        break
    } catch {}
}

if (-not $Downloaded) {
    Write-Host "[ERROR] Could not download agent binary. Please check network connectivity." -ForegroundColor Red
    exit 1
}

Write-Host "[3/4] Configuring automated Windows Task (Runs on boot & continuous loop)..." -ForegroundColor Yellow
$TaskName = "AteraRmmAgent"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentScriptPath`" -Loop -ServerUrl `"$ServerUrl`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Write-Host "[4/4] Launching Atera RMM Agent initial scan..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# Also launch an initial foreground scan
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$AgentScriptPath" -Once -ServerUrl "$ServerUrl"

Write-Host "======================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Atera RMM Agent successfully installed!    " -ForegroundColor Green
Write-Host "  Device is now actively reporting to $ServerUrl      " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green
