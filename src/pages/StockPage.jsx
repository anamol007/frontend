// src/pages/StockPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes, ChevronRight, ChevronDown, Search, Plus, RefreshCw,
  Building2, Layers, X
} from 'lucide-react';
import { api } from '../utils/api';

/* ---------- helpers ---------- */
const ordinal = (n) => { const s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
const prettyDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d); if (isNaN(dt)) return '—';
  const M = dt.toLocaleString(undefined, { month: 'short' });
  const D = ordinal(dt.getDate());
  const Y = dt.getFullYear();
  const T = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${M} ${D}, ${Y}, ${T}`;
};

/** Normalize one aggregated row returned by GET /stock */
const normAgg = (row = {}) => {
  const pid  = row.product_id  ?? (row.product?.id  ?? null);
  const iid  = row.inventory_id?? (row.inventory?.id?? null);
  const uid  = row.unit_id     ?? (row.unit?.id     ?? null);

  const avail = Number(
    row.availableQuantity ??
    row.totalAvailableQuantity ??
    row.stockQuantity ?? 0
  );

  return {
    key: `${(pid ?? 'p')}-${(iid ?? 'i')}-${(uid ?? 'u')}`,
    product_id: pid,
    inventory_id: iid,
    unit_id: uid,
    productName: row.product?.productName ?? row.productName ?? `#${pid ?? ''}`,
    inventoryName: row.inventory?.inventoryName ?? row.inventoryName ?? `#${iid ?? ''}`,
    unitName: row.unit?.name ?? row.unitName ?? `#${uid ?? ''}`,
    stockQuantity: avail,
    updatedAt: row.updatedAt ?? row.lastUpdated ?? null,
  };
};

const buildSelects = (rows=[]) => {
  const products = new Map();
  const inventories = new Map();
  const units = new Map();
  rows.forEach(r => {
    if (r.product_id && !products.has(r.product_id))
      products.set(r.product_id, { value: r.product_id, label: r.productName });
    if (r.inventory_id && !inventories.has(r.inventory_id))
      inventories.set(r.inventory_id, { value: r.inventory_id, label: r.inventoryName });
    if (r.unit_id && !units.has(r.unit_id))
      units.set(r.unit_id, { value: r.unit_id, label: r.unitName });
  });
  return {
    productOptions: Array.from(products.values()),
    inventoryOptions: Array.from(inventories.values()),
    unitOptions: Array.from(units.values()),
  };
};

/* ---------- Custom modal for create/edit ---------- */
function Curtain({ onClose }) {
  return <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />;
}
function Shell({ children }) {
  return (
    <div className="fixed left-1/2 top-1/2 z-[70] w-[92vw] max-w-[980px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/30 bg-white/92 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
      {children}
    </div>
  );
}

