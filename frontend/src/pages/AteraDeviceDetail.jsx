import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function AteraDeviceDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'terminal';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [deviceData, setDeviceData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Terminal state
  const [commandInput, setCommandInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([
    { type: 'system', text: 'Atera Remote PowerShell Console v2.5 initialized.' },
    { type: 'system', text: 'Connecting to agent session...' }
  ]);
  const [runningCmd, setRunningCmd] = useState(false);
  const terminalEndRef = useRef(null);

  // Process & Service Search
  const [processSearch, setProcessSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [softwareSearch, setSoftwareSearch] = useState('');

  // Script Runner State
  const [scriptsList, setScriptsList] = useState([]);
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [customScriptCode, setCustomScriptCode] = useState('');
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptOutput, setScriptOutput] = useState('');

  const loadDevice = async () => {
    try {
      const res = await api.get(`/devices/${id}`);
      setDeviceData(res.data);
    } catch (err) {
      console.error('Error loading device:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadScripts = async () => {
    try {
      const res = await api.get('/scripts');
      setScriptsList(res.data.scripts || []);
      if (res.data.scripts?.length > 0 && !selectedScriptId) {
        setSelectedScriptId(res.data.scripts[0].id);
        setCustomScriptCode(res.data.scripts[0].code);
      }
    } catch (err) {
      console.error('Error loading scripts:', err);
    }
  };

  useEffect(() => {
    loadDevice();
    loadScripts();
    const interval = setInterval(loadDevice, 6000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Execute Command in Terminal
  const handleExecuteCommand = async (e) => {
    if (e) e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || !deviceData?.device?.serialNumber) return;

    setRunningCmd(true);
    setCommandInput('');
    setTerminalLogs((prev) => [
      ...prev,
      { type: 'input', text: `PS C:\\> ${cmd}` },
      { type: 'info', text: 'Queued for remote agent execution...' }
    ]);

    try {
      const res = await api.post(`/devices/${deviceData.device.serialNumber}/command`, {
        command: cmd,
        shell: 'POWERSHELL'
      });

      const taskId = res.data.task.id;
      pollTask(taskId);
    } catch (err) {
      setRunningCmd(false);
      setTerminalLogs((prev) => [
        ...prev,
        { type: 'error', text: 'Error dispatching command: ' + (err.response?.data?.error || err.message) }
      ]);
    }
  };

  // Poll Task Status until complete
  const pollTask = async (taskId) => {
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get(`/devices/tasks/${taskId}`);
        const task = res.data.task;

        if (task.status === 'COMPLETED' || task.status === 'FAILED') {
          clearInterval(pollInterval);
          setRunningCmd(false);
          setTerminalLogs((prev) => [
            ...prev,
            task.output ? { type: 'output', text: task.output } : null,
            task.errorOutput ? { type: 'error', text: task.errorOutput } : null,
            {
              type: 'system',
              text: `Command finished with exit code ${task.exitCode} (${new Date().toLocaleTimeString()})`
            }
          ].filter(Boolean));
        } else if (attempts > 30) {
          // Timeout after 30s
          clearInterval(pollInterval);
          setRunningCmd(false);
          setTerminalLogs((prev) => [
            ...prev,
            { type: 'error', text: 'Command execution timed out or agent is waiting.' }
          ]);
        }
      } catch (err) {
        clearInterval(pollInterval);
        setRunningCmd(false);
      }
    }, 1500);
  };

  // Kill Process
  const handleKillProcess = async (pid, name) => {
    if (!confirm(`Are you sure you want to kill process "${name}" (PID: ${pid}) on ${deviceData.device.deviceName}?`)) return;

    try {
      await api.post(`/devices/${deviceData.device.serialNumber}/kill-process`, {
        pid,
        processName: name
      });
      alert(`Kill signal sent for process ${name} (PID: ${pid}).`);
      loadDevice();
    } catch (err) {
      alert('Error killing process: ' + (err.response?.data?.error || err.message));
    }
  };

  // Service Action
  const handleServiceAction = async (serviceName, action) => {
    try {
      await api.post(`/devices/${deviceData.device.serialNumber}/service-action`, {
        serviceName,
        action
      });
      alert(`Service action "${action}" sent for "${serviceName}".`);
      loadDevice();
    } catch (err) {
      alert('Error controlling service: ' + (err.response?.data?.error || err.message));
    }
  };

  // Run Remote Script
  const handleRunScript = async () => {
    if (!customScriptCode) return;
    setScriptRunning(true);
    setScriptOutput('Dispatching script to remote endpoint...');

    try {
      const res = await api.post(`/devices/${deviceData.device.serialNumber}/script`, {
        scriptId: selectedScriptId || undefined,
        customCode: customScriptCode,
        scriptName: 'Atera Script Execution'
      });

      const taskId = res.data.task.id;
      // Poll script result
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const taskRes = await api.get(`/devices/tasks/${taskId}`);
          const task = taskRes.data.task;

          if (task.status === 'COMPLETED' || task.status === 'FAILED') {
            clearInterval(interval);
            setScriptRunning(false);
            setScriptOutput(
              (task.output || '') + (task.errorOutput ? `\n[ERROR]:\n${task.errorOutput}` : '') + `\n\n[Status: ${task.status} | Exit Code: ${task.exitCode}]`
            );
          } else if (attempts > 40) {
            clearInterval(interval);
            setScriptRunning(false);
            setScriptOutput('Script execution timed out waiting for agent.');
          }
        } catch (e) {
          clearInterval(interval);
          setScriptRunning(false);
        }
      }, 1500);
    } catch (err) {
      setScriptRunning(false);
      setScriptOutput('Error dispatching script: ' + (err.response?.data?.error || err.message));
    }
  };

  // Reboot Device
  const handleReboot = async (mode = 'REBOOT') => {
    if (!confirm(`Are you sure you want to trigger remote ${mode.toLowerCase()} on this machine?`)) return;
    try {
      await api.post(`/devices/${deviceData.device.serialNumber}/reboot`, { mode });
      alert(`System ${mode.toLowerCase()} signal dispatched.`);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-slate-400 font-bold">Connecting to endpoint telemetry…</div>;
  }

  if (!deviceData?.device) {
    return (
      <div className="text-center py-24 text-slate-500">
        <h2 className="text-xl font-bold">Device Not Found</h2>
        <Link to="/devices" className="text-indigo-600 font-bold mt-2 inline-block">&larr; Return to Devices</Link>
      </div>
    );
  }

  const d = deviceData.device;
  const live = deviceData.liveTelemetry || {};

  const filteredProcesses = (live.processes || []).filter(p =>
    p.name.toLowerCase().includes(processSearch.toLowerCase()) || String(p.pid).includes(processSearch)
  );

  const filteredServices = (live.services || []).filter(s =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase()) || s.displayName.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const filteredSoftware = (live.software || []).filter(s =>
    s.name.toLowerCase().includes(softwareSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-450">
          <Link to="/devices" className="hover:text-indigo-600">RMM Devices</Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">{d.deviceName}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRefreshing(true); loadDevice(); }}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Vitals
          </button>

          <button
            onClick={() => handleReboot('REBOOT')}
            className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart PC
          </button>
        </div>
      </div>

      {/* Top Device Telemetry Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Machine Info */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${
                  d.isOnline
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${d.isOnline ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`}></span>
                {d.isOnline ? 'ONLINE & READY' : 'OFFLINE'}
              </span>

              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-mono text-cyan-300">
                {d.assetTag}
              </span>

              <span className="text-xs text-slate-400 font-mono">
                SN: {d.serialNumber}
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight">{d.deviceName}</h1>

            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span><strong>OS:</strong> {d.operatingSystem} ({d.windowsVersion})</span>
              <span><strong>IP:</strong> <span className="font-mono text-cyan-400">{d.ipAddress}</span></span>
              <span><strong>User:</strong> {d.loggedInUser}</span>
              <span><strong>CPU:</strong> {d.cpu}</span>
              <span><strong>RAM:</strong> {d.ram}</span>
            </div>
          </div>

          {/* Real-time Hardware Gauges */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            {/* CPU Gauge */}
            <div className="text-center">
              <div className="text-3xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">CPU Load</div>
              <div className="text-xl font-black font-mono text-cyan-400">{d.cpuUsage}%</div>
              <div className="w-16 bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    d.cpuUsage > 85 ? 'bg-rose-500' : d.cpuUsage > 60 ? 'bg-amber-500' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, d.cpuUsage)}%` }}
                ></div>
              </div>
            </div>

            <div className="h-10 w-px bg-slate-800"></div>

            {/* RAM Gauge */}
            <div className="text-center">
              <div className="text-3xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">Memory</div>
              <div className="text-xl font-black font-mono text-indigo-400">{d.ramUsage}%</div>
              <div className="w-16 bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    d.ramUsage > 85 ? 'bg-rose-500' : d.ramUsage > 70 ? 'bg-amber-500' : 'bg-indigo-400'
                  }`}
                  style={{ width: `${Math.min(100, d.ramUsage)}%` }}
                ></div>
              </div>
            </div>

            <div className="h-10 w-px bg-slate-800"></div>

            {/* Disk Space Gauge */}
            <div className="text-center">
              <div className="text-3xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">Disk C:</div>
              <div className="text-xl font-black font-mono text-emerald-400">{d.diskFreeGB} GB</div>
              <div className="w-16 bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    d.diskUsage > 85 ? 'bg-rose-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, d.diskUsage)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1">
        {[
          { id: 'terminal', label: '💻 PowerShell Terminal' },
          { id: 'processes', label: `⚙️ Processes (${live.processes?.length || 0})` },
          { id: 'services', label: `🛠️ Services (${live.services?.length || 0})` },
          { id: 'scripts', label: '📜 Run Scripts' },
          { id: 'software', label: `📦 Software (${live.software?.length || 0})` },
          { id: 'hardware', label: '🔍 Hardware & Security' },
          { id: 'alerts', label: `⚠️ Alerts (${deviceData.alerts?.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSearchParams({ tab: tab.id });
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: REMOTE POWERSHELL TERMINAL */}
      {activeTab === 'terminal' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col h-[560px] text-emerald-400 font-mono text-xs">
          {/* Terminal Top Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400 text-3xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="font-bold text-slate-300 ml-2">Atera Remote PowerShell Console &bull; {d.deviceName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTerminalLogs([])}
                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-3xs font-semibold"
              >
                Clear Screen
              </button>
            </div>
          </div>

          {/* Quick Command Shortcuts */}
          <div className="py-2.5 border-b border-slate-800/80 flex flex-wrap items-center gap-1.5 text-3xs">
            <span className="text-slate-500 font-bold">Quick Presets:</span>
            {[
              'ipconfig /all',
              'Get-Service | Where Status -eq "Running"',
              'Get-Process | Sort-Object WorkingSet64 -Descending | Select -First 10',
              'whoami',
              'sfc /scannow',
              'Get-BitLockerVolume -MountPoint C:'
            ].map((preset) => (
              <button
                key={preset}
                onClick={() => setCommandInput(preset)}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 transition-colors"
              >
                {preset.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Terminal Console Output Scroll Area */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 select-text font-mono">
            {terminalLogs.map((log, index) => (
              <div key={index} className="leading-relaxed">
                {log.type === 'input' && (
                  <div className="text-white font-bold">{log.text}</div>
                )}
                {log.type === 'output' && (
                  <pre className="text-emerald-400 whitespace-pre-wrap">{log.text}</pre>
                )}
                {log.type === 'error' && (
                  <pre className="text-rose-400 whitespace-pre-wrap">{log.text}</pre>
                )}
                {log.type === 'info' && (
                  <div className="text-cyan-400 italic text-3xs">{log.text}</div>
                )}
                {log.type === 'system' && (
                  <div className="text-slate-500 text-3xs">{log.text}</div>
                )}
              </div>
            ))}
            {runningCmd && (
              <div className="flex items-center gap-2 text-cyan-400 text-3xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Waiting for remote agent execution and stdout stream...
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Command Prompt Input */}
          <form onSubmit={handleExecuteCommand} className="pt-3 border-t border-slate-800 flex items-center gap-2">
            <span className="text-cyan-400 font-bold">PS C:\&gt;</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              disabled={runningCmd}
              placeholder="Type any PowerShell command and press Enter..."
              className="flex-1 bg-transparent text-emerald-300 focus:outline-none font-mono text-xs"
            />
            <button
              type="submit"
              disabled={runningCmd || !commandInput.trim()}
              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg text-xs transition-all active:scale-95"
            >
              Run
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: PROCESSES */}
      {activeTab === 'processes' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Active Running Processes</h2>
              <p className="text-3xs text-slate-450 mt-0.5">Top processes reported live by the Atera Endpoint Agent</p>
            </div>

            <input
              type="text"
              placeholder="Search by process name or PID..."
              value={processSearch}
              onChange={(e) => setProcessSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64"
            />
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-3xs font-extrabold uppercase text-slate-450 tracking-wider sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">PID</th>
                  <th className="py-3 px-4">Process Name</th>
                  <th className="py-3 px-4">Memory (Working Set)</th>
                  <th className="py-3 px-4">CPU Time</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredProcesses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">No processes found.</td>
                  </tr>
                ) : (
                  filteredProcesses.map((p) => (
                    <tr key={p.pid} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-3xs text-slate-500">{p.pid}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">{p.name}</td>
                      <td className="py-2.5 px-4 font-mono text-3xs text-indigo-600 font-bold">{p.memoryMB} MB</td>
                      <td className="py-2.5 px-4 font-mono text-3xs text-slate-500">{p.cpu}s</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleKillProcess(p.pid, p.name)}
                          className="px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-3xs font-bold transition-colors"
                        >
                          Kill Process
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SERVICES */}
      {activeTab === 'services' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Windows System Services</h2>
              <p className="text-3xs text-slate-450 mt-0.5">Control system services remotely with 1 click</p>
            </div>

            <input
              type="text"
              placeholder="Search services..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64"
            />
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-3xs font-extrabold uppercase text-slate-450 tracking-wider sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Service Name</th>
                  <th className="py-3 px-4">Display Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Remote Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-400">No services found.</td>
                  </tr>
                ) : (
                  filteredServices.map((s) => (
                    <tr key={s.name} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800 text-xs">{s.name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{s.displayName}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-3xs font-extrabold ${
                            s.status.toLowerCase().includes('run')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleServiceAction(s.name, 'START')}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-3xs font-bold"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => handleServiceAction(s.name, 'STOP')}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-3xs font-bold"
                        >
                          Stop
                        </button>
                        <button
                          onClick={() => handleServiceAction(s.name, 'RESTART')}
                          className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-3xs font-bold"
                        >
                          Restart
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RUN SCRIPTS */}
      {activeTab === 'scripts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Script Editor & Picker */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Execute Remote Script</h2>
              <p className="text-3xs text-slate-450 mt-0.5">Select a pre-built script from the library or write custom PowerShell code</p>
            </div>

            <div className="space-y-1">
              <label className="text-3xs font-extrabold uppercase tracking-wider text-slate-500">Preset Library</label>
              <select
                value={selectedScriptId}
                onChange={(e) => {
                  setSelectedScriptId(e.target.value);
                  const found = scriptsList.find(s => s.id === Number(e.target.value));
                  if (found) setCustomScriptCode(found.code);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
              >
                {scriptsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.category}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-3xs font-extrabold uppercase tracking-wider text-slate-500">PowerShell Script Code</label>
              <textarea
                rows={10}
                value={customScriptCode}
                onChange={(e) => setCustomScriptCode(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl focus:outline-none"
              />
            </div>

            <button
              onClick={handleRunScript}
              disabled={scriptRunning}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {scriptRunning ? 'Executing on remote endpoint...' : 'Execute Script on Device Now'}
            </button>
          </div>

          {/* Script Execution Output */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col font-mono text-xs text-white">
            <div className="text-3xs font-extrabold uppercase tracking-wider text-slate-450 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>Script Execution Log (stdout / stderr)</span>
              {scriptRunning && <span className="text-cyan-400 animate-pulse">Running…</span>}
            </div>

            <pre className="flex-1 overflow-y-auto py-3 text-emerald-400 whitespace-pre-wrap">
              {scriptOutput || 'Execution output will appear here after clicking "Execute Script".'}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 5: SOFTWARE INVENTORY */}
      {activeTab === 'software' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Installed Software Catalog</h2>
              <p className="text-3xs text-slate-450 mt-0.5">Catalog of installed applications detected via Windows Registry</p>
            </div>

            <input
              type="text"
              placeholder="Search software by name..."
              value={softwareSearch}
              onChange={(e) => setSoftwareSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64"
            />
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-3xs font-extrabold uppercase text-slate-450 tracking-wider sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Application Name</th>
                  <th className="py-3 px-4">Installed Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSoftware.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="py-8 text-center text-slate-400">No applications recorded.</td>
                  </tr>
                ) : (
                  filteredSoftware.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-bold text-slate-800">{s.name}</td>
                      <td className="py-2 px-4 font-mono text-3xs text-slate-500">{s.version || 'Version unknown'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: HARDWARE & SECURITY */}
      {activeTab === 'hardware' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Hardware Specifications</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-450">Processor:</span> <span className="font-bold text-slate-800">{d.cpu}</span></div>
              <div className="flex justify-between"><span className="text-slate-450">Memory (RAM):</span> <span className="font-bold text-slate-800">{d.ram}</span></div>
              <div className="flex justify-between"><span className="text-slate-450">Storage Capacity:</span> <span className="font-bold text-slate-800">{d.storage}</span></div>
              <div className="flex justify-between"><span className="text-slate-450">Manufacturer:</span> <span className="font-bold text-slate-800">{d.manufacturer}</span></div>
              <div className="flex justify-between"><span className="text-slate-450">Model:</span> <span className="font-bold text-slate-800">{d.model}</span></div>
              <div className="flex justify-between"><span className="text-slate-450">Serial Number:</span> <span className="font-mono font-bold text-slate-800">{d.serialNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-450">MAC Address:</span> <span className="font-mono font-bold text-slate-800">{d.macAddress}</span></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Endpoint Security State</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-450">Windows Defender:</span>
                <span className="font-bold text-emerald-600">{d.defenderStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">BitLocker Encryption:</span>
                <span className="font-bold text-indigo-600">{d.bitLockerStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">Battery Health Charge:</span>
                <span className="font-bold text-slate-800">{d.batteryHealthPct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">Domain / Workgroup:</span>
                <span className="font-bold text-slate-800">{d.domainName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">Assigned Department:</span>
                <span className="font-bold text-slate-800">{d.department}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ALERTS */}
      {activeTab === 'alerts' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800 text-sm">Alert History for this Endpoint</h2>
          <div className="space-y-2">
            {(deviceData.alerts || []).length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No monitoring alerts recorded for this device.</div>
            ) : (
              deviceData.alerts.map((a) => (
                <div key={a.id} className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${a.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                      {a.title}
                    </div>
                    <div className="text-3xs text-slate-500 mt-0.5">{a.description}</div>
                  </div>
                  <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
