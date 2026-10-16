import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function AteraTickets() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, pending: 0, resolved: 0, critical: 0 });
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [search, setSearch] = useState('');

  // Selected Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [worklogMins, setWorklogMins] = useState('');
  const [worklogNotes, setWorklogNotes] = useState('');

  // AI Copilot state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // New Ticket Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSummary, setNewSummary] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newType, setNewType] = useState('INCIDENT');

  const loadTickets = async () => {
    try {
      const res = await api.get(`/tickets?status=${filterStatus}&priority=${filterPriority}&q=${search}`);
      setTickets(res.data.tickets || []);
      setCounts(res.data.counts || {});
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [filterStatus, filterPriority, search]);

  const openTicketDetail = async (ticketId) => {
    setSelectedTicket(ticketId);
    setDetailLoading(true);
    setAiResult(null);
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setTicketDetails(res.data.ticket);
    } catch (err) {
      alert('Error loading ticket: ' + (err.response?.data?.error || err.message));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      await api.post(`/tickets/${selectedTicket}/comments`, {
        body: commentText,
        isInternal: isInternalComment
      });
      setCommentText('');
      // Reload ticket details
      const res = await api.get(`/tickets/${selectedTicket}`);
      setTicketDetails(res.data.ticket);
    } catch (err) {
      alert('Error adding comment: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddWorklog = async (e) => {
    e.preventDefault();
    if (!worklogMins) return;

    try {
      await api.post(`/tickets/${selectedTicket}/worklogs`, {
        timeSpent: Number(worklogMins),
        notes: worklogNotes
      });
      setWorklogMins('');
      setWorklogNotes('');
      alert('Worklog time logged successfully.');
      const res = await api.get(`/tickets/${selectedTicket}`);
      setTicketDetails(res.data.ticket);
    } catch (err) {
      alert('Error logging time: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      await api.put(`/tickets/${selectedTicket}`, { status: newStatus });
      const res = await api.get(`/tickets/${selectedTicket}`);
      setTicketDetails(res.data.ticket);
      loadTickets();
    } catch (err) {
      alert('Error updating status: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleTriggerAI = async (promptType) => {
    setAiLoading(true);
    try {
      const res = await api.post(`/tickets/${selectedTicket}/ai-copilot`, { promptType });
      setAiResult(res.data.ai);
      if (promptType === 'DRAFT_REPLY' && res.data.ai?.content) {
        setCommentText(res.data.ai.content);
      }
    } catch (err) {
      alert('Error querying AI Copilot: ' + (err.response?.data?.error || err.message));
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newSummary.trim() || !newDescription.trim()) return;

    try {
      const res = await api.post('/tickets', {
        summary: newSummary,
        description: newDescription,
        priority: newPriority,
        type: newType
      });
      setShowCreateModal(false);
      setNewSummary('');
      setNewDescription('');
      loadTickets();
      openTicketDetail(res.data.ticket.id);
    } catch (err) {
      alert('Error creating ticket: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>ITSM Helpdesk & Tickets</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
              {counts.total} Total
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Service requests, incidents, SLA tracking, and Atera AI Copilot ticket assistance.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          New Ticket
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-slate-450 tracking-wider">Open Tickets</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{counts.open}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-amber-600 tracking-wider">Pending User / Approval</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{counts.pending}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-rose-600 tracking-wider">Critical SLA</div>
          <div className="text-2xl font-black text-rose-600 mt-1">{counts.critical}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-3xs font-extrabold uppercase text-emerald-600 tracking-wider">Resolved</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{counts.resolved}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'OPEN', 'PENDING_USER', 'IN_PROGRESS', 'RESOLVED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterStatus === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative min-w-[280px]">
          <input
            type="text"
            placeholder="Search tickets by number, subject, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-3xs font-extrabold uppercase text-slate-450 tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Ticket No</th>
                <th className="py-3.5 px-3">Priority</th>
                <th className="py-3.5 px-4">Subject & Summary</th>
                <th className="py-3.5 px-3">Requester</th>
                <th className="py-3.5 px-3">Assignee</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Created</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan="8" className="py-12 text-center text-slate-400">Loading tickets…</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan="8" className="py-12 text-center text-slate-400">No tickets found.</td></tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                      <button onClick={() => openTicketDetail(t.id)} className="hover:underline">
                        {t.ticketNo}
                      </button>
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase ${
                          t.priority === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : t.priority === 'HIGH'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 max-w-sm truncate">{t.summary}</div>
                      <div className="text-3xs text-slate-450 truncate max-w-sm">{t.description}</div>
                    </td>

                    <td className="py-3.5 px-3 font-semibold text-slate-700">
                      {t.requester?.name || 'User'}
                    </td>

                    <td className="py-3.5 px-3 text-slate-600">
                      {t.assignedTo?.name || 'Unassigned'}
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-3xs font-bold">
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-3xs font-mono text-slate-450">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openTicketDetail(t.id)}
                        className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-3xs font-extrabold transition-colors"
                      >
                        View &rarr;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-black text-indigo-600">{ticketDetails?.ticketNo}</span>
                <span className="h-4 w-px bg-slate-200"></span>
                <h3 className="font-bold text-sm text-slate-800 truncate max-w-md">{ticketDetails?.summary}</h3>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 font-bold">&times;</button>
            </div>

            {/* Modal Body */}
            {detailLoading || !ticketDetails ? (
              <div className="py-24 text-center text-slate-400 font-bold">Loading conversation…</div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Meta Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="text-3xs text-slate-450 block uppercase font-bold">Requester</span>
                    <strong className="text-slate-800">{ticketDetails.requester?.name}</strong>
                  </div>
                  <div>
                    <span className="text-3xs text-slate-450 block uppercase font-bold">Assignee</span>
                    <strong className="text-slate-800">{ticketDetails.assignedTo?.name || 'Unassigned'}</strong>
                  </div>
                  <div>
                    <span className="text-3xs text-slate-450 block uppercase font-bold">Status</span>
                    <select
                      value={ticketDetails.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      className="mt-0.5 bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-800 text-xs"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="PENDING_USER">Pending User</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-3xs text-slate-450 block uppercase font-bold">Priority</span>
                    <strong className="text-rose-600 font-bold">{ticketDetails.priority}</strong>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-3xs font-extrabold uppercase tracking-wider text-slate-450 mb-1">Issue Description</div>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{ticketDetails.description}</p>
                </div>

                {/* Linked Device Shortcut */}
                {ticketDetails.linkedAssets?.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                    <div className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                      <span>💻 Linked Machine:</span>
                      <span className="font-mono text-indigo-600">{ticketDetails.linkedAssets[0].assetTag} ({ticketDetails.linkedAssets[0].model})</span>
                    </div>
                    <Link
                      to={`/devices/${ticketDetails.linkedAssets[0].serialNumber}?tab=terminal`}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-3xs font-bold hover:bg-indigo-700"
                    >
                      Launch Terminal &rarr;
                    </Link>
                  </div>
                )}

                {/* Atera AI Copilot Actions */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">Atera AI Copilot (ActionIT)</span>
                    </div>
                    {aiLoading && <span className="text-3xs text-cyan-400">Processing with Gemini AI…</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleTriggerAI('SUGGEST_SOLUTION')}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-3xs font-bold border border-slate-700"
                    >
                      💡 Suggest Fix & Scripts
                    </button>
                    <button
                      onClick={() => handleTriggerAI('DRAFT_REPLY')}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-3xs font-bold border border-slate-700"
                    >
                      ✍️ Draft Response
                    </button>
                    <button
                      onClick={() => handleTriggerAI('SUMMARIZE')}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-3xs font-bold border border-slate-700"
                    >
                      📋 Summarize Ticket
                    </button>
                  </div>

                  {aiResult && (
                    <div className="bg-slate-950/80 p-3 rounded-lg text-xs space-y-2 border border-slate-800">
                      <div className="font-bold text-cyan-300">{aiResult.title || aiResult.diagnosis}</div>
                      {aiResult.content && <p className="text-slate-300 whitespace-pre-wrap">{aiResult.content}</p>}
                      {aiResult.recommendedSteps && (
                        <ul className="list-disc pl-4 space-y-1 text-slate-300">
                          {aiResult.recommendedSteps.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Conversation Comments */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-slate-800">Conversation & Internal Notes</h4>
                  <div className="space-y-2.5">
                    {(ticketDetails.comments || []).map((c) => (
                      <div
                        key={c.id}
                        className={`p-3.5 rounded-xl border text-xs ${
                          c.isInternal
                            ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-3xs font-bold mb-1">
                          <span className="text-indigo-600">{c.author?.name} ({c.author?.role})</span>
                          <div className="flex items-center gap-2">
                            {c.isInternal && <span className="px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-900 font-extrabold uppercase">Internal Note</span>}
                            <span className="text-slate-400 font-normal">{new Date(c.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>

                  {/* Add Reply Form */}
                  <form onSubmit={handleAddComment} className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Add Communication:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-3xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <input
                          type="checkbox"
                          checked={isInternalComment}
                          onChange={(e) => setIsInternalComment(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        Mark as Private Internal Note
                      </label>
                    </div>

                    <textarea
                      rows={3}
                      placeholder={isInternalComment ? 'Write an internal note visible only to technicians...' : 'Write a customer reply...'}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md"
                      >
                        Post Message
                      </button>
                    </div>
                  </form>
                </div>

                {/* Time Tracking / Worklog */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="font-bold text-xs text-slate-800">Technician Time Tracking</h4>
                  <form onSubmit={handleAddWorklog} className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      placeholder="Minutes (e.g. 30)"
                      value={worklogMins}
                      onChange={(e) => setWorklogMins(e.target.value)}
                      className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Activity note..."
                      value={worklogNotes}
                      onChange={(e) => setWorklogNotes(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
                    >
                      Log Time
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Create New Helpdesk Ticket</h3>
              <button onClick={() => setShowCreateModal(false)} className="font-bold text-slate-400">&times;</button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="text-3xs font-extrabold uppercase text-slate-500">Summary / Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Outlook crashed after Windows update"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-3xs font-extrabold uppercase text-slate-500">Ticket Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="INCIDENT">Incident</option>
                    <option value="SERVICE_REQUEST">Service Request</option>
                    <option value="PROBLEM">Problem</option>
                    <option value="CHANGE_REQUEST">Change Request</option>
                  </select>
                </div>

                <div>
                  <label className="text-3xs font-extrabold uppercase text-slate-500">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-3xs font-extrabold uppercase text-slate-500">Detailed Description</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the issue, symptoms, and impact..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
