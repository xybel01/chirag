import { useState } from 'react';
import api from '../api/client';
import useMeta from '../utils/useMeta.js';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/FormField.jsx';

const REPORTS = [
  { key: 'assets', label: 'Asset Report', desc: 'All assets, filterable by status, category, department or user.', filters: ['status', 'categoryId', 'departmentId'] },
  { key: 'assets-user', path: 'assets', label: 'User-wise Asset Report', desc: 'Assets currently held by a specific employee.', filters: ['userId'] },
  { key: 'assets-dept', path: 'assets', label: 'Department-wise Asset Report', desc: 'Assets grouped under a department.', filters: ['departmentId'] },
  { key: 'warranty-expiry', label: 'Warranty Expiry Report', desc: 'Assets whose warranty ends within the selected window.', filters: ['days'] },
  { key: 'license-expiry', label: 'License Expiry Report', desc: 'Licenses expiring within the selected window.', filters: ['days'] },
  { key: 'repairs', label: 'Repair Report', desc: 'All repair tickets with vendors and costs.', filters: [] },
  { key: 'purchases', label: 'Purchase Report', desc: 'Assets purchased in a date range with prices.', filters: ['from', 'to'] },
];

export default function Reports() {
  const meta = useMeta();
  const [filters, setFilters] = useState({});
  const [users, setUsers] = useState([]);

  const loadUsers = () => {
    if (!users.length) api.get('/users', { params: { pageSize: 100 } }).then((r) => setUsers(r.data.items)).catch(() => {});
  };

  // Downloads go through fetch so the JWT header is attached.
  const download = async (report, format) => {
    const path = report.path || report.key;
    const params = new URLSearchParams({ format });
    report.filters.forEach((f) => { if (filters[`${report.key}.${f}`]) params.set(f, filters[`${report.key}.${f}`]); });
    const res = await api.get(`/reports/${path}?${params}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    if (format === 'pdf' && window.confirm('Open for printing? (Cancel to download)')) {
      window.open(url, '_blank');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.label.replace(/\s+/g, '_')}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const set = (rk, f) => (v) => setFilters((s) => ({ ...s, [`${rk}.${f}`]: v?.target ? v.target.value : v }));

  const filterControl = (report, f) => {
    const val = filters[`${report.key}.${f}`] || '';
    if (f === 'status') return <Select key={f} value={val} onChange={set(report.key, f)} placeholder="Any status" options={['AVAILABLE', 'ASSIGNED', 'REPAIR', 'FAULTY', 'LOST', 'DISPOSED'].map((s) => ({ value: s, label: s }))} />;
    if (f === 'categoryId') return <Select key={f} value={val} onChange={set(report.key, f)} placeholder="Any category" options={meta.opts(meta.categories)} />;
    if (f === 'departmentId') return <Select key={f} value={val} onChange={set(report.key, f)} placeholder="Any department" options={meta.opts(meta.departments)} />;
    if (f === 'userId') return <Select key={f} value={val} onChange={set(report.key, f)} placeholder="Select employee" options={users.map((u) => ({ value: u.id, label: u.name }))} onFocus={loadUsers} />;
    if (f === 'days') return <input key={f} className="input" type="number" min="1" placeholder="Days (default 30)" value={val} onChange={set(report.key, f)} />;
    if (f === 'from' || f === 'to') return <Field key={f} label={f === 'from' ? 'From' : 'To'}><input className="input" type="date" value={val} onChange={set(report.key, f)} /></Field>;
    return null;
  };

  return (
    <div onMouseEnter={loadUsers}>
      <PageHeader title="Reports & Export" subtitle="Generate, export and print reports" />
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <div key={r.key} className="card p-5">
            <h3 className="font-semibold text-gray-800">{r.label}</h3>
            <p className="mb-3 text-sm text-gray-500">{r.desc}</p>
            <div className="mb-3 grid grid-cols-2 gap-2">{r.filters.map((f) => filterControl(r, f))}</div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => download(r, 'xlsx')}>Export Excel</button>
              <button className="btn-secondary" onClick={() => download(r, 'pdf')}>Export / Print PDF</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
