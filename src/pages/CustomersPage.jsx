// src/pages/CustomersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { UserCircle2, Plus, Pencil, Trash2, Search, RefreshCw, Phone, MapPin } from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

function Avatar({ name = '' }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
      <span className="text-lg font-semibold">{letter}</span>
    </div>
  );
}

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

export default function CustomersPage() {
  // who am I? (for role gating)
  const [me, setMe] = useState(null);
  const isSuper = me?.role === 'superadmin';

  // data
  const [rows, setRows] = useState([]);
  const [coords, setCoords] = useState([]); // for coordinateId dropdown

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');

  // modal
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // ---------- API calls
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
      const r = await api.get('/customers');
      const data = r?.data?.data ?? r?.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCoords() {
    try {
      const r = await api.get('/coordinates');
      const data = r?.data?.data ?? r?.data ?? [];
      setCoords(Array.isArray(data) ? data : []);
    } catch {
      // optional; ignore if not available
    }
  }

  // server-side search (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) return fetchAll();
      setLoading(true); setErr(''); setOk('');
      try {
        const r = await api.get('/customers/search', { params: { query: q.trim() } });
        const data = r?.data?.data ?? r?.data ?? [];
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => { verifyMe(); fetchAll(); fetchCoords(); }, []);

  // ---------- Derived: alpha sort by fullname
  const sorted = useMemo(() => {
    return [...rows].sort((a,b) => (a.fullname || '').localeCompare(b.fullname || ''));
  }, [rows]);

  // ---------- Fields (STRICT to backend spec)
  const COORD_OPTIONS = useMemo(() => coords.map(c => c.id).sort((a,b)=>a-b), [coords]);

  const CREATE_FIELDS = [
    { name: 'fullname',     type: 'text',    label: 'Full Name',   required: true },
    { name: 'phoneNumber',  type: 'text',    label: 'Phone Number', required: true },
    { name: 'address',      type: 'text',    label: 'Address' },
    { name: 'coordinateId', type: 'select',  label: 'Coordinate ID (optional)', options: COORD_OPTIONS },
  ];
  const EDIT_FIELDS = CREATE_FIELDS;

  // keep only allowed fields
  const sanitize = (fields, obj) => {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (allow.has(k) && v !== '' && v != null) out[k] = v;
    }
    return out;
  };

  async function handleSubmit(form) {
    if (!isSuper) {
      setErr('Only superadmin can create or edit customers.');
      return;
    }
    try {
      setErr(''); setOk('');
      if (editRow?.id) {
        const body = sanitize(EDIT_FIELDS, form);
        await api.put(`/customers/${editRow.id}`, body);
        setOk('Customer updated');
      } else {
        const body = sanitize(CREATE_FIELDS, form);
        await api.post('/customers', body);
        setOk('Customer created');
      }
      setOpen(false); setEditRow(null);
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  async function handleDelete(row) {
    if (!isSuper) {
      setErr('Only superadmin can delete customers.');
      return;
    }
    if (!window.confirm(`Delete customer "${row.fullname}"?`)) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/customers/${row.id}`);
      setOk('Customer deleted');
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // ---------- Stats
  const totalCustomers = sorted.length;
  const withCoords = sorted.filter(c => c.coordinateId != null).length;

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
              <p className="text-sm text-slate-500">Manage your customer records and addresses.</p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm sm:w-auto">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search customers…"
                className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400 sm:w-56"
              />
            </div>

            {/* Actions */}
            {isSuper ? (
              <>
                <button
                  onClick={()=>{ setEditRow(null); setOpen(true); }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
                >
                  <Plus size={16}/> New Customer
                </button>
                <button
                  onClick={fetchAll}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <RefreshCw size={16}/> Refresh
                </button>
              </>
            ) : (
              <button
                onClick={fetchAll}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <RefreshCw size={16}/> Refresh
              </button>
            )}
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
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/70 p-10 text-center text-slate-500 backdrop-blur-xl">
          No customers found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map(c => (
            <div
              key={c.id}
              className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_1px_0_rgba(255,255,255,.6),0_18px_40px_-18px_rgba(2,6,23,.35)] backdrop-blur-xl transition-shadow hover:shadow-xl"
            >
              {/* sheen */}
              <div className="pointer-events-none absolute -top-16 -right-16 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />

              <div className="flex items-start gap-3">
                <Avatar name={c.fullname} />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{c.fullname || '—'}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={16} className="text-slate-400" />
                    <span className="truncate">{c.phoneNumber || '—'}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={16} className="text-slate-400" />
                    <span className="truncate">{c.address || '—'}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    ID: {c.id ?? '—'} {c.coordinateId != null ? `• Coord: ${c.coordinateId}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">

                {/* Actions: superadmin only */}
                {isSuper ? (
                  <div className="flex gap-2">
                    <button
                      onClick={()=>{ setEditRow(c); setOpen(true); }}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <button
                      onClick={()=> handleDelete(c)}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Read-only</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit (superadmin only) */}
      {isSuper && (
        <FormModal
          title={editRow ? 'Edit Customer' : 'Create Customer'}
          open={open}
          onClose={()=>{ setOpen(false); setEditRow(null); }}
          fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
          initial={editRow || {}}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}