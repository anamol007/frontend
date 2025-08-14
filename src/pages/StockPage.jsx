// src/pages/StockPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, Plus, Pencil, Trash2, X, Info, AlertTriangle
} from 'lucide-react';
import { api } from '../utils/api';

// ---------- Helpers ----------
const byText = (a, b) => String(a).localeCompare(String(b));
const safeArr = (x) => (Array.isArray(x) ? x : []);
const getList = (r) => (r && r.data && (r.data.data ?? r.data)) || [];
const toNum = (v) => (typeof v === 'number' ? v : Number(v || 0));

// ---------- Create/Edit inline modal ----------
function EditModal({ open, initial = {}, products = [], inventories = [], units = [], onClose, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(initial || {}), [initial, open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      // Only allowed fields per Swagger
      const payload = {
        stockQuantity: form.stockQuantity,
        unit: form.unit,
        product_id: form.product_id,
        inventory_id: form.inventory_id,
      };
      await onSubmit(payload);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/30 bg-white/85 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4 text-white">
          <div className="font-semibold">{initial?.id ? 'Edit Stock' : 'New Stock'}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Product *</label>
              <select
                required
                value={form.product_id ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, product_id: Number(e.target.value) || '' }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="" disabled>Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.productName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Inventory *</label>
              <select
                required
                value={form.inventory_id ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, inventory_id: Number(e.target.value) || '' }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="" disabled>Select inventory…</option>
                {inventories.map((i) => (
                  <option key={i.id} value={i.id}>{i.inventoryName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Quantity *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.stockQuantity ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, stockQuantity: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Unit *</label>
              <select
                required
                value={form.unit ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="" disabled>Select unit…</option>
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

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

// ---------- Low Stock popup ----------
function LowStockPopup({ open, onClose, onFetch, rows, busy }) {
  const [threshold, setThreshold] = useState(10);

  useEffect(() => {
    if (!open) return;
    // Reset when reopened
    setThreshold(10);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/30 bg-white/85 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-amber-600 to-rose-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={18}/> Low Stock</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Threshold</label>
              <input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value) || 0)}
                className="w-32 rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <button
              onClick={() => onFetch({ threshold })}
              disabled={busy}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {busy ? 'Loading…' : 'Apply'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3">
            {!rows || rows.length === 0 ? (
              <div className="text-sm text-slate-400">No low stock items.</div>
            ) : (
              <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">
                {rows.map((r) => {
                  const productName =
                    r?.product?.productName ??
                    r?.Product?.productName ??
                    r?.productName ??
                    (r?.productId != null ? `#${r.productId}` : '—');
                  const invName =
                    r?.inventory?.inventoryName ??
                    r?.Inventory?.inventoryName ??
                    r?.inventoryName ??
                    (r?.inventoryId != null ? `#${r.inventoryId}` : '—');
                  const qty = toNum(r?.stockQuantity);
                  const unit = String(r?.unit?.name ?? r?.unit ?? '—').toUpperCase();
                  return (
                    <div key={r?.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">{productName}</div>
                        <div className="text-xs text-slate-400">{invName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white tabular-nums">{qty}</span>
                        <span className="text-xs text-slate-600">{unit}</span>
                      </div>
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

// ---------- Main ----------
export default function StockPage() {
  // data
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('');

  // modals
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [lowOpen, setLowOpen] = useState(false);
  const [lowBusy, setLowBusy] = useState(false);
  const [lowRows, setLowRows] = useState([]);

  // ---------- loaders ----------
  async function loadLists() {
    setErr(''); setOk('');
    try {
      const [s, p, i, u] = await Promise.allSettled([
        api.get('/stock/'),
        api.get('/products/'),
        api.get('/inventory/'),
        api.get('/units/'),
      ]);

      // stock
      if (s.status === 'fulfilled') {
        const data = safeArr(getList(s.value));
        // sort by product then inventory
        data.sort((a, b) => {
          const ap = a?.product?.productName ?? a?.Product?.productName ?? a?.productName ?? '';
          const bp = b?.product?.productName ?? b?.Product?.productName ?? b?.productName ?? '';
          const ai = a?.inventory?.inventoryName ?? a?.Inventory?.inventoryName ?? a?.inventoryName ?? '';
          const bi = b?.inventory?.inventoryName ?? b?.Inventory?.inventoryName ?? b?.inventoryName ?? '';
          return byText(ap, bp) || byText(ai, bi);
        });
        setRows(data);
      } else {
        setErr(s.reason?.response?.data?.message || s.reason?.message || 'Failed to load stock');
      }

      // products
      if (p.status === 'fulfilled') {
        const list = safeArr(getList(p.value))
          .map((x) => ({ id: x.id, productName: x.productName }))
          .sort((a, b) => byText(a.productName, b.productName));
        setProducts(list);
      }

      // inventories
      if (i.status === 'fulfilled') {
        const list = safeArr(getList(i.value))
          .map((x) => ({ id: x.id, inventoryName: x.inventoryName }))
          .sort((a, b) => byText(a.inventoryName, b.inventoryName));
        setInventories(list);
      }

      // units (fallback to KG, BORI if empty)
      if (u.status === 'fulfilled') {
        const list = safeArr(getList(u.value))
          .map((x) => x?.name)
          .filter(Boolean)
          .sort(byText);
        setUnits(list.length ? list : ['KG', 'BORI']);
      } else {
        setUnits(['KG', 'BORI']);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLists();
  }, []);

  // ---------- filters / search ----------
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const productName =
        r?.product?.productName ??
        r?.Product?.productName ??
        r?.productName ?? '';

      const invName =
        r?.inventory?.inventoryName ??
        r?.Inventory?.inventoryName ??
        r?.inventoryName ?? '';

      const matchesSearch =
        !s ||
        productName.toLowerCase().includes(s) ||
        invName.toLowerCase().includes(s) ||
        String(r?.unit ?? '').toLowerCase().includes(s);

      const matchesProduct = !productFilter || Number(productFilter) === Number(r?.productId ?? r?.product_id ?? r?.product?.id ?? r?.Product?.id);
      const matchesInventory = !inventoryFilter || Number(inventoryFilter) === Number(r?.inventoryId ?? r?.inventory_id ?? r?.inventory?.id ?? r?.Inventory?.id);

      return matchesSearch && matchesProduct && matchesInventory;
    });
  }, [rows, q, productFilter, inventoryFilter]);

  // ---------- CRUD ----------
  const openCreate = () => { setEditRow(null); setEditOpen(true); };
  const openEdit = (row) => {
    // normalize initial data to payload shape
    const product_id = row?.productId ?? row?.product_id ?? row?.product?.id ?? row?.Product?.id ?? '';
    const inventory_id = row?.inventoryId ?? row?.inventory_id ?? row?.inventory?.id ?? row?.Inventory?.id ?? '';
    setEditRow({
      id: row?.id,
      product_id,
      inventory_id,
      stockQuantity: row?.stockQuantity ?? '',
      unit: typeof row?.unit === 'object' ? (row?.unit?.name ?? '') : (row?.unit ?? ''),
    });
    setEditOpen(true);
  };

  async function handleSubmit(payload) {
    try {
      if (editRow?.id) {
        await api.put(`/stock/${editRow.id}`, payload);
        setOk('Stock updated');
      } else {
        await api.post('/stock/', payload);
        setOk('Stock created');
      }
      setEditOpen(false);
      setEditRow(null);
      await loadLists();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Save failed');
    }
  }

  async function handleDelete(row) {
    if (!window.confirm('Delete this stock record?')) return;
    setErr(''); setOk('');
    try {
      await api.delete(`/stock/${row.id}`);
      setOk('Stock deleted');
      await loadLists();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // ---------- Low stock ----------
  async function fetchLow({ threshold }) {
    setLowBusy(true);
    try {
      const r = await api.get('/stock/low', { params: { threshold } });
      const list = safeArr(getList(r));
      setLowRows(list);
    } finally {
      setLowBusy(false);
    }
  }

  // ---------- UI ----------
  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Stock</h1>
            <p className="text-sm text-slate-500">Manage stock by product & inventory. Create, edit, delete, and check low stock.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search product, inventory, unit…"
                className="w-64 bg-transparent outline-none text-sm"
              />
            </div>

            <select
              value={productFilter}
              onChange={(e)=> setProductFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All products</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.productName}</option>)}
            </select>

            <select
              value={inventoryFilter}
              onChange={(e)=> setInventoryFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All inventories</option>
              {inventories.map(i => <option key={i.id} value={i.id}>{i.inventoryName}</option>)}
            </select>

            <button
              onClick={() => { setLowRows([]); setLowOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 hover:bg-amber-100"
            >
              <Info size={16}/> Low stock
            </button>

            <button
              onClick={loadLists}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16} /> New Stock
            </button>
          </div>
        </div>

        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No stock records.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const productName =
              row?.product?.productName ??
              row?.Product?.productName ??
              row?.productName ??
              (row?.productId != null ? `#${row.productId}` : '—');

            const invName =
              row?.inventory?.inventoryName ??
              row?.Inventory?.inventoryName ??
              row?.inventoryName ??
              (row?.inventoryId != null ? `#${row.inventoryId}` : '—');

            const qty = toNum(row?.stockQuantity);
            const unit = String(row?.unit?.name ?? row?.unit ?? '—').toUpperCase();

            return (
              <div
                key={row?.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl"
              >
                <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />

                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">{productName}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{invName}</div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white tabular-nums">{qty}</span>
                    <span className="text-xs text-slate-600">{unit}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* inline modals */}
      <EditModal
        open={editOpen}
        initial={editRow || {}}
        products={products}
        inventories={inventories}
        units={units}
        onClose={() => { setEditOpen(false); setEditRow(null); }}
        onSubmit={handleSubmit}
      />

      <LowStockPopup
        open={lowOpen}
        busy={lowBusy}
        rows={lowRows}
        onClose={() => setLowOpen(false)}
        onFetch={fetchLow}
      />
    </div>
  );
}