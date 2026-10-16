import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth, can } from '../context/AuthContext.jsx';
import AteraCopilotDrawer from './AteraCopilotDrawer.jsx';
import api from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', group: 'RMM & Operations' },
  { to: '/devices', label: 'Devices (RMM)', icon: '💻', group: 'RMM & Operations' },
  { to: '/tickets', label: 'Tickets (Helpdesk)', icon: '🎫', group: 'RMM & Operations' },
  { to: '/alerts', label: 'Monitoring Alerts', icon: '⚠️', group: 'RMM & Operations' },
  { to: '/scripts', label: 'Scripts & Automation', icon: '📜', group: 'RMM & Operations' },
  { to: '/agent-deploy', label: 'Agent Deployment', icon: '🚀', group: 'RMM & Operations' },

  { to: '/assets', label: 'Asset Inventory', icon: '📦', group: 'IT Asset Management' },
  { to: '/user-profiles', label: 'User Asset Profiles', icon: '👤', group: 'IT Asset Management' },
  { to: '/licenses', label: 'Software Licenses', icon: '💳', group: 'IT Asset Management' },
  { to: '/multi-company-settings', label: 'Clients & Sites', icon: '🏢', group: 'IT Asset Management' },
  { to: '/reports', label: 'Reports & Analytics', icon: '📈', group: 'IT Asset Management' },
  { to: '/security', label: 'Security Center', icon: '🛡️', group: 'Administration' },
  { to: '/users', label: 'Technicians & Users', icon: '👥', group: 'Administration' },
  { to: '/audit', label: 'System Audit Log', icon: '📋', group: 'Administration' }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [showQuickNew, setShowQuickNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch open alerts count for bell icon badge
  useEffect(() => {
    const fetchAlertsCount = async () => {
      try {
        const res = await api.get('/alerts?status=OPEN');
        setOpenAlertsCount(res.data.counts?.open || 0);
      } catch (err) {
        // Silently continue
      }
    };
    fetchAlertsCount();
    const interval = setInterval(fetchAlertsCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/devices?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      {/* ATERA DARK NAVY SIDEBAR */}
      <aside className="w-64 shrink-0 bg-slate-950 text-slate-200 flex flex-col border-r border-slate-900 shadow-2xl z-20">
        {/* Logo / Brand Header */}
        <div className="px-5 py-4 border-b border-slate-900 bg-slate-950 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-cyan-500/20">
              A
            </div>
            <div>
              <div className="font-black text-sm text-white tracking-tight leading-none">ATERA</div>
              <div className="text-3xs font-extrabold uppercase tracking-widest text-cyan-400 mt-1">RMM & PSA PLATFORM</div>
            </div>
          </Link>
          <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 text-3xs font-extrabold rounded text-emerald-400">
            LIVE
          </span>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-6">
          {['RMM & Operations', 'IT Asset Management', 'Administration'].map((group) => {
            const items = NAV_ITEMS.filter((n) => n.group === group);
            return (
              <div key={group} className="space-y-1">
                <div className="px-3 text-3xs font-extrabold uppercase tracking-wider text-slate-500">
                  {group}
                </div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `
                      px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 flex items-center gap-2.5
                      ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                      }
                    `}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3.5 border-t border-slate-900 bg-slate-950/80 flex items-center justify-between">
          <div className="truncate max-w-[130px]">
            <div className="font-bold text-white text-xs truncate leading-tight">{user?.name || 'Administrator'}</div>
            <div className="text-3xs text-cyan-400 font-extrabold uppercase tracking-wider mt-0.5">{user?.role?.replace('_', ' ') || 'SUPER ADMIN'}</div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="px-2.5 py-1 text-3xs font-extrabold bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:bg-rose-950 hover:text-rose-300 hover:border-rose-900 transition-all"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA WITH ATERA TOPBAR */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-xs z-10">
          {/* Global Search Bar */}
          <form onSubmit={handleGlobalSearch} className="relative w-80">
            <input
              type="text"
              placeholder="Search devices, tickets, serial number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>

          {/* Quick Actions & Copilot Trigger */}
          <div className="flex items-center gap-3">
            {/* Quick "+ New" Action Button */}
            <div className="relative">
              <button
                onClick={() => setShowQuickNew(!showQuickNew)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
              >
                <span>+ New</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </button>

              {showQuickNew && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-1 text-xs font-semibold z-50"
                  onClick={() => setShowQuickNew(false)}
                >
                  <Link to="/tickets" className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-800">
                    <span>🎫</span> New Helpdesk Ticket
                  </Link>
                  <Link to="/agent-deploy" className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-800">
                    <span>🚀</span> Install Endpoint Agent
                  </Link>
                  <Link to="/scripts" className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-800">
                    <span>📜</span> Run Remote Script
                  </Link>
                  <Link to="/assets" className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-800">
                    <span>📦</span> Register Asset
                  </Link>
                </div>
              )}
            </div>

            {/* Live Alerts Bell */}
            <Link
              to="/alerts"
              className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Monitoring Alerts"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {openAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-black text-3xs animate-pulse">
                  {openAlertsCount}
                </span>
              )}
            </Link>

            {/* Atera Copilot AI Trigger Button */}
            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-cyan-300 font-extrabold text-xs shadow-md border border-slate-800 flex items-center gap-2 hover:brightness-110 transition-all active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              Atera Copilot (AI)
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Slide-over Atera Copilot Drawer */}
      <AteraCopilotDrawer isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
