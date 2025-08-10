// src/pages/UsersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Users as UsersIcon, User, Shield, Truck, Mail, Key,
  Plus, Edit, Trash2, X, Search, RefreshCw
} from 'lucide-react';
import { API_URL, authHeaders as h, Field } from '../utils/api';

/* ---------------- helpers ---------------- */
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapUser(raw) {
  const u = raw || {};
  const id = u.id ?? u.userId ?? u.user_id;
  const fullname = u.fullname ?? u.name ?? u.full_name ?? '';
  const email = u.email ?? u.username ?? '';
  const role =
    u.role ?? u.userRole ?? u.roleName ??
    u.role_id ?? u.roleId ?? u.role_type ?? 'user';
  return { id, fullname, email, role, _raw: u };
}

function payloadFromForm(f, { includePassword = false } = {}) {
  const body = {
    fullname: f.fullname || undefined,
    email: f.email || undefined,
    role: f.role || undefined,
  };
  if (includePassword && f.password) body.password = f.password;
  return body;
}

function letterAvatar(text) {
  const src = (text || 'U').trim();
  return (src.charAt(0) || 'U').toUpperCase();
}

function roleLabel(r) {
  const s = String(r || '').toLowerCase();
  if (s === 'superadmin') return 'Super Admin';
  if (s === 'admin') return 'Admin';
  if (s === 'driver') return 'Driver';
  return s ? s[0].toUpperCase() + s.slice(1) : 'User';
}

