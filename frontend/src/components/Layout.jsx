import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, can } from '../context/AuthContext.jsx';
import AIAssistant from './AIAssistant.jsx';

const NAV = [
  { to: '/', label: '🏢 Service Portal' },
  { to: '/tickets', label: '🎫 Support Queues' },
  { to: '/changes-calendar', label: '📅 Change Calendar' },
  { to: '/kb', label: '📚 Knowledge Base' },
  { to: '/itsm-dashboard', label: '📊 ITSM Dashboard', action: 'viewInventory' },
  { to: '/admin-itsm', label: '⚙️ Admin ITSM Settings', action: 'viewInventory' },
  { to: '/procurement', label: '🛍️ Procurement & POs' },
  { to: '/monitoring', label: '📈 Infrastructure Monitor' },
  { to: '/security', label: '🛡️ Compliance Security' },
  { to: '/multi-company-settings', label: '🏢 Multi-Company Configs' },
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
  { to: '/repairs', label: 'Repairs', action: 'viewInventory' },
  { to: '/licenses', label: 'Licenses', action: 'viewInventory' },
  { to: '/reports', label: 'Reports', action: 'viewInventory' },
  { to: '/users', label: 'Users', action: 'manageUsers' },
  { to: '/audit', label: 'Audit Log', action: 'viewAudit' },
  { to: '/my-assets', label: 'My Assets' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-56 shrink-0 bg-brand-800 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-brand-700">
          <div className="font-bold leading-tight">Nationwide Paper</div>
          <div className="text-xs text-brand-100">IT Inventory Portal</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.filter((n) => !n.action || can(user, n.action)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => `block px-4 py-2 text-sm ${isActive ? 'bg-brand-700 font-semibold' : 'text-brand-100 hover:bg-brand-700/60'}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-brand-700 text-sm">
          <div className="font-medium truncate">{user?.name}</div>
          <div className="text-xs text-brand-100">{user?.role?.replace('_', ' ')}</div>
          <button onClick={() => { logout(); navigate('/login'); }} className="mt-2 text-xs underline text-brand-100 hover:text-white">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto relative">
        <Outlet />
        <AIAssistant />
      </main>
    </div>
  );
}
