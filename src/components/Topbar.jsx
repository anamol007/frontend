import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User2 } from 'lucide-react';
import { getUser, clearAuth } from '../utils/api';

const TITLES = {
  '': 'Dashboard',
  users: 'Users',
  products: 'Products',
  categories: 'Categories',
  customers: 'Customers',
  'product-units': 'Product Units',
  orders: 'Orders',
  inventories: 'Inventories',
  stock: 'Stock',
  drivers: 'Drivers',
  deliveries: 'Deliveries',
  summary: 'Summary',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { (async () => { try { setMe(await getUser()); } catch {} })(); }, []);

  const key = (pathname.split('/')[2] ?? '');
  const title = TITLES[key] ?? 'Dashboard';

  const logout = () => { clearAuth(); navigate('/login', { replace: true }); };

  return (
    <header className="sticky top-0 z-30 border-b border-white/20 bg-white/40 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/30">
      <div className="mx-auto flex h-16 items-center justify-between px-4">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-sm text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              <User2 size={16} />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-medium leading-4 text-slate-900">{me?.fullname || 'User'}</div>
              <div className="text-[11px] text-slate-500">{me?.email || ''}</div>
            </div>
            <ChevronDown size={16} className="text-slate-400" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div className="px-3 py-2 text-xs text-slate-500">
                Signed in as <span className="text-slate-800">{me?.email || '—'}</span>
              </div>
              <div className="my-1 h-px bg-slate-200" />
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}