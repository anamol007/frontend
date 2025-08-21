// src/pages/StockPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes, ChevronRight, ChevronDown, Search, Plus, RefreshCw,
  Pencil, Trash2, Building2, Package2, Layers, CheckCircle2, XCircle
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

/* Defensive normalizer for stocks embedded under products */
const normStock = (s = {}) => ({
  id: s.id ?? s.ID ?? null,
  product_id: s.product_id ?? s.productId ?? s.product?.id ?? null,
  inventory_id: s.inventory_id ?? s.inventoryId ?? s.inventory?.id ?? null,
  unit_id: s.unit_id ?? s.unitId ?? s.unit?.id ?? null,
  stockQuantity: Number(s.stockQuantity ?? s.qty ?? 0),
  productName: s.product?.productName ?? s.productName ?? '',
  inventoryName: s.inventory?.inventoryName ?? s.inventoryName ?? '',
  unitName: s.unit?.name ?? s.unitName ?? '',
  updatedAt: s.updatedAt ?? s.createdAt ?? null,
});

export default function StockPage() {
  // data
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // filters
  const [q, setQ] = useState('');
  const [invFilter, setInvFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  // expansion state (product ids)
  const [openIds, setOpenIds] = useState(new Set());

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null); // stock row or null (for create)
  const [prefillProductId, setPrefillProductId] = useState(null); // for "Add stock" under a product

  async function fetchAll() {
    try {
      setLoading(true); setErr(''); setOk('');
      const [p, i, u] = await Promise.all([
        api.get('/products/'),
        api.get('/inventory/'),
        api.get('/units/'),
      ]);
      const productsData = Array.isArray(p?.data?.data) ? p.data.data : (p?.data || []);
      const invData = Array.isArray(i?.data?.data) ? i.data.data : (i?.data || []);
      const unitData = Array.isArray(u?.data?.data) ? u.data.data : (u?.data || []);

      // sort for nicer UX
      productsData.sort((a,b) => String(a.productName||'').localeCompare(String(b.productName||'')));
      invData.sort((a,b) => String(a.inventoryName||'').localeCompare(String(b.inventoryName||'')));
      unitData.sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));

      setProducts(productsData);
      setInventories(invData);
      setUnits(unitData);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching stock data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  // Build grouped view: one row per product, expandable to show that product's stocks
  const grouped = useMemo(() => {
    return (products || []).map(p => {
      const stocks = Array.isArray(p?.stocks) ? p.stocks.map(s => {
        const ns = normStock(s);
        // attach product fallback names
        ns.productName = ns.productName || p.productName || '';
        return ns;
      }) : [];
      // optional filters on stock level
      const filteredStocks = stocks.filter(s => {
        if (invFilter && String(s.inventory_id) !== String(invFilter)) return false;
        if (unitFilter && String(s.unit_id) !== String(unitFilter)) return false;
        const term = q.trim().toLowerCase();
        if (!term) return true;
        const hay = `${p.productName||''} ${s.inventoryName||''} ${s.unitName||''}`.toLowerCase();
        return hay.includes(term);
      });
      // derive summary
      const invSet = new Set(filteredStocks.map(s => s.inventory_id));
      const unitSet = new Set(filteredStocks.map(s => s.unit_id));
      const totalRows = filteredStocks.length;
      return {
        productId: p.id,
        productName: p.productName || `#${p.id}`,
        description: p.description || '',
        stocks: filteredStocks,
        inventoriesCount: invSet.size,
        unitsCount: unitSet.size,
        rowsCount: totalRows,
        updatedAt: (filteredStocks[0]?.updatedAt || p.updatedAt),
      };
    }).filter(g => {
      // If product has 0 rows after filter AND search term is present, we can still hide
      if (!q.trim()) return true;
      return g.rowsCount > 0 || (g.productName.toLowerCase().includes(q.trim().toLowerCase()));
    });
  }, [products, q, invFilter, unitFilter]);

  const allOpen = grouped.length > 0 && grouped.every(g => openIds.has(g.productId));
  const toggleAll = () => {
    if (allOpen) setOpenIds(new Set());
    else setOpenIds(new Set(grouped.map(g => g.productId)));
  };

  const toggleOne = (pid) => {
    const s = new Set(openIds);
    if (s.has(pid)) s.delete(pid); else s.add(pid);
    setOpenIds(s);
  };

  // CRUD
  async function createStock(body) {
    // body: { product_id, inventory_id, unit_id, stockQuantity }
    await api.post('/stock/', body);
  }

  async function updateStock(id, body) {
    await api.put(`/stock/${id}`, body);
  }

  async function deleteStock(row) {
    if (!window.confirm(`Remove stock row for "${row.productName}" in "${row.inventoryName}" (${row.unitName})?`)) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/stock/${row.id}`);
      setOk('Stock row deleted');
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // open modals
  function openCreate(productId = null) {
    setPrefillProductId(productId);
    setEditRow(null);
    setModalOpen(true);
  }
  function openEdit(stockRow) {
    setPrefillProductId(null);
    setEditRow(stockRow);
    setModalOpen(true);
  }
  function closeModal() {
    setPrefillProductId(null);
    setEditRow(null);
    setModalOpen(false);
  }

  // fields for FormModal
  const CREATE_FIELDS = useMemo(() => {
    const productOptions = (products || []).map(p => ({ value: p.id, label: p.productName || `#${p.id}` }));
    const invOptions = (inventories || []).map(i => ({ value: i.id, label: i.inventoryName || `#${i.id}` }));
    const unitOptions = (units || []).map(u => ({ value: u.id, label: u.name || `#${u.id}` }));

    return [
      { name: 'product_id',   type: 'select', label: 'Product', required: true, options: productOptions, disabled: !!prefillProductId },
      { name: 'inventory_id', type: 'select', label: 'Inventory', required: true, options: invOptions },
      { name: 'unit_id',      type: 'select', label: 'Unit', required: true, options: unitOptions },
      { name: 'stockQuantity', type: 'number', label: 'Quantity', required: true, step: '0.01', min: '0' },
    ];
  }, [products, inventories, units, prefillProductId]);

  const EDIT_FIELDS = useMemo(() => ([
    // Keep edit simple: change quantity (and optionally inventory/unit if you want)
    { name: 'stockQuantity', type: 'number', label: 'Quantity', required: true, step: '0.01', min: '0' },
  ]), []);

  function sanitize(fields, payload) {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (!allow.has(k)) return;
      if (v === '' || v === undefined || v === null) return;
      out[k] = v;
    });
    return out;
  }

  async function handleSubmit(form) {
    try {
      setErr(''); setOk('');
      if (editRow?.id) {
        const body = sanitize(EDIT_FIELDS, form);
        await updateStock(editRow.id, body);
        setOk('Stock updated');
      } else {
        const body = sanitize(CREATE_FIELDS, form);
        // if we came from a product-scoped add, force product_id
        if (prefillProductId) body.product_id = prefillProductId;
        await createStock(body);
        setOk('Stock created');
      }
      closeModal();
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
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
              Expand a product to see stock by inventory and unit. Create, edit, or remove rows.
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
              {inventories.map(i => <option key={i.id} value={i.id}>{i.inventoryName}</option>)}
            </select>

            <select
              value={unitFilter}
              onChange={e=> setUnitFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">All units</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <button
              onClick={fetchAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16}/> Refresh
            </button>

            <button
              onClick={()=> openCreate(null)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16}/> New Stock
            </button>
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

      {/* Expandable Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur">
        {/* header */}
        <div className="grid grid-cols-[32px_1.2fr_.7fr_.7fr_.8fr_.9fr] items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span />
          <span className="flex items-center gap-2"><Package2 size={14}/> Product</span>
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
              const isOpen = openIds.has(g.productId);
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
                        <div className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr_.6fr] items-center gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <span>Inventory</span>
                          <span>Unit</span>
                          <span>Quantity</span>
                          <span>Updated</span>
                          <span className="text-right">Actions</span>
                        </div>

                        {/* sub rows */}
                        {(g.stocks.length === 0) ? (
                          <div className="px-3 py-3 text-sm text-slate-500">No stock rows for this product.</div>
                        ) : g.stocks.map(row => (
                          <div key={row.id} className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr_.6fr] items-center gap-3 border-t border-slate-200 px-3 py-2.5">
                            <div className="min-w-0">
                              <div className="truncate text-sm text-slate-800">{row.inventoryName || `#${row.inventory_id}`}</div>
                            </div>
                            <div className="text-sm text-slate-700">{row.unitName || `#${row.unit_id}`}</div>
                            <div className="text-sm font-semibold text-slate-900">{row.stockQuantity}</div>
                            <div className="text-xs text-slate-500">{prettyDateTime(row.updatedAt)}</div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={()=> openEdit(row)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                              >
                                <Pencil size={14}/> Edit
                              </button>
                              <button
                                onClick={()=> deleteStock(row)}
                                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                              >
                                <Trash2 size={14}/> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={()=> openCreate(g.productId)}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          <Plus size={16}/> Add stock for “{g.productName}”
                        </button>
                      </div>
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
      <FormModal
        title={editRow ? 'Edit Stock' : 'Create Stock'}
        open={modalOpen}
        onClose={closeModal}
        fields={editRow ? (EDIT_FIELDS) : (CREATE_FIELDS)}
        initial={
          editRow
            ? { stockQuantity: editRow.stockQuantity }
            : (prefillProductId ? { product_id: prefillProductId } : {})
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}