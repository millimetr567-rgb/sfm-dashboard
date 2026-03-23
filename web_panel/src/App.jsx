import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DebtTracker from './pages/DebtTracker';
import NewOrder from './pages/NewOrder';
import CRM from './pages/CRM';
import OrderHistory from './pages/OrderHistory';
import Products from './pages/Products';
import Agents from './pages/Agents';
import CashRegister from './pages/CashRegister';
import Settings from './pages/Settings';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="debt" element={<DebtTracker />} />
        <Route path="new-order" element={<NewOrder />} />
        <Route path="crm" element={<CRM />} />
        <Route path="orders" element={<OrderHistory />} />
        <Route path="products" element={<Products />} />
        <Route path="agents" element={<ProtectedRoute adminOnly><Agents /></ProtectedRoute>} />
        <Route path="cash-register" element={<ProtectedRoute adminOnly><CashRegister /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  );
}
