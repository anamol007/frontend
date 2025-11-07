// src/pages/CustomersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCircle2, Plus, Pencil, Trash2, Search, RefreshCw, Phone, MapPin, ShieldAlert, X
} from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';
import { useNavigate } from 'react-router-dom';

/* ---------------- Avatar ---------------- */
function Avatar({ name = '' }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
      <span className="text-lg font-semibold">{letter}</span>
    </div>
  );
}

/* ---------------- Stat pill ---------------- */
function StatPill({ icon: Icon, label, value, tone = 'indigo' }) {
  const tones = {
    indigo: 'from-indigo-500/10 to-violet-500/10 text-indigo-700',
    emerald: 'from-emerald-500/10 to-teal-500/10 text-emerald-700',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-gradient-to-br p-3 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,.6),0_6px_20px_-10px_rgba(2,6,23,.2)]">
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

/* ---------------- Confirm Dialog ---------------- */
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

/* ---------------- Page ---------------- */
export default function CustomersPage() {
  const navigate = useNavigate();

  // who am I? (for role gating)
  const [me, setMe] = useState(null);
  const role = me?.role || '';
  const isSuper = role === 'superadmin';
  const isAdmin = role === 'admin';

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

  // confirm delete
  const [confirm, setConfirm] = useState({ open: false, row: null });

  // pagination
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);

  /* ----- API ----- */
  async function verifyMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }

  async function fetchAll() {
    setLoading(true); setErr(''); setOk('');
    try {
      const r = await api.get('/customers', { params: { page: 1, limit: 1000 } }); // fetch many for local paging fallback
      const data = r?.data?.data ?? r?.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  // server-side search with debounce
  useEffect(() => {
    // when query changes, debounce the server request
    // if query is empty, fall back to fetchAll()
    const delay = 350;
    let mounted = true;
    const t = setTimeout(async () => {
      if (!mounted) return;
      const qTrim = q.trim();
      if (!qTrim) {
        // empty query -> fetch all (local)
        await fetchAll();
        setPage(1);
        return;
      }

      setLoading(true);
      setErr('');
      try {
        // call server search endpoint (server-side)
        const res = await api.get('/customers/search', { params: { query: qTrim, page: 1, limit: 1000 } });
        const data = res?.data?.data ?? res?.data ?? [];
        setRows(Array.isArray(data) ? data : []);
        setPage(1);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || 'Search failed');
      } finally {
        if (mounted) setLoading(false);
      }
    }, delay);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => { verifyMe(); fetchAll(); }, []);

  /* ----- Derived ----- */
  const sorted = useMemo(() => {
    return [...rows].sort((a,b) => (a.fullname || '').localeCompare(b.fullname || ''));
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [currentPage, page]);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return sorted.slice(start, start + PER_PAGE);
  }, [sorted, currentPage]);

  /* ----- Form fields (address + lat/lon are required) ----- */
  const CREATE_FIELDS = [
    { name: 'fullname',     type: 'text',   label: 'Full Name',      required: true },
    { name: 'phoneNumber',  type: 'text',   label: 'Phone Number',   required: true },
    { name: 'address',      type: 'text',   label: 'Address',        required: true },
    { name: 'latitude',     type: 'number', label: 'Latitude',       required: true, step: 'any' },
    { name: 'longitude',    type: 'number', label: 'Longitude',      required: true, step: 'any' },
  ];
  const EDIT_FIELDS = CREATE_FIELDS;

  const sanitize = (fields, obj) => {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (allow.has(k) && v !== '' && v != null) out[k] = v;
    }
    if (out.latitude != null) out.latitude = Number(out.latitude);
    if (out.longitude != null) out.longitude = Number(out.longitude);
    return out;
  };

  async function handleSubmit(form) {
    const canCreate = isSuper || isAdmin;
    const visibleFields = editRow?.id && isSuper ? EDIT_FIELDS : CREATE_FIELDS;
    const body = sanitize(visibleFields, form);

    if (editRow?.id) {
      if (!isSuper) { setErr('Admins cannot edit customers. Only superadmin can edit.'); return; }
      try {
        setErr(''); setOk('');
        await api.put(`/customers/${editRow.id}`, body);
        setOk('Customer updated');
        setOpen(false); setEditRow(null);
        await fetchAll();
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || 'Action failed');
      }
      return;
    }

    if (!canCreate) { setErr('You do not have permission to create customers.'); return; }
    try {
      setErr(''); setOk('');
      await api.post('/customers', body);
      setOk('Customer created');
      setOpen(false); setEditRow(null);
      setPage(1);
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  /* ----- Delete (uses custom popup) ----- */
  function askDelete(row) {
    if (!isSuper) { setErr('Only superadmin can delete customers.'); return; }
    setErr(''); setOk('');
    setConfirm({ open: true, row });
  }

  async function confirmDelete() {
    const row = confirm.row;
    setConfirm({ open: false, row: null });
    if (!row) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/customers/${row.id}`);
      setOk('Customer deleted');
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  /* ----- Stats ----- */
  const totalCustomers = sorted.length;
  const withCoords = sorted.filter(c =>
    (c.latitude != null && c.longitude != null) || (c.lat != null && c.lon != null)
  ).length;

  /* ----- Navigation to profile ----- */
  const openProfile = (id) => {
    if (!id) return;
    navigate(`/dashboard/customers/${id}`); // ✅ fixed absolute path
  };

  return (
    <div className="space-y-5 bg-gradient-to-br from-slate-50 via-indigo-50 to-emerald-50/40">
      {/* Header */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_1px_0_rgba(255,255,255,.6),0_10px_30px_-12px_rgba(2,6,23,.25)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <UserCircle2 size={18}/>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
              <p className="text-sm text-slate-500">
                {isSuper
                  ? 'Manage your customer records and addresses.'
                  : (isAdmin ? 'Create customers for your operations. Editing/deleting is restricted.' : 'Browse customer records.')}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm sm:w-auto">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> { setQ(e.target.value); setPage(1); }}
                placeholder="Search customers…"
                className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400 sm:w-56"
              />
            </div>

            {(isSuper || isAdmin) && (
              <button
                onClick={()=>{ setEditRow(null); setOpen(true); }}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16}/> New Customer
              </button>
            )}
            <button
              onClick={fetchAll}
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:w-[420px]">
          <StatPill icon={UserCircle2} label="Total Customers" value={totalCustomers} tone="indigo"/>
          <StatPill icon={MapPin}      label="With Coordinates" value={withCoords} tone="emerald"/>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_,i)=>(
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/70 p-10 text-center text-slate-500 backdrop-blur-xl">
          No customers found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paged.map(c => (
            <div
              key={c.id}
              className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_1px_0_rgba(255,255,255,.6),0_18px_40px_-18px_rgba(2,6,23,.35)] backdrop-blur-xl transition-shadow hover:shadow-xl"
            >
              <div className="pointer-events-none absolute -top-16 -right-16 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
              <div className="flex items-start gap-3">
                <Avatar name={c.fullname} />
                <div className="min-w-0">
                  <h3
                    className="truncate text-base font-semibold text-slate-900 cursor-pointer hover:underline"
                    onClick={() => openProfile(c.id)}
                    title="View profile"
                  >
                    {c.fullname || '—'}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={16} className="text-slate-400" />
                    <span className="truncate">{c.phoneNumber || '—'}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={16} className="text-slate-400" />
                    <span className="truncate">{c.address || '—'}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    ID: {c.id ?? '—'}
                    {(c.latitude ?? c.lat) != null && (c.longitude ?? c.lon) != null
                      ? ` • (${c.latitude ?? c.lat}, ${c.longitude ?? c.lon})` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => openProfile(c.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Profile
                  </button>

                  {isSuper ? (
                    <>
                      <button
                        onClick={()=>{ setEditRow(c); setOpen(true); }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil size={16} /> Edit
                      </button>
                      <button
                        onClick={()=> askDelete(c)}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </>
                  ) : isAdmin ? (
                    <div className="text-xs text-slate-400">Create-only (no edits)</div>
                  ) : (
                    <div className="text-xs text-slate-400">Read-only</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination (matching other pages) */}
      <div className="flex items-center justify-center gap-2 pt-2 pb-6">
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

      {/* Create / Edit modal */}
      {(isSuper || isAdmin) && (
        <FormModal
          title={editRow ? (isSuper ? 'Edit Customer' : 'Create Customer') : 'Create Customer'}
          open={open}
          onClose={()=>{ setOpen(false); setEditRow(null); }}
          fields={editRow && isSuper ? EDIT_FIELDS : CREATE_FIELDS}
          initial={editRow && isSuper ? editRow : {}}
          onSubmit={handleSubmit}
        />
      )}

      {/* Custom delete confirmation */}
      <ConfirmDialog
        open={confirm.open}
        title="Delete Customer?"
        message={confirm.row ? `This will permanently remove "${confirm.row.fullname}".` : ''}
        confirmLabel="Delete"
        onCancel={() => setConfirm({ open: false, row: null })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}