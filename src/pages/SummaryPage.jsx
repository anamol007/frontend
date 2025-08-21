// src/pages/SummaryPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Gauge, Download, Printer, MapPin, Package, Truck, Banknote, RefreshCw, AlertTriangle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api, getUser, fetchLowStock } from '../utils/api';

// ---------------- helpers ----------------
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
const prettyDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const M = dt.toLocaleString(undefined, { month: 'short' });
  const D = ordinal(dt.getDate());
  const Y = dt.getFullYear();
  const T = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${M} ${D}, ${Y}, ${T}`;
};
const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inRange = (ts, start, end) => {
  if (!start && !end) return true;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return false;
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
};

const periodToRange = (key) => {
  const now = new Date();
  const end = new Date(now);
  let start = null;
  switch (key) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
    case 'week': {
      const day = now.getDay(); // 0 Sun
      const diff = (day + 6) % 7; // Monday as start
      start = new Date(now);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case 'year': {
      start = new Date(now.getFullYear(), 0, 1);
      break;
    }
    default:
      start = null; // all time
      break;
  }
  return { start, end };
};

// PDF dotted divider
const divider = (doc, x, y, w) => {
  doc.setLineWidth(0.2);
  doc.setDrawColor(160);
  doc.setLineDash([1.2, 1.2], 0);
  doc.line(x, y, x + w, y);
  doc.setLineDash();
};

// ---------------- receipt PDF export (A4 with centered receipt column) ----------------
const exportSummaryAsReceipt = (
  {
    user,
    periodLabel,
    scopeLabel,
    now = new Date(),
    orders = [],
    deliveries = [],
    lowStock = [],
    totals = {},
  },
  { preview = false } = {}
) => {
  const ordersCount = totals.ordersCount ?? (Array.isArray(orders) ? orders.length : 0);
  const totalRevenueNum =
    totals.revenue ?? (Array.isArray(orders) ? orders.reduce((s, o) => s + Number(o?.totalAmount || 0), 0) : 0);
  const deliveriesCount = totals.deliveriesCount ?? (Array.isArray(deliveries) ? deliveries.length : 0);
  const lowStockCount = totals.lowStockCount ?? (Array.isArray(lowStock) ? lowStock.length : 0);

  // Build "top products"
  const productMap = new Map();
  (orders || []).forEach((o) => {
    const name = o?.product?.productName || o?.productName || `#${o?.productId || '—'}`;
    const unit = o?.unit?.name || o?.unitName || '';
    const qty = Number(o?.quantity || 0);
    const rev = Number(o?.totalAmount || 0);
    const key = `${name}__${unit}`;
    const cur = productMap.get(key) || { name, unit, qty: 0, revenue: 0 };
    cur.qty += qty;
    cur.revenue += rev;
    productMap.set(key, cur);
  });
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Make an A4 page so desktop printing never clips; draw an 80mm-wide receipt column centered.
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', putOnlyUsedFonts: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const receiptWidth = 80; // mm
  const colX = (pageW - receiptWidth) / 2; // centered column start
  const innerPad = 6; // inner padding inside the column
  const L = colX + innerPad;
  const W = receiptWidth - innerPad * 2;

  let y = 12;

  // page-break helper
  const ensure = (needed = 8) => {
    if (y + needed > pageH - 12) {
      doc.addPage();
      y = 12;
    }
  };

  // Header
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text('INVENTORY SUMMARY', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(scopeLabel || '—', pageW / 2, y, { align: 'center' });
  y += 4;
  doc.text(periodLabel || 'All time', pageW / 2, y, { align: 'center' });
  y += 2;
  ensure(5);
  divider(doc, L, y, W);
  y += 3;

  doc.setTextColor(20);
  doc.text(`Printed: ${prettyDateTime(now)}`, L, y);
  y += 4;
  doc.text(`User: ${user?.fullname || '—'} (${user?.role || '—'})`, L, y);
  y += 4;
  ensure(5);
  divider(doc, L, y, W);
  y += 3;

  // Totals
  doc.setFont('courier', 'bold');
  doc.text('Totals', L, y);
  y += 5;
  doc.setFont('courier', 'normal');

  [['Orders', String(ordersCount)], ['Revenue', `${money(totalRevenueNum)}`]].forEach(([k, v]) => {
    ensure(5);
    doc.text(`${k}:`, L, y);
    doc.text(v, L + W, y, { align: 'right' });
    y += 4;
  });
  [['Deliveries', String(deliveriesCount)], ['Low stock', String(lowStockCount)]].forEach(([k, v]) => {
    ensure(5);
    doc.text(`${k}:`, L, y);
    doc.text(v, L + W, y, { align: 'right' });
    y += 4;
  });

  ensure(5);
  divider(doc, L, y, W);
  y += 3;

  // Top products table
  if (topProducts.length) {
    ensure(10);
    doc.setFont('courier', 'bold');
    doc.text('Top products', L, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      theme: 'plain',
      margin: { left: L, right: pageW - (L + W) }, // confine to column
      styles: { font: 'courier', fontSize: 8, cellPadding: 0.8, lineWidth: 0.1 },
      headStyles: { fontStyle: 'bold' },
      tableWidth: W,
      head: [['Item', 'Qty', 'Unit', 'Revenue']],
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 10, halign: 'right' },
        2: { cellWidth: 12 },
        3: { cellWidth: 18, halign: 'right' },
      },
      body: topProducts.map((p) => [p.name, String(p.qty), p.unit || '', money(p.revenue)]),
    });
    y = doc.lastAutoTable.finalY + 2;
    ensure(5);
    divider(doc, L, y, W);
    y += 3;
  }

  // Deliveries table
  if ((deliveries || []).length) {
    ensure(10);
    doc.setFont('courier', 'bold');
    doc.text('Deliveries (latest)', L, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      theme: 'plain',
      margin: { left: L, right: pageW - (L + W) },
      styles: { font: 'courier', fontSize: 8, cellPadding: 0.8, lineWidth: 0.1 },
      tableWidth: W,
      head: [['#', 'Driver', 'Date']],
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 }, 2: { cellWidth: 30 } },
      body: deliveries.slice(0, 8).map((d) => [
        String(d?.id ?? '—'),
        d?.driver?.user?.fullname || `#${d?.driver_id ?? '—'}`,
        prettyDateTime(d?.createdAt),
      ]),
    });
    y = doc.lastAutoTable.finalY + 2;
    ensure(5);
    divider(doc, L, y, W);
    y += 3;
  }

  // Low stock table
  if ((lowStock || []).length) {
    ensure(10);
    doc.setFont('courier', 'bold');
    doc.text('Low stock (sample)', L, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      theme: 'plain',
      margin: { left: L, right: pageW - (L + W) },
      styles: { font: 'courier', fontSize: 8, cellPadding: 0.8, lineWidth: 0.1 },
      tableWidth: W,
      head: [['Item', 'Qty', 'Unit', 'Inventory']],
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 10, halign: 'right' },
        2: { cellWidth: 12 },
        3: { cellWidth: 28 },
      },
      body: lowStock.slice(0, 8).map((s) => [
        s?.product?.productName || s?.productName || `#${s?.product_id ?? '—'}`,
        String(s?.stockQuantity ?? s?.qty ?? '—'),
        s?.unit?.name || s?.unitName || '',
        s?.inventory?.inventoryName || s?.inventoryName || '',
      ]),
    });
    y = doc.lastAutoTable.finalY + 2;
    ensure(5);
    divider(doc, L, y, W);
    y += 3;
  }

  // Footer
  ensure(10);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('Thank you!', pageW / 2, y + 3, { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setTextColor(120);
  doc.text('Generated by Inventory Console', pageW / 2, y + 7, { align: 'center' });

  if (preview) {
    const url = doc.output('bloburl');
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    doc.save(`summary_${Date.now()}.pdf`);
  }
};

// --------------- main page ----------------
export default function SummaryPage() {
  const [user, setUser] = useState(null);

  const [inventories, setInventories] = useState([]);
  const [selectedInvId, setSelectedInvId] = useState('all');

  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  const [period, setPeriod] = useState('all'); // today | week | month | year | all
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // load user + inventories + data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr('');

        const u = await getUser();
        setUser(u || null);

        // inventories (include managers so we can restrict admins)
        const invRes = await api.get('/inventory/');
        const invList = Array.isArray(invRes?.data?.data) ? invRes.data.data : (invRes?.data || []);
        setInventories(invList);

        // default inventory scope by role
        if (u?.role === 'admin') {
          const mine = invList.filter((i) =>
            Array.isArray(i?.managers) ? i.managers.some((m) => String(m?.user?.id) === String(u.id)) : false
          );
          setSelectedInvId(mine[0]?.id ?? 'all');
        } else {
          setSelectedInvId('all'); // superadmin or others
        }

        // orders & deliveries
        const [oRes, dRes] = await Promise.all([api.get('/orders/'), api.get('/deliveries/')]);
        const oList = Array.isArray(oRes?.data?.data) ? oRes.data.data : (oRes?.data || []);
        const dList = Array.isArray(dRes?.data?.data) ? dRes.data.data : (dRes?.data || []);
        setOrders(oList);
        setDeliveries(dList);

        // optional low stock helper
        try {
          const ls = await fetchLowStock();
          const lsList = Array.isArray(ls?.data?.data) ? ls.data.data : (ls?.data || []);
          setLowStock(lsList);
        } catch {
          setLowStock([]);
        }
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || 'Failed to load summary');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // apply role scope & period filters
  const { start, end } = useMemo(() => periodToRange(period), [period]);

  const scopedOrders = useMemo(() => {
    let list = orders;
    if (user?.role === 'admin') {
      const myInvIds = new Set(
        inventories
          .filter((i) => Array.isArray(i?.managers) && i.managers.some((m) => String(m?.user?.id) === String(user.id)))
          .map((i) => i.id)
      );
      list = list.filter((o) => myInvIds.has(o?.inventoryId));
    }
    if (selectedInvId !== 'all') {
      list = list.filter((o) => String(o?.inventoryId) === String(selectedInvId));
    }
    return list.filter((o) => inRange(o?.orderDate || o?.createdAt, start, end));
  }, [orders, user, inventories, selectedInvId, start, end]);

  const scopedDeliveries = useMemo(() => {
    let list = deliveries;
    if (user?.role === 'admin') {
      const myInvIds = new Set(
        inventories
          .filter((i) => Array.isArray(i?.managers) && i.managers.some((m) => String(m?.user?.id) === String(user.id)))
          .map((i) => i.id)
      );
      list = list.filter((d) => myInvIds.has(d?.order?.inventoryId));
    }
    if (selectedInvId !== 'all') {
      list = list.filter((d) => String(d?.order?.inventoryId) === String(selectedInvId));
    }
    return list.filter((d) => inRange(d?.createdAt, start, end));
  }, [deliveries, user, inventories, selectedInvId, start, end]);

  const scopedLowStock = useMemo(() => {
    let list = lowStock;
    if (user?.role === 'admin') {
      const myInvIds = new Set(
        inventories
          .filter((i) => Array.isArray(i?.managers) && i.managers.some((m) => String(m?.user?.id) === String(user.id)))
          .map((i) => i.id)
      );
      list = list.filter((s) => myInvIds.has(s?.inventory_id || s?.inventoryId || s?.inventory?.id));
    }
    if (selectedInvId !== 'all') {
      list = list.filter((s) => String(s?.inventory_id || s?.inventoryId || s?.inventory?.id) === String(selectedInvId));
    }
    return list;
  }, [lowStock, user, inventories, selectedInvId]);

  // compute totals
  const totals = useMemo(() => {
    const ordersCount = scopedOrders.length;
    const revenue = scopedOrders.reduce((s, o) => s + Number(o?.totalAmount || 0), 0);
    const deliveriesCount = scopedDeliveries.length;
    const lowStockCount = scopedLowStock.length;
    return { ordersCount, revenue, deliveriesCount, lowStockCount };
  }, [scopedOrders, scopedDeliveries, scopedLowStock]);

  const periodLabel =
    period === 'today'
      ? 'Today'
      : period === 'week'
      ? 'This week'
      : period === 'month'
      ? 'This month'
      : period === 'year'
      ? 'This year'
      : 'All time';

  const scopeLabel = useMemo(() => {
    if (selectedInvId === 'all') {
      return user?.role === 'superadmin' ? 'All inventories' : 'My inventories';
    }
    const inv = inventories.find((i) => String(i.id) === String(selectedInvId));
    return inv?.inventoryName || 'Inventory';
  }, [selectedInvId, inventories, user]);

  const topProducts = useMemo(() => {
    const map = new Map();
    scopedOrders.forEach((o) => {
      const name = o?.product?.productName || o?.productName || `#${o?.productId || '—'}`;
      const unit = o?.unit?.name || o?.unitName || '';
      const qty = Number(o?.quantity || 0);
      const rev = Number(o?.totalAmount || 0);
      const key = `${name}__${unit}`;
      const cur = map.get(key) || { name, unit, qty: 0, revenue: 0 };
      cur.qty += qty;
      cur.revenue += rev;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [scopedOrders]);

  const refresh = async () => {
    try {
      setLoading(true);
      setErr('');
      const [oRes, dRes] = await Promise.all([api.get('/orders/'), api.get('/deliveries/')]);
      const oList = Array.isArray(oRes?.data?.data) ? oRes.data.data : (oRes?.data || []);
      const dList = Array.isArray(dRes?.data?.data) ? dRes.data.data : (dRes?.data || []);
      setOrders(oList);
      setDeliveries(dList);
      try {
        const ls = await fetchLowStock();
        const lsList = Array.isArray(ls?.data?.data) ? ls.data.data : (ls?.data || []);
        setLowStock(lsList);
      } catch {
        /* no-op */
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <Gauge size={20} /> Summary
            </h1>
            <p className="text-sm text-slate-500">
              {user?.role === 'superadmin' ? 'Superadmin: all inventories' : 'Admin: managed inventories only'} • Period: {periodLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* period */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
              <option value="all">All time</option>
            </select>

            {/* inventory scope */}
            <select
              value={selectedInvId}
              onChange={(e) => setSelectedInvId(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="all">{user?.role === 'superadmin' ? 'All inventories' : 'My inventories'}</option>
              {inventories.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.inventoryName}
                </option>
              ))}
            </select>

            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            {/* Preview (opens in new tab) */}
            <button
              onClick={() =>
                exportSummaryAsReceipt(
                  {
                    user,
                    periodLabel,
                    scopeLabel,
                    now: new Date(),
                    orders: scopedOrders,
                    deliveries: scopedDeliveries,
                    lowStock: scopedLowStock,
                    totals,
                  },
                  { preview: true }
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Printer size={16} /> Preview / Print
            </button>

            {/* Download */}
            <button
              onClick={() =>
                exportSummaryAsReceipt({
                  user,
                  periodLabel,
                  scopeLabel,
                  now: new Date(),
                  orders: scopedOrders,
                  deliveries: scopedDeliveries,
                  lowStock: scopedLowStock,
                  totals,
                })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download size={16} /> Download receipt
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            <AlertTriangle size={16} /> {err}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} label="Orders" value={totals.ordersCount} footer={`Revenue ${money(totals.revenue)}`} />
        <StatCard icon={Banknote} label="Revenue" value={`₨ ${money(totals.revenue)}`} footer={`${periodLabel}`} />
        <StatCard icon={Truck} label="Deliveries" value={totals.deliveriesCount} footer={`Latest ${scopedDeliveries[0]?.id ?? '—'}`} />
        <StatCard icon={MapPin} label="Low stock" value={totals.lowStockCount} footer={scopeLabel} />
      </div>

      {/* lists */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Top products">
            {topProducts.length === 0 ? (
              <Empty text="No orders in this period." />
            ) : (
              <ul className="divide-y divide-slate-200">
                {topProducts.map((p, idx) => (
                  <li key={idx} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.qty} {p.unit || ''}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">₨ {money(p.revenue)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Latest deliveries">
            {scopedDeliveries.length === 0 ? (
              <Empty text="No deliveries in this period." />
            ) : (
              <ul className="divide-y divide-slate-200">
                {scopedDeliveries.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">Delivery #{d.id}</div>
                      <div className="text-xs text-slate-500">
                        {d?.driver?.user?.fullname || `Driver #${d?.driver_id ?? '—'}`} • {prettyDateTime(d?.createdAt)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">Order #{d?.order?.id ?? d?.order_id ?? '—'}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

// ---------------- small UI bits ----------------
function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="grid place-items-center rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
      {text}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, footer }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
          <div className="text-lg font-semibold text-slate-900">{value}</div>
        </div>
      </div>
      {footer && <div className="mt-2 text-xs text-slate-500">{footer}</div>}
    </div>
  );
}