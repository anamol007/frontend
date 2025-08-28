// src/pages/Summary.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import {
  RefreshCw, Download, Printer, Eye,
  PieChart as PieIcon, BarChart3, TrendingUp, PackageSearch
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';

/* ---------------------------------- utils ---------------------------------- */
const nfInt = new Intl.NumberFormat();
const nfMoney = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function sum(arr, pick) { return arr.reduce((t, x) => t + (typeof pick === 'function' ? pick(x) : (x[pick] ?? 0)), 0); }
function toCSV(rows, headers) {
  const head = headers.map(h => `"${h.label}"`).join(',');
  const body = rows.map(r => headers.map(h => JSON.stringify(h.get(r) ?? '').replace(/^"|"$/g,'')).join(',')).join('\n');
  return [head, body].join('\n');
}
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#84cc16','#f97316','#e11d48','#0ea5e9'];

function fmtDateRange(range) {
  if (!range) return '—';
  const s = range.start ? new Date(range.start) : null;
  const e = range.end ? new Date(range.end) : null;
  if (!s || !e || isNaN(+s) || isNaN(+e)) return '—';
  const fmt = (d) => d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${fmt(s)} — ${fmt(e)}`;
}

/* ------------------------------ page component ----------------------------- */
export default function Summary() {
  const [period, setPeriod] = useState('all'); // daily|weekly|monthly|yearly|all
  const [data, setData] = useState(null);      // /summary payload
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [invFilter, setInvFilter] = useState(''); // inventoryId or '' (all)

  // Receipt preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef(null);

  async function fetchSummary(p = period, inv = '') {
    try {
      setLoading(true); setErr('');
      const res = await api.get('/summary', { params: { period: p, ...(inv ? { inventoryId: inv } : {}) } });
      setData(res?.data?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching summary');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchSummary(period, invFilter); }, [period, invFilter]);

  const inventories = (data?.inventories || []);

  // KPIs
  const kpis = useMemo(() => {
    const salesTotals = inventories.map(i => i.sales?.totals || { orders:0, quantity:0, revenue:0 });
    const stockTotals = inventories.map(i => i.stock?.totals || { totalQuantity:0, items:0 });
    return {
      orders: sum(salesTotals, 'orders'),
      itemsSold: sum(salesTotals, 'quantity'),
      revenue: sum(salesTotals, 'revenue'),
      stockQty: sum(stockTotals, 'totalQuantity'),
      stockItems: sum(stockTotals, 'items'),
    };
  }, [inventories]);

  // Revenue by inventory (bar)
  const revenueByInventory = useMemo(() => {
    return inventories.map(inv => ({
      name: inv.inventoryName,
      revenue: Number(inv.sales?.totals?.revenue || 0),
      orders: Number(inv.sales?.totals?.orders || 0),
    }));
  }, [inventories]);

  // Top products by revenue / items sold
  const productAgg = useMemo(() => {
    const map = new Map();
    inventories.forEach(inv => {
      (inv.sales?.byProduct || []).forEach(row => {
        const key = row.productId;
        const cur = map.get(key) || { productId: key, name: row.productName || `#${key}`, revenue: 0, qty: 0, orders: 0 };
        cur.revenue += Number(row.revenue || 0);
        cur.qty += Number(row.quantitySold || 0);
        cur.orders += Number(row.orders || 0);
        map.set(key, cur);
      });
    });
    const all = Array.from(map.values());
    const byRevenue = [...all].sort((a,b)=>b.revenue-a.revenue).slice(0,10);
    const byQty = [...all].sort((a,b)=>b.qty-a.qty).slice(0,10);
    return { byRevenue, byQty, all };
  }, [inventories]);

  // Stock by product
  const stockAgg = useMemo(() => {
    const map = new Map();
    inventories.forEach(inv => {
      (inv.stock?.byProduct || []).forEach(row => {
        const key = row.productId;
        const cur = map.get(key) || { productId: key, name: row.productName || `#${key}`, qty: 0 };
        cur.qty += Number(row.stockQuantity || 0);
        map.set(key, cur);
      });
    });
    const all = Array.from(map.values());
    const top = [...all].sort((a,b)=>b.qty-a.qty).slice(0,10);
    return { all, top };
  }, [inventories]);

  // Stock quantity by inventory (pie)
  const stockByInventory = useMemo(() => {
    return inventories.map(inv => ({
      name: inv.inventoryName,
      value: Number(inv.stock?.totals?.totalQuantity || 0),
    }));
  }, [inventories]);

  // CSV export
  function exportCSV() {
    const rows = productAgg.all;
    const headers = [
      { label: 'Product', get: r => r.name },
      { label: 'Orders',  get: r => r.orders },
      { label: 'Quantity Sold', get: r => r.qty },
      { label: 'Revenue', get: r => r.revenue },
    ];
    const blob = new Blob([toCSV(rows, headers)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `summary_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Print page (existing)
  function printPage() { window.print(); }

  // Preview modal open/print
  function openPreview() { setPreviewOpen(true); }

  function printPreview() {
    if (!previewRef.current) return;
    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Summary Receipt</title>
<style>
  /* ---- Base ---- */
  *{box-sizing:border-box}
  body{margin:0;padding:24px;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial}
  .wrap{max-width:1000px;margin:0 auto}
  .muted{color:#64748b}
  .mono{font-variant-numeric:tabular-nums}

  /* ---- Header ---- */
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:14px}
  .brand{font-weight:700;font-size:18px;letter-spacing:.2px}
  .sub{font-size:12px;color:#64748b}
  .chip{display:inline-block;font-size:11px;border:1px solid #e2e8f0;border-radius:999px;padding:2px 8px;margin-left:6px}

  /* ---- KPI grid ---- */
  .grid{display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:8px;margin:14px 0}
  .cell{border:1px solid #e2e8f0;border-radius:8px;padding:10px}
  .cell .t{font-size:11px;color:#64748b;margin-bottom:4px}
  .cell .v{font-weight:700;font-size:16px}

  /* ---- Tables ---- */
  table{width:100%;border-collapse:collapse;margin:14px 0}
  caption{caption-side:top;text-align:left;font-weight:600;margin-bottom:6px}
  colgroup col.num{width:120px}
  th,td{border:1px solid #e2e8f0;padding:8px;font-size:12px}
  th{background:#f8fafc;text-align:left;color:#475569}
  td.num, th.num{text-align:right}
  tbody tr:nth-child(even){background:#fafafa}
  tfoot td{background:#f1f5f9;font-weight:700}

  /* ---- Sections ---- */
  .section{margin-top:18px}
  .hr{height:1px;background:#e2e8f0;margin:18px 0}

  /* ---- Print ---- */
  @media print{
    .pagebreak{page-break-before:always}
    body{padding:0}
  }
</style>
</head>
<body>
<div class="wrap">
${previewRef.current.innerHTML}
</div>
<script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  const hasData = inventories.length > 0;

  // Aggregations for preview
  const mergedSales = useMemo(() => {
    const m = new Map();
    inventories.forEach(inv => {
      (inv.sales?.byProduct || []).forEach(s => {
        const unitName = (s?.unit && s.unit.name) ? ` (${s.unit.name})` : '';
        const name = (s?.productName ? s.productName : `#${s?.productId}`) + unitName;
        const prev = m.get(name) || { qty: 0, orders: 0, revenue: 0 };
        prev.qty += Number(s?.quantitySold || 0);
        prev.orders += Number(s?.orders || 0);
        prev.revenue += Number(s?.revenue || 0);
        m.set(name, prev);
      });
    });
    return Array.from(m.entries()).map(([product, v]) => ({ product, ...v }));
  }, [inventories]);

  const mergedStock = useMemo(() => {
    const m = new Map();
    inventories.forEach(inv => {
      (inv.stock?.byProduct || []).forEach(s => {
        const unitName = (s?.unit && s.unit.name) ? ` (${s.unit.name})` : '';
        const name = (s?.productName ? s.productName : `#${s?.productId}`) + unitName;
        const prev = m.get(name) || 0;
        m.set(name, prev + Number(s?.stockQuantity || 0));
      });
    });
    return Array.from(m.entries()).map(([product, qty]) => ({ product, qty }));
  }, [inventories]);

  const nowStr = useMemo(() => new Date().toLocaleString(), []);

  return (
    <div className="space-y-6">
      {/* Print styles to hide controls */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-card { break-inside: avoid; }
        }
      `}</style>

      {/* Header / Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <TrendingUp size={20}/> Summary
            </h1>
            {data?.range && (
              <p className="text-xs text-slate-400 mt-1">
                Range: {new Date(data.range.start).toLocaleString()} — {new Date(data.range.end).toLocaleString()}
              </p>
            )}
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="daily">Daily (today)</option>
              <option value="weekly">Weekly (last 7 days)</option>
              <option value="monthly">Monthly (to date)</option>
              <option value="yearly">Yearly (to date)</option>
              <option value="all">All time</option>
            </select>

            <select
              value={invFilter}
              onChange={e => setInvFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">All inventories</option>
              {(data?.inventories || []).map(i => (
                <option key={i.inventoryId} value={i.inventoryId}>{i.inventoryName}</option>
              ))}
            </select>

            <button onClick={() => fetchSummary(period, invFilter)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100">
              <RefreshCw size={16}/> Refresh
            </button>
            <button onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100">
              <Download size={16}/> Export CSV
            </button>
            <button onClick={openPreview}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100">
              <Eye size={16}/> Preview
            </button>
            <button onClick={printPage}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md">
              <Printer size={16}/> Print
            </button>
          </div>
        </div>

        {(err) && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Orders" value={nfInt.format(kpis.orders)} icon={<PackageSearch className="text-indigo-500" />} />
        <Kpi title="Items Sold" value={nfInt.format(kpis.itemsSold)} icon={<BarChart3 className="text-emerald-500" />} />
        <Kpi title="Revenue" value={nfMoney.format(kpis.revenue)} icon={<TrendingUp className="text-violet-500" />} />
        <Kpi title="Stock (qty / items)" value={`${nfInt.format(kpis.stockQty)} / ${nfInt.format(kpis.stockItems)}`} icon={<PieIcon className="text-sky-500" />} />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Revenue by Inventory" subtitle="Bars show total revenue in the selected period">
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByInventory}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, n) => n === 'revenue' ? nfMoney.format(v) : nfInt.format(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue">
                  {revenueByInventory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Top 10 Products by Revenue" subtitle="Across all visible inventories">
          {productAgg.byRevenue.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productAgg.byRevenue}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end"/>
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v)=>nfMoney.format(v)} />
                <Bar dataKey="revenue" name="Revenue">
                  {productAgg.byRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Stock by Inventory" subtitle="Share of total quantity (pie)">
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={stockByInventory} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {stockByInventory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v)=>nfInt.format(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 Products by Items Sold" subtitle="Quantity across inventories">
          {productAgg.byQty.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productAgg.byQty}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end"/>
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v)=>nfInt.format(v)} />
                <Bar dataKey="qty" name="Items Sold">
                  {productAgg.byQty.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Top 10 Products by Stock" subtitle="Current snapshot of quantities">
          {stockAgg.top.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stockAgg.top}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end"/>
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v)=>nfInt.format(v)} />
                <Bar dataKey="qty" name="Stock Qty">
                  {stockAgg.top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Top products table */}
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur print-card">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Top Products (All Visible)</h3>
            <p className="text-xs text-slate-500">Sorted by revenue, includes orders and quantity.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500 uppercase text-xs">
              <tr>
                <th className="p-2">Product</th>
                <th className="p-2">Orders</th>
                <th className="p-2">Items Sold</th>
                <th className="p-2">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {productAgg.byRevenue.length ? productAgg.byRevenue.map((p) => (
                <tr key={p.productId}>
                  <td className="p-2 text-slate-900">{p.name}</td>
                  <td className="p-2">{nfInt.format(p.orders)}</td>
                  <td className="p-2">{nfInt.format(p.qty)}</td>
                  <td className="p-2 font-medium">{nfMoney.format(p.revenue)}</td>
                </tr>
              )) : (
                <tr><td className="p-3 text-slate-500" colSpan={4}>No products to display.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm grid place-items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}

      {/* ======= Numbers-only Receipt Preview (Improved) ======= */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Summary Receipt (Tables & Numbers)</div>
                <div className="text-xs text-slate-500">
                  Period: {period} • Range: {fmtDateRange(data?.range)}{invFilter ? ` • Inventory ID: ${invFilter}` : ''} • Generated: {nowStr}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printPreview}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable content (styled in print window) */}
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div ref={previewRef}>
                {/* Header in document */}
                <div className="hdr">
                  <div>
                    <div className="brand">Inventory Console</div>
                    <div className="sub">Summary Receipt</div>
                  </div>
                  <div className="sub">
                    Period: <span className="chip">{period}</span>
                    {invFilter ? <span className="chip">Inventory ID: {invFilter}</span> : null}
                    <span className="chip">Generated: {nowStr}</span>
                  </div>
                </div>

                {/* KPI grid */}
                <div className="grid">
                  <div className="cell">
                    <div className="t">Orders</div>
                    <div className="v mono">{nfInt.format(kpis.orders)}</div>
                  </div>
                  <div className="cell">
                    <div className="t">Items Sold</div>
                    <div className="v mono">{nfInt.format(kpis.itemsSold)}</div>
                  </div>
                  <div className="cell">
                    <div className="t">Revenue</div>
                    <div className="v mono">{nfMoney.format(kpis.revenue)}</div>
                  </div>
                  <div className="cell">
                    <div className="t">Stock Quantity</div>
                    <div className="v mono">{nfInt.format(kpis.stockQty)}</div>
                  </div>
                  <div className="cell">
                    <div className="t">Stock Items</div>
                    <div className="v mono">{nfInt.format(kpis.stockItems)}</div>
                  </div>
                  <div className="cell">
                    <div className="t">Inventories</div>
                    <div className="v mono">{inventories.length}</div>
                  </div>
                </div>

                {/* Revenue by inventory */}
                <div className="section">
                  <caption>Revenue by Inventory</caption>
                  <table className="zebra">
                    <colgroup>
                      <col />
                      <col className="num" />
                      <col className="num" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Inventory</th>
                        <th className="num">Orders</th>
                        <th className="num">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByInventory.map((r, i) => (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td className="num mono">{nfInt.format(r.orders)}</td>
                          <td className="num mono">{Number(r.revenue || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="num mono">{nfInt.format(kpis.orders)}</td>
                        <td className="num mono">{Number(kpis.revenue || 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Sales by product */}
                <div className="section">
                  <caption>Sales by Product</caption>
                  <table className="zebra">
                    <colgroup>
                      <col />
                      <col className="num" />
                      <col className="num" />
                      <col className="num" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Product (Unit)</th>
                        <th className="num">Quantity</th>
                        <th className="num">Orders</th>
                        <th className="num">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedSales.map((row, i) => (
                        <tr key={i}>
                          <td>{row.product}</td>
                          <td className="num mono">{nfInt.format(row.qty)}</td>
                          <td className="num mono">{nfInt.format(row.orders)}</td>
                          <td className="num mono">{Number(row.revenue || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stock by product */}
                <div className="section">
                  <caption>Stock by Product</caption>
                  <table className="zebra">
                    <colgroup>
                      <col />
                      <col className="num" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Product (Unit)</th>
                        <th className="num">Stock Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedStock.map((row, i) => (
                        <tr key={i}>
                          <td>{row.product}</td>
                          <td className="num mono">{nfInt.format(row.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total quantity</td>
                        <td className="num mono">{nfInt.format(kpis.stockQty)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Per-inventory details */}
                <div className="hr" />
                {inventories.map((inv, idx) => (
                  <div className={idx > 0 ? 'pagebreak' : ''} key={inv.inventoryId}>
                    <caption>Detail — {inv.inventoryName}</caption>
                    <table className="zebra">
                      <colgroup>
                        <col />
                        <col className="num" />
                        <col className="num" />
                        <col className="num" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Product (Unit)</th>
                          <th className="num">Quantity</th>
                          <th className="num">Orders</th>
                          <th className="num">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(inv.sales?.byProduct || []).map((s, i) => {
                          const unitName = (s?.unit && s.unit.name) ? ` (${s.unit.name})` : '';
                          const nm = (s?.productName ? s.productName : `#${s?.productId}`) + unitName;
                          return (
                            <tr key={i}>
                              <td>{nm}</td>
                              <td className="num mono">{nfInt.format(Number(s?.quantitySold || 0))}</td>
                              <td className="num mono">{nfInt.format(Number(s?.orders || 0))}</td>
                              <td className="num mono">{Number(s?.revenue || 0).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          <td className="num mono">{nfInt.format(Number(inv.sales?.totals?.quantity || 0))}</td>
                          <td className="num mono">{nfInt.format(Number(inv.sales?.totals?.orders || 0))}</td>
                          <td className="num mono">{Number(inv.sales?.totals?.revenue || 0).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    <table className="zebra">
                      <colgroup>
                        <col />
                        <col className="num" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Product (Unit)</th>
                          <th className="num">Stock Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(inv.stock?.byProduct || []).map((s, i) => {
                          const unitName = (s?.unit && s.unit.name) ? ` (${s.unit.name})` : '';
                          const nm = (s?.productName ? s.productName : `#${s?.productId}`) + unitName;
                          return (
                            <tr key={i}>
                              <td>{nm}</td>
                              <td className="num mono">{nfInt.format(Number(s?.stockQuantity || 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          <td className="num mono">{nfInt.format(Number(inv.stock?.totals?.totalQuantity || 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ======= End Receipt Preview ======= */}
    </div>
  );
}

/* ----------------------------- small components ---------------------------- */
function Kpi({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur print-card">
      <div className="flex items-center justify-between">
        <div className="text-slate-500 text-xs font-medium uppercase">{title}</div>
        <div className="opacity-70">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur print-card">
      <div className="mb-2">
        <div className="text-slate-900 font-medium">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      <div className="h-[280px]">{children}</div>
    </div>
  );
}
function EmptyChart() {
  return (
    <div className="h-full grid place-items-center text-slate-400 text-sm">
      No data to visualize.
    </div>
  );
}