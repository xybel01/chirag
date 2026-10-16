const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const agentOrchestrator = require('../services/agentOrchestrator');

/**
 * List all RMM devices with live telemetry & alert counts
 */
async function list(req, res) {
  try {
    const { status, type, q } = req.query;

    // Fetch assets from database
    const dbAssets = await prisma.asset.findMany({
      include: {
        category: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        location: true,
        department: true,
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Fetch active alerts count grouped by serialNumber
    const alerts = await prisma.deviceAlert.findMany({
      where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }
    });

    const alertCountMap = {};
    for (const a of alerts) {
      alertCountMap[a.serialNumber] = (alertCountMap[a.serialNumber] || 0) + 1;
    }

    // Merge DB records with live cache
    let devices = dbAssets.map(asset => {
      const live = agentOrchestrator.getLiveDevice(asset.serialNumber);
      const isOnline = Boolean(live?.isOnline);

      return {
        id: asset.id,
        assetTag: asset.assetTag,
        serialNumber: asset.serialNumber,
        deviceName: asset.computerName || live?.hostName || asset.model,
        model: asset.model,
        manufacturer: asset.manufacturer,
        category: asset.category?.name || 'Computer',
        categoryCode: asset.category?.code || 'LAP',
        deviceType: (asset.category?.code === 'SRV' || asset.category?.code === 'VSRV') ? 'Server' : 'Workstation',
        operatingSystem: asset.windowsEdition || live?.operatingSystem || 'Windows 11',
        ipAddress: live?.ipAddress || asset.wanIp || '192.168.1.100',
        macAddress: live?.macAddress || asset.wifiMac || 'N/A',
        assignedTo: asset.assignedTo?.name || 'Unassigned',
        assignedUserEmail: asset.assignedTo?.email || null,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        isOnline,
        cpu: asset.cpu || live?.cpu || 'Multi-Core Processor',
        ram: asset.ram || live?.ram || '16 GB',
        storage: asset.storage || live?.storage || '512 GB SSD',
        cpuUsage: live ? live.cpuUsage : (isOnline ? 18 : 0),
        ramUsage: live ? live.ramUsage : (isOnline ? 52 : 0),
        diskUsage: live ? live.diskUsage : (isOnline ? 45 : 0),
        diskFreeGB: live?.diskFreeGB || 220,
        defenderStatus: live?.defenderStatus || asset.defenderStatus || 'Running',
        bitLockerStatus: live?.bitLockerStatus || asset.bitLockerStatus || 'Enabled',
        lastSeen: live ? live.lastSeen : asset.updatedAt,
        openAlertsCount: alertCountMap[asset.serialNumber] || 0
      };
    });

    // Apply filters
    if (status && status !== 'all') {
      devices = devices.filter(d => d.status.toLowerCase() === status.toLowerCase());
    }

    if (type && type !== 'all') {
      devices = devices.filter(d => d.deviceType.toLowerCase() === type.toLowerCase());
    }

    if (q) {
      const query = q.toLowerCase();
      devices = devices.filter(d =>
        d.deviceName.toLowerCase().includes(query) ||
        d.serialNumber.toLowerCase().includes(query) ||
        d.assetTag.toLowerCase().includes(query) ||
        d.ipAddress.toLowerCase().includes(query) ||
        d.assignedTo.toLowerCase().includes(query)
      );
    }

    // High level summary counts
    const totalDevices = devices.length;
    const onlineCount = devices.filter(d => d.isOnline).length;
    const offlineCount = totalDevices - onlineCount;
    const criticalAlertsCount = alerts.filter(a => a.severity === 'CRITICAL').length;

    return res.json({
      summary: {
        total: totalDevices,
        online: onlineCount,
        offline: offlineCount,
        criticalAlerts: criticalAlertsCount
      },
      devices
    });

  } catch (error) {
    console.error('Error in devices.list:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get full device profile including processes, services, software, alerts, and task history
 */
async function getById(req, res) {
  try {
    const { id } = req.params;

    // Search by numeric id or serialNumber
    const where = !isNaN(Number(id)) ? { id: Number(id) } : { serialNumber: id };
    const asset = await prisma.asset.findFirst({
      where,
      include: {
        category: true,
        assignedTo: true,
        department: true,
        location: true,
        linkedTickets: {
          select: { id: true, ticketNo: true, summary: true, priority: true, status: true, createdAt: true },
          take: 5
        }
      }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const live = agentOrchestrator.getLiveDevice(asset.serialNumber);
    const isOnline = Boolean(live?.isOnline);

    // Fetch active & recent alerts for device
    const alerts = await prisma.deviceAlert.findMany({
      where: { serialNumber: asset.serialNumber },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Fetch command & script task history
    const taskHistory = await prisma.deviceTask.findMany({
      where: { serialNumber: asset.serialNumber },
      orderBy: { createdAt: 'desc' },
      take: 25
    });

    return res.json({
      device: {
        id: asset.id,
        assetTag: asset.assetTag,
        serialNumber: asset.serialNumber,
        deviceName: asset.computerName || live?.hostName || asset.model,
        model: asset.model,
        manufacturer: asset.manufacturer,
        category: asset.category?.name || 'Computer',
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        isOnline,
        operatingSystem: asset.windowsEdition || live?.operatingSystem || 'Windows 11 Pro',
        windowsVersion: asset.windowsVersion || live?.windowsVersion || '23H2',
        buildNumber: asset.buildNumber || live?.buildNumber || '22631',
        domainName: asset.domainName || 'WORKGROUP',
        ipAddress: live?.ipAddress || asset.wanIp || '127.0.0.1',
        macAddress: live?.macAddress || asset.wifiMac || 'N/A',
        loggedInUser: live?.loggedInUser || asset.assignedTo?.name || 'Local User',
        assignedTo: asset.assignedTo,
        department: asset.department?.name || 'Corporate IT',
        location: asset.location?.name || 'Head Office',
        cpu: asset.cpu || live?.cpu || 'Intel Core i7-12700',
        ram: asset.ram || live?.ram || '16 GB',
        storage: asset.storage || live?.storage || '512 GB NVMe SSD',
        bitLockerStatus: live?.bitLockerStatus || asset.bitLockerStatus || 'Protection On',
        defenderStatus: live?.defenderStatus || asset.defenderStatus || 'Running',
        batteryHealthPct: live?.batteryHealthPct ?? 100,
        cpuUsage: live ? live.cpuUsage : (isOnline ? 18 : 0),
        ramUsage: live ? live.ramUsage : (isOnline ? 52 : 0),
        diskUsage: live ? live.diskUsage : (isOnline ? 45 : 0),
        diskFreeGB: live?.diskFreeGB || 240,
        diskTotalGB: live?.diskTotalGB || 512,
        lastSeen: live ? live.lastSeen : asset.updatedAt,
        notes: asset.notes
      },
      liveTelemetry: {
        processes: live?.processes || [],
        services: live?.services || [],
        software: live?.software || []
      },
      alerts,
      taskHistory,
      linkedTickets: asset.linkedTickets
    });

  } catch (error) {
    console.error('Error in devices.getById:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Queue a PowerShell / CMD command to execute on remote device
 */
async function executeCommand(req, res) {
  try {
    const { serialNumber } = req.params;
    const { command, shell = 'POWERSHELL' } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command text is required' });
    }

    const task = await agentOrchestrator.queueDeviceTask({
      serialNumber,
      commandType: shell.toUpperCase(),
      commandText: command,
      requestedBy: req.user?.name || 'Atera Admin'
    });

    return res.json({
      success: true,
      message: 'Command queued for execution',
      task
    });
  } catch (error) {
    console.error('Error executing command:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Execute script on device
 */
async function executeScript(req, res) {
  try {
    const { serialNumber } = req.params;
    const { scriptId, customCode, scriptName } = req.body;

    let code = customCode;
    let name = scriptName || 'Custom Script';

    if (scriptId) {
      const dbScript = await prisma.automationScript.findUnique({ where: { id: Number(scriptId) } });
      if (dbScript) {
        code = dbScript.code;
        name = dbScript.name;
      }
    }

    if (!code) {
      return res.status(400).json({ error: 'Script code or valid scriptId required' });
    }

    const task = await agentOrchestrator.queueDeviceTask({
      serialNumber,
      commandType: 'SCRIPT',
      commandText: code,
      parameters: { scriptName: name },
      requestedBy: req.user?.name || 'Atera Admin'
    });

    return res.json({
      success: true,
      message: `Script "${name}" queued for execution`,
      task
    });
  } catch (error) {
    console.error('Error in executeScript:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Remotely terminate a process on the device
 */
async function killProcess(req, res) {
  try {
    const { serialNumber } = req.params;
    const { pid, processName } = req.body;

    if (!pid) {
      return res.status(400).json({ error: 'Process ID (PID) is required' });
    }

    const commandText = `Stop-Process -Id ${pid} -Force -ErrorAction Stop; Write-Output "Successfully terminated process ${processName || ''} (PID: ${pid})"`;

    const task = await agentOrchestrator.queueDeviceTask({
      serialNumber,
      commandType: 'KILL_PROCESS',
      commandText,
      parameters: { pid, processName },
      requestedBy: req.user?.name || 'Atera Admin'
    });

    return res.json({
      success: true,
      message: `Kill signal sent for PID ${pid}`,
      task
    });
  } catch (error) {
    console.error('Error in killProcess:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Control Windows Service (Start, Stop, Restart)
 */
async function serviceAction(req, res) {
  try {
    const { serialNumber } = req.params;
    const { serviceName, action } = req.body; // action: 'START' | 'STOP' | 'RESTART'

    if (!serviceName || !action) {
      return res.status(400).json({ error: 'serviceName and action (START/STOP/RESTART) are required' });
    }

    let cmd = '';
    if (action.toUpperCase() === 'RESTART') {
      cmd = `Restart-Service -Name '${serviceName}' -Force; Get-Service -Name '${serviceName}' | Select-Object Name, Status`;
    } else if (action.toUpperCase() === 'STOP') {
      cmd = `Stop-Service -Name '${serviceName}' -Force; Get-Service -Name '${serviceName}' | Select-Object Name, Status`;
    } else {
      cmd = `Start-Service -Name '${serviceName}'; Get-Service -Name '${serviceName}' | Select-Object Name, Status`;
    }

    const task = await agentOrchestrator.queueDeviceTask({
      serialNumber,
      commandType: 'SERVICE_ACTION',
      commandText: cmd,
      parameters: { serviceName, action },
      requestedBy: req.user?.name || 'Atera Admin'
    });

    return res.json({
      success: true,
      message: `Service action '${action}' dispatched for '${serviceName}'`,
      task
    });
  } catch (error) {
    console.error('Error in serviceAction:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Remote Reboot or Shutdown
 */
async function rebootDevice(req, res) {
  try {
    const { serialNumber } = req.params;
    const { mode = 'REBOOT' } = req.body; // 'REBOOT' | 'SHUTDOWN'

    const cmd = mode === 'SHUTDOWN' 
      ? 'Stop-Computer -Force'
      : 'Restart-Computer -Force';

    const task = await agentOrchestrator.queueDeviceTask({
      serialNumber,
      commandType: 'REBOOT',
      commandText: cmd,
      parameters: { mode },
      requestedBy: req.user?.name || 'Atera Admin'
    });

    return res.json({
      success: true,
      message: `System ${mode.toLowerCase()} command dispatched`,
      task
    });
  } catch (error) {
    console.error('Error in rebootDevice:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get Task Status & Live Output (for terminal polling)
 */
async function getTaskStatus(req, res) {
  try {
    const { taskId } = req.params;

    const task = await prisma.deviceTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Error in getTaskStatus:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  list,
  getById,
  executeCommand,
  executeScript,
  killProcess,
  serviceAction,
  rebootDevice,
  getTaskStatus
};
