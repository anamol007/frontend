// src/pages/ProductsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Search, Tag, Package2, Layers, DollarSign, X, Save } from 'lucide-react';
import { api } from '../utils/api';

// small helpers
const cls = (...a) => a.filter(Boolean).join(' ');
const byAlpha = (get = (x) => x) => (a, b) => `${get(a)}`.localeCompare(`${get(b)}`, undefined, { sensitivity: 'base' });

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(680px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

// Pretty pill for a unit rate
function RateChip({ name, rate }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
      <Layers size={14} className="opacity-60" /> {name}: <span className="font-semibold">{rate}</span>
    </span>
  );
}

export default function ProductsPage() {
  // data
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  // auth / role
  const [me, setMe] = useState(null);
  const isSuper = me?.role === 'superadmin';

  // product create/edit modal
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState(null); // product | null
  const [form, setForm] = useState({ productName: '', description: '', category_id: '' });

  // for create only: initial units (array of { unit_id, rate })
  const [initUnits, setInitUnits] = useState([]);

  // unit-manager modal (per product)
  const [openUnits, setOpenUnits] = useState(false);
  const [unitsForProduct, setUnitsForProduct] = useState([]); // [{id, unit:{id,name}, rate}]
  const [unitsProduct, setUnitsProduct] = useState(null); // product row
  const [addUnitRow, setAddUnitRow] = useState({ unit_id: '', rate: '' });

  // who am I?
  async function fetchMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      // ignore; page still works read-only
    }
  }

  // fetchers
  async function fetchProducts() {
    setLoading(true);
    setErr(''); setOk('');
    try {
      const res = await api.get('/products'); // returns productUnits included
      const data = res?.data?.data ?? res?.data ?? [];
      // sort alpha by productName
      setProducts((Array.isArray(data) ? data : []).slice().sort(byAlpha(p => p.productName)));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load products');
    } finally {
           setLoading(false);
    }
  }

  async function fetchUnits() {
    try {
      const r = await api.get('/units');
      const list = r?.data?.data ?? r?.data ?? [];
      setUnits((Array.isArray(list) ? list : []).slice().sort(byAlpha(u => u.name)));
    } catch (e) {
      // ignore; create/edit will still work without units list (except rates UI)
    }
  }

  async function fetchCategories() {
    try {
      const r = await api.get('/categories');
      const list = r?.data?.data ?? r?.data ?? [];
      setCategories((Array.isArray(list) ? list : []).slice().sort(byAlpha(c => c.name || c.categoryName)));
    } catch {}
  }

  useEffect(() => {
    fetchMe();
    fetchProducts();
    fetchUnits();
    fetchCategories();
  }, []);

  // derived lists
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter(p =>
      (p.productName || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term) ||
      (p?.category?.name || p?.categoryName || '').toLowerCase().includes(term)
    );
  }, [q, products]);

  // open create
  const openCreate = () => {
    if (!isSuper) { setErr('Only Super Admin can create products'); return; }
    setEditing(null);
    setForm({ productName: '', description: '', category_id: '' });
    setInitUnits([]);
    setOpenEdit(true);
  };

  // open edit
  const openEditProduct = (p) => {
    if (!isSuper) { setErr('Only Super Admin can edit products'); return; }
    setEditing(p);
    setForm({
      productName: p.productName || '',
      description: p.description || '',
      category_id: p.category_id ?? p.categoryId ?? p?.category?.id ?? ''
    });
    setInitUnits([]); // edit modal does not change units (use Manage Units)
    setOpenEdit(true);
  };

  // create/edit submit
  async function submitProduct(e) {
    e.preventDefault();
    if (!isSuper) { setErr('Only Super Admin can perform this action'); return; }
    setErr(''); setOk('');
    try {
      const body = {
        productName: form.productName?.trim(),
        description: form.description?.trim(),
        category_id: form.category_id || null
      };

      if (!editing && initUnits.length > 0) {
        // API accepts "units" only on create
        body.units = initUnits
          .filter(u => u.unit_id && u.rate !== '' && !Number.isNaN(Number(u.rate)))
          .map(u => ({ unit_id: Number(u.unit_id), rate: Number(u.rate) }));
      }

      if (editing?.id) {
        await api.put(`/products/${editing.id}`, body);
        setOk('Product updated');
      } else {
        await api.post('/products', body);
        setOk('Product created');
      }
      setOpenEdit(false);
      await fetchProducts();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  // delete product
  async function deleteProduct(p) {
    if (!isSuper) { setErr('Only Super Admin can delete products'); return; }
    if (!window.confirm(`Delete product "${p.productName}"? This cannot be undone.`)) return;
    setErr(''); setOk('');
    try {
      await api.delete(`/products/${p.id}`);
      setOk('Product deleted');
      await fetchProducts();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // units manager
  async function openUnitsManager(p) {
    if (!isSuper) { setErr('Only Super Admin can manage unit rates'); return; }
    setUnitsProduct(p);
    setUnitsForProduct([]);
    setAddUnitRow({ unit_id: '', rate: '' });
    setOpenUnits(true);
    try {
      const r = await api.get(`/product-units/product/${p.id}`);
      const list = r?.data?.data ?? r?.data ?? [];
      setUnitsForProduct((Array.isArray(list) ? list : []).slice().sort(byAlpha(x => x?.unit?.name)));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load product units');
    }
  }

  async function addUnitToProduct() {
    if (!isSuper) { setErr('Only Super Admin can add unit rates'); return; }
    setErr(''); setOk('');
    try {
      const unit_id = Number(addUnitRow.unit_id);
      const rate = Number(addUnitRow.rate);
      if (!unitsProduct?.id || !unit_id || Number.isNaN(rate)) return;
      await api.post('/product-units', { product_id: unitsProduct.id, unit_id, rate });
      // refresh
      const r = await api.get(`/product-units/product/${unitsProduct.id}`);
      const list = r?.data?.data ?? r?.data ?? [];
      setUnitsForProduct((Array.isArray(list) ? list : []).slice().sort(byAlpha(x => x?.unit?.name)));
      setAddUnitRow({ unit_id: '', rate: '' });
      setOk('Unit added');
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Add failed');
    }
  }

  async function updateUnitRate(puId, newRate) {
    if (!isSuper) { setErr('Only Super Admin can update unit rates'); return; }
    setErr(''); setOk('');
    try {
      await api.put(`/product-units/${puId}`, { rate: Number(newRate) });
      setOk('Rate updated');
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Update failed');
    }
  }

  async function removeUnitFromProduct(puId) {
    if (!isSuper) { setErr('Only Super Admin can remove unit rates'); return; }
    if (!window.confirm('Remove this unit from product?')) return;
    setErr(''); setOk('');
    try {
      await api.delete(`/product-units/${puId}`);
      setUnitsForProduct(prev => prev.filter(x => x.id !== puId));
      setOk('Unit removed');
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // UI
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
              {isSuper ? 'Browse, create, edit, and manage unit rates.' : 'Browse products and unit rates (read-only).'}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm sm:w-auto">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search product, category…"
                className="w-full sm:w-60 bg-transparent outline-none text-sm"
              />
            </div>
            <button
              onClick={fetchProducts}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            {isSuper && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16} /> New Product
              </button>
            )}
          </div>
        </div>
        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No products found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
            <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl">
              <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                  <span className="text-lg font-semibold">{(p.productName || '?').charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-slate-900">{p.productName || '—'}</h3>
                  </div>
                  <p className="truncate text-sm text-slate-600">{p.description || '—'}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Tag size={14} /> {(p?.category?.name || 'Uncategorized')}
                  </div>
                </div>
              </div>

              {/* rates */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(p.productUnits || []).slice().sort(byAlpha(x => x?.unit?.name)).map(u => (
                  <RateChip key={u.id} name={u?.unit?.name ?? '—'} rate={u?.rate ?? '—'} />
                ))}
                {(!p.productUnits || p.productUnits.length === 0) && (
                  <span className="text-xs text-slate-400">No rates yet</span>
                )}
              </div>

              {/* actions (superadmin only) */}
              {isSuper && (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => openUnitsManager(p)}
                    className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <DollarSign size={16} /> Manage Units
                  </button>
                  <button
                    onClick={() => openEditProduct(p)}
                    className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Pencil size={16} /> Edit
                  </button>
                  <button
                    onClick={() => deleteProduct(p)}
                    className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Product */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        title={editing ? 'Edit Product' : 'New Product'}
        footer={
          <div className="flex justify-end gap-2">
            <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm" onClick={()=>setOpenEdit(false)}>Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={submitProduct}>
              <Save size={16} /> {editing ? 'Save changes' : 'Create'}
            </button>
          </div>
        }
      >
        <form onSubmit={submitProduct} className="grid gap-4">
          <Field label="Product Name">
            <input className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.productName}
              onChange={(e)=> setForm(f => ({...f, productName: e.target.value}))}
              required
            />
          </Field>

          <Field label="Description">
            <textarea className="min-h-[80px] rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.description}
              onChange={(e)=> setForm(f => ({...f, description: e.target.value}))}
            />
          </Field>

          <Field label="Category">
            <select
              className="rounded-xl border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.category_id}
              onChange={(e)=> setForm(f => ({...f, category_id: e.target.value}))}
            >
              <option value="">— Select —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.categoryName}</option>
              ))}
            </select>
          </Field>

          {!editing && (
            <div className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium text-slate-700">Initial Units (optional)</div>
              <div className="grid gap-2">
                {initUnits.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <select
                      className="w-48 rounded-xl border bg-white px-3 py-2"
                      value={row.unit_id}
                      onChange={(e)=> {
                        const v = e.target.value;
                        setInitUnits(list => list.map((r,i)=> i===idx ? {...r, unit_id: v} : r));
                      }}
                    >
                      <option value="">Unit…</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Rate"
                      className="w-36 rounded-xl border px-3 py-2"
                      value={row.rate}
                      onChange={(e)=> {
                        const v = e.target.value;
                        setInitUnits(list => list.map((r,i)=> i===idx ? {...r, rate: v} : r));
                      }}
                    />
                    <button
                      type="button"
                      onClick={()=> setInitUnits(list => list.filter((_,i)=> i!==idx))}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={()=> setInitUnits(list => [...list, { unit_id: '', rate: '' }])}
                  className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <Plus size={16}/> Add unit &amp; rate
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">You can also add/edit rates later with “Manage Units”.</p>
            </div>
          )}
        </form>
      </Modal>

      {/* Manage Units for a Product */}
      <Modal
        open={openUnits}
        onClose={()=> setOpenUnits(false)}
        title={unitsProduct ? `Manage Units — ${unitsProduct.productName}` : 'Manage Units'}
      >
        {/* existing units */}
        <div className="grid gap-2">
          {unitsForProduct.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No units yet.</div>
          ) : (
            unitsForProduct.map(row => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
                <span className="min-w-28 rounded-lg bg-slate-100 px-2 py-1 text-sm">{row?.unit?.name ?? '—'}</span>
                <input
                  type="number" step="0.01"
                  defaultValue={row.rate}
                  onBlur={(e)=> updateUnitRate(row.id, e.target.value)}
                  className="w-36 rounded-xl border px-3 py-2"
                />
                <button
                  onClick={()=> removeUnitFromProduct(row.id)}
                  className="ml-auto rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {/* add new */}
        <div className="mt-4 rounded-xl border p-3">
          <div className="mb-2 text-sm font-medium text-slate-700">Add unit</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="w-48 rounded-xl border bg-white px-3 py-2"
              value={addUnitRow.unit_id}
              onChange={(e)=> setAddUnitRow(r => ({...r, unit_id: e.target.value}))}
            >
              <option value="">Unit…</option>
              {units
                .filter(u => !unitsForProduct.some(r => r?.unit?.id === u.id))
                .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input
              type="number" step="0.01" placeholder="Rate"
              className="w-36 rounded-xl border px-3 py-2"
              value={addUnitRow.rate}
              onChange={(e)=> setAddUnitRow(r => ({...r, rate: e.target.value}))}
            />
            <button
              onClick={addUnitToProduct}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16}/> Add
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}