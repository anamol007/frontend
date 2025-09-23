// src/pages/Summary.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { RefreshCw, Download, Printer, Eye } from 'lucide-react';

/* ---------------------------------- utils ---------------------------------- */
const nfInt = new Intl.NumberFormat();
const nfMoney = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function sum(arr, pick) { return arr.reduce((t, x) => t + (typeof pick === 'function' ? pick(x) : (x[pick] ?? 0)), 0); }
function toCSV(rows, headers) {
  const head = headers.map(h => `"${h.label}"`).join(',');
  const body = rows.map(r => headers
    .map(h => JSON.stringify(h.get(r) ?? '').replace(/^"|"$/g,''))
    .join(',')
  ).join('\n');
  return [head, body].join('\n');
}
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
  const [period, setPeriod]     = useState('all'); // daily|weekly|monthly|yearly|all
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');
  const [invFilter, setInvFilter] = useState('');

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
      orders:    sum(salesTotals, 'orders'),
      itemsSold: sum(salesTotals, 'quantity'),
      revenue:   sum(salesTotals, 'revenue'),
      stockQty:  sum(stockTotals, 'totalQuantity'),
      stockItems:sum(stockTotals, 'items'),
    };
  }, [inventories]);

  // Tables data
  const revenueByInventory = useMemo(() => (
    inventories.map(inv => ({
      name: inv.inventoryName,
      orders: Number(inv.sales?.totals?.orders || 0),
      revenue: Number(inv.sales?.totals?.revenue || 0),
    }))
  ), [inventories]);

  const productAgg = useMemo(() => {
    const map = new Map();
    inventories.forEach(inv => {
      (inv.sales?.byProduct || []).forEach(row => {
        const key = row.productId;
        const cur = map.get(key) || { productId: key, name: row.productName || `#${key}`, revenue: 0, qty: 0, orders: 0 };
        cur.revenue += Number(row.revenue || 0);
        cur.qty     += Number(row.quantitySold || 0);
        cur.orders  += Number(row.orders || 0);
        map.set(key, cur);
      });
    });
    const all = Array.from(map.values());
    const byRevenue = [...all].sort((a,b)=>b.revenue-a.revenue).slice(0,10);
    const byQty     = [...all].sort((a,b)=>b.qty-a.qty).slice(0,10);
    return { byRevenue, byQty, all };
  }, [inventories]);

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

  const stockByInventory = useMemo(() => (
    inventories.map(inv => ({
      name: inv.inventoryName,
      qty: Number(inv.stock?.totals?.totalQuantity || 0),
    }))
  ), [inventories]);

  // CSV export (top products combined)
  function exportCSV() {
    const rows = productAgg.all;
    const headers = [
      { label: 'Product', get: r => r.name },
      { label: 'Orders',  get: r => r.orders },
      { label: 'Items Sold', get: r => r.qty },
      { label: 'Revenue', get: r => r.revenue },
    ];
    const blob = new Blob([toCSV(rows, headers)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `summary_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Print & Preview
  function printPage() { window.print(); }
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
  *{box-sizing:border-box}
  body{margin:0;padding:24px;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial}
  .wrap{max-width:1000px;margin:0 auto}
  .muted{color:#64748b}
  .mono{font-variant-numeric:tabular-nums}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:14px}
  .brand{font-weight:700;font-size:18px;letter-spacing:.2px}
  .sub{font-size:12px;color:#64748b}
  .chip{display:inline-block;font-size:11px;border:1px solid #e2e8f0;border-radius:999px;padding:2px 8px;margin-left:6px}
  table{width:100%;border-collapse:collapse;margin:14px 0}
  caption{caption-side:top;text-align:left;font-weight:600;margin-bottom:6px}
  colgroup col.num{width:120px}
  th,td{border:1px solid #e2e8f0;padding:8px;font-size:12px}
  th{background:#f8fafc;text-align:left;color:#475569;position:sticky;top:0}
  td.num, th.num{text-align:right}
  tbody tr:nth-child(odd){background:#ffffff}
  tbody tr:nth-child(even){background:#f9fafb}
  tbody tr:hover{background:#eef2ff}
  tfoot td{background:#eef2ff;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:8px;margin:14px 0}
  .cell{border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#ffffff}
  .cell .t{font-size:11px;color:#64748b;margin-bottom:4px}
  .cell .v{font-weight:700;font-size:16px}
  .section{margin-top:18px}
  .hr{height:1px;background:#e2e8f0;margin:18px 0}
  @media print{ .pagebreak{page-break-before:always} body{padding:0} }
</style>
</head>
<body>
<div class="wrap">${previewRef.current.innerHTML}</div>
<script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  const mergedSales = useMemo(() => {
    const m = new Map();
    inventories.forEach(inv => {
      (inv.sales?.byProduct || []).forEach(s => {
        const unitName = (s?.unit && s.unit.name) ? ` (${s.unit.name})` : '';
        const name = (s?.productName ? s.productName : `#${s?.productId}`) + unitName;
        const prev = m.get(name) || { qty: 0, orders: 0, revenue: 0 };
        prev.qty     += Number(s?.quantitySold || 0);
        prev.orders  += Number(s?.orders || 0);
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
      {/* print helpers */}
      <style>{`
        @media print { .no-print { display:none!important } .print-card { break-inside: avoid } }
      `}</style>

      {/* Header / Filters (sleek) */}
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 backdrop-blur shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Summary</h1>
            {data?.range && (
              <p className="text-xs text-slate-500 mt-1">
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

        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      </div>

      {/* KPIs as a compact table */}
      <TableCard title="Summary KPIs">
        <div className="overflow-x-auto">
          <table className="min-w-[520px] text-sm">
            <thead className="text-left uppercase text-xs text-slate-600 sticky top-0">
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
                <th className="p-2">Metric</th>
                <th className="p-2">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <Row name="Orders"         value={nfInt.format(kpis.orders)} />
              <Row name="Items Sold"     value={nfInt.format(kpis.itemsSold)} />
              <Row name="Revenue"        value={nfMoney.format(kpis.revenue)} />
              <Row name="Stock Quantity" value={nfInt.format(kpis.stockQty)} />
              <Row name="Stock Items"    value={nfInt.format(kpis.stockItems)} />
              <Row name="Inventories"    value={inventories.length} />
            </tbody>
          </table>
        </div>
      </TableCard>

      {/* Revenue by inventory */}
      <SmartTable
        title="Revenue by Inventory"
        cols={[
          { key:'name', label:'Inventory', align:'left' },
          { key:'orders', label:'Orders', align:'right', fmt:(v)=>nfInt.format(v) },
          { key:'revenue', label:'Revenue', align:'right', fmt:(v)=>nfMoney.format(v) },
        ]}
        rows={revenueByInventory}
        totals={[
          { label:'Total', align:'left' },
          { value:nfInt.format(kpis.orders), align:'right' },
          { value:nfMoney.format(kpis.revenue), align:'right' },
        ]}
      />

      {/* Top products */}
      <SmartTable
        title="Top 10 Products by Revenue"
        subtitle="Across all visible inventories"
        cols={[
          { key:'name', label:'Product', align:'left' },
          { key:'orders', label:'Orders', align:'right', fmt:nfInt.format.bind(nfInt) },
          { key:'qty', label:'Items Sold', align:'right', fmt:nfInt.format.bind(nfInt) },
          { key:'revenue', label:'Revenue', align:'right', fmt:nfMoney.format.bind(nfMoney) },
        ]}
        rows={productAgg.byRevenue}
      />

      <SmartTable
        title="Top 10 Products by Items Sold"
        cols={[
          { key:'name', label:'Product', align:'left' },
          { key:'qty', label:'Items Sold', align:'right', fmt:nfInt.format.bind(nfInt) },
          { key:'orders', label:'Orders', align:'right', fmt:nfInt.format.bind(nfInt) },
          { key:'revenue', label:'Revenue', align:'right', fmt:nfMoney.format.bind(nfMoney) },
        ]}
        rows={productAgg.byQty}
      />

      {/* Stock by inventory */}
      <SmartTable
        title="Stock by Inventory"
        cols={[
          { key:'name', label:'Inventory', align:'left' },
          { key:'qty', label:'Stock Quantity', align:'right', fmt:nfInt.format.bind(nfInt) },
        ]}
        rows={stockByInventory}
        totals={[
          { label:'Total', align:'left' },
          { value:nfInt.format(kpis.stockQty), align:'right' },
        ]}
      />

      {/* Per-inventory details */}
      {inventories.map(inv => (
        <div key={inv.inventoryId} className="space-y-4">
          <div className="text-slate-900 font-medium">{inv.inventoryName}</div>

          <SmartTable
            title="Sales by Product"
            cols={[
              { key:'_name', label:'Product (Unit)', align:'left' },
              { key:'quantitySold', label:'Quantity', align:'right', fmt:(n)=>nfInt.format(Number(n||0)) },
              { key:'orders', label:'Orders', align:'right', fmt:(n)=>nfInt.format(Number(n||0)) },
              { key:'revenue', label:'Revenue', align:'right', fmt:(n)=>Number(n||0).toFixed(2) },
            ]}
            rows={(inv.sales?.byProduct || []).map(s => {
              const unitName = (s?.unit && s.unit.name) ? ` (${s.unit.name})` : '';
              return { ...s, _name: (s?.productName ? s.productName : `#${s?.productId}`) + unitName };
            })}
            totals={[
              { label:'Total', align:'left' },
              { value:nfInt.format(Number(inv.sales?.totals?.quantity || 0)), align:'right' },
              { value:nfInt.format(Number(inv.sales?.totals?.orders || 0)), align:'right' },
              { value:Number(inv.sales?.totals?.revenue || 0).toFixed(2), align:'right' },
            ]}
          />

          <SmartTable
            title="Stock by Product"
            cols={[
              { key:'_name', label:'Product (Unit)', align:'left' },
              { key:'stockQuantity', label:'Stock Quantity', align:'right', fmt:(n)=>nfInt.format(Number(n||0)) },
            ]}
            rows={(inv.stock?.byProduct || []).map(s => {
              const unitName = (s?.unit && s.unit.name) ? ` (${s.unit.name})` : '';
              return { ...s, _name: (s?.productName ? s.productName : `#${s?.productId}`) + unitName };
            })}
            totals={[
              { label:'Total', align:'left' },
              { value:nfInt.format(Number(inv.stock?.totals?.totalQuantity || 0)), align:'right' },
            ]}
          />
        </div>
      ))}

      {loading && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm grid place-items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}

      {/* ======= Numbers-only Receipt Preview ======= */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Summary (Tables)</div>
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
                {/* Mirror of main tables with print CSS baked in (from printPreview) */}
                <div className="hdr">
                  <div>
                    <div className="brand">Inventory Console</div>
                    <div className="sub">Summary Receipt</div>
                  </div>
                  <div className="sub">
                    <span className="chip">Period: {period}</span>
                    {invFilter ? <span className="chip">Inventory ID: {invFilter}</span> : null}
                    <span className="chip">Generated: {nowStr}</span>
                  </div>
                </div>
                {/* Keep preview light; we reuse the printStyles injected in the new tab */}
                <div>Use the **Print / Save PDF** button above.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- UI bits --------------------------------- */
function Row({ name, value }) {
  return (
    <tr className="hover:bg-indigo-50/40 transition">
      <td className="p-2 text-slate-700">{name}</td>
      <td className="p-2 font-medium text-slate-900">{value}</td>
    </tr>
  );
}

function TableCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur shadow-sm print-card">
      <div className="mb-2">
        <div className="text-slate-900 font-medium">{title}</div>
      </div>
      {children}
    </div>
  );
}

function SmartTable({ title, subtitle, cols, rows, totals }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm print-card">
      <div className="flex items-center justify-between px-4 pt-3">
        <div>
          <div className="text-slate-900 font-medium">{title}</div>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 text-left uppercase text-xs text-slate-600">
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
              {cols.map((c,i)=>(
                <th key={i} className={`p-2 ${c.align==='right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows && rows.length ? rows.map((r,idx)=>(
              <tr key={idx} className="odd:bg-white even:bg-slate-50/40 hover:bg-indigo-50/40 transition">
                {cols.map((c,i)=>(
                  <td key={i} className={`p-2 ${c.align==='right' ? 'text-right tabular-nums' : 'text-left'}`}>
                    {c.fmt ? (typeof c.fmt === 'function' ? c.fmt(r[c.key]) : c.fmt.format(r[c.key])) : r[c.key]}
                  </td>
                ))}
              </tr>
            )) : (
              <tr><td className="p-3 text-slate-500" colSpan={cols.length}>No rows to display.</td></tr>
            )}
          </tbody>
          {!!totals && totals.length > 0 && (
            <tfoot>
              <tr className="bg-indigo-50/70">
                {totals.map((t,i)=>(
                  <td key={i} className={`p-2 font-semibold ${t.align==='right' ? 'text-right' : 'text-left'}`}>
                    {t.label ?? t.value}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}