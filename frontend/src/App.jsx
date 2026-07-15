import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, can } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Assets from './pages/Assets.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Assignments from './pages/Assignments.jsx';
import Stock from './pages/Stock.jsx';
import Repairs from './pages/Repairs.jsx';
import Licenses from './pages/Licenses.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import AuditLog from './pages/AuditLog.jsx';
import ImportAssets from './pages/ImportAssets.jsx';
import ITSMDashboard from './pages/ITSMDashboard.jsx';
import UserAssetProfiles from './pages/UserAssetProfiles.jsx';
import UserAssetProfileDetail from './pages/UserAssetProfileDetail.jsx';
import AssignAssets from './pages/AssignAssets.jsx';
import AssetCategoryList from './pages/AssetCategoryList.jsx';

// ITSM Portal New Screens
import ServicePortal from './pages/ServicePortal.jsx';
import TicketQueue from './pages/TicketQueue.jsx';
import TicketDetail from './pages/TicketDetail.jsx';
import ChangeCalendar from './pages/ChangeCalendar.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import AdminITSM from './pages/AdminITSM.jsx';
import Procurement from './pages/Procurement.jsx';
import Monitoring from './pages/Monitoring.jsx';
import SecurityCenter from './pages/SecurityCenter.jsx';
import MultiCompanySettings from './pages/MultiCompanySettings.jsx';
import Vendors from './pages/Vendors.jsx';

function Protected({ children, action }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (action && !can(user, action)) return <Navigate to="/my-assets" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Protected><Layout /></Protected>}>
        
        {/* Main Service Desk / IT dashboard redirect */}
        <Route path="/" element={<Protected><ServicePortal /></Protected>} />
        
        {/* ITSM Routing Mappings */}
        <Route path="/tickets" element={<Protected><TicketQueue /></Protected>} />
        <Route path="/tickets/:id" element={<Protected><TicketDetail /></Protected>} />
        <Route path="/changes-calendar" element={<Protected><ChangeCalendar /></Protected>} />
        <Route path="/kb" element={<Protected><KnowledgeBase /></Protected>} />
        <Route path="/admin-itsm" element={<Protected><AdminITSM /></Protected>} />
        <Route path="/procurement" element={<Protected><Procurement /></Protected>} />
        <Route path="/monitoring" element={<Protected><Monitoring /></Protected>} />
        <Route path="/security" element={<Protected><SecurityCenter /></Protected>} />
        <Route path="/multi-company-settings" element={<Protected><MultiCompanySettings /></Protected>} />
        <Route path="/vendors" element={<Protected><Vendors /></Protected>} />

        <Route path="/itsm-dashboard" element={<Protected action="viewInventory"><ITSMDashboard /></Protected>} />
        <Route path="/user-profiles" element={<Protected action="viewInventory"><UserAssetProfiles /></Protected>} />
        <Route path="/user-profiles/:id" element={<Protected action="viewInventory"><UserAssetProfileDetail /></Protected>} />
        
        {/* Granular category inventory list endpoints */}
        <Route path="/inventory/computers" element={<Protected action="viewInventory"><AssetCategoryList type="computers" /></Protected>} />
        <Route path="/inventory/laptops" element={<Protected action="viewInventory"><AssetCategoryList type="laptops" /></Protected>} />
        <Route path="/inventory/desktops" element={<Protected action="viewInventory"><AssetCategoryList type="desktops" /></Protected>} />
        <Route path="/inventory/monitors" element={<Protected action="viewInventory"><AssetCategoryList type="monitors" /></Protected>} />
        <Route path="/inventory/printers" element={<Protected action="viewInventory"><AssetCategoryList type="printers" /></Protected>} />
        <Route path="/inventory/network" element={<Protected action="viewInventory"><AssetCategoryList type="network" /></Protected>} />
        <Route path="/inventory/mobile" element={<Protected action="viewInventory"><AssetCategoryList type="mobile" /></Protected>} />
        <Route path="/inventory/accessories" element={<Protected action="viewInventory"><AssetCategoryList type="accessories" /></Protected>} />

        <Route path="/assets" element={<Protected action="viewInventory"><Assets /></Protected>} />
        <Route path="/assets/import" element={<Protected action="manageInventory"><ImportAssets /></Protected>} />
        <Route path="/assets/assign" element={<Protected action="manageInventory"><AssignAssets /></Protected>} />
        <Route path="/assets/:id" element={<Protected action="viewInventory"><AssetDetail /></Protected>} />
        <Route path="/assignments" element={<Protected action="viewInventory"><Assignments /></Protected>} />
        <Route path="/stock" element={<Protected action="viewInventory"><Stock /></Protected>} />
        <Route path="/repairs" element={<Protected action="viewInventory"><Repairs /></Protected>} />
        <Route path="/licenses" element={<Protected action="viewInventory"><Licenses /></Protected>} />
        <Route path="/reports" element={<Protected action="viewInventory"><Reports /></Protected>} />
        <Route path="/users" element={<Protected action="manageUsers"><Users /></Protected>} />
        <Route path="/audit" element={<Protected action="viewAudit"><AuditLog /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
