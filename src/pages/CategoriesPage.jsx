import React, { useEffect, useMemo, useState } from 'react';
import { Tags, Plus, Pencil, Trash2, Search, RefreshCw, Layers } from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

function StatBadge({ icon: Icon, label, value, tone = 'indigo' }) {
  const tones = {
    indigo: 'from-indigo-500/10 to-violet-500/10 text-indigo-700',
    emerald: 'from-emerald-500/10 to-teal-500/10 text-emerald-700',
  };
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-white/60 bg-gradient-to-br p-3 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,.6),0_6px_20px_-10px_rgba(2,6,23,.2)]"
      style={{ backgroundClip: 'padding-box' }}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(new Map()); // categoryId -> productCount
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // --- Fetch categories
  async function refresh() {
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const res = await api.get('/categories');
      const data = res?.data?.data ?? res?.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching categories');
    } finally {
      setLoading(false);
    }
  }

  // --- Fetch product count stats
  async function loadCounts() {
    try {
      const r = await api.get('/categories/stats/product-count');
      const arr = r?.data?.data ?? r?.data ?? [];
      const map = new Map();
      (Array.isArray(arr) ? arr : []).forEach(s => {
        const id = Number(s?.id ?? s?.categoryId ?? s?.CategoryId ?? s?.category_id);
        const c  = Number(s?.productCount ?? s?.count ?? s?.total ?? s?.products ?? 0);
        if (!Number.isNaN(id)) map.set(id, c);
      });
      setCounts(map);
    } catch {
      /* non-fatal */ 
    }
  }

  useEffect(() => { refresh(); loadCounts(); }, []);

  // --- Derived: search + alphabetical sort
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = !s
      ? rows
      : rows.filter(c =>
          (c.name || c.categoryName || '').toLowerCase().includes(s) ||
          (c.categoryCol || '').toLowerCase().includes(s)
        );
    return [...base].sort((a,b) =>
      (a.name || a.categoryName || '').localeCompare(b.name || b.categoryName || '')
    );
  }, [rows, q]);

  // --- Fields (STRICT to backend spec)
  const CREATE_FIELDS = [
    { name: 'name',        type: 'text', label: 'Category Name', required: true },
    { name: 'categoryCol', type: 'text', label: 'Description / Notes' },
  ];
  const EDIT_FIELDS = CREATE_FIELDS;

  const allow = (fields, payload) => {
    const wh = new Set(fields.map(f => f.name));
    const out = {};
    Object.keys(payload || {}).forEach(k => {
      if (wh.has(k) && payload[k] !== '' && payload[k] != null) out[k] = payload[k];
    });
    return out;
  };

  async function handleSubmit(form) {
    try {
      setErr(''); setOk('');
      if (editRow?.id) {
        const clean = allow(EDIT_FIELDS, form);
        await api.put(`/categories/${editRow.id}`, clean);
        setOk('Category updated');
      } else {
        const clean = allow(CREATE_FIELDS, form);
        await api.post('/categories', clean);
        setOk('Category created');
      }
      setOpen(false); setEditRow(null);
      await refresh(); await loadCounts();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete category "${row.name || row.categoryName}"?`)) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/categories/${row.id}`);
      setOk('Category deleted');
      await refresh(); await loadCounts();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  const totalCategories = rows.length;
  const totalProducts = [...counts.values()].reduce((a,b)=>a+b,0);

  return (
    <div className="space-y-5 bg-gradient-to-br from-slate-50 via-indigo-50 to-emerald-50/40">
      {/* Header */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_1px_0_rgba(255,255,255,.6),0_10px_30px_-12px_rgba(2,6,23,.25)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <Tags size={18}/>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
              <p className="text-sm text-slate-500">Organize products by category and see product counts.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search categories…"
                className="w-56 bg-transparent outline-none text-sm placeholder:text-slate-400"
              />
            </div>

            <button
              onClick={()=>{ setEditRow(null); setOpen(true); }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16}/> New Category
            </button>

            <button
              onClick={()=>{ refresh(); loadCounts(); }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw size={16}/> Refresh
            </button>
          </div>
        </div>

        {/* inline messages */}
        {err && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}

        {/* header stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:w-[420px]">
          <StatBadge icon={Layers} label="Total Categories" value={totalCategories} tone="indigo"/>
          <StatBadge icon={Tags}   label="Total Products"  value={totalProducts}  tone="emerald"/>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/70 p-10 text-center text-slate-500 backdrop-blur-xl">
          No categories found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(cat => {
            const name = cat.name || cat.categoryName || '—';
            const desc = cat.categoryCol || '';
            const count = counts.get(Number(cat.id)) || 0;
            return (
              <div
                key={cat.id}
                className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_1px_0_rgba(255,255,255,.6),0_18px_40px_-18px_rgba(2,6,23,.35)] backdrop-blur-xl transition-shadow hover:shadow-xl"
              >
                {/* sheen */}
                <div className="pointer-events-none absolute -top-16 -right-16 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />

                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-white">
                    <Tags size={18}/>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">{name}</h3>
                    <p className="truncate text-sm text-slate-600">{desc || '—'}</p>
                    <p className="mt-1 text-xs text-slate-400">ID: {cat.id ?? '—'}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                    Products: <span className="font-semibold">{count}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={()=>{ setEditRow(cat); setOpen(true); }}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <button
                      onClick={()=> handleDelete(cat)}
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

      {/* Modal for create/edit */}
      <FormModal
        title={editRow ? 'Edit Category' : 'Create Category'}
        open={open}
        onClose={()=>{ setOpen(false); setEditRow(null); }}
        fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
        initial={editRow || {}}
        onSubmit={handleSubmit}
      />
    </div>
  );
}