import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AteraAlerts() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, critical: 0, warning: 0, resolved: 0 });
  const [filterStatus, setFilterStatus] = useState('OPEN');
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const loadAlerts = async () => {
    try {
      const res = await api.get(`/alerts?status=${filterStatus}&severity=${filterSeverity}`);
      setAlerts(res.data.alerts || []);
      setCounts(res.data.counts || {});
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, [filterStatus, filterSeverity]);

  const handleAcknowledge = async (id) => {
    try {
      await api.post(`/alerts/${id}/acknowledge`);
      loadAlerts();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.post(`/alerts/${id}/resolve`);
      loadAlerts();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateTicket = async (id) => {
    try {
      const res = await api.post(`/alerts/${id}/create-ticket`);
      alert(`Incident Ticket ${res.data.ticket.ticketNo} generated and linked to this alert.`);
      loadAlerts();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>RMM Threshold Alerts & Monitoring</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-600 border border-rose-100">
              {counts.open} Open
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated threshold evaluation across all devices for CPU, RAM, Disk, and Antivirus protection.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-slate-450 tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{counts.total}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-rose-600 tracking-wider">Critical Breaches</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{counts.critical}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-amber-600 tracking-wider">Warnings</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{counts.warning}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-emerald-600 tracking-wider">Resolved</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{counts.resolved}</div>
        </div>
      </div>

      {/* Threshold Policies Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="space-y-0.5">
          <span className="text-3xs font-extrabold uppercase tracking-wider text-cyan-400">Active Threshold Policy</span>
          <div className="font-bold">Standard Workstation & Server Health Ruleset</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-3xs font-mono text-slate-300">
          <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">CPU &gt; 90% (Critical)</span>
          <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">RAM &gt; 90% (Warning)</span>
          <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">Disk &lt; 15% Free (Critical)</span>
          <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">Defender Stopped (Critical)</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5">
          {['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === s
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {['ALL', 'CRITICAL', 'WARNING'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterSeverity === sev
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sev === 'ALL' ? 'All Severities' : sev}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-3xs font-extrabold uppercase text-slate-450 tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-3">Device Name</th>
                <th className="py-3.5 px-4">Alert Title & Detail</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Detected At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan="7" className="py-12 text-center text-slate-400">Loading alerts…</td></tr>
              ) : alerts.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-slate-400">No alerts matching filter criteria.</td></tr>
              ) : (
                alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase ${
                          a.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${a.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                        {a.severity}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-bold text-slate-900">
                      {a.deviceName}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{a.title}</div>
                      <div className="text-3xs text-slate-500 mt-0.5">{a.description}</div>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-3xs text-slate-600">
                      {a.category}
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-3xs font-bold">
                        {a.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-3xs text-slate-450">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      {a.status !== 'RESOLVED' && (
                        <>
                          <button
                            onClick={() => handleCreateTicket(a.id)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-3xs rounded-lg transition-colors shadow-sm"
                          >
                            + Ticket
                          </button>
                          {a.status === 'OPEN' && (
                            <button
                              onClick={() => handleAcknowledge(a.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-3xs rounded-lg transition-colors"
                            >
                              Ack
                            </button>
                          )}
                          <button
                            onClick={() => handleResolve(a.id)}
                            className="px-2 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-bold text-3xs rounded-lg transition-colors"
                          >
                            Resolve
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
