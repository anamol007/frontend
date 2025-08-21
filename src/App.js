import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import OrdersPage from './pages/OrdersPage';

import Login from './pages/Login';
import DashboardHome from './pages/DashboardHome';

import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import InventoriesPage from './pages/InventoriesPage';
import StockPage from './pages/StockPage';
import CustomersPage from './pages/CustomersPage';
import DriversPage from './pages/DriversPage';
import DeliveriesPage from './pages/DeliveriesPage';

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/*" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="inventories" element={<InventoriesPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}