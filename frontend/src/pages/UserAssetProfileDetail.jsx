import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCollectionItems, runFirestoreBatch } from '../utils/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';

export default function UserAssetProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [assignedAssets, setAssignedAssets] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);

  // Modal control states
  const [returnAllModal, setReturnAllModal] = useState(false);
  const [replaceModal, setReplaceModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [selectedAssetForAction, setSelectedAssetForAction] = useState(null);

  // Return All / Return Asset form states
  const [returnConditions, setReturnConditions] = useState({}); // assetId -> condition
  const [returnNotes, setReturnNotes] = useState('');

  // Replace Asset form states
  const [replacementAssetId, setReplacementAssetId] = useState('');
  const [replaceReason, setReplaceReason] = useState('');

  // Transfer Asset form states
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Busy/Save state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Fetch all collections
  const loadProfileData = async () => {
    try {
      const usersList = await getCollectionItems('users');
      const assetsList = await getCollectionItems('assets');
      const assignmentsList = await getCollectionItems('assignments');
      const historyList = await getCollectionItems('assetHistory');

      const foundProfile = usersList.find((u) => String(u.id) === String(id));
      if (!foundProfile) {
        navigate('/user-profiles');
        return;
      }

      setProfile(foundProfile);
      setAllUsers(usersList);
      setAllAssets(assetsList);
      
      // Filter current user assignments and assets
      const userAssets = assetsList.filter(
        (a) => String(a.assignedUserId) === String(id) && a.status === 'ASSIGNED'
      );
      setAssignedAssets(userAssets);

      const userAssignments = assignmentsList.filter((a) => String(a.userId) === String(id));
      setAssignments(userAssignments);

      const userHistory = historyList.filter((h) => String(h.userId) === String(id));
      setHistory(userHistory);

      // Pre-initialize return conditions
      const conds = {};
      userAssets.forEach((a) => {
        conds[a.id] = 'Good';
      });
      setReturnConditions(conds);

    } catch (err) {
      console.error('Error fetching profile detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [id]);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading User Profile Detail…</div>;

  // Calculate dashboard stats for header
  const totalAssigned = assignedAssets.length;
  const primaryComputer = assignedAssets.find((a) => ['Laptop', 'Desktop'].includes(a.category))?.assetId || '—';
  
  const lastAssignmentDate = assignments.length > 0 
    ? new Date(Math.max(...assignments.map(a => new Date(a.assignmentDate)))).toLocaleDateString()
    : '—';

  // Categorize assigned assets
  const categorize = (cats) => assignedAssets.filter((a) => cats.includes(a.category));
  const otherAccessories = assignedAssets.filter((a) => 
    !['Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Headphone', 'Wi-Fi Adapter', 'Bluetooth Adapter', 'Mobile Phone', 'Laptop Charger', 'Mobile Charger', 'Printer'].includes(a.category)
  );

  // Return Single / All Assets
  const handleReturnAll = async () => {
    setBusy(true);
    setError('');
    try {
      const operations = [];
      const returnDateStr = new Date().toISOString();

      assignedAssets.forEach((asset) => {
        const cond = returnConditions[asset.id] || 'Good';

        // 1. Update Asset to AVAILABLE
        const updatedAsset = {
          ...asset,
          status: 'AVAILABLE',
          assignedUserId: null,
          assignedUserName: null,
          assignmentId: null,
          condition: cond,
        };

        operations.push({
          type: 'SET',
          collectionName: 'assets',
          docId: asset.id,
          data: updatedAsset,
        });

        // 2. Log History
        const historyId = `hist-ret-${asset.id}-${Date.now()}`;
        const historyLog = {
          assetId: asset.assetId,
          userId: id,
          assignmentId: asset.assignmentId || 'unknown',
          action: 'RETURN',
          previousStatus: 'ASSIGNED',
          newStatus: 'AVAILABLE',
          performedBy: currentUser?.displayName || 'IT Support',
          performedAt: returnDateStr,
          notes: `Returned condition: ${cond}. Notes: ${returnNotes || 'None'}`,
        };

        operations.push({
          type: 'SET',
          collectionName: 'assetHistory',
          docId: historyId,
          data: historyLog,
        });
      });

      // Update employee status in mock to cleared
      const updatedUser = {
        ...profile,
        employmentStatus: 'ACTIVE', // Or cleared flag
      };
      operations.push({
        type: 'SET',
        collectionName: 'users',
        docId: profile.id,
        data: updatedUser,
      });

      await runFirestoreBatch(operations);
      setReturnAllModal(false);
      setReturnNotes('');
      await loadProfileData();
    } catch (err) {
      setError(`Failed to process return: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Replace Asset
  const handleReplaceAsset = async () => {
    if (!replacementAssetId) {
      setError('Please select a replacement device.');
      return;
    }
    setBusy(true);
    setError('');

    try {
      const operations = [];
      const dateStr = new Date().toISOString();
      const oldAsset = selectedAssetForAction;
      const newAsset = allAssets.find((a) => String(a.id) === String(replacementAssetId));

      // 1. Return old asset (make AVAILABLE)
      operations.push({
        type: 'SET',
        collectionName: 'assets',
        docId: oldAsset.id,
        data: {
          ...oldAsset,
          status: 'AVAILABLE',
          assignedUserId: null,
          assignedUserName: null,
          assignmentId: null,
        },
      });

      // Log Return history
      operations.push({
        type: 'SET',
        collectionName: 'assetHistory',
        docId: `hist-rep-ret-${oldAsset.id}-${Date.now()}`,
        data: {
          assetId: oldAsset.assetId,
          userId: id,
          assignmentId: oldAsset.assignmentId || 'unknown',
          action: 'RETURN',
          previousStatus: 'ASSIGNED',
          newStatus: 'AVAILABLE',
          performedBy: currentUser?.displayName || 'IT Manager',
          performedAt: dateStr,
          notes: `Replaced by ${newAsset.assetId}. Reason: ${replaceReason || 'Replacement request'}`,
        },
      });

      // 2. Assign new asset to this user
      operations.push({
        type: 'SET',
        collectionName: 'assets',
        docId: newAsset.id,
        data: {
          ...newAsset,
          status: 'ASSIGNED',
          assignedUserId: id,
          assignedUserName: profile.employeeName,
          assignmentId: `rep-asn-${Date.now()}`,
        },
      });

      // Log Assign history
      operations.push({
        type: 'SET',
        collectionName: 'assetHistory',
        docId: `hist-rep-asn-${newAsset.id}-${Date.now()}`,
        data: {
          assetId: newAsset.assetId,
          userId: id,
          assignmentId: `rep-asn-${Date.now()}`,
          action: 'ASSIGN',
          previousStatus: 'AVAILABLE',
          newStatus: 'ASSIGNED',
          performedBy: currentUser?.displayName || 'IT Manager',
          performedAt: dateStr,
          notes: `Replacement upgrade. Replaced old asset ${oldAsset.assetId}. Reason: ${replaceReason || 'Upgrade'}`,
        },
      });

      await runFirestoreBatch(operations);
      setReplaceModal(false);
      setReplacementAssetId('');
      setReplaceReason('');
      await loadProfileData();
    } catch (err) {
      setError(`Failed to replace asset: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Transfer Asset
  const handleTransferAsset = async () => {
    if (!transferTargetUserId) {
      setError('Please select a target employee.');
      return;
    }
    setBusy(true);
    setError('');

    try {
      const operations = [];
      const dateStr = new Date().toISOString();
      const asset = selectedAssetForAction;
      const targetUser = allUsers.find((u) => String(u.id) === String(transferTargetUserId));

      // 1. Log transfer details in history of the CURRENT user
      operations.push({
        type: 'SET',
        collectionName: 'assetHistory',
        docId: `hist-trsf-out-${asset.id}-${Date.now()}`,
        data: {
          assetId: asset.assetId,
          userId: id, // current user ID
          assignmentId: asset.assignmentId || 'unknown',
          action: 'TRANSFER_OUT',
          previousStatus: 'ASSIGNED',
          newStatus: 'AVAILABLE',
          performedBy: currentUser?.displayName || 'IT Manager',
          performedAt: dateStr,
          notes: `Transferred to ${targetUser.employeeName} (${targetUser.email}). Reason: ${transferReason || 'Transfer request'}`,
        },
      });

      // 2. Re-assign asset to the NEW user
      operations.push({
        type: 'SET',
        collectionName: 'assets',
        docId: asset.id,
        data: {
          ...asset,
          status: 'ASSIGNED',
          assignedUserId: targetUser.id,
          assignedUserName: targetUser.employeeName,
          assignmentId: `trsf-asn-${Date.now()}`,
        },
      });

      // 3. Log history on target user
      operations.push({
        type: 'SET',
        collectionName: 'assetHistory',
        docId: `hist-trsf-in-${asset.id}-${Date.now()}`,
        data: {
          assetId: asset.assetId,
          userId: targetUser.id, // target user ID
          assignmentId: `trsf-asn-${Date.now()}`,
          action: 'ASSIGN',
          previousStatus: 'AVAILABLE',
          newStatus: 'ASSIGNED',
          performedBy: currentUser?.displayName || 'IT Manager',
          performedAt: dateStr,
          notes: `Transferred from ${profile.employeeName} (${profile.email}). Reason: ${transferReason || 'Transfer request'}`,
        },
      });

      await runFirestoreBatch(operations);
      setTransferModal(false);
      setTransferTargetUserId('');
      setTransferReason('');
      await loadProfileData();
    } catch (err) {
      setError(`Failed to transfer asset: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Generate Acknowledgement / Send Email alerts
  const handleAcknowledgeMock = (actionName) => {
    alert(`Success: ${actionName} transaction generated and registered for ${profile.employeeName}!`);
  };

  // Status Color Helper
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

  // Helper to render asset card
  const renderAssetCard = (asset) => (
    <div key={asset.id} className="border border-gray-100 rounded-2xl p-4 bg-white shadow-xs space-y-3 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="font-extrabold text-indigo-900 text-xs">{asset.assetId}</span>
          <span className={`px-2 py-0.5 rounded-full text-2xs font-bold border ${getBadgeStyle(asset.status)}`}>
            {asset.status}
          </span>
        </div>
        <h4 className="text-xs font-bold text-gray-800">{asset.manufacturer} {asset.model}</h4>
        <p className="text-2xs text-gray-500 leading-normal">
          <strong>SN:</strong> {asset.serialNumber} <br />
          {asset.screenSize && <><strong>Screen:</strong> {asset.screenSize} <br /></>}
          {asset.ram && <><strong>Specs:</strong> {asset.ram} | {asset.storage || '—'} <br /></>}
          <strong>Condition:</strong> {asset.condition}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-gray-50">
        <button
          onClick={() => {
            setSelectedAssetForAction(asset);
            setReplaceModal(true);
          }}
          className="px-2 py-1 bg-slate-50 border border-gray-200 text-gray-700 rounded-lg text-2xs font-bold hover:bg-gray-100"
        >
          Replace
        </button>
        <button
          onClick={() => {
            setSelectedAssetForAction(asset);
            setTransferModal(true);
          }}
          className="px-2 py-1 bg-slate-50 border border-gray-200 text-gray-700 rounded-lg text-2xs font-bold hover:bg-gray-100"
        >
          Transfer
        </button>
        <button
          onClick={() => {
            const conds = { ...returnConditions, [asset.id]: 'Good' };
            setReturnConditions(conds);
            setSelectedAssetForAction(asset);
            // We reuse return all modal, displaying only the selected one
            setReturnAllModal(true);
          }}
          className="col-span-2 px-2 py-1 bg-red-50 border border-red-100 text-red-700 rounded-lg text-2xs font-bold hover:bg-red-100"
        >
          Return Device
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={`${profile.employeeName}'s Asset Profile`}
        subtitle="Full employee hardware inventory ledger"
        actions={
          <div className="flex gap-2.5">
            <button className="btn-secondary" onClick={() => navigate('/user-profiles')}>
              Back to Profiles
            </button>
            <button className="btn-primary" onClick={() => navigate(`/assets/assign?userId=${id}`)}>
              Assign More Assets
            </button>
            {assignedAssets.length > 0 && (
              <button className="btn-danger" onClick={() => {
                setSelectedAssetForAction(null); // return all
                setReturnAllModal(true);
              }}>
                Return All Assets
              </button>
            )}
          </div>
        }
      />

      {/* Profile summary header */}
      <div className="card p-6 bg-white grid gap-6 md:grid-cols-4 shadow-xs items-center">
        <div className="flex items-center space-x-3 border-r border-gray-100 pr-4">
          <div className="h-14 w-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow">
            {profile.employeeName.charAt(0)}
          </div>
          <div>
            <h3 className="font-extrabold text-gray-800 text-base">{profile.employeeName}</h3>
            <p className="text-xs text-gray-500">{profile.designation || 'ITSM Member'}</p>
          </div>
        </div>

        <div className="text-xs space-y-1">
          <div><span className="text-gray-400 font-bold">Employee ID:</span> <span className="font-semibold text-gray-700">{profile.employeeId || '—'}</span></div>
          <div><span className="text-gray-400 font-bold">Email ID:</span> <span className="font-semibold text-gray-700">{profile.email}</span></div>
          <div><span className="text-gray-400 font-bold">Location:</span> <span className="font-semibold text-gray-700">{profile.location || '—'}</span></div>
        </div>

        <div className="text-xs space-y-1">
          <div><span className="text-gray-400 font-bold">Company Name:</span> <span className="font-semibold text-gray-700">{profile.companyName}</span></div>
          <div><span className="text-gray-400 font-bold">Department:</span> <span className="font-semibold text-gray-700">{profile.department}</span></div>
          <div><span className="text-gray-400 font-bold">Status:</span> <span className="font-bold text-emerald-600 uppercase text-2xs tracking-wide">{profile.employmentStatus}</span></div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 text-center grid grid-cols-3 gap-2">
          <div>
            <span className="text-2xs font-bold text-gray-400 uppercase">Devices</span>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{totalAssigned}</h4>
          </div>
          <div className="col-span-2">
            <span className="text-2xs font-bold text-gray-400 uppercase">Primary Computer</span>
            <h4 className="text-xs font-black text-indigo-700 truncate mt-1">{primaryComputer}</h4>
          </div>
        </div>
      </div>

      {/* Custom Action Utilities */}
      <div className="flex flex-wrap gap-2.5">
        <button onClick={() => handleAcknowledgeMock('Acknowledgement Form')} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100">
          📄 Generate Acknowledgement Form
        </button>
        <button onClick={() => handleAcknowledgeMock('Acknowledgement Email')} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100">
          ✉️ Send Acknowledgement Email
        </button>
        <button onClick={() => window.print()} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100">
          🖨️ Print User Profile
        </button>
      </div>

      {/* Categorized Assigned Assets Grid */}
      <div className="space-y-6">
        {/* Category: Computers */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">1. Computers & Terminals</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Laptop', 'Desktop']).map(renderAssetCard)}
            {categorize(['Laptop', 'Desktop']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No computers assigned.</span>}
          </div>
        </div>

        {/* Category: Display Monitors */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">2. Displays & Monitors</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Monitor']).map(renderAssetCard)}
            {categorize(['Monitor']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No display monitors assigned.</span>}
          </div>
        </div>

        {/* Category: Inputs */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">3. Input Accessories</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Keyboard', 'Mouse']).map(renderAssetCard)}
            {categorize(['Keyboard', 'Mouse']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No keyboards or mouse accessories assigned.</span>}
          </div>
        </div>

        {/* Category: Audio/Video & Wireless */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">4. Audio, Network & Mobile Devices</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Headphone', 'Wi-Fi Adapter', 'Bluetooth Adapter', 'Mobile Phone']).map(renderAssetCard)}
            {categorize(['Headphone', 'Wi-Fi Adapter', 'Bluetooth Adapter', 'Mobile Phone']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No audio, wireless cards, or mobile devices assigned.</span>}
          </div>
        </div>

        {/* Category: Power */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">5. Chargers & Power Adapters</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Laptop Charger', 'Mobile Charger']).map(renderAssetCard)}
            {categorize(['Laptop Charger', 'Mobile Charger']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No chargers assigned.</span>}
          </div>
        </div>

        {/* Category: Printers */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">6. Printers & Shared Scanners</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Printer']).map(renderAssetCard)}
            {categorize(['Printer']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No printers assigned.</span>}
          </div>
        </div>

        {/* Category: Accessories */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">7. Other Accessories & Cable kits</h3>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {otherAccessories.map(renderAssetCard)}
            {otherAccessories.length === 0 && <span className="text-gray-400 text-xs col-span-4">No other accessory kits assigned.</span>}
          </div>
        </div>

        {/* Assignment History Logs */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">8. Historical Operations Log</h3>
          <div className="border border-gray-100 rounded-2xl bg-white overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-gray-500 border-b border-gray-150">
                <tr>
                  <th className="p-3">Asset ID</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Operator</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Log Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/20">
                    <td className="p-3 font-semibold text-indigo-900">{h.assetId}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        h.action === 'ASSIGN' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                      }`}>{h.action}</span>
                    </td>
                    <td className="p-3 text-gray-600">{h.performedBy}</td>
                    <td className="p-3 text-gray-500">{new Date(h.performedAt).toLocaleString()}</td>
                    <td className="p-3 text-gray-500">{h.notes}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-400">No historical records recorded</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Return Assets Dialog Modal */}
      <Modal open={returnAllModal} title={selectedAssetForAction ? "Return Selected Device" : "Return All Assigned Assets"} onClose={() => setReturnAllModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-4">
          <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white p-2">
            {(selectedAssetForAction ? [selectedAssetForAction] : assignedAssets).map((asset) => (
              <div key={asset.id} className="py-2 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-gray-800">{asset.manufacturer} {asset.model}</span>
                  <p className="text-2xs text-gray-400">{asset.assetId} | SN: {asset.serialNumber}</p>
                </div>
                <Field label="Return Condition">
                  <Select
                    value={returnConditions[asset.id] || 'Good'}
                    onChange={(val) => setReturnConditions((prev) => ({ ...prev, [asset.id]: val }))}
                    options={[
                      { value: 'Good', label: 'Good' },
                      { value: 'Fair', label: 'Fair' },
                      { value: 'Damaged', label: 'Damaged' },
                      { value: 'Lost', label: 'Lost' }
                    ]}
                  />
                </Field>
              </div>
            ))}
          </div>

          <Field label="Return Comments / Closure Notes">
            <textarea
              className="input text-xs"
              rows={2}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="e.g. Employee resignation or hardware upgrade request..."
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setReturnAllModal(false)} disabled={busy}>
              Cancel
            </button>
            <button onClick={handleReturnAll} className="btn-danger" disabled={busy}>
              {busy ? 'Processing…' : 'Confirm Return'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Replace Asset Dialog Modal */}
      <Modal open={replaceModal} title={`Replace Device ${selectedAssetForAction?.assetId}`} onClose={() => setReplaceModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-xs text-amber-800">
            ⚠️ Replacing this device will return <strong>{selectedAssetForAction?.manufacturer} {selectedAssetForAction?.model} ({selectedAssetForAction?.assetId})</strong> to storage inventory as AVAILABLE and replace it with another item of the same category.
          </div>

          <Field label="Select Replacement Hardware" required>
            <Select
              value={replacementAssetId}
              onChange={setReplacementAssetId}
              placeholder="-- Choose Replacement --"
              options={allAssets
                .filter((a) => a.category === selectedAssetForAction?.category && a.status === 'AVAILABLE')
                .map((a) => ({ value: a.id, label: `${a.manufacturer} ${a.model} (${a.assetId}) - SN: ${a.serialNumber}` }))
              }
              required
            />
          </Field>

          <Field label="Replacement Reason" required>
            <textarea
              className="input text-xs"
              rows={2}
              value={replaceReason}
              onChange={(e) => setReplaceReason(e.target.value)}
              placeholder="Provide reason for replacing this device (e.g., keyboard keys damaged, motherboard failed)..."
              required
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setReplaceModal(false)} disabled={busy}>
              Cancel
            </button>
            <button onClick={handleReplaceAsset} className="btn-primary" disabled={busy}>
              {busy ? 'Processing…' : 'Execute Replacement'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Transfer Asset Dialog Modal */}
      <Modal open={transferModal} title={`Transfer Device ${selectedAssetForAction?.assetId}`} onClose={() => setTransferModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-xs text-blue-800">
            ℹ️ You are transferring <strong>{selectedAssetForAction?.manufacturer} {selectedAssetForAction?.model} ({selectedAssetForAction?.assetId})</strong> directly to another employee.
          </div>

          <Field label="Target Employee" required>
            <Select
              value={transferTargetUserId}
              onChange={setTransferTargetUserId}
              placeholder="-- Choose Target User --"
              options={allUsers
                .filter((u) => String(u.id) !== String(id))
                .map((u) => ({ value: u.id, label: `${u.employeeName} (${u.email})` }))
              }
              required
            />
          </Field>

          <Field label="Reason for Transfer" required>
            <textarea
              className="input text-xs"
              rows={2}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Provide reason for this device transfer..."
              required
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setTransferModal(false)} disabled={busy}>
              Cancel
            </button>
            <button onClick={handleTransferAsset} className="btn-primary" disabled={busy}>
              {busy ? 'Processing…' : 'Execute Transfer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
