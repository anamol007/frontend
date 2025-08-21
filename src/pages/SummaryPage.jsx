// src/pages/SummaryPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Gauge, Package, Banknote, Layers3, RefreshCw, Download } from 'lucide-react';
import { api } from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ---------------- formatting helpers ---------------- */
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const prettyDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const M = dt.toLocaleString(undefined, { month: 'short' });
  const D = ordinal(dt.getDate());
  const Y = dt.getFullYear();
  return `${M} ${D}, ${Y}`;
};
const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------------- PDF (simple A4 report) ---------------- */
function exportPDF({ periodLabel, scopeLabel, range, totals, topProducts, inventories }) {
  const doc = new jsPDF({ unit: 'pt' });
  let y = 40;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Inventory Summary', 40, y); y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(`Scope: ${scopeLabel}`, 40, y); y += 16;
  doc.text(`Period: ${periodLabel} (${prettyDate(range.start)} — ${prettyDate(range.end)})`, 40, y); y += 20;

  // Totals
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Orders', String(totals.orders)],
      ['Qty Sold', String(totals.qty)],
      ['Revenue', `₨ ${money(totals.revenue)}`],
      ['Stock Items', String(totals.stockItems)],
      ['Stock Quantity', String(totals.stockQty)],
    ],
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [17, 24, 39] },
    theme: 'striped',
    margin: { left: 40, right: 40 },
  });
  y = doc.lastAutoTable.finalY + 16;

  // Top products
  if (topProducts.length) {
    autoTable(doc, {
      startY: y,
      head: [['Top Products', 'Qty', 'Unit', 'Revenue']],
      body: topProducts.map(p => [p.name, p.qty, p.unit || '', `₨ ${money(p.revenue)}`]),
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [30, 64, 175] },
      theme: 'striped',
      margin: { left: 40, right: 40 },
    });
    y = doc.lastAutoTable.finalY + 16;
  }

  // Per-inventory brief
  inventories.forEach((inv) => {
    autoTable(doc, {
      startY: y,
      head: [[`${inv.inventoryName}`, 'Orders', 'Qty', 'Revenue', 'Stock Items', 'Stock Qty']],
      body: [[
        '',
        String(inv.sales.totals.orders || 0),
        String(inv.sales.totals.quantity || 0),
        `₨ ${money(inv.sales.totals.revenue || 0)}`,
        String(inv.stock.totals.items || 0),
        String(inv.stock.totals.totalQuantity || 0),
      ]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [16, 185, 129] },
      theme: 'plain',
      margin: { left: 40, right: 40 },
    });
    y = doc.lastAutoTable.finalY + 10;
  });

  doc.save(`summary_${Date.now()}.pdf`);
}

/* ---------------- UI helpers ---------------- */
function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
          <div className="text-lg font-semibold text-slate-900">{value}</div>
          {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
      <div className="mb-2 text-sm font-semibold text-slate-900">{title}</div>
      {children}
    </div>
  );
}

