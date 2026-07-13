import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard.jsx';
import PageHeader from '../components/PageHeader.jsx';

const PIE_COLORS = ['#1e3a5f', '#2d5e8f', '#5a8ab8', '#8fb3d4', '#c3d6e8', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get('/dashboard').then((res) => setData(res.data)).catch(() => {}); }, []);
  if (!data) return <div className="text-gray-500">Loading dashboard…</div>;
  const t = data.totals;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="IT asset overview for Nationwide Paper Ltd" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Total Assets" value={t.total} onClick={() => navigate('/assets')} />
        <StatCard label="Available" value={t.available} accent="text-green-600" onClick={() => navigate('/assets?status=AVAILABLE')} />
        <StatCard label="Assigned" value={t.assigned} accent="text-blue-600" onClick={() => navigate('/assets?status=ASSIGNED')} />
        <StatCard label="In Repair" value={t.repair} accent="text-amber-600" onClick={() => navigate('/assets?status=REPAIR')} />
        <StatCard label="Faulty" value={t.faulty} accent="text-red-600" onClick={() => navigate('/assets?status=FAULTY')} />
        <StatCard label="Warranty Expiring" value={t.warrantyExpiring} accent="text-amber-600" onClick={() => navigate('/reports')} />
        <StatCard label="Licenses Expiring" value={t.licenseExpiring} accent="text-amber-600" onClick={() => navigate('/licenses')} />
        <StatCard label="Open Repairs" value={t.openRepairs} onClick={() => navigate('/repairs')} />
        <StatCard label="Low Stock Items" value={t.lowStock} accent="text-red-600" onClick={() => navigate('/stock')} />
        <StatCard label="Active Users" value={t.users} onClick={() => navigate('/users')} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-gray-700">Assets by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.byCategory}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-gray-700">Assets by Department</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.byDepartment} dataKey="count" nameKey="name" outerRadius={100} label>
                {data.byDepartment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-3 font-semibold text-gray-700">Assets by Location</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byLocation} layout="vertical">
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2d5e8f" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
