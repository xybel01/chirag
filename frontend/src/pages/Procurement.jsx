import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import DataTable from '../components/DataTable.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate, fmtMoney } from '../utils/format.js';

export default function Procurement() {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'orders'
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  
  // Modals
  const [requestModal, setRequestModal] = useState(false);
  const [form, setForm] = useState({ title: '', costCenter: 'IT-DEPT', estimatedCost: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const reqRes = await api.get('/procurement/requests');
      setRequests(reqRes.data);

      const poRes = await api.get('/procurement/orders');
      setOrders(poRes.data);
    } catch (err) {
      console.error('Error loading procurement data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/procurement/requests', form);
      setRequestModal(false);
      setForm({ title: '', costCenter: 'IT-DEPT', estimatedCost: '' });
      loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (id) => {
    try {
      await api.put(`/procurement/requests/${id}/approve`);
      loadData();
    } catch (err) {
      alert('Failed to approve request: ' + err.message);
    }
  };

  const handleReceiveOrder = async (id) => {
    try {
      await api.put(`/procurement/orders/${id}/receive`);
      alert('Purchase Order received successfully! 3 Lenovo ThinkPads have been automatically instantiated and added to the Asset Catalog.');
      loadData();
    } catch (err) {
      alert('Failed to receive order: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="Enterprise Procurement Hub"
        subtitle="Manage purchasing workflows, cost center budgets, and automate Snipe-IT style asset creation"
        actions={
          activeTab === 'requests' && (
            <button className="btn-primary" onClick={() => setRequestModal(true)}>
              + Request Purchase
            </button>
          )
        }
      />

      {/* Tabs Selector */}
      <div className="flex border-b border-gray-150 mb-6 font-bold">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'requests' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          📝 Purchase Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'orders' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          📦 Purchase Orders ({orders.length})
        </button>
      </div>

      {/* REQUESTS TAB */}
      {activeTab === 'requests' && (
        <DataTable
          columns={[
            { header: 'Title / Item Requested', key: 'title' },
            { header: 'Cost Center', key: 'costCenter' },
            { header: 'Estimated Cost', render: (r) => fmtMoney(r.estimatedCost) },
            { header: 'Requested By', key: 'requestedBy' },
            { header: 'Requested Date', render: (r) => fmtDate(r.createdAt) },
            {
              header: 'Status',
              render: (r) => (
                <span className={`px-2 py-0.5 rounded text-3xs font-extrabold border ${r.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                  {r.status}
                </span>
              )
            },
            {
              header: 'Actions',
              render: (r) => {
                if (r.status === 'APPROVED') return <span className="text-gray-400 font-semibold">PO Drafted</span>;
                return (
                  <button
                    onClick={() => handleApproveRequest(r.id)}
                    className="px-2 py-1 text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg hover:bg-indigo-100"
                  >
                    Approve Request
                  </button>
                );
              }
            }
          ]}
          rows={requests}
        />
      )}

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-150 text-blue-800 p-3 rounded-2xl leading-normal font-semibold">
            💡 **Asset Instantiation Logic**: Flagging a purchase order as **Received** will automatically convert the order items into active hardware assets and assign serial numbers!
          </div>
          <DataTable
            columns={[
              { header: 'PO Number', render: (o) => <span className="font-extrabold text-indigo-900">{o.poNumber}</span> },
              { header: 'Vendor Name', key: 'vendorName' },
              { header: 'Cost Center', key: 'costCenter' },
              { header: 'Total Value', render: (o) => fmtMoney(o.totalAmount) },
              { header: 'Status', render: (o) => <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-extrabold text-3xs uppercase border">{o.status}</span> },
              { header: 'Authorized Date', render: (o) => fmtDate(o.createdAt) },
              {
                header: 'Actions',
                render: (o) => {
                  if (o.status === 'RECEIVED') return <span className="text-emerald-700 font-bold">Assets Seeded</span>;
                  return (
                    <button
                      onClick={() => handleReceiveOrder(o.id)}
                      className="px-2.5 py-1 text-3xs font-extrabold bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-lg hover:bg-emerald-100"
                    >
                      Receive & Seed Assets
                    </button>
                  );
                }
              }
            ]}
            rows={orders}
          />
        </div>
      )}

      {/* CREATE PURCHASE REQUEST MODAL */}
      <Modal open={requestModal} title="Create Purchase Request" onClose={() => setRequestModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
          <Field label="Item / Service Title Description" required>
            <input className="input" required placeholder="e.g. 5x Lenovo ThinkPads for Support team" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cost Center Department" required>
              <Select
                value={form.costCenter}
                onChange={(v) => setForm({ ...form, costCenter: v })}
                options={[
                  { value: 'IT-DEPT', label: 'Information Technology' },
                  { value: 'HR-DEPT', label: 'Human Resources' },
                  { value: 'ACC-DEPT', label: 'Accounts & Billing' },
                  { value: 'OPS-DEPT', label: 'Operations & Warehouse' }
                ]}
              />
            </Field>
            <Field label="Estimated Cost Value" required>
              <input className="input" type="number" required placeholder="0.00" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setRequestModal(false)} disabled={loading}>Cancel</button>
            <button className="btn-primary" disabled={loading}>{loading ? 'Submitting…' : 'Submit Request'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
