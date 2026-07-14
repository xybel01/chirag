# Secure ITAM Windows Discovery & Inventory Agent Script
# File: ITAssetInventoryAgent.ps1

$LogDir = "C:\ProgramData\CompanyIT\Logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = Join-Path $LogDir "agent.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogLine = "[$Timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $LogLine
    Write-Output $LogLine
}

Write-Log "Starting ITAM Discovery Scan..."

# Portal API Configuration
$ApiUrl = "http://localhost:5000/api/agent/submit" # Update to production URL as needed
$RegistrationToken = "ITAM-AGENT-SECURE-TOKEN-2026"

try {
    # 1. Gather System Hardware Details
    Write-Log "Retrieving computer system info..."
    $CS = Get-CimInstance Win32_ComputerSystem
    $Bios = Get-CimInstance Win32_Bios
    $OSInfo = Get-CimInstance Win32_OperatingSystem
    $CPUInfo = Get-CimInstance Win32_Processor | Select-Object -First 1

    # RAM slots details
    $RAMModules = Get-CimInstance Win32_PhysicalMemory
    $RAMTotalBytes = ($RAMModules | Measure-Object -Property Capacity -Sum).Sum
    $RAMTotalGB = "$([Math]::Round($RAMTotalBytes / 1GB)) GB"

    # Disk C: capacity
    $DiskC = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object -First 1
    $DiskType = "SSD" # Fallback check
    if (Get-Command Get-PhysicalDisk -ErrorAction SilentlyContinue) {
        $DiskType = (Get-PhysicalDisk | Select-Object -First 1).MediaType
    }
    $DiskSizeGB = "$([Math]::Round($DiskC.Size / 1GB)) GB $DiskType"

    # 2. Gather Network settings
    Write-Log "Retrieving network configuration..."
    $NetConfig = Get-CimInstance Win32_NetworkAdapterConfiguration | 
        Where-Object { $_.IPEnabled -and $_.IPAddress -ne $null -and $_.DefaultIPGateway -ne $null } | 
        Select-Object -First 1
    
    $IPAddress = $NetConfig.IPAddress[0]
    $MACAddress = $NetConfig.MACAddress

    # 3. Gather BitLocker Status
    Write-Log "Checking BitLocker status..."
    $BitLocker = "Unknown"
    if (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue) {
        $BLVol = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
        $BitLocker = $BLVol.ProtectionStatus.ToString()
    }

    # 4. Gather Windows Updates & Defender
    Write-Log "Checking security & updates..."
    $Defender = "Enabled"
    if (Get-Service -Name "Windefend" -ErrorAction SilentlyContinue) {
        $Defender = (Get-Service -Name "Windefend").Status.ToString()
    }

    $LastUpdate = "Recent"
    if (Get-HotFix -ErrorAction SilentlyContinue) {
        $LastUpdate = (Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1).InstalledOn.ToString("yyyy-MM-dd")
    }

    # 5. Battery Health
    Write-Log "Checking battery status..."
    $BatteryPct = 100
    $BatteryHealth = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
    if ($BatteryHealth) {
        $BatteryPct = $BatteryHealth.EstimatedChargeRemaining
    }

    # 6. Gather Installed Software Catalog from Uninstall Registry
    Write-Log "Retrieving installed applications list..."
    $RegPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $InstalledApps = Get-ItemProperty $RegPaths -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName -ne $null -and $_.SystemComponent -ne 1 } | 
        Select-Object @{N='name';E={$_.DisplayName}}, @{N='version';E={$_.DisplayVersion}} |
        Group-Object name | ForEach-Object { $_.Group[0] } # Remove duplicates

    Write-Log "Found $($InstalledApps.Count) installed applications."

    # 7. Construct Inventory JSON Payload
    $Payload = @{
        registrationToken  = $RegistrationToken
        hostName           = $CS.Name
        computerName       = $CS.Name
        domainName         = $CS.Domain
        manufacturer       = $CS.Manufacturer
        model              = $CS.Model
        serialNumber       = $Bios.SerialNumber
        cpu                = $CPUInfo.Name
        ram                = $RAMTotalGB
        storage            = $DiskSizeGB
        operatingSystem    = $OSInfo.Caption
        windowsEdition     = $OSInfo.Caption
        windowsVersion     = $OSInfo.Version
        buildNumber        = $OSInfo.BuildNumber
        macAddress         = $MACAddress
        ipAddress          = $IPAddress
        bitLockerStatus    = $BitLocker
        defenderStatus     = $Defender
        batteryHealthPct   = $BatteryPct
        lastWindowsUpdate  = $LastUpdate
        loggedInUser       = $CS.UserName
        installedSoftware  = $InstalledApps
    }

    $JsonPayload = $Payload | ConvertTo-Json -Depth 5

    # 8. POST securely to Portal API
    Write-Log "Posting inventory payload to Portal API ($ApiUrl)..."
    $Headers = @{
        "Content-Type" = "application/json"
        "x-registration-token" = $RegistrationToken
    }

    $Response = Invoke-WebRequest -Uri $ApiUrl -Method POST -Body $JsonPayload -Headers $Headers -UseBasicParsing
    
    Write-Log "API Response: $($Response.Content)"
    Write-Log "ITAM Inventory Scan completed successfully."

} catch {
    Write-Log "ERROR: Failed to run inventory sync. Details: $_" -Level "ERROR"
}
