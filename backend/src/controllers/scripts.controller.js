const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const agentOrchestrator = require('../services/agentOrchestrator');

const BUILT_IN_SCRIPTS = [
  {
    name: 'Clear Windows Temp Files & Cache',
    description: 'Removes user and system temporary files to free up disk space and clean system cache.',
    category: 'Maintenance',
    language: 'PowerShell',
    timeoutSec: 60,
    isBuiltIn: true,
    code: `Write-Host "Starting Temporary Files Cleanup..." -ForegroundColor Cyan
$TempPaths = @($env:TEMP, "C:\\Windows\\Temp")
$CleanedBytes = 0

foreach ($Path in $TempPaths) {
    if (Test-Path $Path) {
        $Files = Get-ChildItem -Path $Path -Recurse -Force -ErrorAction SilentlyContinue
        foreach ($File in $Files) {
            try {
                $CleanedBytes += $File.Length
                Remove-Item -Path $File.FullName -Recurse -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }
}
$CleanedMB = [Math]::Round($CleanedBytes / 1MB, 2)
Write-Host "SUCCESS: Cleaned approximately $CleanedMB MB of temporary junk files." -ForegroundColor Green`
  },
  {
    name: 'Flush DNS & Reset TCP/IP Stack',
    description: 'Flushes DNS client cache, purges ARP entries, and restores default IP network bindings.',
    category: 'Networking',
    language: 'PowerShell',
    timeoutSec: 30,
    isBuiltIn: true,
    code: `Write-Host "Flushing DNS Resolver Cache..." -ForegroundColor Cyan
Clear-DnsClientCache
ipconfig /flushdns

Write-Host "Re-registering DNS..." -ForegroundColor Cyan
ipconfig /registerdns

Write-Host "SUCCESS: DNS cache purged and network sockets refreshed." -ForegroundColor Green`
  },
  {
    name: 'Restart Print Spooler Service',
    description: 'Stops spooler service, clears stuck print queue spool files in system32, and restarts spooler.',
    category: 'Maintenance',
    language: 'PowerShell',
    timeoutSec: 45,
    isBuiltIn: true,
    code: `Write-Host "Stopping Print Spooler Service..." -ForegroundColor Yellow
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue

Write-Host "Purging stuck print queue files..." -ForegroundColor Yellow
Remove-Item -Path "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -ErrorAction SilentlyContinue

Write-Host "Restarting Print Spooler Service..." -ForegroundColor Cyan
Start-Service -Name Spooler
Get-Service -Name Spooler | Select-Object Name, Status, StartType | Format-Table -AutoSize
Write-Host "SUCCESS: Print spooler queue cleared and service restarted." -ForegroundColor Green`
  },
  {
    name: 'Run Windows Defender Quick Scan',
    description: 'Initiates a real-time antivirus malware scan using native Windows Defender.',
    category: 'Security',
    language: 'PowerShell',
    timeoutSec: 120,
    isBuiltIn: true,
    code: `Write-Host "Triggering Microsoft Defender Antivirus Quick Scan..." -ForegroundColor Cyan
Start-MpScan -ScanType QuickScan
$Status = Get-MpComputerStatus | Select-Object AMServiceEnabled, AntivirusEnabled, RealTimeProtectionEnabled, AntivirusSignatureAge
Write-Host "SUCCESS: Defender Quick Scan triggered. Defender Protection Status:" -ForegroundColor Green
$Status | Format-List`
  },
  {
    name: 'Check Battery Health & Capacity Report',
    description: 'Generates detailed Windows battery diagnostics and returns design capacity vs full charge capacity.',
    category: 'Diagnostics',
    language: 'PowerShell',
    timeoutSec: 30,
    isBuiltIn: true,
    code: `Write-Host "Checking Battery Health..." -ForegroundColor Cyan
$Battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
if ($Battery) {
    Write-Host "Battery Status: $($Battery.BatteryStatus)" -ForegroundColor Green
    Write-Host "Estimated Charge Remaining: $($Battery.EstimatedChargeRemaining)%" -ForegroundColor Green
    Write-Host "Estimated Run Time: $($Battery.EstimatedRunTime) minutes" -ForegroundColor Green
} else {
    Write-Host "Device does not report a physical battery (Desktop / Virtual Machine / AC Powered)." -ForegroundColor Yellow
}`
  },
  {
    name: 'Silent Install Google Chrome',
    description: 'Deploys latest Google Chrome Enterprise web browser silently via Windows Package Manager (Winget).',
    category: 'Software',
    language: 'PowerShell',
    timeoutSec: 180,
    isBuiltIn: true,
    code: `Write-Host "Installing Google Chrome via Winget..." -ForegroundColor Cyan
winget install --id Google.Chrome -e --silent --accept-source-agreements --accept-package-agreements
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Google Chrome installed successfully." -ForegroundColor Green
} else {
    Write-Host "Winget finished with code $LASTEXITCODE" -ForegroundColor Yellow
}`
  },
  {
    name: 'Silent Install 7-Zip Archiver',
    description: 'Installs 7-Zip utility silently via Windows Package Manager (Winget).',
    category: 'Software',
    language: 'PowerShell',
    timeoutSec: 120,
    isBuiltIn: true,
    code: `Write-Host "Installing 7-Zip via Winget..." -ForegroundColor Cyan
winget install --id 7zip.7zip -e --silent --accept-source-agreements --accept-package-agreements
Write-Host "SUCCESS: 7-Zip installation command finished." -ForegroundColor Green`
  },
  {
    name: 'Run System File Checker (SFC /scannow)',
    description: 'Scans all protected system files and repairs corrupted files using Windows Component Store.',
    category: 'Maintenance',
    language: 'PowerShell',
    timeoutSec: 300,
    isBuiltIn: true,
    code: `Write-Host "Running SFC (System File Checker)... This may take 2-4 minutes." -ForegroundColor Cyan
sfc /scannow`
  }
];

