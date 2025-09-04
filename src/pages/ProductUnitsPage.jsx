// src/pages/ProductUnitsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

/* ---------- helpers ---------- */
const prettyDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  });
};

export default function ProductUnitsPage() {
  // auth / role
  const [me, setMe] = useState(null);
  const isSuper = me?.role === 'superadmin';

  // data
  const [rows, setRows] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');

  // modal
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  /* ---------- bootstrap ---------- */
  async function fetchMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      // keep null; page will act read-only
    }
  }

  async function refresh() {
    try {
      setLoading(true);
      setErr(''); setOk('');
      const r = await api.get('/units');
      const list = r?.data?.data ?? r?.data ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error loading units');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMe(); refresh(); }, []);

  /* ---------- derived ---------- */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u => (u.name || '').toLowerCase().includes(term));
  }, [rows, q]);

  /* ---------- fields ---------- */
  const FIELDS = [{ name: 'name', type: 'text', label: 'Unit Name (e.g., KG, BORI)', required: true }];

  const sanitize = (fields, payload) => {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.keys(payload || {}).forEach(k => {
      const v = payload[k];
      if (allow.has(k) && v !== '' && v != null) out[k] = v;
    });
    return out;
  };

  /* ---------- actions (superadmin only) ---------- */
  function openCreate() {
    if (!isSuper) { setErr('Only Super Admin can create units'); return; }
    setEditRow(null);
    setOpen(true);
  }
  function openEdit(row) {
    if (!isSuper) { setErr('Only Super Admin can edit units'); return; }
    setEditRow(row);
    setOpen(true);
  }

  async function handleSubmit(form) {
    try {
      if (!isSuper) { setErr('Only Super Admin can perform this action'); return; }
      setErr(''); setOk('');
      const body = sanitize(FIELDS, form);
      if (editRow?.id) {
        await api.put(`/units/${editRow.id}`, body);
        setOk('Unit updated');
      } else {
        await api.post('/units', body);
        setOk('Unit created');
      }
      setOpen(false); setEditRow(null);
      await refresh();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  async function handleDelete(row) {
    if (!isSuper) { setErr('Only Super Admin can delete units'); return; }
    if (!window.confirm(`Delete unit "${row.name}"?`)) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/units/${row.id}`);
      setOk('Unit deleted');
      await refresh();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  /* ---------- render ---------- */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Product Units</h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? 'Create and manage units (e.g., KG, BORI).'
                : 'Browse available units (read-only).'}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm sm:w-auto">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search units…"
                className="w-full sm:w-64 bg-transparent outline-none text-sm"
              />
            </div>

            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16}/> Search/Refresh
            </button>

            {isSuper && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16}/> New Unit
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

      {/* Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(4)].map((_,i)=>(
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No units found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(u => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                    <Layers size={18}/>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">{u.name || '—'}</h3>
                    <p className="text-xs text-slate-500">
                      ID: {u.id ?? '—'} • Updated {prettyDate(u.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>

              {isSuper && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(u)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Pencil size={16}/> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                  >
                    <Trash2 size={16}/> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <FormModal
        title={editRow ? 'Edit Unit' : 'Create Unit'}
        open={open}
        onClose={()=>{ setOpen(false); setEditRow(null); }}
        fields={FIELDS}
        initial={editRow || {}}
        onSubmit={handleSubmit}
      />
    </div>
  );
}