import { useEffect, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import { fmtDate } from '../utils/format.js';

export default function Monitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadStatus = async () => {
    try {
      const res = await api.get('/monitoring/status');
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to pull monitor alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // Refresh stats every 5 seconds dynamically to feel like live PRTG/SolarWinds graphs
    const interval = setInterval(() => {
      loadStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading Infrastructure Monitor…</div>;

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="SolarWinds Network & Server Monitoring"
        subtitle="Live SNMP ping logs, CPU gauges, database statuses, and domain SSL warnings"
        actions={
          <span className="text-gray-400 font-bold bg-white px-3 py-1.5 rounded-xl border">
            🔄 Live Auto-refresh (5s): Last check at {lastUpdated.toLocaleTimeString()}
          </span>
        }
      />

      {/* GAUGES SECTION FOR SERVERS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data?.servers?.map((s) => (
          <div key={s.id} className="card p-5 bg-white border border-gray-150 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-3xs uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{s.type}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h4 className="font-extrabold text-gray-800 text-xs mt-2">{s.name}</h4>
              <p className="text-3xs text-gray-400">IP Address: {s.ip}</p>
            </div>
            
            <div className="space-y-2 mt-4">
              <div>
                <div className="flex justify-between text-3xs font-extrabold mb-1">
                  <span className="text-gray-400">CPU Usage</span>
                  <span className={s.cpu > 70 ? 'text-red-655' : 'text-indigo-650'}>{s.cpu}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full ${s.cpu > 70 ? 'bg-red-500' : 'bg-brand-600'}`} style={{ width: `${s.cpu}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-3xs font-extrabold mb-1">
                  <span className="text-gray-400">RAM Capacity</span>
                  <span className="text-indigo-650">{s.ram}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full bg-indigo-600" style={{ width: `${s.ram}%` }} />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-3xs text-gray-400 pt-2 border-t border-slate-50 mt-2 font-bold">
              <span>Ping: {s.ping}</span>
              <span>Disk: {s.disk}% used</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* NETWORK SWITCHES / ROUTERS MATRIX */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Edge Switches & Firewalls</h3>
          <div className="divide-y divide-gray-100">
            {data?.networkDevices?.map((net) => (
              <div key={net.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-gray-800">{net.name}</h4>
                  <span className="text-3xs text-gray-400 font-medium">{net.model} • {net.ip}</span>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="text-3xs text-slate-500 font-extrabold">Ping: {net.ping} ({net.loss} Loss)</span>
                  <span className="px-2 py-0.5 rounded text-3xs font-extrabold bg-emerald-50 border border-emerald-100 text-emerald-700">
                    {net.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SYSTEM SERVICES LOG */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Critical Core Connectors</h3>
          <div className="divide-y divide-gray-100">
            {data?.services?.map((svc) => (
              <div key={svc.id} className="py-2.5 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-gray-800">{svc.name}</h4>
                  <span className="text-3xs text-gray-400 font-medium">
                    {svc.daysLeft ? `${svc.daysLeft} days remaining` : svc.lastSync ? `Last Sync: ${fmtDate(svc.lastSync)}` : 'Gateway Active'}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-3xs font-extrabold border ${svc.status === 'OK' || svc.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                  {svc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
