import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function AteraDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    online: 0,
    offline: 0,
    criticalAlerts: 0
  });
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ticketCounts, setTicketCounts] = useState({
    total: 0,
    open: 0,
    pending: 0,
    resolved: 0,
    critical: 0
  });

  const loadData = async () => {
    try {
      const [devRes, alertRes, ticketRes] = await Promise.all([
        api.get('/devices'),
        api.get('/alerts?status=OPEN'),
        api.get('/tickets')
      ]);

      setSummary(devRes.data.summary || {});
      setDevices(devRes.data.devices || []);
      setAlerts(alertRes.data.alerts || []);
      setTicketCounts(ticketRes.data.counts || {});
    } catch (err) {
      console.error('Error loading Atera dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000); // Poll every 8s for live telemetry
    return () => clearInterval(interval);
  }, []);

  const handleResolveAlert = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/resolve`);
      loadData();
    } catch (err) {
      alert('Error resolving alert: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateTicket = async (alertId) => {
    try {
      const res = await api.post(`/alerts/${alertId}/create-ticket`);
      alert(`Ticket ${res.data.ticket.ticketNo} created successfully!`);
      loadData();
    } catch (err) {
      alert('Error creating ticket: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Atera RMM & PSA Platform
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Live Telemetry Engine Active
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">IT Operations & Monitoring Command Center</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Real-time device vitals, automated threshold alerts, one-click remote PowerShell terminal, and IT helpdesk service automation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/agent-deploy"
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Install Agent
          </Link>

          <Link
            to="/scripts"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            Run Remote Script
          </Link>

          <Link
            to="/tickets"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-extrabold rounded-xl transition-all active:scale-95"
          >
            Helpdesk Tickets
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Devices */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Devices</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{summary.total}</div>
          <div className="text-3xs text-slate-450 mt-1 font-semibold">Total Monitored Endpoints</div>
        </div>

        {/* Online Devices */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <span>Online</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{summary.online}</div>
          <div className="text-3xs text-emerald-700/80 mt-1 font-semibold">Actively Streaming</div>
        </div>

        {/* Offline Devices */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Offline</span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
          </div>
          <div className="text-2xl font-black text-slate-700 mt-2">{summary.offline}</div>
          <div className="text-3xs text-slate-450 mt-1 font-semibold">Idle / Disconnected</div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-rose-600 text-xs font-bold uppercase tracking-wider">
            <span>Critical Alerts</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">{summary.criticalAlerts}</div>
          <div className="text-3xs text-rose-500 mt-1 font-semibold">Threshold Breaches</div>
        </div>

        {/* Open Tickets */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold uppercase tracking-wider">
            <span>Open Tickets</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{ticketCounts.open}</div>
          <div className="text-3xs text-amber-600/80 mt-1 font-semibold">Helpdesk Queue</div>
        </div>

        {/* SLA Compliance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-indigo-600 text-xs font-bold uppercase tracking-wider">
            <span>SLA Health</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-2">98.4%</div>
          <div className="text-3xs text-indigo-600/80 mt-1 font-semibold">Target &gt; 95%</div>
        </div>
      </div>

      {/* Main Grid: Devices Table + Live Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monitored Devices List (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 text-sm tracking-wide">Live Monitored Endpoints</h2>
              <p className="text-3xs text-slate-450 mt-0.5">Real-time processor, memory, and disk telemetry</p>
            </div>
            <Link
              to="/devices"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View All Devices &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-3xs font-extrabold uppercase text-slate-450 tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">CPU</th>
                  <th className="py-3 px-3">RAM</th>
                  <th className="py-3 px-3">Disk</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400 text-xs">
                      No devices connected yet. Run the agent installer to start monitoring.
                    </td>
                  </tr>
                ) : (
                  devices.slice(0, 8).map((d) => (
                    <tr key={d.serialNumber} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 leading-tight">
                          <Link to={`/devices/${d.serialNumber}`} className="hover:text-indigo-600">
                            {d.deviceName}
                          </Link>
                        </div>
                        <div className="text-3xs text-slate-450 font-mono mt-0.5">
                          {d.ipAddress} &bull; {d.operatingSystem}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-extrabold ${
                            d.isOnline
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
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
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/devices/${d.serialNumber}?tab=terminal`)}
                            title="Open Remote PowerShell Terminal"
                            className="p-1.5 rounded-lg bg-slate-900 text-cyan-400 hover:bg-slate-800 transition-colors shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
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
                            onClick={() => navigate(`/devices/${d.serialNumber}`)}
                            title="Manage Device"
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
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

        {/* Real-time Alerts Feed (1 col) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <h2 className="font-bold text-slate-800 text-sm tracking-wide">Monitoring Alerts</h2>
            </div>
            <Link to="/alerts" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
              View All ({alerts.length}) &rarr;
            </Link>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-3 max-h-[420px]">
            {alerts.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400">
                <svg className="w-10 h-10 text-emerald-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs font-bold text-slate-700">All Systems Nominal</div>
                <div className="text-3xs text-slate-450 mt-0.5">No active threshold alerts detected</div>
              </div>
            ) : (
              alerts.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    a.severity === 'CRITICAL'
                      ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                      : 'bg-amber-50/50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-xs leading-tight flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          a.severity === 'CRITICAL' ? 'bg-rose-600' : 'bg-amber-500'
                        }`}
                      ></span>
                      {a.title}
                    </div>
                    <span className="text-3xs font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-white/80 border border-slate-200">
                      {a.severity}
                    </span>
                  </div>

                  <div className="text-3xs text-slate-600 mt-1 line-clamp-2">{a.description}</div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-3xs">
                    <span className="font-bold text-slate-500">{a.deviceName}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCreateTicket(a.id)}
                        className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
                      >
                        + Ticket
                      </button>
                      <button
                        onClick={() => handleResolveAlert(a.id)}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
