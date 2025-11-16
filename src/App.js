// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import Login from './pages/Login';
import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import InventoriesPage from './pages/InventoriesPage';
import StockPage from './pages/StockPage';
import CustomersPage from './pages/CustomersPage';
import DriversPage from './pages/DriversPage';
import DeliveriesPage from './pages/DeliveriesPage';
import OrdersPage from './pages/OrdersPage';
import MyProfilePage from './pages/MyProfilePage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CustomerProfilePage from './pages/CustomerProfilePage';

// your axios instance
import { api } from './utils/api';

/* ---------- Helper: logout (in-file, no extra module) ---------- */
function performLogout(reason) {
  // Clear common token keys used by many apps (safe default)
  try { localStorage.removeItem('token'); } catch {}
  try { localStorage.removeItem('access_token'); } catch {}
  try { localStorage.removeItem('auth_token'); } catch {}
  try { localStorage.removeItem('app_token'); } catch {}
  // optional: clear any user object stored
  try { localStorage.removeItem('user'); } catch {}

  // notify other listeners/tabs
  try {
    window.dispatchEvent(new CustomEvent('app-logout', { detail: { reason } }));
  } catch (e) {
    // fallback for older envs: localStorage flag triggers 'storage' event in other tabs
    try { localStorage.setItem('__app_logout__', JSON.stringify({ reason, t: Date.now() })); } catch {}
  }
}

/* ---------- Inner app that can use useNavigate ---------- */
function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    // 1) Response interceptor to catch 401 anywhere in the app
    const id = api.interceptors.response.use(
      (resp) => resp,
      (err) => {
        const status = err?.response?.status;
        if (status === 401) {
          // token invalid/expired — do a centralized logout
          performLogout('Unauthorized (401)');
        }
        return Promise.reject(err);
      }
    );

    // 2) Listener for the logout event (dispatched by performLogout)
    function onAppLogout(e) {
      // optionally inspect e.detail.reason
      // clear again (defensive) and navigate to login
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('app_token');
        localStorage.removeItem('user');
      } catch {}
      navigate('/login', { replace: true });
    }
    window.addEventListener('app-logout', onAppLogout);

    // 3) storage listener: if other tab sets __app_logout__, redirect this tab too
    function onStorage(e) {
      if (!e) return;
      if (e.key === '__app_logout__') {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('app_token');
          localStorage.removeItem('user');
        } catch {}
        navigate('/login', { replace: true });
      }
    }
    window.addEventListener('storage', onStorage);

    // cleanup on unmount
    return () => {
      api.interceptors.response.eject(id);
      window.removeEventListener('app-logout', onAppLogout);
      window.removeEventListener('storage', onStorage);
    };
  }, [navigate]);

  // Your original routes (unchanged)
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />

      {/* PUBLIC */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* PROTECTED */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="inventories" element={<InventoriesPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="deliveries" element={<DeliveriesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="my-profile" element={<MyProfilePage />} />
        <Route path="customers/:id" element={<CustomerProfilePage />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

/* ---------- top-level App ---------- */
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}