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
  
  // Location/Branch Modal states
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [locForm, setLocForm] = useState({ name: '', address: '' });

  // Company Modal states
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name: '', code: '', region: '', status: 'ACTIVE' });
  
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

  // Company Handlers
  const openCreateCompany = () => {
    setEditingCompany(null);
    setCompanyForm({ name: '', code: '', region: '', status: 'ACTIVE' });
    setCompanyModalOpen(true);
  };

  const openEditCompany = (c) => {
    setEditingCompany(c);
    setCompanyForm({ name: c.name, code: c.code, region: c.region, status: c.status });
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = (e) => {
    e.preventDefault();
    if (editingCompany) {
      setCompanies(companies.map(c => c.id === editingCompany.id ? { ...c, ...companyForm } : c));
    } else {
      const newId = companies.length > 0 ? Math.max(...companies.map(c => c.id)) + 1 : 1;
      setCompanies([...companies, { id: newId, ...companyForm }]);
    }
    setCompanyModalOpen(false);
  };

  const handleDeleteCompany = (id) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      setCompanies(companies.filter(c => c.id !== id));
    }
  };

  // Branch/Location Handlers
  const openCreateLoc = () => {
    setEditingLoc(null);
    setLocForm({ name: '', address: '' });
    setLocModalOpen(true);
  };

  const openEditLoc = (l) => {
    setEditingLoc(l);
    setLocForm({ name: l.name, address: l.address || '' });
    setLocModalOpen(true);
  };

  const handleSaveLoc = async (e) => {
    e.preventDefault();
    try {
      if (editingLoc) {
        await api.put(`/meta/locations/${editingLoc.id}`, locForm);
      } else {
        await api.post('/meta/locations', locForm);
      }
      setLocModalOpen(false);
      setLocForm({ name: '', address: '' });
      loadLocations();
    } catch (err) {
      alert('Failed to save branch location: ' + err.message);
    }
  };

  const handleDeleteLoc = async (id) => {
    if (window.confirm('Are you sure you want to delete this branch location?')) {
      try {
        await api.delete(`/meta/locations/${id}`);
        loadLocations();
      } catch (err) {
        alert('Failed to delete branch: ' + err.message);
      }
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
          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Registered Corporate Entities</h3>
            <button className="text-indigo-650 hover:underline text-2xs font-extrabold" onClick={openCreateCompany}>
              + Add Company
            </button>
          </div>
          <DataTable
            columns={[
              { header: 'Company Name', key: 'name' },
              { header: 'Code Prefix', key: 'code' },
              { header: 'Primary Region', key: 'region' },
              { header: 'Operational Status', render: (c) => <span className="px-2 py-0.5 rounded text-3xs font-extrabold bg-emerald-50 border border-emerald-100 text-emerald-700">{c.status}</span> },
              {
                header: 'Actions',
                render: (c) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditCompany(c)}
                      className="px-2.5 py-1 text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg hover:bg-indigo-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(c.id)}
                      className="px-2.5 py-1 text-3xs font-extrabold bg-red-50 border border-red-150 text-red-700 rounded-lg hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                )
              }
            ]}
            rows={companies}
          />
        </div>

        {/* OFFICE SITES LIST */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Office Site Branches</h3>
            <button className="text-indigo-650 hover:underline text-2xs font-extrabold" onClick={openCreateLoc}>
              + Add Branch
            </button>
          </div>
          <DataTable
            columns={[
              { header: 'Branch Name', key: 'name' },
              { header: 'Office Address', key: 'address' },
              {
                header: 'Actions',
                render: (l) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditLoc(l)}
                      className="px-2.5 py-1 text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg hover:bg-indigo-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteLoc(l.id)}
                      className="px-2.5 py-1 text-3xs font-extrabold bg-red-50 border border-red-150 text-red-700 rounded-lg hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                )
              }
            ]}
            rows={locations}
          />
        </div>
      </div>

      {/* CREATE / EDIT LOCATION MODAL */}
      <Modal open={locModalOpen} title={editingLoc ? "Edit Office Branch Site" : "Add Office Branch Site"} onClose={() => setLocModalOpen(false)}>
        <form onSubmit={handleSaveLoc} className="space-y-4 text-xs">
          <Field label="Branch Name" required>
            <input className="input" required placeholder="e.g. Noida Office (India)" value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
          </Field>
          <Field label="Office Address / Region details" required>
            <textarea className="input" rows={2} required placeholder="Sector 62, Noida, Uttar Pradesh, India" value={locForm.address} onChange={(e) => setLocForm({ ...locForm, address: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setLocModalOpen(false)}>Cancel</button>
            <button className="btn-primary">{editingLoc ? "Save Changes" : "Add Branch"}</button>
          </div>
        </form>
      </Modal>

      {/* CREATE / EDIT COMPANY MODAL */}
      <Modal open={companyModalOpen} title={editingCompany ? "Edit Corporate Entity" : "Add Corporate Entity"} onClose={() => setCompanyModalOpen(false)}>
        <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
          <Field label="Company Name" required>
            <input className="input" required placeholder="e.g. Greenearth Recycling Ltd" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
          </Field>
          <Field label="Code Prefix" required>
            <input className="input" required placeholder="e.g. GER" value={companyForm.code} onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })} />
          </Field>
          <Field label="Primary Region" required>
            <input className="input" required placeholder="e.g. UK" value={companyForm.region} onChange={(e) => setCompanyForm({ ...companyForm, region: e.target.value })} />
          </Field>
          <Field label="Operational Status">
            <select className="input" value={companyForm.status} onChange={(e) => setCompanyForm({ ...companyForm, status: e.target.value })}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setCompanyModalOpen(false)}>Cancel</button>
            <button className="btn-primary">{editingCompany ? "Save Changes" : "Add Company"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
