import { useEffect, useState } from 'react';
import { api, fetchLowStock } from '../utils/api';
import { Link } from 'react-router-dom';
import { Users, Package, ClipboardList, Boxes, AlertTriangle } from 'lucide-react';

const tiles = [
  { key:'users', label:'Users', icon:Users, to:'/dashboard/users', grad:'from-indigo-200 to-indigo-50' },
  { key:'products', label:'Products', icon:Package, to:'/dashboard/products', grad:'from-fuchsia-200 to-pink-50' },
  { key:'deliveries', label:'Deliveries', icon:ClipboardList, to:'/dashboard/deliveries', grad:'from-teal-200 to-emerald-50' },
  { key:'stock', label:'Stock Items', icon:Boxes, to:'/dashboard/stock', grad:'from-amber-200 to-yellow-50' },
  { key:'lowstock', label:'Low Stock', icon:AlertTriangle, to:'/dashboard/stock', grad:'from-rose-200 to-rose-50' },
];

export default function DashboardHome(){
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [u,p,d,s,ls] = await Promise.all([
          api.get('/users').catch(()=>({data:[] })),        // arrays expected
          api.get('/products').catch(()=>({data:[] })),
          api.get('/deliveries').catch(()=>({data:[] })),
          api.get('/stock').catch(()=>({data:[] })),
          fetchLowStock().catch(()=>[]),
        ]);
        const arr = (x) => (x?.data?.data ?? x?.data) || [];
        const users = arr(u), prods = arr(p), dels = arr(d), stock = arr(s);
        const low = Array.isArray(ls) ? ls.length : ((ls?.data?.data ?? ls?.data) || []).length;
        if (alive) setCounts({ users:users.length, products:prods.length, deliveries:dels.length, stock:stock.length, lowstock:low });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiles.map(t => (
          <Link key={t.key} to={t.to}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur transition hover:shadow-md">
            <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${t.grad} opacity-0 group-hover:opacity-100 transition`} />
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                <t.icon size={18} />
              </div>
              <div className="text-slate-700">{t.label}</div>
            </div>
            <div className="mt-6 text-3xl font-bold text-slate-900">{counts[t.key] ?? '—'}</div>
            <div className="mt-2 text-xs text-slate-500">View details ↗</div>
          </Link>
        ))}
      </div>
    </div>
  );
}