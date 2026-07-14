import { useEffect, useState } from 'react';
import api, { apiError } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { Field, Select } from '../components/FormField.jsx';
import { fmtDate } from '../utils/format.js';

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  
  // Dialogs
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [draftModal, setDraftModal] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'Access Control' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const CATEGORIES = ['VPN Access', 'Microsoft 365', 'Access Control', 'Hardware Support', 'Network Setup'];

  const loadData = async () => {
    try {
      const res = await api.get('/kb', { params: { search, category: activeCategory } });
      setArticles(res.data);
    } catch (err) {
      console.error('Error fetching articles:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, activeCategory]);

  const handleVote = async (articleId, voteType) => {
    try {
      await api.post(`/kb/${articleId}/vote`, { vote: voteType });
      loadData();
      if (selectedArticle && selectedArticle.id === articleId) {
        setSelectedArticle((prev) => ({
          ...prev,
          helpful: voteType === 'helpful' ? prev.helpful + 1 : prev.helpful,
          notHelpful: voteType === 'nothelpful' ? prev.notHelpful + 1 : prev.notHelpful
        }));
      }
    } catch (err) {
      alert('Vote recording failed: ' + err.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/kb', form);
      setDraftModal(false);
      setForm({ title: '', content: '', category: 'Access Control' });
      loadData();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const isITStaff = ['SUPER_ADMIN', 'IT_MANAGER', 'IT_SUPPORT'].includes(user?.role);

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="Knowledge Base (KB) Articles"
        subtitle="Self-help guides and quick-fix tutorials curated by Nationwide Paper IT team"
        actions={
          isITStaff && (
            <button className="btn-primary" onClick={() => setDraftModal(true)}>
              + Write Article
            </button>
          )
        }
      />

      {/* SEARCH AND CATEGORIES TAB BAR */}
      <div className="card p-4 bg-white shadow-xs flex flex-wrap gap-4 items-center">
        <input
          className="input max-w-sm"
          placeholder="Search articles by keywords…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setActiveCategory('')}
            className={`px-3 py-1.5 rounded-xl font-bold border ${!activeCategory ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-650 hover:bg-slate-50'}`}
          >
            All Guides
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold border ${activeCategory === cat ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-650 hover:bg-slate-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ARTICLES LIST GRID */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {articles.map((art) => (
          <div
            key={art.id}
            onClick={() => setSelectedArticle(art)}
            className="card p-5 bg-white border border-gray-150 hover:border-indigo-300 hover:shadow-xs cursor-pointer flex flex-col justify-between transition-all"
          >
            <div className="space-y-2">
              <span className="text-3xs uppercase font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{art.category}</span>
              <h4 className="font-extrabold text-gray-800 text-xs leading-snug">{art.title}</h4>
              <p className="text-2xs text-gray-500 leading-normal line-clamp-3">{art.content}</p>
            </div>
            <div className="flex justify-between items-center text-3xs text-gray-400 mt-4 border-t border-slate-50 pt-2">
              <span>By {art.author?.name || 'Technician'}</span>
              <span>{art.helpful} helpful votes</span>
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <span className="text-gray-400 text-2xs text-center col-span-3 py-12">No matching knowledge base articles found.</span>
        )}
      </div>

      {/* ARTICLE READER DRAWER DIALOG */}
      <Modal open={!!selectedArticle} title={selectedArticle?.title || 'Read Article'} onClose={() => setSelectedArticle(null)}>
        {selectedArticle && (
          <div className="space-y-4 text-xs">
            <div className="flex gap-2">
              <span className="text-3xs uppercase font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                {selectedArticle.category}
              </span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-medium border-t border-b border-gray-50 py-4">
              {selectedArticle.content}
            </p>
            
            {/* Feedback/Vote widget */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-2xs font-bold text-gray-400">Published on {fmtDate(selectedArticle.createdAt)}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-600">Was this article helpful?</span>
                <button
                  onClick={() => handleVote(selectedArticle.id, 'helpful')}
                  className="px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded hover:bg-emerald-100 font-extrabold"
                >
                  Yes ({selectedArticle.helpful})
                </button>
                <button
                  onClick={() => handleVote(selectedArticle.id, 'nothelpful')}
                  className="px-2 py-1 bg-red-50 border border-red-100 text-red-700 rounded hover:bg-red-100 font-extrabold"
                >
                  No ({selectedArticle.notHelpful})
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* WRITE ARTICLE MODAL */}
      <Modal open={draftModal} title="Write Knowledge Article" onClose={() => setDraftModal(false)}>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Category" required>
              <Select
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Article Title" required>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Guide Content (Markdown supported)" required>
                <textarea rows={6} className="input" required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setDraftModal(false)} disabled={loading}>Cancel</button>
            <button className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Publish Article'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
