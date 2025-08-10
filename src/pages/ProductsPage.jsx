// src/pages/ProductsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Plus, Edit, Trash2, X, Search, RefreshCw, Package, Tag, Gauge
} from 'lucide-react';
import { API_URL, authHeaders as h, Field } from '../utils/api';

/* ---------------- helpers ---------------- */
const toNum = (v) => (v === '' || v == null ? undefined : Number(v));
const avg = (arr) => (arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : null);

function mapProduct(raw) {
  const p = raw || {};
  const id = p.id ?? p.productId ?? p.product_id;
  const name = p.productName ?? p.name ?? p.product_name ?? '';
  const ratePerKg = p.ratePerKg ?? p.rate_per_kg ?? p.rate ?? null;
  const ratePerBori = p.ratePerBori ?? p.rate_per_bori ?? p.pricePerBori ?? null;
  const description = p.description ?? p.desc ?? '';
  const category_id = p.category_id ?? p.categoryId ?? p.category?.id ?? p.categoryID ?? null;
  const categoryName = p.category?.name ?? p.categoryName ?? p.category?.title ?? '';
  return { id, name, ratePerKg, ratePerBori, description, category_id, categoryName, _raw: p };
}
function payloadFromForm(f) {
  return {
    productName: f.name || undefined,
    ratePerKg: toNum(f.ratePerKg),
    ratePerBori: toNum(f.ratePerBori),
    description: f.description || undefined,
    category_id: f.category_id ? Number(f.category_id) : undefined,
  };
}
function chipColor(seed) {
  // simple deterministic color choice from text
  const palette = [
    'bg-indigo-100 text-indigo-700',
    'bg-fuchsia-100 text-fuchsia-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-cyan-100 text-cyan-700',
    'bg-rose-100 text-rose-700',
    'bg-violet-100 text-violet-700',
  ];
  if (!seed) return palette[0];
  let h=0; for (let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

/* ---------------- page ---------------- */
export default function ProductsPage() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('');

  // filters
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(''); // category id

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name:'', ratePerKg:'', ratePerBori:'', description:'', category_id:'' });

  useEffect(() => { fetchCats(); }, []);
  useEffect(() => { fetchRows(); }, [cat]);

  async function fetchCats() {
    try {
      const res = await axios.get(`${API_URL}/categories`, { headers: h() });
      const list = res.data?.data ?? res.data?.categories ?? res.data ?? [];
      const mapped = Array.isArray(list) ? list.map(c => ({
        id: c.id ?? c.category_id ?? c.categoryId,
        name: c.name ?? c.title ?? c.categoryName ?? 'Unnamed',
      })) : [];
      setCategories(mapped.filter(c => c.id != null));
    } catch { setCategories([]); }
  }
  async function fetchRows() {
    try {
      setLoading(true); setApiError(''); setNotice('');
      const path = cat ? `/products/category/${cat}` : `/products`;
      const res = await axios.get(`${API_URL}${path}`, { headers: h() });
      const data = res.data?.data ?? res.data?.products ?? res.data ?? [];
      const mapped = Array.isArray(data) ? data.map(mapProduct) : [];
      setRows(mapped);
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to load products');
      setRows([]);
    } finally { setLoading(false); }
  }

  function openCreate() {
    setForm({ name:'', ratePerKg:'', ratePerBori:'', description:'', category_id: cat || '' });
    setShowCreate(true);
  }
  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      ratePerKg: p.ratePerKg ?? '',
      ratePerBori: p.ratePerBori ?? '',
      description: p.description || '',
      category_id: p.category_id || '',
    });
    setShowEdit(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      setSaving(true); setApiError(''); setNotice('');
      await axios.post(`${API_URL}/products`, payloadFromForm(form), { headers: h() });
      setShowCreate(false);
      setNotice('Product created successfully.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to create product');
    } finally { setSaving(false); }
  }
  async function handleEdit(e) {
    e.preventDefault();
    try {
      setSaving(true); setApiError(''); setNotice('');
      await axios.put(`${API_URL}/products/${editingId}`, payloadFromForm(form), { headers: h() });
      setShowEdit(false); setEditingId(null);
      setNotice('Product updated successfully.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to update product');
    } finally { setSaving(false); }
  }
  async function handleDelete(id) {
    if (!window.confirm('Delete this product? This action cannot be undone.')) return;
    try {
      setDeletingId(id); setApiError(''); setNotice('');
      await axios.delete(`${API_URL}/products/${id}`, { headers: h() });
      setNotice('Product deleted.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to delete product');
    } finally { setDeletingId(null); }
  }

  // search + stats
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [String(c.id), c.name])), [categories]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(p => {
      const bag = [
        p.name, p.description, p.categoryName,
        catMap[String(p.category_id || '')],
        String(p.ratePerKg ?? ''),
        String(p.ratePerBori ?? '')
      ].join(' ').toLowerCase();
      return bag.includes(term);
    });
  }, [q, rows, catMap]);

  const stats = useMemo(() => {
    const rkg = filtered.map(x => Number(x.ratePerKg)).filter(n => !isNaN(n));
    const rbr = filtered.map(x => Number(x.ratePerBori)).filter(n => !isNaN(n));
    const cats = new Set(filtered.map(x => x.category_id || x.categoryName || ''));
    return {
      total: filtered.length,
      categories: cats.has('') ? cats.size - 1 : cats.size,
      avgKg: rkg.length ? avg(rkg) : null,
      avgBori: rbr.length ? avg(rbr) : null,
    };
  }, [filtered]);

  return (
    <div className="animate-fade-in">
      {/* Fancy header */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-400/30 to-fuchsia-400/30 blur-2xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-fuchsia-600">
              Products
            </h1>
            <p className="text-slate-500 text-sm">Management for your catalog.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRows} className="pill bg-slate-900/90 text-white hover:bg-slate-900">
              <RefreshCw size={14}/> Refresh
            </button>
            <button onClick={openCreate} className="pill bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white hover:from-indigo-700 hover:to-fuchsia-700 shadow-sm">
              <Plus size={16}/> New Product
            </button>
          </div>
        </div>

        {/* quick stats */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Package} label="Total" value={stats.total} hue="from-indigo-500 to-sky-500" />
          <StatCard icon={Tag} label="Categories" value={stats.categories} hue="from-fuchsia-500 to-pink-500" />
          <StatCard icon={Gauge} label="Avg / Kg" value={stats.avgKg?.toFixed(2) ?? '—'} hue="from-emerald-500 to-cyan-500" />
          <StatCard icon={Gauge} label="Avg / Bori" value={stats.avgBori?.toFixed(2) ?? '—'} hue="from-amber-500 to-orange-500" />
        </div>
      </div>

      {/* Alerts */}
      {apiError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{apiError}</div>}
      {notice && <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{notice}</div>}

      {/* Filters bar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search products…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-9 py-2 text-sm backdrop-blur focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm backdrop-blur focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            value={cat}
            onChange={(e)=>setCat(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-tr from-indigo-400/15 to-fuchsia-400/15 blur-3xl" />
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <div className="h-5 w-5 mr-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-600">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Rate / Kg</th>
                  <th className="px-4 py-2 text-left">Rate / Bori</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-white/60">
                    <td className="px-4 py-2 font-medium text-slate-900">{p.name || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[12px] ${chipColor(p.categoryName || '')}`}>
                        {p.categoryName || (catMap[String(p.category_id || '')] || '—')}
                      </span>
                    </td>
                    <td className="px-4 py-2">{p.ratePerKg != null ? Number(p.ratePerKg).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2">{p.ratePerBori != null ? Number(p.ratePerBori).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-slate-600 max-w-[40ch] truncate" title={p.description || ''}>
                      {p.description || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={()=>openEdit(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1.5"
                        >
                          <Edit size={14}/> Edit
                        </button>
                        <button
                          onClick={()=>handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <Trash2 size={14}/> {deletingId === p.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modals */}
      {showCreate && (
        <ProdModal
          title="Create Product"
          categories={categories}
          form={form}
          setForm={setForm}
          onCancel={()=>setShowCreate(false)}
          onSubmit={handleCreate}
          saving={saving}
        />
      )}
      {showEdit && (
        <ProdModal
          title="Edit Product"
          categories={categories}
          form={form}
          setForm={setForm}
          onCancel={()=>{ setShowEdit(false); setEditingId(null); }}
          onSubmit={handleEdit}
          saving={saving}
        />
      )}
    </div>
  );
}