export default function SummaryPage() {
  const [period, setPeriod] = useState('monthly');         // daily | weekly | monthly | yearly | all
  const [selectedInvId, setSelectedInvId] = useState('all');
  const [data, setData] = useState(null);                  // API response .data
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const inventories = data?.inventories || [];

  // Build inventory options from the response itself
  const invOptions = useMemo(() => {
    const opts = inventories.map(i => ({ value: i.inventoryId, label: i.inventoryName }));
    // keep selected if present even when filtered to single
    const hasSel = selectedInvId !== 'all' && !opts.some(o => String(o.value) === String(selectedInvId));
    return hasSel ? [{ value: selectedInvId, label: `Inventory #${selectedInvId}` }, ...opts] : opts;
  }, [inventories, selectedInvId]);

  // Fetch summary from backend summary controller
  async function fetchSummary() {
    try {
      setLoading(true); setErr('');
      const params = { period };
      if (selectedInvId !== 'all') params.inventoryId = selectedInvId;
      const res = await api.get('/summary', { params });
      setData(res?.data?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSummary(); /* eslint-disable-next-line */ }, [period, selectedInvId]);

  // Derived labels
  const periodLabel = useMemo(() => {
    switch (period) {
      case 'daily': return 'Today';
      case 'weekly': return 'This week';
      case 'monthly': return 'This month';
      case 'yearly': return 'This year';
      case 'all': return 'All time';
      default: return period;
    }
  }, [period]);

  const scopeLabel = useMemo(() => {
    if (selectedInvId === 'all') return 'All accessible inventories';
    const found = inventories.find(i => String(i.inventoryId) === String(selectedInvId));
    return found?.inventoryName || `Inventory #${selectedInvId}`;
  }, [selectedInvId, inventories]);

  // Aggregate totals across returned inventories
  const totals = useMemo(() => {
    const t = { orders: 0, qty: 0, revenue: 0, stockItems: 0, stockQty: 0 };
    inventories.forEach(inv => {
      t.orders += Number(inv?.sales?.totals?.orders || 0);
      t.qty += Number(inv?.sales?.totals?.quantity || 0);
      t.revenue += Number(inv?.sales?.totals?.revenue || 0);
      t.stockItems += Number(inv?.stock?.totals?.items || 0);
      t.stockQty += Number(inv?.stock?.totals?.totalQuantity || 0);
    });
    return t;
  }, [inventories]);

  // Top products across inventories (sum by product+unit)
  const topProducts = useMemo(() => {
    const map = new Map();
    inventories.forEach(inv => {
      (inv?.sales?.byProduct || []).forEach(p => {
        const key = `${p.productId}__${p.unit?.id || ''}`;
        const cur = map.get(key) || { name: p.productName, unit: p.unit?.name, qty: 0, revenue: 0 };
        cur.qty += Number(p.quantitySold || 0);
        cur.revenue += Number(p.revenue || 0);
        map.set(key, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [inventories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <Gauge size={20}/> Summary
            </h1>
            <p className="text-sm text-slate-500">
              {scopeLabel} • {periodLabel}
              {data?.range && ` • ${prettyDate(data.range.start)} – ${prettyDate(data.range.end)}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e)=> setPeriod(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="daily">Today</option>
              <option value="weekly">This week</option>
              <option value="monthly">This month</option>
              <option value="yearly">This year</option>
              <option value="all">All time</option>
            </select>

            <select
              value={selectedInvId}
              onChange={(e)=> setSelectedInvId(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="all">All inventories</option>
              {invOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <button
              onClick={fetchSummary}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16}/> Refresh
            </button>

            <button
              onClick={() => exportPDF({
                periodLabel,
                scopeLabel,
                range: data?.range || { start: new Date(), end: new Date() },
                totals,
                topProducts,
                inventories,
              })}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download size={16}/> Download PDF
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            {err}
          </div>
        )}
      </div>

      {/* Overall stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Package} label="Orders" value={totals.orders} sub={`${periodLabel}`} />
        <Stat icon={Package} label="Qty Sold" value={totals.qty} sub="All products" />
        <Stat icon={Banknote} label="Revenue" value={`₨ ${money(totals.revenue)}`} sub={periodLabel} />
        <Stat icon={Layers3} label="Stock Items" value={totals.stockItems} sub={`Qty: ${totals.stockQty}`} />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
        </div>
      ) : inventories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No data for the selected scope/period.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top products */}
          <Panel title="Top products (by revenue)">
            {topProducts.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
                No sales in this period.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {topProducts.map((p, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.qty} {p.unit || ''}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">₨ {money(p.revenue)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Per-inventory breakdown */}
          <Panel title="Per-inventory breakdown">
            <div className="space-y-3">
              {inventories.map((inv) => (
                <details key={inv.inventoryId} className="rounded-xl border border-slate-200 bg-white/60 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{inv.inventoryName}</div>
                      <div className="text-xs text-slate-500">
                        Orders {inv.sales.totals.orders || 0} • Qty {inv.sales.totals.quantity || 0} • Revenue ₨ {money(inv.sales.totals.revenue || 0)}
                        {' '}• Stock Items {inv.stock.totals.items || 0}
                      </div>
                    </div>
                    <span className="text-slate-400">▼</span>
                  </summary>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {/* Sales table */}
                    <div className="rounded-lg border border-slate-200">
                      <div className="px-3 py-2 text-sm font-medium text-slate-700">Sales (by product)</div>
                      <div className="max-h-64 overflow-auto">
                        <table className="w-full border-t border-slate-100 text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-slate-500">
                              <th>Product</th>
                              <th className="text-right">Qty</th>
                              <th>Unit</th>
                              <th className="text-right">Orders</th>
                              <th className="text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(inv.sales.byProduct || []).map((p) => (
                              <tr key={`${p.productId}-${p.unit?.id || ''}`} className="[&>td]:px-3 [&>td]:py-2 border-t">
                                <td className="truncate">{p.productName}</td>
                                <td className="text-right">{p.quantitySold}</td>
                                <td>{p.unit?.name || ''}</td>
                                <td className="text-right">{p.orders}</td>
                                <td className="text-right">₨ {money(p.revenue)}</td>
                              </tr>
                            ))}
                            {(!inv.sales.byProduct || inv.sales.byProduct.length === 0) && (
                              <tr><td className="px-3 py-3 text-slate-500 text-sm" colSpan={5}>No sales.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Stock table */}
                    <div className="rounded-lg border border-slate-200">
                      <div className="px-3 py-2 text-sm font-medium text-slate-700">
                        Stock snapshot • {prettyDate(inv.stock.snapshotAt)}
                      </div>
                      <div className="max-h-64 overflow-auto">
                        <table className="w-full border-t border-slate-100 text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-slate-500">
                              <th>Product</th>
                              <th className="text-right">Qty</th>
                              <th>Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(inv.stock.byProduct || []).map((s) => (
                              <tr key={`${s.productId}-${s.unit?.id || ''}`} className="[&>td]:px-3 [&>td]:py-2 border-t">
                                <td className="truncate">{s.productName}</td>
                                <td className="text-right">{s.stockQuantity}</td>
                                <td>{s.unit?.name || ''}</td>
                              </tr>
                            ))}
                            {(!inv.stock.byProduct || inv.stock.byProduct.length === 0) && (
                              <tr><td className="px-3 py-3 text-slate-500 text-sm" colSpan={3}>No stock.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}