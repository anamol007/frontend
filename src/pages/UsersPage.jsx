// src/pages/UsersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Pencil, Trash2, RefreshCw,
  Users as UsersIcon, Shield, Truck
} from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

/* ---------- tiny helpers ---------- */
function cn(...a){return a.filter(Boolean).join(' ')}

function Avatar({ name = '', email = '' }) {
  const letter = (name || email || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
      <span className="text-lg font-semibold">{letter}</span>
    </div>
  );
}

function RoleBadge({ role }) {
  const styles = {
    admin: 'bg-amber-100 text-amber-700 border-amber-200',
    superadmin: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    driver: 'bg-sky-100 text-sky-700 border-sky-200',
  };
  const cls = styles[role] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium',
      cls
    )}>
      {role || '—'}
    </span>
  );
}

function BackgroundFX() {
  // soft gradient blobs behind everything
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-violet-400/25 blur-[90px]" />
      <div className="absolute top-20 right-10 h-72 w-72 rounded-full bg-cyan-300/25 blur-[90px]" />
      <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-indigo-400/20 blur-[90px]" />
      <div className="absolute inset-0 bg-[radial-gradient(90rem_60rem_at_50%_-10%,rgba(99,102,241,0.06),rgba(255,255,255,0))]" />
    </div>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 p-4 shadow-sm backdrop-blur transition-shadow hover:shadow-lg">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-transform group-hover:scale-125" />
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-xs text-slate-500">{title}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function RoleChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-slate-900 text-white shadow'
          : 'bg-white/80 text-slate-700 border border-slate-200 hover:bg-white'
      )}
    >
      {label}
    </button>
  );
}

