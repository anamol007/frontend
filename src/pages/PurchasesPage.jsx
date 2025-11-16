// src/pages/PurchasesPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  Printer,
  X,
  Pencil,
  Trash2,
  Banknote,
  Calendar,
  FileText,
} from "lucide-react";
import { api } from "../utils/api";

/* --------------------------- date formatting --------------------------- */
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtPrettyDate(input) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(+d)) return "—";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${ordinal(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}
/* keep ISO helper for date inputs */
const formatDateInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  return d.toISOString().slice(0, 10);
};

/* --------------------------- small UI helpers --------------------------- */
function Badge({ children, tone = "bg-slate-100 text-slate-700 border-slate-200" }) {
  return <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${tone}`}>{children}</span>;
}

/* ---------- SearchableSelect (simple) ---------- */
function SearchableSelect({ value, onChange, options = [], placeholder = "Select…", className = "", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const opts = useMemo(() => {
    return options.map(o => {
      if (typeof o === "string" || typeof o === "number") return { value: o, label: String(o) };
      return { value: o.value ?? o.id ?? o, label: o.label ?? o.name ?? String(o.value ?? o.id ?? o) };
    });
  }, [options]);

  const selected = opts.find(o => String(o.value) === String(value)) ?? null;
  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return opts;
    return opts.filter(it => (it.label || "").toLowerCase().includes(s) || String(it.value).toLowerCase().includes(s));
  }, [opts, q]);

  useEffect(() => {
    const onDoc = (e) => { if (!e.target || !(e.target instanceof Element)) return; if (!e.target.closest?.(".searchable-select-root")) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div className={`searchable-select-root relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`w-full text-left rounded-2xl border px-3 py-2 bg-white ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center justify-between">
          <div className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>{selected?.label ?? placeholder}</div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl border bg-white shadow">
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
            {filtered.map((opt) => (
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

/* ---------- Confirm dialog ---------- */
function ConfirmDialog({ open, title="Are you sure?", message, confirmLabel="Confirm", tone="rose", onConfirm, onClose }) {
  if (!open) return null;
  const toneBtn = tone === "rose" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700";
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[min(720px,94vw)] rounded-2xl border bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">{message}</div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={() => { onConfirm?.(); onClose?.(); }} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${toneBtn}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Print helpers (use fmtPrettyDate) ---------- */
function buildPrintablePurchaseHTML(purchase) {
  const id = purchase.id;
  const when = fmtPrettyDate(purchase.purchaseDate || purchase.createdAt);
  const inventory = purchase.inventory || {};
  const supplier = purchase.supplier || {};
  const items = (purchase.purchaseItems || []).map(it => ({
    name: it.product?.productName || `#${it.productId}`,
    unit: it.unit?.name || "",
    qty: Number(it.quantity || 0),
    rate: (typeof it.rate === "number" || typeof it.rate === "string") ? Number(it.rate).toFixed(2) : "—",
    total: (typeof it.total === "number" || typeof it.total === "string") ? Number(it.total).toFixed(2) : "—"
  }));
  const subtotal = Number(purchase.subTotal ?? purchase.subtotal ?? purchase.total ?? 0).toFixed(2);
  const grand = Number(purchase.grandTotal ?? purchase.grand_total ?? subtotal).toFixed(2);

  const css = `*{box-sizing:border-box}body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;color:#0f172a} .wrap{max-width:820px;padding:24px;margin:0 auto} .thead{display:grid;grid-template-columns:2fr 1fr 1fr;padding:10px 12px;font-size:12px;font-weight:700;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0} .row{display:grid;grid-template-columns:2fr 1fr 1fr;padding:10px 12px;border-bottom:1px solid #e2e8f0} .right{text-align:right} .summary{margin-top:12px;display:flex;justify-content:flex-end} .card{border:1px solid #e2e8f0;padding:12px;border-radius:8px;min-width:240px} @page{size:auto;margin:14mm}`;

  const itemsRows = (purchase.purchaseItems || []).map(it => `
    <div class="row">
      <div><div style="font-weight:600">${it.product?.productName || `#${it.productId}`}</div><div style="font-size:12px;color:#64748b">${it.unit?.name || ""}</div></div>
      <div class="right">${it.quantity}</div>
      <div class="right">${(typeof it.rate==='number'||typeof it.rate==='string')?Number(it.rate).toFixed(2):'—'}</div>
      <div class="right">${(typeof it.total==='number'||typeof it.total==='string')?Number(it.total).toFixed(2):'—'}</div>
    </div>
  `).join('');

  const header = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px"><div><div style="font-weight:700;font-size:18px">Purchase</div><div style="font-size:12px;color:#64748b">#${id}</div></div><div style="text-align:right"><div style="font-size:12px;color:#64748b">${when}</div><div style="font-weight:600;margin-top:6px">${supplier.name || '—'}</div><div style="font-size:12px;color:#64748b">${inventory.inventoryName||inventory.name||''}</div></div></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Purchase #${id}</title><style>${css}</style></head><body><div class="wrap">${header}<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:10px 12px;font-size:12px;font-weight:700;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0"><div>Product</div><div class="right">Qty</div><div class="right">Rate</div><div class="right">Amount</div></div>${itemsRows}<div class="summary"><div class="card"><div style="display:flex;justify-content:space-between"><div>Subtotal</div><div>${subtotal}</div></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:700"><div>Total</div><div>${grand}</div></div></div></div></div></body></html>`;
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
  const cleanup = () => { if (done) return; done = true; if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  const triggerPrint = () => {
    if (done) return;
    try {
      const w = iframe.contentWindow;
      if (!w) return;
      w.focus();
      w.print();
    } catch(_) {}
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

/* ---------- small Plus icon ---------- */
function PlusSmall() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>; }

/* ---------- Purchase Modal ---------- */
function PurchaseModal({ open, title="Create Purchase", inventories = [], suppliers = [], products = [], units = [], initial = null, onClose, onSubmit }) {
  const emptyItem = { productId: "", unitId: "", quantity: "", rate: "" };
  const [form, setForm] = useState({
    billNumber: "",
    purchaseDate: "",
    inventoryId: "",
    supplierId: "",
    isTaxable: false,
    items: [ { ...emptyItem } ]
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const mappedItems = (initial.purchaseItems || []).map(it => ({
        productId: it.productId,
        unitId: it.unitId || it.unit_id || "",
        quantity: String(it.quantity || it.qty || ""),
        rate: String(it.rate ?? "")
      }));
      setForm({
        billNumber: initial.billNumber || "",
        purchaseDate: formatDateInput(initial.purchaseDate || initial.createdAt),
        inventoryId: initial.inventoryId || initial.inventory?.id || "",
        supplierId: initial.supplierId || initial.supplier?.id || "",
        isTaxable: Boolean(initial.isTaxable),
        items: mappedItems.length ? mappedItems : [ { ...emptyItem } ]
      });
    } else {
      setForm({
        billNumber: "",
        purchaseDate: formatDateInput(new Date().toISOString()),
        inventoryId: "",
        supplierId: "",
        isTaxable: false,
        items: [ { ...emptyItem } ]
      });
    }
  }, [open, initial]);

  const preview = useMemo(() => {
    const items = (form.items || []).map(it => {
      const q = Number(it.quantity || 0);
      const r = Number(it.rate || 0);
      const tot = Number((q * r).toFixed(2));
      return { q, r, tot };
    });
    const sub = items.reduce((s, it) => s + it.tot, 0);
    const tax = form.isTaxable ? +(sub * 0.15) : 0;
    const grand = +(sub + tax);
    return { items, sub: sub.toFixed(2), tax: tax.toFixed(2), grand: grand.toFixed(2) };
  }, [form.items, form.isTaxable]);

  if (!open) return null;

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setItem = (idx, k, v) => setForm(prev => {
    const items = prev.items.slice();
    items[idx] = { ...items[idx], [k]: v };
    return { ...prev, items };
  });
  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm(prev => {
    const items = prev.items.slice();
    items.splice(idx, 1);
    return { ...prev, items: items.length ? items : [ { ...emptyItem } ] };
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.billNumber?.trim()) { alert("Bill number is required"); return; }
    if (!form.purchaseDate) { alert("Purchase date is required"); return; }
    if (!form.inventoryId) { alert("Inventory is required"); return; }
    if (!form.supplierId) { alert("Supplier is required"); return; }
    if (!form.items || !Array.isArray(form.items) || form.items.length === 0) { alert("Add at least one item"); return; }
    for (const it of form.items) {
      if (!it.productId || !it.unitId || Number(it.quantity) <= 0 || !(it.rate && Number(it.rate) >= 0)) {
        alert("Each item must have product, unit, positive quantity and rate (backend requires rate).");
        return;
      }
    }
    const payload = {
      billNumber: form.billNumber.trim(),
      purchaseDate: form.purchaseDate,
      inventoryId: form.inventoryId,
      supplierId: form.supplierId,
      isTaxable: !!form.isTaxable,
      items: form.items.map(it => ({
        productId: it.productId,
        unitId: it.unitId,
        quantity: Number(it.quantity),
        rate: Number(it.rate)
      }))
    };
    onSubmit(payload);
  };

  const invOptions = inventories.map(i => ({ value: i.id, label: i.inventoryName || i.name || `#${i.id}` }));
  const supOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
  const prodOptions = products.map(p => ({ value: p.id, label: p.productName || p.name || `#${p.id}` }));
  const unitOptions = units.map(u => ({ value: u.id, label: u.name || u.unitName || `#${u.id}` }));

  return (
    <div className="fixed inset-0 z-[96]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(980px,96vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto max-h-[90vh] rounded-2xl border bg-white shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Bill number *</label>
              <input required value={form.billNumber} onChange={e=>setField("billNumber", e.target.value)} className="w-full rounded-2xl border px-3 py-2" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Purchase date *</label>
              <input required type="date" value={form.purchaseDate} onChange={e=>setField("purchaseDate", e.target.value)} className="w-full rounded-2xl border px-3 py-2" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isTaxable} onChange={e=>setField("isTaxable", e.target.checked)} /> <span className="text-xs text-slate-700">Apply 15% tax</span></label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Inventory *</label>
              <SearchableSelect
                value={form.inventoryId}
                onChange={(v)=>setField("inventoryId", v)}
                options={invOptions}
                placeholder="Select inventory…"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Supplier *</label>
              <SearchableSelect
                value={form.supplierId}
                onChange={(v)=>setField("supplierId", v)}
                options={supOptions}
                placeholder="Select supplier…"
              />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-900 font-medium">Items</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-500 mr-2">Rate required (backend)</div>
                <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50"><PlusSmall/></button>
              </div>
            </div>

            <div className="space-y-3">
              {form.items.map((it, idx)=>(
                <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_80px] gap-3 items-center">
                  <SearchableSelect value={it.productId} onChange={(v)=>setItem(idx,"productId", v)} options={prodOptions} placeholder="Product *" />
                  <SearchableSelect value={it.unitId} onChange={(v)=>setItem(idx,"unitId", v)} options={unitOptions} placeholder="Unit *" />
                  <input required type="number" min="0" step="0.01" placeholder="Qty *" value={it.quantity} onChange={e=>setItem(idx,"quantity", e.target.value)} className="rounded-2xl border px-3 py-2" />
                  <div className="flex items-center gap-2">
                    <input required type="number" min="0" step="0.01" placeholder="Rate *" value={it.rate} onChange={e=>setItem(idx,"rate", e.target.value)} className="rounded-2xl border px-3 py-2 w-full" />
                    <button type="button" onClick={()=>removeItem(idx)} className="rounded-full bg-rose-500 p-2 text-white"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-sm text-slate-600">
              Preview — Subtotal: <strong>{preview.sub}</strong> • Tax: <strong>{preview.tax}</strong> • Grand: <strong>{preview.grand}</strong>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm">Cancel</button>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Main Purchases page ---------- */
export default function PurchasesPage() {
  const [me, setMe] = useState(null);
  const role = me?.role || "";
  const isSuper = role === "superadmin";

  const [purchases, setPurchases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [inventories, setInventories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("DESC");

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPurchase, setReceiptPurchase] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  async function fetchMe(){ try { const r = await api.get("/users/verify-token"); const u = r?.data?.data?.user || r?.data?.user || r?.data; setMe(u || null); } catch { setMe(null); } }
  useEffect(()=>{ fetchMe(); }, []);

  useEffect(()=>{
    (async ()=>{
      try {
        const [invRes, supRes, prodRes, unitRes] = await Promise.all([
          api.get("/inventory/"),
          api.get("/suppliers/"),
          api.get("/products/"),
          api.get("/units/")
        ]);
        setInventories((invRes?.data?.data ?? invRes?.data ?? []).slice());
        setSuppliers((supRes?.data?.data ?? supRes?.data ?? []).slice());
        setProducts((prodRes?.data?.data ?? prodRes?.data ?? []).slice());
        setUnits((unitRes?.data?.data ?? unitRes?.data ?? []).slice());
      } catch (_) {}
    })();
  }, []);

  const fetchPurchases = useCallback(async (p = 1) => {
    setLoading(true); setErr(""); setOk("");
    try {
      const params = { page: p, limit: perPage };
      if (debouncedQ) params.search = debouncedQ;
      if (sort) params.sort = sort;
      if (order) params.order = order;

      const res = await api.get("/purchases", { params });

      const root = res?.data ?? {};
      let items = Array.isArray(root.data) ? root.data : Array.isArray(root.rows) ? root.rows : Array.isArray(res?.data) ? res.data : [];
      let totalCount = Number(root.pagination?.total ?? root.total ?? root.count ?? (Array.isArray(items)?items.length:0));
      let currentPage = Number(root.pagination?.page ?? root.page ?? p);
      let pageSize = Number(root.pagination?.limit ?? root.limit ?? perPage);
      if (Array.isArray(root.rows) && typeof root.count === "number") {
        items = root.rows;
        totalCount = Number(root.count);
        currentPage = p;
        pageSize = Number(root.limit ?? perPage);
      }
      if (Array.isArray(res?.data) && !root.pagination) {
        const headerTotal = Number(res?.headers?.["x-total-count"] ?? 0);
        if (headerTotal > 0) totalCount = headerTotal;
        currentPage = p;
      }

      setPurchases(Array.isArray(items) ? items : []);
      setTotal(Number(totalCount || 0));
      setPage(Number(currentPage || p));
      setPerPage(Number(pageSize || perPage));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Error fetching purchases");
    } finally {
      setLoading(false);
    }
  }, [perPage, debouncedQ, sort, order]);

  useEffect(()=>{ setPage(1); fetchPurchases(1); }, [debouncedQ, sort, order, fetchPurchases]);
  useEffect(()=>{ fetchPurchases(page); }, [page, fetchPurchases]);

  async function handleSubmit(payload) {
    try {
      setErr(""); setOk("");
      if (!isSuper) { setErr("Only Super Admin can create/update purchases"); return; }
      if (editRow?.id) {
        await api.put(`/purchases/${editRow.id}`, payload);
        setOk("Purchase updated");
      } else {
        await api.post("/purchases", payload);
        setOk("Purchase created");
      }
      setOpen(false);
      setEditRow(null);
      fetchPurchases(page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Action failed");
    }
  }

  async function deleteNow(row) {
    if (!isSuper) { setErr("Only Super Admin can delete purchases"); return; }
    try {
      setErr(""); setOk("");
      await api.delete(`/purchases/${row.id}`);
      setOk("Purchase deleted");
      fetchPurchases(page);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  function openEdit(row) {
    if (!isSuper) { setErr("Only Super Admin can edit purchases"); return; }
    setEditRow(row);
    setOpen(true);
  }

  function printPurchase(row) {
    const html = buildPrintablePurchaseHTML(row);
    printHTMLInIframe(html);
  }

  const pages = Math.max(1, Math.ceil(total / perPage));
  const windowSize = 5;
  let lo = Math.max(1, page - Math.floor(windowSize/2));
  let hi = Math.min(pages, lo + windowSize - 1);
  lo = Math.max(1, hi - windowSize + 1);
  const nums = [];
  for (let p=lo;p<=hi;p++) nums.push(p);

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchases</h1>
          <p className="text-sm text-slate-500">Create, view and manage purchases. Totals and tax are computed by backend; client shows preview.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search bill number…" className="pl-10 pr-3 py-2 rounded-2xl border border-slate-200 bg-white text-sm w-64" />
          </div>

          <select value={`${sort}:${order}`} onChange={e=>{ const [s,o]=e.target.value.split(":"); setSort(s); setOrder(o); }} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
            <option value="createdAt:DESC">Newest</option>
            <option value="createdAt:ASC">Oldest</option>
            <option value="purchaseDate:DESC">Purchase date ↓</option>
            <option value="purchaseDate:ASC">Purchase date ↑</option>
            <option value="billNumber:ASC">Bill A→Z</option>
          </select>

          <button onClick={()=>fetchPurchases(page)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            <RefreshCw size={16} /> Refresh
          </button>

          {isSuper && (
            <button onClick={()=>{ setEditRow(null); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> New Purchase
            </button>
          )}
        </div>
      </div>

      {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      {ok  && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_,i)=> <div key={i} className="h-40 animate-pulse rounded-2xl border bg-white/60" />)}
        </div>
      ) : purchases.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">No purchases found.</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {purchases.map(p => {
              const supplierName = p.supplier?.name || p.supplierName || "—";
              const inventoryName = p.inventory?.inventoryName || p.inventory?.name || "—";
              const itemCount = (p.purchaseItems || []).length;
              return (
                <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex gap-2 items-center">
                        <Badge>#{p.billNumber || p.id}</Badge>
                        <Badge tone="bg-violet-100 text-violet-700 border-violet-200"><Banknote size={12}/> {Number(p.grandTotal ?? p.grand_total ?? p.total ?? p.subTotal ?? 0).toFixed(2)}</Badge>
                      </div>

                      <h3 className="mt-3 text-base font-semibold text-slate-900">{supplierName}</h3>
                      <div className="mt-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><Calendar size={14} /> <span>{fmtPrettyDate(p.purchaseDate || p.createdAt)}</span></div>
                        <div className="flex items-center gap-2 mt-1"><span className="truncate">{inventoryName}</span></div>
                        <div className="mt-1 text-xs text-slate-500">{itemCount} item(s)</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button onClick={() => { setReceiptPurchase(p); setReceiptOpen(true); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      <FileText size={16}/> View
                    </button>

                    <button onClick={() => printPurchase(p)} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      <Printer size={16}/> Print
                    </button>

                    {isSuper && (
                      <>
                        <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                          <Pencil size={16}/> Edit
                        </button>
                        <button onClick={() => { setTargetRow(p); setConfirmOpen(true); }} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white">
                          <Trash2 size={16}/> Delete
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
              <button onClick={() => setPage(s => Math.max(1, s-1))} disabled={page<=1} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40">‹ Prev</button>

              {lo > 1 && <>
                <button onClick={()=>setPage(1)} className="rounded-2xl border px-4 py-2 text-sm">1</button>
                {lo > 2 && <span className="px-2">…</span>}
              </>}

              {nums.map(n => (
                n === page ? <span key={n} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">{n}</span> :
                <button key={n} onClick={()=>setPage(n)} className="rounded-2xl border px-4 py-2 text-sm">{n}</button>
              ))}

              {hi < Math.max(1,Math.ceil(total / perPage)) && <>
                {hi < Math.max(1,Math.ceil(total / perPage)) - 1 && <span className="px-2">…</span>}
                <button onClick={()=>setPage(Math.max(1,Math.ceil(total / perPage)))} className="rounded-2xl border px-4 py-2 text-sm">{Math.max(1,Math.ceil(total / perPage))}</button>
              </>}

              <button onClick={() => setPage(s => Math.min(Math.max(1,Math.ceil(total/perPage)), s+1))} disabled={page >= Math.max(1,Math.ceil(total / perPage))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40">Next ›</button>
            </div>
          </div>
        </>
      )}

      <PurchaseModal
        open={open}
        title={editRow ? "Edit Purchase" : "Create Purchase"}
        inventories={inventories}
        suppliers={suppliers}
        products={products}
        units={units}
        initial={editRow}
        onClose={() => { setOpen(false); setEditRow(null); }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Purchase"
        message={targetRow ? `Delete purchase ${targetRow.billNumber || `#${targetRow.id}`}? This cannot be undone.` : ""}
        confirmLabel="Delete"
        tone="rose"
        onConfirm={() => targetRow && deleteNow(targetRow)}
        onClose={() => { setConfirmOpen(false); setTargetRow(null); }}
      />

      {receiptOpen && receiptPurchase && (
        <div className="fixed inset-0 z-[97] grid place-items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setReceiptOpen(false)} />
          <div className="relative w-[min(880px,94vw)] max-h-[90vh] overflow-auto rounded-2xl border bg-white">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Purchase</h3>
              <div className="flex items-center gap-2">
                <button onClick={()=>printPurchase(receiptPurchase)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm"><Printer size={14}/> Print</button>
                <button onClick={()=>setReceiptOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={16}/></button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex justify-between">
                <div>
                  <div className="text-xs text-slate-500">Bill</div>
                  <div className="text-xl font-semibold text-slate-900">#{receiptPurchase.billNumber || receiptPurchase.id}</div>
                  <div className="text-sm text-slate-600">{fmtPrettyDate(receiptPurchase.purchaseDate || receiptPurchase.createdAt)}</div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-slate-700">{receiptPurchase.supplier?.name || "—"}</div>
                  <div className="text-xs text-slate-500">{receiptPurchase.inventory?.inventoryName || receiptPurchase.inventory?.name || ""}</div>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <span>Product</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
                </div>

                {(receiptPurchase.purchaseItems || []).map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center border-t px-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{it.product?.productName || `#${it.productId}`}</div>
                      <div className="text-xs text-slate-500">{it.unit?.name || ""}</div>
                    </div>
                    <div className="text-right tabular-nums">{it.quantity}</div>
                    <div className="text-right tabular-nums">{(typeof it.rate==='number'||typeof it.rate==='string')?Number(it.rate).toFixed(2):'—'}</div>
                    <div className="text-right font-semibold tabular-nums">{(typeof it.total==='number'||typeof it.total==='string')?Number(it.total).toFixed(2):'—'}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-64 rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between text-sm"><div>Subtotal</div><div className="font-medium">{Number(receiptPurchase.subTotal || receiptPurchase.subtotal || 0).toFixed(2)}</div></div>
                  <div className="mt-1 flex items-center justify-between text-sm"><div>Tax</div><div className="font-medium">{receiptPurchase.isTaxable ? Number((receiptPurchase.subTotal||receiptPurchase.subtotal||0)*0.15).toFixed(2) : "0.00"}</div></div>
                  <div className="mt-3 flex items-center justify-between text-base font-semibold"><div>Total</div><div>{Number(receiptPurchase.grandTotal || receiptPurchase.grand_total || receiptPurchase.total || 0).toFixed(2)}</div></div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}