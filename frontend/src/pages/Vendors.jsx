import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import { Field } from '../components/FormField.jsx';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [error, setError] = useState('');

  const loadVendors = async () => {
    try {
      const res = await api.get('/meta/vendors');
      setVendors(res.data);
    } catch (err) {
      console.error('Failed to load vendors list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const openCreate = () => {
    setEditingVendor(null);
    setForm({ name: '', email: '', phone: '', address: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (vendor) => {
    setEditingVendor(vendor);
    setForm({ ...vendor });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingVendor) {
        await api.put(`/meta/vendors/${editingVendor.id}`, form);
      } else {
        await api.post('/meta/vendors', form);
      }
      setModalOpen(false);
      loadVendors();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor? This will fail if the vendor is currently linked to active assets, tickets, or licenses.')) return;
    try {
      await api.delete(`/meta/vendors/${id}`);
      loadVendors();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Loading Vendors Database…</div>;

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="Vendor Management Database"
        subtitle="Manage supplier details, email contacts, phone records, and contracts"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            + Add Vendor
          </button>
        }
      />

      <DataTable
        columns={[
          { header: 'Vendor Name', key: 'name' },
          { header: 'Email Contact', key: 'email' },
          { header: 'Phone Number', key: 'phone' },
          { header: 'Office Address', key: 'address' },
          {
            header: 'Actions',
            render: (v) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openEdit(v)}
                  className="px-2 py-1 text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg hover:bg-indigo-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="px-2 py-1 text-3xs font-extrabold bg-red-50 border border-red-150 text-red-700 rounded-lg hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            )
          }
        ]}
        rows={vendors}
      />

      {/* CREATE / EDIT VENDOR MODAL */}
      <Modal open={modalOpen} title={editingVendor ? `Edit Vendor Profile` : `Add Vendor Profile`} onClose={() => setModalOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <Field label="Vendor Name / Supplier" required>
            <input className="input" required placeholder="e.g. Dell Enterprise Direct" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Email Address">
              <input className="input" type="email" placeholder="sales@vendor.com" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone Contact">
              <input className="input" placeholder="+44 20 7946 0958" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Office Headquarters Address">
                <textarea className="input" rows={2} placeholder="Office 142, Commerce Way, London, UK" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary">Save Vendor</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
