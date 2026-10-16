const fs = require('fs');
const path = require('path');
const agentOrchestrator = require('../services/agentOrchestrator');

const REGISTRATION_TOKEN = 'ITAM-AGENT-SECURE-TOKEN-2026';

/**
 * Agent Heartbeat & Telemetry Ingestion
 */
async function submit(req, res) {
  const token = req.headers['x-registration-token'] || req.body.registrationToken;
  if (token !== REGISTRATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid registration token.' });
  }

  const { serialNumber } = req.body;
  if (!serialNumber) {
    return res.status(400).json({ error: 'Bad Request: serialNumber is required.' });
  }

  try {
    const liveDevice = await agentOrchestrator.processAgentHeartbeat(req.body);
    return res.json({
      success: true,
      message: 'Telemetry synced successfully',
      deviceId: liveDevice.serialNumber,
      assetTag: liveDevice.assetTag,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Agent submit endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
  }
}

/**
 * Agent Polling for Pending Tasks (Commands, Scripts, Process Kills, etc.)
 */
async function pollTasks(req, res) {
  const token = req.headers['x-registration-token'] || req.query.token;
  if (token !== REGISTRATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid registration token.' });
  }

  const serialNumber = req.query.serialNumber;
  if (!serialNumber) {
    return res.status(400).json({ error: 'serialNumber query param is required' });
  }

  try {
    const tasks = await agentOrchestrator.getPendingTasksForAgent(serialNumber);
    return res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Agent pollTasks error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Agent Submitting Task Results (stdout, stderr, exitCode)
 */
async function submitTaskResult(req, res) {
  const token = req.headers['x-registration-token'] || req.body.registrationToken;
  if (token !== REGISTRATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid registration token.' });
  }

  const { taskId } = req.params;
  const { output, errorOutput, exitCode } = req.body;

  try {
    const updated = await agentOrchestrator.recordTaskResult(taskId, {
      output,
      errorOutput,
      exitCode
    });

    return res.json({
      success: true,
      task: updated
    });
  } catch (error) {
    console.error('submitTaskResult error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Dynamic 1-Click PowerShell Installer Script
 * Automatically adapts to live Vercel/production domain or custom URL
 */
async function getInstallScript(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5005';
  const queryUrl = req.query.serverUrl;
  const baseUrl = queryUrl || `${protocol}://${host}`;

  const script = `# =======================================================
# Atera RMM Unified Agent Automated One-Click Installer
# Server URL: ${baseUrl}
# =======================================================

$ErrorActionPreference = "Stop"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Atera RMM Agent Automated Installer    " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

$InstallDir = "C:\\Program Files\\AteraAgent"
$ScriptUrl = "${baseUrl}/api/agent/download/powershell?serverUrl=${encodeURIComponent(baseUrl)}"
$AgentScriptPath = Join-Path $InstallDir "AteraAgent.ps1"

if (-not (Test-Path $InstallDir)) {
    Write-Host "[1/4] Creating installation directory: $InstallDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Write-Host "[2/4] Downloading latest Atera RMM Agent script..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $ScriptUrl -OutFile $AgentScriptPath -UseBasicParsing

Write-Host "[3/4] Configuring automated Windows Task (Runs on boot & every 5 mins)..." -ForegroundColor Yellow
$TaskName = "AteraRmmAgent"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$AgentScriptPath\`" -Loop -ServerUrl \`"${baseUrl}\`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Write-Host "[4/4] Launching Atera RMM Agent in background..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# Also launch an initial foreground scan
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$AgentScriptPath" -Once -ServerUrl "${baseUrl}"

Write-Host "======================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Atera RMM Agent successfully installed!    " -ForegroundColor Green
Write-Host "  Device is now actively reporting to ${baseUrl}      " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.send(script);
}

/**
 * Download Agent Files with Dynamic Live ServerUrl Binding
 */
async function downloadAgent(req, res) {
  const { type } = req.params;
  const rootDir = path.resolve(__dirname, '../../..');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5005';
  const queryUrl = req.query.serverUrl;
  const baseUrl = queryUrl || `${protocol}://${host}`;

  if (type === 'powershell') {
    const file = path.join(rootDir, 'AteraAgent.ps1');
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      content = content.replace(/\[string\]\$ServerUrl\s*=\s*"[^"]*"/, `[string]$ServerUrl = "${baseUrl}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="AteraAgent.ps1"');
      return res.send(content);
    }
  }

  if (type === 'installer-bat') {
    const file = path.join(rootDir, 'Install-AteraAgent.bat');
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      content = content.replace(/https:\/\/nplitinventory\.vercel\.app/g, baseUrl)
                       .replace(/http:\/\/localhost:5005/g, baseUrl);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Install-AteraAgent.bat"');
      return res.send(content);
    }
  }

  if (type === 'python') {
    const file = path.join(rootDir, 'atera_agent.py');
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      content = content.replace(/http:\/\/localhost:5005/g, baseUrl);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="atera_agent.py"');
      return res.send(content);
    }
  }

  return res.status(404).json({ error: 'Agent file not found' });
}

module.exports = {
  submit,
  pollTasks,
  submitTaskResult,
  getInstallScript,
  downloadAgent
};
