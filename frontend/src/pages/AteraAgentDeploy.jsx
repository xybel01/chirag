import { useState, useEffect } from 'react';

export default function AteraAgentDeploy() {
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  // Dynamically determine current portal URL (live Vercel or localhost)
  const defaultUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nplitinventory.vercel.app';
  const [serverUrl, setServerUrl] = useState(defaultUrl);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setServerUrl(window.location.origin);
    }
  }, []);

  const cleanServerUrl = (serverUrl || defaultUrl).replace(/\/+$/, '');
  const installCmd = `irm ${cleanServerUrl}/install.ps1 | iex`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleTestHealth = async () => {
    setTesting(true);
    setTestStatus('Pinging portal agent telemetry listener...');
    try {
      const res = await fetch(`${cleanServerUrl}/api/health`);
      const data = await res.json();
      if (data.status === 'ok') {
        setTestStatus(`SUCCESS: Connected to ${cleanServerUrl}! Agent listener is actively responding.`);
      } else {
        setTestStatus(`WARNING: Received unexpected status from ${cleanServerUrl}.`);
      }
    } catch (e) {
      setTestStatus(`ERROR: Could not connect to ${cleanServerUrl}/api/health. Please verify network access.`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>Atera RMM Agent Deployment Center</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
            v2.5 Cloud & On-Premise
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Deploy lightweight endpoint monitoring agents to Windows workstations, servers, macOS, and Linux systems.
        </p>
      </div>

      {/* Target Server URL Selector / Configurator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-3xs font-extrabold uppercase tracking-wider text-slate-500">
              Active Portal / Telemetry Server URL
            </label>
            <p className="text-3xs text-slate-450">
              The agent will post all vitals, heartbeats, and pull commands from this live endpoint.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-3xs font-bold">
            <button
              onClick={() => setServerUrl(typeof window !== 'undefined' ? window.location.origin : 'https://nplitinventory.vercel.app')}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              Current Domain ({typeof window !== 'undefined' ? window.location.hostname : 'Cloud'})
            </button>
            <button
              onClick={() => setServerUrl('http://localhost:5005')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Localhost (5005)
            </button>
          </div>
        </div>

        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://nplitinventory.vercel.app"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>

      {/* Primary 1-Click PowerShell Installation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-extrabold text-xs uppercase tracking-wider text-cyan-300">
              One-Click Windows Deployment (Automated Setup)
            </span>
          </div>
          <button
            onClick={copyToClipboard}
            className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-md shadow-cyan-500/20 transition-all active:scale-95 flex items-center gap-1.5"
          >
            {copied ? 'Copied to Clipboard!' : 'Copy 1-Liner'}
          </button>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 select-all overflow-x-auto shadow-inner">
          {installCmd}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-3xs text-slate-300 pt-1">
          <div className="flex items-start gap-2">
            <span className="font-bold text-cyan-400">1.</span>
            <span>Right-click Windows Start and open <strong>PowerShell as Administrator</strong>.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-cyan-400">2.</span>
            <span>Paste the command and hit Enter. The agent installs to <code>C:\Program Files\AteraAgent</code>.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-cyan-400">3.</span>
            <span>Configures a background task to report metrics and listen for commands automatically.</span>
          </div>
        </div>
      </div>

      {/* Standalone Installer Downloads */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">Direct Downloadable Agent Packages</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-configured with target server <strong>{cleanServerUrl}</strong> for offline setups, GPO, or Intune.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Batch Installer */}
          <div className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Windows (.bat)</span>
              <h3 className="font-extrabold text-sm text-slate-900 pt-1">Install-AteraAgent.bat</h3>
              <p className="text-3xs text-slate-500">1-Click batch installer. Right click and select "Run as administrator".</p>
            </div>
            <a
              href="/Install-AteraAgent.bat"
              download="Install-AteraAgent.bat"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl text-center block transition-colors"
            >
              Download .BAT Installer
            </a>
          </div>

          {/* PowerShell Agent Script */}
          <div className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">PowerShell (.ps1)</span>
              <h3 className="font-extrabold text-sm text-slate-900 pt-1">AteraAgent.ps1</h3>
              <p className="text-3xs text-slate-500">Full source agent script with continuous monitoring.</p>
            </div>
            <a
              href="/AteraAgent.ps1"
              download="AteraAgent.ps1"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl text-center block transition-colors"
            >
              Download AteraAgent.ps1
            </a>
          </div>

          {/* Python Agent */}
          <div className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-50 text-cyan-700">Cross-Platform (.py)</span>
              <h3 className="font-extrabold text-sm text-slate-900 pt-1">atera_agent.py</h3>
              <p className="text-3xs text-slate-500">Python 3 agent for macOS, Linux, and Windows terminal servers.</p>
            </div>
            <a
              href="/atera_agent.py"
              download="atera_agent.py"
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl text-center block transition-colors"
            >
              Download Python Agent
            </a>
          </div>
        </div>
      </div>

      {/* Connectivity & Health Test */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-xs text-slate-800">Verify Portal Agent Ingestion</h3>
          <p className="text-3xs text-slate-500 mt-0.5">
            Test whether this machine can reach <strong>{cleanServerUrl}</strong>.
          </p>
          {testStatus && (
            <div className={`text-xs font-bold mt-2 ${testStatus.startsWith('SUCCESS') ? 'text-emerald-600' : 'text-rose-600'}`}>
              {testStatus}
            </div>
          )}
        </div>

        <button
          onClick={handleTestHealth}
          disabled={testing}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-800 font-bold text-xs rounded-xl shadow-sm transition-colors whitespace-nowrap"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}
