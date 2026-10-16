import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function AteraDevices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0, criticalAlerts: 0 });
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const loadDevices = async () => {
    try {
      const res = await api.get(`/devices?status=${filterStatus}&type=${filterType}&q=${search}`);
      setDevices(res.data.devices || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 6000);
    return () => clearInterval(interval);
  }, [filterStatus, filterType, search]);

  const copyInstallCommand = () => {
    const cmd = 'irm http://localhost:5005/api/agent/install.ps1 | iex';
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 3000);
  };

  const handleReboot = async (serialNumber, name) => {
    if (!confirm(`Are you sure you want to trigger a remote restart on ${name}?`)) return;
    try {
      await api.post(`/devices/${serialNumber}/reboot`, { mode: 'REBOOT' });
      alert(`Restart signal successfully dispatched to ${name}.`);
    } catch (err) {
      alert('Error triggering reboot: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>RMM Devices & Endpoints</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
              {devices.length} Total
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry, remote PowerShell terminal, script execution, and process control.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInstallModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Install Agent
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'ONLINE', 'OFFLINE'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' && `All (${summary.total})`}
              {status === 'ONLINE' && `Online (${summary.online})`}
              {status === 'OFFLINE' && `Offline (${summary.offline})`}
            </button>
          ))}

          <span className="h-5 w-px bg-slate-200 mx-1 hidden sm:block"></span>

          {['ALL', 'WORKSTATION', 'SERVER'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterType === t
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t === 'ALL' ? 'All Types' : `${t}s`}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative min-w-[280px]">
          <input
            type="text"
            placeholder="Search by device name, IP, serial, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Main Devices Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-3xs font-extrabold uppercase text-slate-450 tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Device & Hostname</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Type / OS</th>
                <th className="py-3.5 px-3">Assigned User</th>
                <th className="py-3.5 px-3">IP Address</th>
                <th className="py-3.5 px-3">CPU</th>
                <th className="py-3.5 px-3">Memory</th>
                <th className="py-3.5 px-3">Disk Space</th>
                <th className="py-3.5 px-3">Security</th>
                <th className="py-3.5 px-4 text-right">RMM Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && devices.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">Loading live endpoints…</td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    No devices matched your filter criteria.
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.serialNumber} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 leading-tight">
                        <Link to={`/devices/${d.serialNumber}`} className="hover:text-indigo-600 transition-colors">
                          {d.deviceName}
                        </Link>
                      </div>
                      <div className="text-3xs text-slate-450 font-mono mt-0.5">
                        {d.assetTag} &bull; {d.manufacturer} {d.model}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-extrabold ${
                          d.isOnline
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            d.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        ></span>
                        {d.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-800">{d.deviceType}</div>
                      <div className="text-3xs text-slate-450 truncate max-w-[130px]">{d.operatingSystem}</div>
                    </td>

                    <td className="py-3.5 px-3 font-semibold text-slate-700">
                      {d.assignedTo}
                    </td>

                    <td className="py-3.5 px-3 font-mono text-3xs text-slate-600">
                      {d.ipAddress}
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              d.cpuUsage > 85 ? 'bg-rose-500' : d.cpuUsage > 60 ? 'bg-amber-500' : 'bg-cyan-500'
                            }`}
                            style={{ width: `${Math.min(100, d.cpuUsage)}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-3xs">{d.cpuUsage}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              d.ramUsage > 85 ? 'bg-rose-500' : d.ramUsage > 70 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, d.ramUsage)}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-3xs">{d.ramUsage}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              d.diskUsage > 85 ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, d.diskUsage)}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-3xs">{d.diskUsage}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          title={`Defender: ${d.defenderStatus}`}
                          className={`w-2 h-2 rounded-full ${
                            d.defenderStatus.toLowerCase().includes('run') ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        ></span>
                        <span className="text-3xs font-semibold text-slate-600">
                          {d.bitLockerStatus.toLowerCase().includes('on') ? 'BitLocker' : 'Unencrypted'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/devices/${d.serialNumber}?tab=terminal`)}
                          title="Open Remote PowerShell Terminal"
                          className="px-2 py-1 rounded-lg bg-slate-900 text-cyan-400 hover:bg-slate-800 text-3xs font-bold transition-all shadow-sm flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Terminal
                        </button>

                        <button
                          onClick={() => navigate(`/devices/${d.serialNumber}?tab=scripts`)}
                          title="Run Remote Script"
                          className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleReboot(d.serialNumber, d.deviceName)}
                          title="Remote Restart"
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>

                        <button
                          onClick={() => navigate(`/devices/${d.serialNumber}`)}
                          title="Device Details"
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Install Agent Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Install Atera RMM Endpoint Agent</h3>
                <p className="text-xs text-slate-500 mt-0.5">Deploy the agent to start real-time telemetry and remote control.</p>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {/* Quick 1-Liner PowerShell Command */}
            <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-extrabold uppercase tracking-wider text-cyan-400">
                  Recommended: Windows 1-Click PowerShell
                </span>
                <button
                  onClick={copyInstallCommand}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors flex items-center gap-1.5"
                >
                  {copiedCmd ? 'Copied!' : 'Copy Command'}
                </button>
              </div>
              <div className="font-mono text-xs bg-slate-950 p-2.5 rounded-lg text-emerald-400 select-all overflow-x-auto">
                irm http://localhost:5005/api/agent/install.ps1 | iex
              </div>
              <p className="text-3xs text-slate-400">
                Run Windows PowerShell as Administrator and paste the command above. It will download, configure the background task, and start monitoring immediately.
              </p>
            </div>

            {/* Download Installers */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-700">Or Download Direct Files:</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a
                  href="/api/agent/download/powershell"
                  download="AteraAgent.ps1"
                  className="p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center"
                >
                  <div className="font-extrabold text-xs text-slate-900">AteraAgent.ps1</div>
                  <div className="text-3xs text-slate-450 mt-0.5">PowerShell Script</div>
                </a>

                <a
                  href="/api/agent/download/installer-bat"
                  download="Install-AteraAgent.bat"
                  className="p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center"
                >
                  <div className="font-extrabold text-xs text-slate-900">Install-Agent.bat</div>
                  <div className="text-3xs text-slate-450 mt-0.5">1-Click Batch Installer</div>
                </a>

                <a
                  href="/api/agent/download/python"
                  download="atera_agent.py"
                  className="p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center"
                >
                  <div className="font-extrabold text-xs text-slate-900">atera_agent.py</div>
                  <div className="text-3xs text-slate-450 mt-0.5">Mac / Linux / Win</div>
                </a>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
