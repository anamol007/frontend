// src/pages/OrdersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { api } from "../utils/api";
import {
  Search, Plus, RefreshCw, Package, User2, Building2,
  Banknote, CalendarClock, Pencil, Trash2, BadgeCheck,
  X, FileText, Printer
} from "lucide-react";

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

/* -------------------- small helpers -------------------- */
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

/* -------------------- Confirm dialog -------------------- */
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

/* -------------------- SearchableSelect (portal) --------------------
  Renders dropdown into document.body so it's never clipped by parent overflow.
  Props:
    - value: current value
    - onChange(value)
    - options: [{ value, label }]
    - placeholder
    - required (boolean)
    - disabled (boolean)
*/
function SearchableSelect({ value, onChange, options = [], placeholder = "Select…", required = false, disabled = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [highlight, setHighlight] = useState(0);
  const toggleRef = useRef(null);
  const portalRef = useRef(null);

  // compute filtered list
  const list = useMemo(() => {
    const term = String(filter || "").trim().toLowerCase();
    if (!term) return options;
    return options.filter(o => (o.label || "").toLowerCase().includes(term));
  }, [options, filter]);

  // close on outside click (also closes portal)
  useEffect(() => {
    function onDoc(e) {
      if (toggleRef.current && toggleRef.current.contains(e.target)) return;
      if (portalRef.current && portalRef.current.contains(e.target)) return;
      setOpen(false);
      setFilter("");
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // keyboard nav
  function onKey(e) {
    if (!open) {
      if (e.key === "ArrowDown") { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "ArrowDown") { setHighlight(h => Math.min(h + 1, list.length - 1)); e.preventDefault(); }
    if (e.key === "ArrowUp") { setHighlight(h => Math.max(h - 1, 0)); e.preventDefault(); }
    if (e.key === "Enter") {
      const sel = list[highlight];
      if (sel) { onChange(sel.value); setOpen(false); setFilter(""); }
      e.preventDefault();
    }
    if (e.key === "Escape") { setOpen(false); setFilter(""); e.preventDefault(); }
  }

  // compute portal position relative to toggle
  const [portalStyle, setPortalStyle] = useState({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (!open) return;
    const el = toggleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 6; // small gap
    const left = rect.left + window.scrollX;
    const width = rect.width;
    setPortalStyle({ top, left, width });
    // recalc on resize/scroll
    function onResize() {
      const r = el.getBoundingClientRect();
      setPortalStyle({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [open]);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label ?? "";

  // portal content
  const dropdown = open ? (
    <div
      ref={portalRef}
      style={{ position: "absolute", top: portalStyle.top, left: portalStyle.left, width: portalStyle.width, zIndex: 9999 }}
      className="rounded-2xl"
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-lg">
        <div className="px-3 py-2">
          <input
            autoFocus
            className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none"
            placeholder="Type to search..."
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setHighlight(0); }}
            onKeyDown={onKey}
          />
        </div>
        <div className="max-h-48 overflow-auto">
          {list.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No results</div>
          ) : (
            list.map((opt, i) => (
              <div
                key={opt.value + i}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); /* keep focus */ }}
                onClick={() => { onChange(opt.value); setOpen(false); setFilter(""); }}
                className={`px-3 py-2 cursor-pointer ${i === highlight ? "bg-slate-100" : "hover:bg-slate-50"}`}
              >
                <div className="truncate text-sm text-slate-800">{opt.label}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div ref={toggleRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => { if (!disabled) { setOpen(o => !o); setFilter(""); } }}
          onKeyDown={onKey}
          className={`w-full text-left rounded-2xl border border-slate-300 bg-white px-3 py-2.5 ${disabled ? "opacity-60" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={`truncate ${selectedLabel ? "text-slate-900" : "text-slate-400"}`}>{selectedLabel || placeholder}</div>
            <div className="text-slate-400 text-xs">{open ? "▲" : "▾"}</div>
          </div>
        </button>
        {required && <input type="hidden" value={value || ""} required={required && !value} onChange={() => {}} />}
      </div>

      {open && typeof document !== "undefined" ? ReactDOM.createPortal(dropdown, document.body) : null}
    </>
  );
}

/* -------------------- Order Modal (embedded) -------------------- */
function OrderModal({
  open,
  title = "Create Order",
  customers = [],
  products = [],
  inventories = [],
  units = [],
  initial = null,
  onClose,
  onSubmit
}) {
  const emptyItem = { productId: "", unit_id: "", quantity: "" };

  const [form, setForm] = useState({
    customerId: "",
    inventoryId: "",
    paymentMethod: "no",
    status: "",
    notes: "",
    items: [{ ...emptyItem }]
  });

  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (initial) {
      const items = (initial.orderItems || []).map(it => ({
        productId: it.productId,
        unit_id: it.unit_id,
        quantity: String(it.quantity || "")
      }));
      setForm({
        customerId: initial.customerId || "",
        inventoryId: initial.inventoryId || "",
        paymentMethod: initial.paymentMethod || "no",
        status: initial.status || "",
        notes: initial.notes || "",
        items: items.length ? items : [{ ...emptyItem }]
      });
    } else {
      setForm({
        customerId: "",
        inventoryId: "",
        paymentMethod: "no",
        status: "",
        notes: "",
        items: [{ ...emptyItem }]
      });
    }
  }, [open, initial]);

  if (!open) return null;

  const setItem = (idx, key, value) => {
    setForm(prev => {
      const items = prev.items.slice();
      items[idx] = { ...items[idx], [key]: value };
      return { ...prev, items };
    });
  };
  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm(prev => {
    const items = prev.items.slice();
    items.splice(idx, 1);
    return { ...prev, items: items.length ? items : [{ ...emptyItem }] };
  });

  const validateAndSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!form.customerId) { setError("Customer is required."); return; }
    if (!form.inventoryId) { setError("Inventory is required."); return; }

    if (!form.items || form.items.length === 0) { setError("Please add at least one item."); return; }

    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      if (!it.productId) { setError(`Item ${i + 1}: product is required.`); return; }
      if (!it.unit_id) { setError(`Item ${i + 1}: unit is required.`); return; }
      const qv = Number(it.quantity || 0);
      if (!qv || qv <= 0) { setError(`Item ${i + 1}: quantity must be a positive number.`); return; }
    }

    const payload = {
      customerId: form.customerId,
      inventoryId: form.inventoryId,
      paymentMethod: form.paymentMethod,
      status: form.status || undefined,
      notes: form.notes || undefined,
      items: form.items.map(it => ({
        productId: it.productId,
        unit_id: it.unit_id,
        quantity: parseFloat(it.quantity || 0)
      }))
    };

    onSubmit(payload);
  };

  // map lists to { value, label }
  const custOpts = customers.map(c => ({ value: String(c.id), label: c.fullname || `#${c.id}` }));
  const invOpts = inventories.map(i => ({ value: String(i.id), label: i.inventoryName || `#${i.id}` }));
  const prodOpts = products.map(p => ({ value: String(p.id), label: p.productName || `#${p.id}` }));
  const unitOpts = units.map(u => ({ value: String(u.id), label: u.name || `#${u.id}` }));

  return (
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(920px,96vw)] -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-2xl border border-white/30 bg-white/95 shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white rounded-t-2xl">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={validateAndSubmit} className="p-5 space-y-4">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Customer *</label>
              <SearchableSelect
                value={String(form.customerId || "")}
                onChange={(v) => setForm(prev => ({ ...prev, customerId: v }))}
                options={custOpts}
                placeholder="Select customer…"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Inventory *</label>
              <SearchableSelect
                value={String(form.inventoryId || "")}
                onChange={(v) => setForm(prev => ({ ...prev, inventoryId: v }))}
                options={invOpts}
                placeholder="Select inventory…"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Payment</label>
              <select
                value={form.paymentMethod}
                onChange={e => setForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
              >
                {PAYMENT.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
              >
                <option value="">— select —</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <input
                placeholder="Optional notes..."
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-900 font-medium">Items</div>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">
                <Plus size={14} /> Add item
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_80px] gap-3 items-center">
                  <SearchableSelect
                    value={String(it.productId || "")}
                    onChange={(v) => setItem(idx, "productId", v)}
                    options={prodOpts}
                    placeholder="Product *"
                    required
                  />

                  <SearchableSelect
                    value={String(it.unit_id || "")}
                    onChange={(v) => setItem(idx, "unit_id", v)}
                    options={unitOpts}
                    placeholder="Unit *"
                    required
                  />

                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Quantity *"
                    value={it.quantity}
                    onChange={e => setItem(idx, "quantity", e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                  />

                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500 text-right">
                      <div>Rate</div>
                      <div className="font-medium">—</div>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} className="rounded-full bg-rose-500 p-2 text-white">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Tip: Do not enter a rate — the backend will use the configured product-unit rate.
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------- Main page -------------------- */
export default function OrdersPage() {
  const [me, setMe] = useState(null);
  const role = me?.role || "";
  const isSuper = role === "superadmin";
  const canCreate = isSuper || role === "admin";
  const canEditDelete = isSuper;

  const [myInvIds, setMyInvIds] = useState([]);
  const hasSingleInv = myInvIds.length === 1;
  const mySingleInvId = hasSingleInv ? myInvIds[0] : null;

  // server-side pagination
  const PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // filters & modal
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [invFilter, setInvFilter] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);

  // who am i?
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

  // resolve inventories available to user (for admin)
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

  // fetch reference lists
  useEffect(() => {
    (async () => {
      try {
        const [c, p, i, u] = await Promise.all([
          api.get("/customers/"),
          api.get("/products/"),
          api.get("/inventory/"),
          api.get("/units/"),
        ]);
        const cust = (c.data?.data ?? c.data ?? []).slice().sort((a,b)=> (a.fullname||'').localeCompare(b.fullname||''));
        const prod = (p.data?.data ?? p.data ?? []).slice().sort((a,b)=> (a.productName||'').localeCompare(b.productName||''));
        const invAll = (i.data?.data ?? i.data ?? []).slice().sort((a,b)=> (a.inventoryName||'').localeCompare(b.inventoryName||''));
        const unit = (u.data?.data ?? u.data ?? []).slice().sort((a,b)=> (a.name||'').localeCompare(b.name||''));
        setCustomers(cust);
        setProducts(prod);
        setInventories(isSuper ? invAll : invAll.filter(iv => myInvIds.includes(iv.id)));
        setUnits(unit);
      } catch (_) { /* non-fatal */ }
    })();
  }, [isSuper, myInvIds.join(",")]);

  // fetch orders with server-side pagination
  async function fetchOrders(nextPage = 1) {
    setLoading(true);
    setErr("");
    try {
      const params = { page: nextPage, limit: PER_PAGE };
      if (q) params.q = q;
      if (statusFilter) params.status = statusFilter;
      if (invFilter) params.inventoryId = invFilter;

      const res = await api.get("/orders/", { params });

      const root = res?.data ?? {};
      const rows = Array.isArray(root.data) ? root.data
                    : Array.isArray(root.rows) ? root.rows
                    : Array.isArray(res?.data) ? res.data
                    : [];

      const p = root.pagination || {};
      let current = Number(p.currentPage ?? nextPage) || Number(nextPage);
      let tPages = Number(p.totalPages ?? 1) || 1;
      let tCount = Number(p.totalCount ?? (root.total ?? root.count ?? rows.length)) || (rows.length || 0);
      let nextFlag = Boolean(p.hasNextPage ?? (tPages > current));
      let prevFlag = Boolean(p.hasPrevPage ?? (current > 1));

      if (Array.isArray(root.rows) && typeof root.count === "number") {
        tCount = Number(root.count);
        tPages = Math.max(1, Math.ceil(tCount / PER_PAGE));
        current = Number(nextPage);
        nextFlag = current < tPages;
        prevFlag = current > 1;
      } else if (Array.isArray(res?.data) && !root.pagination) {
        const headerTotal = Number(res?.headers?.["x-total-count"] ?? 0);
        if (headerTotal > 0) {
          tCount = headerTotal;
          tPages = Math.max(1, Math.ceil(tCount / PER_PAGE));
        } else {
          tCount = rows.length;
          tPages = Math.max(1, Math.ceil(tCount / PER_PAGE));
        }
        current = Number(nextPage);
        nextFlag = current < tPages;
        prevFlag = current > 1;
      }

      setOrders(Array.isArray(rows) ? rows : []);
      setPage(Number(current || nextPage));
      setTotalPages(Number(tPages || 1));
      setTotalCount(Number(tCount || 0));
      setHasNext(Boolean(nextFlag));
      setHasPrev(Boolean(prevFlag));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Error fetching orders");
    } finally {
      setLoading(false);
    }
  }

  // debounce q changes
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchOrders(1); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, invFilter]);

  const goPrev = () => { if (hasPrev && page > 1) fetchOrders(page - 1); };
  const goNext = () => { if (hasNext && page < totalPages) fetchOrders(page + 1); };

  function openCreateModal() {
    if (!canCreate) { setErr("Only Admin / Super Admin can create orders"); return; }
    setEditRow(null);
    setOpenModal(true);
  }
  function openEditModal(order) {
    if (!isSuper) { setErr("Only Super Admin can edit orders"); return; }
    setEditRow(order);
    setOpenModal(true);
  }

  function sanitizeItems(items) {
    return (items || []).map(it => ({
      productId: it.productId,
      unit_id: it.unit_id,
      quantity: Number(it.quantity || 0)
    }));
  }

  async function handleSubmit(payload) {
    try {
      setErr(""); setOk("");
      if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
        setErr("Please add at least one item");
        return;
      }
      const itemsClean = sanitizeItems(payload.items);
      for (const it of itemsClean) {
        if (!it.productId || !it.unit_id || !it.quantity || Number(it.quantity) <= 0) {
          setErr("Each item must have product, unit and positive quantity");
          return;
        }
      }

      if (!isSuper && hasSingleInv) payload.inventoryId = mySingleInvId;

      const body = {
        customerId: payload.customerId,
        inventoryId: payload.inventoryId,
        status: payload.status,
        paymentMethod: payload.paymentMethod,
        notes: payload.notes,
        items: itemsClean
      };

      if (editRow?.id && isSuper) {
        await api.put(`/orders/${editRow.id}`, body);
        setOk("Order updated");
      } else {
        await api.post("/orders/", body);
        setOk("Order created");
      }

      setOpenModal(false);
      setEditRow(null);
      fetchOrders(page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Action failed");
    }
  }

  async function deleteNow(row) {
    if (!canEditDelete) { setErr("Only Super Admin can delete orders"); return; }
    try {
      setErr(""); setOk("");
      await api.delete(`/orders/${row.id}`);
      setOk("Order deleted");
      const goBack = orders.length === 1 && page > 1;
      await fetchOrders(goBack ? page - 1 : page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  function buildPrintableReceiptHTML(order) {
    const id = order.id;
    const when = formatPrettyDate(order.orderDate || order.createdAt);
    const cust = order.customer || {};
    const inv  = order.inventory || {};
    const items = (order.orderItems || []).map(it => ({
      productName: it.product?.productName || `#${it.productId}`,
      unitName: it.unit?.name || '',
      quantity: Number(it.quantity || 0),
      rate: (typeof it.rate === 'number') ? it.rate.toFixed(2) : "—",
      amount: (typeof it.amount === 'number') ? it.amount.toFixed(2) : "—"
    }));
    const total = Number(order.totalAmount ?? 0).toFixed(2);

    const css = `
      *{box-sizing:border-box} body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;color:#0f172a}
      .wrap{padding:28px;max-width:820px;margin:0 auto}
      .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
      .muted{font-size:12px;color:#64748b;letter-spacing:.06em;text-transform:uppercase}
      .table{border:1px solid #e2e8f0;border-radius:8px;margin-top:12px;overflow:hidden}
      .thead{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;background:#f8fafc;padding:10px 12px;font-size:12px;font-weight:700;color:#475569}
      .row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:12px;border-top:1px solid #e2e8f0;font-size:14px}
      .right{text-align:right}
      .summary{margin-top:16px;display:flex;justify-content:flex-end}
      .summary .card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;min-width:220px}
      @page{size:auto;margin:14mm}
    `;
    const itemsRows = items.map(it => `
      <div class="row">
        <div>
          <div style="font-weight:600">${it.productName}</div>
          <div style="font-size:12px;color:#64748b">${it.unitName}</div>
        </div>
        <div class="right">${it.quantity}</div>
        <div class="right">${it.rate}</div>
        <div class="right">${it.amount}</div>
      </div>
    `).join('');

    return `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice #${id}</title><style>${css}</style></head><body>
      <div class="wrap">
        <div class="top"><div><div style="font-weight:700;font-size:18px">Invoice</div><div style="font-size:12px;color:#64748b">#${id}</div></div>
        <div style="text-align:right"><div style="font-size:12px;color:#64748b">${when}</div><div style="margin-top:8px">${cust.fullname || '—'}</div><div style="font-size:12px;color:#64748b">${inv.inventoryName || ''}</div></div></div>
        <div class="table"><div class="thead"><div>Product</div><div class="right">Qty</div><div class="right">Rate</div><div class="right">Amount</div></div>${itemsRows}</div>
        <div class="summary"><div class="card"><div style="display:flex;justify-content:space-between"><div>Subtotal</div><div>${total}</div></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:700"><div>Total</div><div>${total}</div></div></div></div>
      </div>
    </body></html>`;
  }

  function printHTMLInIframe(html) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.inset = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };
    const triggerPrint = () => {
      if (done) return;
      try {
        const w = iframe.contentWindow;
        if (!w) return;
        w.focus();
        w.print();
      } catch (_) {}
      setTimeout(cleanup, 600);
    };

    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { cleanup(); return; }
    iframe.addEventListener("load", triggerPrint, { once: true });
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(triggerPrint, 300);
  }

  function printOrder(order) {
    const html = buildPrintableReceiptHTML(order);
    printHTMLInIframe(html);
  }

  /* -------------------- UI rendering -------------------- */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? "Create, edit, or manage orders. Pagination and totals are handled server-side."
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
              onClick={() => fetchOrders(page)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            {(isSuper || role === "admin") && (
              <button
                onClick={() => { setEditRow(null); setOpenModal(true); }}
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
      ) : (orders.length === 0) ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">No orders found.</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orders.map(o => {
              const cust = o.customer?.fullname || "—";
              const prodNames = (o.orderItems || []).map(it => it.product?.productName || `#${it.productId}`).join(", ");
              const inv  = o.inventory?.inventoryName || "—";
              const qtyTotal = (o.orderItems || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
              const statusTone = STATUS_COLORS[o.status] || STATUS_COLORS.pending;

              return (
                <div key={o.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl">
                  <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="bg-slate-100 text-slate-700 border-slate-200">#{o.id}</Badge>
                        <Badge tone={statusTone}><BadgeCheck size={12} /> {o.status || "pending"}</Badge>
                        <Badge tone="bg-violet-100 text-violet-700 border-violet-200"><Banknote size={12}/> {Number(o.totalAmount ?? 0).toFixed(2)}</Badge>
                      </div>

                      <h3 className="mt-2 line-clamp-1 text-base font-semibold text-slate-900">{prodNames || "—"}</h3>
                      <div className="mt-1 grid gap-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><User2 size={14} className="text-slate-400"/><span className="truncate">{cust}</span></div>
                        <div className="flex items-center gap-2"><Building2 size={14} className="text-slate-400"/><span className="truncate">{inv}</span></div>
                        <div className="flex items-center gap-2"><Package size={14} className="text-slate-400"/><span>{qtyTotal} items</span></div>
                        <div className="flex items-center gap-2"><CalendarClock size={14} className="text-slate-400"/><span>{formatPrettyDate(o.orderDate || o.createdAt)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button onClick={() => { setReceiptOrder(o); setReceiptOpen(true); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <FileText size={16}/> Invoice
                    </button>

                    {canEditDelete && (
                      <>
                        <button onClick={() => openEditModal(o)} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                          <Pencil size={16}/> Edit
                        </button>
                        <button onClick={() => { setTargetRow(o); setConfirmOpen(true); }} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">
                          <Trash2 size={16}/> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination - same style as CategoriesPage */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={goPrev}
              disabled={!hasPrev || page <= 1}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
              title="Previous"
            >
              <span className="opacity-60">‹</span> Prev
            </button>

            {(() => {
              const chips = [];
              const start = Math.max(1, page - 1);
              const end = Math.min(totalPages, page + 1);
              for (let i = start; i <= end; i++) chips.push(i);
              if (page === 1 && totalPages >= 2 && !chips.includes(2)) chips.push(2);
              return chips.map((n) => (
                <button
                  key={n}
                  onClick={() => fetchOrders(n)}
                  className={
                    n === page
                      ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-50"
                  }
                >
                  {n}
                </button>
              ));
            })()}

            <button
              onClick={goNext}
              disabled={!hasNext || page >= totalPages}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
              title="Next"
            >
              Next <span className="opacity-60">›</span>
            </button>
          </div>
        </>
      )}

      {/* Order modal */}
      <OrderModal
        open={openModal}
        title={editRow ? "Edit Order" : "Create Order"}
        customers={customers}
        products={products}
        inventories={inventories}
        units={units}
        initial={editRow}
        onClose={() => { setOpenModal(false); setEditRow(null); }}
        onSubmit={handleSubmit}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete Order"
        message={targetRow ? `Are you sure you want to delete order #${targetRow.id}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        tone="rose"
        onConfirm={() => targetRow && deleteNow(targetRow)}
        onClose={() => { setConfirmOpen(false); setTargetRow(null); }}
      />

      {/* Receipt preview */}
      {receiptOpen && receiptOrder && (
        <div className="fixed inset-0 z-[96] grid place-items-center">
          <div className="absolute inset-0 bg-slate-900/45" onClick={() => setReceiptOpen(false)} />
          <div className="relative w-[min(820px,94vw)] max-h-[90vh] overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Order Invoice</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { printOrder(receiptOrder); }} className="rounded-lg bg-slate-100 px-3 py-2 text-sm"><Printer size={14}/> Print</button>
                <button onClick={() => setReceiptOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16}/></button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex justify-between">
                <div>
                  <div className="text-xs text-slate-500">Invoice</div>
                  <div className="text-xl font-semibold text-slate-900">#{receiptOrder.id}</div>
                  <div className="text-sm text-slate-600">{formatPrettyDate(receiptOrder.orderDate || receiptOrder.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-700">{receiptOrder.customer?.fullname || "—"}</div>
                  <div className="text-xs text-slate-500">{receiptOrder.inventory?.inventoryName || ""}</div>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <span>Product</span><span className="text-right">Qty</span><span className="text-right">Unit Price</span><span className="text-right">Amount</span>
                </div>

                {(receiptOrder.orderItems || []).map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center border-t px-3 py-3 text-sm">
                    <div className="min-w-0"><div className="truncate font-medium text-slate-900">{it.product?.productName || `#${it.productId}`}</div><div className="text-xs text-slate-500">{it.unit?.name || ""}</div></div>
                    <div className="text-right tabular-nums">{it.quantity}</div>
                    <div className="text-right tabular-nums">{(typeof it.rate === "number") ? it.rate.toFixed(2) : "—"}</div>
                    <div className="text-right font-semibold tabular-nums">{(typeof it.amount === "number") ? it.amount.toFixed(2) : "—"}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-64 rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between text-sm"><div>Subtotal</div><div className="font-medium">{Number(receiptOrder.totalAmount || 0).toFixed(2)}</div></div>
                  <div className="mt-3 flex items-center justify-between text-base font-semibold"><div>Total</div><div>{Number(receiptOrder.totalAmount || 0).toFixed(2)}</div></div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}