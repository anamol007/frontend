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
import ProductUnitsPage from '../pages/ProductUnitsPage';
import OrdersPage from '../pages/OrdersPage';
import SummaryPage from '../pages/SummaryPage';
// import StockTransfersPage from '../pages/StockTransfersPage';
import MyProfilePage from '../pages/MyProfilePage';
import SuppliersPage from '../pages/SuppliersPage';
import PurchasesPage from '../pages/PurchasesPage';
import ProductProcessesPage from '../pages/ProductProcessesPage';

export default function DashboardLayout() {
  return (
    // Full-screen app; prevent document scrolling
    <div className="h-screen w-screen overflow-hidden bg-slate-50">
      {/* Fixed grid: sidebar + content */}
      <div className="grid h-full grid-cols-[280px_1fr]">
        {/* Sidebar: its own scroll */}
        <aside className="h-full overflow-y-auto border-r border-slate-200 bg-white/75 backdrop-blur-xl">
          <Sidebar />
        </aside>

        {/* Content column */}
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          {/* subtle blobs */}
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-200 blur-3xl animate-[float_12s_ease-in-out_infinite]" />
            <div className="absolute -bottom-20 right-10 h-96 w-96 rounded-full bg-emerald-200 blur-3xl animate-[float_10s_ease-in-out_infinite]" />
          </div>
          <style>{`
            @keyframes float {
              0% { transform: translateY(0) }
              50% { transform: translateY(-14px) }
              100% { transform: translateY(0) }
            }
          `}</style>

          {/* Sticky top bar inside content column */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur">
            <Topbar />
          </header>

          {/* Only this area scrolls for pages */}
          <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-6 pb-10">
            <div className="mx-auto max-w-7xl pt-6">
              <Routes>
                <Route index element={<DashboardHome />} />

                {/* master data */}
                <Route path="users" element={<UsersPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="product-processes" element={<ProductProcessesPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="product-units" element={<ProductUnitsPage />} />
                <Route path="orders" element={<OrdersPage />} />

                {/* transactions */}
                <Route path="inventories" element={<InventoriesPage />} />
                <Route path="stock" element={<StockPage />} />
                <Route path="purchases" element={<PurchasesPage />} />
                {/* <Route path="transfers" element={<StockTransfersPage />} /> */}
                <Route path="drivers" element={<DriversPage />} />
                <Route path="deliveries" element={<DeliveriesPage />} />
                <Route path="summary" element={<SummaryPage />} />
                <Route path="my-profile" element={<MyProfilePage />} />

                <Route path="*" element={<Navigate to="." replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}