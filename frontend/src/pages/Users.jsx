import { useCallback, useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import useMeta from '../utils/useMeta.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/FormField.jsx';

const ROLES = ['ADMIN', 'IT_MANAGER', 'IT_SUPPORT', 'HR', 'ACCOUNTS', 'EMPLOYEE'];

export default function Users() {
  const meta = useMeta();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/users', { params: { page, search } }).then((r) => setData(r.data)).catch(() => {});
  }, [page, search]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, departmentId: form.departmentId ? Number(form.departmentId) : null };
      if (!payload.password) delete payload.password;
      if (modal.user) await api.put(`/users/${modal.user.id}`, payload);
      else await api.post('/users', payload);
      setModal(null); load();
    } catch (err) { setError(apiError(err)); }
  };

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${data.total} users`}
        actions={<button className="btn-primary" onClick={() => { setForm({ role: 'EMPLOYEE', isActive: true }); setError(''); setModal({}); }}>+ Add User</button>} />
      <div className="mb-4 max-w-xs">
        <input className="input" placeholder="Search name or email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <DataTable
        columns={[
          { header: 'Name', render: (u) => <span className="font-medium">{u.name}</span> },
          { header: 'Email', key: 'email' },
          { header: 'Role', render: (u) => u.role.replace('_', ' ') },
          { header: 'Department', render: (u) => u.department?.name || '—' },
          { header: 'Job Title', render: (u) => u.jobTitle || '—' },
          { header: 'Status', render: (u) => u.isActive
            ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
            : <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Disabled</span> },
        ]}
        rows={data.items} page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage}
        onRowClick={(u) => { setForm({ name: u.name, email: u.email, role: u.role, departmentId: u.departmentId || '', jobTitle: u.jobTitle || '', phone: u.phone || '', isActive: u.isActive }); setError(''); setModal({ user: u }); }}
      />

      <Modal open={!!modal} title={modal?.user ? `Edit ${modal.user.name}` : 'Add User'} onClose={() => setModal(null)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full Name" required><input className="input" value={form.name || ''} onChange={set('name')} required /></Field>
          <Field label="Email" required><input className="input" type="email" value={form.email || ''} onChange={set('email')} required disabled={!!modal?.user} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role" required><Select value={form.role} onChange={set('role')} placeholder="" options={ROLES.map((r) => ({ value: r, label: r.replace('_', ' ') }))} /></Field>
            <Field label="Department"><Select value={form.departmentId} onChange={set('departmentId')} options={meta.opts(meta.departments)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Job Title"><input className="input" value={form.jobTitle || ''} onChange={set('jobTitle')} /></Field>
            <Field label="Phone"><input className="input" value={form.phone || ''} onChange={set('phone')} /></Field>
          </div>
          <Field label={modal?.user ? 'New Password (leave blank to keep)' : 'Password (optional — user can also sign in with Microsoft 365)'}>
            <input className="input" type="password" minLength={8} value={form.password || ''} onChange={set('password')} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Account active
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
