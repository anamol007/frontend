// src/pages/DashboardHome.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Users, Package, Truck, Boxes, AlertTriangle,
  ArrowUpRight, RefreshCw
} from 'lucide-react';
import { API_URL, authHeaders as h } from '../utils/api';

/* ---------- tiny helpers ---------- */
const firstArray = (obj) => {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== 'object') return [];
  return (
    obj.data ||
    obj.items ||
    obj.rows ||
    obj.result ||
    obj.list ||
    []
  );
};

// Try a list of paths; return the first one that works (as an array)
async function tryList(paths) {
  for (const p of paths) {
    try {
      const r = await axios.get(`${API_URL}${p}`, { headers: h() });
      const data = firstArray(r.data);
      if (Array.isArray(data)) return { data, path: p };
    } catch (_) { /* keep trying */ }
  }
  return { data: [], path: null };
}

/* ---------- page ---------- */
export default function DashboardHome() {
  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('auth_user') || '{}'); } catch { return {}; }
  }, []);
  const fullName = me?.fullname || me?.full_name || me?.name || '';

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [counts, setCounts] = useState({
    users: null,
    products: null,
    deliveries: null,
    stock: null,
    lowStock: null,
  });

  useEffect(() => { fetchCounts(); }, []);

  async function fetchCounts() {
    setLoading(true); setErr('');
    try {
      const [
        usersRes,
        productsRes,
        deliveriesRes,
        stockRes,
        lowRes
      ] = await Promise.all([
        tryList(['/users']),
        tryList(['/products']),
        tryList(['/deliveries']),
        tryList(['/stock-items', '/stocks', '/inventories', '/inventory']),
        tryList(['/stock-items/low', '/stocks/low', '/products/low-stock']),
      ]);

      setCounts({
        users: usersRes.data.length,
        products: productsRes.data.length,
        deliveries: deliveriesRes.data.length,
        stock: stockRes.data.length,
        lowStock: lowRes.data.length,
      });
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    { key: 'users',     title: 'Users',      icon: Users,         to: '/dashboard/users',      hue: 'from-sky-400 to-indigo-400' },
    { key: 'products',  title: 'Products',   icon: Package,       to: '/dashboard/products',   hue: 'from-fuchsia-400 to-pink-400' },
    { key: 'deliveries',title: 'Deliveries', icon: Truck,         to: '/dashboard/deliveries', hue: 'from-emerald-400 to-cyan-400' },
    { key: 'stock',     title: 'Stock Items',icon: Boxes,         to: '/dashboard/stock',      hue: 'from-amber-400 to-orange-400' },
    { key: 'lowStock',  title: 'Low Stock',  icon: AlertTriangle, to: '/dashboard/stock?low=1',hue: 'from-rose-400 to-red-400' },
  ];

  return (
    <div className="relative">
      {/* soft animated background */}
      <div className="pointer-events-none absolute -z-10 inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-300/30 to-indigo-300/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-300/30 to-cyan-300/30 blur-3xl animate-pulse" />
      </div>

      {/* header */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tr from-sky-400/30 to-indigo-400/30 blur-2xl" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
              Welcome{fullName ? `, ${fullName.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-slate-500 text-sm">Here’s a quick snapshot of your inventory system.</p>
          </div>
          <button onClick={fetchCounts} className="pill bg-slate-900/90 text-white hover:bg-slate-900">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {err}
        </div>
      )}

      {/* metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(c => (
          <MetricCard
            key={c.key}
            title={c.title}
            value={counts[c.key]}
            to={c.to}
            icon={c.icon}
            hue={c.hue}
            loading={loading}
            alert={c.key === 'lowStock' && (counts.lowStock || 0) > 0}
          />
        ))}
      </div>

      {/* you can add more sections later (recent deliveries, top products, etc.) */}
    </div>
  );
}

/* ---------- card ---------- */
function MetricCard({ title, value, to, icon: Icon, hue, loading, alert }) {
  return (
    <Link to={to} className="group relative block overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm hover:shadow-md transition">
      {/* glow */}
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-tr ${hue} opacity-20 blur-2xl transition group-hover:opacity-40`} />
      <div className="flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white">
          <Icon size={18}/>
        </div>
        <ArrowUpRight className="text-slate-400 group-hover:text-slate-600 transition" />
      </div>
      <div className="mt-4">
        <div className="text-slate-600 text-sm">{title}</div>
        <div className={`mt-1 text-3xl font-bold ${alert ? 'text-rose-600' : 'text-slate-900'}`}>
          {loading ? '—' : value ?? '—'}
        </div>
        {alert && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-[12px] text-rose-700">
            <AlertTriangle size={14}/> Attention needed
          </div>
        )}
      </div>
    </Link>
  );
}