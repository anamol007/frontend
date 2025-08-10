import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// Pages
import DashboardHome from '../pages/DashboardHome';
import UsersPage from '../pages/UsersPage';
import ProductsPage from '../pages/ProductsPage';
import CategoriesPage from '../pages/CategoriesPage';
import CustomersPage from '../pages/CustomersPage';
import DriversPage from '../pages/DriversPage';
import InventoriesPage from '../pages/InventoriesPage';
import StockPage from '../pages/StockPage';
import ManagesPage from '../pages/ManagesPage';
import CoordinatesPage from '../pages/CoordinatesPage';
import DeliveriesPage from '../pages/DeliveriesPage';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-mesh-light">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Topbar />
            <div className="animate-fade-in">
              <Routes>
                <Route index element={<DashboardHome />} />
                {/* Master Data */}
                <Route path="users" element={<UsersPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="drivers" element={<DriversPage />} />
                {/* Transactions */}
                <Route path="inventories" element={<InventoriesPage />} />
                <Route path="stock" element={<StockPage />} />
                <Route path="manages" element={<ManagesPage />} />
                <Route path="coordinates" element={<CoordinatesPage />} />
                <Route path="deliveries" element={<DeliveriesPage />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="" replace />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}