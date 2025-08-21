import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

import DashboardHome from '../pages/DashboardHome';
import UsersPage from '../pages/UsersPage';
import ProductsPage from '../pages/ProductsPage';
import CategoriesPage from '../pages/CategoriesPage';
import InventoriesPage from '../pages/InventoriesPage';
import StockPage from '../pages/StockPage';
import CustomersPage from '../pages/CustomersPage';
import DriversPage from '../pages/DriversPage';
import DeliveriesPage from '../pages/DeliveriesPage';
import CoordinatesPage from '../pages/CoordinatesPage';
import ManagesPage from '../pages/ManagesPage';
import ProductUnitsPage from '../pages/ProductUnitsPage';
import OrdersPage from '../pages/OrdersPage'; // Import OrdersPage


export default function DashboardLayout() {
  return (
    <div className="h-screen w-full grid grid-cols-[280px_1fr] bg-slate-50">
      {/* left */}
      <aside className="border-r border-slate-200 bg-white/70 backdrop-blur-xl">
        <Sidebar />
      </aside>

      {/* right */}
      <div className="relative overflow-hidden">
        {/* soft animated blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-200 blur-3xl animate-[float_12s_ease-in-out_infinite]" />
          <div className="absolute -bottom-20 right-10 h-96 w-96 rounded-full bg-emerald-200 blur-3xl animate-[float_10s_ease-in-out_infinite]" />
          <style>{`
            @keyframes float { 0%{transform:translateY(0)} 50%{transform:translateY(-14px)} 100%{transform:translateY(0)} }
          `}</style>
        </div>

        <Topbar />

        <main className="relative z-10 h-[calc(100vh-64px)] overflow-auto px-6 pb-10">
          <div className="mx-auto max-w-7xl pt-6">
            <Routes>
              <Route index element={<DashboardHome />} />

              {/* master data */}
              <Route path="users" element={<UsersPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="product-units" element={<ProductUnitsPage />} />
              <Route path="orders" element={<OrdersPage />} />

              {/* transactions */}
              <Route path="inventories" element={<InventoriesPage />} />
              <Route path="stock" element={<StockPage />} />
              <Route path="drivers" element={<DriversPage />} />
              <Route path="deliveries" element={<DeliveriesPage />} />
              <Route path="coordinates" element={<CoordinatesPage />} />
              <Route path="manages" element={<ManagesPage />} />

              <Route path="*" element={<Navigate to="." replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}