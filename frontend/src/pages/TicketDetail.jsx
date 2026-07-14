import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client';
import { useAuth, can } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate, fmtMoney } from '../utils/format.js';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Form comments/worklogs
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  
  // Work timer stopwatch
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerIntervalId, setTimerIntervalId] = useState(null);
  const [logTimeModal, setLogTimeModal] = useState(false);
  const [logMins, setLogMins] = useState('');
  const [logNotes, setLogNotes] = useState('');

  // Watcher modal
  const [watcherModal, setWatcherModal] = useState(false);
  const [watcherUserId, setWatcherUserId] = useState('');

  // CSAT Survey
  const [surveyModal, setSurveyModal] = useState(false);
  const [surveyForm, setSurveyForm] = useState({ rating: 5, resolutionQuality: 5, technicianBehavior: 5, responseTimeRating: 5, comments: '' });

  const loadTicket = useCallback(async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);

      const userRes = await api.get('/users', { params: { pageSize: 100 } });
      setAllUsers(userRes.data.items);
      setTechnicians(userRes.data.items.filter((u) => ['SUPER_ADMIN', 'IT_MANAGER', 'IT_SUPPORT'].includes(u.role)));

      const catRes = await api.get('/meta/categories');
      setCategories(catRes.data);

      const assetRes = await api.get('/assets', { params: { pageSize: 100 } });
      setAllAssets(assetRes.data.items);
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    }
  }, [id]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  // Stopwatch timer trigger
  useEffect(() => {
    if (timerRunning) {
      const interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      setTimerIntervalId(interval);
      return () => clearInterval(interval);
    } else {
      if (timerIntervalId) {
        clearInterval(timerIntervalId);
        setTimerIntervalId(null);
      }
    }
  }, [timerRunning]);

  if (!ticket) return <div className="text-gray-500 text-center py-12">Loading Ticket Details…</div>;

  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/tickets/${ticket.id}`, { status: newStatus });
      loadTicket();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleTechChange = async (techId) => {
    try {
      await api.put(`/tickets/${ticket.id}`, { assignedToId: techId ? Number(techId) : null });
      loadTicket();
    } catch (err) {
      alert('Failed to reassign: ' + err.message);
    }
  };

  const handlePriorityChange = async (prio) => {
    try {
      await api.put(`/tickets/${ticket.id}`, { priority: prio });
      loadTicket();
    } catch (err) {
      alert('Failed to update priority: ' + err.message);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    try {
      await api.post(`/tickets/${ticket.id}/comments`, {
        body: commentBody,
        isInternal: isInternal
      });
      setCommentBody('');
      loadTicket();
    } catch (err) {
      alert('Failed to add comment: ' + err.message);
    }
  };

  // Stopwatch start/stop helper
  const toggleStopwatch = () => {
    if (timerRunning) {
      // Stopped: pre-fill time logs modal
      const mins = Math.max(1, Math.round(elapsedSeconds / 60));
      setLogMins(String(mins));
      setTimerRunning(false);
      setLogTimeModal(true);
    } else {
      setElapsedSeconds(0);
      setTimerRunning(true);
    }
  };

  const handleLogWork = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tickets/${ticket.id}/worklogs`, {
        timeSpent: Number(logMins),
        notes: logNotes
      });
      setLogTimeModal(false);
      setLogMins('');
      setLogNotes('');
      setElapsedSeconds(0);
      loadTicket();
    } catch (err) {
      alert('Failed to log work time: ' + err.message);
    }
  };

  const handleAddWatcher = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tickets/${ticket.id}/watchers`, { userId: watcherUserId });
      setWatcherModal(false);
      loadTicket();
    } catch (err) {
      alert('Failed to add watcher: ' + err.message);
    }
  };

  const handleRemoveWatcher = async (watcherUserId) => {
    try {
      await api.delete(`/tickets/${ticket.id}/watchers/${watcherUserId}`);
      loadTicket();
    } catch (err) {
      alert('Failed to remove watcher: ' + err.message);
    }
  };

  const handleSurveySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tickets/${ticket.id}/survey`, surveyForm);
      setSurveyModal(false);
      loadTicket();
    } catch (err) {
      alert('Failed to submit feedback: ' + err.message);
    }
  };

  const renderSLATimer = () => {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return 'RESOLVED';
    const target = ticket.slaResolutionExpiry ? new Date(ticket.slaResolutionExpiry) : null;
    if (!target) return '—';

    const diff = target.getTime() - Date.now();
    if (diff < 0) return 'SLA BREACHED';

    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `${mins} mins left`;
    return `${Math.ceil(mins / 60)} hours left`;
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isITStaff = ['SUPER_ADMIN', 'IT_MANAGER', 'IT_SUPPORT'].includes(user?.role);

  return (
    <div className="space-y-6 pb-12 text-xs">
      <PageHeader
        title={`${ticket.ticketNo}: ${ticket.summary}`}
        subtitle={`Requested by ${ticket.requester?.name} (${ticket.requester?.email})`}
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => navigate('/tickets')}>
              Back to Queue
            </button>
            {ticket.status === 'RESOLVED' && !ticket.surveys.length && user.id === ticket.requesterId && (
              <button className="btn-primary" onClick={() => setSurveyModal(true)}>
                ⭐ Rate Resolution
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* LEFT COLUMN: TICKET DETAILS, COMMENTS, TIMER */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Description & Technical notes */}
          <div className="card p-5 bg-white border border-gray-100 space-y-4">
            <div>
              <span className="text-3xs uppercase font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700">Description</span>
              <p className="mt-2 text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Custom Field Values */}
            {ticket.customValues?.length > 0 && (
              <div className="border-t border-gray-50 pt-4">
                <h4 className="font-extrabold text-gray-800 mb-2">Request Specifications</h4>
                <div className="grid gap-2 grid-cols-2">
                  {ticket.customValues.map((cv) => (
                    <div key={cv.id} className="p-2 border border-slate-50 rounded-xl bg-slate-50/50">
                      <span className="text-3xs font-extrabold text-gray-400 uppercase">{cv.customField.name}</span>
                      <p className="font-bold text-gray-700 mt-0.5">{cv.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Linked Hardware/Software Assets */}
          <div className="card p-5 bg-white border border-gray-100">
            <h3 className="font-extrabold text-gray-800 text-xs mb-3">Linked Infrastructure Assets ({ticket.linkedAssets?.length || 0})</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {ticket.linkedAssets?.map((asset) => (
                <div key={asset.id} className="p-3 border border-gray-150 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="font-extrabold text-indigo-900">{asset.assetTag}</span>
                    <h5 className="font-bold text-gray-700 text-2xs mt-0.5">{asset.manufacturer} {asset.model}</h5>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold bg-indigo-50 border border-indigo-100 text-indigo-700`}>{asset.status}</span>
                </div>
              ))}
              {(!ticket.linkedAssets || ticket.linkedAssets.length === 0) && (
                <span className="text-gray-400 text-2xs">No hardware or software licenses linked to this incident/request yet.</span>
              )}
            </div>
          </div>

          {/* WORK TIMER STOPWATCH LOG (IT Support Only) */}
          {isITStaff && (
            <div className="card p-5 bg-white border border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-gray-800">IT Task Work Timer</h4>
                <p className="text-2xs text-gray-400">Track and record hands-on resolution hours for billing calculations.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-base font-black px-4 py-1.5 rounded-xl border ${timerRunning ? 'bg-red-50 border-red-200 text-red-700 animate-pulse' : 'bg-slate-50 border-gray-200 text-gray-700'}`}>
                  {formatTimer(elapsedSeconds)}
                </span>
                <button
                  onClick={toggleStopwatch}
                  className={`px-4 py-2 text-2xs font-extrabold rounded-xl border ${timerRunning ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white'}`}
                >
                  {timerRunning ? 'Stop & Log' : 'Start Timer'}
                </button>
              </div>
            </div>
          )}

          {/* COMMENTS & REPLIES THREAD */}
          <div className="card p-5 bg-white border border-gray-100 space-y-4">
            <h3 className="font-extrabold text-gray-800 text-xs">Conversations & Activity Logs</h3>
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {ticket.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3.5 rounded-2xl border ${comment.isInternal ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50/50 border-gray-150'}`}
                >
                  <div className="flex justify-between items-center mb-1.5 text-3xs">
                    <div className="flex items-center gap-1.5 font-extrabold text-gray-800">
                      <span>{comment.author.name}</span>
                      {comment.isInternal && <span className="bg-amber-150 border border-amber-250 text-amber-850 px-1.5 py-0.5 rounded text-4xs uppercase">Internal Note</span>}
                    </div>
                    <span className="text-gray-400">{fmtDate(comment.createdAt)}</span>
                  </div>
                  <p className="text-gray-700 leading-normal font-medium">{comment.body}</p>
                </div>
              ))}
              {ticket.comments.length === 0 && (
                <div className="text-center text-gray-400 py-6">No comments or activity log entries yet.</div>
              )}
            </div>

            {/* Comment Post Box */}
            <form onSubmit={handleCommentSubmit} className="border-t border-gray-100 pt-4 space-y-3">
              <textarea
                className="input"
                rows={3}
                required
                placeholder="Type your message here..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <div className="flex justify-between items-center">
                {isITStaff ? (
                  <label className="flex items-center gap-2 font-bold text-gray-650">
                    <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                    Post as Internal Developer Note
                  </label>
                ) : <div />}
                <button className="btn-primary">Post Comment</button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: RIGHT SIDEBAR FOR META CONTROLS */}
        <div className="space-y-6">
          {/* SLA EXPIRY METRIC CARD */}
          <div className="card p-5 bg-white border border-gray-100 space-y-2">
            <span className="text-3xs uppercase font-extrabold text-gray-400 tracking-wider">SLA Resolution Countdown</span>
            <div className={`text-base font-black uppercase tracking-wider ${ticket.slaStatus === 'BREACHED' ? 'text-red-650 animate-pulse' : 'text-indigo-850'}`}>
              {renderSLATimer()}
            </div>
            <p className="text-3xs text-gray-450 leading-relaxed">
              Target Resolution: <span className="font-extrabold">{fmtDate(ticket.slaResolutionExpiry)}</span> <br />
              Target First Response: <span className="font-extrabold">{fmtDate(ticket.slaResponseExpiry)}</span>
            </p>
          </div>

          {/* STATUS CONTROL DROPDOWNS */}
          <div className="card p-5 bg-white border border-gray-100 space-y-4">
            <h4 className="font-extrabold text-gray-800 border-b border-gray-50 pb-2 text-xs">Ticket Control Panel</h4>

            <Field label="Status">
              <Select
                value={ticket.status}
                onChange={handleStatusChange}
                options={[
                  { value: 'NEW', label: 'New' },
                  { value: 'OPEN', label: 'Open' },
                  { value: 'ASSIGNED', label: 'Assigned' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'PENDING_USER', label: 'Pending User' },
                  { value: 'PENDING_VENDOR', label: 'Pending Vendor' },
                  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'CLOSED', label: 'Closed' },
                  { value: 'CANCELLED', label: 'Cancelled' }
                ]}
              />
            </Field>

            {isITStaff && (
              <>
                <Field label="Assigned Technician">
                  <Select
                    value={ticket.assignedToId || ''}
                    onChange={handleTechChange}
                    options={[
                      { value: '', label: 'Unassigned' },
                      ...technicians.map((t) => ({ value: t.id, label: t.name }))
                    ]}
                  />
                </Field>

                <Field label="Priority Level">
                  <Select
                    value={ticket.priority}
                    onChange={handlePriorityChange}
                    options={[
                      { value: 'LOW', label: 'Low' },
                      { value: 'MEDIUM', label: 'Medium' },
                      { value: 'HIGH', label: 'High' },
                      { value: 'CRITICAL', label: 'Critical' }
                    ]}
                  />
                </Field>
              </>
            )}
          </div>

          {/* WATCHERS LIST CARD */}
          <div className="card p-5 bg-white border border-gray-100 space-y-3">
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <h4 className="font-extrabold text-gray-800 text-xs">Watchers ({ticket.watchers?.length || 0})</h4>
              <button
                onClick={() => setWatcherModal(true)}
                className="text-indigo-650 hover:underline text-2xs font-extrabold"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1.5">
              {ticket.watchers?.map((watcher) => (
                <div key={watcher.id} className="flex justify-between items-center text-2xs p-1.5 border border-slate-50 rounded-xl bg-slate-50/50">
                  <span className="font-bold text-gray-700">{watcher.user.name}</span>
                  <button
                    onClick={() => handleRemoveWatcher(watcher.user.id)}
                    className="text-gray-400 hover:text-red-650 font-black text-xs"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {(!ticket.watchers || ticket.watchers.length === 0) && (
                <span className="text-gray-400 text-3xs">No watchers added.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WORK LOG TIMER MODAL */}
      <Modal open={logTimeModal} title="Log Work Time" onClose={() => setLogTimeModal(false)}>
        <form onSubmit={handleLogWork} className="space-y-4 text-xs">
          <Field label="Minutes Spent" required>
            <input className="input" type="number" required value={logMins} onChange={(e) => setLogMins(e.target.value)} />
          </Field>
          <Field label="Work Log Notes / Description" required>
            <textarea
              rows={3}
              className="input"
              placeholder="What task steps were accomplished during this session?"
              required
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setLogTimeModal(false)}>Cancel</button>
            <button className="btn-primary">Save Work Log</button>
          </div>
        </form>
      </Modal>

      {/* WATCHER MODAL */}
      <Modal open={watcherModal} title="Add Watcher to Ticket" onClose={() => setWatcherModal(false)}>
        <form onSubmit={handleAddWatcher} className="space-y-4 text-xs">
          <Field label="Select Employee" required>
            <Select
              value={watcherUserId}
              onChange={setWatcherUserId}
              options={allUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
              required
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setWatcherModal(false)}>Cancel</button>
            <button className="btn-primary">Add Watcher</button>
          </div>
        </form>
      </Modal>

      {/* SURVEY FEEDBACK MODAL */}
      <Modal open={surveyModal} title="Rate IT Resolution Quality" onClose={() => setSurveyModal(false)}>
        <form onSubmit={handleSurveySubmit} className="space-y-4 text-xs">
          <Field label="Overall Rating (1 - 5 stars)">
            <Select
              value={surveyForm.rating}
              onChange={(v) => setSurveyForm({ ...surveyForm, rating: Number(v) })}
              options={[
                { value: 5, label: '⭐⭐⭐⭐⭐ Excellent' },
                { value: 4, label: '⭐⭐⭐⭐ Good' },
                { value: 3, label: '⭐⭐⭐ Satisfactory' },
                { value: 2, label: '⭐⭐ Poor' },
                { value: 1, label: '⭐ Very Bad' }
              ]}
            />
          </Field>
          <Field label="Resolution Quality (1 - 5 stars)">
            <input className="input" type="number" min="1" max="5" value={surveyForm.resolutionQuality} onChange={(e) => setSurveyForm({ ...surveyForm, resolutionQuality: Number(e.target.value) })} />
          </Field>
          <Field label="Technician Behavior (1 - 5 stars)">
            <input className="input" type="number" min="1" max="5" value={surveyForm.technicianBehavior} onChange={(e) => setSurveyForm({ ...surveyForm, technicianBehavior: Number(e.target.value) })} />
          </Field>
          <Field label="Response Speed Rating (1 - 5 stars)">
            <input className="input" type="number" min="1" max="5" value={surveyForm.responseTimeRating} onChange={(e) => setSurveyForm({ ...surveyForm, responseTimeRating: Number(e.target.value) })} />
          </Field>
          <Field label="Comments / Suggestions">
            <textarea
              rows={3}
              className="input"
              placeholder="What could be improved?"
              value={surveyForm.comments}
              onChange={(e) => setSurveyForm({ ...surveyForm, comments: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setSurveyModal(false)}>Cancel</button>
            <button className="btn-primary">Submit Survey Feedback</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
