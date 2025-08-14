// src/pages/ProductUnitsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { api } from '../utils/api';

function UnitRow({ u, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-gradient-to-br from-white/85 to-white/60 p-4 hover:shadow-md transition-shadow">
      <div className="min-w-0">
        <div className="text-base font-semibold text-slate-900 truncate">{u.name}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          ID: {u.id} • Updated {new Date(u.updatedAt || u.createdAt).toLocaleString()}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(u)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <Pencil size={14}/> Edit
        </button>
        <button
          onClick={() => onDelete(u)}
          className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          <Trash2 size={14}/> Delete
        </button>
      </div>
    </div>
  );
}

export default function ProductUnitsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [name, setName] = useState('');

  function openCreate() { setEditRow(null); setName(''); setModalOpen(true); }
  function openEdit(u) { setEditRow(u); setName(u.name || ''); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditRow(null); setName(''); }

  async function refresh() {
    setLoading(true); setErr(''); setOk('');
    try {
      const r = await api.get('/units');
      const data = r?.data?.data ?? r?.data ?? [];
      const list = Array.isArray(data) ? data : [];
      list.sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));
      setRows(list);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching units');
    } finally {
      setLoading(false);
    }
  }

  async function search(nameQuery) {
    const term = nameQuery.trim();
    if (!term) return refresh();
    setLoading(true); setErr(''); setOk('');
    try {
      const r = await api.get('/units/search', { params: { name: term } });
      const data = r?.data?.data ?? r?.data ?? [];
      const list = Array.isArray(data) ? data : [];
      list.sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));
      setRows(list);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u => (u.name || '').toLowerCase().includes(term));
  }, [rows, q]);

  async function save() {
    try {
      setErr(''); setOk('');
      const body = { name: name.trim() };
      if (!body.name) { setErr('Name is required'); return; }

      if (editRow?.id) {
        await api.put(`/units/${editRow.id}`, body);
        setOk('Unit updated');
      } else {
        await api.post('/units', body);
        setOk('Unit created');
      }
      closeModal();
      await refresh();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Save failed');
    }
  }

  async function onDelete(u) {
    if (!window.confirm(`Delete unit "${u.name}"?`)) return;
    try {
      await api.delete(`/units/${u.id}`);
      await refresh();
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Product Units</h1>
            <p className="text-sm text-slate-500">Create and manage units (e.g., KG, BORI).</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e)=> setQ(e.target.value)}
              onKeyDown={(e)=> { if (e.key === 'Enter') search(q); }}
              placeholder="Search units…"
              className="w-56 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
            <button
              onClick={() => search(q)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16}/> Search/Refresh
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16}/> New Unit
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

      {/* List */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No units found.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(u => (
            <UnitRow key={u.id} u={u} onEdit={openEdit} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{editRow ? 'Edit Unit' : 'Create Unit'}</h3>

            <label className="block text-sm text-slate-600 mb-1">Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e)=> setName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="e.g., KG"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={closeModal} className="rounded-xl border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
              <button onClick={save} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                {editRow ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}