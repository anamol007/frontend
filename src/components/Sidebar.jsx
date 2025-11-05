// src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Tags, UserCircle2,
  Boxes, Truck, ClipboardList, ListChecks, Gauge, Map, ArrowLeftRight,
  ChevronDown, ChevronRight, User, Box, Layers
} from 'lucide-react';
import { api } from '../utils/api';

function Item({ to, icon: Icon, label, end = false, nested = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          nested ? 'ml-4 text-slate-700' : '',
          isActive
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
            : 'text-slate-600 hover:bg-white/70 hover:ring-1 hover:ring-slate-200'
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span className={`grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 group-hover:ring-slate-300`}>
            <Icon size={18} />
          </span>
          <span className="truncate">{label}</span>

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

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-white/50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
            <Icon size={16} />
          </span>
          <span>{title}</span>
        </div>
        <span className="text-slate-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}

export default function Sidebar() {
  const [brandTitle, setBrandTitle] = useState('Inventory Console');
  const [brandSub, setBrandSub] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadBrand() {
      try {
        const vt = await api.get('/users/verify-token');
        const user = vt?.data?.data?.user || vt?.data?.user || vt?.data;

        if (!mounted || !user) return;

        setBrandSub(user.role ? user.role[0].toUpperCase() + user.role.slice(1) : '');
        if (user.role === 'admin') {
          const detail = await api.get(`/users/${user.id}`);
          const full = detail?.data?.data || detail?.data || {};
          const managed = Array.isArray(full.managedItems) ? full.managedItems : [];
          const invName = managed?.[0]?.inventory?.inventoryName;
          if (mounted && invName) setBrandTitle(invName);
        } else {
          setBrandTitle('Inventory Console');
        }
      } catch {
        // ignore
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
          <User />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-900">{brandTitle}</div>
          {brandSub && <div className="text-xs text-slate-500">{brandSub}</div>}
        </div>
      </div>

      <div className="space-y-6 overflow-auto pr-1">
        {/* Dashboard */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">General</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />
          </div>
        </div>

        {/* Master Data */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Master data</div>
          <div className="mt-2 px-2 space-y-1">
            <Item to="/dashboard/users" icon={Users} label="Users" />
            <Item to="/dashboard/categories" icon={Tags} label="Categories" />
            <Item to="/dashboard/customers" icon={UserCircle2} label="Customers" />
            <Item to="/dashboard/suppliers" icon={UserCircle2} label="Suppliers" />
          </div>
        </div>

        {/* Products (grouped) */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Products</div>
          <div className="mt-2 px-2">
            <CollapsibleSection title="Product management" icon={Package} defaultOpen>
              <Item to="/dashboard/products" icon={Box} label="Products" nested />
              <Item to="/dashboard/product-processes" icon={Layers} label="Product processes" nested />
              <Item to="/dashboard/product-units" icon={ClipboardList} label="Product units" nested />
              <Item to="/dashboard/product-movement" icon={Map} label="Product movement" nested />
              <Item to="/dashboard/mixture" icon={Package} label="Mixture" nested />
            </CollapsibleSection>
          </div>
        </div>

        {/* Inventory & Stock */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Inventory & stock</div>
          <div className="mt-2 px-2">
            <CollapsibleSection title="Inventory operations" icon={Map} defaultOpen>
              <Item to="/dashboard/inventories" icon={Map} label="Inventories" nested />
              <Item to="/dashboard/stock" icon={Boxes} label="Stock" nested />
              <Item to="/dashboard/purchases" icon={Boxes} label="Purchases" nested />
              {/* transfers could be toggled on if you want */}
              <Item to="/dashboard/transfers" icon={ArrowLeftRight} label="Transfers" nested />
            </CollapsibleSection>
          </div>
        </div>

        {/* Orders & Deliveries */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Orders & deliveries</div>
          <div className="mt-2 px-2">
            <CollapsibleSection title="Orders & logistics" icon={ListChecks} defaultOpen={false}>
              <Item to="/dashboard/orders" icon={ListChecks} label="Orders" nested />
              <Item to="/dashboard/deliveries" icon={ClipboardList} label="Deliveries" nested />
              <Item to="/dashboard/drivers" icon={Truck} label="Drivers" nested />
            </CollapsibleSection>
          </div>
        </div>

        {/* Reports / Summary */}
        <div>
          <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reports</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard/summary" icon={Gauge} label="Summary" />
            <Item to="/dashboard/reports" icon={ClipboardList} label="Reports" />
          </div>
        </div>
      </div>

      <div className="mt-auto px-2 pt-6 text-[11px] text-slate-400">
        © {new Date().getFullYear()} Inventory
      </div>
    </div>
  );
}