// src/pages/DriversPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Plus, Pencil, Trash2, X, BarChart3, Phone, ShieldAlert, Mail, User as UserIcon, Lock } from 'lucide-react';
import { api } from '../utils/api';

// ---------- small helpers ----------
const safeArr = (x) => (Array.isArray(x) ? x : []);
const getList = (r) => (r && r.data && (r.data.data ?? r.data)) || [];
const byText = (a, b) => String(a || '').localeCompare(String(b || ''));
const firstLetter = (name = '', email = '') => (String(name || email || '?').trim().charAt(0) || '?').toUpperCase();

// ---------- Avatar ----------
function Avatar({ name = '', email = '' }) {
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
      <span className="text-lg font-semibold">{firstLetter(name, email)}</span>
    </div>
  );
}

// ---------- Confirm Dialog (custom) ----------
function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onCancel}/>
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
          <button onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
            <Trash2 size={16}/> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Create/Edit Driver (User-like) modal ----------
function DriverUserModal({ open, initial = {}, onClose, onSubmit }) {
  // initial may contain: { id(driverId)?, user_id, fullname, email, phoneNumber }
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    fullname: '',
    email: '',
    password: '',
    phoneNumber: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      fullname: initial.fullname ?? '',
      email: initial.email ?? '',
      password: '',
      phoneNumber: initial.phoneNumber ?? '',
    });
  }, [open, initial]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit({ ...form }, isEdit);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/30 bg-white/85 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4 text-white">
          <div className="font-semibold">{isEdit ? 'Edit Driver (User & Phone)' : 'New Driver (Create User)'}</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Full name *</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                <UserIcon size={16} className="text-slate-400" />
                <input
                  required
                  value={form.fullname}
                  onChange={(e)=> setForm(p=>({ ...p, fullname: e.target.value }))}
                  className="w-full bg-transparent outline-none"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Email *</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                <Mail size={16} className="text-slate-400" />
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e)=> setForm(p=>({ ...p, email: e.target.value }))}
                  className="w-full bg-transparent outline-none"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {!isEdit && (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Password *</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                  <Lock size={16} className="text-slate-400" />
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(e)=> setForm(p=>({ ...p, password: e.target.value }))}
                    className="w-full bg-transparent outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Phone Number *</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                <Phone size={16} className="text-slate-400" />
                <input
                  required
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e)=> setForm(p=>({ ...p, phoneNumber: e.target.value }))}
                  className="w-full bg-transparent outline-none"
                  placeholder="+977 98XXXXXXXX"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {busy ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Driver')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Delivery Stats modal ----------
function StatsModal({ open, rows, onRefresh, busy, onClose }) {
  if (!open) return null;

  const list = safeArr(rows).slice().sort((a, b) => {
    const an = a?.user?.fullname || a?.User?.fullname || a?.driverName || '';
    const bn = b?.user?.fullname || b?.User?.fullname || b?.driverName || '';
    return byText(an, bn);
  });

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/30 bg-white/85 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2 font-semibold"><BarChart3 size={18}/> Driver Delivery Count</div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="p-5">
          {list.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm text-slate-500">
              No data available.
            </div>
          ) : (
            <div className="max-h-[48vh] space-y-2 overflow-auto pr-1">
              {list.map((d) => {
                const name = d?.user?.fullname || d?.User?.fullname || d?.driverName || `Driver #${d?.id ?? ''}`;
                const email = d?.user?.email || d?.User?.email || '';
                const count = d?.deliveryCount ?? d?.count ?? 0;
                return (
                  <div key={d?.id ?? `${name}-${email}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={name} email={email} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">{name}</div>
                        {!!email && <div className="truncate text-xs text-slate-400">{email}</div>}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white tabular-nums">{count}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              onClick={onRefresh}
              disabled={busy}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function DriversPage() {
  // auth / role
  const [me, setMe] = useState(null);
  const role = me?.role || '';
  const isSuper = role === 'superadmin';
  const canManage = isSuper || role === 'admin'; // create/edit for Admin & Super Admin

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null); // {id(driverId), user_id, fullname, email, phoneNumber}

  const [statsOpen, setStatsOpen] = useState(false);
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsRows, setStatsRows] = useState([]);

  // delete confirm
  const [confirm, setConfirm] = useState({ open: false, row: null });

  // pagination
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);

  // who am I?
  async function fetchMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }

  // load drivers
  async function load() {
    setErr(''); setOk('');
    setLoading(true);
    try {
      const dr = await api.get('/drivers/');
      const d = safeArr(getList(dr));
      d.sort((a, b) => {
        const an = a?.user?.fullname || a?.User?.fullname || a?.driverName || '';
        const bn = b?.user?.fullname || b?.User?.fullname || b?.driverName || '';
        return byText(an, bn);
      });
      setRows(d);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { load(); }, [me]);

  // open create
  const openCreate = () => {
    if (!canManage) { setErr('Only Admin / Super Admin can create drivers'); return; }
    setEditRow(null);
    setModalOpen(true);
  };

  // open edit (collect user+driver fields)
  const openEdit = (row) => {
    if (!canManage) { setErr('Only Admin / Super Admin can edit drivers'); return; }
    const user_id = row?.user_id ?? row?.userId ?? row?.user?.id ?? row?.User?.id ?? null;
    const fullname = row?.user?.fullname || row?.User?.fullname || '';
    const email = row?.user?.email || row?.User?.email || '';
    const phoneNumber = row?.phoneNumber ?? row?.phone ?? '';
    setEditRow({ id: row?.id, user_id, fullname, email, phoneNumber });
    setModalOpen(true);
  };

  // create/edit submit
  async function handleSubmit(form, isEdit) {
    if (!canManage) { setErr('Only Admin / Super Admin can perform this action'); return; }
    try {
      setErr(''); setOk('');

      if (isEdit && editRow?.id && editRow?.user_id) {
        // Update USER
        const userBody = {
          fullname: form.fullname,
          email: form.email,
          ...(form.password ? { password: form.password } : {}),
          role: 'driver', // keep role as driver
        };
        await api.put(`/users/${editRow.user_id}`, userBody);

        // Update DRIVER
        await api.put(`/drivers/${editRow.id}`, { user_id: editRow.user_id, phoneNumber: form.phoneNumber });

        setOk('Driver updated');
      } else {
        // Create USER (role: driver)
        const userRes = await api.post('/users/', {
          fullname: form.fullname,
          email: form.email,
          password: form.password,
          role: 'driver',
        });
        const newUserId = userRes?.data?.data?.id;

        // Create DRIVER profile with phone
        await api.post('/drivers/', { user_id: newUserId, phoneNumber: form.phoneNumber });

        setOk('Driver created');
      }

      setModalOpen(false);
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || (isEdit ? 'Save failed' : 'Create failed'));
    }
  }

  // delete (superadmin only)
  function askDelete(row) {
    if (!isSuper) { setErr('Only Super Admin can delete drivers'); return; }
    setConfirm({ open: true, row });
  }
  async function confirmDelete() {
    const row = confirm.row;
    setConfirm({ open: false, row: null });
    if (!row) return;
    setErr(''); setOk('');
    try {
      await api.delete(`/drivers/${row.id}`);
      setOk('Driver deleted');
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // stats (allowed for all roles)
  async function fetchStats() {
    setStatsBusy(true);
    try {
      const r = await api.get('/drivers/stats/delivery-count');
      setStatsRows(safeArr(getList(r)));
    } finally {
      setStatsBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const name = (r?.user?.fullname || r?.User?.fullname || r?.driverName || '').toLowerCase();
      const email = (r?.user?.email || r?.User?.email || '').toLowerCase();
      const phone = (r?.phoneNumber || r?.phone || '').toLowerCase();
      return name.includes(s) || email.includes(s) || phone.includes(s);
    });
  }, [rows, q]);

  // pagination derived
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [currentPage, page]);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, currentPage]);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Drivers</h1>
            <p className="text-sm text-slate-500">
              {canManage
                ? 'Create a new user (role: driver) with phone, or edit existing driver details. Delete is Super Admin only.'
                : 'Browse delivery drivers and view delivery stats.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> { setQ(e.target.value); setPage(1); }}
                placeholder="Search name, email, phone…"
                className="w-64 bg-transparent outline-none text-sm"
              />
            </div>

            <button
              onClick={() => { setStatsRows([]); setStatsOpen(true); fetchStats(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800 hover:bg-indigo-100"
            >
              <BarChart3 size={16}/> Delivery stats
            </button>

            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            {canManage && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16} /> New Driver
              </button>
            )}
          </div>
        </div>

        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No drivers found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((d) => {
            const name = d?.user?.fullname || d?.User?.fullname || d?.driverName || `Driver #${d?.id ?? ''}`;
            const email = d?.user?.email || d?.User?.email || '';
            const phone = d?.phoneNumber ?? d?.phone ?? '';
            return (
              <div
                key={d?.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl"
              >
                <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
                <div className="flex items-start gap-3">
                  <Avatar name={name} email={email} />
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-slate-900">{name}</div>
                    {!!email && <div className="truncate text-sm text-slate-600">{email}</div>}
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Phone size={14} className="text-slate-400" /> {phone || '—'}
                    </div>
                    <div className="text-xs text-slate-400">ID: {d?.id ?? '—'}</div>
                  </div>
                </div>

                {(canManage || isSuper) && (
                  <div className="mt-4 flex justify-end gap-2">
                    {canManage && (
                      <button
                        onClick={() => openEdit(d)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil size={16} /> Edit
                      </button>
                    )}
                    {isSuper && (
                      <button
                        onClick={() => askDelete(d)}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination (same style as other pages) */}
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

      {/* modals */}
      <DriverUserModal
        open={modalOpen}
        initial={editRow || {}}
        onClose={() => { setModalOpen(false); setEditRow(null); }}
        onSubmit={handleSubmit}
      />

      <StatsModal
        open={statsOpen}
        rows={statsRows}
        busy={statsBusy}
        onRefresh={fetchStats}
        onClose={() => setStatsOpen(false)}
      />

      <ConfirmDialog
        open={confirm.open}
        title="Delete Driver?"
        message={confirm.row ? `This will permanently remove driver #${confirm.row.id}.` : ''}
        onCancel={() => setConfirm({ open: false, row: null })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}