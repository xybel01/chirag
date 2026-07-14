import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import DataTable from '../components/DataTable.jsx';
import { Field, Select } from '../components/FormField.jsx';

export default function AdminITSM() {
  const [activeTab, setActiveTab] = useState('sla'); // 'sla' | 'automation' | 'fields'
  const [slas, setSlas] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [customFields, setCustomFields] = useState([]);

  // Modals
  const [slaModal, setSlaModal] = useState(false);
  const [slaForm, setSlaForm] = useState({ name: '', priority: 'MEDIUM', type: 'INCIDENT', responseTimeMins: 60, resolutionTimeMins: 480 });

  const [autoModal, setAutoModal] = useState(false);
  const [autoForm, setAutoForm] = useState({ name: '', trigger: 'TICKET_CREATED', conditions: { priority: 'CRITICAL' }, actions: { status: 'OPEN', assignTo: 1 } });

  const [fieldModal, setFieldModal] = useState(false);
  const [fieldForm, setFieldForm] = useState({ name: '', fieldType: 'TEXT', options: '' });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const slaRes = await api.get('/sla');
      setSlas(slaRes.data);

      const autoRes = await api.get('/automation');
      setAutomations(autoRes.data);

      // Fetch custom fields or mock
      setCustomFields([
        { id: 1, name: 'M365 License Type Required', fieldType: 'SELECT', options: '["Business Premium", "E3", "E5"]' },
        { id: 2, name: 'Affected Server Hostname', fieldType: 'TEXT', options: '—' }
      ]);
    } catch (err) {
      console.error('Error fetching admin ITSM records:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSlaSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/sla', slaForm);
      setSlaModal(false);
      loadData();
    } catch (err) {
      alert('Failed to save SLA policy: ' + err.message);
    }
  };

  const handleAutoSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/automation', autoForm);
      setAutoModal(false);
      loadData();
    } catch (err) {
      alert('Failed to save automation rule: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="ITSM Administration Engine"
        subtitle="Configure service desk parameters including warning thresholds, automation, and SLA policies"
      />

      {/* Tabs Row */}
      <div className="flex border-b border-gray-150 mb-6 font-bold">
        <button
          onClick={() => setActiveTab('sla')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'sla' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          ⏱️ SLA Policies
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'automation' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          ⚙️ No-Code Automation
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${activeTab === 'fields' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          📝 Custom Request Fields
        </button>
      </div>

      {/* SLA POLICIES TAB */}
      {activeTab === 'sla' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase">SLA Target Policies</h3>
            <button className="btn-primary" onClick={() => setSlaModal(true)}>+ Create SLA Policy</button>
          </div>
          <DataTable
            columns={[
              { header: 'Policy Name', key: 'name' },
              { header: 'Priority Target', key: 'priority' },
              { header: 'Ticket Type', key: 'type' },
              { header: 'Response Time (mins)', key: 'responseTimeMins' },
              { header: 'Resolution Target (mins)', key: 'resolutionTimeMins' },
              { header: 'Status', render: (s) => s.isActive ? 'Active' : 'Disabled' }
            ]}
            rows={slas}
          />
        </div>
      )}

      {/* AUTOMATION TAB */}
      {activeTab === 'automation' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase">No-Code Rules Engine</h3>
            <button className="btn-primary" onClick={() => setAutoModal(true)}>+ Create Rule</button>
          </div>
          <DataTable
            columns={[
              { header: 'Rule Name', key: 'name' },
              { header: 'Trigger Event', key: 'trigger' },
              { header: 'Conditions Filter', render: (a) => JSON.stringify(a.conditions) },
              { header: 'Automation Actions', render: (a) => JSON.stringify(a.actions) },
              { header: 'Status', render: (a) => a.isActive ? 'Enabled' : 'Disabled' }
            ]}
            rows={automations}
          />
        </div>
      )}

      {/* CUSTOM FIELDS TAB */}
      {activeTab === 'fields' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-gray-800 text-xs uppercase">Custom Fields Schema</h3>
            <button className="btn-primary" onClick={() => setFieldModal(true)}>+ Define Field</button>
          </div>
          <DataTable
            columns={[
              { header: 'Field Name', key: 'name' },
              { header: 'Field Type', key: 'fieldType' },
              { header: 'Option Configurations', key: 'options' }
            ]}
            rows={customFields}
          />
        </div>
      )}

      {/* CREATE SLA MODAL */}
      <Modal open={slaModal} title="Create SLA Policy" onClose={() => setSlaModal(false)}>
        <form onSubmit={handleSlaSubmit} className="space-y-4 text-xs">
          <Field label="Policy Name" required>
            <input className="input" required value={slaForm.name} onChange={(e) => setSlaForm({ ...slaForm, name: e.target.value })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Priority Level" required>
              <Select value={slaForm.priority} onChange={(v) => setSlaForm({ ...slaForm, priority: v })} options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' }]} />
            </Field>
            <Field label="Ticket Type" required>
              <Select value={slaForm.type} onChange={(v) => setSlaForm({ ...slaForm, type: v })} options={[{ value: 'INCIDENT', label: 'Incident' }, { value: 'SERVICE_REQUEST', label: 'Service Request' }]} />
            </Field>
            <Field label="Target First Response (mins)" required>
              <input className="input" type="number" required value={slaForm.responseTimeMins} onChange={(e) => setSlaForm({ ...slaForm, responseTimeMins: Number(e.target.value) })} />
            </Field>
            <Field label="Target Resolution (mins)" required>
              <input className="input" type="number" required value={slaForm.resolutionTimeMins} onChange={(e) => setSlaForm({ ...slaForm, resolutionTimeMins: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setSlaModal(false)}>Cancel</button>
            <button className="btn-primary">Create Policy</button>
          </div>
        </form>
      </Modal>

      {/* CREATE AUTOMATION MODAL */}
      <Modal open={autoModal} title="Create Automation Rule" onClose={() => setAutoModal(false)}>
        <form onSubmit={handleAutoSubmit} className="space-y-4 text-xs">
          <Field label="Rule Name" required>
            <input className="input" required value={autoForm.name} onChange={(e) => setAutoForm({ ...autoForm, name: e.target.value })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Trigger Event" required>
              <Select value={autoForm.trigger} onChange={(v) => setAutoForm({ ...autoForm, trigger: v })} options={[{ value: 'TICKET_CREATED', label: 'Ticket Created' }, { value: 'STATUS_CHANGED', label: 'Status Changed' }, { value: 'COMMENT_ADDED', label: 'Comment Added' }]} />
            </Field>
            <Field label="Condition (Priority)" required>
              <Select value={autoForm.conditions.priority} onChange={(v) => setAutoForm({ ...autoForm, conditions: { priority: v } })} options={[{ value: 'CRITICAL', label: 'Critical' }, { value: 'HIGH', label: 'High' }]} />
            </Field>
            <Field label="Action (Update Status)" required>
              <Select value={autoForm.actions.status} onChange={(v) => setAutoForm({ ...autoForm, actions: { ...autoForm.actions, status: v } })} options={[{ value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In Progress' }]} />
            </Field>
            <Field label="Action (Assign Tech ID)" required>
              <input className="input" type="number" value={autoForm.actions.assignTo} onChange={(e) => setAutoForm({ ...autoForm, actions: { ...autoForm.actions, assignTo: Number(e.target.value) } })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setAutoModal(false)}>Cancel</button>
            <button className="btn-primary">Enable Rule</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
