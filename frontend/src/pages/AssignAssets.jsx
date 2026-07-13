import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCollectionItems, runFirestoreBatch } from '../utils/firebase.js';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/FormField.jsx';
import Modal from '../components/Modal.jsx';

export default function AssignAssets() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialUserId = params.get('userId') || '';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);

  // Selected User & Form State
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [selectedUser, setSelectedUser] = useState(null);
  const [notes, setNotes] = useState('');

  // Selected Assets state: sectionKey -> Array of asset IDs (or single ID)
  // For multiple select, we store array. For single select, we store a string/id.
  const [selectedAssets, setSelectedAssets] = useState({
    mainComputer: '',
    displays: [],
    inputs: '',
    audioVideo: '',
    network: '',
    mobile: '',
    chargers: [],
    printers: '',
    accessories: '',
  });

  // UI state
  const [confirmModal, setConfirmModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const usersList = await getCollectionItems('users');
        const assetsList = await getCollectionItems('assets');
        setUsers(usersList);
        setAssets(assetsList);
        
        if (initialUserId) {
          const matched = usersList.find(u => String(u.id) === String(initialUserId));
          setSelectedUser(matched || null);
        }
      } catch (err) {
        console.error('Error loading assignment form data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [initialUserId]);

  const handleUserChange = (userId) => {
    setSelectedUserId(userId);
    const matched = users.find(u => String(u.id) === String(userId));
    setSelectedUser(matched || null);
    setError('');
  };

  // Get available assets for a category or list of categories
  const getAvailableAssets = (categories) => {
    return assets.filter(
      (a) => categories.includes(a.category) && a.status === 'AVAILABLE'
    );
  };

  // Update selection
  const toggleAssetSelect = (sectionKey, assetId, isMultiple = false) => {
    setSelectedAssets((prev) => {
      if (isMultiple) {
        const currentList = prev[sectionKey] || [];
        const index = currentList.indexOf(assetId);
        if (index > -1) {
          return { ...prev, [sectionKey]: currentList.filter(id => id !== assetId) };
        } else {
          return { ...prev, [sectionKey]: [...currentList, assetId] };
        }
      } else {
        return { ...prev, [sectionKey]: prev[sectionKey] === assetId ? '' : assetId };
      }
    });
  };

  // Flatten all selected asset IDs into a single list
  const getSelectedAssetIdsList = () => {
    const list = [];
    Object.entries(selectedAssets).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        list.push(...val);
      } else if (val) {
        list.push(val);
      }
    });
    return list;
  };

  // Validate form selections
  const validateForm = () => {
    if (!selectedUserId) {
      setError('Please select an employee first.');
      return false;
    }
    const selectedIds = getSelectedAssetIdsList();
    if (selectedIds.length === 0) {
      setError('Please select at least one asset to assign.');
      return false;
    }

    // Verify all selected assets are indeed still AVAILABLE
    for (const id of selectedIds) {
      const asset = assets.find(a => String(a.id) === String(id));
      if (!asset) {
        setError(`Asset reference not found: ${id}`);
        return false;
      }
      if (asset.status !== 'AVAILABLE') {
        setError(`Asset ${asset.assetId} (${asset.manufacturer} ${asset.model}) is no longer available.`);
        return false;
      }
    }

    setError('');
    return true;
  };

  const handlePreAssign = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setConfirmModal(true);
    }
  };

  const executeAssignment = async () => {
    setBusy(true);
    setError('');
    
    try {
      const selectedIds = getSelectedAssetIdsList();
      const assignmentNumber = `ASN-${Date.now()}`;
      const assignmentId = `assignment-${Date.now()}`;
      
      const operations = [];

      // 1. Create Master Assignment Document
      const masterAssignment = {
        assignmentNumber,
        userId: selectedUserId,
        employeeName: selectedUser.employeeName,
        employeeEmail: selectedUser.email,
        companyName: selectedUser.companyName,
        department: selectedUser.department,
        assignedBy: 'System Admin', // logged in user mock
        assignedByName: 'System Admin',
        assignmentDate: new Date().toISOString(),
        status: 'ASSIGNED',
        totalAssets: selectedIds.length,
        acknowledgementStatus: 'PENDING',
        acknowledgementDocumentUrl: null,
        notes: notes || 'Batch User-Wise Assignment',
      };

      operations.push({
        type: 'SET',
        collectionName: 'assignments',
        docId: assignmentId,
        data: masterAssignment,
      });

      // 2. Create Assignment Items & Update Asset Statuses
      selectedIds.forEach((id) => {
        const asset = assets.find((a) => String(a.id) === String(id));
        const itemId = `item-${id}-${Date.now()}`;

        // Assignment Item document
        const assignmentItem = {
          assignmentId,
          userId: selectedUserId,
          assetId: asset.assetId,
          assetDocumentId: asset.id,
          category: asset.category,
          subcategory: asset.subcategory || null,
          manufacturer: asset.manufacturer,
          model: asset.model,
          serialNumber: asset.serialNumber,
          conditionAtAssignment: asset.condition || 'Good',
          assignedDate: new Date().toISOString(),
          status: 'ASSIGNED',
        };

        operations.push({
          type: 'SET',
          collectionName: 'assignmentItems',
          docId: itemId,
          data: assignmentItem,
        });

        // Update Asset fields
        const updatedAsset = {
          ...asset,
          status: 'ASSIGNED',
          assignedUserId: selectedUserId,
          assignedUserName: selectedUser.employeeName,
          assignmentId: assignmentId,
        };

        operations.push({
          type: 'SET',
          collectionName: 'assets',
          docId: asset.id,
          data: updatedAsset,
        });

        // Create Asset History Log
        const historyId = `hist-${id}-${Date.now()}`;
        const historyLog = {
          assetId: asset.assetId,
          userId: selectedUserId,
          assignmentId,
          action: 'ASSIGN',
          previousStatus: 'AVAILABLE',
          newStatus: 'ASSIGNED',
          performedBy: 'System Admin',
          performedAt: new Date().toISOString(),
          notes: notes || 'Assigned in user-wise bulk transaction',
        };

        operations.push({
          type: 'SET',
          collectionName: 'assetHistory',
          docId: historyId,
          data: historyLog,
        });
      });

      // Commit transaction
      await runFirestoreBatch(operations);

      setConfirmModal(false);
      navigate(`/user-profiles/${selectedUserId}`);
    } catch (err) {
      setError(`Failed to save assignment: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Loading Assignment Wizard…</div>;

  const selectedIds = getSelectedAssetIdsList();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <PageHeader title="User-Wise Asset Assignment" subtitle="Assign multiple assets to an employee in one single transaction" />

      {error && <div className="rounded bg-red-50 px-4 py-2.5 text-sm text-red-700 font-medium shadow-xs">{error}</div>}

      <form onSubmit={handlePreAssign} className="space-y-6">
        {/* Section 1: User Details */}
        <div className="card p-5 bg-white space-y-4">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 1: Select Employee</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Choose Employee" required>
              <Select
                value={selectedUserId}
                onChange={handleUserChange}
                placeholder="-- Select User --"
                options={users.map(u => ({ value: u.id, label: `${u.employeeName} (${u.email})` }))}
                required
              />
            </Field>
          </div>

          {selectedUser && (
            <div className="grid gap-3 p-4 bg-slate-50/50 rounded-2xl border border-gray-100 text-xs md:grid-cols-2">
              <div>
                <dt className="text-gray-500 font-bold">Employee Name:</dt>
                <dd className="font-semibold text-gray-800 text-sm mt-0.5">{selectedUser.employeeName}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Employee ID:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.employeeId || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Department:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.department}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Company Name:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.companyName}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Designation:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.designation || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Email Address:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Mobile Number:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.mobileNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Location:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.location || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Reporting Manager:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5">{selectedUser.reportingManager || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 font-bold">Employment Status:</dt>
                <dd className="font-semibold text-gray-800 mt-0.5 uppercase tracking-wide">{selectedUser.employmentStatus}</dd>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Main Computer */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 2: Primary Laptop or Desktop</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Laptop', 'Desktop']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.mainComputer === a.id ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="radio"
                  name="mainComputer"
                  checked={selectedAssets.mainComputer === a.id}
                  onChange={() => toggleAssetSelect('mainComputer', a.id)}
                  className="mt-1 mr-3 h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">
                    RAM: {a.ram || '—'} | HardDrive: {a.storage || '—'} | CPU: {a.cpu || '—'} | OS: {a.operatingSystem || '—'} | SN: {a.serialNumber}
                  </div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Laptop', 'Desktop']).length === 0 && (
              <span className="text-gray-400 text-xs">No laptops or desktops available.</span>
            )}
          </div>
        </div>

        {/* Section 3: Display Devices */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 3: Display Monitors (Select Multiple)</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Monitor']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.displays.includes(a.id) ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="checkbox"
                  checked={selectedAssets.displays.includes(a.id)}
                  onChange={() => toggleAssetSelect('displays', a.id, true)}
                  className="mt-1 mr-3 h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">
                    Screen Size: {a.screenSize || '—'} | Connection: {a.connectionType || '—'} | SN: {a.serialNumber}
                  </div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Monitor']).length === 0 && (
              <span className="text-gray-400 text-xs">No monitors available.</span>
            )}
          </div>
        </div>

        {/* Section 4: Input Devices */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 4: Keyboard and Mouse</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Keyboard', 'Mouse']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.inputs === a.id ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="radio"
                  name="inputs"
                  checked={selectedAssets.inputs === a.id}
                  onChange={() => toggleAssetSelect('inputs', a.id)}
                  className="mt-1 mr-3 h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.category}: {a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">SN: {a.serialNumber} | Condition: {a.condition}</div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Keyboard', 'Mouse']).length === 0 && (
              <span className="text-gray-400 text-xs">No keyboard or mouse items available.</span>
            )}
          </div>
        </div>

        {/* Section 5: Audio & Video Devices */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 5: Audio and Video Devices</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Headphone']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.audioVideo === a.id ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="radio"
                  name="audioVideo"
                  checked={selectedAssets.audioVideo === a.id}
                  onChange={() => toggleAssetSelect('audioVideo', a.id)}
                  className="mt-1 mr-3 h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">SN: {a.serialNumber} | Condition: {a.condition}</div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Headphone']).length === 0 && (
              <span className="text-gray-400 text-xs">No audio/video items available.</span>
            )}
          </div>
        </div>

        {/* Section 6: Network and Connectivity */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 6: Network and Connectivity Devices</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Wi-Fi Adapter', 'Bluetooth Adapter']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.network === a.id ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="radio"
                  name="network"
                  checked={selectedAssets.network === a.id}
                  onChange={() => toggleAssetSelect('network', a.id)}
                  className="mt-1 mr-3 h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.category}: {a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">MAC: {a.macAddress || '—'} | SN: {a.serialNumber}</div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Wi-Fi Adapter', 'Bluetooth Adapter']).length === 0 && (
              <span className="text-gray-400 text-xs">No wireless or network adapters available.</span>
            )}
          </div>
        </div>

        {/* Section 7: Mobile Devices */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 7: Mobile Phones & SIMs</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Mobile Phone']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.mobile === a.id ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="radio"
                  name="mobile"
                  checked={selectedAssets.mobile === a.id}
                  onChange={() => toggleAssetSelect('mobile', a.id)}
                  className="mt-1 mr-3 h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">
                    Phone No: {a.mobileNumber || '—'} | Provider: {a.networkProvider || '—'} | IMEI: {a.imeiNumber || '—'}
                  </div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Mobile Phone']).length === 0 && (
              <span className="text-gray-400 text-xs">No mobile phones available.</span>
            )}
          </div>
        </div>

        {/* Section 8: Chargers and Power Devices */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 8: Power Adapters & Chargers (Select Multiple)</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Laptop Charger', 'Mobile Charger']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.chargers.includes(a.id) ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="checkbox"
                  checked={selectedAssets.chargers.includes(a.id)}
                  onChange={() => toggleAssetSelect('chargers', a.id, true)}
                  className="mt-1 mr-3 h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.category}: {a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">
                    Wattage: {a.wattage || '—'} | Charger Type: {a.chargerType || '—'} | SN: {a.serialNumber}
                  </div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Laptop Charger', 'Mobile Charger']).length === 0 && (
              <span className="text-gray-400 text-xs">No chargers or power units available.</span>
            )}
          </div>
        </div>

        {/* Section 9: Printing Devices */}
        <div className="card p-5 bg-white space-y-3">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800 text-sm tracking-wide">Section 9: Printers & Scanners</h3>
          </div>
          <div className="grid gap-3">
            {getAvailableAssets(['Printer']).map((a) => (
              <label key={a.id} className={`flex items-start p-3 border rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedAssets.printers === a.id ? 'border-brand-600 bg-brand-50/10' : 'border-gray-150 bg-white'
              }`}>
                <input
                  type="radio"
                  name="printers"
                  checked={selectedAssets.printers === a.id}
                  onChange={() => toggleAssetSelect('printers', a.id)}
                  className="mt-1 mr-3 h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-gray-800">{a.manufacturer} {a.model} ({a.assetId})</span>
                  <div className="text-gray-500">
                    IP: {a.ipAddress || '—'} | connection: {a.connectionType || '—'} | SN: {a.serialNumber}
                  </div>
                </div>
              </label>
            ))}
            {getAvailableAssets(['Printer']).length === 0 && (
              <span className="text-gray-400 text-xs">No printer hardware available.</span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="card p-5 bg-white">
          <Field label="Assignment Notes / Remarks">
            <textarea
              className="input text-xs"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide reason or comments for this assignment transaction..."
            />
          </Field>
        </div>

        {/* Form Controls */}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/user-profiles')}>
            Cancel
          </button>
          <button className="btn-primary px-6">
            Assign All Assets
          </button>
        </div>
      </form>

      {/* Step 5: Confirmation Modal */}
      <Modal open={confirmModal} title="Confirm Asset Assignment" onClose={() => setConfirmModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 space-y-1">
            <span className="text-2xs font-bold text-gray-400 uppercase tracking-wide">Assigning to User</span>
            <h4 className="font-extrabold text-gray-800 text-base">{selectedUser?.employeeName}</h4>
            <p className="text-xs text-gray-500">{selectedUser?.email} | Department: {selectedUser?.department}</p>
          </div>

          <div className="space-y-2">
            <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider block">Selected Hardware ({selectedIds.length})</span>
            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100 bg-white">
              {selectedIds.map((id) => {
                const a = assets.find(item => String(item.id) === String(id));
                return (
                  <div key={id} className="p-2.5 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-gray-800">{a?.manufacturer} {a?.model}</span>
                      <p className="text-2xs text-gray-400">{a?.category} | SN: {a?.serialNumber}</p>
                    </div>
                    <span className="rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-2xs font-bold text-indigo-700">
                      {a?.assetId}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setConfirmModal(false)} disabled={busy}>
              Go Back
            </button>
            <button onClick={executeAssignment} className="btn-primary" disabled={busy}>
              {busy ? 'Processing…' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
