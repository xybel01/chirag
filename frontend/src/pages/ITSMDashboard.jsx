import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../api/client';

export default function ITSMDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    usersWithAssets: 0,
    usersWithoutAssets: 0,
    totalAssignedAssets: 0,
    availableAssets: 0,
    returnedAssets: 0,
    damagedAssets: 0,
    lostAssets: 0,
    pendingAck: 0,
    pendingClearance: 0,
  });

  const [deviceBreakdown, setDeviceBreakdown] = useState([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api.get('/dashboard');
        const data = res.data;

        setStats({
          totalUsers: data.totals.users,
          usersWithAssets: data.totals.assigned,
          usersWithoutAssets: Math.max(0, data.totals.users - data.totals.assigned),
          totalAssignedAssets: data.totals.assigned,
          availableAssets: data.totals.available,
          returnedAssets: data.totals.disposed,
          damagedAssets: data.totals.faulty,
          lostAssets: data.totals.lost,
          pendingAck: data.totals.openRepairs,
          pendingClearance: data.totals.lowStock,
        });

        setDeviceBreakdown(
          (data.byCategory || []).map((c) => ({ name: c.name, value: c.count }))
        );
      } catch (err) {
        console.error('Error compiling dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#6b7280', '#ec4899'];

  if (loading) return <div className="text-gray-500 text-center py-12">Loading ITSM Metrics…</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="ITSM Asset Dashboard" subtitle="Real-time device tracking and user assignment stats" />

      {/* Summary Cards Row 1 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Users" value={stats.totalUsers} color="indigo" />
        <StatCard title="Users with Assets" value={stats.usersWithAssets} color="emerald" />
        <StatCard title="Users without Assets" value={stats.usersWithoutAssets} color="slate" />
        <StatCard title="Total Assigned Assets" value={stats.totalAssignedAssets} color="indigo" />
        <StatCard title="Available Assets" value={stats.availableAssets} color="emerald" />
      </div>

      {/* Summary Cards Row 2 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Returned Assets" value={stats.returnedAssets} color="slate" />
        <StatCard title="Damaged Assets" value={stats.damagedAssets} color="amber" />
        <StatCard title="Lost Assets" value={stats.lostAssets} color="red" />
        <StatCard title="Pending Acknowledgement" value={stats.pendingAck} color="amber" />
        <StatCard title="Pending Asset Clearance" value={stats.pendingClearance} color="rose" />
      </div>

      {/* Charts & Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Device Breakdown */}
        <div className="card p-5 bg-white">
          <h3 className="mb-4 font-bold text-gray-700 text-sm tracking-wide">Category & Device Breakdown</h3>
          <div className="h-64">
            {deviceBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">No assets recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {deviceBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} items`, 'Quantity']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* System Guidelines Alert Panel */}
        <div className="card p-5 bg-gradient-to-tr from-indigo-950 to-slate-900 text-white flex flex-col justify-between">
          <div>
            <span className="rounded bg-indigo-500/30 border border-indigo-400/20 px-2 py-0.5 text-2xs font-bold text-indigo-200 tracking-wider uppercase">Quick Actions</span>
            <h3 className="font-extrabold text-lg mt-2 mb-3">User-Wise IT Lifecycle Management</h3>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Use the User Asset Profile module to track exactly what hardware, display displays, input accessories, chargers, and printers are assigned to employees. Complete lifecycle workflows (Assignment, Return, Replace, and Transfer) are logged as master transactions.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a href="/assets/assign" className="px-3.5 py-2 bg-white text-indigo-950 text-xs font-bold rounded-xl shadow hover:bg-indigo-50 active:scale-95 transition-all">
              Assign Assets Form
            </a>
            <a href="/user-profiles" className="px-3.5 py-2 bg-indigo-600 border border-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all">
              View Asset Profiles
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
