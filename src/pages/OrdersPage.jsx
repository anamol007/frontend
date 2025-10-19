// src/pages/OrdersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import {
  Search, Plus, RefreshCw, Package, User2, Building2,
  Banknote, CalendarClock, Pencil, Trash2, BadgeCheck,
  ChevronLeft, ChevronRight, X, FileText, Printer
} from "lucide-react";
import FormModal from "../components/FormModal";

/* -------------------- constants -------------------- */
const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};
const PAYMENT = ["cash", "cheque", "card", "no"];
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

/* -------------------- utils -------------------- */
function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function formatPrettyDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(+d)) return "—";
  const day = ordinalSuffix(d.getDate());
  const mon = d.toLocaleString(undefined, { month: "short" });
  const year = d.getFullYear();
  return `${day} ${mon}, ${year}`;
}
function Badge({ children, tone = "bg-slate-100 text-slate-700 border-slate-200" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${tone}`}>
      {children}
    </span>
  );
}

/* -------------------- shared UI: Confirm & Pagination -------------------- */
function ConfirmDialog({ open, title = "Are you sure?", message, confirmLabel = "Confirm", tone = "rose", onConfirm, onClose }) {
  if (!open) return null;
  const toneBtn = tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">{message}</div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm?.(); onClose?.(); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${toneBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ total, page, perPage, onPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const goto = (p) => onPage(Math.min(pages, Math.max(1, p)));

  const windowSize = 3;
  let lo = Math.max(1, page - 1);
  let hi = Math.min(pages, lo + windowSize - 1);
  lo = Math.max(1, hi - windowSize + 1);

  const nums = [];
  for (let p = lo; p <= hi; p++) nums.push(p);

  const btnBase = "inline-flex items-center gap-1 rounded-2xl border px-4 py-2 text-sm transition";
  const pill = "rounded-2xl px-3 py-2 text-sm font-semibold";

  return (
    <div className="mt-6 flex justify-center">
      <div className="flex items-center gap-2">
        <button
          onClick={() => goto(page - 1)}
          disabled={page === 1}
          className={`${btnBase} border-slate-200 bg-white text-slate-600 disabled:opacity-40`}
        >
          <ChevronLeft size={16} /> Prev
        </button>

        {nums.map((n) =>
          n === page ? (
            <span key={n} className={`${pill} bg-slate-900 text-white shadow`}>{n}</span>
          ) : (
            <button
              key={n}
              onClick={() => goto(n)}
              className={`${btnBase} border-slate-200 bg-white text-slate-900 hover:bg-slate-50`}
            >
              {n}
            </button>
          )
        )}

        <button
          onClick={() => goto(page + 1)}
          disabled={page === pages}
          className={`${btnBase} border-slate-200 bg-white text-slate-600 disabled:opacity-40`}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* -------------------- Receipt Preview (no company block) -------------------- */
function ReceiptModal({ open, order, onClose, onPrint }) {
  if (!open || !order) return null;

  const id = order.id;
  const when = order.orderDate || order.createdAt;
  const cust = order.customer || {};
  const prod = order.product || {};
  const inv  = order.inventory || {};
  const unit = order.unit || {};
  const qty = Number(order.quantity ?? 0);
  const total = Number(order.totalAmount ?? 0);
  const pay = order.paymentMethod || "—";
  const status = order.status || "pending";
  const unitPrice = qty > 0 ? total / qty : 0;

  return (
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(820px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-slate-900 px-5 py-4 text-white">
          <div className="font-semibold">Order Receipt</div>
          <div className="flex items-center gap-2">
            <button onClick={onPrint} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
              <span className="inline-flex items-center gap-2"><Printer size={16}/> Print</span>
            </button>
            <button onClick={onClose} className="rounded-lg bg-white/10 p-2 hover:bg-white/20">
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Meta (no company block) */}
          <div className="flex justify-end">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Receipt</div>
              <div className="text-lg font-semibold text-slate-900">#{id}</div>
              <div className="text-sm text-slate-600">{formatPrettyDate(when)}</div>
              <div className="mt-1 inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs">
                <BadgeCheck size={14}/><span className="capitalize">{status}</span>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill To</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{cust.fullname || "—"}</div>
              {cust.email && <div className="text-xs text-slate-600">{cust.email}</div>}
              {cust.phoneNumber && <div className="text-xs text-slate-600">{cust.phoneNumber}</div>}
              {cust.address && <div className="text-xs text-slate-600">{cust.address}</div>}
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fulfilled From</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{inv.inventoryName || "—"}</div>
              {inv.address && <div className="text-xs text-slate-600">{inv.address}</div>}
              {inv.contactNumber && <div className="text-xs text-slate-600">{inv.contactNumber}</div>}
            </div>
          </div>

          {/* Line item */}
          <div className="mt-6 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span>Product</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center border-t px-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-900">{prod.productName || `Product #${order.productId}`}</div>
                <div className="text-xs text-slate-500">{unit.name ? `Unit: ${unit.name}` : ""}</div>
              </div>
              <div className="text-right tabular-nums">{qty}</div>
              <div className="text-right tabular-nums">{unitPrice.toFixed(2)}</div>
              <div className="text-right font-semibold tabular-nums">{total.toFixed(2)}</div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</div>
              <div className="mt-1 text-sm text-slate-800 capitalize">{pay}</div>
              {order.notes && (
                <>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
                  <div className="mt-1 text-sm text-slate-700">{order.notes}</div>
                </>
              )}
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-700">Subtotal</div>
                <div className="font-medium tabular-nums">{total.toFixed(2)}</div>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <div className="text-slate-700">Tax</div>
                <div className="tabular-nums">0.00</div>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <div className="text-slate-700">Discount</div>
                <div className="tabular-nums">0.00</div>
              </div>
              <div className="mt-3 flex items-center justify-between text-base font-semibold">
                <div className="text-slate-900">Total</div>
                <div className="tabular-nums">{total.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-3 text-center text-xs text-slate-500">
            Thank you for your business!
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Build printable HTML with inline CSS -------------------- */
function buildPrintableReceiptHTML(order) {
  const id = order.id;
  const when = formatPrettyDate(order.orderDate || order.createdAt);
  const cust = order.customer || {};
  const prod = order.product || {};
  const inv  = order.inventory || {};
  const unit = order.unit || {};
  const qty = Number(order.quantity ?? 0);
  const total = Number(order.totalAmount ?? 0);
  const unitPrice = qty > 0 ? total / qty : 0;
  const status = (order.status || "pending").toUpperCase();
  const pay = order.paymentMethod || "—";

  const css = `
    *{box-sizing:border-box} body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;color:#0f172a}
    .wrap{padding:28px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
    .right{text-align:right}
    .muted{font-size:12px;color:#64748b;letter-spacing:.06em;text-transform:uppercase}
    .badge{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:12px;margin-top:6px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
    .card{border:1px solid #e2e8f0;border-radius:12px;padding:12px}
    .title{font-weight:700;font-size:14px}
    .small{font-size:12px;color:#475569}
    .table{border:1px solid #e2e8f0;border-radius:12px;margin-top:18px;overflow:hidden}
    .thead{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;background:#f8fafc;padding:10px 12px;font-size:12px;font-weight:700;color:#475569}
    .row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:12px;border-top:1px solid #e2e8f0;font-size:14px}
    .rightCell{text-align:right}
    .summary{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
    .line{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
    .total{font-weight:800;font-size:16px;margin-top:8px}
    @page{size:auto;margin:14mm}
  `;
  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt #${id}</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="wrap">
        <div class="top">
          <div></div>
          <div class="right">
            <div class="muted">RECEIPT</div>
            <div class="title">#${id}</div>
            <div class="small">${when}</div>
            <div class="badge">${status}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="muted">BILL TO</div>
            <div class="title">${cust.fullname || "—"}</div>
            ${cust.email ? `<div class="small">${cust.email}</div>` : ""}
            ${cust.phoneNumber ? `<div class="small">${cust.phoneNumber}</div>` : ""}
            ${cust.address ? `<div class="small">${cust.address}</div>` : ""}
          </div>
          <div class="card">
            <div class="muted">FULFILLED FROM</div>
            <div class="title">${inv.inventoryName || "—"}</div>
            ${inv.address ? `<div class="small">${inv.address}</div>` : ""}
            ${inv.contactNumber ? `<div class="small">${inv.contactNumber}</div>` : ""}
          </div>
        </div>

        <div class="table">
          <div class="thead">
            <div>Product</div><div class="rightCell">Qty</div><div class="rightCell">Unit Price</div><div class="rightCell">Amount</div>
          </div>
          <div class="row">
            <div>
              <div class="title">${prod.productName || `Product #${order.productId}`}</div>
              <div class="small">${unit.name ? `Unit: ${unit.name}` : ""}</div>
            </div>
            <div class="rightCell">${qty}</div>
            <div class="rightCell">${unitPrice.toFixed(2)}</div>
            <div class="rightCell"><strong>${total.toFixed(2)}</strong></div>
          </div>
        </div>

        <div class="summary">
          <div class="card">
            <div class="muted">PAYMENT</div>
            <div class="title" style="font-size:14px;font-weight:600;text-transform:capitalize">${pay}</div>
            ${order.notes ? `<div class="small" style="margin-top:8px">${order.notes}</div>` : ""}
          </div>
          <div class="card">
            <div class="line"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
            <div class="line"><span>Tax</span><span>0.00</span></div>
            <div class="line"><span>Discount</span><span>0.00</span></div>
            <div class="line total"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </div>

        <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center" class="small">
          Thank you for your business!
        </div>
      </div>
    </body>
  </html>`;
  return html;
}

/* -------------------- page -------------------- */
export default function OrdersPage() {
  // auth / role
  const [me, setMe] = useState(null);
  const role = me?.role || "";
  const isSuper = role === "superadmin";
  const canCreate = isSuper || role === "admin"; // admins can create
  const canEditDelete = isSuper;                 // only superadmin can edit/delete

  // admin inventories (from /summary)
  const [myInvIds, setMyInvIds] = useState([]);
  const hasSingleInv = myInvIds.length === 1;
  const mySingleInvId = hasSingleInv ? myInvIds[0] : null;

  // data
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // filters / modal
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [invFilter, setInvFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // pagination
  const [page, setPage] = useState(1);
  const perPage = 10;

  // confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);

  // receipt preview
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);

  // who am I?
  async function fetchMe() {
    try {
      const r = await api.get("/users/verify-token");
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }
  useEffect(() => { fetchMe(); }, []);

  // resolve inventories for admin
  async function resolveMyInventories() {
    try {
      const res = await api.get("/summary", { params: { period: "all" } });
      const invs = res?.data?.data?.inventories || [];
      const ids = invs.map(i => Number(i.inventoryId ?? i.id)).filter(Boolean);
      setMyInvIds(ids);
      if (!isSuper && ids.length === 1) setInvFilter(String(ids[0]));
    } catch {
      setMyInvIds([]);
    }
  }
  useEffect(() => { resolveMyInventories(); }, [isSuper]);

  // reference data
  useEffect(() => {
    (async () => {
      try {
        const [c, p, i, u] = await Promise.all([
          api.get("/customers/"),
          api.get("/products/"),
          api.get("/inventory/"),
          api.get("/units/"),
        ]);

        const cust = (c.data?.data ?? c.data ?? []).slice()
          .sort((a, b) => (a.fullname || "").localeCompare(b.fullname || ""));
        const prod = (p.data?.data ?? p.data ?? []).slice()
          .sort((a, b) => (a.productName || "").localeCompare(b.productName || ""));
        const invAll = (i.data?.data ?? i.data ?? []).slice()
          .sort((a, b) => (a.inventoryName || "").localeCompare(b.inventoryName || ""));
        const unit = (u.data?.data ?? u.data ?? []).slice()
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setCustomers(cust);
        setProducts(prod);
        setInventories(isSuper ? invAll : invAll.filter(iv => myInvIds.includes(iv.id)));
        setUnits(unit);
      } catch {
        // non-fatal
      }
    })();
  }, [isSuper, myInvIds.join(",")]);

  // orders
  async function fetchOrders() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const res = await api.get("/orders/");
      const list = res?.data?.data ?? res?.data ?? [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Error fetching orders");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchOrders(); }, []);

  // filtering (also reset to page 1 when filters/search change)
  useEffect(() => { setPage(1); }, [q, statusFilter, invFilter]);

  const filtered = useMemo(() => {
    let data = [...orders];
    if (!isSuper && myInvIds.length > 0) {
      data = data.filter(o => myInvIds.includes(Number(o.inventoryId)));
    }
    if (statusFilter) data = data.filter(o => (o.status || "") === statusFilter);
    if (invFilter) data = data.filter(o => String(o.inventoryId) === String(invFilter));
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter(o =>
      (o?.customer?.fullname || "").toLowerCase().includes(s) ||
      (o?.product?.productName || "").toLowerCase().includes(s) ||
      (o?.inventory?.inventoryName || "").toLowerCase().includes(s) ||
      String(o?.id || "").includes(s)
    );
  }, [orders, q, statusFilter, invFilter, myInvIds, isSuper]);

  // page slice
  const start = (page - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  // form fields (match backend)
  const invOptions = useMemo(() => {
    const base = inventories.map(i => ({ value: i.id, label: i.inventoryName }));
    if (!isSuper && hasSingleInv) return base.filter(o => Number(o.value) === mySingleInvId);
    return base;
  }, [inventories, isSuper, hasSingleInv, mySingleInvId]);

  const CREATE_FIELDS = useMemo(() => ([
    { name: "customerId",  type: "select", label: "Customer",   required: true, options: customers.map(c => ({ value: c.id, label: c.fullname })) },
    { name: "productId",   type: "select", label: "Product",    required: true, options: products.map(p => ({ value: p.id, label: p.productName })) },
    { name: "inventoryId", type: "select", label: "Inventory",  required: true, options: invOptions },
    { name: "unit_id",     type: "select", label: "Unit",       required: true, options: units.map(u => ({ value: u.id, label: u.name })) },
    { name: "quantity",    type: "number", label: "Quantity",   required: true, step: "0.01", min: "0" },
    { name: "status",      type: "select", label: "Status",     required: false, options: STATUSES },
    { name: "paymentMethod", type: "select", label: "Payment",  required: false, options: PAYMENT },
    { name: "orderDate",   type: "datetime-local", label: "Order Date", required: false },
  ]), [customers, products, units, invOptions]);

  const EDIT_FIELDS = CREATE_FIELDS;

  function sanitize(fields, payload) {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (!allow.has(k)) return;
      if (v === "" || v === undefined || v === null) return;
      out[k] = v;
    });
    return out;
  }

  // CRUD
  async function handleSubmit(form) {
    const role = me?.role || "";
    const isSuper = role === "superadmin";
    const canCreate = isSuper || role === "admin";

    if (!canCreate) { setErr("Only Admin / Super Admin can create orders"); return; }
    if (!isSuper && editRow?.id) { setErr("Admins can’t edit orders — only create."); return; }

    const formCopy = { ...form };
    if (!isSuper && hasSingleInv) formCopy.inventoryId = mySingleInvId;

    try {
      setErr(""); setOk("");
      if (editRow?.id && isSuper) {
        const body = sanitize(EDIT_FIELDS, formCopy);
        await api.put(`/orders/${editRow.id}`, body);
        setOk("Order updated");
      } else {
        const body = sanitize(CREATE_FIELDS, formCopy);
        await api.post("/orders/", body);
        setOk("Order created");
      }
      setOpen(false); setEditRow(null);
      await fetchOrders();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Action failed");
    }
  }

  // delete (uses custom confirm)
  async function deleteNow(row) {
    if (!canEditDelete) { setErr("Only Super Admin can delete orders"); return; }
    try {
      setErr(""); setOk("");
      await api.delete(`/orders/${row.id}`);
      setOk("Order deleted");
      await fetchOrders();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  // PRINT (no new tab; hidden iframe to avoid popup issues)
  function printOrder(order) {
  const html = buildPrintableReceiptHTML(order);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.inset = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  // Ensure we only print & cleanup once
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    // Guard in case iframe was already removed
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const triggerPrint = () => {
    if (done) return;
    try {
      const w = iframe.contentWindow;
      if (!w) return;
      w.focus();
      w.print();
    } catch (_) {
      // ignore
    } finally {
      // give the browser a moment to open the dialog before removing
      setTimeout(cleanup, 600);
    }
  };

  // Append before writing to avoid some browsers dropping onload
  document.body.appendChild(iframe);

  // Write the document
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  // Use both onload and a fallback timer, but guard with `done`
  iframe.addEventListener("load", triggerPrint, { once: true });

  doc.open();
  doc.write(html);
  doc.close();

  // Fallback: if onload doesn't fire (document.write peculiarity)
  setTimeout(triggerPrint, 250);
}

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? "Create, edit, or manage orders. Totals are auto-calculated by the server."
                : (canCreate ? "Create new orders for your inventory. (Editing/deleting is restricted.)" : "Browse and filter orders (read-only).")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search customer, product, inventory…"
                className="w-full sm:w-64 bg-transparent outline-none text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">All status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={invFilter}
              onChange={e => setInvFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">{isSuper ? "All inventories" : "My inventories"}</option>
              {(isSuper ? inventories : inventories.filter(iv => myInvIds.includes(iv.id))).map(i => (
                <option key={i.id} value={i.id}>{i.inventoryName}</option>
              ))}
            </select>
            <button
              onClick={fetchOrders}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            {(isSuper || role === "admin") && (
              <button
                onClick={() => { setEditRow(null); setOpen(true); }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16} /> New Order
              </button>
            )}
          </div>
        </div>
        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No orders found.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map(o => {
              const cust = o.customer?.fullname || "—";
              const prod = o.product?.productName || "—";
              const inv  = o.inventory?.inventoryName || "—";
              const unitName = o.unit?.name || "—";
              const statusTone = STATUS_COLORS[o.status] || STATUS_COLORS.pending;

              return (
                <div
                  key={o.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl"
                >
                  <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="bg-slate-100 text-slate-700 border-slate-200">#{o.id}</Badge>
                        <Badge tone={statusTone}><BadgeCheck size={12} /> {o.status || "pending"}</Badge>
                        <Badge tone="bg-violet-100 text-violet-700 border-violet-200">
                          <Banknote size={12}/> {Number(o.totalAmount ?? 0).toFixed(2)}
                        </Badge>
                      </div>

                      <h3 className="mt-2 line-clamp-1 text-base font-semibold text-slate-900">{prod}</h3>
                      <div className="mt-1 grid gap-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <User2 size={14} className="text-slate-400"/><span className="truncate">{cust}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400"/><span className="truncate">{inv}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-slate-400"/><span>{o.quantity} {unitName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarClock size={14} className="text-slate-400"/>
                          <span>{formatPrettyDate(o.orderDate || o.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {/* Single option: Receipt (opens preview; print from there) */}
                    <button
                      onClick={() => { setReceiptOrder(o); setReceiptOpen(true); }}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <FileText size={16}/> Receipt
                    </button>

                    {canEditDelete && (
                      <>
                        <button
                          onClick={() => {
                            setEditRow({
                              id: o.id,
                              customerId: o.customerId,
                              productId: o.productId,
                              inventoryId: o.inventoryId,
                              quantity: o.quantity,
                              unit_id: o.unit_id,
                              status: o.status,
                              paymentMethod: o.paymentMethod,
                              orderDate: o.orderDate ? new Date(o.orderDate).toISOString().slice(0,16) : "",
                            });
                            setOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil size={16}/> Edit
                        </button>
                        <button
                          onClick={() => { setTargetRow(o); setConfirmOpen(true); }}
                          className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                        >
                          <Trash2 size={16}/> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            total={filtered.length}
            page={page}
            perPage={perPage}
            onPage={setPage}
          />
        </>
      )}

      {/* Form Modal */}
      <FormModal
        title={editRow ? (isSuper ? "Edit Order" : "Create Order") : "Create Order"}
        open={open}
        onClose={() => { setOpen(false); setEditRow(null); }}
        fields={editRow && isSuper ? EDIT_FIELDS : CREATE_FIELDS}
        initial={
          editRow && isSuper
            ? editRow
            : (!isSuper && hasSingleInv ? { inventoryId: mySingleInvId } : {})
        }
        onSubmit={handleSubmit}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete Order"
        message={targetRow ? `Are you sure you want to delete order #${targetRow.id}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        tone="rose"
        onConfirm={() => targetRow && deleteNow(targetRow)}
        onClose={() => { setConfirmOpen(false); setTargetRow(null); }}
      />

      {/* Receipt Preview (single action: preview + print) */}
      <ReceiptModal
        open={receiptOpen}
        order={receiptOrder}
        onPrint={() => receiptOrder && printOrder(receiptOrder)}
        onClose={() => { setReceiptOpen(false); setReceiptOrder(null); }}
      />
    </div>
  );
}