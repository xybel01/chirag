import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { syncAssetsToFirestore } from '../utils/sync.js';

export default function AssetCategoryList({ type }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
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
    network: { title: 'Network Devices', categories: ['Network Device', 'Switch', 'Router', 'Firewall', 'WiFi Access Point'], defaultCat: 'Switch' },
    mobile: { title: 'Mobile Devices', categories: ['Mobile Phone', 'Mobile', 'Tablet', 'SIM Card'], defaultCat: 'Mobile Phone' },
    accessories: { title: 'Accessories & Cables', categories: ['Accessory', 'Keyboard', 'Mouse', 'Headset', 'Webcam', 'Docking Station'], defaultCat: 'Keyboard' },
  };

  const currentConfig = CONFIGS[type] || CONFIGS.computers;

  const loadData = async () => {
    try {
      const catRes = await api.get('/meta/categories');
      const cats = catRes.data;
      setCategories(cats);

      const matchedCats = cats.filter(c => currentConfig.categories.includes(c.name));
      if (matchedCats.length === 0) {
        setAssets([]);
        return;
      }

      const assetPromises = matchedCats.map(c => api.get('/assets', { params: { categoryId: c.id, pageSize: 500 } }));
      const resList = await Promise.all(assetPromises);
      const categoryAssets = resList.flatMap(r => r.data.items);
      setAssets(categoryAssets);
      syncAssetsToFirestore(categoryAssets);
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
      String(a.assetTag || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.manufacturer || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.model || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.serialNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      String(a.assignedTo?.name || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const openCreate = () => {
    setEditingAsset(null);
    setForm({
      category: currentConfig.defaultCat,
      manufacturer: '',
      model: '',
      serialNumber: '',
      status: 'AVAILABLE',
      condition: 'Good',
      ownershipType: 'Purchased',
      
      // Hardware Specs
      cpu: '', ram: '', storage: '', operatingSystem: '',
      windowsEdition: '', windowsVersion: '', buildNumber: '', activationStatus: 'Active',
      tpmVersion: '2.0', secureBootStatus: 'Enabled', defenderStatus: 'Running', firewallStatus: 'Enabled',
      gpu: '', gpuMemory: '', computerName: '', domainName: '', wifiMac: '', bluetoothMac: '', recoveryKey: '',

      // Monitor specific
      screenSize: '', connectionType: '', resolution: '', panelType: '', refreshRate: '',

      // Printer specific
      tonerModel: '', drumModel: '', currentPageCount: 0,

      // Mobile specific
      imeiNumber2: '', carrier: '', mdmStatus: 'Configured',

      // Network specific
      wanIp: '', portsCount: '', ispName: '', firmwareVersion: '',

      // Purchase & Warranty
      purchaseOrderNumber: '', invoiceNumber: '', purchaseDate: '', purchasePrice: '',
      warrantyStartDate: '', warrantyExpiry: '', amcExpiryDate: '', gst: '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (asset) => {
    setEditingAsset(asset);
    setForm({
      ...asset,
      category: asset.category?.name || currentConfig.defaultCat,
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.substring(0, 10) : '',
      warrantyStart: asset.warrantyStart ? asset.warrantyStart.substring(0, 10) : '',
      warrantyEnd: asset.warrantyEnd ? asset.warrantyEnd.substring(0, 10) : '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const matchedCat = categories.find(c => c.name === form.category);
      if (!matchedCat) throw new Error(`Category ${form.category} is not configured.`);

      const payload = {
        ...form,
        categoryId: matchedCat.id
      };

      if (editingAsset) {
        await api.put(`/assets/${editingAsset.id}`, payload);
      } else {
        await api.post('/assets', payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'ASSIGNED': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'REPAIR': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'FAULTY':
      case 'LOST': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-500 border-gray-100';
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Are you sure you want to delete asset ${asset.assetTag}?`)) return;
    try {
      await api.delete(`/assets/${asset.id}`);
      await loadData();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const getColumns = () => {
    return [
      { header: 'Asset ID', render: (a) => <span className="font-extrabold text-indigo-900">{a.assetTag}</span> },
      { header: 'Manufacturer', key: 'manufacturer' },
      { header: 'Model', key: 'model' },
      { header: 'Serial No.', key: 'serialNumber' },
      { header: 'Status', render: (a) => <span className={`px-2.5 py-0.5 rounded-full text-3xs font-black border uppercase tracking-wider ${getBadgeStyle(a.status)}`}>{a.status}</span> },
      { header: 'Assignee', render: (a) => a.assignedTo?.name || <span className="text-gray-400">Available</span> },
      {
        header: 'Actions',
        render: (a) => (
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => openEdit(a)}
              className="px-2 py-1 text-2xs font-semibold bg-brand-50 border border-brand-200 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors"
            >
              Edit
            </button>
            {['ADMIN', 'IT_MANAGER', 'IT_SUPPORT'].includes(user?.role) && (
              <button
                onClick={() => handleDelete(a)}
                className="px-2 py-1 text-2xs font-semibold bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )
      }
    ];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentConfig.title}
        subtitle={`CMDB Registry listing all registered configurations`}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            + Add Asset
          </button>
        }
      />

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        <input
          className="input max-w-xs text-xs"
          placeholder="Search by ID, model, serial, or assignee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={getColumns()}
        rows={filteredAssets}
        onRowClick={(a) => navigate(`/assets/${a.id || a.assetTag}`)}
      />

      {/* Add / Edit Asset Modal */}
      <Modal open={modalOpen} title={editingAsset ? `Edit Device ${form.assetTag}` : `Add New ${form.category}`} onClose={() => setModalOpen(false)} wide>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        
        <form onSubmit={handleSave} className="space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-1">
          
          {/* SECTION 1: BASIC INFO */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-indigo-900 border-b border-indigo-50 pb-1 text-2xs uppercase tracking-wider">1. Basic Details</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Category" required>
                <Select
                  value={form.category || ''}
                  onChange={(v) => setForm({ ...form, category: v })}
                  options={currentConfig.categories.map((c) => ({ value: c, label: c }))}
                  required
                />
              </Field>
              <Field label="Manufacturer" required>
                <input className="input" required value={form.manufacturer || ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </Field>
              <Field label="Model" required>
                <input className="input" required value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </Field>
              <Field label="Serial Number" required>
                <input className="input" required value={form.serialNumber || ''} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
              </Field>
              <Field label="Ownership Type">
                <Select
                  value={form.ownershipType || 'Purchased'}
                  onChange={(v) => setForm({ ...form, ownershipType: v })}
                  options={[{ value: 'Purchased', label: 'Purchased' }, { value: 'Leased', label: 'Leased' }, { value: 'Rented', label: 'Rented' }]}
                />
              </Field>
              <Field label="Condition">
                <Select
                  value={form.condition || 'Good'}
                  onChange={(v) => setForm({ ...form, condition: v })}
                  options={[{ value: 'Good', label: 'Good' }, { value: 'Fair', label: 'Fair' }, { value: 'Damaged', label: 'Damaged' }, { value: 'Lost', label: 'Lost' }]}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status || 'AVAILABLE'}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[{ value: 'AVAILABLE', label: 'AVAILABLE' }, { value: 'ASSIGNED', label: 'ASSIGNED' }, { value: 'REPAIR', label: 'REPAIR' }, { value: 'FAULTY', label: 'FAULTY' }, { value: 'LOST', label: 'LOST' }]}
                />
              </Field>
            </div>
          </div>

          {/* SECTION 2: SPECS & CMDB CONFIG */}
          {['Laptop', 'Desktop', 'Monitor', 'Printer', 'Mobile Phone', 'Mobile', 'Tablet'].includes(form.category) && (
            <div className="space-y-3">
              <h4 className="font-extrabold text-indigo-900 border-b border-indigo-50 pb-1 text-2xs uppercase tracking-wider">2. Specifications & Configuration</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {['Laptop', 'Desktop'].includes(form.category) && (
                  <>
                    <Field label="CPU Configuration">
                      <input className="input" placeholder="e.g. Intel Core i7" value={form.cpu || ''} onChange={(e) => setForm({ ...form, cpu: e.target.value })} />
                    </Field>
                    <Field label="RAM Memory (Total)">
                      <input className="input" placeholder="e.g. 16 GB" value={form.ram || ''} onChange={(e) => setForm({ ...form, ram: e.target.value })} />
                    </Field>
                    <Field label="Hard Drive (Storage)">
                      <input className="input" placeholder="e.g. 512GB NVMe SSD" value={form.storage || ''} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
                    </Field>
                    <Field label="GPU Card Model">
                      <input className="input" placeholder="e.g. RTX 4060" value={form.gpu || ''} onChange={(e) => setForm({ ...form, gpu: e.target.value })} />
                    </Field>
                    <Field label="OS Edition">
                      <input className="input" placeholder="e.g. Windows 11 Pro" value={form.windowsEdition || ''} onChange={(e) => setForm({ ...form, windowsEdition: e.target.value })} />
                    </Field>
                    <Field label="Computer Name">
                      <input className="input" placeholder="e.g. NPL-LAP-001" value={form.computerName || ''} onChange={(e) => setForm({ ...form, computerName: e.target.value })} />
                    </Field>
                    <Field label="Domain / Active Directory">
                      <input className="input" placeholder="e.g. nationwide.local" value={form.domainName || ''} onChange={(e) => setForm({ ...form, domainName: e.target.value })} />
                    </Field>
                    <Field label="BitLocker Status">
                      <Select value={form.bitLockerStatus} onChange={(v) => setForm({ ...form, bitLockerStatus: v })} options={[{ value: 'Enabled', label: 'Enabled' }, { value: 'Disabled', label: 'Disabled' }]} />
                    </Field>
                    <Field label="TPM Version">
                      <input className="input" placeholder="e.g. 2.0" value={form.tpmVersion || ''} onChange={(e) => setForm({ ...form, tpmVersion: e.target.value })} />
                    </Field>
                    <Field label="BitLocker Recovery Key">
                      <input className="input" placeholder="e.g. 48-digit key" value={form.recoveryKey || ''} onChange={(e) => setForm({ ...form, recoveryKey: e.target.value })} />
                    </Field>
                  </>
                )}

                {form.category === 'Monitor' && (
                  <>
                    <Field label="Screen Size">
                      <input className="input" placeholder='e.g. 27"' value={form.screenSize || ''} onChange={(e) => setForm({ ...form, screenSize: e.target.value })} />
                    </Field>
                    <Field label="Resolution">
                      <input className="input" placeholder="e.g. 2560x1440" value={form.resolution || ''} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
                    </Field>
                    <Field label="Refresh Rate">
                      <input className="input" placeholder="e.g. 144Hz" value={form.refreshRate || ''} onChange={(e) => setForm({ ...form, refreshRate: e.target.value })} />
                    </Field>
                    <Field label="Panel Type">
                      <input className="input" placeholder="e.g. IPS" value={form.panelType || ''} onChange={(e) => setForm({ ...form, panelType: e.target.value })} />
                    </Field>
                  </>
                )}

                {form.category === 'Printer' && (
                  <>
                    <Field label="Toner Model">
                      <input className="input" placeholder="e.g. CF258A" value={form.tonerModel || ''} onChange={(e) => setForm({ ...form, tonerModel: e.target.value })} />
                    </Field>
                    <Field label="Drum Model">
                      <input className="input" placeholder="e.g. CF258X" value={form.drumModel || ''} onChange={(e) => setForm({ ...form, drumModel: e.target.value })} />
                    </Field>
                    <Field label="Current Page Counter">
                      <input className="input" type="number" value={form.currentPageCount || 0} onChange={(e) => setForm({ ...form, currentPageCount: Number(e.target.value) })} />
                    </Field>
                  </>
                )}

                {['Mobile Phone', 'Mobile', 'Tablet'].includes(form.category) && (
                  <>
                    <Field label="IMEI Number 2">
                      <input className="input" value={form.imeiNumber2 || ''} onChange={(e) => setForm({ ...form, imeiNumber2: e.target.value })} />
                    </Field>
                    <Field label="Mobile Carrier">
                      <input className="input" placeholder="e.g. Vodafone" value={form.carrier || ''} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
                    </Field>
                    <Field label="MDM Configuration Status">
                      <Select value={form.mdmStatus} onChange={(v) => setForm({ ...form, mdmStatus: v })} options={[{ value: 'Configured', label: 'Intune MDM Active' }, { value: 'None', label: 'Unmanaged' }]} />
                    </Field>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: PURCHASE & WARRANTY */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-indigo-900 border-b border-indigo-50 pb-1 text-2xs uppercase tracking-wider">3. Purchase & Warranty Details</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Purchase Order (PO) Number">
                <input className="input" value={form.purchaseOrderNumber || ''} onChange={(e) => setForm({ ...form, purchaseOrderNumber: e.target.value })} />
              </Field>
              <Field label="Invoice Number">
                <input className="input" value={form.invoiceNumber || ''} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
              </Field>
              <Field label="GST Input Tax Price">
                <input className="input" type="number" value={form.gst || ''} onChange={(e) => setForm({ ...form, gst: e.target.value })} />
              </Field>
              <Field label="Purchase Price">
                <input className="input" type="number" value={form.purchasePrice || ''} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
              </Field>
              <Field label="Warranty Start Date">
                <input className="input" type="date" value={form.warrantyStart || ''} onChange={(e) => setForm({ ...form, warrantyStart: e.target.value })} />
              </Field>
              <Field label="Warranty Expiry Date">
                <input className="input" type="date" value={form.warrantyEnd || ''} onChange={(e) => setForm({ ...form, warrantyEnd: e.target.value })} />
              </Field>
              <Field label="AMC Contract Expiry">
                <input className="input" type="date" value={form.amcExpiryDate || ''} onChange={(e) => setForm({ ...form, amcExpiryDate: e.target.value })} />
              </Field>
            </div>
          </div>

          {/* SECTION 4: NETWORK & LOCATION DETAILS */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-indigo-900 border-b border-indigo-50 pb-1 text-2xs uppercase tracking-wider">4. Network & Location Details</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="LAN WAN IP Address">
                <input className="input" placeholder="e.g. 192.168.1.100" value={form.wanIp || ''} onChange={(e) => setForm({ ...form, wanIp: e.target.value })} />
              </Field>
              <Field label="MAC Address / ID">
                <input className="input" placeholder="e.g. 00:1A:2B:3C:4D:5E" value={form.wifiMac || ''} onChange={(e) => setForm({ ...form, wifiMac: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary">Save Configuration</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
