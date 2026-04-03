import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

// Pages (to be implemented)
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import POSPage from '@/pages/POSPage';
import InventoryPage from '@/pages/InventoryPage';
import SalesPage from '@/pages/SalesPage';
import SettingsPage from '@/pages/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/pos" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/pos" element={<PrivateRoute><POSPage /></PrivateRoute>} />
        <Route path="/sales" element={<PrivateRoute><SalesPage /></PrivateRoute>} />
        <Route
          path="/inventory"
          element={<AdminRoute><InventoryPage /></AdminRoute>}
        />
        <Route
          path="/settings"
          element={<AdminRoute><SettingsPage /></AdminRoute>}
        />

        <Route path="/" element={<Navigate to="/pos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
