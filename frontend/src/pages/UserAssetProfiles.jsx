import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCollectionItems } from '../utils/firebase.js';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import { Select } from '../components/FormField.jsx';

export default function UserAssetProfiles() {
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
          <button className="btn-primary" onClick={() => navigate('/assets/assign')}>
            + Assign Assets
          </button>
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
          }
        ]}
        rows={filteredUsers}
        onRowClick={(u) => navigate(`/user-profiles/${u.id}`)}
      />
    </div>
  );
}
