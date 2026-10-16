import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, can } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

// Atera Core Pages
import AteraDashboard from './pages/AteraDashboard.jsx';
import AteraDevices from './pages/AteraDevices.jsx';
import AteraDeviceDetail from './pages/AteraDeviceDetail.jsx';
import AteraTickets from './pages/AteraTickets.jsx';
import AteraAlerts from './pages/AteraAlerts.jsx';
import AteraScripts from './pages/AteraScripts.jsx';
import AteraAgentDeploy from './pages/AteraAgentDeploy.jsx';

// ITAM & Management Pages
import Assets from './pages/Assets.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Assignments from './pages/Assignments.jsx';
import Stock from './pages/Stock.jsx';
import Reports from './pages/Reports.jsx';
import Licenses from './pages/Licenses.jsx';
import Users from './pages/Users.jsx';
import AuditLog from './pages/AuditLog.jsx';
import ImportAssets from './pages/ImportAssets.jsx';
import ImportProfiles from './pages/ImportProfiles.jsx';
import UserAssetProfiles from './pages/UserAssetProfiles.jsx';
import UserAssetProfileDetail from './pages/UserAssetProfileDetail.jsx';
import AssignAssets from './pages/AssignAssets.jsx';
import AssetCategoryList from './pages/AssetCategoryList.jsx';
import Procurement from './pages/Procurement.jsx';
import SecurityCenter from './pages/SecurityCenter.jsx';
import MultiCompanySettings from './pages/MultiCompanySettings.jsx';
import Vendors from './pages/Vendors.jsx';

function Protected({ children, action }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 font-bold">Connecting to Atera…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (action && !can(user, action)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<Protected><Layout /></Protected>}>
        {/* Atera Command Center Landing */}
        <Route path="/" element={<AteraDashboard />} />

        {/* Atera RMM Devices & Live Endpoint Remote Control */}
        <Route path="/devices" element={<AteraDevices />} />
        <Route path="/devices/:id" element={<AteraDeviceDetail />} />

        {/* Atera PSA Tickets / Helpdesk */}
        <Route path="/tickets" element={<AteraTickets />} />

        {/* Atera Threshold Alerts */}
        <Route path="/alerts" element={<AteraAlerts />} />

        {/* Atera Script Library & Automation */}
        <Route path="/scripts" element={<AteraScripts />} />

        {/* Atera Agent Deployment Center */}
        <Route path="/agent-deploy" element={<AteraAgentDeploy />} />

        {/* IT Asset Inventory & CMDB */}
        <Route path="/assets" element={<Protected action="viewInventory"><Assets /></Protected>} />
        <Route path="/assets/import" element={<Protected action="manageInventory"><ImportAssets /></Protected>} />
        <Route path="/assets/assign" element={<Protected action="manageInventory"><AssignAssets /></Protected>} />
        <Route path="/assets/:id" element={<Protected action="viewInventory"><AssetDetail /></Protected>} />

        {/* User Profiles */}
        <Route path="/user-profiles" element={<Protected action="viewInventory"><UserAssetProfiles /></Protected>} />
        <Route path="/user-profiles/import" element={<Protected action="manageInventory"><ImportProfiles /></Protected>} />
        <Route path="/user-profiles/:id" element={<Protected action="viewInventory"><UserAssetProfileDetail /></Protected>} />

        {/* Granular Categories */}
        <Route path="/inventory/computers" element={<Protected action="viewInventory"><AssetCategoryList type="computers" /></Protected>} />
        <Route path="/inventory/laptops" element={<Protected action="viewInventory"><AssetCategoryList type="laptops" /></Protected>} />
        <Route path="/inventory/desktops" element={<Protected action="viewInventory"><AssetCategoryList type="desktops" /></Protected>} />
        <Route path="/inventory/monitors" element={<Protected action="viewInventory"><AssetCategoryList type="monitors" /></Protected>} />
        <Route path="/inventory/printers" element={<Protected action="viewInventory"><AssetCategoryList type="printers" /></Protected>} />
        <Route path="/inventory/network" element={<Protected action="viewInventory"><AssetCategoryList type="network" /></Protected>} />
        <Route path="/inventory/mobile" element={<Protected action="viewInventory"><AssetCategoryList type="mobile" /></Protected>} />
        <Route path="/inventory/accessories" element={<Protected action="viewInventory"><AssetCategoryList type="accessories" /></Protected>} />

        {/* Other Operations */}
        <Route path="/assignments" element={<Protected action="viewInventory"><Assignments /></Protected>} />
        <Route path="/stock" element={<Protected action="viewInventory"><Stock /></Protected>} />
        <Route path="/licenses" element={<Protected action="viewInventory"><Licenses /></Protected>} />
        <Route path="/reports" element={<Protected action="viewInventory"><Reports /></Protected>} />
        <Route path="/procurement" element={<Protected><Procurement /></Protected>} />
        <Route path="/security" element={<Protected><SecurityCenter /></Protected>} />
        <Route path="/multi-company-settings" element={<Protected><MultiCompanySettings /></Protected>} />
        <Route path="/vendors" element={<Protected><Vendors /></Protected>} />
        <Route path="/users" element={<Protected action="manageUsers"><Users /></Protected>} />
        <Route path="/audit" element={<Protected action="viewAudit"><AuditLog /></Protected>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
