// src/pages/Users.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { User as UserIcon, Search, Plus, RefreshCw, Pencil, Trash2, Building2, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

/* ---------- helpers ---------- */
const prettyDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleString();
};

export default function UsersPage() {
  // who am I?
  const [me, setMe] = useState(null);
  const isAdmin = me?.role === 'admin';
  const isSuper = me?.role === 'superadmin';

  // data
  const [users, setUsers] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [myManagedInvs, setMyManagedInvs] = useState([]); // admin's inventories

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // filters
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // role “watchers” for conditional fields
  const [createRole, setCreateRole] = useState('user');
  const [editRole, setEditRole] = useState('user');

  // -------- fetch signed-in user + their managed inventories (if admin)
  async function fetchMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);

      if (u?.id && u?.role === 'admin') {
        // pull detailed user (includes managedItems → inventory)
        const d = await api.get(`/users/${u.id}`);
        const full = d?.data?.data || d?.data || {};
        const invs = (full.managedItems || [])
          .map((m) => m?.inventory)
          .filter(Boolean);
        setMyManagedInvs(invs);
      }
    } catch (e) {
      // if verify fails, leave me = null; the page will likely be protected by router anyway
      setErr(e?.response?.data?.message || e?.message || 'Error verifying session');
    }
  }

  async function fetchAll() {
    try {
      setLoading(true);
      setErr(''); setOk('');

      // inventories are needed for labels/options
      const invRes = await api.get('/inventory/');
      const invData = Array.isArray(invRes?.data?.data) ? invRes.data.data : (invRes?.data || []);
      invData.sort((a,b) => String(a.inventoryName||'').localeCompare(String(b.inventoryName||'')));
      setInventories(invData);

      if (isSuper) {
        // only superadmin can see/manage users
        const uRes = await api.get('/users/');
        const usersData = Array.isArray(uRes?.data?.data) ? uRes.data.data : (uRes?.data || []);
        usersData.sort((a,b) => String(a.fullname||'').localeCompare(String(b.fullname||'')));
        setUsers(usersData);
      } else {
        setUsers([]); // admins see no list
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching users');
    } finally {
      setLoading(false);
    }
  }

  // bootstrap: who am I, then load page data with correct guard
  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { if (me) fetchAll(); }, [me]); // refetch after we know the role

  // options
  const allInvOptions = useMemo(
    () => (inventories || []).map(i => ({ value: i.id, label: i.inventoryName || `#${i.id}` })),
    [inventories]
  );

  // for admins, limit to their managed inventories; for superadmin, show all
  const visibleInvOptions = useMemo(() => {
    if (isSuper) return allInvOptions;
    const allowed = new Set(myManagedInvs.map((i) => String(i.id)));
    return allInvOptions.filter(o => allowed.has(String(o.value)));
  }, [allInvOptions, isSuper, myManagedInvs]);

  // For EDIT: exclude inventories the user already manages (superadmin only anyway)
  const editInvOptions = useMemo(() => {
    if (!editRow) return visibleInvOptions;
    const owned = new Set(
      (editRow.managedItems || [])
        .map(m => m?.inventory?.id)
        .filter(Boolean)
        .map(String)
    );
    return visibleInvOptions.filter(o => !owned.has(String(o.value)));
  }, [visibleInvOptions, editRow]);

  // Field sets (only used for superadmin flows)
  const CREATE_FIELDS = useMemo(() => {
    const fields = [
      { name: 'fullname', type: 'text', label: 'Full name', required: true },
      { name: 'email', type: 'email', label: 'Email', required: true },
      { name: 'password', type: 'password', label: 'Password', required: true },
      {
        name: 'role', type: 'select', label: 'Role', required: true,
        options: [
          { value: 'user',       label: 'User' },
          { value: 'admin',      label: 'Admin' },
          { value: 'superadmin', label: 'Super Admin' },
        ],
        onChange: (e) => setCreateRole(e.target.value),
      },
    ];
    if (createRole === 'admin') {
      fields.push({
        name: 'inventoryId',
        type: 'select',
        label: 'Managed Inventory (Admin only)',
        required: true,
        options: visibleInvOptions, // superadmin sees all; admin would see only theirs
        helper: 'Choose the inventory this Admin will manage.',
      });
    }
    return fields;
  }, [visibleInvOptions, createRole]);

  const EDIT_FIELDS = useMemo(() => {
    const fields = [
      { name: 'fullname', type: 'text', label: 'Full name' },
      { name: 'email', type: 'email', label: 'Email' },
      { name: 'password', type: 'password', label: 'New password (optional)' },
      {
        name: 'role', type: 'select', label: 'Role',
        options: [
          { value: 'user',       label: 'User' },
          { value: 'admin',      label: 'Admin' },
          { value: 'superadmin', label: 'Super Admin' },
        ],
        onChange: (e) => setEditRole(e.target.value),
        helper: 'If role is Admin, you can assign a managed inventory below.',
      },
    ];
    if (editRole === 'admin') {
      fields.push({
        name: 'inventoryId',
        type: 'select',
        label: 'Managed Inventory (Admin only)',
        required: false,
        options: [
          { value: '', label: '— No change —' },
          ...editInvOptions,
          { value: 'null', label: 'Remove assignment' },
        ],
        helper: 'Pick a new inventory for this Admin, or “Remove assignment”.',
      });
    }
    return fields;
  }, [editRole, editInvOptions]);

  // sanitize payload to visible fields only
  function sanitize(fields, payload) {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (!allow.has(k)) return;
      if (v === '' || v === undefined) return;
      out[k] = (v === 'null') ? null : v;
    });
    return out;
  }

  // CRUD (superadmin only)
  async function createUser(body) { await api.post('/users/', body); }
  async function updateUser(id, body) { await api.put(`/users/${id}`, body); }
  async function deleteUserRow(row) {
    if (!window.confirm(`Delete user "${row.fullname}"?`)) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/users/${row.id}`);
      setOk('User deleted');
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // modal
  function openCreate() { setCreateRole('user'); setEditRow(null); setModalOpen(true); }
  function openEdit(row) { setEditRow(row); setEditRole(row?.role || 'user'); setModalOpen(true); }
  function closeModal() { setEditRow(null); setModalOpen(false); }

  async function handleSubmit(form) {
    try {
      setErr(''); setOk('');
      if (editRow?.id) {
        const body = sanitize(EDIT_FIELDS, form);
        await updateUser(editRow.id, body);
        setOk('User updated');
      } else {
        const body = sanitize(CREATE_FIELDS, form);
        await createUser(body);
        setOk('User created');
      }
      closeModal();
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  // view: filtered list (superadmin only)
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users || []).filter(u => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!term) return true;
      const invNames = (u.managedItems || [])
        .map(m => m?.inventory?.inventoryName)
        .filter(Boolean)
        .join(' ');
      const hay = `${u.fullname||''} ${u.email||''} ${invNames}`.toLowerCase();
      return hay.includes(term);
    });
  }, [users, q, roleFilter]);

  // ---------- RENDER ----------
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <UserIcon size={20}/> Users
            </h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? <>Connected to <code>/users</code>. Create, edit, delete and (for admins) assign a managed inventory.</>
                : <>Access limited. As an Admin you cannot manage users; you can view your assigned inventories below.</>}
            </p>
          </div>

          {isSuper && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
                <Search size={16} className="text-slate-400" />
                <input
                  value={q}
                  onChange={(e)=> setQ(e.target.value)}
                  placeholder="Search name / email / inventory…"
                  className="w-72 bg-transparent outline-none text-sm"
                />
              </div>

              <select
                value={roleFilter}
                onChange={e=> setRoleFilter(e.target.value)}
                className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
              >
                <option value="">All roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>

              <button
                onClick={fetchAll}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw size={16}/> Refresh
              </button>

              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16}/> New User
              </button>
            </div>
          )}
        </div>

        {(err || ok) && (
          <div className="mt-3">
            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
            {ok  && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
          </div>
        )}
      </div>

      {/* Admin view: read-only assigned inventories */}
      {isAdmin && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-4">
          <div className="flex items-center gap-2 text-slate-700 mb-3">
            <ShieldAlert size={18} /> <span className="font-medium">Your assigned inventories</span>
          </div>
          {myManagedInvs.length === 0 ? (
            <div className="text-sm text-slate-500">No inventory assignment found for your account.</div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {myManagedInvs.map(inv => (
                <li key={inv.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="font-medium text-slate-900">{inv.inventoryName}</div>
                  {inv.location && <div className="text-xs text-slate-500">{inv.location}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Superadmin table */}
      {isSuper && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur">
          <div className="grid grid-cols-[1.6fr_1.2fr_.7fr_.9fr_.7fr] items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Name & Email</span>
            <span className="flex items-center gap-2"><Building2 size={14}/> Managed Inventory</span>
            <span>Role</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <div className="p-4">
              {[...Array(6)].map((_,i)=>(
                <div key={i} className="h-12 animate-pulse rounded-xl border border-slate-200 bg-white/60 mb-2"/>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {filtered.map(u => (
                <li key={u.id} className="grid grid-cols-[1.6fr_1.2fr_.7fr_.9fr_.7fr] items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{u.fullname}</div>
                    <div className="truncate text-xs text-slate-500">{u.email}</div>
                  </div>
                  <div className="text-sm text-slate-700">
                    {(u.managedItems && u.managedItems.length > 0)
                      ? u.managedItems.map(m => m?.inventory?.inventoryName).filter(Boolean).join(', ')
                      : <span className="text-slate-400">—</span>}
                  </div>
                  <div className="text-sm text-slate-700 capitalize">{u.role}</div>
                  <div className="text-xs text-slate-500">{prettyDate(u.createdAt)}</div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={()=> openEdit(u)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={14}/> Edit
                    </button>
                    <button
                      onClick={()=> deleteUserRow(u)}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                    >
                      <Trash2 size={14}/> Delete
                    </button>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && !loading && (
                <li className="px-4 py-6 text-center text-slate-500">No users found.</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Modal (superadmin only) */}
      {isSuper && (
        <FormModal
          title={editRow ? `Edit User: ${editRow.fullname}` : 'New User'}
          open={modalOpen}
          onClose={closeModal}
          fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
          initial={
            editRow
              ? { fullname: editRow.fullname, email: editRow.email, role: editRow.role }
              : { role: createRole }
          }
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}