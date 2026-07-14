import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate, fmtMoney } from '../utils/format.js';

export default function ServicePortal() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'tickets' | 'approvals' | 'assets'
  const [tickets, setTickets] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [assets, setAssets] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // Modal forms
  const [formOpen, setFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Approval step action modal
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [activeStepId, setActiveStepId] = useState(null);
  const [actionComments, setActionComments] = useState('');
  const [approvalAction, setApprovalAction] = useState('APPROVED'); // APPROVED | REJECTED

  // Add category state
  const [addCatModalOpen, setAddCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');

  const CATALOG_ITEMS = [
    { id: 'incident', title: '💥 Report an Incident', desc: 'Report any hardware breakage, software crash, or general IT service disruption.', type: 'INCIDENT' },
    { id: 'hardware', title: '💻 Request New Hardware', desc: 'Request laptops, desktops, dual monitors, mobile phones, or desktop accessories.', type: 'SERVICE_REQUEST' },
    { id: 'software', title: '💿 Request Software Install', desc: 'Request local installation of Adobe Suite, development tools, or internal software.', type: 'SERVICE_REQUEST' },
    { id: 'm365', title: '📧 Request M365 / Email Access', desc: 'Request Microsoft 365 licensing, shared mailbox access, or distribution list memberships.', type: 'SERVICE_REQUEST' },
    { id: 'vpn', title: '🔌 Request VPN / Network Access', desc: 'Request FortiClient VPN accounts, Wi-Fi access tokens, or firewall port mapping.', type: 'SERVICE_REQUEST' },
    { id: 'onboarding', title: '➕ Request User Onboarding', desc: 'Pre-schedule joining steps, assets, and licensing bundles for a new employee.', type: 'SERVICE_REQUEST' },
    { id: 'offboarding', title: '❌ Request User Offboarding', desc: 'Schedule last-day session revocation, asset collection, and email conversions.', type: 'SERVICE_REQUEST' },
  ];

  const loadData = async () => {
    try {
      const tickRes = await api.get('/tickets', { params: { pageSize: 100 } });
      setTickets(tickRes.data.items);
    } catch (e) { console.error('Error fetching tickets:', e); }

    try {
      const appRes = await api.get('/approvals');
      setApprovals(appRes.data);
    } catch (e) { console.error('Error fetching approvals:', e); }

    try {
      const assetRes = await api.get('/assets', { params: { assignedToId: user.id } });
      setAssets(assetRes.data.items);
    } catch (e) { console.error('Error fetching assets:', e); }

    try {
      const catRes = await api.get('/meta/categories');
      setCategories(catRes.data);
    } catch (e) { console.error('Error fetching categories:', e); }

    try {
      if (['SUPER_ADMIN', 'IT_MANAGER', 'IT_SUPPORT', 'HR'].includes(user.role)) {
        const usersRes = await api.get('/users', { params: { pageSize: 100 } });
        setUsers(usersRes.data.items);
      }
    } catch (e) { console.error('Error fetching users directory:', e); }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openForm = (item) => {
    setSelectedItem(item);
    setError('');
    setSuccess('');
    
    // Initialize form defaults
    setForm({
      type: item.type,
      summary: `${item.title.replace(/[^a-zA-Z0-9\s]/g, '').trim()} Request`,
      description: '',
      priority: 'MEDIUM',
      categoryId: categories[0]?.id || '',
      customFields: {},
      // Onboarding fields
      employeeName: '',
      personalEmail: '',
      jobTitle: '',
      reportingManager: '',
      joiningDate: '',
      officeLocation: 'Head Office',
      assetsNeeded: [],
      // Offboarding fields
      offboardingUserId: '',
      lastWorkingDate: '',
      disableAccount: true,
      returnAssets: true,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (selectedItem.id === 'onboarding') {
        // Run Onboarding Workflow
        await api.post('/workflow/onboarding', {
          employeeName: form.employeeName,
          personalEmail: form.personalEmail,
          jobTitle: form.jobTitle,
          departmentId: user.departmentId || 1,
          reportingManager: form.reportingManager,
          joiningDate: form.joiningDate,
          officeLocation: form.officeLocation,
          assetsNeeded: form.assetsNeeded,
        });
      } else if (selectedItem.id === 'offboarding') {
        // Run Offboarding Workflow
        await api.post('/workflow/offboarding', {
          userId: Number(form.offboardingUserId),
          lastWorkingDate: form.lastWorkingDate,
          disableAccount: form.disableAccount,
          returnAssets: form.returnAssets,
        });
      } else {
        // Create standard support ticket
        await api.post('/tickets', {
          type: form.type,
          summary: form.summary,
          description: form.description,
          priority: form.priority,
          categoryId: form.categoryId ? Number(form.categoryId) : undefined,
          customFields: form.customFields,
        });
      }

      setSuccess('Request successfully submitted and registered!');
      setTimeout(() => {
        setFormOpen(false);
        loadData();
      }, 1500);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCategories = () => {
    if (!selectedItem) return categories;
    const isHardwareCat = (c) => {
      const name = c.name.toLowerCase();
      return !name.includes('license') &&
             !name.includes('certificate') &&
             !name.includes('domain') &&
             !name.includes('subscription') &&
             !name.includes('mailbox') &&
             !name.includes('group');
    };
    if (selectedItem.id === 'hardware') {
      return categories.filter(isHardwareCat);
    }
    if (selectedItem.id === 'software') {
      return categories.filter(c => !isHardwareCat(c));
    }
    return categories;
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatCode.trim()) return;
    try {
      const res = await api.post('/meta/categories', {
        name: newCatName,
        code: newCatCode.toUpperCase()
      });
      const catRes = await api.get('/meta/categories');
      setCategories(catRes.data);
      setForm((prev) => ({ ...prev, categoryId: res.data.id }));
      setAddCatModalOpen(false);
      setNewCatName('');
      setNewCatCode('');
    } catch (err) {
      alert('Failed to add category: ' + err.message);
    }
  };

  const handleApprovalAction = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.put(`/approvals/steps/${activeStepId}`, {
        action: approvalAction,
        comments: actionComments
      });
      setActionModalOpen(false);
      loadData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nationwide Service Portal"
        subtitle="Self-service desk for hardware access, credentials, licensing, and IT onboarding"
      />

      {/* Tabs Row */}
      <div className="flex border-b border-gray-150 mb-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'catalog' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          📁 Service Catalogue
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'tickets' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          🎫 My Requests ({tickets.length})
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'approvals' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          ⚖️ Pending Approvals ({approvals.length})
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'assets' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          🖥️ My Assigned Assets ({assets.length})
        </button>
      </div>

      {/* CATALOG TAB */}
      {activeTab === 'catalog' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG_ITEMS.map((item) => (
            <div
              key={item.id}
              onClick={() => openForm(item)}
              className="card p-5 cursor-pointer hover:border-indigo-200 hover:shadow transition bg-white border border-gray-100 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <h4 className="font-extrabold text-gray-800 text-sm">{item.title}</h4>
                <p className="text-2xs text-gray-500 leading-normal">{item.desc}</p>
              </div>
              <span className="text-2xs font-extrabold text-indigo-600 mt-4 flex items-center hover:underline">
                Raise Request →
              </span>
            </div>
          ))}
        </div>
      )}

      {/* TICKETS TAB */}
      {activeTab === 'tickets' && (
        <DataTable
          columns={[
            { header: 'Ticket No', render: (t) => <span className="font-extrabold text-indigo-900">{t.ticketNo}</span> },
            { header: 'Type', render: (t) => <span className="text-3xs uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-100 border text-slate-700">{t.type}</span> },
            { header: 'Summary', key: 'summary' },
            { header: 'Priority', render: (t) => <span className={`font-bold ${t.priority === 'CRITICAL' ? 'text-red-600' : t.priority === 'HIGH' ? 'text-orange-600' : 'text-gray-600'}`}>{t.priority}</span> },
            { header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
            { header: 'Created At', render: (t) => fmtDate(t.createdAt) },
            { header: 'Assigned To', render: (t) => t.assignedTo?.name || '—' }
          ]}
          rows={tickets}
          onRowClick={(t) => navigate(`/tickets/${t.ticketNo}`)}
        />
      )}

      {/* APPROVALS TAB */}
      {activeTab === 'approvals' && (
        <DataTable
          columns={[
            { header: 'Title', key: 'title' },
            { header: 'Ticket No', render: (a) => <span className="font-bold text-indigo-900">{a.ticket?.ticketNo}</span> },
            { header: 'Requester', render: (a) => a.ticket?.requester?.name || '—' },
            { header: 'Requested At', render: (a) => fmtDate(a.createdAt) },
            {
              header: 'Actions',
              render: (a) => {
                const pendingStep = a.steps.find((s) => s.approverId === user.id && s.status === 'PENDING');
                if (!pendingStep) return <span className="text-gray-400 text-2xs">Reviewed</span>;
                return (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setActiveStepId(pendingStep.id);
                        setApprovalAction('APPROVED');
                        setActionComments('');
                        setActionModalOpen(true);
                      }}
                      className="px-2 py-1 text-2xs font-extrabold bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-100"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setActiveStepId(pendingStep.id);
                        setApprovalAction('REJECTED');
                        setActionComments('');
                        setActionModalOpen(true);
                      }}
                      className="px-2 py-1 text-2xs font-extrabold bg-red-50 border border-red-100 text-red-700 rounded-lg hover:bg-red-100"
                    >
                      Reject
                    </button>
                  </div>
                );
              }
            }
          ]}
          rows={approvals}
        />
      )}

      {/* ASSIGNED ASSETS TAB */}
      {activeTab === 'assets' && (
        <DataTable
          columns={[
            { header: 'Asset ID', render: (a) => <span className="font-extrabold text-indigo-900">{a.assetTag}</span> },
            { header: 'Category', render: (a) => a.category?.name || '—' },
            { header: 'Manufacturer', key: 'manufacturer' },
            { header: 'Model', key: 'model' },
            { header: 'Serial No', key: 'serialNumber' },
            { header: 'Condition', key: 'condition' },
            { header: 'Purchase Price', render: (a) => fmtMoney(a.purchasePrice) },
            { header: 'Warranty Expiry', render: (a) => fmtDate(a.warrantyEnd) },
          ]}
          rows={assets}
          onRowClick={(a) => navigate(`/assets/${a.id || a.assetTag}`)}
        />
      )}

      {/* CREATE CATALOG REQUEST WIZARD */}
      <Modal open={formOpen} title={selectedItem ? selectedItem.title : 'Submit Request'} onClose={() => setFormOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          
          {/* DYNAMIC FORMS ACCORDING TO ITEM */}
          {selectedItem?.id === 'onboarding' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Employee Name" required>
                <input className="input" required value={form.employeeName || ''} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} />
              </Field>
              <Field label="Personal Email" required>
                <input className="input" type="email" required value={form.personalEmail || ''} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
              </Field>
              <Field label="Job Title" required>
                <input className="input" required value={form.jobTitle || ''} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              </Field>
              <Field label="Reporting Manager" required>
                <input className="input" required value={form.reportingManager || ''} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })} />
              </Field>
              <Field label="Office Location" required>
                <Select
                  value={form.officeLocation}
                  onChange={(v) => setForm({ ...form, officeLocation: v })}
                  options={LOCATIONS.map((l) => ({ value: l, label: l }))}
                />
              </Field>
              <Field label="Joining Date" required>
                <input className="input" type="date" required value={form.joiningDate || ''} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
              </Field>
            </div>
          ) : selectedItem?.id === 'offboarding' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Select Employee to Offboard" required>
                <Select
                  value={form.offboardingUserId}
                  onChange={(v) => setForm({ ...form, offboardingUserId: v })}
                  options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                  required
                />
              </Field>
              <Field label="Last Working Date" required>
                <input className="input" type="date" required value={form.lastWorkingDate || ''} onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })} />
              </Field>
              <div className="col-span-2 flex items-center gap-6 py-2">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={form.disableAccount} onChange={(e) => setForm({ ...form, disableAccount: e.target.checked })} />
                  Disable M365 & Domain Account
                </label>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={form.returnAssets} onChange={(e) => setForm({ ...form, returnAssets: e.target.checked })} />
                  Return Seeded Asset Bundles
                </label>
              </div>
            </div>
          ) : (
            // STANDARD SUPPORT REQUESTS
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Priority" required>
                  <Select
                    value={form.priority || 'MEDIUM'}
                    onChange={(v) => setForm({ ...form, priority: v })}
                    options={[
                      { value: 'LOW', label: 'Low' },
                      { value: 'MEDIUM', label: 'Medium' },
                      { value: 'HIGH', label: 'High' },
                      { value: 'CRITICAL', label: 'Critical Incident' }
                    ]}
                  />
                </Field>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Field label="Category" required>
                      <Select
                        value={form.categoryId || ''}
                        onChange={(v) => setForm({ ...form, categoryId: v })}
                        options={getFilteredCategories().map((c) => ({ value: c.id, label: c.name }))}
                        required
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setError(''); setAddCatModalOpen(true); }}
                    className="p-2 mb-0.5 bg-brand-50 border border-brand-200 text-brand-700 rounded-xl hover:bg-brand-100 font-extrabold text-sm h-9 flex items-center justify-center w-9"
                    title="Add Custom Category"
                  >
                    +
                  </button>
                </div>
                <div className="md:col-span-2">
                  <Field label="Request Summary" required>
                    <input className="input" required value={form.summary || ''} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Justification / Technical Description" required>
                    <textarea
                      rows={4}
                      className="input"
                      placeholder="Detail why you need this service or access setup..."
                      required
                      value={form.description || ''}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </Field>
                </div>
              </div>

              {/* CONDITIONAL SPECIFIC CUSTOM FIELDS */}
              {selectedItem?.id === 'm365' && (
                <div className="border-t border-gray-100 pt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Required M365 License Type" required>
                    <Select
                      value={form.customFields?.[1] || ''}
                      onChange={(v) => setForm({ ...form, customFields: { ...form.customFields, 1: v } })}
                      options={[
                        { value: 'Business Premium', label: 'Business Premium' },
                        { value: 'E3', label: 'Enterprise E3' },
                        { value: 'E5', label: 'Enterprise E5' }
                      ]}
                      required
                    />
                  </Field>
                </div>
              )}

              {selectedItem?.id === 'vpn' && (
                <div className="border-t border-gray-100 pt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Affected Target Server Name" required>
                    <input
                      className="input"
                      placeholder="e.g. ERP-SRV-001"
                      required
                      value={form.customFields?.[2] || ''}
                      onChange={(e) => setForm({ ...form, customFields: { ...form.customFields, 2: e.target.value } })}
                    />
                  </Field>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={loading}>
              Cancel
            </button>
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* APPROVAL ACTION DIALOG */}
      <Modal open={actionModalOpen} title={`${approvalAction === 'APPROVED' ? 'Approve' : 'Reject'} Request`} onClose={() => setActionModalOpen(false)}>
        <form onSubmit={handleApprovalAction} className="space-y-4 text-xs">
          <Field label="Approval Comments / Justification">
            <textarea
              rows={3}
              className="input"
              placeholder="Provide comments regarding your decision..."
              value={actionComments}
              onChange={(e) => setActionComments(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setActionModalOpen(false)}>
              Cancel
            </button>
            <button className={`btn ${approvalAction === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              Submit Decision
            </button>
          </div>
        </form>
      </Modal>
      {/* ADD CUSTOM CATEGORY MODAL */}
      <Modal open={addCatModalOpen} title="Define Custom IT Category" onClose={() => setAddCatModalOpen(false)}>
        <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
          <Field label="Category Name" required>
            <input className="input" required placeholder="e.g. Printer Toner" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          </Field>
          <Field label="Category Code / Abbreviation Prefix (3 letters)" required>
            <input className="input" maxLength="5" required placeholder="e.g. TNR" value={newCatCode} onChange={(e) => setNewCatCode(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setAddCatModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary">
              Create Category
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const LOCATIONS = ['Head Office', 'Warehouse 1', 'Warehouse 2', 'Branch Office'];
