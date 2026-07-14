import { useEffect, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import DataTable from '../components/DataTable.jsx';
import { Field } from '../components/FormField.jsx';

export default function MultiCompanySettings() {
  const [companies, setCompanies] = useState([
    { id: 1, name: 'Nationwide Paper Ltd', code: 'NPL', region: 'UK', status: 'ACTIVE' },
    { id: 2, name: 'Greenearth Recycling Ltd', code: 'GER', region: 'UK', status: 'ACTIVE' },
    { id: 3, name: 'VSDent Dental Supplies Ltd', code: 'VSD', region: 'UK', status: 'ACTIVE' },
    { id: 4, name: 'Inventure Logistics Ltd', code: 'ILL', region: 'India', status: 'ACTIVE' },
  ]);

  const [locations, setLocations] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', address: '' });
  
  const loadLocations = async () => {
    try {
      const res = await api.get('/meta/locations');
      setLocations(res.data);
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleCreateLoc = async (e) => {
    e.preventDefault();
    try {
      await api.post('/meta/locations', locForm);
      setModalOpen(false);
      setLocForm({ name: '', address: '' });
      loadLocations();
    } catch (err) {
      alert('Failed to save branch location: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="Multi-Company & Branch Console"
        subtitle="Manage global office sites (UK, India) and sister companies under the centralized ITAM register"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* SISTER COMPANIES LIST */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Registered Corporate Entities</h3>
          <DataTable
            columns={[
              { header: 'Company Name', key: 'name' },
              { header: 'Code Prefix', key: 'code' },
              { header: 'Primary Region', key: 'region' },
              { header: 'Operational Status', render: (c) => <span className="px-2 py-0.5 rounded text-3xs font-extrabold bg-emerald-50 border border-emerald-100 text-emerald-700">{c.status}</span> }
            ]}
            rows={companies}
          />
        </div>

        {/* OFFICE SITES LIST */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Office Site Branches</h3>
            <button className="text-indigo-650 hover:underline text-2xs font-extrabold" onClick={() => setModalOpen(true)}>
              + Add Branch
            </button>
          </div>
          <DataTable
            columns={[
              { header: 'Branch Name', key: 'name' },
              { header: 'Office Address', key: 'address' }
            ]}
            rows={locations}
          />
        </div>
      </div>

      {/* CREATE LOCATION MODAL */}
      <Modal open={modalOpen} title="Add Office Branch Site" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreateLoc} className="space-y-4 text-xs">
          <Field label="Branch Name" required>
            <input className="input" required placeholder="e.g. Noida Office (India)" value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
          </Field>
          <Field label="Office Address / Region details" required>
            <textarea className="input" rows={2} required placeholder="Sector 62, Noida, Uttar Pradesh, India" value={locForm.address} onChange={(e) => setLocForm({ ...locForm, address: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary">Add Branch</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
