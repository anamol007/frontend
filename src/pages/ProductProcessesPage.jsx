// src/pages/ProductProcessesPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Pencil,
  X,
  Warehouse,
  Layers,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "../utils/api";

const formatDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(+d) ? "—" : d.toLocaleString();
};
const cls = (...parts) => parts.filter(Boolean).join(" ");

function Badge({ children, tone = "bg-slate-100 text-slate-700 border-slate-200" }) {
  return <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${tone}`}>{children}</span>;
}

/* SearchableSelect (strings or {value,label}) */
function SearchableSelect({ value, onChange, options = [], placeholder = "Select…", className = "" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const normalized = useMemo(() => options.map(o => (typeof o === "string" ? { value: o, label: o } : o)), [options]);
  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return normalized;
    return normalized.filter(o => (o.label || "").toLowerCase().includes(s) || String(o.value).toLowerCase().includes(s));
  }, [q, normalized]);

  const selected = normalized.find(o => String(o.value) === String(value));
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="w-full rounded-2xl border bg-white px-3 py-2 text-left text-sm flex items-center justify-between"
      >
        <span className={`truncate ${selected ? "" : "text-gray-400"}`}>{selected ? selected.label : placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-2xl border bg-white shadow">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                className="w-full rounded-md border px-10 py-2 text-sm outline-none"
                placeholder="Search..."
              />
            </div>
          </div>

          <div className="max-h-44 overflow-auto">
            {filtered.length === 0 && <div className="p-3 text-sm text-gray-500">No options</div>}
            {filtered.map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); setQ(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Plain confirm dialog */
function ConfirmDialog({ open, title = "Are you sure?", message = "", confirmLabel = "Confirm", tone = "rose", onConfirm, onClose }) {
  if (!open) return null;
  const toneBtn = tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700";
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[min(640px,92vw)] overflow-hidden rounded-2xl border bg-white shadow">
        <div className="flex items-center justify-between border-b px-5 py-4 bg-white">
          <h3 className="text-base font-medium text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 text-sm text-slate-700">{message}</div>

        <div className="flex justify-end gap-2 border-t px-5 py-3 bg-white">
          <button onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
          <button onClick={() => { onConfirm?.(); onClose?.(); }} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${toneBtn}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* Plain process modal */
function ProcessModal({ open, title = "Create Product Process", inventories = [], products = [], units = [], initial = null, onClose, onSubmit }) {
  const emptyItem = { product_id: "", unit_id: "", quantity: "" };

  const [form, setForm] = useState({
    product_id: "",
    inventory_id: "",
    start_unit_id: "",
    start_qty: "",
    processing_items: [{ ...emptyItem }],
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        product_id: initial.product_id ?? initial.product?.id ?? "",
        inventory_id: initial.inventory_id ?? initial.inventory?.id ?? "",
        start_unit_id: initial.start_unit_id ?? initial.startUnit?.id ?? "",
        start_qty: String(initial.start_qty ?? initial.startQty ?? ""),
        processing_items:
          (initial.processings || []).map(p => ({
            product_id: p.product_id ?? p.product?.id ?? initial.product_id ?? "",
            unit_id: p.unit_id ?? p.unit?.id ?? "",
            quantity: String(p.quantity ?? "")
          })) || [{ ...emptyItem }],
      });
    } else {
      setForm({
        product_id: "",
        inventory_id: "",
        start_unit_id: "",
        start_qty: "",
        processing_items: [{ ...emptyItem }],
      });
    }
  }, [open, initial]);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setItem = (i, k, v) => setForm(prev => {
    const items = prev.processing_items.slice();
    items[i] = { ...items[i], [k]: v };
    return { ...prev, processing_items: items };
  });
  const addItem = () => setForm(prev => ({ ...prev, processing_items: [...prev.processing_items, { ...emptyItem }] }));
  const removeItem = (i) => setForm(prev => {
    const items = prev.processing_items.slice();
    items.splice(i, 1);
    return { ...prev, processing_items: items.length ? items : [{ ...emptyItem }] };
  });

  const preview = useMemo(() => {
    const sumConverted = (form.processing_items || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
    const startQty = Number(form.start_qty || 0);
    return { sumConverted, startQty };
  }, [form]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();

    if (!form.product_id) return alert("Product is required");
    if (!form.inventory_id) return alert("Inventory is required");
    if (!form.start_unit_id) return alert("Start unit is required");
    if (!form.start_qty || Number(form.start_qty) <= 0) return alert("Start quantity must be positive");
    if (!Array.isArray(form.processing_items) || form.processing_items.length === 0) return alert("Add at least one processing item");
    for (const it of form.processing_items) {
      if (!it.product_id) return alert("Each processing item requires a product");
      if (!it.unit_id) return alert("Each processing item requires a unit");
      if (!it.quantity || Number(it.quantity) <= 0) return alert("Each processing item requires a positive quantity");
    }

    const payload = {
      product_id: Number(form.product_id),
      inventory_id: Number(form.inventory_id),
      start_unit_id: Number(form.start_unit_id),
      start_qty: Number(form.start_qty),
      processing_items: form.processing_items.map(it => ({
        product_id: Number(it.product_id),
        unit_id: Number(it.unit_id),
        quantity: Number(it.quantity),
      })),
    };

    onSubmit(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[96]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(920px,96vw)] -translate-x-1/2 -translate-y-1/2 max-h-[92vh] overflow-auto rounded-2xl border bg-white shadow">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-white">
          <div className="text-lg font-medium text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Product *</label>
              <SearchableSelect
                value={form.product_id}
                onChange={(v) => setField("product_id", v)}
                options={[{ value: "", label: "Select product…" }, ...products.map(p => ({ value: p.id, label: p.productName || p.name }))]}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Inventory *</label>
              <SearchableSelect
                value={form.inventory_id}
                onChange={(v) => setField("inventory_id", v)}
                options={[{ value: "", label: "Select inventory…" }, ...inventories.map(i => ({ value: i.id, label: i.inventoryName || i.name }))]}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Start unit *</label>
              <SearchableSelect
                value={form.start_unit_id}
                onChange={(v) => setField("start_unit_id", v)}
                options={[{ value: "", label: "Select unit…" }, ...units.map(u => ({ value: u.id, label: u.name }))]}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Start quantity *</label>
              <input type="number" min="0" step="0.01" value={form.start_qty} onChange={e => setField("start_qty", e.target.value)} className="w-full rounded-2xl border px-3 py-2" />
            </div>
          </div>

          <div className="rounded-2xl border p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-900 font-medium">Processing items</div>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">
                <Plus size={14} /> Add item
              </button>
            </div>

            <div className="space-y-3">
              {form.processing_items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_72px] gap-3 items-center">
                  <SearchableSelect
                    value={it.product_id}
                    onChange={(v) => setItem(idx, "product_id", v)}
                    options={[{ value: "", label: "Product…" }, ...products.map(p => ({ value: p.id, label: p.productName || p.name }))]}
                  />

                  <SearchableSelect
                    value={it.unit_id}
                    onChange={(v) => setItem(idx, "unit_id", v)}
                    options={[{ value: "", label: "Unit…" }, ...units.map(u => ({ value: u.id, label: u.name }))]}
                  />

                  <input type="number" min="0" step="0.01" placeholder="Quantity" value={it.quantity} onChange={(e) => setItem(idx, "quantity", e.target.value)} className="w-full rounded-2xl border px-3 py-2" />

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => removeItem(idx)} className="rounded-full bg-rose-500 p-2 text-white hover:opacity-90"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Preview — start qty: <strong>{preview.startQty}</strong> • converted sum: <strong>{preview.sumConverted}</strong>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Plain view modal */
function ViewModal({ open, process = null, onClose }) {
  if (!open || !process) return null;
  const startUnitName = process.startUnit?.name || "";
  const productName = process.product?.productName || process.product?.name || `#${process.product_id}`;
  const inventoryName = process.inventory?.inventoryName || process.inventory?.name || "—";

  return (
    <div className="fixed inset-0 z-[96] grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[min(880px,94vw)] max-h-[90vh] overflow-auto rounded-2xl border bg-white shadow">
        <div className="flex items-center justify-between border-b px-5 py-4 bg-white">
          <h3 className="text-base font-medium text-slate-900">Product Process</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-slate-500">Product</div>
              <div className="text-lg font-semibold text-slate-900">{productName}</div>
              <div className="text-sm text-slate-600">{inventoryName}</div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">Created</div>
              <div className="text-sm text-slate-700">{formatDate(process.createdAt)}</div>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr] items-center bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <div>Start (unit)</div><div className="text-right">Qty</div><div className="text-right">Unit</div>
            </div>
            <div className="grid grid-cols-[2fr_1fr_1fr] px-3 py-3 items-center border-t">
              <div>{productName}</div>
              <div className="text-right">{process.start_qty}</div>
              <div className="text-right">{startUnitName}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-slate-800">Converted items</div>
            <div className="rounded-xl border overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr] items-center bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <div>Product</div><div className="text-right">Qty</div><div className="text-right">Unit</div>
              </div>

              {(process.processings || []).map((it, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr_1fr] items-center px-3 py-3 border-t">
                  <div className="min-w-0 truncate">{it.product?.productName || `#${it.product_id}`}</div>
                  <div className="text-right tabular-nums">{it.quantity}</div>
                  <div className="text-right">{it.unit?.name || it.unit_id}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function ProductProcessesPage() {
  const [me, setMe] = useState(null);
  const role = me?.role || "";
  const isAdminOrAbove = role === "admin" || role === "superadmin";

  const [processes, setProcesses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [inventories, setInventories] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [q, setQ] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/users/verify-token");
        const u = r?.data?.data?.user || r?.data?.user || r?.data;
        setMe(u || null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [invRes, prodRes, unitRes] = await Promise.all([
          api.get("/inventory/"),
          api.get("/products/"),
          api.get("/units/"),
        ]);
        setInventories((invRes?.data?.data ?? invRes?.data ?? []).slice());
        setProducts((prodRes?.data?.data ?? prodRes?.data ?? []).slice());
        setUnits((unitRes?.data?.data ?? unitRes?.data ?? []).slice());
      } catch {
        // non-fatal
      }
    })();
  }, []);

  const normalizeListResponse = (res, defaultPage = 1) => {
    const root = res?.data ?? {};
    const items = Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.rows)
      ? root.rows
      : Array.isArray(res?.data)
      ? res.data
      : [];

    const totalCount = Number(root.total ?? root.count ?? (Array.isArray(items) ? items.length : 0));
    const limit = Number(root.limit ?? perPage);
    const pages = Number(root.pages ?? Math.max(1, Math.ceil(totalCount / (limit || perPage))));
    const pageNum = Number(root.page ?? defaultPage);

    return { items, pagination: { total: totalCount, page: pageNum, limit: limit || perPage, pages } };
  };

  const fetchProcesses = useCallback(async (p = 1) => {
    setLoading(true); setErr(""); setOk("");
    try {
      const params = { page: p, limit: perPage };
      if (q) params.q = q;
      const res = await api.get("/product-processes", { params });
      const { items, pagination } = normalizeListResponse(res, p);
      setProcesses(items);
      setTotal(Number(pagination.total || 0));
      setPage(Number(pagination.page || p));
      setPerPage(Number(pagination.limit || perPage));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Error fetching product processes");
    } finally {
      setLoading(false);
    }
  }, [perPage, q]);

  useEffect(() => { setPage(1); fetchProcesses(1); }, [q, fetchProcesses]);
  useEffect(() => { fetchProcesses(page); }, [page, fetchProcesses]);

  const handleCreate = async (payload) => {
    if (!isAdminOrAbove) { setErr("Only Admin or Superadmin can create processes"); return; }
    try {
      setErr(""); setOk("");
      await api.post("/product-processes", payload);
      setOk("Product process created");
      setOpenModal(false);
      fetchProcesses(1);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Create failed");
    }
  };

  const handleUpdate = async (id, partial) => {
    if (!isAdminOrAbove) { setErr("Only Admin or Superadmin can update processes"); return; }
    try {
      setErr(""); setOk("");
      await api.put(`/product-processes/${id}`, partial);
      setOk("Product process updated");
      setEditing(null);
      setOpenModal(false);
      fetchProcesses(page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Update failed");
    }
  };

  const handleDelete = async (row) => {
    if (!isAdminOrAbove) { setErr("Only Admin or Superadmin can delete processes"); return; }
    try {
      setErr(""); setOk("");
      await api.delete(`/product-processes/${row.id}`);
      setOk("Product process deleted");
      const goBack = processes.length === 1 && page > 1;
      fetchProcesses(goBack ? page - 1 : page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  };

  const fetchConversionsByProductInventory = async (productId, inventoryId) => {
    try {
      const res = await api.get(`/product-processes/conversions/by-product-inventory/${productId}/${inventoryId}`);
      return res?.data ?? [];
    } catch {
      return [];
    }
  };
  const fetchAllProcessingStocks = async () => {
    try {
      const res = await api.get("/product-processes/conversions/all");
      return res?.data ?? [];
    } catch {
      return [];
    }
  };

  const pages = Math.max(1, Math.ceil(total / perPage));
  const windowSize = 5;
  let lo = Math.max(1, page - Math.floor(windowSize / 2));
  let hi = Math.min(pages, lo + windowSize - 1);
  lo = Math.max(1, hi - windowSize + 1);
  const nums = [];
  for (let p = lo; p <= hi; p++) nums.push(p);

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Product Processes</h1>
          <p className="text-sm text-slate-500">Convert product units. Creation and modifications create processing stock entries.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product/process id…" className="pl-10 pr-3 py-2 rounded-2xl border border-slate-200 bg-white text-sm w-64" />
          </div>

          <button onClick={() => fetchProcesses(page)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            <RefreshCw size={16} /> Refresh
          </button>

          {isAdminOrAbove && (
            <button onClick={() => { setEditing(null); setOpenModal(true); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> New Process
            </button>
          )}
        </div>
      </div>

      {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      {ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl border bg-white/60" />)}
        </div>
      ) : processes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">No product processes found.</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {processes.map(proc => {
              const prodName = proc.product?.productName || proc.product?.name || `#${proc.product_id}`;
              const invName = proc.inventory?.inventoryName || proc.inventory?.name || "—";
              const convertedCount = (proc.processings || []).length;
              return (
                <div key={proc.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex gap-2 items-center">
                        <Badge>#{proc.id}</Badge>
                        <Badge tone="bg-emerald-100 text-emerald-700 border-emerald-200"><Layers size={12} /> {convertedCount}</Badge>
                      </div>

                      <h3 className="mt-2 text-base font-semibold text-slate-900">{prodName}</h3>
                      <div className="mt-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><Warehouse size={14} /><span className="truncate">{invName}</span></div>
                        <div className="mt-1 text-xs text-slate-500">Start: {proc.start_qty} {proc.startUnit?.name || ""}</div>
                        <div className="mt-1 text-xs text-slate-500">Created: {formatDate(proc.createdAt)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button onClick={() => { setViewing(proc); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      <FileText size={16} /> View
                    </button>

                    {isAdminOrAbove && (
                      <>
                        <button onClick={() => { setEditing(proc); setOpenModal(true); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                          <Pencil size={16} /> Edit
                        </button>
                        <button onClick={() => { setTargetRow(proc); setConfirmOpen(true); }} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white">
                          <Trash2 size={16} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(s => Math.max(1, s - 1))} disabled={page <= 1} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40"><ChevronLeft size={16} /> Prev</button>

              {lo > 1 && <>
                <button onClick={() => setPage(1)} className="rounded-2xl border px-4 py-2 text-sm">1</button>
                {lo > 2 && <span className="px-2">…</span>}
              </>}

              {nums.map(n => (
                n === page
                  ? <span key={n} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">{n}</span>
                  : <button key={n} onClick={() => setPage(n)} className="rounded-2xl border px-4 py-2 text-sm">{n}</button>
              ))}

              {hi < pages && <>
                {hi < pages - 1 && <span className="px-2">…</span>}
                <button onClick={() => setPage(pages)} className="rounded-2xl border px-4 py-2 text-sm">{pages}</button>
              </>}

              <button onClick={() => setPage(s => Math.min(pages, s + 1))} disabled={page >= pages} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40">Next <ChevronRight size={16} /></button>
            </div>
          </div>
        </>
      )}

      <ProcessModal
        open={openModal}
        title={editing ? "Edit Product Process" : "Create Product Process"}
        inventories={inventories}
        products={products}
        units={units}
        initial={editing}
        onClose={() => { setOpenModal(false); setEditing(null); }}
        onSubmit={(payload) => {
          if (editing && editing.id) {
            return handleUpdate(editing.id, { start_qty: payload.start_qty ?? payload.startQty ?? payload.start_qty });
          }
          return handleCreate(payload);
        }}
      />

      <ViewModal open={Boolean(viewing)} process={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Product Process"
        message={targetRow ? `Are you sure you want to delete product process #${targetRow.id}? This will remove processing records and associated stock entries.` : ""}
        confirmLabel="Delete"
        tone="rose"
        onConfirm={() => targetRow && handleDelete(targetRow)}
        onClose={() => { setConfirmOpen(false); setTargetRow(null); }}
      />
    </div>
  );
}