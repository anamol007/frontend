// src/pages/InventoriesPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  Info,
  MapPin,
  Phone,
  Plus,
  Pencil,
  Trash2,
  X,
  ShieldAlert,
} from "lucide-react";
import { api } from "../utils/api";

/* small searchable select (plain) */
function SearchableSelect({ value, onChange, options = [], placeholder = "Select…", className = "" }) {
  const [open, setOpen] = useState(false);
  const [qLocal, setQLocal] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const items = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string" ? { value: o, label: o } : { value: o.value ?? o.id ?? o, label: o.label ?? o.name ?? String(o.value ?? o.id ?? o) }
      ),
    [options]
  );

  const filtered = useMemo(() => {
    const s = (qLocal || "").toLowerCase().trim();
    if (!s) return items;
    return items.filter((it) => (it.label || "").toLowerCase().includes(s) || String(it.value).toLowerCase().includes(s));
  }, [items, qLocal]);

  const selected = items.find((i) => String(i.value) === String(value));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm flex items-center justify-between"
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>{selected?.label ?? placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl border bg-white shadow">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
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
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQLocal("");
                }}
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

/* helpers */
const field = (name, label, type = "text", required = false) => ({ name, label, type, required });
const FIELDS = [field("inventoryName", "Inventory Name", "text", true), field("address", "Address", "text", true), field("contactNumber", "Contact Number", "text", true)];

const sanitize = (payload = {}) => {
  const allow = new Set(FIELDS.map((f) => f.name));
  const out = {};
  Object.keys(payload).forEach((k) => {
    if (!allow.has(k)) return;
    const v = payload[k];
    if (v === undefined || v === null || v === "") return;
    out[k] = v;
  });
  return out;
};

function buildStockByUnit(items = []) {
  const map = new Map();
  items.forEach((row) => {
    const unitObj = row?.unit || row?.Unit || {};
    const unitId = unitObj?.id ?? row?.unit_id ?? row?.unitId ?? unitObj?.name ?? "—";
    const unitName = String(unitObj?.name ?? row?.unit ?? "—");
    const key = String(unitId);
    const qty = Number(row?.stockQuantity ?? row?.quantity ?? 0) || 0;
    const sign = (row?.in_out || row?.inOut || "").toLowerCase() === "out" ? -1 : 1;
    const prev = map.get(key)?.quantity || 0;
    map.set(key, { unit: { id: unitId, name: unitName }, quantity: prev + sign * qty });
  });
  return Array.from(map.values()).map((v) => ({ ...v, quantity: Math.max(0, Number(v.quantity || 0)) }));
}

