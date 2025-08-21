// src/pages/StockPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes, Package, MapPin, Plus, RefreshCw,
  ChevronDown, ChevronRight, Pencil, Trash2, Settings2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

const Chip = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
    {children}
  </span>
);

const CountBadge = ({ n }) => (
  <span className="inline-flex items-center rounded-full bg-slate-900/90 px-2.5 py-1 text-xs font-semibold text-white">
    {n} {n === 1 ? 'record' : 'records'}
  </span>
);

// -------------------- page --------------------
export default function StockPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [initialCreate, setInitialCreate] = useState({});
  const [expanded, setExpanded] = useState(() => new Set());

  const toggle = (id) =>
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // helpers for mixed payloads
  const pidOf      = s => s.productId ?? s.product_id ?? s.product?.id;
  const pnameOf    = s => s.product?.productName ?? s.productName ?? '—';
  const invIdOf    = s => s.inventoryId ?? s.inventory_id ?? s.inventory?.id;
  const invNameOf  = s => s.inventory?.inventoryName ?? s.inventoryName ?? '—';
  const unitIdOf   = s => s.unit_id ?? s.unit?.id;
  const unitNameOf = s => s.unit?.name ?? s.unitName ?? s.unit ?? '';

  async function fetchAll() {
    setLoading(true); setErr(''); setOk('');
    try {
      const [s, p, i, u] = await Promise.all([
        api.get('/stock'),
        api.get('/products'),
        api.get('/inventory'),
        api.get('/units'),
      ]);
      setRows(Array.isArray(s?.data?.data) ? s.data.data : (s?.data ?? []));
      setProducts(p?.data?.data ?? p?.data ?? []);
      setInventories(i?.data?.data ?? i?.data ?? []);
      setUnits(u?.data?.data ?? u?.data ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching stock');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchAll(); }, []);

  // group -> product -> inventory -> units(list)
  const groups = useMemo(() => {
    const byProduct = new Map();
    for (const s of rows) {
      const pk = pidOf(s) ?? `__${pnameOf(s)}`;
      let g = byProduct.get(pk);
      if (!g) {
        g = { pid: pidOf(s), name: pnameOf(s), inventories: new Map(), raw: [] };
        byProduct.set(pk, g);
      }
      g.raw.push(s);
      const invKey = invIdOf(s) ?? `__${invNameOf(s)}`;
      const invObj = g.inventories.get(invKey) || { invId: invIdOf(s), invName: invNameOf(s), units: [] };
      invObj.units.push(s); // one unit = one stock record
      g.inventories.set(invKey, invObj);
    }
    let arr = Array.from(byProduct.values()).map(g => ({
      ...g,
      inventories: Array.from(g.inventories.values())
        .sort((a,b) => (a.invName||'').localeCompare(b.invName||'')),
      count: (g.raw ?? []).length,
    }));
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.inventories.some(inv => inv.invName.toLowerCase().includes(q))
      );
    }
    arr.sort((a,b)=> a.name.localeCompare(b.name));
    return arr;
  }, [rows, query]);

  // fields
  const PROD_OPTIONS = products
    .slice().sort((a,b)=>(a.productName||'').localeCompare(b.productName||''))
    .map(p => ({ value: p.id, label: p.productName }));

  const INV_OPTIONS = inventories
    .slice().sort((a,b)=>(a.inventoryName||'').localeCompare(b.inventoryName||''))
    .map(i => ({ value: i.id, label: i.inventoryName }));

  const UNIT_OPTIONS = units
    .slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''))
    .map(u => ({ value: u.id, label: u.name }));

  const CREATE_FIELDS = [
    { name: 'product_id',   type: 'select', label: 'Product',   required: true, options: PROD_OPTIONS },
    { name: 'inventory_id', type: 'select', label: 'Inventory', required: true, options: INV_OPTIONS },
    { name: 'unit_id',      type: 'select', label: 'Unit',      required: true, options: UNIT_OPTIONS },
    { name: 'stockQuantity', type: 'number', step: 'any', label: 'Quantity', required: true },
  ];

  const EDIT_FIELDS = [
    { name: 'inventory_id', type: 'select', label: 'Inventory', required: true, options: INV_OPTIONS },
    { name: 'unit_id',      type: 'select', label: 'Unit',      required: true, options: UNIT_OPTIONS },
    { name: 'stockQuantity', type: 'number', step: 'any', label: 'Quantity', required: true },
  ];

  const sanitize = (fields, data) => {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.entries(data || {}).forEach(([k,v])=>{
      if (!allow.has(k)) return;
      if (v === '' || v === null || v === undefined) return;
      out[k] = v;
    });
    return out;
  };

  async function onSubmit(form) {
    setErr(''); setOk('');
    try {
      if (editRow?.id) {
        await api.put(`/stock/${editRow.id}`, sanitize(EDIT_FIELDS, form));
        setOk('Stock updated');
      } else {
        await api.post('/stock', sanitize(CREATE_FIELDS, form));
        setOk('Stock created');
      }
      setModalOpen(false); setEditRow(null); setInitialCreate({});
      fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  async function onDelete(item) {
    if (!window.confirm('Delete this stock record?')) return;
    try {
      await api.delete(`/stock/${item.id}`);
      setOk('Stock deleted'); setErr('');
      fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Stock</h1>
            <p className="text-sm text-slate-500">One card per product. Expand to see inventories and their units.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Boxes size={16} className="text-slate-400" />
              <input
                value={query}
                onChange={(e)=> setQuery(e.target.value)}
                placeholder="Search product or inventory…"
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
              onClick={()=>{
                setEditRow(null);
                setInitialCreate({});
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16} /> New Stock
            </button>
          </div>
        </div>
        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_,i)=><div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">No stock found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(g => {
            const key = g.pid ?? g.name;
            const isOpen = expanded.has(key);
            return (
              <div key={key} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_1px_0_0_rgb(0_0_0/0.02)]">
                {/* product header */}
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                    <Package size={20}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-slate-900">{g.name}</h3>
                      <CountBadge n={g.count}/>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      <button onClick={()=>toggle(key)} className="underline decoration-dotted">
                        {isOpen ? 'Click to collapse' : 'Click to expand'}
                      </button>
                      <span className="mx-1">·</span>
                      {/* product quick actions */}
                      <button
                        onClick={() => nav(`/dashboard/products?edit=${g.pid}`)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
                        title="Edit product"
                      >
                        <Settings2 size={14}/> Edit product
                      </button>
                      <button
                        onClick={()=>{
                          setEditRow(null);
                          setInitialCreate({ product_id: g.pid });
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50"
                        title="Create stock for this product"
                      >
                        <Plus size={14}/> New stock
                      </button>
                    </div>
                  </div>
                </div>

                {/* body (inventories with unit chips) */}
                <div className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="min-h-0">
                    <div className="mt-4 space-y-2">
                      {g.inventories.map(inv => (
                        <div key={`${g.name}-${inv.invName}`} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-slate-400"/>
                            <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                              {inv.invName}
                            </div>
                          </div>

                          {/* units for this inventory */}
                          {inv.units?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {inv.units
                                .slice()
                                .sort((a,b)=> (unitNameOf(a)||'').localeCompare(unitNameOf(b)||''))
                                .map(it => (
                                <div
                                  key={it.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                                >
                                  <span className="text-xs font-semibold text-slate-900">
                                    {it.stockQuantity}
                                  </span>
                                  <span className="text-[11px] text-slate-600">
                                    {unitNameOf(it)}
                                  </span>

                                  <button
                                    onClick={()=>{
                                      setEditRow({
                                        id: it.id,
                                        inventory_id: invIdOf(it),
                                        unit_id: unitIdOf(it),
                                        stockQuantity: it.stockQuantity,
                                      });
                                      setInitialCreate({});
                                      setModalOpen(true);
                                    }}
                                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                    title="Edit"
                                  >
                                    <Pencil size={14}/>
                                  </button>

                                  <button
                                    onClick={() => onDelete(it)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                    title="Delete"
                                  >
                                    <Trash2 size={14}/>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-slate-400">No unit records.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* modal */}
      <FormModal
        title={editRow ? 'Edit Stock' : 'Create Stock'}
        open={modalOpen}
        onClose={()=>{ setModalOpen(false); setEditRow(null); setInitialCreate({}); }}
        fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
        initial={editRow ? editRow : initialCreate}
        onSubmit={onSubmit}
      />
    </div>
  );
}