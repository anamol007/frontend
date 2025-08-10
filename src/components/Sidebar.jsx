import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Users, Package, Truck, Boxes, Map, ClipboardList, FolderTree, UserSquare } from 'lucide-react';

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
  }`;

export default function Sidebar() {
  return (
    <aside className="hidden md:block w-64 shrink-0 p-4">
      <div className="sticky top-4 space-y-6">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white font-bold">∗</div>
          <div className="text-lg font-semibold">IMS</div>
        </div>

        <nav className="space-y-4">
          <div>
            <div className="px-2 text-xs uppercase tracking-wide text-slate-400 mb-2">Overview</div>
            <ul className="space-y-1">
              <li><NavLink to="/dashboard" end className={linkClass}><LayoutGrid size={16}/> Dashboard</NavLink></li>
            </ul>
          </div>

          <div>
            <div className="px-2 text-xs uppercase tracking-wide text-slate-400 mb-2">Master Data</div>
            <ul className="space-y-1">
              <li><NavLink to="/dashboard/users" className={linkClass}><Users size={16}/> Users</NavLink></li>
              <li><NavLink to="/dashboard/products" className={linkClass}><Package size={16}/> Products</NavLink></li>
              <li><NavLink to="/dashboard/categories" className={linkClass}><FolderTree size={16}/> Categories</NavLink></li>
              <li><NavLink to="/dashboard/customers" className={linkClass}><UserSquare size={16}/> Customers</NavLink></li>
              <li><NavLink to="/dashboard/drivers" className={linkClass}><Truck size={16}/> Drivers</NavLink></li>
            </ul>
          </div>

          <div>
            <div className="px-2 text-xs uppercase tracking-wide text-slate-400 mb-2">Transactions</div>
            <ul className="space-y-1">
              <li><NavLink to="/dashboard/inventories" className={linkClass}><Map size={16}/> Inventories</NavLink></li>
              <li><NavLink to="/dashboard/stock" className={linkClass}><Boxes size={16}/> Stock</NavLink></li>
              <li><NavLink to="/dashboard/manages" className={linkClass}><ClipboardList size={16}/> Manages</NavLink></li>
              <li><NavLink to="/dashboard/coordinates" className={linkClass}><Map size={16}/> Coordinates</NavLink></li>
              <li><NavLink to="/dashboard/deliveries" className={linkClass}><Truck size={16}/> Deliveries</NavLink></li>
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
}