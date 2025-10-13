// src/pages/ProductUnitsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Search, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

/* ---------- helpers ---------- */
const prettyDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const byAlpha = (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });

/* ---------- Confirm Dialog ---------- */
function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/30 bg-white/90 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldAlert size={20} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500">{message}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            <Trash2 size={16} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // delete confirm
  const [confirm, setConfirm] = useState({ open: false, row: null });

  // pagination
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);

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
      const arr = Array.isArray(list) ? list.slice().sort(byAlpha) : [];
      setRows(arr);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [currentPage, page]);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, currentPage]);

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
      setPage(1);
      await refresh();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  // open confirm UI
  function askDelete(row) {
    if (!isSuper) { setErr('Only Super Admin can delete units'); return; }
    setConfirm({ open: true, row });
  }

  async function confirmDelete() {
    const row = confirm.row;
    setConfirm({ open: false, row: null });
    if (!row) return;
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
                onChange={(e)=> { setQ(e.target.value); setPage(1); }}
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
      ) : paged.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No units found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map(u => (
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
                    onClick={() => askDelete(u)}
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

      {/* Pagination (matches other pages) */}
      <div className="flex items-center justify-center gap-2 pt-1 pb-6">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
          title="Previous"
        >
          <span className="opacity-60">‹</span> Prev
        </button>

        {(() => {
          const nums = [];
          const start = Math.max(1, currentPage - 1);
          const end = Math.min(totalPages, currentPage + 1);
          for (let i = start; i <= end; i++) nums.push(i);
          if (currentPage === 1 && totalPages >= 2 && !nums.includes(2)) nums.push(2);

          return nums.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={
                n === currentPage
                  ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-50"
              }
            >
              {n}
            </button>
          ));
        })()}

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
          title="Next"
        >
          Next <span className="opacity-60">›</span>
        </button>
      </div>

      {/* Modal */}
      <FormModal
        title={editRow ? 'Edit Unit' : 'Create Unit'}
        open={open}
        onClose={()=>{ setOpen(false); setEditRow(null); }}
        fields={FIELDS}
        initial={editRow || {}}
        onSubmit={handleSubmit}
      />

      {/* Custom delete confirmation */}
      <ConfirmDialog
        open={confirm.open}
        title="Delete Unit?"
        message={confirm.row ? `This will permanently remove unit "${confirm.row.name}".` : ''}
        confirmLabel="Delete"
        onCancel={() => setConfirm({ open: false, row: null })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}