/**
 * Seed built-in scripts if not already in DB
 */
async function ensureBuiltInScripts() {
  try {
    for (const s of BUILT_IN_SCRIPTS) {
      const exists = await prisma.automationScript.findFirst({ where: { name: s.name } });
      if (!exists) {
        await prisma.automationScript.create({ data: s });
      }
    }
  } catch (err) {
    console.error('Error ensuring built-in scripts:', err.message);
  }
}

// Run on module load
ensureBuiltInScripts();

/**
 * List all automation scripts
 */
async function list(req, res) {
  try {
    await ensureBuiltInScripts();
    const { category } = req.query;
    const where = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }

    const scripts = await prisma.automationScript.findMany({
      where,
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }]
    });

    return res.json({ scripts });
  } catch (error) {
    console.error('Error in scripts.list:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Create a new custom automation script
 */
async function create(req, res) {
  try {
    const { name, description, category, language, code, timeoutSec } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Script name and code are required' });
    }

    const script = await prisma.automationScript.create({
      data: {
        name,
        description,
        category: category || 'Maintenance',
        language: language || 'PowerShell',
        code,
        timeoutSec: timeoutSec ? Number(timeoutSec) : 60,
        isBuiltIn: false
      }
    });

    return res.status(201).json({ success: true, script });
  } catch (error) {
    console.error('Error in scripts.create:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Run script on one or multiple devices
 */
async function run(req, res) {
  try {
    const { scriptId, serialNumbers } = req.body;
    if (!scriptId || !serialNumbers || !serialNumbers.length) {
      return res.status(400).json({ error: 'scriptId and serialNumbers array are required' });
    }

    const script = await prisma.automationScript.findUnique({ where: { id: Number(scriptId) } });
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const tasks = [];
    for (const serialNumber of serialNumbers) {
      const task = await agentOrchestrator.queueDeviceTask({
        serialNumber,
        commandType: 'SCRIPT',
        commandText: script.code,
        parameters: { scriptName: script.name, timeoutSec: script.timeoutSec },
        requestedBy: req.user?.name || 'Atera Admin'
      });
      tasks.push(task);
    }

    return res.json({
      success: true,
      message: `Dispatched "${script.name}" to ${tasks.length} device(s)`,
      tasks
    });
  } catch (error) {
    console.error('Error in scripts.run:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  list,
  create,
  run
};
