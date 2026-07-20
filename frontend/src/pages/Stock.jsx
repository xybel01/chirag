import { useCallback, useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import useMeta from '../utils/useMeta.js';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/FormField.jsx';

export default function Stock() {
  const { user } = useAuth();
  const meta = useMeta();
  const [summary, setSummary] = useState([]);
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  // Search & Filtering state for Accessories/Consumables
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACCESSORY' | 'CONSUMABLE' | 'LOW'

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
      setModal(null); 
      load();
    } catch (err) { 
      setError(apiError(err)); 
    }
  };

  const adjust = async (item, delta) => {
    const reason = delta > 0 ? 'Restock' : 'Issued';
    try { 
      await api.post(`/stock/items/${item.id}/adjust`, { delta, reason }); 
      load(); 
    } catch { /* noop */ }
  };

  const manage = can(user, 'manageInventory');

  // Emojis mapping for categories
  const getCategoryEmoji = (cat) => {
    const name = cat.toLowerCase();
    if (name.includes('computer') || name.includes('laptop') || name.includes('desktop')) return '💻';
    if (name.includes('display') || name.includes('monitor')) return '🖥️';
    if (name.includes('input') || name.includes('keyboard') || name.includes('mouse')) return '⌨️';
    if (name.includes('audio') || name.includes('headphone') || name.includes('mobile')) return '📱';
    if (name.includes('charger') || name.includes('power')) return '🔌';
    if (name.includes('printer') || name.includes('scanner')) return '🖨️';
    return '📦';
  };

  // Math metrics for KPI Cards
  const totalAvailableAssets = summary.reduce((acc, s) => acc + (s.AVAILABLE || 0), 0);
  const totalAssignedAssets = summary.reduce((acc, s) => acc + (s.ASSIGNED || 0), 0);
  const totalRepairFaulty = summary.reduce((acc, s) => acc + (s.REPAIR || 0) + (s.FAULTY || 0), 0);
  const lowStockCount = items.filter(i => i.lowStock || i.quantity <= i.minQuantity).length;

  // Filter items
  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || 
                          (i.location?.name || '').toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === 'ALL') return matchesSearch;
    if (activeTab === 'ACCESSORY') return matchesSearch && i.type === 'ACCESSORY';
    if (activeTab === 'CONSUMABLE') return matchesSearch && i.type === 'CONSUMABLE';
    if (activeTab === 'LOW') return matchesSearch && (i.lowStock || i.quantity <= i.minQuantity);
    return matchesSearch;
  });

  return (
    <div className="space-y-6 text-xs pb-12">
      <PageHeader 
        title="Stock & Inventory Control"
        actions={manage && (
          <button 
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 text-2xs"
            onClick={() => { setForm({ type: 'ACCESSORY', quantity: 0, minQuantity: 5 }); setError(''); setModal({}); }}
          >
            ➕ Add Consumable/Accessory
          </button>
        )} 
      />

      {/* KPI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {/* Card 1 */}
        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/60 rounded-2xl flex items-center space-x-4 shadow-2xs">
          <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">
            ✅
          </div>
          <div>
            <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider">Available Assets</span>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{totalAvailableAssets}</h4>
          </div>
        </div>

        {/* Card 2 */}
        <div className="card p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/60 rounded-2xl flex items-center space-x-4 shadow-2xs">
          <div className="h-10 w-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">
            👤
          </div>
          <div>
            <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider">Assigned to Users</span>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{totalAssignedAssets}</h4>
          </div>
        </div>

        {/* Card 3 */}
        <div className="card p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/60 rounded-2xl flex items-center space-x-4 shadow-2xs">
          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">
            ⚙️
          </div>
          <div>
            <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider">Repair & Faulty</span>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{totalRepairFaulty}</h4>
          </div>
        </div>

        {/* Card 4 */}
        <div className={`card p-5 border rounded-2xl flex items-center space-x-4 shadow-2xs transition-colors ${lowStockCount > 0 ? 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-100/60' : 'bg-gradient-to-br from-slate-50 to-gray-50 border-gray-100/60'}`}>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${lowStockCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-500 text-white'}`}>
            🚨
          </div>
          <div>
            <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider">Low Stock Warnings</span>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{lowStockCount}</h4>
          </div>
        </div>
      </div>

      {/* ASSET STOCK BY CATEGORY SUMMARY */}
      <div className="card bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="border-b border-gray-50 px-5 py-4 font-bold text-gray-800 text-xs uppercase tracking-wider bg-slate-50/50">
          🏢 Asset Stock Distribution by Category
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-gray-500 border-b border-gray-100 font-bold">
                <th className="px-5 py-3">Category Name</th>
                <th className="px-5 py-3">Stock Ratio & Distribution Status</th>
                <th className="px-5 py-3 text-center">Available</th>
                <th className="px-5 py-3 text-center">Assigned</th>
                <th className="px-5 py-3 text-center">Repair / Faulty</th>
                <th className="px-5 py-3 text-center">Total Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map((s) => {
                const total = s.total || 0;
                const availPct = total > 0 ? (s.AVAILABLE / total) * 100 : 0;
                const assignPct = total > 0 ? (s.ASSIGNED / total) * 100 : 0;
                const repairPct = total > 0 ? ((s.REPAIR + s.FAULTY) / total) * 100 : 0;
                
                return (
                  <tr key={s.category} className={`hover:bg-slate-50/20 transition-colors ${total > 0 && s.AVAILABLE === 0 ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3.5 font-semibold text-gray-800 flex items-center space-x-1.5">
                      <span className="text-sm">{getCategoryEmoji(s.category)}</span>
                      <span>{s.category}</span>
                    </td>
                    <td className="px-5 py-3.5 min-w-[200px]">
                      {total === 0 ? (
                        <span className="text-gray-400 italic text-3xs">No assets registered</span>
                      ) : (
                        <div className="space-y-1.5">
                          {/* Progress bar */}
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="bg-emerald-500 h-full" style={{ width: `${availPct}%` }} title={`Available: ${s.AVAILABLE}`} />
                            <div className="bg-indigo-500 h-full" style={{ width: `${assignPct}%` }} title={`Assigned: ${s.ASSIGNED}`} />
                            <div className="bg-amber-400 h-full" style={{ width: `${repairPct}%` }} title={`Repair/Faulty: ${s.REPAIR + s.FAULTY}`} />
                          </div>
                          {/* Legend / Info */}
                          <div className="flex justify-between text-3xs font-extrabold text-gray-400">
                            <span>{Math.round(availPct)}% Available</span>
                            <span>{Math.round(assignPct)}% Allocated</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold border ${s.AVAILABLE === 0 && total > 0 ? 'bg-red-50 border-red-200 text-red-700 animate-pulse' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                        {s.AVAILABLE} Available
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-indigo-700 font-semibold">{s.ASSIGNED}</td>
                    <td className="px-5 py-3.5 text-center">
                      {s.REPAIR + s.FAULTY > 0 ? (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-amber-50 border border-amber-100 text-amber-700 text-3xs">
                          {s.REPAIR + s.FAULTY} Needs service
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-800">{s.total}</td>
                  </tr>
                );
              })}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    No hardware assets registered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACCESSORIES & CONSUMABLES GRID */}
      <div className="card bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="border-b border-gray-50 px-5 py-4 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="font-bold text-gray-800 text-xs uppercase tracking-wider">
            📦 Accessories, Spares & Consumables
          </div>

          {/* Search bar & Filter */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
            <input 
              type="text" 
              className="input max-w-xs text-xs px-3 py-1.5"
              placeholder="Search accessories name or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex border-b border-gray-100 bg-slate-50/30 px-5 text-3xs font-bold uppercase tracking-wider">
          {[
            { value: 'ALL', label: 'All Stock Items' },
            { value: 'ACCESSORY', label: '⌨️ Accessories & Spares' },
            { value: 'CONSUMABLE', label: '🧪 Consumables & Ink' },
            { value: 'LOW', label: `🚨 Low Stock Alerts (${items.filter(i => i.lowStock || i.quantity <= i.minQuantity).length})` }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-3 border-b-2 transition-all ${activeTab === tab.value ? 'border-indigo-600 text-indigo-700 font-extrabold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {filteredItems.map((i) => {
              const isLow = i.lowStock || i.quantity <= i.minQuantity;
              
              return (
                <div key={i.id} className={`border rounded-2xl p-4 bg-white shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4 ${isLow ? 'border-rose-100 bg-rose-50/5' : 'border-gray-100'}`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold border ${i.type === 'ACCESSORY' ? 'bg-indigo-50 border-indigo-150 text-indigo-700' : 'bg-teal-50 border-teal-150 text-teal-700'}`}>
                        {i.type}
                      </span>
                      {isLow ? (
                        <span className="px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 font-black rounded-full text-3xs flex items-center gap-1 animate-pulse">
                          <span>🚨</span> LOW STOCK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-black rounded-full text-3xs flex items-center gap-1">
                          <span>✅</span> IN STOCK
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-800 leading-tight">{i.name}</h4>
                      <p className="text-3xs text-gray-400 mt-0.5">
                        📍 <strong>Location:</strong> {i.location?.name || 'Central IT Room'}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-end pt-3 border-t border-gray-50">
                    <div>
                      <span className="text-3xs font-extrabold text-gray-400 uppercase">Available Qty</span>
                      <h3 className={`text-base font-black leading-tight ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>
                        {i.quantity} <span className="text-2xs font-medium text-gray-400">/ {i.minQuantity || 5} min</span>
                      </h3>
                    </div>
                    {manage && (
                      <div className="flex gap-1">
                        <button 
                          className="px-2.5 py-1.5 bg-slate-50 border border-gray-200 text-gray-800 rounded-lg text-3xs font-extrabold hover:bg-gray-100 transition-all active:scale-95" 
                          onClick={() => adjust(i, 1)}
                          title="Restock (+1)"
                        >
                          ➕ Restock
                        </button>
                        <button 
                          className="px-2.5 py-1.5 bg-slate-50 border border-gray-200 text-gray-800 rounded-lg text-3xs font-extrabold hover:bg-gray-100 transition-all active:scale-95" 
                          onClick={() => adjust(i, -1)}
                          disabled={i.quantity === 0}
                          title="Issue (−1)"
                        >
                          ➖ Issue
                        </button>
                        <button 
                          className="px-2 py-1.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg text-3xs font-extrabold hover:bg-indigo-100 transition-all" 
                          onClick={() => { setForm(i); setError(''); setModal({ item: i }); }}
                          title="Edit Details"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="col-span-3 py-12 text-center text-gray-400">
                🔍 No stock items match the active filters or search terms.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: ADD / EDIT ITEM */}
      <Modal open={!!modal} title={modal?.item ? '✏️ Edit Stock Item' : '➕ Add Stock Item'} onClose={() => setModal(null)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{error}</div>}
        <form onSubmit={submitItem} className="space-y-4">
          <Field label="Item Name" required>
            <input className="input" placeholder="e.g. Logitech MX Master Mouse" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </Field>
          <Field label="Stock Item Type" required>
            <Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} placeholder=""
              options={[{ value: 'ACCESSORY', label: 'Accessory / Spares' }, { value: 'CONSUMABLE', label: 'Consumable / Stationery' }]} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Current Stock Quantity">
              <input className="input" type="number" min="0" value={form.quantity ?? 0} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
            </Field>
            <Field label="Low-stock Alert Threshold">
              <input className="input" type="number" min="0" value={form.minQuantity ?? 5} onChange={(e) => setForm((f) => ({ ...f, minQuantity: Number(e.target.value) }))} />
            </Field>
          </div>
          <Field label="Storage Location Shelf">
            <Select value={form.locationId} onChange={(v) => setForm((f) => ({ ...f, locationId: v ? Number(v) : null }))} options={meta.opts(meta.locations)} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary">{modal?.item ? 'Save Changes' : 'Add Item'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
