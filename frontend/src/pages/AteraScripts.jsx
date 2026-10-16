import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AteraScripts() {
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Run Modal State
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [runProgress, setRunProgress] = useState(null);

  // New Script Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Maintenance');
  const [newLang, setNewLang] = useState('PowerShell');
  const [newCode, setNewCode] = useState('');

  const loadScripts = async () => {
    try {
      const res = await api.get(`/scripts?category=${categoryFilter}`);
      setScripts(res.data.scripts || []);
    } catch (err) {
      console.error('Error loading scripts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await api.get('/devices');
      setDevices(res.data.devices || []);
    } catch (err) {
      console.error('Error loading devices:', err);
    }
  };

  useEffect(() => {
    loadScripts();
    loadDevices();
  }, [categoryFilter]);

  const openRunModal = (script) => {
    setSelectedScript(script);
    setSelectedSerials([]);
    setRunProgress(null);
    setShowRunModal(true);
  };

  const handleExecuteBatch = async () => {
    if (!selectedSerials.length) {
      alert('Please select at least one target device.');
      return;
    }

    setRunProgress('Dispatching automation script to selected endpoints...');
    try {
      const res = await api.post('/scripts/run', {
        scriptId: selectedScript.id,
        serialNumbers: selectedSerials
      });
      setRunProgress(`SUCCESS: Script dispatched to ${res.data.tasks.length} endpoint(s). Monitor results on each device.`);
      setTimeout(() => {
        setShowRunModal(false);
        setRunProgress(null);
      }, 2500);
    } catch (err) {
      setRunProgress('Error executing script: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateScript = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    try {
      await api.post('/scripts', {
        name: newName,
        description: newDesc,
        category: newCategory,
        language: newLang,
        code: newCode
      });
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
      setNewCode('');
      loadScripts();
    } catch (err) {
      alert('Error creating script: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredScripts = scripts.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Atera Automation & Script Library</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
              {scripts.length} Scripts
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pre-built maintenance scripts, software deployers, diagnostic tests, and custom PowerShell automations.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          New Custom Script
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'Maintenance', 'Security', 'Diagnostics', 'Software', 'Networking'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[280px]">
          <input
            type="text"
            placeholder="Search scripts by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Scripts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">Loading library…</div>
        ) : filteredScripts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">No scripts found.</div>
        ) : (
          filteredScripts.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {s.category}
                  </span>
                  <span className="text-3xs font-mono font-bold text-slate-400">
                    {s.language}
                  </span>
                </div>

                <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{s.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{s.description || 'No description provided.'}</p>
              </div>

              {/* Code Snippet Box */}
              <div className="bg-slate-950 rounded-xl p-3 text-3xs font-mono text-emerald-400 overflow-x-auto max-h-24">
                <pre>{s.code}</pre>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-3xs text-slate-400 font-semibold">
                  {s.isBuiltIn ? 'Atera Built-in' : 'Custom Script'}
                </span>
                <button
                  onClick={() => openRunModal(s)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Run on Device
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Run Script Modal */}
      {showRunModal && selectedScript && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Run "{selectedScript.name}"</h3>
                <p className="text-xs text-slate-500 mt-0.5">Select target endpoints to receive this automation.</p>
              </div>
              <button onClick={() => setShowRunModal(false)} className="font-bold text-slate-400">&times;</button>
            </div>

            {runProgress ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center font-bold text-xs text-indigo-700">
                {runProgress}
              </div>
            ) : (
              <>
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-3">
                  {devices.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">No active devices found.</div>
                  ) : (
                    devices.map((d) => (
                      <label
                        key={d.serialNumber}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedSerials.includes(d.serialNumber)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSerials([...selectedSerials, d.serialNumber]);
                              } else {
                                setSelectedSerials(selectedSerials.filter(s => s !== d.serialNumber));
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <div>
                            <div className="font-bold text-slate-800">{d.deviceName}</div>
                            <div className="text-3xs text-slate-450 font-mono">{d.ipAddress} &bull; {d.operatingSystem}</div>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold ${d.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {d.status}
                        </span>
                      </label>
                    ))
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSerials(devices.map(d => d.serialNumber))}
                    className="text-3xs font-bold text-indigo-600 hover:underline"
                  >
                    Select All ({devices.length})
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRunModal(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteBatch}
                      disabled={!selectedSerials.length}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      Run on {selectedSerials.length} Endpoint(s)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Custom Script Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Create Custom Automation Script</h3>
              <button onClick={() => setShowCreateModal(false)} className="font-bold text-slate-400">&times;</button>
            </div>

            <form onSubmit={handleCreateScript} className="space-y-3">
              <div>
                <label className="text-3xs font-extrabold uppercase text-slate-500">Script Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optimize SSD & Trim Drives"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-3xs font-extrabold uppercase text-slate-500">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Security">Security</option>
                    <option value="Diagnostics">Diagnostics</option>
                    <option value="Software">Software</option>
                    <option value="Networking">Networking</option>
                  </select>
                </div>

                <div>
                  <label className="text-3xs font-extrabold uppercase text-slate-500">Language</label>
                  <select
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="PowerShell">PowerShell</option>
                    <option value="Batch">Batch (CMD)</option>
                    <option value="Python">Python</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-3xs font-extrabold uppercase text-slate-500">Description</label>
                <input
                  type="text"
                  placeholder="What does this script do?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-3xs font-extrabold uppercase text-slate-500">Script Source Code</label>
                <textarea
                  rows={8}
                  required
                  placeholder="Write PowerShell or Batch commands here..."
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full mt-1 p-3 bg-slate-900 text-emerald-400 font-mono rounded-xl text-xs focus:outline-none"
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
                  Save to Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
