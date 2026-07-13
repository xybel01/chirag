import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiError } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import useMeta from '../utils/useMeta.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate } from '../utils/format.js';

const STATUSES = ['AVAILABLE', 'ASSIGNED', 'REPAIR', 'FAULTY', 'LOST', 'DISPOSED'];
const EMPTY = { serialNumber: '', model: '', manufacturer: '', categoryId: '', vendorId: '', purchaseDate: '', purchasePrice: '', warrantyStart: '', warrantyEnd: '', locationId: '', departmentId: '', notes: '' };

export default function Assets() {
  const { user } = useAuth();
  const meta = useMeta();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | { asset? }
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const page = Number(params.get('page') || 1);
  const status = params.get('status') || '';
  const categoryId = params.get('categoryId') || '';

  const load = useCallback(() => {
    api.get('/assets', { params: { page, search, status, categoryId } })
      .then((res) => setData(res.data)).catch(() => {});
  }, [page, search, status, categoryId]);
  useEffect(() => { load(); }, [load]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    next.delete('page');
    setParams(next);
  };

  const openCreate = () => { setForm(EMPTY); setFiles({}); setError(''); setModal({}); };
  const openEdit = (asset) => {
    setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, asset[k] ?? ''])),
      purchaseDate: asset.purchaseDate?.slice(0, 10) || '', warrantyStart: asset.warrantyStart?.slice(0, 10) || '', warrantyEnd: asset.warrantyEnd?.slice(0, 10) || '' });
    setFiles({}); setError(''); setModal({ asset });
  };

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
    if (files.invoice) fd.append('invoice', files.invoice);
    if (files.warrantyDoc) fd.append('warrantyDoc', files.warrantyDoc);
    try {
      if (modal.asset) await api.put(`/assets/${modal.asset.id}`, fd);
      else await api.post('/assets', fd);
      setModal(null); load();
    } catch (err) { setError(apiError(err)); }
  };

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  return (
    <div>
      <PageHeader title="Asset Inventory" subtitle={`${data.total} assets`}
        actions={can(user, 'manageInventory') && <button className="btn-primary" onClick={openCreate}>+ Add Asset</button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search tag, serial, model…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(v) => setParam('status', v)} placeholder="All statuses"
          options={STATUSES.map((s) => ({ value: s, label: s }))} />
        <Select value={categoryId} onChange={(v) => setParam('categoryId', v)} placeholder="All categories"
          options={meta.opts(meta.categories)} />
      </div>

      <DataTable
        columns={[
          { header: 'Asset Tag', render: (a) => <span className="font-medium text-brand-700">{a.assetTag}</span> },
          { header: 'Category', render: (a) => a.category?.name },
          { header: 'Model', render: (a) => `${a.manufacturer} ${a.model}` },
          { header: 'Serial No.', key: 'serialNumber' },
          { header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
          { header: 'Assigned To', render: (a) => a.assignedTo?.name || '—' },
          { header: 'Location', render: (a) => a.location?.name || '—' },
          { header: 'Warranty End', render: (a) => fmtDate(a.warrantyEnd) },
        ]}
        rows={data.items} page={data.page} pageSize={data.pageSize} total={data.total}
        onPage={(p) => { const n = new URLSearchParams(params); n.set('page', p); setParams(n); }}
        onRowClick={(a) => navigate(`/assets/${a.id}`)}
      />

      <Modal open={!!modal} title={modal?.asset ? `Edit ${modal.asset.assetTag}` : 'Add Asset'} onClose={() => setModal(null)} wide>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!modal?.asset && (
            <Field label="Category" required>
              <Select value={form.categoryId} onChange={set('categoryId')} options={meta.opts(meta.categories)} required />
            </Field>
          )}
          <Field label="Manufacturer" required><input className="input" value={form.manufacturer} onChange={set('manufacturer')} required /></Field>
          <Field label="Model" required><input className="input" value={form.model} onChange={set('model')} required /></Field>
          <Field label="Serial Number" required><input className="input" value={form.serialNumber} onChange={set('serialNumber')} required /></Field>
          <Field label="Vendor"><Select value={form.vendorId} onChange={set('vendorId')} options={meta.opts(meta.vendors)} /></Field>
          <Field label="Purchase Date"><input className="input" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} /></Field>
          <Field label="Purchase Price"><input className="input" type="number" step="0.01" min="0" value={form.purchasePrice} onChange={set('purchasePrice')} /></Field>
          <Field label="Warranty Start"><input className="input" type="date" value={form.warrantyStart} onChange={set('warrantyStart')} /></Field>
          <Field label="Warranty End"><input className="input" type="date" value={form.warrantyEnd} onChange={set('warrantyEnd')} /></Field>
          <Field label="Location"><Select value={form.locationId} onChange={set('locationId')} options={meta.opts(meta.locations)} /></Field>
          <Field label="Department"><Select value={form.departmentId} onChange={set('departmentId')} options={meta.opts(meta.departments)} /></Field>
          <Field label="Invoice (PDF/JPG/PNG)"><input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles((f) => ({ ...f, invoice: e.target.files[0] }))} /></Field>
          <Field label="Warranty Document"><input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles((f) => ({ ...f, warrantyDoc: e.target.files[0] }))} /></Field>
          <div className="md:col-span-2">
            <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary">{modal?.asset ? 'Save Changes' : 'Create Asset'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