/* -------------- subcomponents -------------- */
function StatCard({ icon: Icon, label, value, hue }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur shadow-sm">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gradient-to-tr ${hue} opacity-25 blur-2xl`} />
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18}/>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-xl font-semibold text-slate-900">{value ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}

function ProdModal({ title, categories, form, setForm, onCancel, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-400/20 to-fuchsia-400/20 blur-2xl" />
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-1 hover:opacity-70" onClick={onCancel}><X size={18}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Product name" required>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={form.name}
                onChange={(e)=>setForm({...form, name:e.target.value})}
                required
              />
            </Field>
            <Field label="Category" required>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={form.category_id}
                onChange={(e)=>setForm({...form, category_id:e.target.value})}
                required
              >
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Rate per Kg">
              <input
                type="number" step="0.01"
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={form.ratePerKg}
                onChange={(e)=>setForm({...form, ratePerKg:e.target.value})}
              />
            </Field>
            <Field label="Rate per Bori">
              <input
                type="number" step="0.01"
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={form.ratePerBori}
                onChange={(e)=>setForm({...form, ratePerBori:e.target.value})}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              value={form.description}
              onChange={(e)=>setForm({...form, description:e.target.value})}
            />
          </Field>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200"
              onClick={onCancel}
            >Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white hover:from-indigo-700 hover:to-fuchsia-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}