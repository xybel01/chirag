import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCollectionItems, setCollectionDoc } from '../utils/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
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
  const [formTab, setFormTab] = useState('basic'); // 'basic' | 'specs' | 'purchase' | 'network'
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
    setFormTab('basic');
    setForm({
      assetId: `${type.toUpperCase().substring(0, 3)}-${Date.now().toString().slice(-4)}`,
      category: currentConfig.defaultCat,
      manufacturer: '',
      model: '',
      serialNumber: '',
      status: 'AVAILABLE',
      condition: 'Good',
      ownershipType: 'Purchased', // 'Purchased' | 'Leased'
      
      // Hardware Specs
      cpu: '', ram: '', storage: '', operatingSystem: '', hostName: '',
      motherboardManufacturer: '', motherboardModel: '', motherboardSerial: '',
      ramSlots: '', maxRamSupported: '', ramType: '', diskHealth: 'Good',
      windowsEdition: '', windowsVersion: '', buildNumber: '', activationStatus: 'Active',
      antivirusName: 'ESET Antivirus', antivirusStatus: 'Enabled', firewallStatus: 'Enabled',
      tpmVersion: '2.0', secureBootStatus: 'Enabled',
      batteryCycleCount: '', batteryHealthPct: '',

      // Monitor specific
      screenSize: '', connectionType: '', resolution: '', panelType: '', refreshRate: '',

      // Printer specific
      ipAddress: '', macAddress: '', deviceType: '', printServerName: '', driverVersion: '', tonerModel: '',

      // Network specific
      firmwareVersion: '', portsCount: '', rackLocation: '', ispName: '', contractExpiryDate: '',

      // Mobile specific
      imeiNumber: '', mobileNumber: '', simNumber: '', networkProvider: '',

      // Charger specific
      wattage: '', chargerType: '', quantity: 1,

      // Purchase & Warranty
      purchaseOrderNumber: '', invoiceNumber: '', purchaseDate: '', purchasePrice: '',
      warrantyProvider: '', warrantyType: 'Standard', warrantyStartDate: '', warrantyExpiry: '',
      amcStartDate: '', amcExpiryDate: '', supportContractNumber: '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (asset) => {
    setEditingAsset(asset);
    setFormTab('basic');
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

  // Warranty days remaining badge calculator
  const getWarrantyBadge = (expiryDate) => {
    if (!expiryDate) return <span className="text-gray-400 text-xs">—</span>;
    const diff = new Date(expiryDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) {
      return <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wider">Expired</span>;
    } else if (days <= 30) {
      return <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider">Expiring ({days}d)</span>;
    } else {
      return <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">Active</span>;
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
        { header: 'Toner Model', key: 'tonerModel' }
      );
    } else if (type === 'network') {
      baseCols.push(
        { header: 'Device Type', key: 'deviceType' },
        { header: 'Mgmt IP', key: 'ipAddress' },
        { header: 'Ports', key: 'portsCount' }
      );
    } else if (type === 'mobile') {
      baseCols.push(
        { header: 'Phone No.', key: 'mobileNumber' },
        { header: 'Provider', key: 'networkProvider' }
      );
    }

    baseCols.push(
      { header: 'Warranty Status', render: (a) => getWarrantyBadge(a.warrantyExpiry) },
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
        
        {/* Form Modal Tabs */}
        <div className="flex border-b border-gray-100 mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFormTab('basic')}
            className={`px-4 py-2 border-b-2 transition-colors ${formTab === 'basic' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Basic Info
          </button>
          <button
            type="button"
            onClick={() => setFormTab('specs')}
            className={`px-4 py-2 border-b-2 transition-colors ${formTab === 'specs' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Hardware Specs
          </button>
          <button
            type="button"
            onClick={() => setFormTab('purchase')}
            className={`px-4 py-2 border-b-2 transition-colors ${formTab === 'purchase' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Purchase & Warranty
          </button>
          <button
            type="button"
            onClick={() => setFormTab('network')}
            className={`px-4 py-2 border-b-2 transition-colors ${formTab === 'network' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Network / Ports
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
          {/* TAB 1: BASIC INFO */}
          {formTab === 'basic' && (
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
              <Field label="Ownership Type">
                <Select
                  value={form.ownershipType || 'Purchased'}
                  onChange={(v) => setForm({ ...form, ownershipType: v })}
                  options={[
                    { value: 'Purchased', label: 'Purchased' },
                    { value: 'Leased', label: 'Leased' },
                    { value: 'Rented', label: 'Rented' }
                  ]}
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
              <Field label="Status">
                <Select
                  value={form.status || 'AVAILABLE'}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[
                    { value: 'AVAILABLE', label: 'AVAILABLE' },
                    { value: 'ASSIGNED', label: 'ASSIGNED' },
                    { value: 'REPAIR', label: 'REPAIR' },
                    { value: 'DAMAGED', label: 'DAMAGED' },
                    { value: 'LOST', label: 'LOST' }
                  ]}
                />
              </Field>
            </div>
          )}

          {/* TAB 2: SPECS & HEALTH */}
          {formTab === 'specs' && (
            <div className="grid gap-3 md:grid-cols-2">
              {(form.category === 'Laptop' || form.category === 'Desktop') && (
                <>
                  <Field label="CPU Configuration">
                    <input className="input" value={form.cpu || ''} onChange={(e) => setForm({ ...form, cpu: e.target.value })} />
                  </Field>
                  <Field label="RAM Memory (Total)">
                    <input className="input" placeholder="e.g. 16 GB" value={form.ram || ''} onChange={(e) => setForm({ ...form, ram: e.target.value })} />
                  </Field>
                  <Field label="Hard Drive (Storage)">
                    <input className="input" placeholder="e.g. 512GB SSD" value={form.storage || ''} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
                  </Field>
                  <Field label="Operating System">
                    <input className="input" value={form.operatingSystem || ''} onChange={(e) => setForm({ ...form, operatingSystem: e.target.value })} />
                  </Field>
                  <Field label="Motherboard Manufacturer">
                    <input className="input" value={form.motherboardManufacturer || ''} onChange={(e) => setForm({ ...form, motherboardManufacturer: e.target.value })} />
                  </Field>
                  <Field label="Motherboard Model">
                    <input className="input" value={form.motherboardModel || ''} onChange={(e) => setForm({ ...form, motherboardModel: e.target.value })} />
                  </Field>
                  <Field label="Disk Health Status">
                    <Select
                      value={form.diskHealth || 'Good'}
                      onChange={(v) => setForm({ ...form, diskHealth: v })}
                      options={[{ value: 'Good', label: 'Good' }, { value: 'Warning', label: 'Warning' }, { value: 'Critical', label: 'Critical' }]}
                    />
                  </Field>
                  <Field label="BitLocker Status">
                    <Select
                      value={form.bitLockerStatus || 'Enabled'}
                      onChange={(v) => setForm({ ...form, bitLockerStatus: v })}
                      options={[{ value: 'Enabled', label: 'Enabled' }, { value: 'Disabled', label: 'Disabled' }]}
                    />
                  </Field>
                  <Field label="Antivirus Status">
                    <input className="input" placeholder="e.g. Enabled" value={form.antivirusStatus || ''} onChange={(e) => setForm({ ...form, antivirusStatus: e.target.value })} />
                  </Field>
                  <Field label="TPM Version">
                    <input className="input" placeholder="e.g. 2.0" value={form.tpmVersion || ''} onChange={(e) => setForm({ ...form, tpmVersion: e.target.value })} />
                  </Field>
                  <Field label="Battery Cycle Count">
                    <input className="input" type="number" value={form.batteryCycleCount || ''} onChange={(e) => setForm({ ...form, batteryCycleCount: e.target.value })} />
                  </Field>
                  <Field label="Battery Health %">
                    <input className="input" type="number" placeholder="100" value={form.batteryHealthPct || ''} onChange={(e) => setForm({ ...form, batteryHealthPct: e.target.value })} />
                  </Field>
                </>
              )}

              {form.category === 'Monitor' && (
                <>
                  <Field label="Screen Size">
                    <input className="input" placeholder='e.g. 24"' value={form.screenSize || ''} onChange={(e) => setForm({ ...form, screenSize: e.target.value })} />
                  </Field>
                  <Field label="Resolution">
                    <input className="input" placeholder="e.g. 1920x1080" value={form.resolution || ''} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
                  </Field>
                  <Field label="Panel Type">
                    <input className="input" placeholder="e.g. IPS" value={form.panelType || ''} onChange={(e) => setForm({ ...form, panelType: e.target.value })} />
                  </Field>
                  <Field label="Refresh Rate">
                    <input className="input" placeholder="e.g. 60Hz" value={form.refreshRate || ''} onChange={(e) => setForm({ ...form, refreshRate: e.target.value })} />
                  </Field>
                </>
              )}

              {form.category === 'Printer' && (
                <>
                  <Field label="Toner / Cartridge Model">
                    <input className="input" placeholder="e.g. CF258A" value={form.tonerModel || ''} onChange={(e) => setForm({ ...form, tonerModel: e.target.value })} />
                  </Field>
                  <Field label="Driver Version">
                    <input className="input" value={form.driverVersion || ''} onChange={(e) => setForm({ ...form, driverVersion: e.target.value })} />
                  </Field>
                  <Field label="Print Server Name">
                    <input className="input" value={form.printServerName || ''} onChange={(e) => setForm({ ...form, printServerName: e.target.value })} />
                  </Field>
                </>
              )}

              {form.category === 'Mobile Phone' && (
                <>
                  <Field label="OS Version">
                    <input className="input" placeholder="e.g. iOS 16" value={form.operatingSystem || ''} onChange={(e) => setForm({ ...form, operatingSystem: e.target.value })} />
                  </Field>
                  <Field label="Storage Capacity">
                    <input className="input" placeholder="e.g. 128 GB" value={form.storage || ''} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
                  </Field>
                </>
              )}

              {form.category === 'Accessory' && (
                <>
                  <Field label="Quantity">
                    <input className="input" type="number" value={form.quantity || 1} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
                  </Field>
                </>
              )}

              {!['Laptop', 'Desktop', 'Monitor', 'Printer', 'Mobile Phone', 'Accessory'].includes(form.category) && (
                <div className="col-span-2 text-center text-gray-400 py-6">No specific hardware health specifications for this category.</div>
              )}
            </div>
          )}

          {/* TAB 3: PURCHASE & WARRANTY */}
          {formTab === 'purchase' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Purchase Order (PO) Number">
                <input className="input" value={form.purchaseOrderNumber || ''} onChange={(e) => setForm({ ...form, purchaseOrderNumber: e.target.value })} />
              </Field>
              <Field label="Invoice Number">
                <input className="input" value={form.invoiceNumber || ''} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
              </Field>
              <Field label="Purchase Date">
                <input className="input" type="date" value={form.purchaseDate || ''} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              </Field>
              <Field label="Purchase Price">
                <input className="input" type="number" value={form.purchasePrice || ''} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
              </Field>
              <Field label="Warranty Provider">
                <input className="input" value={form.warrantyProvider || ''} onChange={(e) => setForm({ ...form, warrantyProvider: e.target.value })} />
              </Field>
              <Field label="Warranty Type">
                <Select
                  value={form.warrantyType || 'Standard'}
                  onChange={(v) => setForm({ ...form, warrantyType: v })}
                  options={[{ value: 'Standard', label: 'Standard' }, { value: 'Extended', label: 'Extended' }, { value: 'AMC', label: 'AMC Contract' }, { value: 'Lifetime', label: 'Lifetime' }]}
                />
              </Field>
              <Field label="Warranty Start Date">
                <input className="input" type="date" value={form.warrantyStartDate || ''} onChange={(e) => setForm({ ...form, warrantyStartDate: e.target.value })} />
              </Field>
              <Field label="Warranty Expiry Date">
                <input className="input" type="date" value={form.warrantyExpiry || ''} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
              </Field>
              <Field label="AMC Contract End Date">
                <input className="input" type="date" value={form.amcExpiryDate || ''} onChange={(e) => setForm({ ...form, amcExpiryDate: e.target.value })} />
              </Field>
              <Field label="Support Contract Number">
                <input className="input" value={form.supportContractNumber || ''} onChange={(e) => setForm({ ...form, supportContractNumber: e.target.value })} />
              </Field>
            </div>
          )}

          {/* TAB 4: NETWORK & PORT CONFIG */}
          {formTab === 'network' && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Hostname">
                <input className="input" value={form.hostName || ''} onChange={(e) => setForm({ ...form, hostName: e.target.value })} />
              </Field>
              <Field label="IP Address / Management IP">
                <input className="input" value={form.ipAddress || ''} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} />
              </Field>
              <Field label="MAC Address">
                <input className="input" value={form.macAddress || ''} onChange={(e) => setForm({ ...form, macAddress: e.target.value })} />
              </Field>
              <Field label="Connection Type">
                <input className="input" placeholder="e.g. HDMI, Ethernet, USB" value={form.connectionType || ''} onChange={(e) => setForm({ ...form, connectionType: e.target.value })} />
              </Field>

              {form.category === 'Network Device' && (
                <>
                  <Field label="Firmware Version">
                    <input className="input" value={form.firmwareVersion || ''} onChange={(e) => setForm({ ...form, firmwareVersion: e.target.value })} />
                  </Field>
                  <Field label="Ports Count">
                    <input className="input" type="number" placeholder="24" value={form.portsCount || ''} onChange={(e) => setForm({ ...form, portsCount: e.target.value })} />
                  </Field>
                  <Field label="Rack Location">
                    <input className="input" placeholder="e.g. Rack A-3" value={form.rackLocation || ''} onChange={(e) => setForm({ ...form, rackLocation: e.target.value })} />
                  </Field>
                  <Field label="ISP Plan / Supplier Name">
                    <input className="input" placeholder="e.g. Airtel 1Gbps Lease" value={form.ispName || ''} onChange={(e) => setForm({ ...form, ispName: e.target.value })} />
                  </Field>
                </>
              )}

              {form.category === 'Mobile Phone' && (
                <>
                  <Field label="SIM Card Number">
                    <input className="input" value={form.simNumber || ''} onChange={(e) => setForm({ ...form, simNumber: e.target.value })} />
                  </Field>
                  <Field label="IMEI Number">
                    <input className="input" value={form.imeiNumber || ''} onChange={(e) => setForm({ ...form, imeiNumber: e.target.value })} />
                  </Field>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
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
