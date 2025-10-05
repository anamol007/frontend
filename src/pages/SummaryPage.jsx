// src/pages/Summary.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { RefreshCw, Printer, Eye, Download } from 'lucide-react';

/* ---------------------------------- utils ---------------------------------- */
const nfInt = new Intl.NumberFormat();
const nfMoney = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function sum(arr, pick) {
  return arr.reduce((t, x) => t + (typeof pick === 'function' ? pick(x) : (x[pick] ?? 0)), 0);
}

// Ordinal + pretty date: 1st Jan, 2025
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtPrettyDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (isNaN(+d)) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${ordinal(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}
function fmtDateRange(range) {
  if (!range) return '—';
  return `${fmtPrettyDate(range.start)} — ${fmtPrettyDate(range.end)}`;
}

/* ------------------------------ page component ----------------------------- */
export default function Summary() {
  const [period, setPeriod]       = useState('all'); // daily|weekly|monthly|yearly|all
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');
  const [invFilter, setInvFilter] = useState('');

  // Receipt preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef(null);

  async function fetchSummary(p = period, inv = '') {
    try {
      setLoading(true); setErr('');
      // Change to '/api/summary' if your backend is mounted under /api
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
  const rangeStr = fmtDateRange(data?.range);
  const nowStr = useMemo(() => fmtPrettyDate(new Date()), []);

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
      inventoryId: inv.inventoryId,
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
      inventoryId: inv.inventoryId,
      name: inv.inventoryName,
      qty: Number(inv.stock?.totals?.totalQuantity || 0),
    }))
  ), [inventories]);

  /* --------------------------- Receipt (data-driven) ------------------------ */
  function buildReceiptHTML() {
    const kpiRows = [
      ['Orders', nfInt.format(kpis.orders)],
      ['Items Sold', nfInt.format(kpis.itemsSold)],
      ['Revenue', nfMoney.format(kpis.revenue)],
      ['Stock Quantity', nfInt.format(kpis.stockQty)],
      ['Stock Items', nfInt.format(kpis.stockItems)],
      ['Inventories', String(inventories.length)],
    ].map(([k,v]) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`).join('');

    const revenueRows = revenueByInventory.map(r => `
      <tr><td>${r.name}</td><td class="num">${nfInt.format(r.orders)}</td><td class="num">${nfMoney.format(r.revenue)}</td></tr>
    `).join('') || `<tr><td colspan="3" class="muted">No data</td></tr>`;

    const topRevRows = productAgg.byRevenue.map((r, idx) => `
      <tr><td>${idx+1}</td><td>${r.name}</td><td class="num">${nfInt.format(r.orders)}</td><td class="num">${nfInt.format(r.qty)}</td><td class="num">${nfMoney.format(r.revenue)}</td></tr>
    `).join('') || `<tr><td colspan="5" class="muted">No data</td></tr>`;

    const topQtyRows = productAgg.byQty.map((r, idx) => `
      <tr><td>${idx+1}</td><td>${r.name}</td><td class="num">${nfInt.format(r.qty)}</td><td class="num">${nfInt.format(r.orders)}</td><td class="num">${nfMoney.format(r.revenue)}</td></tr>
    `).join('') || `<tr><td colspan="5" class="muted">No data</td></tr>`;

    const stockInvRows = stockByInventory.map(r => `
      <tr><td>${r.name}</td><td class="num">${nfInt.format(r.qty)}</td></tr>
    `).join('') || `<tr><td colspan="2" class="muted">No data</td></tr>`;

    const perInventoryBlocks = inventories.map(inv => {
      const salesRows = (inv.sales?.byProduct || []).map(s => `
        <tr>
          <td>${(s.productName || `#${s.productId}`)}${s?.unit?.name ? ` (${s.unit.name})` : ''}</td>
          <td class="num">${nfInt.format(Number(s.quantitySold || 0))}</td>
          <td class="num">${nfInt.format(Number(s.orders || 0))}</td>
          <td class="num">${nfMoney.format(Number(s.revenue || 0))}</td>
        </tr>
      `).join('') || `<tr><td colspan="4" class="muted">No rows</td></tr>`;

      const stockRows = (inv.stock?.byProduct || []).map(s => `
        <tr>
          <td>${(s.productName || `#${s.productId}`)}${s?.unit?.name ? ` (${s.unit.name})` : ''}</td>
          <td class="num">${nfInt.format(Number(s.stockQuantity || 0))}</td>
        </tr>
      `).join('') || `<tr><td colspan="2" class="muted">No rows</td></tr>`;

      return `
        <div class="section">
          <div class="h3">${inv.inventoryName}</div>

          <table>
            <caption>Sales by Product</caption>
            <thead><tr><th>Product (Unit)</th><th class="num">Qty</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
            <tbody>${salesRows}</tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="num">${nfInt.format(Number(inv.sales?.totals?.quantity || 0))}</td>
                <td class="num">${nfInt.format(Number(inv.sales?.totals?.orders || 0))}</td>
                <td class="num">${nfMoney.format(Number(inv.sales?.totals?.revenue || 0))}</td>
              </tr>
            </tfoot>
          </table>

          <table>
            <caption>Stock by Product</caption>
            <thead><tr><th>Product (Unit)</th><th class="num">Stock Qty</th></tr></thead>
            <tbody>${stockRows}</tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="num">${nfInt.format(Number(inv.stock?.totals?.totalQuantity || 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }).join('');

    return `
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
  h2.h2{font-size:14px;margin:14px 0 6px 0}
  .h3{font-weight:600;margin:10px 0 6px 0}
  table{width:100%;border-collapse:collapse;margin:14px 0}
  th,td{border:1px solid #e2e8f0;padding:8px;font-size:12px}
  th{background:#f8fafc;text-align:left;color:#475569}
  td.num, th.num{text-align:right}
  tbody tr:nth-child(odd){background:#ffffff}
  tbody tr:nth-child(even){background:#f9fafb}
  tbody tr:hover{background:#eef2ff}
  tfoot td{background:#eef2ff;font-weight:700}
  @media print{ .pagebreak{page-break-before:always} body{padding:0} }
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div>
      <div class="brand">Inventory Console</div>
      <div class="sub">Summary Receipt</div>
    </div>
    <div class="sub">
      <span class="chip">Period: ${period}</span>
      ${invFilter ? `<span class="chip">Inventory ID: ${invFilter}</span>` : ''}
      <span class="chip">Generated: ${nowStr}</span>
    </div>
  </div>

  <div class="sub">Range: ${rangeStr}</div>

  <h2 class="h2">KPIs</h2>
  <table>
    <thead><tr><th>Metric</th><th class="num">Value</th></tr></thead>
    <tbody>${kpiRows}</tbody>
  </table>

  <h2 class="h2">Revenue by Inventory</h2>
  <table>
    <thead><tr><th>Inventory</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
    <tbody>${revenueRows}</tbody>
    <tfoot>
      <tr><td>Total</td><td class="num">${nfInt.format(kpis.orders)}</td><td class="num">${nfMoney.format(kpis.revenue)}</td></tr>
    </tfoot>
  </table>

  <h2 class="h2">Top 10 Products by Revenue</h2>
  <table>
    <thead><tr><th>#</th><th>Product</th><th class="num">Orders</th><th class="num">Items Sold</th><th class="num">Revenue</th></tr></thead>
    <tbody>${topRevRows}</tbody>
  </table>

  <h2 class="h2">Top 10 Products by Items Sold</h2>
  <table>
    <thead><tr><th>#</th><th>Product</th><th class="num">Items Sold</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
    <tbody>${topQtyRows}</tbody>
  </table>

  <h2 class="h2">Stock by Inventory</h2>
  <table>
    <thead><tr><th>Inventory</th><th class="num">Stock Quantity</th></tr></thead>
    <tbody>${stockInvRows}</tbody>
    <tfoot><tr><td>Total</td><td class="num">${nfInt.format(kpis.stockQty)}</td></tr></tfoot>
  </table>

  <div class="pagebreak"></div>

  ${perInventoryBlocks}
</div>
<script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
  }

  function openPreview() { setPreviewOpen(true); }
  function printPreview() {
    const w = window.open('', '_blank');
    if (!w) return;
    const html = buildReceiptHTML();
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /* ----------------------------- Excel export (commented) ------------------- */
  // NOTE: You asked to keep the Excel export code but comment it out.
  // To enable later: remove the block comments and `npm i xlsx`
  //
  // async function exportOneExcel() {
  //   let XLSX;
  //   try {
  //     XLSX = await import('xlsx'); // make sure: npm i xlsx
  //   } catch (e) {
  //     alert('Excel export requires "xlsx". Run: npm i xlsx');
  //     console.error(e);
  //     return;
  //   }
  //
  //   const rows = [];
  //   const push = (r) => rows.push(r);
  //   const blank = () => rows.push([]);
  //
  //   // Header/meta
  //   push(['Inventory Console — Summary']);
  //   push([`Period: ${period}`, `Range: ${rangeStr}`, invFilter ? `Inventory ID: ${invFilter}` : '', `Generated: ${nowStr}`]);
  //   blank();
  //
  //   // KPIs
  //   push(['KPIs']);
  //   push(['Metric', 'Value']);
  //   push(['Orders', kpis.orders]);
  //   push(['Items Sold', kpis.itemsSold]);
  //   push(['Revenue', Number(kpis.revenue)]);
  //   push(['Stock Quantity', kpis.stockQty]);
  //   push(['Stock Items', kpis.stockItems]);
  //   push(['Inventories', inventories.length]);
  //   blank();
  //
  //   // Revenue by Inventory
  //   push(['Revenue by Inventory']);
  //   push(['Inventory ID', 'Inventory', 'Orders', 'Revenue']);
  //   revenueByInventory.forEach(r => push([r.inventoryId, r.name, r.orders, Number(r.revenue)]));
  //   push(['Total', '', kpis.orders, Number(kpis.revenue)]);
  //   blank();
  //
  //   // Top 10 by Revenue
  //   push(['Top 10 Products by Revenue']);
  //   push(['#', 'Product ID', 'Product', 'Orders', 'Items Sold', 'Revenue']);
  //   productAgg.byRevenue.forEach((r, idx) => push([idx+1, r.productId, r.name, r.orders, r.qty, Number(r.revenue)]));
  //   blank();
  //
  //   // Top 10 by Items Sold
  //   push(['Top 10 Products by Items Sold']);
  //   push(['#', 'Product ID', 'Product', 'Items Sold', 'Orders', 'Revenue']);
  //   productAgg.byQty.forEach((r, idx) => push([idx+1, r.productId, r.name, r.qty, r.orders, Number(r.revenue)]));
  //   blank();
  //
  //   // Stock by Inventory
  //   push(['Stock by Inventory']);
  //   push(['Inventory ID', 'Inventory', 'Stock Quantity']);
  //   stockByInventory.forEach(r => push([r.inventoryId, r.name, r.qty]));
  //   push(['Total', '', kpis.stockQty]);
  //   blank();
  //
  //   // Per-inventory detailed sections
  //   inventories.forEach(inv => {
  //     push([inv.inventoryName]);
  //     // Sales by Product
  //     push(['Sales by Product']);
  //     push(['Product ID', 'Product', 'Unit', 'Quantity', 'Orders', 'Revenue']);
  //     (inv.sales?.byProduct || []).forEach(s => {
  //       push([
  //         s.productId,
  //         s.productName,
  //         s?.unit?.name || '',
  //         Number(s.quantitySold || 0),
  //         Number(s.orders || 0),
  //         Number(s.revenue || 0),
  //       ]);
  //     });
  //     push(['Total (Sales)', '', '', Number(inv.sales?.totals?.quantity || 0), Number(inv.sales?.totals?.orders || 0), Number(inv.sales?.totals?.revenue || 0)]);
  //     blank();
  //
  //     // Stock by Product
  //     push(['Stock by Product']);
  //     push(['Product ID', 'Product', 'Unit', 'Stock Quantity']);
  //     (inv.stock?.byProduct || []).forEach(s => {
  //       push([
  //         s.productId,
  //         s.productName,
  //         s?.unit?.name || '',
  //         Number(s.stockQuantity || 0),
  //       ]);
  //     });
  //     push(['Total (Stock)', '', '', Number(inv.stock?.totals?.totalQuantity || 0)]);
  //     blank();
  //     blank();
  //   });
  //
  //   const ws = XLSX.utils.aoa_to_sheet(rows);
  //   ws['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  //   const wb = XLSX.utils.book_new();
  //   XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  //   XLSX.writeFile(wb, `summary_${period}.xlsx`);
  // }

  // Keep Download icon referenced (so ESLint won't flag unused import when export is commented)
  // eslint-disable-next-line no-unused-vars
  const __keepDownloadIcon = Download;

  /* ----------------------------------- UI ----------------------------------- */
  return (
    <div className="space-y-6">
      {/* print helpers */}
      <style>{`
        @media print { .no-print { display:none!important } .print-card { break-inside: avoid } }
      `}</style>

      {/* Header / Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 backdrop-blur shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Summary</h1>
            {data?.range && (
              <p className="text-xs text-slate-500 mt-1">Range: {fmtDateRange(data.range)}</p>
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

            <button
              onClick={() => fetchSummary(period, invFilter)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16}/> Refresh
            </button>

            {/* Excel Export button intentionally commented out (kept for later use)
            <button onClick={exportOneExcel}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-700 hover:bg-indigo-100 font-medium">
              <Download size={16}/> Export (Excel)
            </button>
            */}

            <button
              onClick={openPreview}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Eye size={16}/> Preview Receipt
            </button>
            <button
              onClick={printPreview}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Printer size={16}/> Print / Save PDF
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

      {/* ======= Receipt Preview ======= */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Summary Receipt (Preview)</div>
                <div className="text-xs text-slate-500">
                  Period: {period} • Range: {rangeStr}{invFilter ? ` • Inventory ID: ${invFilter}` : ''} • Generated: {nowStr}
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

            <div className="max-h-[70vh] overflow-y-auto p-4" ref={previewRef}>
              <div className="text-sm text-slate-700">
                Preview header only. Use <b>Print / Save PDF</b> for the full receipt.
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