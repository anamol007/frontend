import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
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
    </BrowserRouter>
  );
}