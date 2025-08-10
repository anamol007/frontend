import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Tag, Layers, Plus, Edit, Trash2, X, Search, RefreshCw } from 'lucide-react';
import { API_URL, authHeaders as h, Field } from '../utils/api';

/* helpers */
function mapCategory(raw) {
  const c = raw || {};
  const id = c.id ?? c.categoryId ?? c.category_id;
  const name = c.name ?? c.title ?? c.categoryName ?? '';
  const description = c.description ?? c.desc ?? '';
  const parent_id = c.parent_id ?? c.parentId ?? null;
  const productCount = c.productCount ?? c.productsCount ?? c.count ?? null;
  return { id, name, description, parent_id, productCount, _raw: c };
}
function payloadFromForm(f) {
  return {
    name: f.name || undefined,
    description: f.description || undefined,
    parent_id: f.parent_id ? Number(f.parent_id) : undefined,
  };
}

export default function CategoriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('');

  const [q, setQ] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', parent_id:'' });

  useEffect(() => { fetchRows(); }, []);

  async function fetchRows() {
    try {
      setLoading(true); setApiError(''); setNotice('');
      const res = await axios.get(`${API_URL}/categories`, { headers: h() });
      const data = res.data?.data ?? res.data?.categories ?? res.data ?? [];
      setRows(Array.isArray(data) ? data.map(mapCategory) : []);
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to load categories'); setRows([]);
    } finally { setLoading(false); }
  }

  function openCreate(){ setForm({ name:'', description:'', parent_id:'' }); setShowCreate(true); }
  function openEdit(c){ setEditingId(c.id); setForm({ name:c.name || '', description:c.description || '', parent_id: c.parent_id || '' }); setShowEdit(true); }

  async function handleCreate(e){ e.preventDefault();
    try { setSaving(true); setApiError(''); setNotice('');
      await axios.post(`${API_URL}/categories`, payloadFromForm(form), { headers: h() });
      setShowCreate(false); setNotice('Category created.'); await fetchRows();
    } catch (e) { setApiError(e?.response?.data?.message || 'Failed to create category'); }
    finally { setSaving(false); }
  }
  async function handleEdit(e){ e.preventDefault();
    try { setSaving(true); setApiError(''); setNotice('');
      await axios.put(`${API_URL}/categories/${editingId}`, payloadFromForm(form), { headers: h() });
      setShowEdit(false); setEditingId(null); setNotice('Category updated.'); await fetchRows();
    } catch (e) { setApiError(e?.response?.data?.message || 'Failed to update category'); }
    finally { setSaving(false); }
  }
  async function handleDelete(id){
    if (!window.confirm('Delete this category?')) return;
    try { setDeletingId(id); setApiError(''); setNotice('');
      await axios.delete(`${API_URL}/categories/${id}`, { headers: h() });
      setNotice('Category deleted.'); await fetchRows();
    } catch (e) { setApiError(e?.response?.data?.message || 'Failed to delete category'); }
    finally { setDeletingId(null); }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(c => [c.name, c.description].join(' ').toLowerCase().includes(term));
  }, [q, rows]);

  const stats = useMemo(() => ({
    total: filtered.length,
    withDesc: filtered.filter(c => (c.description || '').trim().length > 0).length,
  }), [filtered]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tr from-fuchsia-400/30 to-violet-400/30 blur-2xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-600 to-violet-600">
              Categories
            </h1>
            <p className="text-slate-500 text-sm">Organize products into groups.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRows} className="pill bg-slate-900/90 text-white hover:bg-slate-900"><RefreshCw size={14}/> Refresh</button>
            <button onClick={openCreate} className="pill bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:from-fuchsia-700 hover:to-violet-700"><Plus size={16}/> New Category</button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Layers} label="Total" value={stats.total} hue="from-fuchsia-500 to-pink-500" />
          <StatCard icon={Tag} label="With description" value={stats.withDesc} hue="from-violet-500 to-indigo-500" />
        </div>
      </div>

      {apiError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{apiError}</div>}
      {notice &&  <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{notice}</div>}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search categories…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-9 py-2 text-sm backdrop-blur focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100"
          />
        </div>
      </div>

      {/* List */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-tr from-fuchsia-400/15 to-violet-400/15 blur-3xl" />
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <div className="h-5 w-5 mr-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-600">No categories found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Products</th>
                  <th className="px-4 py-2 text-left w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-white/60">
                    <td className="px-4 py-2 font-medium text-slate-900">{c.name || '—'}</td>
                    <td className="px-4 py-2 text-slate-600 max-w-[50ch] truncate" title={c.description || ''}>{c.description || '—'}</td>
                    <td className="px-4 py-2">{c.productCount != null ? c.productCount : '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={()=>openEdit(c)} className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1.5"><Edit size={14}/> Edit</button>
                        <button onClick={()=>handleDelete(c.id)} disabled={deletingId === c.id} className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1.5 disabled:opacity-60"><Trash2 size={14}/> {deletingId === c.id ? 'Deleting…' : 'Delete'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CatModal title="Create Category" rows={rows} form={form} setForm={setForm} onCancel={()=>setShowCreate(false)} onSubmit={handleCreate} saving={saving}/>
      )}
      {showEdit && (
        <CatModal title="Edit Category" rows={rows} form={form} setForm={setForm} onCancel={()=>{ setShowEdit(false); setEditingId(null); }} onSubmit={handleEdit} saving={saving}/>
      )}
    </div>
  );
}

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

function CatModal({ title, rows, form, setForm, onCancel, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-tr from-fuchsia-400/20 to-violet-400/20 blur-2xl" />
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-1 hover:opacity-70" onClick={onCancel}><X size={18}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <Field label="Name" required>
            <input className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100"
                   value={form.name}
                   onChange={(e)=>setForm({...form, name:e.target.value})}
                   required/>
          </Field>
          <Field label="Description">
            <textarea rows={3} className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100"
                      value={form.description}
                      onChange={(e)=>setForm({...form, description:e.target.value})}/>
          </Field>
          {rows.length > 0 && (
            <Field label="Parent (optional)">
              <select className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100"
                      value={form.parent_id}
                      onChange={(e)=>setForm({...form, parent_id:e.target.value})}>
                <option value="">— None —</option>
                {rows.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          )}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:from-fuchsia-700 hover:to-violet-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}