function chipTone(roleName) {
  const s = String(roleName || '').toLowerCase();
  if (s === 'superadmin') return 'bg-indigo-100 text-indigo-700';
  if (s === 'admin')      return 'bg-emerald-100 text-emerald-700';
  if (s === 'driver')     return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

/* ---------------- page ---------------- */
export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState(['superadmin','admin','driver','user']); // fallback
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('');

  // filters
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({ fullname:'', email:'', role:'user', password:'' });

  useEffect(() => { fetchRoles(); }, []);
  useEffect(() => { fetchRows(); }, [roleFilter]);

  async function fetchRoles() {
    // Optional endpoint; if missing, we keep defaults
    try {
      const r = await axios.get(`${API_URL}/roles`, { headers: h() });
      const list = r.data?.data ?? r.data?.roles ?? r.data ?? [];
      const names = Array.isArray(list)
        ? list.map(x => x?.name ?? x?.role ?? x).filter(Boolean)
        : [];
      if (names.length) setRoles(names);
    } catch {/* ignore */}
  }

  async function fetchRows() {
    try {
      setLoading(true); setApiError(''); setNotice('');
      let path = '/users';
      if (roleFilter) path = `/users/role/${encodeURIComponent(roleFilter)}`;
      const res = await axios.get(`${API_URL}${path}`, { headers: h() });
      const data = res.data?.data ?? res.data?.users ?? res.data ?? [];
      setRows(Array.isArray(data) ? data.map(mapUser) : []);
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to load users');
      setRows([]);
    } finally { setLoading(false); }
  }

  function openCreate() {
    setForm({ fullname:'', email:'', role: roleFilter || 'user', password:'' });
    setShowCreate(true);
  }
  function openEdit(u) {
    setEditingId(u.id);
    setForm({ fullname: u.fullname || '', email: u.email || '', role: u.role || 'user', password:'' });
    setShowEdit(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!emailRx.test(form.email.trim())) {
      setApiError('Please enter a valid email.'); return;
    }
    try {
      setSaving(true); setApiError(''); setNotice('');
      await axios.post(`${API_URL}/users`, payloadFromForm(form, { includePassword:true }), { headers: h() });
      setShowCreate(false);
      setNotice('User created successfully.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!emailRx.test(form.email.trim())) {
      setApiError('Please enter a valid email.'); return;
    }
    try {
      setSaving(true); setApiError(''); setNotice('');
      await axios.put(`${API_URL}/users/${editingId}`, payloadFromForm(form, { includePassword: !!form.password }), { headers: h() });
      setShowEdit(false); setEditingId(null);
      setNotice('User updated successfully.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to update user');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this user? This action cannot be undone.')) return;
    try {
      setDeletingId(id); setApiError(''); setNotice('');
      await axios.delete(`${API_URL}/users/${id}`, { headers: h() });
      setNotice('User deleted.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to delete user');
    } finally { setDeletingId(null); }
  }

  // search + stats
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u => {
      const bag = [u.fullname, u.email, u.role].join(' ').toLowerCase();
      return bag.includes(term);
    });
  }, [q, rows]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const admins = filtered.filter(u => ['admin','superadmin'].includes(String(u.role).toLowerCase())).length;
    const drivers = filtered.filter(u => String(u.role).toLowerCase() === 'driver').length;
    const others = total - admins - drivers;
    return { total, admins, drivers, others };
  }, [filtered]);

  return (
    <div className="animate-fade-in">
      {/* Fancy header */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-400/30 to-cyan-400/30 blur-2xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-600">
              Users
            </h1>
            <p className="text-slate-500 text-sm">Management for your team.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRows} className="pill bg-slate-900/90 text-white hover:bg-slate-900">
              <RefreshCw size={14}/> Refresh
            </button>
            <button onClick={openCreate} className="pill bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-700 hover:to-cyan-700 shadow-sm">
              <Plus size={16}/> New User
            </button>
          </div>
        </div>

        {/* quick stats */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={UsersIcon} label="Total" value={stats.total} hue="from-emerald-500 to-cyan-500" />
          <StatCard icon={Shield} label="Admins" value={stats.admins} hue="from-indigo-500 to-sky-500" />
          <StatCard icon={Truck} label="Drivers" value={stats.drivers} hue="from-amber-500 to-orange-500" />
          <StatCard icon={User} label="Others" value={stats.others} hue="from-fuchsia-500 to-pink-500" />
        </div>
      </div>

      {/* Alerts */}
      {apiError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{apiError}</div>}
      {notice &&  <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{notice}</div>}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search users…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-9 py-2 text-sm backdrop-blur focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm backdrop-blur focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            value={roleFilter}
            onChange={(e)=>setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            {roles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-tr from-emerald-400/15 to-cyan-400/15 blur-3xl" />
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <div className="h-5 w-5 mr-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-600">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-white/60">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-semibold">
                          {letterAvatar(u.fullname || u.email)}
                        </div>
                        <div className="leading-tight">
                          <div className="font-medium text-slate-900">{u.fullname || '—'}</div>
                          <div className="text-xs text-slate-500">{u.id ? `#${u.id}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{u.email || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[12px] ${chipTone(u.role)}`}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={()=>openEdit(u)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1.5"
                        >
                          <Edit size={14}/> Edit
                        </button>
                        <button
                          onClick={()=>handleDelete(u.id)}
                          disabled={deletingId === u.id}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <Trash2 size={14}/> {deletingId === u.id ? 'Deleting…' : 'Delete'}
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
        <UserModal
          title="Create User"
          roles={roles}
          form={form}
          setForm={setForm}
          onCancel={()=>setShowCreate(false)}
          onSubmit={handleCreate}
          saving={saving}
          includePassword
        />
      )}
      {showEdit && (
        <UserModal
          title="Edit User"
          roles={roles}
          form={form}
          setForm={setForm}
          onCancel={()=>{ setShowEdit(false); setEditingId(null); }}
          onSubmit={handleEdit}
          saving={saving}
          includePasswordOptional
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

function UserModal({ title, roles, form, setForm, onCancel, onSubmit, saving, includePassword, includePasswordOptional }) {
  const needPwd = !!includePassword;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-400/20 to-cyan-400/20 blur-2xl" />
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-1 hover:opacity-70" onClick={onCancel}><X size={18}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Full name" required>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.fullname}
                onChange={(e)=>setForm({...form, fullname:e.target.value})}
                required
              />
            </Field>
            <Field label="Email" required>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={form.email}
                  onChange={(e)=>setForm({...form, email:e.target.value})}
                  required
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Role" required>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={form.role}
                onChange={(e)=>setForm({...form, role:e.target.value})}
                required
              >
                {roles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>

            {(needPwd || includePasswordOptional) && (
              <Field label={needPwd ? 'Password' : 'New password'}>
                <div className="relative">
                  <Key size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    value={form.password}
                    onChange={(e)=>setForm({...form, password:e.target.value})}
                    placeholder={needPwd ? 'Set a password' : 'Leave blank to keep current'}
                    required={needPwd}
                  />
                </div>
              </Field>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200"
              onClick={onCancel}
            >Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-700 hover:to-cyan-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}