/* Edit modal (plain, neutral) */
function EditModal({ open, initial = {}, onClose, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(initial || {}), [initial, open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[min(640px,92vw)] rounded-2xl border bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-slate-900">{initial?.id ? "Edit Inventory" : "New Inventory"}</div>
          <button onClick={onClose} className="rounded p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                {f.label}{f.required && <span className="text-rose-500"> *</span>}
              </label>
              <input
                type={f.type}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                required={f.required}
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {busy ? "Saving…" : initial?.id ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Stats popup (plain) */
function StatsPopup({ inv, stats, items, loading, onClose }) {
  const totalProducts =
    (stats && stats.totalProducts != null)
      ? stats.totalProducts
      : (stats && stats.productCount != null)
      ? stats.productCount
      : Array.isArray(items) ? items.length : 0;

  const computed = useMemo(() => buildStockByUnit(items), [items]);
  const stockByUnit = useMemo(() => {
    const arr = Array.isArray(stats?.stockByUnit) ? stats.stockByUnit : [];
    const looksValid = arr.some((u) => Number(u?.quantity || 0) > 0);
    return looksValid ? arr : computed;
  }, [stats?.stockByUnit, computed]);

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[min(800px,96vw)] rounded-2xl border bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-slate-900">Inventory Stats — {inv?.inventoryName ?? `#${inv?.id}`}</div>
          <button onClick={onClose} className="rounded p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="grid gap-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-slate-500">Total Products</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{Number(totalProducts || 0)}</div>
            </div>

            <div className="sm:col-span-2 rounded-xl border p-3">
              <div className="mb-2 text-xs text-slate-500">Stock by Unit</div>
              <div className="flex flex-wrap gap-2">
                {(!stockByUnit || stockByUnit.length === 0) ? (
                  <div className="text-xs text-slate-400">No unit stock yet.</div>
                ) : stockByUnit.map((u, i) => {
                  const label = String(u?.unit?.name ?? u?.unit ?? "—").toUpperCase();
                  const qty = Number(u?.quantity ?? 0) || 0;
                  return (
                    <div key={`${label}-${i}`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs">
                      <div className="rounded-md bg-slate-900 px-1.5 py-0.5 text-white tabular-nums font-semibold">{qty}</div>
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="mb-2 text-sm font-medium text-slate-700">Items in this inventory</div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />)}
              </div>
            ) : !Array.isArray(items) || items.length === 0 ? (
              <div className="text-sm text-slate-400">No items found.</div>
            ) : (
              <div className="max-h-[40vh] overflow-auto space-y-2 pr-1">
                {items.map((row, i) => {
                  const name =
                    row?.product?.productName ??
                    row?.Product?.productName ??
                    row?.productName ??
                    (row?.productId != null ? `#${row.productId}` : "—");
                  const qty = Number(row?.stockQuantity ?? row?.quantity) || 0;
                  const unit = String(row?.unit?.name ?? row?.unit ?? "—").toUpperCase();
                  return (
                    <div key={row?.id ?? i} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">{name}</div>
                        <div className="text-xs text-slate-400">Unit: {unit}</div>
                      </div>
                      <div className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white tabular-nums font-semibold">{qty}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------ useDebounce hook ------------------ */
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  const tRef = useRef(null);

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(tRef.current);
  }, [value, delay]);

  return debounced;
}

/* ------------------ Main Page ------------------ */
export default function InventoriesPage() {
  const [me, setMe] = useState(null);
  const isSuper = me?.role === "superadmin";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // search: immediate typing state + debounced committed q
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedQ = useDebounce(searchTerm, 300);
  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [openStats, setOpenStats] = useState(null);
  const [statsCache, setStatsCache] = useState({});
  const [itemsCache, setItemsCache] = useState({});
  const [itemsLoading, setItemsLoading] = useState(false);

  const [confirm, setConfirm] = useState({ open: false, row: null });

  const PER_PAGE = 5;
  const [page, setPage] = useState(1);

  async function fetchMe() {
    try {
      const r = await api.get("/users/verify-token");
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }

  async function fetchAll() {
    setLoading(true); setErr(""); setOk("");
    try {
      const r = await api.get("/inventory/");
      const data = r?.data?.data ?? r?.data ?? [];
      const sorted = Array.isArray(data) ? [...data].sort((a, b) => String(a.inventoryName || "").localeCompare(String(b.inventoryName || ""))) : [];
      setRows(sorted);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load inventories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMe(); fetchAll(); }, []);

  // commit debounced search to q and reset page
  useEffect(() => {
    setQ(debouncedQ);
    setPage(1);
  }, [debouncedQ]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((v) =>
      (v.inventoryName || "").toLowerCase().includes(s) ||
      (v.address || "").toLowerCase().includes(s) ||
      (v.contactNumber || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [currentPage, page]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, currentPage]);

  const openCreate = () => { if (!isSuper) { setErr("Only Super Admin can create inventories"); return; } setEditRow(null); setModalOpen(true); };
  const openEdit = (row) => { if (!isSuper) { setErr("Only Super Admin can edit inventories"); return; } setEditRow(row); setModalOpen(true); };

  async function handleSubmit(form) {
    if (!isSuper) { setErr("Only Super Admin can perform this action"); return; }
    setErr(""); setOk("");
    try {
      const body = sanitize(form);
      if (editRow?.id) {
        await api.put(`/inventory/${editRow.id}`, body);
        setOk("Inventory updated");
      } else {
        await api.post("/inventory/", body);
        setOk("Inventory created");
      }
      setModalOpen(false);
      setEditRow(null);
      setPage(1);
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Save failed");
    }
  }

  function askDelete(row) {
    if (!isSuper) { setErr("Only Super Admin can delete inventories"); return; }
    setConfirm({ open: true, row });
  }

  async function confirmDelete() {
    const row = confirm.row;
    setConfirm({ open: false, row: null });
    if (!row) return;
    setErr(""); setOk("");
    try {
      await api.delete(`/inventory/${row.id}`);
      setOk("Inventory deleted");
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  async function openStatsFor(row) {
    setOpenStats(row);
    try {
      if (!statsCache[row.id]) {
        const r = await api.get(`/inventory/${row.id}/stats`);
        setStatsCache((p) => ({ ...p, [row.id]: r?.data?.data ?? r?.data ?? {} }));
      }
    } catch {}
    try {
      setItemsLoading(true);
      if (!itemsCache[row.id]) {
        const r2 = await api.get(`/stock/inventory/${row.id}`);
        const items = r2?.data?.data ?? r2?.data ?? [];
        setItemsCache((p) => ({ ...p, [row.id]: items }));
        const stockByUnit = buildStockByUnit(items);
        setStatsCache((p) => {
          const current = p[row.id] || {};
          const provided = Array.isArray(current.stockByUnit) ? current.stockByUnit : [];
          const hasPositive = provided.some((u) => Number(u?.quantity || 0) > 0);
          return { ...p, [row.id]: { ...current, stockByUnit: hasPositive ? provided : stockByUnit } };
        });
      }
    } finally {
      setItemsLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Inventories</h1>
            <p className="text-sm text-slate-500">{isSuper ? "Create, edit, and inspect inventory stats & items." : "Browse and inspect inventory stats & items."}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); }}
                placeholder="Search name, address, phone…"
                className="w-64 bg-transparent outline-none text-sm"
              />
            </div>

            <button onClick={fetchAll} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm">
              <RefreshCw size={16} /> Refresh
            </button>

            {isSuper && (
              <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white">
                <Plus size={16} /> New Inventory
              </button>
            )}
          </div>
        </div>

        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl border bg-white/60" />)}
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">No inventories found.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((inv) => (
            <div key={inv.id} className="rounded-2xl border p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white">{String(inv.inventoryName || "I").charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">{inv.inventoryName || "—"}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><MapPin size={14} /> <span className="truncate">{inv.address || "—"}</span></div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Phone size={14} /> <span>{inv.contactNumber || "—"}</span></div>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <div>
                  {isSuper ? (
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(inv)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm"> <Pencil size={16} /> Edit</button>
                      <button onClick={() => askDelete(inv)} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm text-white"> <Trash2 size={16} /> Delete</button>
                    </div>
                  ) : null}
                </div>

                <button onClick={() => openStatsFor(inv)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <Info size={16} /> View Stats
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 pt-1 pb-6">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">‹ Prev</button>

        {(() => {
          const nums = [];
          const start = Math.max(1, currentPage - 1);
          const end = Math.min(totalPages, currentPage + 1);
          for (let i = start; i <= end; i++) nums.push(i);
          if (currentPage === 1 && totalPages >= 2 && !nums.includes(2)) nums.push(2);
          return nums.map((n) => (
            <button key={n} onClick={() => setPage(n)} className={n === currentPage ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white" : "rounded-2xl border px-4 py-2 text-sm"}>{n}</button>
          ));
        })()}

        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Next ›</button>
      </div>

      <EditModal open={modalOpen} initial={editRow || {}} onClose={() => { setModalOpen(false); setEditRow(null); }} onSubmit={handleSubmit} />

      {openStats && (
        <StatsPopup inv={openStats} stats={statsCache[openStats.id]} items={itemsCache[openStats.id]} loading={itemsLoading} onClose={() => setOpenStats(null)} />
      )}

      {confirm.open && (
        <div className="fixed inset-0 z-[70] grid place-items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirm({ open: false, row: null })} />
          <div className="relative w-[min(520px,92vw)] rounded-2xl border bg-white p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600"><ShieldAlert size={20} /></div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">Delete Inventory?</div>
                <div className="text-xs text-slate-500 mt-1">{confirm.row ? `This will permanently remove "${confirm.row.inventoryName}".` : ""}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirm({ open: false, row: null })} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
              <button onClick={confirmDelete} className="rounded-xl bg-rose-600 px-4 py-2 text-sm text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}