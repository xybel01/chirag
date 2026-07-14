import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiError } from '../api/client';
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

  // Selected Assets state
  const [selectedAssets, setSelectedAssets] = useState({
    mainComputer: '',
    displays: [],
    inputs: '',
    audioVideo: '',
    network: '',
    mobile: '',
    chargers: [],
    printers: '',
  });

  // UI state
  const [confirmModal, setConfirmModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Signature Canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const loadData = async () => {
    try {
      const usersRes = await api.get('/users', { params: { pageSize: 500 } });
      setUsers(usersRes.data.items || []);

      const assetsRes = await api.get('/assets', { params: { status: 'AVAILABLE', pageSize: 1000 } });
      setAssets(assetsRes.data.items || []);

      if (initialUserId) {
        const matched = usersRes.data.items?.find((u) => String(u.id) === String(initialUserId));
        setSelectedUser(matched || null);
      }
    } catch (err) {
      console.error('Failed to load assignment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initialUserId]);

  const handleUserChange = (userId) => {
    setSelectedUserId(userId);
    const matched = users.find((u) => String(u.id) === String(userId));
    setSelectedUser(matched || null);
    setError('');
  };

  const getAvailableAssets = (categoryNames) => {
    return assets.filter((a) => categoryNames.includes(a.category?.name));
  };

  const toggleAssetSelect = (sectionKey, assetId, isMultiple = false) => {
    setSelectedAssets((prev) => {
      if (isMultiple) {
        const currentList = prev[sectionKey] || [];
        const index = currentList.indexOf(assetId);
        if (index > -1) {
          return { ...prev, [sectionKey]: currentList.filter((id) => id !== assetId) };
        } else {
          return { ...prev, [sectionKey]: [...currentList, assetId] };
        }
      } else {
        return { ...prev, [sectionKey]: prev[sectionKey] === assetId ? '' : assetId };
      }
    });
  };

  const getSelectedAssetIdsList = () => {
    const list = [];
    Object.entries(selectedAssets).forEach(([_, val]) => {
      if (Array.isArray(val)) {
        list.push(...val);
      } else if (val) {
        list.push(val);
      }
    });
    return list;
  };

  const validateForm = () => {
    if (!selectedUserId) {
      setError('Please select an employee first.');
      return false;
    }
    const selectedIds = getSelectedAssetIdsList();
    if (selectedIds.length === 0) {
      setError('Please select at least one hardware asset to assign.');
      return false;
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

  // Canvas Drawing Methods
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const executeAssignment = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const selectedIds = getSelectedAssetIdsList();
      let signatureDataUrl = '';
      if (hasSignature && canvasRef.current) {
        signatureDataUrl = canvasRef.current.toDataURL();
      }

      // Assign all selected assets sequentially
      await Promise.all(
        selectedIds.map((id) =>
          api.post('/assignments', {
            assetId: Number(id),
            userId: Number(selectedUserId),
            action: 'ASSIGN',
            notes: notes || 'Batch User-Wise Asset Handover Assignment Form',
            signature: signatureDataUrl || undefined,
          })
        )
      );

      setSuccess('Asset assignment registered successfully! Handover receipt generated.');
      setTimeout(() => {
        setConfirmModal(false);
        navigate('/user-profiles');
      }, 2000);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Set up canvas context styling on modal open
  useEffect(() => {
    if (confirmModal && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1e1b4b'; // dark navy signature ink
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
    }
  }, [confirmModal]);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading Assignment Wizard…</div>;

  const selectedIds = getSelectedAssetIdsList();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-xs">
      <PageHeader
        title="User-Wise Asset Assignment"
        subtitle="Provision computers, monitors, accessories, and network items to an employee in a single transaction flow"
      />

      {error && <div className="rounded-2xl bg-red-50 border border-red-150 px-4 py-3 text-red-700 font-semibold">{error}</div>}

      <form onSubmit={handlePreAssign} className="space-y-6">
        
        {/* Section 1: User Details */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
            <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center">1</span>
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Select Employee Recipient</h3>
          </div>
          
          <div className="max-w-md">
            <Field label="Choose Employee" required>
              <Select
                value={selectedUserId}
                onChange={handleUserChange}
                placeholder="-- Select User --"
                options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                required
              />
            </Field>
          </div>

          {selectedUser && (
            <div className="grid gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl md:grid-cols-3 text-2xs leading-relaxed font-bold text-gray-700">
              <div>
                <span className="text-gray-400 uppercase text-3xs font-extrabold block">Full Name</span>
                <span className="text-gray-800">{selectedUser.name}</span>
              </div>
              <div>
                <span className="text-gray-400 uppercase text-3xs font-extrabold block">Email Address</span>
                <span className="text-gray-800">{selectedUser.email}</span>
              </div>
              <div>
                <span className="text-gray-400 uppercase text-3xs font-extrabold block">Job Title</span>
                <span className="text-gray-800">{selectedUser.jobTitle || '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Laptop/Desktop */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
            <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center">2</span>
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Primary Laptop or Desktop</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {getAvailableAssets(['Laptop', 'Desktop', 'Workstation', 'Mini PC']).map((a) => (
              <div
                key={a.id}
                onClick={() => toggleAssetSelect('mainComputer', a.id)}
                className={`p-4 border rounded-2xl cursor-pointer hover:border-brand-400 hover:shadow-md transition-all flex justify-between items-start ${
                  selectedAssets.mainComputer === a.id ? 'border-brand-600 bg-brand-50/10 ring-1 ring-brand-600' : 'border-gray-150 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <span className="font-extrabold text-gray-800">{a.manufacturer} {a.model}</span>
                    <span className="px-1.5 py-0.5 rounded text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700">{a.assetTag}</span>
                  </div>
                  <p className="text-3xs text-gray-400">SN: {a.serialNumber}</p>
                  <div className="flex gap-2 flex-wrap pt-2">
                    {a.ram && <span className="px-1.5 py-0.5 rounded text-3xs bg-slate-100 text-slate-600 font-bold">{a.ram} RAM</span>}
                    {a.storage && <span className="px-1.5 py-0.5 rounded text-3xs bg-slate-100 text-slate-600 font-bold">{a.storage} Disk</span>}
                    {a.cpu && <span className="px-1.5 py-0.5 rounded text-3xs bg-slate-100 text-slate-600 font-bold">{a.cpu} CPU</span>}
                  </div>
                </div>
                <input
                  type="radio"
                  checked={selectedAssets.mainComputer === a.id}
                  onChange={() => {}}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 mt-1 cursor-pointer"
                />
              </div>
            ))}
            {getAvailableAssets(['Laptop', 'Desktop', 'Workstation', 'Mini PC']).length === 0 && (
              <div className="col-span-2 text-gray-400 italic py-2">No available laptops or desktop machines found in stock.</div>
            )}
          </div>
        </div>

        {/* Section 3: Monitors */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
            <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center">3</span>
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Display Monitors (Select Multiple)</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {getAvailableAssets(['Monitor']).map((a) => (
              <div
                key={a.id}
                onClick={() => toggleAssetSelect('displays', a.id, true)}
                className={`p-4 border rounded-2xl cursor-pointer hover:border-brand-400 hover:shadow-md transition-all flex justify-between items-start ${
                  selectedAssets.displays.includes(a.id) ? 'border-brand-600 bg-brand-50/10 ring-1 ring-brand-600' : 'border-gray-150 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <span className="font-extrabold text-gray-800">{a.manufacturer} {a.model}</span>
                    <span className="px-1.5 py-0.5 rounded text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700">{a.assetTag}</span>
                  </div>
                  <p className="text-3xs text-gray-400">SN: {a.serialNumber}</p>
                  <p className="text-3xs text-gray-500 font-semibold">{a.screenSize || 'No screen size specified'} • {a.connectionType || 'No connection spec'}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedAssets.displays.includes(a.id)}
                  onChange={() => {}}
                  className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500 mt-1 cursor-pointer"
                />
              </div>
            ))}
            {getAvailableAssets(['Monitor']).length === 0 && (
              <div className="col-span-2 text-gray-400 italic py-2">No available monitors found in stock.</div>
            )}
          </div>
        </div>

        {/* Section 4: Keyboards and Mice */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
            <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center">4</span>
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Keyboard and Mouse</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {getAvailableAssets(['Keyboard', 'Mouse']).map((a) => (
              <div
                key={a.id}
                onClick={() => toggleAssetSelect('inputs', a.id)}
                className={`p-4 border rounded-2xl cursor-pointer hover:border-brand-400 hover:shadow-md transition-all flex justify-between items-start ${
                  selectedAssets.inputs === a.id ? 'border-brand-600 bg-brand-50/10 ring-1 ring-brand-600' : 'border-gray-150 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <span className="font-extrabold text-gray-800">{a.category?.name}: {a.manufacturer} {a.model}</span>
                    <span className="px-1.5 py-0.5 rounded text-3xs font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-700">{a.assetTag}</span>
                  </div>
                  <p className="text-3xs text-gray-400">SN: {a.serialNumber} • Condition: {a.condition || 'Good'}</p>
                </div>
                <input
                  type="radio"
                  checked={selectedAssets.inputs === a.id}
                  onChange={() => {}}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 mt-1 cursor-pointer"
                />
              </div>
            ))}
            {getAvailableAssets(['Keyboard', 'Mouse']).length === 0 && (
              <div className="col-span-2 text-gray-400 italic py-2">No keyboards or mice available in stock.</div>
            )}
          </div>
        </div>

        {/* Section 5: Remarks */}
        <div className="card p-5 bg-white border border-gray-150">
          <Field label="Assignment Handover Notes">
            <textarea
              className="input text-xs"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Assigned Dell desktop and monitor setup to new developer joiner onboarding kit."
            />
          </Field>
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/user-profiles')}>Cancel</button>
          <button className="btn-primary px-6">Assign All Assets</button>
        </div>
      </form>

      {/* CONFIRMATION & DIGITAL SIGNATURE MODAL */}
      <Modal open={confirmModal} title="Authorized Asset Assignment" onClose={() => setConfirmModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 font-semibold">{error}</div>}
        {success && <div className="mb-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700 font-semibold">{success}</div>}

        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-3xs uppercase font-extrabold text-gray-400">Assignee Employee</span>
            <h4 className="font-extrabold text-gray-800 mt-1">{selectedUser?.name}</h4>
            <p className="text-3xs text-gray-400 mt-0.5">{selectedUser?.email}</p>
          </div>

          <div className="space-y-1">
            <span className="text-3xs uppercase font-extrabold text-gray-400 block">Selected Items ({selectedIds.length})</span>
            <div className="max-h-36 overflow-y-auto border border-gray-100 rounded-xl bg-white divide-y divide-gray-100">
              {selectedIds.map((id) => {
                const a = assets.find((item) => String(item.id) === String(id));
                return (
                  <div key={id} className="p-2 flex justify-between items-center text-3xs font-bold text-gray-700">
                    <span>{a?.manufacturer} {a?.model} ({a?.category?.name})</span>
                    <span className="text-indigo-700">{a?.assetTag}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas Signature Pad */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-3xs uppercase font-extrabold text-gray-400">Receiver Handover Signature</span>
              <button type="button" onClick={clearCanvas} className="text-indigo-650 hover:underline text-3xs font-extrabold">
                Clear Pad
              </button>
            </div>
            <div className="border border-slate-200 bg-slate-50 rounded-2xl overflow-hidden flex justify-center">
              <canvas
                ref={canvasRef}
                width={360}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="cursor-crosshair bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setConfirmModal(false)} disabled={busy}>Go Back</button>
            <button onClick={executeAssignment} className="btn-primary px-5" disabled={busy || !hasSignature}>
              {busy ? 'Processing Handover…' : 'Sign & Complete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
