// src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Tags, UserCircle2,
  Boxes, Truck, ClipboardList, ListChecks, Gauge, Map, ArrowLeftRight
} from 'lucide-react';
import { api } from '../utils/api';

function Item({ to, icon: Icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          'ring-1 ring-transparent',
          isActive
            ? 'bg-white text-slate-900 shadow-sm ring-slate-200'
            : 'text-slate-600 hover:bg-white/70 hover:ring-slate-200'
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 group-hover:ring-slate-300">
            <Icon size={18} />
          </span>
          <span className="truncate">{label}</span>

          {/* Active green dot */}
          {isActive && (
            <span aria-hidden className="ml-auto inline-flex items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 animate-pulse shadow-[0_0_0_2px_rgba(16,185,129,0.15)]" />
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const [brandTitle, setBrandTitle] = useState('Inventory Console');
  const [brandSub, setBrandSub] = useState(''); // e.g. Admin / Super Admin

  useEffect(() => {
    let mounted = true;

    async function loadBrand() {
      try {
        const vt = await api.get('/users/verify-token');
        const user = vt?.data?.data?.user || vt?.data?.user || vt?.data;

        if (!mounted || !user) return;

        // show role tag if you like
        setBrandSub(user.role ? user.role[0].toUpperCase() + user.role.slice(1) : '');

        if (user.role === 'admin') {
          // fetch managed inventory to display its name
          const detail = await api.get(`/users/${user.id}`);
          const full = detail?.data?.data || detail?.data || {};
          const managed = Array.isArray(full.managedItems) ? full.managedItems : [];
          const invName = managed?.[0]?.inventory?.inventoryName;

          if (mounted && invName) setBrandTitle(invName);
        } else {
          // superadmin/driver/etc fall back to default
          setBrandTitle('Inventory Console');
        }
      } catch {
        // ignore errors; keep default brand
      }
    }

    loadBrand();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-b from-slate-50 to-white/80 backdrop-blur-xl">
      {/* Brand */}
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-800 ring-1 ring-slate-200">
          <UserCircle2 />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-900">{brandTitle}</div>
          {brandSub && <div className="text-xs text-slate-500">{brandSub}</div>}
        </div>
      </div>

      <div className="space-y-6 overflow-auto pr-1">
        {/* General */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">General</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />
          </div>
        </div>

        {/* Master Data */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Master Data</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard/users" icon={Users} label="Users" />
            <Item to="/dashboard/products" icon={Package} label="Products" />
            <Item to="/dashboard/categories" icon={Tags} label="Categories" />
            <Item to="/dashboard/customers" icon={UserCircle2} label="Customers" />
            <Item to="/dashboard/product-units" icon={ClipboardList} label="Product Units" />
          </div>
        </div>

        {/* Transactions (Summary at bottom) */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Transactions</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard/inventories" icon={Map} label="Inventories" />
            {/* <Item to="/dashboard/transfers" icon={ArrowLeftRight} label="Transfers" /> */}
            <Item to="/dashboard/stock" icon={Boxes} label="Stock" />
            <Item to="/dashboard/drivers" icon={Truck} label="Drivers" />
            <Item to="/dashboard/deliveries" icon={ClipboardList} label="Deliveries" />
            <Item to="/dashboard/orders" icon={ListChecks} label="Orders" />
            <div className="mt-1 pt-1 border-t border-slate-200/70">
              <Item to="/dashboard/summary" icon={Gauge} label="Summary" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto px-2 pt-6 text-[11px] text-slate-400">
        © {new Date().getFullYear()} Inventory
      </div>
    </div>
  );
}