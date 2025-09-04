// src/pages/StockPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes, ChevronRight, ChevronDown, Search, Plus, RefreshCw,
  Pencil, Trash2, Building2, Layers
} from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

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

// 🔒 Read-only mode (everyone)
const CAN_MANAGE = false;

export default function StockPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [q, setQ] = useState('');
  const [invFilter, setInvFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [openKeys, setOpenKeys] = useState(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [prefill, setPrefill] = useState(null);

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
  useEffect(() => { fetchAll(); }, []);

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
  const toggleAll = () => {
    if (allOpen) setOpenKeys(new Set());
    else setOpenKeys(new Set(grouped.map(g => g.productId)));
  };
  const toggleOne = (pid) => {
    const s = new Set(openKeys);
    if (s.has(pid)) s.delete(pid); else s.add(pid);
    setOpenKeys(s);
  };

  // (Management helpers exist but UI is hidden in read-only mode)
  const { productOptions, inventoryOptions, unitOptions } = useMemo(
    () => buildSelects(rows),
    [rows]
  );

  const CREATE_FIELDS = useMemo(() => ([
    { name: 'product_id',   type: 'select', label: 'Product',   required: true, options: productOptions, disabled: !!prefill?.product_id },
    { name: 'inventory_id', type: 'select', label: 'Inventory', required: true, options: inventoryOptions, disabled: !!prefill?.inventory_id },
    { name: 'unit_id',      type: 'select', label: 'Unit',      required: true, options: unitOptions, disabled: !!prefill?.unit_id },
    { name: 'stockQuantity', type: 'number', label: 'Quantity (add to stock)', required: true, step: '0.01', min: '0' },
    { name: 'notes', type: 'textarea', label: 'Notes (optional)' },
  ]), [productOptions, inventoryOptions, unitOptions, prefill]);

  const EDIT_FIELDS = useMemo(() => ([
    { name: 'newQuantity', type: 'number', label: 'New quantity (final)', required: true, step: '0.01', min: '0' },
  ]), []);

  function closeModal() { setPrefill(null); setEditRow(null); setModalOpen(false); }

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
              View-only snapshot from <code>/stock</code>. Editing is disabled.
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

            {/* New Stock hidden in read-only mode */}
            {CAN_MANAGE && (
              <button
                onClick={()=> {/* openCreate(null) */}}
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
              <div key={i} className="h-12 animate-pulse rounded-xl border border-slate-200 bg-white/60 mb-2"/>
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
                      {g.description && <div className="truncate text-xs text-slate-500">{g.description}</div>}
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
                        <div className={`grid ${CAN_MANAGE ? 'grid-cols-[1.2fr_.7fr_.7fr_.8fr_.6fr]' : 'grid-cols-[1.2fr_.7fr_.7fr_.8fr]'} items-center gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
                          <span>Inventory</span>
                          <span>Unit</span>
                          <span>Quantity</span>
                          <span>Updated</span>
                          {CAN_MANAGE && <span className="text-right">Actions</span>}
                        </div>

                        {/* sub rows */}
                        {(g.stocks.length === 0) ? (
                          <div className="px-3 py-3 text-sm text-slate-500">No stock rows for this product.</div>
                        ) : g.stocks.map(row => (
                          <div key={row.key} className={`grid ${CAN_MANAGE ? 'grid-cols-[1.2fr_.7fr_.7fr_.8fr_.6fr]' : 'grid-cols-[1.2fr_.7fr_.7fr_.8fr]'} items-center gap-3 border-t border-slate-200 px-3 py-2.5`}>
                            <div className="min-w-0">
                              <div className="truncate text-sm text-slate-800">{row.inventoryName}</div>
                            </div>
                            <div className="text-sm text-slate-700">{row.unitName}</div>
                            <div className="text-sm font-semibold text-slate-900">{row.stockQuantity}</div>
                            <div className="text-xs text-slate-500">{prettyDateTime(row.updatedAt)}</div>

                            {/* Actions hidden in read-only mode */}
                            {CAN_MANAGE && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={()=> {/* openEdit(row) */}}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                                >
                                  <Pencil size={14}/> Edit
                                </button>
                                <button
                                  onClick={()=> {/* deleteStock(row) */}}
                                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                                >
                                  <Trash2 size={14}/> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add stock button hidden in read-only mode */}
                      {CAN_MANAGE && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={()=> {/* openCreate({ product_id: g.productId }) */}}
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

      {/* Modal is not rendered in read-only mode */}
      {CAN_MANAGE && (
        <FormModal
          title={editRow ? 'Edit Stock' : 'New Stock Transaction'}
          open={modalOpen}
          onClose={closeModal}
          fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
          initial={
            editRow
              ? { newQuantity: editRow.stockQuantity }
              : (prefill
                  ? {
                      product_id: prefill.product_id ?? undefined,
                      inventory_id: prefill.inventory_id ?? undefined,
                      unit_id: prefill.unit_id ?? undefined
                    }
                  : {})
          }
          onSubmit={() => {}}
        />
      )}
    </div>
  );
}