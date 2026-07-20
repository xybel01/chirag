import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, can } from '../context/AuthContext.jsx';
import AIAssistant from './AIAssistant.jsx';

const NAV = [
  { to: '/', label: '📊 ITAM Dashboard', action: 'viewInventory' },
  { to: '/multi-company-settings', label: '🏢 Multi-Company Configs' },
  { to: '/vendors', label: '🤝 Vendor Directory' },
  { to: '/user-profiles', label: '👤 User Asset Profiles', action: 'viewInventory' },
  { to: '/assets/assign', label: 'Assign Assets', action: 'manageInventory' },
  { to: '/inventory/computers', label: '💻 Computers', action: 'viewInventory' },
  { to: '/inventory/laptops', label: '  └ Laptops', action: 'viewInventory' },
  { to: '/inventory/desktops', label: '  └ Desktops', action: 'viewInventory' },
  { to: '/inventory/monitors', label: '🖥️ Monitors', action: 'viewInventory' },
  { to: '/inventory/printers', label: '🖨️ Printers & Scanners', action: 'viewInventory' },
  { to: '/inventory/network', label: '🔌 Network Devices', action: 'viewInventory' },
  { to: '/inventory/mobile', label: '📱 Mobile Devices', action: 'viewInventory' },
  { to: '/inventory/accessories', label: '⌨️ Accessories', action: 'viewInventory' },
  { to: '/assets', label: 'All Assets', action: 'viewInventory' },
  { to: '/assignments', label: 'Assignments', action: 'viewInventory' },
  { to: '/stock', label: 'Stock', action: 'viewInventory' },
  { to: '/licenses', label: '💳 Software Licenses', action: 'viewInventory' },
  { to: '/reports', label: 'Reports', action: 'viewInventory' },
  { to: '/users', label: 'Users', action: 'manageUsers' },
  { to: '/audit', label: 'Audit Log', action: 'viewAudit' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-50 print:bg-white">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 flex flex-col print:hidden border-r border-slate-950 shadow-lg">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div>
            <div className="font-black text-xs text-white leading-tight uppercase tracking-wider">Nationwide Paper</div>
            <div className="text-3xs text-slate-450 font-extrabold uppercase tracking-widest mt-0.5">IT Portal</div>
          </div>
          <span className="bg-indigo-950 border border-indigo-850 px-2 py-0.5 text-3xs font-extrabold rounded text-indigo-400">ITAM</span>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto space-y-1">
          {NAV.filter((n) => !n.action || can(user, n.action)).map((n) => {
            const isSubItem = n.label.startsWith(' ');
            const displayLabel = n.label.replace('  └ ', '').trim();
            
            return (
              <NavLink 
                key={n.to} 
                to={n.to} 
                end={n.to === '/'}
                className={({ isActive }) => `
                  mx-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 flex items-center gap-2.5
                  ${isSubItem ? 'pl-8 text-slate-400 hover:text-slate-200' : 'text-slate-300 hover:bg-slate-800/40 hover:text-white'}
                  ${isActive ? (isSubItem ? 'bg-slate-800/60 text-indigo-400 font-bold' : 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-950/30') : ''}
                `}
              >
                {isSubItem ? (
                  <>
                    <span className="text-3xs text-slate-600">•</span>
                    <span>{displayLabel}</span>
                  </>
                ) : (
                  <span>{n.label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
          <div className="truncate max-w-[130px]">
            <div className="font-bold text-white text-xs truncate leading-tight">{user?.name}</div>
            <div className="text-3xs text-slate-450 font-extrabold uppercase tracking-wider mt-0.5">{user?.role?.replace('_', ' ')}</div>
          </div>
          <button 
            onClick={() => { logout(); navigate('/login'); }} 
            className="px-2.5 py-1 text-3xs font-extrabold bg-slate-800 border border-slate-700 text-slate-300 rounded hover:bg-slate-700 hover:text-white transition-all"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 print:p-0 overflow-x-auto relative">
        <Outlet />
        <div className="print:hidden">
          <AIAssistant />
        </div>
      </main>
    </div>
  );
}
