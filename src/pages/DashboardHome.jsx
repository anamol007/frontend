// src/pages/DashboardHome.jsx
import { useEffect, useMemo, useState } from 'react';
import { api, fetchLowStock } from '../utils/api';
import { Link } from 'react-router-dom';
import { Users, Package, ClipboardList, Boxes, AlertTriangle, Clock, BarChart2, Zap } from 'lucide-react';

/**
 * DashboardHome — modern, denser layout with:
 * - Top tiles
 * - Recent purchases
 * - Low stock table
 * - Trends (sparklines)
 *
 * Dates formatted as: 1st Jan, 2024
 */

/* ----------------------------- format helpers ----------------------------- */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtPrettyDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(+d)) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${ordinal(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function nf(n) { return (typeof n === 'number') ? n.toLocaleString() : (n ?? '—'); }
function money(n) { return (typeof n === 'number') ? n.toFixed(2) : (n ?? '—'); }

/* ------------------------------ Sparkline -------------------------------- */
function Sparkline({ data = [], height = 32, width = 120 }) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return '';
    const mx = Math.max(...data);
    const mn = Math.min(...data);
    const range = mx - mn || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - ((v - mn) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  }, [data, height, width]);

  if (!points) return <div className="h-[32px] w-[120px] flex items-center justify-center text-xs text-slate-400">no data</div>;

  const latest = data[data.length - 1];
  const avg = data.reduce((s, n) => s + n, 0) / (data.length || 1);
  const stroke = latest >= avg ? 'rgb(34 197 94)' : 'rgb(239 68 68)';

  return (
    <svg width={width} height={height} className="block">
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------- tiles list ------------------------------- */
const tiles = [
  { key:'users', label:'Users', icon:Users, to:'/dashboard/users', grad:'from-indigo-400 to-indigo-200' },
  { key:'products', label:'Products', icon:Package, to:'/dashboard/products', grad:'from-pink-400 to-pink-200' },
  { key:'deliveries', label:'Deliveries', icon:ClipboardList, to:'/dashboard/deliveries', grad:'from-teal-400 to-emerald-200' },
  { key:'stock', label:'Stock Items', icon:Boxes, to:'/dashboard/stock', grad:'from-amber-400 to-yellow-200' },
  { key:'lowstock', label:'Low Stock', icon:AlertTriangle, to:'/dashboard/stock', grad:'from-rose-400 to-rose-200' },
];

/* ----------------------------- main component ----------------------------- */
export default function DashboardHome() {
  const [counts, setCounts] = useState({});
  const [lowStock, setLowStock] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [trends, setTrends] = useState({ sales: [], stock: [], deliveries: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function fetchDashboardData() {
    setLoading(true);
    setErr('');
    try {
      const [uRes, pRes, dRes, sRes, lowRes, purchasesRes, trendsRes] = await Promise.all([
        api.get('/users').catch(()=>({ data: [] })),
        api.get('/products').catch(()=>({ data: [] })),
        api.get('/deliveries').catch(()=>({ data: [] })),
        api.get('/stock').catch(()=>({ data: [] })),
        fetchLowStock().catch(()=>([])),
        api.get('/purchases', { params: { page: 1, limit: 6 } }).catch(()=>({ data: { data: [] } })),
        api.get('/analytics/trends').catch(()=>({ data: { sales: [], stock: [], deliveries: [] } })),
      ]);

      const arr = x => (x?.data?.data ?? x?.data) || [];
      const users = arr(uRes), products = arr(pRes), deliveries = arr(dRes), stock = arr(sRes);
      const low = Array.isArray(lowRes) ? lowRes : ((lowRes?.data?.data ?? lowRes?.data) || []);
      const purchases = (purchasesRes?.data?.data) || (purchasesRes?.data) || [];

      setCounts({
        users: users.length,
        products: products.length,
        deliveries: deliveries.length,
        stock: stock.length,
        lowstock: Array.isArray(low) ? low.length : (low?.length ?? 0),
      });

      setLowStock(Array.isArray(low) ? low.slice(0,8) : []);
      setRecentPurchases(Array.isArray(purchases) ? purchases.slice(0,6) : []);

      const trendsData = trendsRes?.data ?? { sales: [], stock: [], deliveries: [] };
      setTrends({
        sales: trendsData.sales?.slice(-12) || [],
        stock: trendsData.stock?.slice(-12) || [],
        deliveries: trendsData.deliveries?.slice(-12) || [],
      });
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDashboardData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500 mt-1">High level snapshot — actionable insights at a glance.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={()=>fetchDashboardData()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-white">
            <Clock size={16}/> Refresh
          </button>
          <Link to="/dashboard/create" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">
            Create
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiles.map(t => (
          <Link key={t.key} to={t.to}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between hover:shadow-lg transition-all duration-200">
            <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${t.grad} opacity-0 group-hover:opacity-30 transition`} />
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-white">
                <t.icon size={18} />
              </div>
              <div className="text-slate-700 font-medium">{t.label}</div>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div className="text-3xl font-bold text-slate-900">{nf(counts[t.key] ?? 0)}</div>
              <div className="text-xs text-slate-500">details →</div>
            </div>

            <div className="mt-3">
              {t.key === 'stock' && <Sparkline data={trends.stock} />}
              {t.key === 'deliveries' && <Sparkline data={trends.deliveries} />}
              {t.key === 'products' && <Sparkline data={trends.sales} />}
              {t.key === 'users' && <Sparkline data={Array.from({length:8},(_,i)=>Math.floor(Math.random()*10 + 10))} />}
              {t.key === 'lowstock' && <Sparkline data={Array.from({length:6},(_,i)=>Math.floor(Math.random()*5 + 1))} />}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium text-slate-900">Recent Purchases</div>
              <Link to="/dashboard/purchases" className="text-sm text-slate-600">View all</Link>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_,i)=> <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />)}
                </div>
              ) : recentPurchases.length === 0 ? (
                <div className="text-sm text-slate-500 p-4">No purchases yet.</div>
              ) : (
                recentPurchases.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 border-b last:border-b-0 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium truncate">{p.supplier?.name || p.supplierName || `#${p.id}`}</div>
                        <div className="text-xs text-slate-400">{p.inventory?.inventoryName || p.inventory?.name || ''}</div>
                      </div>
                      <div className="text-xs text-slate-500 truncate">{p.billNumber ? `Bill: ${p.billNumber}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${money(p.grandTotal ?? p.total ?? p.subTotal ?? 0)}</div>
                      <div className="text-xs text-slate-400">{fmtPrettyDate(p.purchaseDate || p.createdAt || p.updatedAt || Date.now())}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium text-slate-900">Low Stock</div>
              <Link to="/dashboard/stock" className="text-sm text-slate-600">Manage</Link>
            </div>

            <div className="mt-3">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_,i)=> <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />)}
                </div>
              ) : lowStock.length === 0 ? (
                <div className="text-sm text-slate-500 p-4">No low stock items.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 text-left">
                    <tr>
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Inventory</th>
                      <th className="pb-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2">{it.product?.productName || it.productName || `#${it.productId}`}</td>
                        <td className="py-2 text-slate-600">{it.inventory?.inventoryName || it.inventoryName || '-'}</td>
                        <td className="py-2 text-right font-medium text-rose-600">{nf(it.stockQuantity ?? it.quantity ?? it.stock ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium text-slate-900">Trends</div>
              <div className="text-xs text-slate-500">Last points</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Sales</div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-semibold">{nf(trends.sales.slice(-1)[0] ?? 0)}</div>
                  <Sparkline data={trends.sales} />
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Stock</div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-semibold">{nf(trends.stock.slice(-1)[0] ?? 0)}</div>
                  <Sparkline data={trends.stock} />
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Deliveries</div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-semibold">{nf(trends.deliveries.slice(-1)[0] ?? 0)}</div>
                  <Sparkline data={trends.deliveries} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium text-slate-900">Quick Links</div>
              <div className="text-xs text-slate-500">Shortcuts</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Link to="/dashboard/products" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
                <BarChart2 size={16}/> Products
              </Link>
              <Link to="/dashboard/stock" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
                <Zap size={16}/> Manage Stock
              </Link>
              <Link to="/dashboard/purchases" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
                <ClipboardList size={16}/> Purchases
              </Link>
              <Link to="/dashboard/deliveries" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
                <ClipboardList size={16}/> Deliveries
              </Link>
            </div>
          </div>
        </div>
      </div>

      {err && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
    </div>
  );
}