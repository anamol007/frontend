// src/pages/ProductsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Tag,
  Package2,
  Layers,
  DollarSign,
  X,
  Save,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { api } from "../utils/api";

/* ---------- constants & helpers ---------- */
const PAGE_SIZE = 10; // server-side page size

const cls = (...a) => a.filter(Boolean).join(" ");
const byAlpha = (get = (x) => x) =>
  (a, b) => `${get(a)}`.localeCompare(`${get(b)}`, undefined, { sensitivity: "base" });

function Field({ label, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function RateChip({ name, rate }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
      <Layers size={14} className="opacity-60" /> {name}: <span className="font-semibold">{rate}</span>
    </span>
  );
}

/* ---------- modal shells ---------- */
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(820px,96vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- confirm modal ---------- */
function ConfirmModal({ open, mode = "confirm", message = "", onCancel, onConfirm, confirmLabel = "Confirm" }) {
  if (!open) return null;
  const isConfirm = mode === "confirm";
  const isSuccess = mode === "success";
  const isError = mode === "error";
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)]">
        <div className={cls("flex items-center justify-between px-5 py-4 text-white",
          isConfirm ? "bg-slate-900" : isSuccess ? "bg-emerald-600" : "bg-rose-600")}>
          <div className="font-semibold">{isConfirm ? "Confirm" : isSuccess ? "Done" : "Error"}</div>
          <button onClick={onCancel} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="px-5 py-5">
          {isConfirm && <div className="text-slate-800">{message}</div>}
          {isSuccess && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-emerald-600" size={22} />
              <div className="text-slate-800">{message || "Success."}</div>
            </div>
          )}
          {isError && (
            <div className="flex items-start gap-3">
              <XCircle className="text-rose-600" size={22} />
              <div className="text-slate-800">{message || "Failed."}</div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/60 bg-white/70 px-5 py-3">
          {isConfirm ? (
            <>
              <button onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
              <button onClick={onConfirm} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">{confirmLabel}</button>
            </>
          ) : (
            <button onClick={onCancel} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- pager ---------- */
function Pager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < pages;
  const nums = pages <= 4 ? Array.from({ length: pages }, (_, i) => i + 1) : [1, 2, 3, 4];
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button onClick={() => onPage(Math.max(1, page - 1))} disabled={!canPrev}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40">Prev</button>

      {nums.map(n => (
        <button key={n} onClick={() => onPage(n)}
          className={`h-8 w-8 rounded-lg text-sm font-medium transition ${n === page ? 'bg-slate-900 text-white shadow' : 'border hover:bg-slate-100'}`}>
          {n}
        </button>
      ))}

      {pages > 4 && <span className="px-2 text-slate-400">…</span>}

      <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={!canNext}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40">Next</button>
    </div>
  );
}

/* ---------- main page ---------- */
export default function ProductsPage() {
  // role
  const [me, setMe] = useState(null);
  const isSuper = me?.role === "superadmin";

  // server state
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // ui
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // search + debounce
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const debounceRef = useRef(null);
  const [searching, setSearching] = useState(false);

  // editing/modals
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ productName: "", description: "", category_id: "" });
  const [initUnits, setInitUnits] = useState([]);

  // units modal
  const [openUnits, setOpenUnits] = useState(false);
  const [unitsForProduct, setUnitsForProduct] = useState([]);
  const [unitsProduct, setUnitsProduct] = useState(null);
  const [addUnitRow, setAddUnitRow] = useState({ unit_id: "", rate: "" });

  // confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState("confirm");
  const [confirmMsg, setConfirmMsg] = useState("");
  const confirmActionRef = useRef(() => {});

  // abort controller ref for cancelling in-flight requests
  const fetchControllerRef = useRef(null);

  // search keys to send (backend helper will examine req.query)
  const searchKeys = ["q", "query", "search", "searchTerm"];

  /* ---------- bootstrap: user + static lists ---------- */
  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const r = await api.get("/users/verify-token");
        const u = r?.data?.data?.user || r?.data?.user || r?.data;
        if (mounted) setMe(u || null);
      } catch {
        // ignore
      }

      // fetch units & categories (non-paged)
      try {
        const [uRes, cRes] = await Promise.allSettled([api.get("/units"), api.get("/categories")]);
        if (!mounted) return;
        const pick = (r) => {
          if (!r || r.status !== "fulfilled") return [];
          const root = r.value?.data ?? r.value;
          return Array.isArray(root.data) ? root.data : (Array.isArray(root) ? root : (Array.isArray(r.value?.data) ? r.value.data : []));
        };
        setUnits(pick(uRes));
        setCategories(pick(cRes));
      } catch (e) {
        // ignore
      }
    }
    boot();
    return () => { mounted = false; if (fetchControllerRef.current) fetchControllerRef.current.abort(); };
  }, []);

  /* ---------- fetch products (server-side) ---------- */
  async function fetchProducts(p = 1, search = debouncedQ) {
    // cancel previous
    if (fetchControllerRef.current) {
      try { fetchControllerRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    setLoading(true);
    setErr("");
    try {
      const params = { page: p, limit: PAGE_SIZE };
      if (search) {
        // send multiple common names so backend helper picks it up
        searchKeys.forEach(k => { params[k] = search; });
      }

      const res = await api.get("/products", { params, signal: controller.signal });

      const root = res?.data ?? {};

      // robustly pick items
      let items = Array.isArray(root.data) ? root.data
        : Array.isArray(root.rows) ? root.rows
        : Array.isArray(root.items) ? root.items
        : Array.isArray(res?.data) ? res.data
        : [];

      // parse pagination metadata
      const pagination = root.pagination ?? root.meta ?? root.paging ?? root._meta ?? null;
      let pagesCount = 1;
      let total = items.length;
      let currentPage = Number(p);

      if (pagination) {
        pagesCount = Number(pagination.pages ?? pagination.totalPages ?? pagination.total_pages ?? Math.max(1, Math.ceil((pagination.total ?? total) / (pagination.limit ?? PAGE_SIZE))));
        total = Number(pagination.total ?? pagination.totalItems ?? pagination.count ?? total);
        currentPage = Number(pagination.page ?? pagination.currentPage ?? p);
      } else if (typeof root.count === "number" && Array.isArray(root.rows)) {
        // Sequelize style: root.count + root.rows
        total = Number(root.count);
        pagesCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
        currentPage = Number(p);
      } else {
        // fallback: X-Total-Count header
        const headerTotal = Number(res?.headers?.["x-total-count"] ?? 0);
        if (headerTotal > 0) {
          total = headerTotal;
          pagesCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
          currentPage = Number(p);
        }
      }

      items = Array.isArray(items) ? items : [];

      setProducts(items);
      setPages(Number(pagesCount || 1));
      setTotalItems(Number(total || 0));
      setPage(Number(currentPage || p));
      setErr("");
    } catch (e) {
      if (e.name === "CanceledError" || e.name === "AbortError") {
        // aborted: ignore
      } else {
        console.error(e);
        setErr(e?.response?.data?.message || e?.message || "Failed to load products");
      }
    } finally {
      setLoading(false);
      fetchControllerRef.current = null;
    }
  }

  /* ---------- debounced search effect ---------- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  /* ---------- fetch when page or debouncedQ change ---------- */
  useEffect(() => {
    fetchProducts(page, debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ]);

  /* ---------- initial load ---------- */
  useEffect(() => { fetchProducts(1, debouncedQ); }, []); // run once on mount

  /* ---------- actions: create/edit/delete & units ---------- */
  const openCreate = () => {
    if (!isSuper) { setErr("Only Super Admin can create products"); return; }
    setEditing(null);
    setForm({ productName: "", description: "", category_id: "" });
    setInitUnits([]);
    setOpenEdit(true);
  };

  const openEditProduct = (p) => {
    if (!isSuper) { setErr("Only Super Admin can edit products"); return; }
    setEditing(p);
    setForm({
      productName: p.productName || "",
      description: p.description || "",
      category_id: p.category_id ?? p.categoryId ?? p?.category?.id ?? ""
    });
    setInitUnits([]);
    setOpenEdit(true);
  };

  async function submitProduct(e) {
    e.preventDefault();
    if (!isSuper) { setErr("Only Super Admin can perform this action"); return; }
    setErr(""); setOk("");
    try {
      const body = {
        productName: form.productName?.trim(),
        description: form.description?.trim(),
        category_id: form.category_id || null
      };
      if (!editing && initUnits.length > 0) {
        body.units = initUnits
          .filter(u => u.unit_id && u.rate !== "" && !Number.isNaN(Number(u.rate)))
          .map(u => ({ unit_id: Number(u.unit_id), rate: Number(u.rate) }));
      }
      if (editing?.id) {
        await api.put(`/products/${editing.id}`, body);
        setOk("Product updated");
      } else {
        await api.post("/products", body);
        setOk("Product created");
      }
      setOpenEdit(false);
      // if new product, fetch page 1 (backend likely orders newest first)
      await fetchProducts(editing ? page : 1, debouncedQ);
      if (!editing) setPage(1);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Action failed");
    }
  }

  function openConfirm({ message, onConfirm }) {
    setConfirmMsg(message);
    confirmActionRef.current = onConfirm;
    setConfirmMode("confirm");
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmMode("confirm");
    setConfirmMsg("");
    confirmActionRef.current = () => {};
  }

  function requestDeleteProduct(p) {
    if (!isSuper) { setErr("Only Super Admin can delete products"); return; }
    openConfirm({
      message: `Delete product “${p.productName}”? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.delete(`/products/${p.id}`);
          setConfirmMode("success");
          setConfirmMsg("Product deleted.");
          await fetchProducts(Math.max(1, page), debouncedQ);
        } catch (e) {
          setConfirmMode("error");
          setConfirmMsg(e?.response?.data?.message || e?.message || "Delete failed");
        }
      }
    });
  }

  async function openUnitsManager(p) {
    if (!isSuper) { setErr("Only Super Admin can manage unit rates"); return; }
    setUnitsProduct(p);
    setUnitsForProduct([]);
    setAddUnitRow({ unit_id: "", rate: "" });
    setOpenUnits(true);
    try {
      const r = await api.get(`/product-units/product/${p.id}`);
      const list = r?.data?.data ?? r?.data ?? [];
      setUnitsForProduct((Array.isArray(list) ? list : []).slice().sort(byAlpha(x => x?.unit?.name)));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load product units");
    }
  }

  async function addUnitToProduct() {
    if (!isSuper) { setErr("Only Super Admin can add unit rates"); return; }
    setErr(""); setOk("");
    try {
      const unit_id = Number(addUnitRow.unit_id);
      const rate = Number(addUnitRow.rate);
      if (!unitsProduct?.id || !unit_id || Number.isNaN(rate)) return;
      await api.post("/product-units", { product_id: unitsProduct.id, unit_id, rate });
      const r = await api.get(`/product-units/product/${unitsProduct.id}`);
      const list = r?.data?.data ?? r?.data ?? [];
      setUnitsForProduct((Array.isArray(list) ? list : []).slice().sort(byAlpha(x => x?.unit?.name)));
      setAddUnitRow({ unit_id: "", rate: "" });
      setOk("Unit added");
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Add failed");
    }
  }

  function requestRemoveUnit(puId) {
    if (!isSuper) { setErr("Only Super Admin can remove unit rates"); return; }
    openConfirm({
      message: "Remove this unit from the product?",
      onConfirm: async () => {
        try {
          await api.delete(`/product-units/${puId}`);
          setUnitsForProduct(prev => prev.filter(x => x.id !== puId));
          setConfirmMode("success");
          setConfirmMsg("Unit removed.");
        } catch (e) {
          setConfirmMode("error");
          setConfirmMsg(e?.response?.data?.message || e?.message || "Delete failed");
        }
      }
    });
  }

  async function updateUnitRate(puId, newRate) {
    if (!isSuper) { setErr("Only Super Admin can update unit rates"); return; }
    setErr(""); setOk("");
    try {
      await api.put(`/product-units/${puId}`, { rate: Number(newRate) });
      setOk("Rate updated");
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Update failed");
    }
  }

  /* ---------- render ---------- */
  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Package2 className="text-indigo-600" /> Products
            </h1>
            <p className="text-sm text-slate-500">
              {isSuper ? "Browse, create, edit and manage unit rates." : "Browse products and unit rates (read-only)."}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm sm:w-auto">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search product, category…"
                className="w-full sm:w-64 bg-transparent outline-none text-sm"
              />
              {/* small inline spinner when searching or loading */}
              <div className="ml-2">
                {(searching || loading) && (
                  <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.15" />
                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            </div>

            <button onClick={() => fetchProducts(1, debouncedQ)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100">
              <RefreshCw size={16} /> Refresh
            </button>

            {isSuper && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md">
                <Plus size={16} /> New Product
              </button>
            )}
          </div>
        </div>

        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(PAGE_SIZE)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">No products found.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl">
                <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                    <span className="text-lg font-semibold">{(p.productName || "?").charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-slate-900">{p.productName || "—"}</h3>
                    </div>
                    <p className="truncate text-sm text-slate-600">{p.description || "—"}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Tag size={14} /> {(p?.category?.name || "Uncategorized")}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(p.productUnits || []).slice().sort(byAlpha(x => x?.unit?.name)).map(u => (
                    <RateChip key={u.id} name={u?.unit?.name ?? "—"} rate={u?.rate ?? "—"} />
                  ))}
                  {(!p.productUnits || p.productUnits.length === 0) && <span className="text-xs text-slate-400">No rates yet</span>}
                </div>

                {isSuper && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button onClick={() => openUnitsManager(p)} className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <DollarSign size={16} /> Manage Units
                    </button>
                    <button onClick={() => openEditProduct(p)} className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <Pencil size={16} /> Edit
                    </button>
                    <button onClick={() => requestDeleteProduct(p)} className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Pager page={page} pages={pages} onPage={(p) => setPage(Math.max(1, Math.min(pages, p)))} />
        </>
      )}

      {/* Create/Edit Product Modal */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title={editing ? "Edit Product" : "New Product"} footer={
        <div className="flex justify-end gap-2">
          <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm" onClick={() => setOpenEdit(false)}>Cancel</button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={submitProduct}>
            <Save size={16} /> {editing ? "Save changes" : "Create"}
          </button>
        </div>
      }>
        <form onSubmit={submitProduct} className="grid gap-4">
          <Field label="Product Name">
            <input className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200" value={form.productName} onChange={(e) => setForm(f => ({ ...f, productName: e.target.value }))} required />
          </Field>

          <Field label="Description">
            <textarea className="min-h-[80px] rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>

          <Field label="Category">
            <select className="rounded-xl border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200" value={form.category_id} onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">— Select —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name || c.categoryName}</option>)}
            </select>
          </Field>

          {!editing && (
            <div className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium text-slate-700">Initial Units (optional)</div>
              <div className="grid gap-2">
                {initUnits.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <select className="w-48 rounded-xl border bg-white px-3 py-2" value={row.unit_id} onChange={(e) => {
                      const v = e.target.value;
                      setInitUnits(list => list.map((r, i) => i === idx ? { ...r, unit_id: v } : r));
                    }}>
                      <option value="">Unit…</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>

                    <input type="number" step="0.01" placeholder="Rate" className="w-36 rounded-xl border px-3 py-2" value={row.rate} onChange={(e) => {
                      const v = e.target.value;
                      setInitUnits(list => list.map((r, i) => i === idx ? { ...r, rate: v } : r));
                    }} />

                    <button type="button" onClick={() => setInitUnits(list => list.filter((_, i) => i !== idx))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button type="button" onClick={() => setInitUnits(list => [...list, { unit_id: "", rate: "" }])} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                  <Plus size={16} /> Add unit &amp; rate
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">You can also add/edit rates later with “Manage Units”.</p>
            </div>
          )}
        </form>
      </Modal>

      {/* Units modal */}
      <Modal open={openUnits} onClose={() => setOpenUnits(false)} title={unitsProduct ? `Manage Units — ${unitsProduct.productName}` : "Manage Units"}>
        <div className="grid gap-2">
          {unitsForProduct.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No units yet.</div>
          ) : (
            unitsForProduct.map(row => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
                <span className="min-w-28 rounded-lg bg-slate-100 px-2 py-1 text-sm">{row?.unit?.name ?? "—"}</span>
                <input type="number" step="0.01" defaultValue={row.rate} onBlur={(e) => updateUnitRate(row.id, e.target.value)} className="w-36 rounded-xl border px-3 py-2" />
                <button onClick={() => requestRemoveUnit(row.id)} className="ml-auto rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">Remove</button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 rounded-xl border p-3">
          <div className="mb-2 text-sm font-medium text-slate-700">Add unit</div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="w-48 rounded-xl border bg-white px-3 py-2" value={addUnitRow.unit_id} onChange={(e) => setAddUnitRow(r => ({ ...r, unit_id: e.target.value }))}>
              <option value="">Unit…</option>
              {units.filter(u => !unitsForProduct.some(r => r?.unit?.id === u.id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <input type="number" step="0.01" placeholder="Rate" className="w-36 rounded-xl border px-3 py-2" value={addUnitRow.rate} onChange={(e) => setAddUnitRow(r => ({ ...r, rate: e.target.value }))} />

            <button onClick={addUnitToProduct} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </Modal>

      {/* confirm */}
      <ConfirmModal open={confirmOpen} mode={confirmMode} message={confirmMsg} onCancel={() => closeConfirm()} onConfirm={async () => { await confirmActionRef.current(); }} confirmLabel="Delete" />
    </div>
  );
}