function CreateEditModal({
  open,
  mode, // 'create' | 'edit'
  initial = {},
  selects,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(initial);
  const [method, setMethod] = useState(initial.method || 'supplier'); // supplier | damaged | transfer
  const isCreate = mode === 'create';

  useEffect(() => {
    setForm(initial || {});
    setMethod(initial.method || 'supplier');
  }, [initial, open, mode]);

  if (!open) return null;

  const change = (name, val) => setForm((p) => ({ ...p, [name]: val }));

  const submit = (e) => {
    e.preventDefault();
    // derive in_out based on method; handled in page handler, we just pass everything
    onSubmit({ ...form, method });
  };

  return (
    <>
      <Curtain onClose={onClose} />
      <Shell>
        {/* header */}
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4 text-white">
          <div className="text-xl font-semibold">
            {isCreate ? 'New Stock Transaction' : 'Edit Stock'}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {isCreate ? (
          <form onSubmit={submit} className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Product */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Product *</label>
                <select
                  required
                  value={form.product_id ?? ''}
                  onChange={(e)=> change('product_id', Number(e.target.value))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                  disabled={!!initial.product_id}
                >
                  <option value="" disabled>Select product…</option>
                  {selects.productOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Inventory (source) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Inventory (source) *</label>
                <select
                  required
                  value={form.inventory_id ?? ''}
                  onChange={(e)=> change('inventory_id', Number(e.target.value))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                  disabled={!!initial.inventory_id}
                >
                  <option value="" disabled>Select inventory…</option>
                  {selects.inventoryOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Unit */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Unit *</label>
                <select
                  required
                  value={form.unit_id ?? ''}
                  onChange={(e)=> change('unit_id', Number(e.target.value))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                  disabled={!!initial.unit_id}
                >
                  <option value="" disabled>Select unit…</option>
                  {selects.unitOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Method */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Method *</label>
                <select
                  required
                  value={method}
                  onChange={(e)=> setMethod(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                >
                  <option value="supplier">Supplier (incoming)</option>
                  <option value="damage">Damaged (write-off)</option>
                  <option value="transfer">Transfer to another inventory</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Quantity *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.stockQuantity ?? ''}
                  onChange={(e)=> change('stockQuantity', e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                  placeholder="0.00"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
                <input
                  type="text"
                  value={form.notes ?? ''}
                  onChange={(e)=> change('notes', e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                  placeholder="Any remarks…"
                />
              </div>

              {/* Target Inventory — ONLY when transfer */}
              {method === 'transfer' && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Target Inventory (destination) *</label>
                  <select
                    required
                    value={form.targetInventoryId ?? ''}
                    onChange={(e)=> change('targetInventoryId', Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                  >
                    <option value="" disabled>Select target inventory…</option>
                    {selects.inventoryOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Destination must be different from the source inventory.</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Save
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit} className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">New quantity (final) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.newQuantity ?? ''}
                  onChange={(e)=> change('newQuantity', e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Save
              </button>
            </div>
          </form>
        )}
      </Shell>
    </>
  );
}

/* ---------- Page ---------- */
export default function StockPage() {
  // auth
  const [me, setMe] = useState(null);
  const isSuper = (me?.role || '') === 'superadmin';

  // data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // filters + disclosure state
  const [q, setQ] = useState('');
  const [invFilter, setInvFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [openKeys, setOpenKeys] = useState(new Set());

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('create'); // 'create' | 'edit'
  const [initial, setInitial] = useState({});
  const [prefill, setPrefill] = useState(null);

  // auth
  async function fetchMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch { setMe(null); }
  }

  // data
  async function fetchAll() {
    try {
      setLoading(true); setErr(''); setOk('');
      const r = await api.get('/stock/');
      const list = Array.isArray(r?.data?.data) ? r.data.data : (r?.data || []);
      const normalized = list.map(normAgg);
      normalized.sort((a,b)=> String(a.productName||'').localeCompare(String(b.productName||'')));
      setRows(normalized);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching stock records');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { fetchAll(); }, []);

  // derived
  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      if (invFilter && String(r.inventory_id) !== String(invFilter)) return;
      if (unitFilter && String(r.unit_id) !== String(unitFilter)) return;

      const term = q.trim().toLowerCase();
      if (term) {
        const hay = `${r.productName||''} ${r.inventoryName||''} ${r.unitName||''}`.toLowerCase();
        if (!hay.includes(term)) return;
      }

      if (!map.has(r.product_id)) {
        map.set(r.product_id, {
          productId: r.product_id,
          productName: r.productName,
          description: '',
          stocks: [],
          updatedAt: r.updatedAt,
        });
      }
      map.get(r.product_id).stocks.push(r);
    });

    const out = Array.from(map.values());
    out.forEach(g => {
      g.inventoriesCount = new Set(g.stocks.map(s=>s.inventory_id)).size;
      g.unitsCount = new Set(g.stocks.map(s=>s.unit_id)).size;
      g.rowsCount = g.stocks.length;
      const ts = g.stocks.map(s => s.updatedAt).filter(Boolean).map(d=>+new Date(d));
      g.updatedAt = ts.length ? new Date(Math.max(...ts)).toISOString() : g.updatedAt;
    });
    out.sort((a,b)=> String(a.productName||'').localeCompare(String(b.productName||'')));
    return out;
  }, [rows, q, invFilter, unitFilter]);

  const allOpen = grouped.length > 0 && grouped.every(g => openKeys.has(g.productId));
  const toggleAll = () => setOpenKeys(allOpen ? new Set() : new Set(grouped.map(g => g.productId)));
  const toggleOne = (pid) => {
    const s = new Set(openKeys);
    if (s.has(pid)) s.delete(pid); else s.add(pid);
    setOpenKeys(s);
  };

  const { productOptions, inventoryOptions, unitOptions } = useMemo(
    () => buildSelects(rows),
    [rows]
  );

  // open modals
  function openCreate(pref = null) {
    if (!isSuper) { setErr('Only Super Admin can create stock transactions'); return; }
    setPrefill(pref);
    setMode('create');
    setInitial({
      product_id: pref?.product_id ?? '',
      inventory_id: pref?.inventory_id ?? '',
      unit_id: pref?.unit_id ?? '',
      stockQuantity: '',
      notes: '',
      method: 'supplier',
    });
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setInitial({});
    setPrefill(null);
  }

  // submit
  async function handleSubmit(payload) {
    try {
      setErr(''); setOk('');

      if (mode === 'edit') {
        // (Edit path is not used because Edit button is removed,
        // but keeping a minimal guard in case modal is forced open)
        setErr('Editing stock is disabled.');
        return;
      }

      // create
      const m = String(payload.method || 'supplier'); // supplier | damaged | transfer
      const in_out = m === 'supplier' ? 'in' : 'out';

      let targetInventoryId;
      if (m === 'transfer') {
        targetInventoryId = payload.targetInventoryId ?? null;
        const src = String(payload.inventory_id || '');
        if (!targetInventoryId || String(targetInventoryId) === src) {
          setErr('Please choose a Target Inventory for transfer.');
          return;
        }
      }

      await api.post('/stock', {
        product_id: Number(payload.product_id),
        inventory_id: Number(payload.inventory_id),
        unit_id: Number(payload.unit_id),
        stockQuantity: Number(payload.stockQuantity),
        method: m,
        in_out,
        targetInventoryId: m === 'transfer' ? Number(targetInventoryId) : undefined,
        notes: payload.notes || undefined,
      });

      setOk('Stock transaction recorded');
      closeModal();
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Save failed');
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <Boxes size={20}/> Stock
            </h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? 'Record supplier receipts, damaged write-offs, or transfers. Aggregates are server-calculated.'
                : 'View-only snapshot from /stock.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search product / inventory / unit…"
                className="w-64 bg-transparent outline-none text-sm"
              />
            </div>

            <select
              value={invFilter}
              onChange={e=> setInvFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">All inventories</option>
              {Array.from(new Map(rows.map(r => [r.inventory_id, r.inventoryName])).entries())
                .map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>

            <select
              value={unitFilter}
              onChange={e=> setUnitFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">All units</option>
              {Array.from(new Map(rows.map(r => [r.unit_id, r.unitName])).entries())
                .map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>

            <button
              onClick={fetchAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16}/> Refresh
            </button>

            {isSuper && (
              <button
                onClick={()=> openCreate(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16}/> New Stock
              </button>
            )}
          </div>
        </div>

        {(err || ok) && (
          <div className="mt-3">
            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
            {ok  && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
          </div>
        )}
      </div>

      {/* Expand/Collapse all */}
      <div className="flex justify-end">
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          {allOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur">
        {/* header */}
        <div className="grid grid-cols-[32px_1.2fr_.7fr_.7fr_.8fr_.9fr] items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span />
          <span className="flex items-center gap-2"><Boxes size={14}/> Product</span>
          <span className="hidden sm:block">Inventories</span>
          <span className="hidden sm:block">Units</span>
          <span>Rows</span>
          <span className="text-right">Last Update</span>
        </div>

        {/* rows */}
        {loading ? (
          <div className="p-4">
            {[...Array(6)].map((_,i)=>(
              <div key={i} className="mb-2 h-12 animate-pulse rounded-xl border border-slate-200 bg-white/60"/>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {grouped.map(g => {
              const isOpen = openKeys.has(g.productId);
              return (
                <li key={g.productId}>
                  {/* product row */}
                  <div className="grid grid-cols-[32px_1.2fr_.7fr_.7fr_.8fr_.9fr] items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition">
                    <button
                      onClick={()=> toggleOne(g.productId)}
                      className="grid h-8 w-8 place-items-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                    </button>

                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{g.productName}</div>
                    </div>

                    <div className="hidden sm:block">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        <Building2 size={12}/> {g.inventoriesCount}
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        <Layers size={12}/> {g.unitsCount}
                      </span>
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        Rows {g.rowsCount}
                      </span>
                    </div>

                    <div className="text-right text-xs text-slate-500">{prettyDateTime(g.updatedAt)}</div>
                  </div>

                  {/* expanded sub-table */}
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                        {/* sub header */}
                        <div className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr] items-center gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <span>Inventory</span>
                          <span>Unit</span>
                          <span>Quantity</span>
                          <span>Updated</span>
                        </div>

                        {/* sub rows */}
                        {(g.stocks.length === 0) ? (
                          <div className="px-3 py-3 text-sm text-slate-500">No stock rows for this product.</div>
                        ) : g.stocks.map(row => (
                          <div key={row.key} className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr] items-center gap-3 border-t border-slate-200 px-3 py-2.5">
                            <div className="min-w-0">
                              <div className="truncate text-sm text-slate-800">{row.inventoryName}</div>
                            </div>
                            <div className="text-sm text-slate-700">{row.unitName}</div>
                            <div className="text-sm font-semibold text-slate-900">{row.stockQuantity}</div>
                            <div className="text-xs text-slate-500">{prettyDateTime(row.updatedAt)}</div>
                          </div>
                        ))}
                      </div>

                      {isSuper && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={()=> openCreate({ product_id: g.productId })}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                          >
                            <Plus size={16}/> Add stock for “{g.productName}”
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}

            {grouped.length === 0 && !loading && (
              <li className="px-4 py-6 text-center text-slate-500">No matches. Try different filters or search.</li>
            )}
          </ul>
        )}
      </div>

      {/* Modal */}
      {isSuper && (
        <CreateEditModal
          open={modalOpen}
          mode={mode}
          initial={initial}
          selects={{ productOptions, inventoryOptions, unitOptions }}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}