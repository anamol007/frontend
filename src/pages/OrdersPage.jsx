// src/pages/OrdersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import {
  Search, Plus, RefreshCw, Package, User2, Building2,
  Banknote, CalendarClock, Pencil, Trash2, BadgeCheck
} from "lucide-react";
import FormModal from "../components/FormModal";

/* ---------- helpers ---------- */
const ordinal = (n) => {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const prettyDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  const M = dt.toLocaleString(undefined, { month: 'short' }); // Jan
  const D = ordinal(dt.getDate());                             // 1st
  const Y = dt.getFullYear();
  const T = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${M} ${D}, ${Y}, ${T}`;
};
const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- constants ---------- */
const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};
const PAYMENT = ["cash", "cheque", "card", "no"];
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

function Badge({ children, tone = "bg-slate-100 text-slate-700 border-slate-200" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${tone}`}>
      {children}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [invFilter, setInvFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // --------- load reference data
  useEffect(() => {
    (async () => {
      try {
        const [c, p, i, u] = await Promise.all([
          api.get("/customers/"),
          api.get("/products/"),
          api.get("/inventory/"),
          api.get("/units/"),
        ]);
        setCustomers((c.data?.data ?? c.data ?? [])
          .sort((a, b) => (a.fullname || "").localeCompare(b.fullname || "")));
        setProducts((p.data?.data ?? p.data ?? [])
          .sort((a, b) => (a.productName || "").localeCompare(b.productName || "")));
        setInventories((i.data?.data ?? i.data ?? [])
          .sort((a, b) => (a.inventoryName || "").localeCompare(b.inventoryName || "")));
        setUnits((u.data?.data ?? u.data ?? [])
          .sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      } catch {
        // non-fatal for page render
      }
    })();
  }, []);

  // --------- load orders
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

  // --------- filtering & search
  const filtered = useMemo(() => {
    let data = [...orders];
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
  }, [orders, q, statusFilter, invFilter]);

  // --------- form fields (exactly backend vars)
  const CREATE_FIELDS = useMemo(() => ([
    { name: "customerId",  type: "select", label: "Customer",   required: true, options: customers.map(c => ({ value: c.id, label: c.fullname })) },
    { name: "productId",   type: "select", label: "Product",    required: true, options: products.map(p => ({ value: p.id, label: p.productName })) },
    { name: "inventoryId", type: "select", label: "Inventory",  required: true, options: inventories.map(i => ({ value: i.id, label: i.inventoryName })) },
    { name: "unit_id",     type: "select", label: "Unit",       required: true, options: units.map(u => ({ value: u.id, label: u.name })) },
    { name: "quantity",    type: "number", label: "Quantity",   required: true, step: "0.01", min: "0" },
    { name: "status",      type: "select", label: "Status",     required: false, options: STATUSES },
    { name: "paymentMethod", type: "select", label: "Payment",  required: false, options: PAYMENT },
    { name: "orderDate",   type: "datetime-local", label: "Order Date", required: false },
  ]), [customers, products, inventories, units]);

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

  async function handleSubmit(form) {
    try {
      setErr(""); setOk("");
      if (editRow?.id) {
        const body = sanitize(EDIT_FIELDS, form);
        await api.put(`/orders/${editRow.id}`, body);
        setOk("Order updated");
      } else {
        const body = sanitize(CREATE_FIELDS, form);
        await api.post("/orders/", body);
        setOk("Order created");
      }
      setOpen(false); setEditRow(null);
      await fetchOrders();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Action failed");
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete order #${row.id}?`)) return;
    try {
      setErr(""); setOk("");
      await api.delete(`/orders/${row.id}`);
      setOk("Order deleted");
      await fetchOrders();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
            <p className="text-sm text-slate-500">Create, edit, or manage orders. Totals are auto-calculated by the server.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search customer, product, inventory…"
                className="w-64 bg-transparent outline-none text-sm"
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
              <option value="">All inventories</option>
              {inventories.map(i => <option key={i.id} value={i.id}>{i.inventoryName}</option>)}
            </select>
            <button
              onClick={fetchOrders}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={() => { setEditRow(null); setOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16} /> New Order
            </button>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(o => {
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
                {/* sheen */}
                <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="bg-slate-100 text-slate-700 border-slate-200">#{o.id}</Badge>
                      <Badge tone={statusTone}><BadgeCheck size={12} /> {o.status || "pending"}</Badge>
                      <Badge tone="bg-violet-100 text-violet-700 border-violet-200">
                        <Banknote size={12}/> {money(o.totalAmount)}
                      </Badge>
                      {o.paymentMethod && (
                        <Badge tone="bg-slate-100 text-slate-700 border-slate-200">
                          {o.paymentMethod}
                        </Badge>
                      )}
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
                        <span>{prettyDateTime(o.orderDate || o.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
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
                    onClick={() => handleDelete(o)}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                  >
                    <Trash2 size={16}/> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <FormModal
        title={editRow ? "Edit Order" : "Create Order"}
        open={open}
        onClose={() => { setOpen(false); setEditRow(null); }}
        fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
        initial={editRow || {}}
        onSubmit={handleSubmit}
      />
    </div>
  );
}