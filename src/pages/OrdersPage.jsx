// src/pages/OrdersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import {
  Search, Plus, RefreshCw, Package, User2, Building2,
  Banknote, CalendarClock, Pencil, Trash2, BadgeCheck
} from "lucide-react";
import FormModal from "../components/FormModal";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};
const PAYMENT = ["cash", "cheque", "card", "no"];
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

/* ------------ date formatter: 1st Jan, 2025 ------------ */
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
  const mon = d.toLocaleString(undefined, { month: "short" }); // Jan, Feb, …
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

export default function OrdersPage() {
  // auth / role
  const [me, setMe] = useState(null);
  const role = me?.role || "";
  const isSuper = role === "superadmin";
  const canCreate = isSuper || role === "admin"; // admins can create
  const canEditDelete = isSuper;                 // only superadmin can edit/delete

  // admin’s accessible inventories (via /summary)
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

  // resolve accessible inventories for admin via /summary?period=all
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

  // orders (backend already role-scopes)
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

  // filtering
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
    // prevent admin from editing
    if (!isSuper && editRow?.id) {
      setErr("Admins can’t edit orders — only create.");
      return;
    }

    const formCopy = { ...form };
    if (!isSuper && hasSingleInv) {
      formCopy.inventoryId = mySingleInvId;
    }

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

  async function handleDelete(row) {
    if (!canEditDelete) { setErr("Only Super Admin can delete orders"); return; }
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
                onClick={() => {
                  setEditRow(null);
                  setOpen(true);
                }}
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
                        {/* 👇 Use pretty date format */}
                        <span>{formatPrettyDate(o.orderDate || o.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buttons: only superadmin can edit/delete */}
                {canEditDelete && (
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
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
    </div>
  );
}