import { useCallback, useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import useMeta from '../utils/useMeta.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate, fmtMoney, daysUntil } from '../utils/format.js';

const TYPES = [
  { value: 'M365', label: 'Microsoft 365' }, { value: 'ANTIVIRUS', label: 'Antivirus' },
  { value: 'RINGCENTRAL', label: 'RingCentral' }, { value: 'DYNAMICS365', label: 'Dynamics 365' },
  { value: 'OTHER', label: 'Other' },
];

function Expiry({ date }) {
  const d = daysUntil(date);
  if (d == null) return <span className="text-gray-400">—</span>;
  const cls = d < 0 ? 'text-red-600 font-semibold' : d <= 30 ? 'text-amber-600 font-semibold' : 'text-gray-700';
  return <span className={cls}>{fmtDate(date)} {d >= 0 ? `(${d}d)` : '(expired)'}</span>;
}

export default function Licenses() {
  const { user } = useAuth();
  const meta = useMeta();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [modal, setModal] = useState(null);
  const [seatModal, setSeatModal] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({});
  const [seatUser, setSeatUser] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/licenses', { params: { page, type } }).then((r) => setData(r.data)).catch(() => {});
  }, [page, type]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (can(user, 'manageInventory')) api.get('/users', { params: { pageSize: 100 } }).then((r) => setUsers(r.data.items)).catch(() => {});
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (modal.license) await api.put(`/licenses/${modal.license.id}`, form);
      else await api.post('/licenses', form);
      setModal(null); load();
    } catch (err) { setError(apiError(err)); }
  };

  const assignSeat = async (e) => {
    e.preventDefault();
    try { await api.post(`/licenses/${seatModal.id}/assign`, { userId: Number(seatUser) }); setSeatModal(null); load(); }
    catch (err) { setError(apiError(err)); }
  };

  const revoke = async (assignmentId) => {
    try { await api.delete(`/licenses/assignments/${assignmentId}`); load(); } catch { /* noop */ }
  };

  const manage = can(user, 'manageInventory');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  return (
    <div>
      <PageHeader title="Software & Licenses" subtitle={`${data.total} licenses`}
        actions={manage && <button className="btn-primary" onClick={() => { setForm({ type: 'M365', totalSeats: 1 }); setError(''); setModal({}); }}>+ Add License</button>} />
      <div className="mb-4 max-w-xs"><Select value={type} onChange={(v) => { setType(v); setPage(1); }} placeholder="All types" options={TYPES} /></div>

      <DataTable
        columns={[
          { header: 'License', render: (l) => <span className="font-medium text-brand-700">{l.name}</span> },
          { header: 'Type', render: (l) => TYPES.find((t) => t.value === l.type)?.label || l.type },
          { header: 'Vendor', render: (l) => l.vendor?.name || '—' },
          { header: 'Seats', render: (l) => `${l.seatsUsed}/${l.totalSeats}` },
          { header: 'Expiry', render: (l) => <Expiry date={l.expiryDate} /> },
          { header: 'Total Cost', render: (l) => fmtMoney(l.totalCost) },
          { header: 'Assigned Users', render: (l) => (
            <div className="flex flex-wrap gap-1">
              {l.assignments.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                  {a.user.name}
                  {manage && <button onClick={(e) => { e.stopPropagation(); revoke(a.id); }} className="text-brand-400 hover:text-red-600">&times;</button>}
                </span>
              ))}
              {manage && l.seatsFree > 0 && (
                <button className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand-500"
                  onClick={(e) => { e.stopPropagation(); setSeatUser(''); setError(''); setSeatModal(l); }}>+ assign</button>
              )}
            </div>
          ) },
        ]}
        rows={data.items} page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage}
        onRowClick={manage ? (l) => { setForm({ name: l.name, type: l.type, vendorId: l.vendorId || '', licenseKey: l.licenseKey || '', totalSeats: l.totalSeats, purchaseDate: l.purchaseDate?.slice(0, 10) || '', expiryDate: l.expiryDate?.slice(0, 10) || '', costPerSeat: l.costPerSeat || '', totalCost: l.totalCost || '', notes: l.notes || '' }); setError(''); setModal({ license: l }); } : undefined}
      />

      <Modal open={!!modal} title={modal?.license ? 'Edit License' : 'Add License'} onClose={() => setModal(null)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Field label="Name" required><input className="input" value={form.name || ''} onChange={set('name')} required /></Field></div>
          <Field label="Type" required><Select value={form.type} onChange={set('type')} placeholder="" options={TYPES} /></Field>
          <Field label="Vendor"><Select value={form.vendorId} onChange={set('vendorId')} options={meta.opts(meta.vendors)} /></Field>
          <Field label="License Key"><input className="input" value={form.licenseKey || ''} onChange={set('licenseKey')} /></Field>
          <Field label="Total Seats"><input className="input" type="number" min="1" value={form.totalSeats ?? 1} onChange={set('totalSeats')} /></Field>
          <Field label="Purchase Date"><input className="input" type="date" value={form.purchaseDate || ''} onChange={set('purchaseDate')} /></Field>
          <Field label="Expiry Date"><input className="input" type="date" value={form.expiryDate || ''} onChange={set('expiryDate')} /></Field>
          <Field label="Cost / Seat"><input className="input" type="number" step="0.01" min="0" value={form.costPerSeat || ''} onChange={set('costPerSeat')} /></Field>
          <Field label="Total Cost"><input className="input" type="number" step="0.01" min="0" value={form.totalCost || ''} onChange={set('totalCost')} /></Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!seatModal} title={`Assign seat — ${seatModal?.name}`} onClose={() => setSeatModal(null)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={assignSeat} className="space-y-4">
          <Field label="Employee" required>
            <Select value={seatUser} onChange={setSeatUser} options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))} required />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setSeatModal(null)}>Cancel</button>
            <button className="btn-primary">Assign</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
