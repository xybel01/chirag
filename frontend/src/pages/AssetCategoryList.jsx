import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCollectionItems, setCollectionDoc } from '../utils/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';

export default function AssetCategoryList({ type }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  // Map category code to display label
  const CONFIGS = {
    computers: { title: 'Computers & Terminals', categories: ['Laptop', 'Desktop'], defaultCat: 'Laptop' },
    laptops: { title: 'Laptops', categories: ['Laptop'], defaultCat: 'Laptop' },
    desktops: { title: 'Desktops', categories: ['Desktop'], defaultCat: 'Desktop' },
    monitors: { title: 'Monitors & Displays', categories: ['Monitor'], defaultCat: 'Monitor' },
    printers: { title: 'Printers & Scanners', categories: ['Printer'], defaultCat: 'Printer' },
    network: { title: 'Network Devices', categories: ['Network Device'], defaultCat: 'Network Device' },
    mobile: { title: 'Mobile Devices', categories: ['Mobile Phone'], defaultCat: 'Mobile Phone' },
    accessories: { title: 'Accessories & Cables', categories: ['Accessory'], defaultCat: 'Accessory' },
  };

  const currentConfig = CONFIGS[type] || CONFIGS.computers;

  const loadData = async () => {
    try {
      const list = await getCollectionItems('assets');
      // Filter by configuration categories
      const filtered = list.filter((a) => currentConfig.categories.includes(a.category));
      setAssets(filtered);
    } catch (err) {
      console.error('Error fetching category assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [type]);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading Category Assets…</div>;

  // Search filter
  const filteredAssets = assets.filter((a) => {
    return (
      String(a.assetId || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.manufacturer || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.model || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.assignedUserName || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const openCreate = () => {
    setEditingAsset(null);
    setForm({
      assetId: `${type.toUpperCase().substring(0, 3)}-${Date.now().toString().slice(-4)}`,
      category: currentConfig.defaultCat,
      manufacturer: '',
      model: '',
      serialNumber: '',
      status: 'AVAILABLE',
      condition: 'Good',
      // Category specific fields
      ram: '', storage: '', cpu: '', operatingSystem: '', hostName: '',
      screenSize: '', connectionType: '',
      macAddress: '', ipAddress: '', deviceType: '',
      imeiNumber: '', mobileNumber: '', simNumber: '', networkProvider: '',
      wattage: '', chargerType: '',
      quantity: 1,
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (asset) => {
    setEditingAsset(asset);
    setForm({ ...asset });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const docId = editingAsset ? editingAsset.id : form.assetId;
      await setCollectionDoc('assets', docId, { ...form, id: docId });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(`Failed to save asset: ${err.message}`);
    }
  };

  // Status Badge Style Helper
  const getBadgeStyle = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'ASSIGNED': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'REPAIR': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'DAMAGED':
      case 'LOST': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-500 border-gray-100';
    }
  };

  // Columns definition based on Type
  const getColumns = () => {
    const baseCols = [
      { header: 'Asset ID', render: (a) => <span className="font-extrabold text-indigo-900">{a.assetId}</span> },
      { header: 'Manufacturer', key: 'manufacturer' },
      { header: 'Model', key: 'model' },
      { header: 'Serial No.', key: 'serialNumber' },
    ];

    if (type === 'laptops' || type === 'desktops' || type === 'computers') {
      baseCols.push(
        { header: 'CPU', key: 'cpu' },
        { header: 'RAM', key: 'ram' },
        { header: 'Storage', key: 'storage' }
      );
    } else if (type === 'monitors') {
      baseCols.push(
        { header: 'Screen Size', key: 'screenSize' },
        { header: 'Connection', key: 'connectionType' }
      );
    } else if (type === 'printers') {
      baseCols.push(
        { header: 'IP Address', key: 'ipAddress' },
        { header: 'Connection', key: 'connectionType' }
      );
    } else if (type === 'network') {
      baseCols.push(
        { header: 'Device Type', key: 'deviceType' },
        { header: 'Mgmt IP', key: 'ipAddress' },
        { header: 'MAC Address', key: 'macAddress' }
      );
    } else if (type === 'mobile') {
      baseCols.push(
        { header: 'Phone No.', key: 'mobileNumber' },
        { header: 'Provider', key: 'networkProvider' },
        { header: 'IMEI', key: 'imeiNumber' }
      );
    }

    baseCols.push(
      { header: 'Status', render: (a) => <span className={`px-2 py-0.5 rounded-full text-2xs font-bold border ${getBadgeStyle(a.status)}`}>{a.status}</span> },
      { header: 'Assigned To', render: (a) => a.assignedUserName || '—' },
      {
        header: 'Actions',
        render: (a) => (
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => openEdit(a)}
              className="px-2 py-1 text-2xs font-bold bg-slate-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Edit
            </button>
          </div>
        )
      }
    );

    return baseCols;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentConfig.title}
        subtitle={`Track and manage all items categorized under ${currentConfig.title}`}
        actions={
          ['ADMIN', 'IT_MANAGER', 'IT_SUPPORT'].includes(user?.role) && (
            <button className="btn-primary" onClick={openCreate}>
              + Add Device
            </button>
          )
        }
      />

      {/* Search Filter Panel */}
      <div className="card p-4 bg-white shadow-xs flex items-center">
        <input
          className="input max-w-sm text-xs"
          placeholder="Search by ID, model, serial, or assignee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Asset Table */}
      <DataTable
        columns={getColumns()}
        rows={filteredAssets}
        onRowClick={(a) => navigate(`/assets/${a.id || a.assetId}`)}
      />

      {/* Add / Edit Asset Modal */}
      <Modal open={modalOpen} title={editingAsset ? `Edit Device ${form.assetId}` : `Add New ${currentConfig.defaultCat}`} onClose={() => setModalOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Asset ID" required>
              <input
                className="input"
                value={form.assetId || ''}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                disabled={!!editingAsset}
                required
              />
            </Field>
            <Field label="Category" required>
              <Select
                value={form.category || ''}
                onChange={(v) => setForm({ ...form, category: v })}
                options={currentConfig.categories.map((c) => ({ value: c, label: c }))}
                required
              />
            </Field>
            <Field label="Manufacturer" required>
              <input
                className="input"
                value={form.manufacturer || ''}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                required
              />
            </Field>
            <Field label="Model" required>
              <input
                className="input"
                value={form.model || ''}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                required
              />
            </Field>
            <Field label="Serial Number" required>
              <input
                className="input"
                value={form.serialNumber || ''}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                required
              />
            </Field>
            <Field label="Condition">
              <Select
                value={form.condition || 'Good'}
                onChange={(v) => setForm({ ...form, condition: v })}
                options={[
                  { value: 'Good', label: 'Good' },
                  { value: 'Fair', label: 'Fair' },
                  { value: 'Damaged', label: 'Damaged' },
                  { value: 'Lost', label: 'Lost' }
                ]}
              />
            </Field>
          </div>

          {/* Conditional Specs Inputs */}
          <div className="border-t border-gray-100 pt-4 grid gap-3 md:grid-cols-2">
            {(form.category === 'Laptop' || form.category === 'Desktop') && (
              <>
                <Field label="CPU Configuration">
                  <input className="input" value={form.cpu || ''} onChange={(e) => setForm({ ...form, cpu: e.target.value })} />
                </Field>
                <Field label="RAM memory">
                  <input className="input" placeholder="e.g. 16 GB" value={form.ram || ''} onChange={(e) => setForm({ ...form, ram: e.target.value })} />
                </Field>
                <Field label="Hard Drive (Storage)">
                  <input className="input" placeholder="e.g. 512GB SSD" value={form.storage || ''} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
                </Field>
                <Field label="Operating System">
                  <input className="input" value={form.operatingSystem || ''} onChange={(e) => setForm({ ...form, operatingSystem: e.target.value })} />
                </Field>
              </>
            )}

            {form.category === 'Monitor' && (
              <>
                <Field label="Screen Size">
                  <input className="input" placeholder='e.g. 24"' value={form.screenSize || ''} onChange={(e) => setForm({ ...form, screenSize: e.target.value })} />
                </Field>
                <Field label="Connection Type">
                  <input className="input" placeholder="e.g. HDMI" value={form.connectionType || ''} onChange={(e) => setForm({ ...form, connectionType: e.target.value })} />
                </Field>
              </>
            )}

            {form.category === 'Printer' && (
              <>
                <Field label="IP Address">
                  <input className="input" value={form.ipAddress || ''} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} />
                </Field>
                <Field label="Connection Type">
                  <input className="input" placeholder="e.g. Network" value={form.connectionType || ''} onChange={(e) => setForm({ ...form, connectionType: e.target.value })} />
                </Field>
              </>
            )}

            {form.category === 'Network Device' && (
              <>
                <Field label="Device Type">
                  <Select
                    value={form.deviceType || ''}
                    onChange={(v) => setForm({ ...form, deviceType: v })}
                    options={[
                      { value: 'Switch', label: 'Switch' },
                      { value: 'Router', label: 'Router' },
                      { value: 'Access Point', label: 'Access Point' },
                      { value: 'Firewall', label: 'Firewall' }
                    ]}
                  />
                </Field>
                <Field label="Management IP">
                  <input className="input" value={form.ipAddress || ''} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} />
                </Field>
                <Field label="MAC Address">
                  <input className="input" value={form.macAddress || ''} onChange={(e) => setForm({ ...form, macAddress: e.target.value })} />
                </Field>
              </>
            )}

            {form.category === 'Mobile Phone' && (
              <>
                <Field label="Mobile Number">
                  <input className="input" value={form.mobileNumber || ''} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} />
                </Field>
                <Field label="SIM Card Number">
                  <input className="input" value={form.simNumber || ''} onChange={(e) => setForm({ ...form, simNumber: e.target.value })} />
                </Field>
                <Field label="Network Provider">
                  <input className="input" placeholder="e.g. Jio" value={form.networkProvider || ''} onChange={(e) => setForm({ ...form, networkProvider: e.target.value })} />
                </Field>
                <Field label="IMEI Number">
                  <input className="input" value={form.imeiNumber || ''} onChange={(e) => setForm({ ...form, imeiNumber: e.target.value })} />
                </Field>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary">
              Save Device
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
