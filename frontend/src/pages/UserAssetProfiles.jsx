import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, can } from '../context/AuthContext.jsx';
import { getCollectionItems, setCollectionDoc, runFirestoreBatch } from '../utils/firebase.js';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';

export default function UserAssetProfiles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const usersList = await getCollectionItems('users');
        const assetsList = await getCollectionItems('assets');
        setUsers(usersList);
        setAssets(assetsList);
      } catch (err) {
        console.error('Error loading profiles data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employeeName: '',
    employeeId: '',
    email: '',
    department: '',
    companyName: '',
    location: '',
    designation: '',
    mobileNumber: '',
    employmentStatus: 'ACTIVE'
  });

  const loadData = async () => {
    try {
      const usersList = await getCollectionItems('users');
      const assetsList = await getCollectionItems('assets');
      setUsers(usersList);
      setAssets(assetsList);
    } catch (err) {
      console.error('Error reloading profiles data:', err);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({
      employeeName: '',
      employeeId: '',
      email: '',
      department: '',
      companyName: '',
      location: '',
      designation: '',
      mobileNumber: '',
      employmentStatus: 'ACTIVE'
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      employeeName: user.employeeName || '',
      employeeId: user.employeeId || '',
      email: user.email || '',
      department: user.department || '',
      companyName: user.companyName || '',
      location: user.location || '',
      designation: user.designation || '',
      mobileNumber: user.mobileNumber || '',
      employmentStatus: user.employmentStatus || 'ACTIVE'
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const docId = editingUser ? editingUser.id : `usr-${Date.now()}`;
      await setCollectionDoc('users', docId, form);
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save profile details.');
    }
  };

  const handleDelete = async (id) => {
    const userAssets = assets.filter(a => String(a.assignedUserId) === String(id) && a.status === 'ASSIGNED');
    if (userAssets.length > 0) {
      alert(`Cannot delete profile: Employee is currently holding ${userAssets.length} active hardware assignments. Revoke or return assets first!`);
      return;
    }
    if (!window.confirm('Are you sure you want to delete this employee profile?')) return;
    try {
      await runFirestoreBatch([{ type: 'DELETE', collectionName: 'users', docId: id }]);
      loadData();
    } catch (err) {
      alert('Delete profile failed: ' + err.message);
    }
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Loading User Profiles…</div>;

  // Extract filter options dynamically
  const uniqueDepts = Array.from(new Set(users.map((u) => u.department).filter(Boolean)));
  const uniqueCompanies = Array.from(new Set(users.map((u) => u.companyName).filter(Boolean)));

  // Calculate assigned assets counts per user
  const getUserAssetCount = (userId) => {
    return assets.filter((a) => String(a.assignedUserId) === String(userId) && a.status === 'ASSIGNED').length;
  };

  // Filtered profiles list
  const filteredUsers = users.filter((u) => {
    const assetCount = getUserAssetCount(u.id);
    const isCleared = assetCount === 0;

    const matchesSearch = 
      String(u.employeeName || '').toLowerCase().includes(search.toLowerCase()) ||
      String(u.employeeId || '').toLowerCase().includes(search.toLowerCase()) ||
      String(u.email || '').toLowerCase().includes(search.toLowerCase());

    const matchesDept = !deptFilter || u.department === deptFilter;
    const matchesCompany = !companyFilter || u.companyName === companyFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'HOLDING') matchesStatus = !isCleared;
    else if (statusFilter === 'CLEARED') matchesStatus = isCleared;

    return matchesSearch && matchesDept && matchesCompany && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Asset Profiles"
        subtitle="View and manage hardware allocations per employee"
        actions={
          <div className="flex gap-2">
            {can(user, 'manageInventory') && (
              <button className="btn-secondary text-brand-700 bg-brand-50 border-brand-200" onClick={() => navigate('/user-profiles/import')}>
                Import Profiles
              </button>
            )}
            {can(user, 'manageInventory') && (
              <button className="btn-secondary text-brand-700 bg-brand-50 border-brand-200" onClick={openCreate}>
                + Add Profile
              </button>
            )}
            {can(user, 'manageInventory') && (
              <button className="btn-primary" onClick={() => navigate('/assets/assign')}>
                + Assign Assets
              </button>
            )}
          </div>
        }
      />

      {/* Filter panel */}
      <div className="card p-4 bg-white mb-4 flex flex-wrap gap-3 items-center shadow-xs">
        <input
          className="input max-w-xs text-xs"
          placeholder="Search name, email, employee ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={deptFilter}
          onChange={setDeptFilter}
          placeholder="All Departments"
          options={uniqueDepts.map((d) => ({ value: d, label: d }))}
        />
        <Select
          value={companyFilter}
          onChange={setCompanyFilter}
          placeholder="All Companies"
          options={uniqueCompanies.map((c) => ({ value: c, label: c }))}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Statuses"
          options={[
            { value: 'HOLDING', label: 'Holding Assets' },
            { value: 'CLEARED', label: 'Asset Cleared' }
          ]}
        />
      </div>

      {/* Users profiles table */}
      <DataTable
        columns={[
          {
            header: 'Employee Name',
            render: (u) => (
              <div className="flex items-center space-x-2">
                {u.profilePhoto ? (
                  <img src={u.profilePhoto} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {String(u.employeeName || 'U').charAt(0)}
                  </div>
                )}
                <span className="font-semibold text-gray-800">{u.employeeName}</span>
              </div>
            )
          },
          { header: 'Employee ID', key: 'employeeId' },
          { header: 'Department', key: 'department' },
          { header: 'Company', key: 'companyName' },
          { header: 'Email ID', key: 'email' },
          { header: 'Location', key: 'location' },
          {
            header: 'Assigned Assets',
            render: (u) => {
              const count = getUserAssetCount(u.id);
              return (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {count} Assigned
                </span>
              );
            }
          },
          {
            header: 'Clearance Status',
            render: (u) => {
              const count = getUserAssetCount(u.id);
              return (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide text-2xs ${
                  count > 0 
                    ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {count > 0 ? 'Holding Assets' : 'Asset Cleared'}
                </span>
              );
            }
          },
          {
            header: 'Actions',
            render: (u) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openEdit(u)}
                  className="px-2 py-1 text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg hover:bg-indigo-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="px-2 py-1 text-3xs font-extrabold bg-red-50 border border-red-150 text-red-700 rounded-lg hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            )
          }
        ]}
        rows={filteredUsers}
        onRowClick={(u) => navigate(`/user-profiles/${u.id}`)}
      />

      {/* CREATE / EDIT USER PROFILE MODAL */}
      <Modal open={modalOpen} title={editingUser ? `Edit Employee Profile` : `Add Employee Profile`} onClose={() => setModalOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{error}</div>}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Employee Full Name" required>
              <input className="input" required placeholder="e.g. Chirag Gohil" value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} />
            </Field>
            <Field label="Employee ID" required>
              <input className="input" required placeholder="e.g. EMP-001" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
            </Field>
            <Field label="Email Address" required>
              <input className="input" type="email" required placeholder="name@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Department" required>
              <input className="input" required placeholder="e.g. IT, Account, HR" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </Field>
            <Field label="Job Designation" required>
              <input className="input" required placeholder="e.g. Senior Executive" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </Field>
            <Field label="Corporate Company" required>
              <input className="input" required placeholder="e.g. Nationwide Paper" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </Field>
            <Field label="Office Location Site" required>
              <input className="input" required placeholder="e.g. Head Office, Warehouse 1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Mobile Number">
              <input className="input" placeholder="e.g. +91 98765 43210" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} />
            </Field>
            <Field label="Employment Status" required>
              <select className="input" value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary">Save Profile</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
