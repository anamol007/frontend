// src/pages/InventoriesPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Info, MapPin, Phone, Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../utils/api';

// ---------- Small helpers ----------
const field = (name, label, type='text', required=false) => ({ name, label, type, required });
const FIELDS = [
  field('inventoryName','Inventory Name','text',true),
  field('address','Address','text',true),
  field('contactNumber','Contact Number','text',true),
];
const sanitize = (payload) => {
  const allow = new Set(FIELDS.map(f=>f.name));
  const out = {};
  Object.keys(payload||{}).forEach(k=>{
    if (!allow.has(k)) return;
    const v = payload[k];
    if (v===undefined || v===null || v==='') return;
    out[k]=v;
  });
  return out;
};

// ---------- Inline Modal (Create/Edit) ----------
function EditModal({ open, onClose, initial={}, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(()=>{ setForm(initial||{}); },[initial, open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await onSubmit(form); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/30 bg-white/85 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4 text-white">
          <div className="font-semibold">{initial?.id ? 'Edit Inventory' : 'New Inventory'}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {FIELDS.map(f=>(
            <div key={f.name} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">{f.label}{f.required && <span className="text-rose-500"> *</span>}</label>
              <input
                type={f.type}
                value={form[f.name] ?? ''}
                onChange={(e)=> setForm(prev=>({...prev,[f.name]: e.target.value}))}
                required={f.required}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {busy ? 'Saving…' : (initial?.id ? 'Save Changes' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Inline Stats Popup ----------
function StatsPopup({ inv, stats, items, loading, onClose }) {
  const totalProducts =
    (stats && stats.totalProducts != null ? stats.totalProducts :
     stats && stats.productCount   != null ? stats.productCount   :
     Array.isArray(items) ? items.length : 0);

  const stockByUnit = (stats && Array.isArray(stats.stockByUnit)) ? stats.stockByUnit : [];

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/30 bg-white/85 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-4 text-white">
          <div className="font-semibold">Inventory Stats — {inv?.inventoryName ?? `#${inv?.id}`}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/70 p-3">
              <div className="text-xs text-indigo-700/80">Total Products</div>
              <div className="mt-1 text-lg font-semibold text-indigo-900 tabular-nums">{Number(totalProducts || 0)}</div>
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
              <div className="mb-1 text-xs font-medium text-slate-500">Stock by Unit</div>
              <div className="flex flex-wrap gap-2">
                {stockByUnit.length === 0 ? (
                  <div className="text-xs text-slate-400">No unit stock yet.</div>
                ) : stockByUnit.map((u, i) => {
                  const label = String(u?.unit?.name ?? u?.unit ?? '—').toUpperCase();
                  const qty = Number(u?.quantity ?? 0) || 0;
                  return (
                    <span key={`${label}-${i}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                      <span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-semibold text-white tabular-nums">{qty}</span>
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3">
            <div className="mb-2 text-sm font-medium text-slate-700">Items in this inventory</div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : !Array.isArray(items) || items.length === 0 ? (
              <div className="text-sm text-slate-400">No items found.</div>
            ) : (
              <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">
                {items.map((row, i) => {
                  const name =
                    row?.product?.productName ??
                    row?.Product?.productName ??
                    row?.productName ??
                    (row?.productId != null ? `#${row.productId}` : '—');
                  const qty = Number(row?.stockQuantity ?? row?.quantity) || 0;
                  const unit = String(row?.unit?.name ?? row?.unit ?? '—').toUpperCase();
                  return (
                    <div key={row?.id ?? i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">{name}</div>
                        <div className="text-xs text-slate-400">Unit: {unit}</div>
                      </div>
                      <div className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white tabular-nums">{qty}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 rounded-b-3xl border-t border-white/60 bg-white/70 px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function InventoriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');

  // CRUD modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // stats popup
  const [openStats, setOpenStats] = useState(null); // inventory object
  const [statsCache, setStatsCache] = useState({});
  const [itemsCache, setItemsCache] = useState({});
  const [itemsLoading, setItemsLoading] = useState(false);

  // --- Fetch list (/api/inventory/) ---
  async function fetchAll() {
    setLoading(true); setErr(''); setOk('');
    try {
      // NOTE: Swagger uses /inventory/ (with trailing slash). Our api instance already prefixes /api.
      const r = await api.get('/inventory/');
      const data = r?.data?.data ?? r?.data ?? [];
      // sort by name for consistency
      const sorted = Array.isArray(data) ? [...data].sort((a,b)=>String(a.inventoryName||'').localeCompare(String(b.inventoryName||''))) : [];
      setRows(sorted);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load inventories');
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ fetchAll(); },[]);

  // search
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(v =>
      (v.inventoryName || '').toLowerCase().includes(s) ||
      (v.address || '').toLowerCase().includes(s) ||
      (v.contactNumber || '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  // --- CRUD actions ---
  const openCreate = () => { setEditRow(null); setModalOpen(true); };
  const openEdit = (row) => { setEditRow(row); setModalOpen(true); };

  async function handleSubmit(form) {
    setErr(''); setOk('');
    try {
      const body = sanitize(form);
      if (editRow?.id) {
        await api.put(`/inventory/${editRow.id}`, body);
        setOk('Inventory updated');
      } else {
        await api.post('/inventory/', body);
        setOk('Inventory created');
      }
      setModalOpen(false);
      setEditRow(null);
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Save failed');
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete inventory "${row.inventoryName}"?`)) return;
    setErr(''); setOk('');
    try {
      await api.delete(`/inventory/${row.id}`);
      setOk('Inventory deleted');
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // --- Stats popup loaders ---
  async function openStatsFor(row) {
    setOpenStats(row);
    try {
      if (!statsCache[row.id]) {
        const r = await api.get(`/inventory/${row.id}/stats`);
        setStatsCache(prev=>({ ...prev, [row.id]: r?.data?.data ?? r?.data ?? {} }));
      }
    } catch {}
    try {
      setItemsLoading(true);
      if (!itemsCache[row.id]) {
        const r2 = await api.get(`/stock/inventory/${row.id}`);
        setItemsCache(prev=>({ ...prev, [row.id]: r2?.data?.data ?? r2?.data ?? [] }));
      }
    } finally {
      setItemsLoading(false);
    }
  }

  // --- UI ---
  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Inventories</h1>
            <p className="text-sm text-slate-500">Create, edit, and inspect inventory stats & items.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search name, address, phone…"
                className="w-64 bg-transparent outline-none text-sm"
              />
            </div>
            <button
              onClick={fetchAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16} /> New Inventory
            </button>
          </div>
        </div>
        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No inventories found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(inv => (
            <div
              key={inv.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl"
            >
              <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-md">
                  {String(inv.inventoryName || 'I').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">{inv.inventoryName || '—'}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate">{inv.address || '—'}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Phone size={14} className="shrink-0" />
                    <span>{inv.contactNumber || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(inv)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Pencil size={16}/> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(inv)}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                  >
                    <Trash2 size={16}/> Delete
                  </button>
                </div>
                <button
                  onClick={() => openStatsFor(inv)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Info size={16}/> View Stats
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline modals */}
      <EditModal
        open={modalOpen}
        onClose={()=>{ setModalOpen(false); setEditRow(null); }}
        initial={editRow || {}}
        onSubmit={handleSubmit}
      />

      {openStats && (
        <StatsPopup
          inv={openStats}
          stats={statsCache[openStats.id]}
          items={itemsCache[openStats.id]}
          loading={itemsLoading}
          onClose={()=> setOpenStats(null)}
        />
      )}
    </div>
  );
}