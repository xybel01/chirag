import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCollectionItems, setCollectionDoc, runFirestoreBatch } from '../utils/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';
import api from '../api/client';
import { syncSingleAssetToFirestore } from '../utils/sync.js';
import { fmtMoney, fmtDate } from '../utils/format.js';

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
  const [profileLicenses, setProfileLicenses] = useState([]);

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

  // Edit Profile modal & form states
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
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
  const [profileError, setProfileError] = useState('');

  // Assign Asset direct modal states
  const [assignModal, setAssignModal] = useState(false);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [selectedAssignAssetId, setSelectedAssignAssetId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignModalTitle, setAssignModalTitle] = useState('Assign Asset');

  // Assign License modal states
  const [assignLicenseModal, setAssignLicenseModal] = useState(false);
  const [availableLicenses, setAvailableLicenses] = useState([]);
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [ackFormModal, setAckFormModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

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

      try {
        const licensesRes = await api.get('/licenses', { params: { pageSize: 100 } });
        const licensesList = Array.isArray(licensesRes.data) ? licensesRes.data : (licensesRes.data?.items || []);
        const userLicenses = licensesList.filter(l =>
          l.assignments?.some(a => 
            a.user?.email?.toLowerCase() === foundProfile.email?.toLowerCase() ||
            String(a.userId) === String(foundProfile.id) ||
            String(a.user?.id) === String(foundProfile.id)
          )
        );
        setProfileLicenses(userLicenses);
      } catch (err) {
        console.warn('Backend server is offline or mock licenses empty. Skipping licenses fetch.', err);
      }

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
      const pgUser = await getOrCreatePgUser(profile.email, profile.employeeName);

      for (const asset of assignedAssets) {
        const cond = returnConditions[asset.id] || 'Good';

        // Find pgAsset
        const assetRes = await api.get('/assets', { params: { search: asset.serialNumber } });
        const pgAsset = assetRes.data.items?.find(a => a.serialNumber === asset.serialNumber);

        if (pgAsset) {
          // 1. Post return assignment to PostgreSQL
          await api.post('/assignments', {
            assetId: pgAsset.id,
            userId: pgUser.id,
            action: 'RETURN',
            notes: `Returned condition: ${cond}. Notes: ${returnNotes || 'None'}`,
          });

          // 2. Sync to Firestore
          const latestAssetRes = await api.get(`/assets/${pgAsset.id}`);
          await syncSingleAssetToFirestore(latestAssetRes.data);
        }

        // 3. Log History in Firestore
        const historyId = `hist-ret-${asset.id}-${Date.now()}`;
        const historyLog = {
          assetId: asset.assetId,
          userId: id,
          assignmentId: asset.assignmentId || 'unknown',
          action: 'RETURN',
          previousStatus: 'ASSIGNED',
          newStatus: 'AVAILABLE',
          performedBy: currentUser?.displayName || 'IT Support',
          performedAt: new Date().toISOString(),
          notes: `Returned condition: ${cond}. Notes: ${returnNotes || 'None'}`,
        };
        await setCollectionDoc('assetHistory', historyId, historyLog);
      }

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
      const pgUser = await getOrCreatePgUser(profile.email, profile.employeeName);

      const oldAsset = selectedAssetForAction;
      const newAsset = allAssets.find((a) => String(a.id) === String(replacementAssetId));

      // Find pgOldAsset
      const oldAssetRes = await api.get('/assets', { params: { search: oldAsset.serialNumber } });
      const pgOldAsset = oldAssetRes.data.items?.find(a => a.serialNumber === oldAsset.serialNumber);

      // Find pgNewAsset
      const newAssetRes = await api.get('/assets', { params: { search: newAsset.serialNumber } });
      const pgNewAsset = newAssetRes.data.items?.find(a => a.serialNumber === newAsset.serialNumber);

      if (pgOldAsset && pgNewAsset) {
        // 1. Return old asset in postgres
        await api.post('/assignments', {
          assetId: pgOldAsset.id,
          userId: pgUser.id,
          action: 'RETURN',
          notes: `Replaced by ${newAsset.assetId}. Reason: ${replaceReason || 'Replacement request'}`,
        });

        // 2. Assign new asset in postgres
        await api.post('/assignments', {
          assetId: pgNewAsset.id,
          userId: pgUser.id,
          action: 'ASSIGN',
          notes: `Replacement upgrade. Replaced old asset ${oldAsset.assetId}. Reason: ${replaceReason || 'Upgrade'}`,
        });

        // Sync both to firestore
        const latestOld = await api.get(`/assets/${pgOldAsset.id}`);
        await syncSingleAssetToFirestore(latestOld.data);

        const latestNew = await api.get(`/assets/${pgNewAsset.id}`);
        await syncSingleAssetToFirestore(latestNew.data);
      }

      // Log Return history in Firestore
      await setCollectionDoc('assetHistory', `hist-rep-ret-${oldAsset.id}-${Date.now()}`, {
        assetId: oldAsset.assetId,
        userId: id,
        assignmentId: oldAsset.assignmentId || 'unknown',
        action: 'RETURN',
        previousStatus: 'ASSIGNED',
        newStatus: 'AVAILABLE',
        performedBy: currentUser?.displayName || 'IT Manager',
        performedAt: new Date().toISOString(),
        notes: `Replaced by ${newAsset.assetId}. Reason: ${replaceReason || 'Replacement request'}`,
      });

      // Log Assign history in Firestore
      await setCollectionDoc('assetHistory', `hist-rep-asn-${newAsset.id}-${Date.now()}`, {
        assetId: newAsset.assetId,
        userId: id,
        assignmentId: `rep-asn-${Date.now()}`,
        action: 'ASSIGN',
        previousStatus: 'AVAILABLE',
        newStatus: 'ASSIGNED',
        performedBy: currentUser?.displayName || 'IT Manager',
        performedAt: new Date().toISOString(),
        notes: `Replacement upgrade. Replaced old asset ${oldAsset.assetId}. Reason: ${replaceReason || 'Upgrade'}`,
      });

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
      const asset = selectedAssetForAction;
      const targetUser = allUsers.find((u) => String(u.id) === String(transferTargetUserId));

      const pgUserFrom = await getOrCreatePgUser(profile.email, profile.employeeName);
      const pgUserTo = await getOrCreatePgUser(targetUser.email, targetUser.employeeName);

      // Find pgAsset
      const assetRes = await api.get('/assets', { params: { search: asset.serialNumber } });
      const pgAsset = assetRes.data.items?.find(a => a.serialNumber === asset.serialNumber);

      if (pgAsset) {
        // Post transfer in postgres
        await api.post('/assignments', {
          assetId: pgAsset.id,
          userId: pgUserTo.id,
          action: 'TRANSFER',
          notes: transferReason || 'Transfer request',
        });

        // Sync to firestore
        const latestAssetRes = await api.get(`/assets/${pgAsset.id}`);
        await syncSingleAssetToFirestore(latestAssetRes.data);
      }

      // Log transfer out on current user in Firestore
      await setCollectionDoc('assetHistory', `hist-trsf-out-${asset.id}-${Date.now()}`, {
        assetId: asset.assetId,
        userId: id,
        assignmentId: asset.assignmentId || 'unknown',
        action: 'TRANSFER_OUT',
        previousStatus: 'ASSIGNED',
        newStatus: 'AVAILABLE',
        performedBy: currentUser?.displayName || 'IT Manager',
        performedAt: new Date().toISOString(),
        notes: `Transferred to ${targetUser.employeeName} (${targetUser.email}). Reason: ${transferReason || 'Transfer request'}`,
      });

      // Log transfer in on target user in Firestore
      await setCollectionDoc('assetHistory', `hist-trsf-in-${asset.id}-${Date.now()}`, {
        assetId: asset.assetId,
        userId: targetUser.id,
        assignmentId: `trsf-asn-${Date.now()}`,
        action: 'ASSIGN',
        previousStatus: 'AVAILABLE',
        newStatus: 'ASSIGNED',
        performedBy: currentUser?.displayName || 'IT Manager',
        performedAt: new Date().toISOString(),
        notes: `Transferred from ${profile.employeeName} (${profile.email}). Reason: ${transferReason || 'Transfer request'}`,
      });

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
    if (actionName === 'Acknowledgement Form') {
      setAckFormModal(true);
    } else {
      alert(`Success: ${actionName} transaction generated and registered for ${profile.employeeName}!`);
    }
  };

  const handleSendAckEmail = async () => {
    if (!profile?.email) {
      alert('Error: Employee does not have a registered email address!');
      return;
    }
    setSendingEmail(true);
    try {
      await api.post('/dashboard/send-ack-email', {
        employeeEmail: profile.email,
        employeeName: profile.employeeName,
        assets: assignedAssets.map(a => ({
          assetId: a.assetId,
          category: a.category,
          manufacturer: a.manufacturer,
          model: a.model,
          serialNumber: a.serialNumber
        }))
      });
      alert(`Success: Acknowledgement email successfully sent to ${profile.email}!`);
    } catch (err) {
      console.error(err);
      alert(`Failed to send email: ${err.response?.data?.error || err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const openEditProfile = () => {
    setProfileForm({
      employeeName: profile.employeeName || '',
      employeeId: profile.employeeId || '',
      email: profile.email || '',
      department: profile.department || '',
      companyName: profile.companyName || '',
      location: profile.location || '',
      designation: profile.designation || '',
      mobileNumber: profile.mobileNumber || '',
      employmentStatus: profile.employmentStatus || 'ACTIVE'
    });
    setProfileError('');
    setEditProfileModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    try {
      await setCollectionDoc('users', id, profileForm);
      setEditProfileModal(false);
      await loadProfileData();
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile details.');
    }
  };

  const getOrCreatePgUser = async (email, name) => {
    const res = await api.get('/users', { params: { search: email } });
    let pgUser = res.data.items?.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!pgUser) {
      const createRes = await api.post('/users', {
        name: name,
        email: email,
        role: 'EMPLOYEE',
        isActive: true,
      });
      pgUser = createRes.data;
    }
    return pgUser;
  };

  const openAssignModal = async (categoryFilter = null, customTitle = 'Asset', isOther = false) => {
    setBusy(true);
    setError('');
    setAssignModalTitle(`Assign ${customTitle} to ${profile.employeeName}`);
    try {
      const res = await api.get('/assets', { params: { status: 'AVAILABLE', pageSize: 1000 } });
      let items = res.data.items || [];
      if (categoryFilter) {
        items = items.filter(a => categoryFilter.includes(a.category?.name));
      } else if (isOther) {
        const predefined = ['Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Headphone', 'Wi-Fi Adapter', 'Bluetooth Adapter', 'Mobile Phone', 'Laptop Charger', 'Mobile Charger', 'Printer'];
        items = items.filter(a => !predefined.includes(a.category?.name));
      }
      setAvailableAssets(items);
      setAssignNotes('');
      setSelectedAssignAssetId('');
      setAssignModal(true);
    } catch (err) {
      setError('Failed to fetch available assets: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const openAssignLicenseModal = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.get('/licenses', { params: { pageSize: 100 } });
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setAvailableLicenses(list);
      setSelectedLicenseId('');
      setAssignLicenseModal(true);
    } catch (err) {
      setError('Failed to fetch licenses: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAssignLicenseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLicenseId) {
      setError('Please select a license to allocate.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const pgUser = await getOrCreatePgUser(profile.email, profile.employeeName);
      await api.post(`/licenses/${selectedLicenseId}/assign`, { userId: pgUser.id });
      setAssignLicenseModal(false);
      setSelectedLicenseId('');
      await loadProfileData();
    } catch (err) {
      setError(`Failed to allocate license: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeLicense = async (licenseId) => {
    if (!window.confirm('Are you sure you want to revoke this software license assignment?')) return;
    setBusy(true);
    setError('');
    try {
      const pgUser = await getOrCreatePgUser(profile.email, profile.employeeName);
      await api.post(`/licenses/${licenseId}/revoke`, { userId: pgUser.id });
      await loadProfileData();
    } catch (err) {
      setError(`Failed to revoke license: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAssignAssetDirect = async () => {
    if (!selectedAssignAssetId) {
      setError('Please select an asset to assign.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const pgUser = await getOrCreatePgUser(profile.email, profile.employeeName);
      const pgAsset = availableAssets.find((a) => String(a.id) === String(selectedAssignAssetId));
      if (!pgAsset) throw new Error('Asset not found.');

      await api.post('/assignments', {
        assetId: pgAsset.id,
        userId: pgUser.id,
        action: 'ASSIGN',
        notes: assignNotes || 'Assigned directly from User Profile details page.',
      });

      // Get latest asset state from postgres
      const assetRes = await api.get(`/assets/${pgAsset.id}`);
      await syncSingleAssetToFirestore(assetRes.data);

      setAssignModal(false);
      setSelectedAssignAssetId('');
      setAssignNotes('');
      await loadProfileData();
    } catch (err) {
      setError(`Failed to assign asset: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
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
          <strong>Condition:</strong> {asset.condition} <br />
          {asset.purchasePrice && <><strong>Price:</strong> {fmtMoney(asset.purchasePrice)} <br /></>}
          {asset.purchaseDate && <><strong>Purchase Date:</strong> {fmtDate(asset.purchaseDate)} <br /></>}
          {asset.warrantyExpiry && <><strong>Warranty Expiry:</strong> {fmtDate(asset.warrantyExpiry)} <br /></>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-gray-50 print:hidden">
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
            <button className="btn-secondary text-brand-700 bg-brand-50 border-brand-200" onClick={openEditProfile}>
              Edit Profile
            </button>
            <button className="btn-primary" onClick={openAssignModal}>
              Assign Asset
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
          <div><span className="text-gray-400 font-bold">Mobile:</span> <span className="font-semibold text-gray-700">{profile.mobileNumber || '—'}</span></div>
        </div>

        <div className="text-xs space-y-1">
          <div><span className="text-gray-400 font-bold">Company Name:</span> <span className="font-semibold text-gray-700">{profile.companyName}</span></div>
          <div><span className="text-gray-400 font-bold">Department:</span> <span className="font-semibold text-gray-700">{profile.department}</span></div>
          <div><span className="text-gray-400 font-bold">Joining Date:</span> <span className="font-semibold text-gray-700">{profile.joiningDate || '—'}</span></div>
          <div><span className="text-gray-400 font-bold">Clearance:</span> <span className={`font-bold uppercase text-2xs ${totalAssigned === 0 ? 'text-emerald-600' : 'text-blue-600'}`}>{totalAssigned === 0 ? 'Asset Cleared' : 'Pending Clearance'}</span></div>
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
      <div className="flex flex-wrap gap-2.5 print:hidden">
        <button onClick={() => handleAcknowledgeMock('Acknowledgement Form')} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100">
          📄 Generate Acknowledgement Form
        </button>
        <button onClick={handleSendAckEmail} disabled={sendingEmail} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 disabled:opacity-50">
          {sendingEmail ? '✉️ Sending...' : '✉️ Send Acknowledgement Email'}
        </button>
        <button onClick={() => window.print()} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100">
          🖨️ Print User Profile
        </button>
      </div>

      {/* Categorized Assigned Assets Grid */}
      <div className="space-y-6">
        {/* Category: Computers */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">1. Computers & Terminals</h3>
            <button
              onClick={() => openAssignModal(['Laptop', 'Desktop'], 'Computer / Terminal')}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Assign Computer
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Laptop', 'Desktop']).map(renderAssetCard)}
            {categorize(['Laptop', 'Desktop']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No computers assigned.</span>}
          </div>
        </div>

        {/* Category: Display Monitors */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">2. Displays & Monitors</h3>
            <button
              onClick={() => openAssignModal(['Monitor'], 'Display / Monitor')}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Assign Display
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Monitor']).map(renderAssetCard)}
            {categorize(['Monitor']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No display monitors assigned.</span>}
          </div>
        </div>

        {/* Category: Inputs */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">3. Input Accessories</h3>
            <button
              onClick={() => openAssignModal(['Keyboard', 'Mouse'], 'Input Accessory')}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Assign Input
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Keyboard', 'Mouse']).map(renderAssetCard)}
            {categorize(['Keyboard', 'Mouse']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No keyboards or mouse accessories assigned.</span>}
          </div>
        </div>

        {/* Category: Audio/Video & Wireless */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">4. Audio, Network & Mobile Devices</h3>
            <button
              onClick={() => openAssignModal(['Headphone', 'Wi-Fi Adapter', 'Bluetooth Adapter', 'Mobile Phone'], 'Audio / Mobile Device')}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Assign Device
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Headphone', 'Wi-Fi Adapter', 'Bluetooth Adapter', 'Mobile Phone']).map(renderAssetCard)}
            {categorize(['Headphone', 'Wi-Fi Adapter', 'Bluetooth Adapter', 'Mobile Phone']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No audio, wireless cards, or mobile devices assigned.</span>}
          </div>
        </div>

        {/* Category: Power */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">5. Chargers & Power Adapters</h3>
            <button
              onClick={() => openAssignModal(['Laptop Charger', 'Mobile Charger'], 'Charger / Power Adapter')}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Assign Charger
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Laptop Charger', 'Mobile Charger']).map(renderAssetCard)}
            {categorize(['Laptop Charger', 'Mobile Charger']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No chargers assigned.</span>}
          </div>
        </div>

        {/* Category: Printers */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">6. Printers & Shared Scanners</h3>
            <button
              onClick={() => openAssignModal(['Printer'], 'Printer / Scanner')}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Assign Printer
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {categorize(['Printer']).map(renderAssetCard)}
            {categorize(['Printer']).length === 0 && <span className="text-gray-400 text-xs col-span-4">No printers assigned.</span>}
          </div>
        </div>

        {/* Category: Accessories */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">7. Other Accessories & Cable kits</h3>
            <button
              onClick={() => openAssignModal(null, 'Other Accessory', true)}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Assign Accessory
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {otherAccessories.map(renderAssetCard)}
            {otherAccessories.length === 0 && <span className="text-gray-400 text-xs col-span-4">No other accessory kits assigned.</span>}
          </div>
        </div>

        {/* Category: Software Licenses */}
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">8. Software Licenses</h3>
            <button
              onClick={openAssignLicenseModal}
              className="text-indigo-650 hover:text-indigo-800 text-2xs font-extrabold flex items-center gap-1 print:hidden"
            >
              ➕ Allocate License
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {profileLicenses.map((lic) => (
              <div key={lic.id} className="border border-gray-100 rounded-2xl p-4 bg-white shadow-xs space-y-2 text-xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-indigo-900 text-xs">{lic.type}</span>
                    <span className="rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-3xs font-extrabold text-indigo-700">
                      License
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-800">{lic.name}</h4>
                  <p className="text-2xs text-gray-500 leading-normal">
                    {lic.costPerSeat && <><strong>Price / Seat:</strong> {fmtMoney(lic.costPerSeat)} <br /></>}
                    {lic.purchaseDate && <><strong>Purchased:</strong> {fmtDate(lic.purchaseDate)} <br /></>}
                    {lic.expiryDate && <><strong>Expiry Date:</strong> {fmtDate(lic.expiryDate)} <br /></>}
                    {lic.vendor?.name && <><strong>Supplier:</strong> {lic.vendor.name} <br /></>}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-50 flex justify-end print:hidden">
                  <button
                    onClick={() => handleRevokeLicense(lic.id)}
                    className="px-2.5 py-1 bg-red-50 border border-red-100 text-red-700 rounded-lg text-3xs font-extrabold hover:bg-red-100 w-full text-center"
                  >
                    Revoke License
                  </button>
                </div>
              </div>
            ))}
            {profileLicenses.length === 0 && <span className="text-gray-400 text-xs col-span-4">No software licenses assigned.</span>}
          </div>
        </div>

        {/* Assignment History Logs */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">9. Historical Operations Log</h3>
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

      {/* EDIT USER PROFILE MODAL */}
      <Modal open={editProfileModal} title="Edit Employee Profile" onClose={() => setEditProfileModal(false)}>
        {profileError && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{profileError}</div>}
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Employee Full Name" required>
              <input className="input" required placeholder="e.g. Chirag Gohil" value={profileForm.employeeName} onChange={(e) => setProfileForm({ ...profileForm, employeeName: e.target.value })} />
            </Field>
            <Field label="Employee ID" required>
              <input className="input" required placeholder="e.g. EMP-001" value={profileForm.employeeId} onChange={(e) => setProfileForm({ ...profileForm, employeeId: e.target.value })} />
            </Field>
            <Field label="Email Address" required>
              <input className="input" type="email" required placeholder="name@company.com" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
            </Field>
            <Field label="Department" required>
              <input className="input" required placeholder="e.g. IT, Account, HR" value={profileForm.department} onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })} />
            </Field>
            <Field label="Job Designation" required>
              <input className="input" required placeholder="e.g. Senior Executive" value={profileForm.designation} onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })} />
            </Field>
            <Field label="Corporate Company" required>
              <input className="input" required placeholder="e.g. Nationwide Paper" value={profileForm.companyName} onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })} />
            </Field>
            <Field label="Office Location Site" required>
              <input className="input" required placeholder="e.g. Head Office, Warehouse 1" value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} />
            </Field>
            <Field label="Mobile Number">
              <input className="input" placeholder="e.g. +91 98765 43210" value={profileForm.mobileNumber} onChange={(e) => setProfileForm({ ...profileForm, mobileNumber: e.target.value })} />
            </Field>
            <Field label="Employment Status" required>
              <select className="input" value={profileForm.employmentStatus} onChange={(e) => setProfileForm({ ...profileForm, employmentStatus: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setEditProfileModal(false)}>Cancel</button>
            <button className="btn-primary">Save Profile</button>
          </div>
        </form>
      </Modal>

      {/* Assign Asset Modal */}
      <Modal open={assignModal} title={assignModalTitle} onClose={() => setAssignModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{error}</div>}
        <div className="space-y-4">
          <Field label="Select Hardware Asset" required>
            <Select
              value={selectedAssignAssetId}
              onChange={setSelectedAssignAssetId}
              placeholder="-- Choose Available Asset --"
              options={availableAssets.map((a) => ({
                value: a.id,
                label: `${a.manufacturer} ${a.model} (${a.assetTag}) - SN: ${a.serialNumber}`
              }))}
              required
            />
          </Field>

          <Field label="Assignment Notes">
            <textarea
              className="input text-xs"
              rows={2}
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="Add any specific notes for this assignment..."
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setAssignModal(false)} disabled={busy}>
              Cancel
            </button>
            <button onClick={handleAssignAssetDirect} className="btn-primary" disabled={busy}>
              {busy ? 'Processing…' : 'Assign Asset'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign License Modal */}
      <Modal open={assignLicenseModal} title={`Allocate Software License to ${profile.employeeName}`} onClose={() => setAssignLicenseModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{error}</div>}
        <form onSubmit={handleAssignLicenseSubmit} className="space-y-4">
          <Field label="Select Software License" required>
            <Select
              value={selectedLicenseId}
              onChange={setSelectedLicenseId}
              placeholder="-- Choose Software License --"
              options={availableLicenses.map((lic) => {
                const remaining = lic.totalSeats - (lic.activeSeatsUsed || 0);
                return {
                  value: lic.id,
                  label: `${lic.name} (${lic.type}) — ${remaining} seats left of ${lic.totalSeats}`
                };
              })}
              required
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setAssignLicenseModal(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Processing…' : 'Allocate License'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ACKNOWLEDGEMENT HANDOVER RECEIPT MODAL */}
      <Modal open={ackFormModal} title="📄 Generated Asset Handover Receipt" onClose={() => setAckFormModal(false)} wide>
        <div className="p-4 space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-1" id="printable-ack-form">
          {/* Document Header */}
          <div className="text-center space-y-1 pb-4 border-b border-gray-200">
            <h2 className="text-sm font-black text-slate-800 tracking-wider uppercase">Nationwide Paper Ltd</h2>
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">IT Asset Handover Receipt & Acknowledgement</h3>
            <p className="text-3xs text-gray-400">ISO-27001 IT Security Compliance Document</p>
          </div>

          {/* Metadata Block */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1">
              <div><strong className="text-gray-500 uppercase tracking-wider text-3xs">Employee Name:</strong> <span className="font-semibold text-slate-800">{profile.employeeName}</span></div>
              <div><strong className="text-gray-500 uppercase tracking-wider text-3xs">Employee Code:</strong> <span className="font-semibold text-slate-800">{profile.employeeId}</span></div>
              <div><strong className="text-gray-500 uppercase tracking-wider text-3xs">Designation:</strong> <span className="font-semibold text-slate-800">{profile.designation || 'IT Executive'}</span></div>
            </div>
            <div className="space-y-1">
              <div><strong className="text-gray-500 uppercase tracking-wider text-3xs">Department:</strong> <span className="font-semibold text-slate-800">{profile.department}</span></div>
              <div><strong className="text-gray-500 uppercase tracking-wider text-3xs">Primary Location:</strong> <span className="font-semibold text-slate-800">{profile.location}</span></div>
              <div><strong className="text-gray-500 uppercase tracking-wider text-3xs">Generated Date:</strong> <span className="font-semibold text-slate-800">{new Date().toLocaleDateString('en-GB')}</span></div>
            </div>
          </div>

          {/* Hardware List Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-700 uppercase tracking-wider text-3xs">Provisioned Hardware Inventory</h4>
            <div className="border border-gray-150 rounded-xl overflow-hidden">
              <table className="w-full text-left text-3xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider">
                    <th className="px-4 py-2">Asset Tag</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Manufacturer / Model</th>
                    <th className="px-4 py-2">Serial Number</th>
                    <th className="px-4 py-2">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {assignedAssets.map((a) => (
                    <tr key={a.assetId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-bold text-indigo-700">{a.assetId}</td>
                      <td className="px-4 py-2 font-semibold">{a.category}</td>
                      <td className="px-4 py-2">{a.manufacturer} {a.model}</td>
                      <td className="px-4 py-2 font-mono">{a.serialNumber}</td>
                      <td className="px-4 py-2">{a.location || 'Head Office'}</td>
                    </tr>
                  ))}
                  {assignedAssets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">
                        No active hardware assets currently provisioned to this employee.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acknowledgement Statement / Terms */}
          <div className="space-y-1.5 p-4 bg-indigo-50/20 border border-indigo-100/50 rounded-xl text-3xs leading-relaxed text-gray-650">
            <h5 className="font-extrabold text-slate-800 uppercase tracking-wider">Declaration of Handover</h5>
            <p>
              I hereby acknowledge the receipt of the IT hardware assets listed above in good working condition. 
              I agree to abide by Nationwide Paper Ltd's IT Policy and security compliance rules. 
              I take full responsibility for the safety, protection, and professional use of these devices. 
              Upon termination of employment or when requested by the IT department, I agree to return all assets in clean and operational state.
            </p>
          </div>

          {/* Signature blocks */}
          <div className="grid grid-cols-2 gap-8 pt-8 pb-4">
            <div className="space-y-12">
              <div className="border-t border-gray-300 pt-2 text-center text-3xs font-extrabold text-gray-400 uppercase tracking-wider">
                Authorized IT Representative
              </div>
            </div>
            <div className="space-y-12">
              <div className="border-t border-gray-300 pt-2 text-center text-3xs font-extrabold text-gray-400 uppercase tracking-wider">
                Employee Signature
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 border-t border-gray-150 pt-4 mt-6 print:hidden">
            <button type="button" className="btn-secondary" onClick={() => setAckFormModal(false)}>Close</button>
            <button 
              type="button" 
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all active:scale-95"
              onClick={() => {
                const style = document.createElement('style');
                style.innerHTML = `
                  @media print {
                    body * { visibility: hidden; }
                    #printable-ack-form, #printable-ack-form * { visibility: visible; }
                    #printable-ack-form { position: absolute; left: 0; top: 0; width: 100%; }
                  }
                `;
                document.head.appendChild(style);
                window.print();
                style.remove();
              }}
            >
              🖨️ Print Receipt
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
