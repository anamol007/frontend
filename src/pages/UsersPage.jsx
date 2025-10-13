// src/pages/UsersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  User as UserIcon, Search, Plus, RefreshCw, Pencil, Trash2, Building2, ShieldAlert,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, X as XIcon, Phone
} from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

/* ---------- helpers ---------- */
const prettyDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleString();
};
const PAGE_SIZE = 5;

/* ---------- simple modal shells ---------- */
function Curtain({ onClose }) {
  return <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />;
}
function Shell({ children, className = '' }) {
  return (
    <div className={`absolute left-1/2 top-1/2 w-[92vw] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/30 bg-white/90 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

/* ---------- Custom Confirm/Delete Modal ---------- */
function ConfirmDeleteModal({ open, user, status, message, onCancel, onConfirm }) {
  // status: 'confirm' | 'success' | 'error'
  if (!open) return null;

  const isConfirm = status === 'confirm';
  const isSuccess = status === 'success';
  const isError   = status === 'error';

  return (
    <div className="fixed inset-0 z-[80]">
      <Curtain onClose={onCancel} />
      <Shell>
        {/* header */}
        <div className={`flex items-center justify-between rounded-t-3xl px-5 py-4 text-white ${isConfirm ? 'bg-slate-900' : isSuccess ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <div className="font-semibold">
            {isConfirm ? 'Confirm deletion' : isSuccess ? 'Deleted' : 'Delete failed'}
          </div>
          <button onClick={onCancel} className="rounded-lg p-2 hover:bg-white/10"><XIcon size={18} /></button>
        </div>

        {/* body */}
        <div className="p-6">
          {isConfirm && (
            <>
              <div className="text-slate-800">
                You are about to delete user <span className="font-semibold">{user?.fullname}</span>.
              </div>
              <div className="mt-1 text-sm text-slate-500">
                This action cannot be undone.
              </div>
            </>
          )}

          {isSuccess && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-emerald-600 shrink-0" size={22} />
              <div>
                <div className="font-medium text-slate-900">User deleted</div>
                <div className="text-sm text-slate-600">{message || 'The user was removed successfully.'}</div>
              </div>
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-3">
              <XCircle className="text-rose-600 shrink-0" size={22} />
              <div>
                <div className="font-medium text-slate-900">Failed to delete</div>
                <div className="text-sm text-slate-600">{message || 'Something went wrong.'}</div>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex justify-end gap-2 rounded-b-3xl border-t border-white/60 bg-white/70 px-5 py-3">
          {isConfirm ? (
            <>
              <button onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
              <button onClick={onConfirm} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete</button>
            </>
          ) : (
            <button onClick={onCancel} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Close</button>
          )}
        </div>
      </Shell>
    </div>
  );
}

/* ---------- Pagination Control ---------- */
function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < pages;

  // show a compact window e.g., 1 … 3 4 [5] 6 7 … 12
  const windowSize = 1;
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - windowSize && i <= page + windowSize)) {
      nums.push(i);
    } else if (nums[nums.length - 1] !== '…') {
      nums.push('…');
    }
  }

  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        onClick={() => onPage(page - 1)}
        disabled={!canPrev}
        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm disabled:opacity-40"
      >
        <ChevronLeft size={16} /> Prev
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="px-1.5 text-slate-400">…</span>
        ) : (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={`h-8 w-8 rounded-lg text-sm font-medium ${n === page ? 'bg-slate-900 text-white' : 'border'}`}
          >
            {n}
          </button>
        )
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={!canNext}
        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm disabled:opacity-40"
      >
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default function UsersPage() {
  /* ---------- role / me ---------- */
  const [me, setMe] = useState(null);
  const isAdmin = me?.role === 'admin';
  const isSuper = me?.role === 'superadmin';

  /* ---------- data ---------- */
  const [users, setUsers] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [myManagedInvs, setMyManagedInvs] = useState([]); // admin’s inventories

  /* ---------- ui ---------- */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  /* ---------- filters & paging ---------- */
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  /* ---------- modals ---------- */
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [createRole, setCreateRole] = useState('driver'); // used only for create
  const [editRole, setEditRole] = useState('driver');     // used only for edit

  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(null); // stores create step1 payload

  // custom confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmStatus, setConfirmStatus] = useState('confirm'); // confirm | success | error
  const [confirmMsg, setConfirmMsg] = useState('');

  /* ---------- bootstrap ---------- */
  async function fetchMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);

      if (u?.id && u?.role === 'admin') {
        const d = await api.get(`/users/${u.id}`);
        const full = d?.data?.data || d?.data || {};
        const invs = (full.managedItems || []).map((m) => m?.inventory).filter(Boolean);
        setMyManagedInvs(invs);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error verifying session');
    }
  }

  async function fetchAll() {
    try {
      setLoading(true);
      setErr(''); setOk('');

      // inventories (labels & options)
      const invRes = await api.get('/inventory/');
      const invData = Array.isArray(invRes?.data?.data) ? invRes.data.data : (invRes?.data || []);
      invData.sort((a, b) => String(a.inventoryName || '').localeCompare(String(b.inventoryName || '')));
      setInventories(invData);

      if (isSuper) {
        // only superadmin can see/manage users
        const uRes = await api.get('/users/');
        const usersData = Array.isArray(uRes?.data?.data) ? uRes.data.data : (uRes?.data || []);
        usersData.sort((a, b) => String(a.fullname || '').localeCompare(String(b.fullname || '')));
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { if (me) fetchAll(); }, [me]);

  /* ---------- options ---------- */
  const allInvOptions = useMemo(
    () => (inventories || []).map(i => ({ value: i.id, label: i.inventoryName || `#${i.id}` })),
    [inventories]
  );

  const visibleInvOptions = useMemo(() => {
    if (isSuper) return allInvOptions;
    const allowed = new Set(myManagedInvs.map((i) => String(i.id)));
    return allInvOptions.filter(o => allowed.has(String(o.value)));
  }, [allInvOptions, isSuper, myManagedInvs]);

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

  /* ---------- FIELD DEFINITIONS ---------- */
  const CREATE_FIELDS = useMemo(() => ([
    { name: 'fullname', type: 'text', label: 'Full name', required: true },
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'password', type: 'password', label: 'Password', required: true },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { value: 'driver',     label: 'Driver' },
        { value: 'admin',      label: 'Admin' },
        { value: 'superadmin', label: 'Super Admin' },
      ],
      onChange: (e) => setCreateRole(e.target.value),
    },
    // phone number ONLY when creating a driver
    ...(createRole === 'driver'
      ? [{ name: 'phoneNumber', type: 'tel', label: 'Phone Number (Driver)', required: true, icon: Phone }]
      : []),
  ]), [createRole]);

  const EDIT_FIELDS = useMemo(() => {
    const base = [
      { name: 'fullname', type: 'text', label: 'Full name' },
      { name: 'email', type: 'email', label: 'Email' },
      { name: 'password', type: 'password', label: 'New password (optional)' },
      {
        name: 'role', type: 'select', label: 'Role',
        options: [
          { value: 'driver',     label: 'Driver' },
          { value: 'admin',      label: 'Admin' },
          { value: 'superadmin', label: 'Super Admin' },
        ],
        onChange: (e) => setEditRole(e.target.value),
        helper: 'If role is Admin, you can assign a managed inventory below.',
      },
    ];
    if (editRole === 'admin') {
      base.push({
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
    return base;
  }, [editRole, editInvOptions]);

  const INVENTORY_FIELDS = useMemo(() => ([
    {
      name: 'inventoryId',
      type: 'select',
      label: 'Select Inventory to manage',
      required: true,
      options: visibleInvOptions,
      helper: 'This Admin will be assigned to manage this inventory.',
    },
  ]), [visibleInvOptions]);

  /* ---------- utilities ---------- */
  function sanitize(fields, payload) {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (!allow.has(k)) return;
      if (v === '' || v === undefined) return;
      if (k === 'inventoryId') {
        if (v === 'null') out[k] = null;
        else {
          const num = typeof v === 'number' ? v : Number(v);
          out[k] = Number.isNaN(num) ? v : num;
        }
        return;
      }
      out[k] = v === 'null' ? null : v;
    });
    return out;
  }

  /* ---------- CRUD ---------- */
  async function createUser(body) { return api.post('/users/', body); }
  async function updateUser(id, body) { return api.put(`/users/${id}`, body); }

  // DELETE via custom popup
  async function performDeleteUser(user) {
    try {
      setConfirmStatus('confirm'); setConfirmMsg('');
      // call API
      await api.delete(`/users/${user.id}`);
      setConfirmStatus('success');
      setConfirmMsg('The user has been removed.');
      await fetchAll();
    } catch (e) {
      setConfirmStatus('error');
      setConfirmMsg(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // open confirm for user
  function askDeleteUser(u) {
    setConfirmTarget(u);
    setConfirmStatus('confirm');
    setConfirmMsg('');
    setConfirmOpen(true);
  }

  // Form submit
  async function handleSubmit(form) {
    try {
      setErr(''); setOk('');

      if (editRow?.id) {
        const body = sanitize(EDIT_FIELDS, form);
        await updateUser(editRow.id, body);
        setOk('User updated');
        setEditRow(null);
        setModalOpen(false);
        await fetchAll();
        return;
      }

      // CREATE flow (step 1)
      const body = sanitize(CREATE_FIELDS, form);
      if (String(body.role) === 'admin') {
        setPendingCreate(body);
        setModalOpen(false);
        setInventoryModalOpen(true);
        return;
      }

      // DRIVER or SUPERADMIN create immediately
      // If DRIVER, we also create a Driver row with phoneNumber after User is created
      const phoneNumber = body.phoneNumber;
      const payload = { fullname: body.fullname, email: body.email, password: body.password, role: body.role || 'driver' };
      const r = await createUser(payload);
      const createdId = r?.data?.data?.id;

      if (body.role === 'driver' && createdId && phoneNumber) {
        try {
          await api.post('/drivers/', { user_id: createdId, phoneNumber });
        } catch (e) {
          // not fatal for user creation; show inline note
          setErr(e?.response?.data?.message || e?.message || 'Driver profile creation failed, but user was created.');
        }
      }

      setOk('User created');
      setModalOpen(false);
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  // Step 2: assign inventory for Admin
  async function handleAssignInventory(form) {
    try {
      if (!pendingCreate) { setInventoryModalOpen(false); return; }
      const invForm = sanitize(INVENTORY_FIELDS, form);
      const inv = invForm.inventoryId;
      if (inv === undefined || inv === null || Number.isNaN(Number(inv))) {
        setErr('Please select an inventory to assign to the Admin.');
        return;
      }
      const finalBody = { ...pendingCreate, inventoryId: Number(inv) };
      setErr(''); setOk('');
      await createUser(finalBody);
      setOk('User created');
      setPendingCreate(null);
      setInventoryModalOpen(false);
      await fetchAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  // modal open/close helpers
  function openCreate() { setCreateRole('driver'); setEditRow(null); setModalOpen(true); }
  function openEdit(row) { setEditRow(row); setEditRole(row?.role || 'driver'); setModalOpen(true); }
  function closeModal() { setEditRow(null); setModalOpen(false); }

  /* ---------- filtering & paging ---------- */
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

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pages);
  const sliced = useMemo(() => {
    const start = (pageClamped - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageClamped]);

  useEffect(() => { setPage(1); }, [q, roleFilter]); // reset to first page when filters change

  /* ---------- RENDER ---------- */
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
                ? <>Connected to <code>/users</code>. Create, edit, delete and (for admins) assign a managed inventory. Drivers can include a phone number.</>
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
                <option value="driver">Driver</option>
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
          <div className="mb-3 flex items-center gap-2 text-slate-700">
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

      {/* Superadmin table (with pagination) */}
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
              {[...Array(5)].map((_,i)=>(
                <div key={i} className="mb-2 h-12 animate-pulse rounded-xl border border-slate-200 bg-white/60"/>
              ))}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-200">
                {sliced.map(u => (
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
                        onClick={()=> askDeleteUser(u)}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                      >
                        <Trash2 size={14}/> Delete
                      </button>
                    </div>
                  </li>
                ))}
                {sliced.length === 0 && !loading && (
                  <li className="px-4 py-6 text-center text-slate-500">No users found.</li>
                )}
              </ul>

              <div className="px-4 pb-3">
                <Pager page={pageClamped} pages={pages} onPage={(p)=> setPage(Math.max(1, Math.min(pages, p)))} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal (superadmin only) - Step 1: Create/Edit */}
      {isSuper && (
        <FormModal
          key={editRow ? `edit-${editRole}-${editRow.id}` : `create-${createRole}`} // force remount on role change
          title={editRow ? `Edit User: ${editRow.fullname}` : 'New User'}
          open={modalOpen}
          onClose={closeModal}
          fields={editRow ? EDIT_FIELDS : CREATE_FIELDS}
          initial={
            editRow
              ? { fullname: editRow.fullname, email: editRow.email, role: editRow.role }
              : { role: 'driver' } // default create role
          }
          onSubmit={handleSubmit}
        />
      )}

      {/* Modal (superadmin only) - Step 2: Assign Inventory for Admin */}
      {isSuper && (
        <FormModal
          title="Assign Inventory to Admin"
          open={inventoryModalOpen}
          onClose={() => { setInventoryModalOpen(false); setPendingCreate(null); }}
          fields={INVENTORY_FIELDS}
          initial={{}}
          onSubmit={handleAssignInventory}
        />
      )}

      {/* Custom confirm delete */}
      <ConfirmDeleteModal
        open={confirmOpen}
        user={confirmTarget}
        status={confirmStatus}
        message={confirmMsg}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => performDeleteUser(confirmTarget)}
      />
    </div>
  );
}