import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate } from '../utils/format.js';

export default function TicketQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [viewMode, setViewMode] = useState('queue'); // 'queue' | 'kanban'
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTech, setFilterTech] = useState('');

  // Bulk action states
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkVal, setBulkVal] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // New ticket modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ type: 'INCIDENT', summary: '', description: '', priority: 'MEDIUM', categoryId: '' });
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const res = await api.get('/tickets', { params: { pageSize: 100 } });
      setTickets(res.data.items);

      const userRes = await api.get('/users', { params: { pageSize: 100 } });
      setTechnicians(userRes.data.items.filter((u) => ['SUPER_ADMIN', 'IT_MANAGER', 'IT_SUPPORT'].includes(u.role)));

      const catRes = await api.get('/meta/categories');
      setCategories(catRes.data);
    } catch (err) {
      console.error('Error loading tickets queue:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter local tickets
  const filteredTickets = tickets.filter((t) => {
    const matchSearch =
      t.ticketNo.toLowerCase().includes(search.toLowerCase()) ||
      t.summary.toLowerCase().includes(search.toLowerCase()) ||
      (t.requester?.name || '').toLowerCase().includes(search.toLowerCase());
    
    return (
      matchSearch &&
      (filterType ? t.type === filterType : true) &&
      (filterPriority ? t.priority === filterPriority : true) &&
      (filterStatus ? t.status === filterStatus : true) &&
      (filterTech ? String(t.assignedToId) === String(filterTech) : true)
    );
  });

  // Calculate SLA countdown string
  const renderSLATimer = (t) => {
    if (t.status === 'RESOLVED' || t.status === 'CLOSED' || t.status === 'CANCELLED') {
      return <span className="text-gray-400 font-bold">Resolved</span>;
    }
    const target = t.slaResolutionExpiry ? new Date(t.slaResolutionExpiry) : null;
    if (!target) return <span className="text-gray-400">—</span>;

    const diff = target.getTime() - Date.now();
    if (diff < 0) {
      return <span className="text-red-600 font-extrabold uppercase text-3xs tracking-wider animate-pulse">Breached</span>;
    }

    const mins = Math.ceil(diff / 60000);
    if (mins < 60) {
      return <span className="text-orange-600 font-bold">{mins}m left</span>;
    }
    const hours = Math.ceil(mins / 60);
    return <span className="text-emerald-700 font-bold">{hours}h left</span>;
  };

  // Bulk actions submit
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    try {
      const promises = selectedIds.map((id) => {
        const payload = {};
        if (bulkAction === 'assign') payload.assignedToId = Number(bulkVal);
        if (bulkAction === 'status') payload.status = bulkVal;
        if (bulkAction === 'priority') payload.priority = bulkVal;
        return api.put(`/tickets/${id}`, payload);
      });
      await Promise.all(promises);
      setBulkModalOpen(false);
      setSelectedIds([]);
      loadData();
    } catch (err) {
      alert('Failed to execute bulk updates: ' + err.message);
    }
  };

  // New ticket submit
  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tickets', {
        type: form.type,
        summary: form.summary,
        description: form.description,
        priority: form.priority,
        categoryId: form.categoryId ? Number(form.categoryId) : undefined
      });
      setCreateModalOpen(false);
      loadData();
    } catch (err) {
      setError(apiError(err));
    }
  };

  // Toggle selection
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTickets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTickets.map((t) => t.id));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ITSM Service Queues"
        subtitle="Technician workspace with SLA counters, Kanban boards, and bulk action toggles"
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setViewMode(viewMode === 'queue' ? 'kanban' : 'queue')}>
              {viewMode === 'queue' ? '📋 Kanban View' : '🗂️ Queue List'}
            </button>
            <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
              + Raise Ticket
            </button>
          </div>
        }
      />

      {/* FILTER CONTROL BAR */}
      <div className="card p-4 bg-white shadow-xs grid gap-3 md:grid-cols-5 text-xs">
        <input
          className="input md:col-span-1"
          placeholder="Search number, subject, requester…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={filterType} onChange={setFilterType} placeholder="All Request Types" options={[{ value: 'INCIDENT', label: 'Incidents' }, { value: 'SERVICE_REQUEST', label: 'Service Requests' }, { value: 'CHANGE_REQUEST', label: 'Changes' }]} />
        <Select value={filterPriority} onChange={setFilterPriority} placeholder="All Priorities" options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' }]} />
        <Select value={filterStatus} onChange={setFilterStatus} placeholder="All Statuses" options={[{ value: 'NEW', label: 'New' }, { value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'RESOLVED', label: 'Resolved' }]} />
        <Select value={filterTech} onChange={setFilterTech} placeholder="All Technicians" options={technicians.map((t) => ({ value: t.id, label: t.name }))} />
      </div>

      {/* BULK ACTIONS ROW */}
      {selectedIds.length > 0 && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl p-3 flex items-center justify-between text-xs font-bold text-brand-850">
          <span>{selectedIds.length} tickets selected for bulk editing</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setBulkAction('assign'); setBulkVal(''); setBulkModalOpen(true); }}
              className="px-3 py-1 bg-white border border-brand-200 text-brand-800 rounded-lg hover:bg-slate-50"
            >
              Assign Tech
            </button>
            <button
              onClick={() => { setBulkAction('status'); setBulkVal('IN_PROGRESS'); setBulkModalOpen(true); }}
              className="px-3 py-1 bg-white border border-brand-200 text-brand-800 rounded-lg hover:bg-slate-50"
            >
              Change Status
            </button>
            <button
              onClick={() => { setBulkAction('priority'); setBulkVal('HIGH'); setBulkModalOpen(true); }}
              className="px-3 py-1 bg-white border border-brand-200 text-brand-800 rounded-lg hover:bg-slate-50"
            >
              Change Priority
            </button>
          </div>
        </div>
      )}

      {/* QUEUE LIST VIEW */}
      {viewMode === 'queue' && (
        <DataTable
          columns={[
            {
              header: <input type="checkbox" checked={selectedIds.length === filteredTickets.length && filteredTickets.length > 0} onChange={toggleSelectAll} />,
              render: (t) => <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)} onClick={(e) => e.stopPropagation()} />
            },
            { header: 'Ticket No', render: (t) => <span className="font-extrabold text-indigo-900">{t.ticketNo}</span> },
            { header: 'Summary', key: 'summary' },
            { header: 'Type', render: (t) => <span className="text-3xs uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{t.type}</span> },
            { header: 'Priority', render: (t) => <span className={`font-bold ${t.priority === 'CRITICAL' ? 'text-red-650' : t.priority === 'HIGH' ? 'text-orange-655 font-bold' : 'text-gray-550'}`}>{t.priority}</span> },
            { header: 'SLA Target', render: renderSLATimer },
            { header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
            { header: 'Requester', render: (t) => t.requester?.name || '—' },
            { header: 'Technician', render: (t) => t.assignedTo?.name || '—' }
          ]}
          rows={filteredTickets}
          onRowClick={(t) => navigate(`/tickets/${t.ticketNo}`)}
        />
      )}

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid gap-4 md:grid-cols-4 items-start text-xs">
          {['NEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((status) => {
            const statusTickets = filteredTickets.filter((t) => t.status === status);
            return (
              <div key={status} className="card bg-slate-50 border border-slate-200/60 p-4 space-y-3 rounded-2xl">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-extrabold text-gray-800 text-xs">{status}</h4>
                  <span className="bg-slate-200 text-gray-700 rounded-full px-2 py-0.5 font-bold">{statusTickets.length}</span>
                </div>
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {statusTickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => navigate(`/tickets/${t.ticketNo}`)}
                      className="p-3 bg-white border border-gray-100 rounded-xl shadow-2xs hover:border-brand-300 hover:shadow-xs cursor-pointer space-y-2 transition-all"
                    >
                      <div className="flex justify-between items-center text-3xs font-extrabold">
                        <span className="text-indigo-900">{t.ticketNo}</span>
                        <span className={`px-1.5 py-0.5 rounded ${t.priority === 'CRITICAL' ? 'bg-red-50 text-red-750' : 'bg-slate-50 text-gray-650'}`}>{t.priority}</span>
                      </div>
                      <p className="font-bold text-gray-800 leading-normal truncate">{t.summary}</p>
                      <div className="flex justify-between items-center text-3xs text-gray-400">
                        <span>SLA: {renderSLATimer(t)}</span>
                        <span>{t.assignedTo?.name || 'Unassigned'}</span>
                      </div>
                    </div>
                  ))}
                  {statusTickets.length === 0 && (
                    <div className="text-center text-gray-400 py-6">No tickets in this column</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW SUPPORT TICKET MODAL */}
      <Modal open={createModalOpen} title="Create Support Ticket" onClose={() => setCreateModalOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Request Type" required>
              <Select
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={[
                  { value: 'INCIDENT', label: 'Incident' },
                  { value: 'SERVICE_REQUEST', label: 'Service Request' },
                  { value: 'CHANGE_REQUEST', label: 'Change Request' },
                  { value: 'PROBLEM', label: 'Problem Investigation' }
                ]}
              />
            </Field>
            <Field label="Priority" required>
              <Select
                value={form.priority}
                onChange={(v) => setForm({ ...form, priority: v })}
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'CRITICAL', label: 'Critical' }
                ]}
              />
            </Field>
            <Field label="Category" required>
              <Select
                value={form.categoryId}
                onChange={(v) => setForm({ ...form, categoryId: v })}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                required
              />
            </Field>
            <div className="col-span-2">
              <Field label="Ticket Summary" required>
                <input className="input" required value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Full Technical Description" required>
                <textarea rows={4} className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setCreateModalOpen(false)}>Cancel</button>
            <button className="btn-primary">Create Ticket</button>
          </div>
        </form>
      </Modal>

      {/* BULK ACTION INPUT MODAL */}
      <Modal open={bulkModalOpen} title={`Bulk Edit Toggles`} onClose={() => setBulkModalOpen(false)}>
        <form onSubmit={handleBulkSubmit} className="space-y-4 text-xs">
          {bulkAction === 'assign' && (
            <Field label="Select Technician" required>
              <Select value={bulkVal} onChange={setBulkVal} options={technicians.map((t) => ({ value: t.id, label: t.name }))} required />
            </Field>
          )}

          {bulkAction === 'status' && (
            <Field label="Select Status" required>
              <Select
                value={bulkVal}
                onChange={setBulkVal}
                options={[
                  { value: 'NEW', label: 'New' },
                  { value: 'OPEN', label: 'Open' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'CLOSED', label: 'Closed' }
                ]}
                required
              />
            </Field>
          )}

          {bulkAction === 'priority' && (
            <Field label="Select Priority" required>
              <Select
                value={bulkVal}
                onChange={setBulkVal}
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'CRITICAL', label: 'Critical' }
                ]}
                required
              />
            </Field>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setBulkModalOpen(false)}>Cancel</button>
            <button className="btn-primary">Apply to {selectedIds.length} Tickets</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
