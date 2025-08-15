// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Tags, Map, Boxes,
  Truck, ClipboardList, UserCircle2, Waypoints, Scale
} from 'lucide-react';

const Item = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `group mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
       ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`
    }
  >
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
      <Icon size={18} />
    </span>
    <span>{label}</span>
    <span className="ml-auto opacity-0 group-hover:opacity-100 text-slate-400">↗</span>
  </NavLink>
);

export default function Sidebar() {
  return (
    <div className="h-full flex flex-col p-4">
      {/* brand */}
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
          <UserCircle2 />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-900">Inventory Console</div>
          <div className="text-xs text-slate-500">Admin</div>
        </div>
      </div>

      <div className="space-y-6 overflow-auto">
        <div>
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">General</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          </div>
        </div>

        <div>
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Master Data</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard/users" icon={Users} label="Users" />
            <Item to="/dashboard/products" icon={Package} label="Products" />
            {/* NEW: Product Units page */}
            <Item to="/dashboard/product-units" icon={Scale} label="Product Units" />
            <Item to="/dashboard/categories" icon={Tags} label="Categories" />
            <Item to="/dashboard/customers" icon={UserCircle2} label="Customers" />
            <Item to="/dashboard/orders" icon={ClipboardList} label="Orders" />
          </div>
        </div>

        <div>
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Transactions</div>
          <div className="mt-2 px-2">
            <Item to="/dashboard/inventories" icon={Map} label="Inventories" />
            <Item to="/dashboard/stock" icon={Boxes} label="Stock" />
            <Item to="/dashboard/drivers" icon={Truck} label="Drivers" />
            <Item to="/dashboard/deliveries" icon={ClipboardList} label="Deliveries" />
            <Item to="/dashboard/coordinates" icon={Waypoints} label="Coordinates" />
            <Item to="/dashboard/manages" icon={ClipboardList} label="Manages" />
          </div>
        </div>
      </div>

      <div className="mt-auto px-2 pt-6 text-[11px] text-slate-400">
        © {new Date().getFullYear()} Inventory
      </div>
    </div>
  );
}