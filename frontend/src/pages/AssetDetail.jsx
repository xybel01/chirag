import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { apiError, fileUrl, authedImg } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SignaturePad from '../components/SignaturePad.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate, fmtMoney } from '../utils/format.js';

const ACTIONS = ['ASSIGN', 'RETURN', 'TRANSFER', 'REPLACE', 'REPAIR', 'DISPOSE'];

export default function AssetDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ action: 'ASSIGN', userId: '', notes: '', signature: null });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Preventive Maintenance modal state
  const [pmModal, setPmModal] = useState(false);
  const [pmForm, setPmForm] = useState({ maintenanceDate: '', notes: '', performedBy: '', cost: '', nextDueDate: '', status: 'COMPLETED' });

  const load = useCallback(() => {
    api.get(`/assets/${id}`)
      .then((r) => setAsset(r.data))
      .catch((err) => console.error('Failed to load asset:', err));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (can(user, 'manageInventory')) {
      api.get('/users', { params: { pageSize: 100 } })
        .then((r) => setUsers(r.data.items))
        .catch(() => {});
    }
  }, [user]);

  if (!asset) return <div className="text-gray-500 text-center py-12">Loading Configuration details…</div>;

  const openAction = (action) => {
    setForm({ action, userId: '', notes: '', signature: null });
    setError('');
    setModal(true);
  };
  const needsUser = !['RETURN', 'DISPOSE'].includes(form.action);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/assignments', {
        assetId: asset.id,
        action: form.action,
        userId: form.userId ? Number(form.userId) : undefined,
        notes: form.notes,
        signature: form.signature || undefined
      });
      setModal(false);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePMSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/maintenance', {
        assetId: asset.id,
        ...pmForm
      });
      setPmModal(false);
      setPmForm({ maintenanceDate: '', notes: '', performedBy: '', cost: '', nextDueDate: '', status: 'COMPLETED' });
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Build info array dynamically
  const info = [
    ['Category', asset.category?.name || '—'],
    ['Manufacturer', asset.manufacturer || '—'],
    ['Model', asset.model || '—'],
    ['Serial Number', asset.serialNumber || '—'],
    ['Condition', asset.condition || '—'],
    ['Office Floor', asset.floor || '—'],
    ['Cabin / Room No.', asset.cabin || '—'],
    ['Server Rack No.', asset.rackNumber || '—'],
    ['Cost Centre Code', asset.costCentre || '—'],
    ['Owner Department', asset.ownerDepartment || '—'],
  ];

  // Desktop / Laptop specs
  if (asset.category && ['LAP', 'DSK', 'WKS', 'MPC'].includes(asset.category.code)) {
    info.push(
      ['Processor Brand/Model', asset.cpu || '—'],
      ['RAM Memory Configuration', asset.ram || '—'],
      ['Storage Drive Units', asset.storage || '—'],
      ['GPU graphics card', asset.gpu || '—'],
      ['Windows Edition', asset.windowsEdition || '—'],
      ['OS Version/Build', `${asset.windowsVersion || '—'} (Build ${asset.buildNumber || '—'})`],
      ['BitLocker Recovery Key', asset.recoveryKey || '—'],
      ['TPM Version', asset.tpmVersion || '—'],
      ['Domain Connection', asset.domainName || '—'],
      ['WiFi MAC Address', asset.wifiMac || '—']
    );
  }

  // Printers specs
  if (asset.category && ['PRN'].includes(asset.category.code)) {
    info.push(
      ['Drum Replacement Model', asset.drumModel || '—'],
      ['Current Print Page Count', asset.currentPageCount !== null ? asset.currentPageCount : '—']
    );
  }

  // Mobiles specs
  if (asset.category && ['MOB', 'TAB'].includes(asset.category.code)) {
    info.push(
      ['SIM Provider Carrier', asset.carrier || '—'],
      ['MDM Registration Status', asset.mdmStatus || '—'],
      ['Secondary IMEI 2', asset.imeiNumber2 || '—']
    );
  }

  // Network specs
  if (asset.category && ['SWT', 'RTR', 'FWL', 'WAP'].includes(asset.category.code)) {
    info.push(
      ['Public WAN IP', asset.wanIp || '—'],
      ['Interface Ports count', asset.portsCount || '—'],
      ['ISP Link Service Provider', asset.ispName || '—'],
      ['Firmware Release Version', asset.firmwareVersion || '—']
    );
  }

  // Cost and Warranty info
  info.push(
    ['Supplier / Vendor', asset.vendor?.name || '—'],
    ['Purchase Date', fmtDate(asset.purchaseDate)],
    ['Purchase Cost (GST Input)', `${fmtMoney(asset.purchasePrice)} (GST: ${asset.gst ? fmtMoney(asset.gst) : '—'})`],
    ['Warranty Timeline', `${fmtDate(asset.warrantyStart)} to ${fmtDate(asset.warrantyEnd)}`],
    ['Upcoming Maintenance Date', fmtDate(asset.nextMaintenance)],
    ['Last PM Check Date', fmtDate(asset.lastMaintenance)],
    ['Scrap / Retirement Date', fmtDate(asset.scrapDate)],
    ['Disposal Method', asset.disposalMethod || '—']
  );

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title={asset.assetTag}
        subtitle={`${asset.manufacturer} ${asset.model}`}
        actions={can(user, 'manageInventory') && (
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <button key={a} className="btn-secondary" onClick={() => openAction(a)}>
                {a.charAt(0) + a.slice(1).toLowerCase()}
              </button>
            ))}
            <button className="btn-primary" onClick={() => { setError(''); setPmModal(true); }}>
              🛠️ Log PM Check
            </button>
          </div>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* SPECIFICATIONS AND LIFE CYCLE */}
        <div className="card p-5 lg:col-span-2 bg-white border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-2">
            <StatusBadge status={asset.status} />
            <span className="font-extrabold text-gray-800 text-xs">CMDB Configuration Specifications</span>
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 md:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-50 pb-1.5">
                <dt className="text-gray-400 font-semibold">{k}</dt>
                <dd className="font-extrabold text-gray-800 text-right select-all">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-4 text-xs font-bold pt-2 border-t border-gray-50">
            {asset.invoiceFile && <a className="text-brand-600 underline" href={fileUrl(asset.invoiceFile)} target="_blank" rel="noreferrer">Invoice PDF File</a>}
            {asset.warrantyFile && <a className="text-brand-600 underline" href={fileUrl(asset.warrantyFile)} target="_blank" rel="noreferrer">Warranty Cover document</a>}
          </div>
        </div>

        {/* LABELS AND CODES PRINTING */}
        <div className="card p-5 text-center bg-white border border-gray-100 flex flex-col justify-between items-center">
          <div className="w-full space-y-4">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-50 pb-2">Hardware Asset Labels</h3>
            <img src={authedImg(`/api/assets/${asset.id}/qrcode`)} alt="QR code" className="mx-auto h-36 w-36 border p-2 rounded-xl"
              onError={(e) => { e.target.style.display = 'none'; }} />
            <img src={authedImg(`/api/assets/${asset.id}/barcode`)} alt="Barcode" className="mx-auto mt-3 max-w-full"
              onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div className="w-full pt-6">
            <button className="btn-secondary w-full" onClick={() => window.print()}>🖨️ Print Label Sticker</button>
            <p className="mt-2 text-3xs text-gray-400 leading-normal">QR code contains REST endpoint URL; barcode represents Tag string in Code128 format.</p>
          </div>
        </div>
      </div>

      {/* PREVENTATIVE MAINTENANCE LOGS HISTORY */}
      <div className="card p-5 bg-white border border-gray-100 mt-6">
        <h3 className="font-extrabold text-gray-800 text-xs mb-3">🛠️ Preventive Maintenance Log ({asset.maintenances?.length || 0} checks)</h3>
        <table className="w-full text-xs">
          <thead className="text-left text-gray-400 font-bold border-b border-gray-100">
            <tr>
              <th className="py-2">PM Date</th>
              <th>Status</th>
              <th>Performed By</th>
              <th>Checkup Notes / Actions Done</th>
              <th>Diagnostics Cost</th>
              <th>Next Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {asset.maintenances?.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/50">
                <td className="py-2.5 font-bold">{fmtDate(m.maintenanceDate)}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-3xs font-extrabold border ${m.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-700'}`}>
                    {m.status}
                  </span>
                </td>
                <td className="font-semibold text-gray-700">{m.performedBy || '—'}</td>
                <td className="text-gray-500 font-medium max-w-xs truncate" title={m.notes}>{m.notes || '—'}</td>
                <td className="font-bold text-gray-800">{fmtMoney(m.cost)}</td>
                <td className="font-semibold text-indigo-700">{fmtDate(m.nextDueDate)}</td>
              </tr>
            ))}
            {(!asset.maintenances || asset.maintenances.length === 0) && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">No preventive maintenance checks logged.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ASSIGNMENT LIFE TRANSACTIONS HISTORY */}
      <div className="card p-5 bg-white border border-gray-100 mt-6">
        <h3 className="font-extrabold text-gray-800 text-xs mb-3">👤 Assignment Life-cycle Log</h3>
        <table className="w-full text-xs">
          <thead className="text-left text-gray-400 font-bold border-b border-gray-100">
            <tr>
              <th className="py-2">Tx Date</th>
              <th>Action Status</th>
              <th>Employee Requester</th>
              <th>Authorized Officer</th>
              <th>Remarks / Audit Notes</th>
              <th>Handover Form</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {asset.assignments.map((h) => (
              <tr key={h.id} className="hover:bg-slate-50/50">
                <td className="py-2.5 font-bold">{fmtDate(h.createdAt)}</td>
                <td><StatusBadge status={h.action} /></td>
                <td className="font-bold text-gray-800">{h.user?.name}</td>
                <td className="font-semibold text-gray-700">{h.performedBy?.name}</td>
                <td className="text-gray-500 font-medium">{h.notes || '—'}</td>
                <td>{h.ackFile ? <a className="text-indigo-600 font-bold hover:underline" href={fileUrl(h.ackFile)} target="_blank" rel="noreferrer">Download PDF</a> : '—'}</td>
              </tr>
            ))}
            {asset.assignments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">No ownership assignments logged.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* TICKET WIZARD LIFE ACTION DIALOG */}
      <Modal open={!!modal} title={`${form.action} Asset Transaction — ${asset.assetTag}`} onClose={() => setModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4 text-xs">
          <Field label="Action type">
            <Select value={form.action} onChange={(v) => setForm((f) => ({ ...f, action: v }))} placeholder=""
              options={ACTIONS.map((a) => ({ value: a, label: a }))} />
          </Field>
          {needsUser && (
            <Field label="Assigned Employee" required>
              <Select value={form.userId} onChange={(v) => setForm((f) => ({ ...f, userId: v }))}
                options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))} required />
            </Field>
          )}
          <Field label="Audit remarks / Handover notes">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
          {form.action === 'ASSIGN' && (
            <>
              <Field label="Requester Handover Signature" required>
                <SignaturePad onChange={(sig) => setForm((f) => ({ ...f, signature: sig }))} />
              </Field>
              <p className="text-3xs text-gray-400 leading-normal">Digitally signing generates an automated PDF handover receipt matching ISO-27001 IT compliance checklist.</p>
            </>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Execute Tx'}</button>
          </div>
        </form>
      </Modal>

      {/* PREVENTIVE MAINTENANCE LOG MODAL */}
      <Modal open={pmModal} title={`Log Preventative Maintenance Check`} onClose={() => setPmModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={handlePMSubmit} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Checkup / Repair Date" required>
              <input className="input" type="date" required value={pmForm.maintenanceDate} onChange={(e) => setPmForm({ ...pmForm, maintenanceDate: e.target.value })} />
            </Field>
            <Field label="Technician Name / Vendor" required>
              <input className="input" placeholder="e.g. IT Engineer" required value={pmForm.performedBy} onChange={(e) => setPmForm({ ...pmForm, performedBy: e.target.value })} />
            </Field>
            <Field label="Next Checkup Due Date" required>
              <input className="input" type="date" required value={pmForm.nextDueDate} onChange={(e) => setPmForm({ ...pmForm, nextDueDate: e.target.value })} />
            </Field>
            <Field label="Checkup Cost" required>
              <input className="input" type="number" placeholder="0.00" required value={pmForm.cost} onChange={(e) => setPmForm({ ...pmForm, cost: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Diagnostic Notes & Actions Done" required>
                <textarea rows={3} className="input" placeholder="e.g. Applied thermal paste, reinstalled Windows 11..." required value={pmForm.notes} onChange={(e) => setPmForm({ ...pmForm, notes: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-50 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setPmModal(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Add Log'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
