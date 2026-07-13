import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, can } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assets from './pages/Assets.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Assignments from './pages/Assignments.jsx';
import Stock from './pages/Stock.jsx';
import Repairs from './pages/Repairs.jsx';
import Licenses from './pages/Licenses.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import AuditLog from './pages/AuditLog.jsx';
import MyAssets from './pages/MyAssets.jsx';
import ImportAssets from './pages/ImportAssets.jsx';

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
        <Route path="/" element={<Protected action="viewInventory"><Dashboard /></Protected>} />
        <Route path="/assets" element={<Protected action="viewInventory"><Assets /></Protected>} />
        <Route path="/assets/import" element={<Protected action="manageInventory"><ImportAssets /></Protected>} />
        <Route path="/assets/:id" element={<Protected action="viewInventory"><AssetDetail /></Protected>} />
        <Route path="/assignments" element={<Protected action="viewInventory"><Assignments /></Protected>} />
        <Route path="/stock" element={<Protected action="viewInventory"><Stock /></Protected>} />
        <Route path="/repairs" element={<Protected action="viewInventory"><Repairs /></Protected>} />
        <Route path="/licenses" element={<Protected action="viewInventory"><Licenses /></Protected>} />
        <Route path="/reports" element={<Protected action="viewInventory"><Reports /></Protected>} />
        <Route path="/users" element={<Protected action="manageUsers"><Users /></Protected>} />
        <Route path="/audit" element={<Protected action="viewAudit"><AuditLog /></Protected>} />
        <Route path="/my-assets" element={<MyAssets />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