/* ---------- page ---------- */
export default function UsersPage() {
  // defaults: 'user' removed, 'driver' included
  const DEFAULT_ROLES = ['admin', 'driver', 'superadmin'];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [roles, setRoles] = useState(DEFAULT_ROLES);

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // merge roles from DB (if any) with defaults
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/users'); // admin-only
        const list = (r?.data?.data ?? r?.data ?? []);
        const dbRoles = Array.from(new Set(list.map(u => u?.role).filter(Boolean)));
        if (dbRoles.length) setRoles(Array.from(new Set([...DEFAULT_ROLES, ...dbRoles])));
      } catch { /* keep defaults */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchUsers() {
    setLoading(true); setErr(''); setOk('');
    try {
      const res = roleFilter ? await api.get(`/users/role/${roleFilter}`) : await api.get('/users');
      const data = res?.data?.data ?? res?.data ?? [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  // sort roles A→Z for chips & dropdown
  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [roles]
  );

  // filter & sort users A→Z by fullname (fallback email)
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = q
      ? users.filter(u =>
          (u.fullname || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
        )
      : users;

    return [...base].sort((a, b) => {
      const A = (a.fullname || a.email || '').toLowerCase();
      const B = (b.fullname || b.email || '').toLowerCase();
      return A.localeCompare(B);
    });
  }, [users, searchTerm]);

  // stats from current list (not extra API)
  const stats = useMemo(() => {
    const total = filtered.length;
    const admin = filtered.filter(u => u.role === 'admin').length;
    const superadmin = filtered.filter(u => u.role === 'superadmin').length;
    const driver = filtered.filter(u => u.role === 'driver').length;
    return { total, admin, superadmin, driver };
  }, [filtered]);

  // CRUD field configs (only allowed fields)
  const CREATE_FIELDS = useMemo(() => ([
    { name: 'fullname', type: 'text',     label: 'Full Name', required: true },
    { name: 'email',    type: 'email',    label: 'Email',     required: true },
    { name: 'password', type: 'password', label: 'Password',  required: true },
    { name: 'role',     type: 'select',   label: 'Role',      required: true, options: sortedRoles },
  ]), [sortedRoles]);

  const EDIT_FIELDS = useMemo(() => ([
    { name: 'fullname', type: 'text',   label: 'Full Name', required: true },
    { name: 'email',    type: 'email',  label: 'Email',     required: true },
    { name: 'role',     type: 'select', label: 'Role',      required: true, options: sortedRoles },
    { name: '_newPassword', type: 'password', label: 'New Password (optional)' },
  ]), [sortedRoles]);

  // trim & whitelist
  function sanitize(fields, payload) {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.keys(payload || {}).forEach(k => {
      if (!allow.has(k)) return;
      const raw = payload[k];
      const v = typeof raw === 'string' ? raw.trim() : raw;
      if (v === '' || v === undefined || v === null) return;
      out[k] = v;
    });
    return out;
  }

  async function handleSubmit(form) {
    try {
      setErr(''); setOk('');
      if (editRow?.id) {
        const payload = sanitize(EDIT_FIELDS, form);
        const { _newPassword, ...updateBody } = payload;
        await api.put(`/users/${editRow.id}`, updateBody);

        const np = (form?._newPassword || '').trim();
        if (np) await api.put(`/users/${editRow.id}/change-password`, { newPassword: np });

        setOk(np ? 'User updated & password changed' : 'User updated');
      } else {
        const payload = sanitize(CREATE_FIELDS, form);
        await api.post('/users', payload);
        setOk('User created');
      }
      setOpen(false); setEditRow(null);
      await fetchUsers();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete user "${u.fullname || u.email}"?`)) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/users/${u.id}`);
      setOk('User deleted');
      await fetchUsers();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  return (
    <div className="relative">
      <BackgroundFX />

      {/* header */}
      <div className="mb-5 rounded-3xl border border-slate-200/70 bg-white/60 p-6 backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-extrabold text-transparent">
              Team & Roles
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage members, update roles, and keep your workspace tidy.
            </p>
          </div>

          {/* search + actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
              <Search size={18} className="text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e)=> setSearchTerm(e.target.value)}
                placeholder="Search name or email…"
                type="search"
                className="input-unstyled w-64 text-sm"
              />
            </div>

            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5 text-sm text-slate-700 shadow-sm backdrop-blur hover:bg-white"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            <button
              onClick={()=>{ setEditRow(null); setOpen(true); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16} /> New User
            </button>
          </div>
        </div>

        {/* quick role chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <RoleChip
            label="All"
            active={!roleFilter}
            onClick={()=> setRoleFilter('')}
          />
          {sortedRoles.map(r => (
            <RoleChip
              key={r}
              label={r}
              active={roleFilter === r}
              onClick={()=> setRoleFilter(r)}
            />
          ))}
        </div>

        {/* messages */}
        {err && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total" value={stats.total} icon={UsersIcon} />
        <StatCard title="Admins" value={stats.admin} icon={Shield} />
        <StatCard title="Superadmins" value={stats.superadmin} icon={Shield} />
        <StatCard title="Drivers" value={stats.driver} icon={Truck} />
      </div>

      {/* list */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200/70 bg-white/60 backdrop-blur" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-10 text-center text-slate-600 backdrop-blur">
          No users found. Try a different search or role.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(u => (
            <div
              key={u.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 p-4 shadow-sm backdrop-blur transition hover:shadow-lg"
            >
              {/* sheen */}
              <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
              <div className="flex items-start gap-3">
                <Avatar name={u.fullname} email={u.email} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-slate-900">{u.fullname || '—'}</h3>
                    <RoleBadge role={u.role} />
                  </div>
                  <p className="truncate text-sm text-slate-600">{u.email || '—'}</p>
                  <p className="mt-1 text-xs text-slate-400">ID: {u.id ?? '—'}</p>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={()=>{ setEditRow(u); setOpen(true); }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-white"
                >
                  <Pencil size={16} /> Edit
                </button>
                <button
                  onClick={()=> handleDelete(u)}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-rose-700"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <FormModal
        title={editRow ? 'Edit User' : 'Create User'}
        open={open}
        onClose={()=>{ setOpen(false); setEditRow(null); }}
        fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
        initial={editRow || {}}
        onSubmit={handleSubmit}
      />
    </div>
  );
}