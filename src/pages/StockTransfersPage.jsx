// src/pages/StockTransfers.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { ArrowLeftRight, Plus, RefreshCw, Search, Save, X } from 'lucide-react';

const byAlpha = (get = (x) => x) =>
  (a, b) => `${get(a)}`.localeCompare(`${get(b)}`, undefined, { sensitivity: 'base' });
const cls = (...a) => a.filter(Boolean).join(' ');

// ---------- UI bits ----------
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(900px,96vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
function Field({ label, required, children, hint, extra }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {extra}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
// Extract most helpful error string from axios error
function extractErr(e) {
  const d = e?.response?.data;
  if (!d) return e?.message || 'Network error';
  // Prefer a specific backend error if present
  if (typeof d.error === 'string' && d.error.trim()) {
    // If message is the generic one, replace it with error
    if (!d.message || /^error/i.test(d.message)) return d.error;
    return `${d.message}: ${d.error}`;
  }
  const first =
    d.message || d.details || (Array.isArray(d.errors) ? d.errors.join(', ') : d.errors);
  return first || `HTTP ${e?.response?.status || ''}: ${e?.message || 'Request failed'}`;
}

// ---------- Page ----------
export default function StockTransfers() {
  // Dictionaries
  const [inventories, setInventories] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);

  // Data
  const [stock, setStock] = useState([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  // Create modal
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sourceInventoryId: '',
    targetInventoryId: '',
    productId: '',
    unitId: '',
    quantity: '',
    notes: '',
  });

  // Endpoint discovery
  const getPathRef = useRef(null);
  const postPathRef = useRef(null);
  const GET_CANDIDATES = ['/stocks', '/stock', '/stock/all', '/inventory/stock'];
  const POST_FALLBACK = '/stocks';

  async function discoverGetPath() {
    if (getPathRef.current) return getPathRef.current;
    let lastErr;
    for (const p of GET_CANDIDATES) {
      try {
        const res = await api.get(p);
        if (res?.data) {
          getPathRef.current = p;
          // derive post path: if GET path is one of common POST ones, reuse it
          postPathRef.current = ['/stocks', '/stock'].includes(p) ? p : POST_FALLBACK;
          return p;
        }
      } catch (e) {
        lastErr = e;
        if (e?.response?.status === 401 || e?.response?.status === 403) throw e;
      }
    }
    throw lastErr || new Error('No stock route found');
  }

  // Load dicts + data
  async function fetchDicts() {
    try {
      const [inv, prod, uni] = await Promise.all([
        api.get('/inventory').catch(() => api.get('/inventory/')),
        api.get('/products'),
        api.get('/units'),
      ]);
      setInventories((inv?.data?.data ?? inv?.data ?? []).slice().sort(byAlpha(i => i.inventoryName)));
      setProducts((prod?.data?.data ?? prod?.data ?? []).slice().sort(byAlpha(p => p.productName)));
      setUnits((uni?.data?.data ?? uni?.data ?? []).slice().sort(byAlpha(u => u.name)));
    } catch {
      /* dictionaries are best-effort */
    }
  }

  async function fetchStock() {
    setLoading(true);
    setErr(''); setOk('');
    try {
      const path = await discoverGetPath();
      const res = await api.get(path);
      const list = res?.data?.data ?? res?.data ?? [];
      setStock(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(extractErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDicts();
    fetchStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtering
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return stock;
    return stock.filter((r) =>
      (r?.product?.productName || '').toLowerCase().includes(s) ||
      (r?.inventory?.inventoryName || '').toLowerCase().includes(s) ||
      (r?.unit?.name || '').toLowerCase().includes(s)
    );
  }, [q, stock]);

  // Available from selected source/product/unit
  const availableFromSource = useMemo(() => {
    if (!form.sourceInventoryId || !form.productId || !form.unitId) return null;
    const row = stock.find(
      r =>
        String(r.inventory_id) === String(form.sourceInventoryId) &&
        String(r.product_id) === String(form.productId) &&
        String(r.unit_id) === String(form.unitId)
    );
    return row ? Number(row.availableQuantity || 0) : 0;
  }, [form.sourceInventoryId, form.productId, form.unitId, stock]);

  // Create transfer
  async function submitCreateTransfer(e) {
    e.preventDefault();
    setErr(''); setOk('');
    setBusy(true);
    try {
      if (!form.sourceInventoryId || !form.targetInventoryId || !form.productId || !form.unitId || !form.quantity) {
        throw new Error('Please fill all required fields.');
      }
      if (String(form.sourceInventoryId) === String(form.targetInventoryId)) {
        throw new Error('Source and target inventories must be different.');
      }

      const qty = Number(form.quantity);
      if (Number.isNaN(qty) || qty <= 0) throw new Error('Quantity must be greater than zero.');
      if (availableFromSource !== null && qty > availableFromSource) {
        throw new Error(`Insufficient stock. Available: ${availableFromSource}, Requested: ${qty}`);
      }

      // derive POST path from discovered GET path
      const postPath =
        postPathRef.current ||
        (await discoverGetPath(), postPathRef.current || POST_FALLBACK);

      const payload = {
        stockQuantity: qty,
        unit_id: Number(form.unitId),
        product_id: Number(form.productId),
        inventory_id: Number(form.sourceInventoryId), // SOURCE
        method: 'transfer',
        in_out: 'out',
        targetInventoryId: Number(form.targetInventoryId), // TARGET
        notes: form.notes?.trim() || undefined,
      };

      await api.post(postPath, payload);

      setOpen(false);
      setForm({ sourceInventoryId: '', targetInventoryId: '', productId: '', unitId: '', quantity: '', notes: '' });
      await fetchStock();
      setOk('Transfer created successfully');
    } catch (e2) {
      setErr(extractErr(e2));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    form.sourceInventoryId &&
    form.targetInventoryId &&
    form.productId &&
    form.unitId &&
    Number(form.quantity) > 0 &&
    String(form.sourceInventoryId) !== String(form.targetInventoryId) &&
    (availableFromSource === null || Number(form.quantity) <= availableFromSource);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="text-indigo-600" /> Stock Transfers
            </h1>
            <p className="text-sm text-slate-500">Create, track, and update transfers between inventories.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search id / product / inventory…"
                className="w-64 bg-transparent outline-none text-sm"
              />
            </div>
            <button
              onClick={fetchStock}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16} /> New Transfer
            </button>
          </div>
        </div>
        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok &&  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No stock records found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left">
                  <th>Product</th>
                  <th>Inventory</th>
                  <th>Unit</th>
                  <th className="text-right">Available Qty</th>
                  <th className="text-right pr-6">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row) => (
                  <tr key={`${row.product_id}-${row.inventory_id}-${row.unit_id}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">{row?.product?.productName ?? `Product ${row.product_id}`}</td>
                    <td className="px-4 py-3">{row?.inventory?.inventoryName ?? `Inventory ${row.inventory_id}`}</td>
                    <td className="px-4 py-3">{row?.unit?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(row?.availableQuantity ?? 0)}</td>
                    <td className="px-4 py-3 text-right pr-6">
                      {Array.isArray(row?.transfers) ? row.transfers.length : row?.transactionCount ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Stock Transfer"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={submitCreateTransfer}
              disabled={!canSubmit || busy}
              className={cls(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white',
                !canSubmit || busy ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              )}
            >
              <Save size={16} />
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        }
      >
        {err && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        <form onSubmit={submitCreateTransfer} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Source Inventory" required extra={
            availableFromSource !== null && (
              <div className="text-xs text-slate-500">Available: <b>{availableFromSource}</b></div>
            )
          }>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.sourceInventoryId}
              onChange={(e) => setForm((f) => ({ ...f, sourceInventoryId: e.target.value }))}
              required
            >
              <option value="">— Select —</option>
              {inventories.map((i) => (
                <option key={i.id} value={i.id}>{i.inventoryName}</option>
              ))}
            </select>
          </Field>

          <Field label="Target Inventory" required>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.targetInventoryId}
              onChange={(e) => setForm((f) => ({ ...f, targetInventoryId: e.target.value }))}
              required
            >
              <option value="">— Select —</option>
              {inventories.map((i) => (
                <option key={i.id} value={i.id}>{i.inventoryName}</option>
              ))}
            </select>
          </Field>

          <Field label="Product" required>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              required
            >
              <option value="">— Select —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.productName}</option>
              ))}
            </select>
          </Field>

          <Field label="Unit" required>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.unitId}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              required
            >
              <option value="">— Select —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Quantity" required>
            <input
              type="number" step="0.01" min="0"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              required
            />
          </Field>

          <Field label="Notes" hint="Optional">
            <input
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Reference, reason, etc."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}