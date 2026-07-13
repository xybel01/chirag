import { useCallback, useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import useMeta from '../utils/useMeta.js';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Field, Select } from '../components/FormField.jsx';

export default function Stock() {
  const { user } = useAuth();
  const meta = useMeta();
  const [summary, setSummary] = useState([]);
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/stock/summary').then((r) => setSummary(r.data)).catch(() => {});
    api.get('/stock/items').then((r) => setItems(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitItem = async (e) => {
    e.preventDefault();
    try {
      if (modal.item) await api.put(`/stock/items/${modal.item.id}`, form);
      else await api.post('/stock/items', form);
      setModal(null); load();
    } catch (err) { setError(apiError(err)); }
  };

  const adjust = async (item, delta) => {
    const reason = delta > 0 ? 'Restock' : 'Issued';
    try { await api.post(`/stock/items/${item.id}/adjust`, { delta, reason }); load(); } catch { /* noop */ }
  };

  const manage = can(user, 'manageInventory');

  return (
    <div>
      <PageHeader title="Stock Management"
        actions={manage && <button className="btn-primary" onClick={() => { setForm({ type: 'ACCESSORY', quantity: 0, minQuantity: 5 }); setError(''); setModal({}); }}>+ Add Item</button>} />

      <div className="card mb-6 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-700">Asset Stock by Category</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr><th className="px-4 py-2">Category</th><th>Available</th><th>Assigned</th><th>Repair</th><th>Faulty</th><th>Total</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summary.map((s) => (
              <tr key={s.category} className={s.total > 0 && s.AVAILABLE === 0 ? 'bg-red-50' : ''}>
                <td className="px-4 py-2 font-medium">{s.category}</td>
                <td className={s.AVAILABLE === 0 && s.total > 0 ? 'text-red-600 font-semibold' : 'text-green-700'}>{s.AVAILABLE}</td>
                <td>{s.ASSIGNED}</td><td>{s.REPAIR}</td><td>{s.FAULTY}</td><td className="font-medium">{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-700">Accessories & Consumables</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr><th className="px-4 py-2">Item</th><th>Type</th><th>Quantity</th><th>Min</th><th>Location</th><th>Status</th>{manage && <th>Actions</th>}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 font-medium">{i.name}</td>
                <td>{i.type}</td>
                <td className={i.lowStock ? 'font-bold text-red-600' : ''}>{i.quantity}</td>
                <td>{i.minQuantity}</td>
                <td>{i.location?.name || '—'}</td>
                <td>{i.lowStock ? <StatusBadge status="FAULTY" /> && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">LOW STOCK</span> : <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">OK</span>}</td>
                {manage && (
                  <td className="space-x-1">
                    <button className="btn-secondary !px-2 !py-1" onClick={() => adjust(i, 1)}>+1</button>
                    <button className="btn-secondary !px-2 !py-1" onClick={() => adjust(i, -1)}>−1</button>
                    <button className="btn-secondary !px-2 !py-1" onClick={() => { setForm(i); setError(''); setModal({ item: i }); }}>Edit</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No stock items yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} title={modal?.item ? 'Edit Stock Item' : 'Add Stock Item'} onClose={() => setModal(null)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submitItem} className="space-y-4">
          <Field label="Name" required><input className="input" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></Field>
          <Field label="Type" required>
            <Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} placeholder=""
              options={[{ value: 'ACCESSORY', label: 'Accessory' }, { value: 'CONSUMABLE', label: 'Consumable' }]} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity"><input className="input" type="number" min="0" value={form.quantity ?? 0} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} /></Field>
            <Field label="Low-stock threshold"><input className="input" type="number" min="0" value={form.minQuantity ?? 5} onChange={(e) => setForm((f) => ({ ...f, minQuantity: Number(e.target.value) }))} /></Field>
          </div>
          <Field label="Location"><Select value={form.locationId} onChange={(v) => setForm((f) => ({ ...f, locationId: v ? Number(v) : null }))} options={meta.opts(meta.locations)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
