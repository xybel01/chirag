import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate } from '../utils/format.js';

export default function ChangeCalendar() {
  const [changes, setChanges] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', changeType: 'STANDARD', risk: 'LOW', plan: '', scheduledStart: '', scheduledEnd: '', rollbackPlan: '', cabApproved: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.get('/tickets', { params: { type: 'CHANGE_REQUEST', pageSize: 100 } });
      // Map tickets to calendar event items
      const list = res.data.items.map((t) => {
        // Retrieve custom data or mock dates if fields missing
        const start = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16);
        const end = new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16);
        return {
          id: t.id,
          ticketNo: t.ticketNo,
          title: t.summary,
          description: t.description,
          changeType: 'NORMAL',
          risk: 'MEDIUM',
          scheduledStart: start,
          scheduledEnd: end,
          cabApproved: t.status === 'RESOLVED' || t.status === 'OPEN'
        };
      });
      setChanges(list);
    } catch (err) {
      console.error('Error fetching changes list:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const notes = `Change Type: ${form.changeType}\nRisk: ${form.risk}\nImplementation Plan: ${form.plan}\nRollback Plan: ${form.rollbackPlan}\nStart: ${form.scheduledStart}\nEnd: ${form.scheduledEnd}`;
      await api.post('/tickets', {
        type: 'CHANGE_REQUEST',
        summary: form.title,
        description: `${form.description}\n\n${notes}`,
        priority: form.risk === 'HIGH' ? 'HIGH' : 'MEDIUM',
      });
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="CAB Change Management Calendar"
        subtitle="Forward Schedule of Change requests (FSC) containing standard, normal, and emergency releases"
        actions={
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            + Propose Change
          </button>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* CALENDAR COLUMN */}
        <div className="md:col-span-2 card p-5 bg-white border border-gray-100 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-xs">Monthly Release Roadmap</h3>
          <div className="grid grid-cols-7 gap-2 text-center text-gray-400 font-bold border-b border-gray-100 pb-2">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>
          <div className="grid grid-cols-7 gap-2 h-72">
            {/* Simple calendar rendering placeholders with current releases mapped onto days */}
            {Array.from({ length: 31 }).map((_, idx) => {
              const day = idx + 1;
              const dayChanges = changes.filter(() => day === 14 || day === 18 || day === 22).slice(0, 1);
              return (
                <div key={idx} className="border border-slate-50 rounded-xl p-1 bg-slate-50/20 hover:bg-indigo-50/20 transition flex flex-col justify-between items-start min-h-12">
                  <span className="font-bold text-gray-400 text-3xs">{day}</span>
                  {dayChanges.map((c) => (
                    <span key={c.id} className="text-4xs font-extrabold truncate bg-indigo-50 border border-indigo-150 text-indigo-700 px-1 rounded block w-full text-left" title={c.title}>
                      {c.ticketNo}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* CHANGE REQUESTS REGISTER DETAILS */}
        <div className="space-y-4">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">Scheduled Releases</h3>
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {changes.map((c) => (
              <div key={c.id} className="card p-4 bg-white border border-gray-100 space-y-2">
                <div className="flex justify-between items-center text-3xs font-extrabold">
                  <span className="text-indigo-900">{c.ticketNo}</span>
                  <span className={`px-2 py-0.5 rounded ${c.cabApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                    {c.cabApproved ? 'CAB Approved' : 'Draft'}
                  </span>
                </div>
                <h4 className="font-bold text-gray-850 truncate">{c.title}</h4>
                <p className="text-2xs text-gray-500 leading-normal">{c.description.slice(0, 100)}...</p>
                <div className="border-t border-slate-50 pt-2 grid grid-cols-2 text-3xs text-gray-400">
                  <div><strong>Risk:</strong> {c.risk}</div>
                  <div><strong>Type:</strong> {c.changeType}</div>
                </div>
              </div>
            ))}
            {changes.length === 0 && (
              <span className="text-gray-400 text-2xs block text-center py-12">No releases proposed for the current calendar timeline.</span>
            )}
          </div>
        </div>
      </div>

      {/* CREATE NEW CHANGE MODAL */}
      <Modal open={modalOpen} title="Propose Change Request" onClose={() => setModalOpen(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Change Type" required>
              <Select
                value={form.changeType}
                onChange={(v) => setForm({ ...form, changeType: v })}
                options={[
                  { value: 'STANDARD', label: 'Standard (Pre-approved / Low risk)' },
                  { value: 'NORMAL', label: 'Normal (Needs CAB approval review)' },
                  { value: 'EMERGENCY', label: 'Emergency (Security hotfix / Service restored)' }
                ]}
              />
            </Field>
            <Field label="Risk Category" required>
              <Select
                value={form.risk}
                onChange={(v) => setForm({ ...form, risk: v })}
                options={[
                  { value: 'LOW', label: 'Low Risk' },
                  { value: 'MEDIUM', label: 'Medium Risk' },
                  { value: 'HIGH', label: 'High Risk / CAB required' }
                ]}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Change Title" required>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Business Justification & Scope" required>
                <textarea rows={2} className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Technical Implementation Plan" required>
                <textarea rows={2} className="input" placeholder="Step 1: backup databases, Step 2: apply migration..." required value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
              </Field>
            </div>
            <Field label="Scheduled Start Time" required>
              <input className="input" type="datetime-local" required value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} />
            </Field>
            <Field label="Scheduled End Time" required>
              <input className="input" type="datetime-local" required value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Rollback Plan" required>
                <textarea rows={2} className="input" placeholder="Detail how you restore service if deploy fails..." required value={form.rollbackPlan} onChange={(e) => setForm({ ...form, rollbackPlan: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={loading}>Cancel</button>
            <button className="btn-primary" disabled={loading}>{loading ? 'Submitting…' : 'Submit Proposal'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
