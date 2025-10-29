// src/pages/ProductProcessesPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, RefreshCw, Search, Trash2, Pencil, X, Package, Warehouse,
  Layers, FileText, ChevronLeft, ChevronRight
} from "lucide-react";
import { api } from "../utils/api";

/**
 * ProductProcessesPage
 * - List / pagination (server)
 * - Create process (admin+)
 * - View process
 * - Update start_qty (admin+)
 * - Delete process (admin+)
 *
 * Assumes backend endpoints:
 * GET  /product-processes            -> returns { data: [...], pagination: { total, page, limit, pages } }
 * GET  /product-processes/:id
 * POST /product-processes
 * PUT  /product-processes/:id
 * DELETE /product-processes/:id
 * GET  /product-processes/conversions/by-product-inventory/:product_id/:inventory_id
 * GET  /product-processes/conversions/all
 *
 * If your backend returns slightly different shapes, adjust `normalizeResponse` below.
 */

/* ---------------- small helpers ---------------- */
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(+d)) return "—";
  return d.toLocaleString();
}
function Badge({ children, tone = "bg-slate-100 text-slate-700 border-slate-200" }) {
  return <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${tone}`}>{children}</span>;
}

/* ---------------- Confirm dialog ---------------- */
function ConfirmDialog({ open, title = "Are you sure?", message, confirmLabel = "Confirm", tone = "rose", onConfirm, onClose }) {
  if (!open) return null;
  const toneBtn = tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700";
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />
      <div className="relative w-[min(640px,92vw)] overflow-hidden rounded-2xl border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">{message}</div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
          <button onClick={() => { onConfirm?.(); onClose?.(); }} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${toneBtn}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Create / Edit Modal ---------------- */
function ProcessModal({ open, title = "Create Product Process", inventories = [], products = [], units = [], initial = null, onClose, onSubmit }) {
  // initial and hooks must be unconditional
  const emptyProcItem = { product_id: "", unit_id: "", quantity: "" };

  const [form, setForm] = useState({
    product_id: "",
    inventory_id: "",
    start_unit_id: "",
    start_qty: "",
    processing_items: [ { ...emptyProcItem } ],
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        product_id: initial.product_id ?? initial.product?.id ?? "",
        inventory_id: initial.inventory_id ?? initial.inventory?.id ?? "",
        start_unit_id: initial.start_unit_id ?? initial.startUnit?.id ?? "",
        start_qty: String(initial.start_qty ?? initial.startQty ?? ""),
        processing_items: (initial.processings || []).map(p => ({
          product_id: p.product_id ?? p.product?.id ?? initial.product_id,
          unit_id: p.unit_id ?? p.unit?.id ?? "",
          quantity: String(p.quantity ?? "")
        })) || [ { ...emptyProcItem } ]
      });
    } else {
      setForm({
        product_id: "",
        inventory_id: "",
        start_unit_id: "",
        start_qty: "",
        processing_items: [ { ...emptyProcItem } ]
      });
    }
  }, [open, initial]);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setItem = (i, k, v) => setForm(prev => {
    const items = prev.processing_items.slice();
    items[i] = { ...items[i], [k]: v };
    return { ...prev, processing_items: items };
  });
  const addItem = () => setForm(prev => ({ ...prev, processing_items: [...prev.processing_items, { ...emptyProcItem }] }));
  const removeItem = (i) => setForm(prev => {
    const items = prev.processing_items.slice();
    items.splice(i, 1);
    return { ...prev, processing_items: items.length ? items : [ { ...emptyProcItem } ] };
  });

  // simple client-side preview: total converted quantity (sum of processing items)
  const preview = useMemo(() => {
    const items = (form.processing_items || []).map(it => Number(it.quantity || 0));
    return {
      sumConverted: items.reduce((s, n) => s + n, 0),
      startQty: Number(form.start_qty || 0)
    };
  }, [form]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    // basic validations
    if (!form.product_id) return alert("Product is required");
    if (!form.inventory_id) return alert("Inventory is required");
    if (!form.start_unit_id) return alert("Start unit is required");
    if (!form.start_qty || Number(form.start_qty) <= 0) return alert("start_qty must be positive");
    if (!Array.isArray(form.processing_items) || form.processing_items.length === 0) return alert("Add at least one processing item");
    for (const it of form.processing_items) {
      if (!it.product_id) return alert("Each processing item must have product_id");
      if (!it.unit_id) return alert("Each processing item must have unit_id");
      if (!it.quantity || Number(it.quantity) <= 0) return alert("Each processing item must have positive quantity");
    }

    // payload exactly as docs: do NOT include any extra fields
    const payload = {
      product_id: Number(form.product_id),
      inventory_id: Number(form.inventory_id),
      start_unit_id: Number(form.start_unit_id),
      start_qty: Number(form.start_qty),
      processing_items: form.processing_items.map(it => ({
        product_id: Number(it.product_id),
        unit_id: Number(it.unit_id),
        quantity: Number(it.quantity)
      }))
    };

    onSubmit(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[96]">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(900px,96vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto max-h-[92vh] rounded-2xl border bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white rounded-t-2xl">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Product *</label>
              <select value={form.product_id} onChange={e => setField("product_id", e.target.value)} className="w-full rounded-2xl border px-3 py-2">
                <option value="">Select product…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.productName || p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Inventory *</label>
              <select value={form.inventory_id} onChange={e => setField("inventory_id", e.target.value)} className="w-full rounded-2xl border px-3 py-2">
                <option value="">Select inventory…</option>
                {inventories.map(i => <option key={i.id} value={i.id}>{i.inventoryName || i.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Start unit *</label>
              <select value={form.start_unit_id} onChange={e => setField("start_unit_id", e.target.value)} className="w-full rounded-2xl border px-3 py-2">
                <option value="">Select start unit…</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Start quantity *</label>
              <input type="number" min="0" step="0.01" value={form.start_qty} onChange={e => setField("start_qty", e.target.value)} className="w-full rounded-2xl border px-3 py-2" />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-900 font-medium">Processing items</div>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">
                <Plus size={14} /> Add item
              </button>
            </div>

            <div className="space-y-3">
              {form.processing_items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_80px] gap-3 items-center">
                  <select value={it.product_id} onChange={e => setItem(idx, "product_id", e.target.value)} className="w-full rounded-2xl border px-3 py-2">
                    <option value="">Product *</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.productName || p.name}</option>)}
                  </select>

                  <select value={it.unit_id} onChange={e => setItem(idx, "unit_id", e.target.value)} className="w-full rounded-2xl border px-3 py-2">
                    <option value="">Unit *</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>

                  <input type="number" min="0" step="0.01" placeholder="Quantity *" value={it.quantity} onChange={e => setItem(idx, "quantity", e.target.value)} className="w-full rounded-2xl border px-3 py-2" />

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => removeItem(idx)} className="rounded-full bg-rose-500 p-2 text-white"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Preview: start qty = <strong>{preview.startQty}</strong> • converted sum = <strong>{preview.sumConverted}</strong>
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

/* ---------------- View Modal ---------------- */
function ViewModal({ open, process = null, onClose }) {
  if (!open || !process) return null;

  const startUnitName = process.startUnit?.name || "";
  const productName = process.product?.productName || process.product?.name || "—";
  const inventoryName = process.inventory?.inventoryName || process.inventory?.name || "—";

  return (
    <div className="fixed inset-0 z-[96] grid place-items-center">
      <div className="absolute inset-0 bg-slate-900/45" onClick={onClose} />
      <div className="relative w-[min(880px,94vw)] max-h-[90vh] overflow-auto rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Product Process</h3>
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

/* ---------------- Main Page ---------------- */
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

  // UI state
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);

  // fetch me
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

  // load references once
  useEffect(() => {
    (async () => {
      try {
        const [invRes, prodRes, unitRes] = await Promise.all([
          api.get("/inventory/"),
          api.get("/products/"),
          api.get("/units/")
        ]);
        setInventories((invRes?.data?.data ?? invRes?.data ?? []).slice());
        setProducts((prodRes?.data?.data ?? prodRes?.data ?? []).slice());
        setUnits((unitRes?.data?.data ?? unitRes?.data ?? []).slice());
      } catch (e) {
        // non-fatal
      }
    })();
  }, []);

  // normalize response helper (supports multiple shapes)
  const normalizeListResponse = (res, defaultPage = 1) => {
  const root = res?.data ?? {};
  const items = Array.isArray(root.data)
    ? root.data
    : Array.isArray(root.rows)
    ? root.rows
    : Array.isArray(res?.data)
    ? res.data
    : [];

  const pagination = root.pagination || {
    total: Number(root.total ?? root.count ?? (Array.isArray(items) ? items.length : 0)),
    page: Number(root.page ?? defaultPage),
    limit: Number(root.limit ?? perPage),
    // NOTE: parentheses added around (root.limit ?? perPage) so `|| 10` does not mix with `??`
    pages: Number(
      root.pages ??
        Math.ceil(
          (root.total ?? root.count ?? (Array.isArray(items) ? items.length : 0)) /
            ((root.limit ?? perPage) || 10)
        )
    ),
  };

  return { items, pagination };
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

  // create
  const handleCreate = async (payload) => {
    if (!isAdminOrAbove) { setErr("Only Admin or Superadmin can create processes"); return; }
    try {
      setErr(""); setOk("");
      await api.post("/product-processes", payload);
      setOk("Product process created");
      setOpenModal(false);
      fetchProcesses(page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Create failed");
    }
  };

  // update (only supports start_qty per docs)
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

  // delete
  const handleDelete = async (row) => {
    if (!isAdminOrAbove) { setErr("Only Admin or Superadmin can delete processes"); return; }
    try {
      setErr(""); setOk("");
      await api.delete(`/product-processes/${row.id}`);
      setOk("Product process deleted");
      // if last item on page removed, go back
      const goBack = processes.length === 1 && page > 1;
      fetchProcesses(goBack ? page - 1 : page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  };

  // fetch conversions by product+inventory (utility)
  const fetchConversionsByProductInventory = async (productId, inventoryId) => {
    try {
      const res = await api.get(`/product-processes/conversions/by-product-inventory/${productId}/${inventoryId}`);
      return res?.data ?? [];
    } catch (e) {
      return [];
    }
  };

  // fetch all process-derived stock entries
  const fetchAllProcessingStocks = async () => {
    try {
      const res = await api.get("/product-processes/conversions/all");
      return res?.data ?? [];
    } catch (e) {
      return [];
    }
  };

  // pagination helpers
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
          <p className="text-sm text-slate-500">Convert product units (processing). Creation and modifications are recorded in stock (method='processing').</p>
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

          {/* pagination */}
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(s => Math.max(1, s-1))} disabled={page <= 1} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40"><ChevronLeft size={16} /> Prev</button>

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
            // per docs only start_qty can be updated: send partial
            return handleUpdate(editing.id, { start_qty: payload.start_qty ?? payload.startQty ?? payload.startQty });
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