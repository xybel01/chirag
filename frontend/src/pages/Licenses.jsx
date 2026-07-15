import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import { Field } from '../components/FormField.jsx';
function Select({ value, onChange, options, required }) {
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">-- Select --</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function Licenses() {
  const [licenses, setLicenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  
  // Forms state
  const [editingLicense, setEditingLicense] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'M365',
    vendorId: '',
    licenseKey: '',
    totalSeats: 5,
    purchaseDate: '',
    expiryDate: '',
    costPerSeat: '',
    notes: '',
    currency: 'GBP'
  });

  const [selectedLicense, setSelectedLicense] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const loadData = async () => {
    try {
      const [licRes, venRes, userRes] = await Promise.all([
        api.get('/api/licenses'),
        api.get('/meta/vendors'),
        api.get('/api/users')
      ]);
      setLicenses(licRes.data);
      setVendors(venRes.data);
      setUsers(userRes.data);
    } catch (err) {
      console.error('Failed to load software subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingLicense(null);
    setForm({
      name: '',
      type: 'M365',
      vendorId: '',
      licenseKey: '',
      totalSeats: 5,
      purchaseDate: '',
      expiryDate: '',
      costPerSeat: '',
      notes: '',
      currency: 'GBP'
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (license) => {
    setEditingLicense(license);
    setForm({
      ...license,
      vendorId: license.vendorId || '',
      purchaseDate: license.purchaseDate ? license.purchaseDate.substring(0, 10) : '',
      expiryDate: license.expiryDate ? license.expiryDate.substring(0, 10) : '',
      costPerSeat: license.costPerSeat || '',
      currency: license.currency || 'GBP'
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        totalSeats: Number(form.totalSeats),
        costPerSeat: form.costPerSeat ? Number(form.costPerSeat) : null
      };

      if (editingLicense) {
        await api.put(`/api/licenses/${editingLicense.id}`, payload);
      } else {
        await api.post('/api/licenses', payload);
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subscription? This will revoke all allocated seats.')) return;
    try {
      await api.delete(`/api/licenses/${id}`);
      loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const openAssign = async (license) => {
    try {
      // Reload license details with full assignment lists
      const res = await api.get(`/api/licenses/${license.id}`);
      setSelectedLicense(res.data);
      setSelectedUserId('');
      setError('');
      setAssignModalOpen(true);
    } catch (err) {
      alert('Failed to load license details: ' + err.message);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setError('');
    try {
      await api.post(`/api/licenses/${selectedLicense.id}/assign`, { userId: Number(selectedUserId) });
      const res = await api.get(`/api/licenses/${selectedLicense.id}`);
      setSelectedLicense(res.data);
      setSelectedUserId('');
      loadData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleRevoke = async (userId) => {
    if (!window.confirm('Are you sure you want to revoke this seat assignment?')) return;
    try {
      await api.post(`/api/licenses/${selectedLicense.id}/revoke`, { userId });
      const res = await api.get(`/api/licenses/${selectedLicense.id}`);
      setSelectedLicense(res.data);
      loadData();
    } catch (err) {
      alert('Revocation failed: ' + err.message);
    }
  };

  const CURRENCY_SYMBOLS = {
    INR: '₹',
    GBP: '£',
    USD: '$',
    PLN: 'zł',
    EUR: '€'
  };

  const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '—';
  const fmtMoney = (m, currencyCode = 'GBP') => {
    if (!m) return '—';
    const symbol = CURRENCY_SYMBOLS[currencyCode] || '£';
    const val = Number(m).toLocaleString('en-GB', { minimumFractionDigits: 2 });
    return currencyCode === 'PLN' ? `${val} zł` : `${symbol}${val}`;
  };

  // Metrics
  const spendByCurrency = licenses.reduce((acc, item) => {
    const curr = item.currency || 'GBP';
    acc[curr] = (acc[curr] || 0) + (Number(item.totalCost) || 0);
    return acc;
  }, {});

  const spendSummaryStr = Object.keys(spendByCurrency).length > 0
    ? Object.entries(spendByCurrency).map(([curr, sum]) => fmtMoney(sum, curr)).join(' | ')
    : '—';

  const activeSubsCount = licenses.length;
  const totalAllocatedSeats = licenses.reduce((sum, item) => sum + (item.activeSeatsUsed || 0), 0);
  const totalAvailableSeats = licenses.reduce((sum, item) => sum + (item.totalSeats || 0), 0);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading Software Subscriptions...</div>;

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="Software Subscription Registry"
        subtitle="Manage cloud subscriptions, software license keys, seat allocations, costs and expiries"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            + Purchase Subscription
          </button>
        }
      />

      {/* METRICS ROW */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-4 bg-white border border-gray-100 flex flex-col justify-between">
          <div className="text-gray-400 font-bold uppercase tracking-wider text-3xs">Total Annual Cost</div>
          <div className="text-xl font-extrabold text-indigo-750 mt-1">{spendSummaryStr}</div>
        </div>
        <div className="card p-4 bg-white border border-gray-100 flex flex-col justify-between">
          <div className="text-gray-400 font-bold uppercase tracking-wider text-3xs">Active Subscriptions</div>
          <div className="text-xl font-extrabold text-indigo-750 mt-1">{activeSubsCount}</div>
        </div>
        <div className="card p-4 bg-white border border-gray-100 flex flex-col justify-between">
          <div className="text-gray-400 font-bold uppercase tracking-wider text-3xs">Seats Allocated</div>
          <div className="text-xl font-extrabold text-indigo-750 mt-1">{totalAllocatedSeats} / {totalAvailableSeats}</div>
        </div>
        <div className="card p-4 bg-white border border-gray-100 flex flex-col justify-between">
          <div className="text-gray-400 font-bold uppercase tracking-wider text-3xs">Seat Utilization</div>
          <div className="text-xl font-extrabold text-indigo-750 mt-1">
            {totalAvailableSeats > 0 ? `${Math.round((totalAllocatedSeats / totalAvailableSeats) * 100)}%` : '0%'}
          </div>
        </div>
      </div>

      <DataTable
        columns={[
          { header: 'Software Subscription Name', key: 'name', render: (l) => <span className="font-bold text-gray-800">{l.name}</span> },
          { header: 'Type', key: 'type' },
          { header: 'Vendor / Supplier', key: 'vendor.name', render: (l) => l.vendor?.name || '—' },
          { header: 'Activation / License Key', key: 'licenseKey', render: (l) => <code className="bg-gray-50 px-1.5 py-0.5 rounded text-gray-600 select-all">{l.licenseKey || '—'}</code> },
          {
            header: 'Seats (Used / Total)',
            key: 'seats',
            render: (l) => {
              const pct = l.totalSeats > 0 ? Math.round((l.activeSeatsUsed / l.totalSeats) * 100) : 0;
              const barColor = pct >= 100 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-brand-600';
              return (
                <div className="space-y-1 w-32">
                  <div className="flex justify-between text-3xs font-semibold text-gray-500">
                    <span>{l.activeSeatsUsed} / {l.totalSeats} seats</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                  </div>
                </div>
              );
            }
          },
          { header: 'Expiry Date', key: 'expiryDate', render: (l) => {
            if (!l.expiryDate) return '—';
            const now = new Date();
            const exp = new Date(l.expiryDate);
            const diffDays = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
            const colorClass = diffDays < 0 ? 'text-red-650 bg-red-50' : diffDays <= 30 ? 'text-amber-650 bg-amber-50' : 'text-gray-600 bg-gray-50';
            return <span className={`px-2 py-0.5 rounded-full font-semibold select-none ${colorClass}`}>{fmtDate(l.expiryDate)}</span>;
          }},
          { header: 'Cost per Seat', key: 'costPerSeat', render: (l) => fmtMoney(l.costPerSeat, l.currency) },
          { header: 'Total Annual Cost', key: 'totalCost', render: (l) => fmtMoney(l.totalCost, l.currency) },
          {
            header: 'Actions',
            render: (l) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openAssign(l)}
                  className="px-2 py-1 text-3xs font-extrabold bg-brand-50 border border-brand-150 text-brand-700 rounded-lg hover:bg-brand-100"
                >
                  👤 Assign Seats
                </button>
                <button
                  onClick={() => openEdit(l)}
                  className="px-2 py-1 text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg hover:bg-indigo-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(l.id)}
                  className="px-2 py-1 text-3xs font-extrabold bg-red-50 border border-red-150 text-red-700 rounded-lg hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            )
          }
        ]}
        rows={licenses}
      />

      {/* CREATE / EDIT SUBSCRIPTION MODAL */}
      <Modal open={modalOpen} title={editingLicense ? `Edit Subscription Profile` : `Purchase Software Subscription`} onClose={() => setModalOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{error}</div>}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Software Name" required>
              <input className="input" required placeholder="e.g. Adobe Creative Cloud" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Subscription Type" required>
              <Select
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={[
                  { value: 'M365', label: 'Microsoft 365 Core' },
                  { value: 'ANTIVIRUS', label: 'Security & Antivirus' },
                  { value: 'RINGCENTRAL', label: 'VOIP RingCentral' },
                  { value: 'DYNAMICS365', label: 'Dynamics ERP' },
                  { value: 'ADOBE', label: 'Adobe Cloud Suite' },
                  { value: 'OTHER', label: 'Other Subscription' }
                ]}
              />
            </Field>
            <Field label="Vendor / Supplier">
              <Select
                value={form.vendorId}
                onChange={(v) => setForm({ ...form, vendorId: v })}
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
              />
            </Field>
            <Field label="License / Product Activation Key">
              <input className="input" placeholder="e.g. AAAAA-BBBBB-CCCCC-DDDDD" value={form.licenseKey} onChange={(e) => setForm({ ...form, licenseKey: e.target.value })} />
            </Field>
            <Field label="Allocated Seats Count" required>
              <input className="input" type="number" required value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} />
            </Field>
            <Field label="Billing Currency" required>
              <Select
                value={form.currency || 'GBP'}
                onChange={(v) => setForm({ ...form, currency: v })}
                options={[
                  { value: 'INR', label: 'INR (₹)' },
                  { value: 'GBP', label: 'GBP (£)' },
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'PLN', label: 'PLN (zł)' },
                  { value: 'EUR', label: 'EUR (€)' }
                ]}
                required
              />
            </Field>
            <Field label="Cost per Seat">
              <input className="input" type="number" step="0.01" placeholder="0.00" value={form.costPerSeat} onChange={(e) => setForm({ ...form, costPerSeat: e.target.value })} />
            </Field>
            <Field label="Purchase / Activation Date">
              <input className="input" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            </Field>
            <Field label="Expiry / Next Renewal Date">
              <input className="input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Contract Notes / Remarks">
                <textarea className="input" rows={2} placeholder="Add pricing models, billing cycles or department chargeback codes..." value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary">Save Registry</button>
          </div>
        </form>
      </Modal>

      {/* SEAT ASSIGNMENT ALLOCATION MODAL */}
      <Modal open={assignModalOpen} title={`Seat Allocation Manager — ${selectedLicense?.name}`} onClose={() => setAssignModalOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{error}</div>}
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between text-3xs font-bold uppercase tracking-wider text-gray-500">
            <span>Seat Allocation Usage:</span>
            <span className="text-gray-800">{selectedLicense?.activeSeatsUsed} / {selectedLicense?.totalSeats} Occupied</span>
          </div>

          {/* ALLOCATE NEW SEAT FORM */}
          {selectedLicense && selectedLicense.activeSeatsUsed < selectedLicense.totalSeats && (
            <form onSubmit={handleAssignSubmit} className="flex gap-2 items-end border-b border-gray-150 pb-4">
              <div className="flex-1">
                <Field label="Allocate Seat to Employee" required>
                  <Select
                    value={selectedUserId}
                    onChange={(v) => setSelectedUserId(v)}
                    options={users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                    required
                  />
                </Field>
              </div>
              <button className="btn-primary h-8 flex items-center justify-center">Allocate Seat</button>
            </form>
          )}

          {/* ACTIVE ASSIGNMENTS LIST */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-700 uppercase tracking-wider text-3xs">Current Active Allocations</h4>
            {selectedLicense?.assignments && selectedLicense.assignments.length > 0 ? (
              <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto border border-gray-100 rounded-lg bg-white">
                {selectedLicense.assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2.5">
                    <div>
                      <div className="font-bold text-gray-800">{a.user.name}</div>
                      <div className="text-3xs text-gray-400">{a.user.email} • {a.user.jobTitle || 'Employee'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(a.user.id)}
                      className="px-2 py-1 text-3xs font-extrabold bg-red-50 border border-red-150 text-red-700 rounded hover:bg-red-100"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-250">
                No active employee seat allocations recorded.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-50 pt-4 mt-6">
          <button type="button" className="btn-secondary" onClick={() => setAssignModalOpen(false)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
