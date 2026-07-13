import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { apiError, fileUrl, authedImg } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SignaturePad from '../components/SignaturePad.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate, fmtMoney } from '../utils/format.js';

const ACTIONS = ['ASSIGN', 'RETURN', 'TRANSFER', 'REPLACE', 'REPAIR', 'DISPOSE'];

export default function AssetDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ action: 'ASSIGN', userId: '', notes: '', signature: null });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { api.get(`/assets/${id}`).then((r) => setAsset(r.data)).catch(() => {}); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (can(user, 'manageInventory')) api.get('/users', { params: { pageSize: 100 } }).then((r) => setUsers(r.data.items)).catch(() => {});
  }, [user]);

  if (!asset) return <div className="text-gray-500">Loading…</div>;

  const openAction = (action) => { setForm({ action, userId: '', notes: '', signature: null }); setError(''); setModal(true); };
  const needsUser = !['RETURN', 'DISPOSE'].includes(form.action);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/assignments', { assetId: asset.id, action: form.action, userId: form.userId || undefined, notes: form.notes, signature: form.signature || undefined });
      setModal(false); load();
    } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };

  const info = [
    ['Category', asset.category?.name], ['Manufacturer', asset.manufacturer], ['Model', asset.model],
    ['Serial Number', asset.serialNumber], ['Vendor', asset.vendor?.name || '—'],
    ['Purchase Date', fmtDate(asset.purchaseDate)], ['Purchase Price', fmtMoney(asset.purchasePrice)],
    ['Warranty', `${fmtDate(asset.warrantyStart)} → ${fmtDate(asset.warrantyEnd)}`],
    ['Location', asset.location?.name || '—'], ['Department', asset.department?.name || '—'],
    ['Assigned To', asset.assignedTo?.name || '—'], ['Notes', asset.notes || '—'],
  ];

  return (
    <div>
      <PageHeader title={asset.assetTag} subtitle={`${asset.manufacturer} ${asset.model}`}
        actions={can(user, 'manageInventory') && (
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => <button key={a} className="btn-secondary" onClick={() => openAction(a)}>{a.charAt(0) + a.slice(1).toLowerCase()}</button>)}
          </div>
        )} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-3">
            <StatusBadge status={asset.status} />
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 pb-1 text-sm">
                <dt className="text-gray-500">{k}</dt><dd className="font-medium text-gray-800 text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-4 text-sm">
            {asset.invoiceFile && <a className="text-brand-600 underline" href={fileUrl(asset.invoiceFile)} target="_blank" rel="noreferrer">Invoice</a>}
            {asset.warrantyFile && <a className="text-brand-600 underline" href={fileUrl(asset.warrantyFile)} target="_blank" rel="noreferrer">Warranty document</a>}
          </div>
        </div>

        <div className="card p-5 text-center">
          <h3 className="mb-3 font-semibold text-gray-700">Labels</h3>
          <img src={authedImg(`/api/assets/${asset.id}/qrcode`)} alt="QR code" className="mx-auto h-36 w-36"
            onError={(e) => { e.target.style.display = 'none'; }} />
          <img src={authedImg(`/api/assets/${asset.id}/barcode`)} alt="Barcode" className="mx-auto mt-3 max-w-full"
            onError={(e) => { e.target.style.display = 'none'; }} />
          <button className="btn-secondary mt-3" onClick={() => window.print()}>Print labels</button>
          <p className="mt-2 text-xs text-gray-400">QR encodes the asset link; barcode is the asset tag (Code128).</p>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h3 className="mb-3 font-semibold text-gray-700">Assignment History</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500"><tr><th className="py-2">Date</th><th>Action</th><th>Employee</th><th>By</th><th>Notes</th><th>Acknowledgement</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {asset.assignments.map((h) => (
              <tr key={h.id}>
                <td className="py-2">{fmtDate(h.createdAt)}</td>
                <td><StatusBadge status={h.action} /></td>
                <td>{h.user?.name}</td>
                <td>{h.performedBy?.name}</td>
                <td className="text-gray-500">{h.notes || '—'}</td>
                <td>{h.ackFile ? <a className="text-brand-600 underline" href={fileUrl(h.ackFile)} target="_blank" rel="noreferrer">PDF</a> : '—'}</td>
              </tr>
            ))}
            {asset.assignments.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">No history yet</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card mt-6 p-5">
        <h3 className="mb-3 font-semibold text-gray-700">Repair History</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500"><tr><th className="py-2">Ticket</th><th>Issue</th><th>Vendor</th><th>Cost</th><th>Status</th><th>Opened</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {asset.repairTickets.map((t) => (
              <tr key={t.id}>
                <td className="py-2"><Link to="/repairs" className="text-brand-600 underline">{t.ticketNo}</Link></td>
                <td>{t.issue}</td><td>{t.vendor?.name || '—'}</td><td>{fmtMoney(t.cost)}</td>
                <td><StatusBadge status={t.status} /></td><td>{fmtDate(t.openedAt)}</td>
              </tr>
            ))}
            {asset.repairTickets.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">No repairs recorded</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} title={`${form.action.charAt(0) + form.action.slice(1).toLowerCase()} — ${asset.assetTag}`} onClose={() => setModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Action">
            <Select value={form.action} onChange={(v) => setForm((f) => ({ ...f, action: v }))} placeholder=""
              options={ACTIONS.map((a) => ({ value: a, label: a }))} />
          </Field>
          {needsUser && (
            <Field label="Employee" required>
              <Select value={form.userId} onChange={(v) => setForm((f) => ({ ...f, userId: v }))}
                options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))} required />
            </Field>
          )}
          <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
          <Field label="Employee Digital Signature">
            <SignaturePad onChange={(sig) => setForm((f) => ({ ...f, signature: sig }))} />
          </Field>
          <p className="text-xs text-gray-500">An acknowledgement PDF will be generated and emailed to the employee and the IT manager.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy ? 'Processing…' : 'Confirm'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
