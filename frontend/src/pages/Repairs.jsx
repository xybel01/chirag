import { useCallback, useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import useMeta from '../utils/useMeta.js';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate, fmtMoney } from '../utils/format.js';

const STATUSES = ['OPEN', 'SENT_TO_VENDOR', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function Repairs() {
  const { user } = useAuth();
  const meta = useMeta();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [assets, setAssets] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/repairs', { params: { page, status } }).then((r) => setData(r.data)).catch(() => {});
  }, [page, status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/assets', { params: { pageSize: 100 } }).then((r) => setAssets(r.data.items)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (modal.ticket) await api.put(`/repairs/${modal.ticket.id}`, form);
      else await api.post('/repairs', form);
      setModal(null); load();
    } catch (err) { setError(apiError(err)); }
  };

  const manage = can(user, 'manageInventory');

  return (
    <div>
      <PageHeader title="Maintenance & Repair" subtitle={`${data.total} tickets`}
        actions={manage && <button className="btn-primary" onClick={() => { setForm({ isWarrantyClaim: false }); setError(''); setModal({}); }}>+ New Ticket</button>} />
      <div className="mb-4 max-w-xs">
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="All statuses"
          options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
      </div>
      <DataTable
        columns={[
          { header: 'Ticket', render: (t) => <span className="font-medium text-brand-700">{t.ticketNo}</span> },
          { header: 'Asset', render: (t) => t.asset?.assetTag },
          { header: 'Issue', key: 'issue' },
          { header: 'Vendor', render: (t) => t.vendor?.name || '—' },
          { header: 'Warranty Claim', render: (t) => (t.isWarrantyClaim ? 'Yes' : 'No') },
          { header: 'Cost', render: (t) => fmtMoney(t.cost) },
          { header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
          { header: 'Opened', render: (t) => fmtDate(t.openedAt) },
        ]}
        rows={data.items} page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage}
        onRowClick={manage ? (t) => { setForm({ status: t.status, cost: Number(t.cost), diagnosis: t.diagnosis || '', partsReplaced: t.partsReplaced || '', vendorId: t.vendorId || '', isWarrantyClaim: t.isWarrantyClaim }); setError(''); setModal({ ticket: t }); } : undefined}
      />

      <Modal open={!!modal} title={modal?.ticket ? `Update ${modal.ticket.ticketNo}` : 'New Repair Ticket'} onClose={() => setModal(null)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          {!modal?.ticket && (
            <>
              <Field label="Asset" required>
                <Select value={form.assetId} onChange={(v) => setForm((f) => ({ ...f, assetId: Number(v) }))}
                  options={assets.map((a) => ({ value: a.id, label: `${a.assetTag} — ${a.manufacturer} ${a.model}` }))} required />
              </Field>
              <Field label="Issue" required><textarea className="input" rows={2} value={form.issue || ''} onChange={(e) => setForm((f) => ({ ...f, issue: e.target.value }))} required /></Field>
            </>
          )}
          <Field label="Vendor"><Select value={form.vendorId} onChange={(v) => setForm((f) => ({ ...f, vendorId: v ? Number(v) : null }))} options={meta.opts(meta.vendors)} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.isWarrantyClaim} onChange={(e) => setForm((f) => ({ ...f, isWarrantyClaim: e.target.checked }))} />
            Warranty claim
          </label>
          {modal?.ticket && (
            <>
              <Field label="Diagnosis"><textarea className="input" rows={2} value={form.diagnosis || ''} onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))} /></Field>
              <Field label="Parts Replaced"><input className="input" value={form.partsReplaced || ''} onChange={(e) => setForm((f) => ({ ...f, partsReplaced: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Repair Cost"><input className="input" type="number" step="0.01" min="0" value={form.cost ?? 0} onChange={(e) => setForm((f) => ({ ...f, cost: Number(e.target.value) }))} /></Field>
                <Field label="Status">
                  <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} placeholder=""
                    options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
                </Field>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
