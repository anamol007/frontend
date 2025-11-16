// src/pages/UsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  User as UserIcon, Search, Plus, RefreshCw, Pencil, Trash2, Building2, ShieldAlert,
  X as XIcon, Eye, EyeOff
} from 'lucide-react';
import { api } from '../utils/api';

const PAGE_SIZE = 10;

/* --------------------------- date formatting ---------------------------- */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtPrettyDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(+d)) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${ordinal(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

/* ------------------------- SearchableSelect ----------------------------- */
function SearchableSelect({
  options = [],
  value = '',
  onChange = () => {},
  placeholder = 'Select…',
  disabled = false,
  label = null,
  id,
  noOptionsText = 'No options'
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const controlRef = useRef(null);
  const menuRef = useRef(null);

  const filtered = useMemo(() => {
    const t = (q || '').trim().toLowerCase();
    if (!t) return options;
    return options.filter(o => (String(o.label || o.value || '')).toLowerCase().includes(t));
  }, [options, q]);

  useEffect(() => { if (!open) setQ(''); }, [open]);
  useEffect(() => setActiveIndex(0), [filtered.length]);

  useEffect(() => {
    function onDoc(e) {
      if (!controlRef.current) return;
      if (controlRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function onKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') { setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); e.preventDefault(); scrollActive(); }
    if (e.key === 'ArrowUp') { setActiveIndex(i => Math.max(i - 1, 0)); e.preventDefault(); scrollActive(); }
    if (e.key === 'Enter') { if (filtered[activeIndex]) commit(filtered[activeIndex]); e.preventDefault(); }
    if (e.key === 'Escape') { setOpen(false); e.preventDefault(); }
  }
  function scrollActive() {
    const el = menuRef.current?.querySelector('[data-active="1"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function commit(opt) {
    onChange(opt.value);
    setOpen(false);
  }

  const [menuStyle, setMenuStyle] = useState(null);
  const computePosition = () => {
    const ctrl = controlRef.current;
    if (!ctrl) return;
    const rect = ctrl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MENU_MAX = Math.min(420, Math.floor(vh * 0.55));
    const MENU_MIN = 120;
    const prefHeight = Math.max(MENU_MIN, Math.min(MENU_MAX, Math.floor(vh * 0.4)));
    let top = rect.top - prefHeight;
    let placement = 'above';
    if (top < 8) {
      top = rect.bottom;
      placement = 'below';
      const avail = Math.max(120, Math.min(MENU_MAX, Math.floor(vh - rect.bottom - 16)));
      setMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${Math.max(8, rect.left)}px`,
        minWidth: `${Math.max(240, rect.width)}px`,
        maxWidth: `calc(100vw - 16px)`,
        maxHeight: `${avail}px`,
        zIndex: 99999,
        transformOrigin: 'top left',
      });
      return;
    }
    setMenuStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${Math.max(8, rect.left)}px`,
      minWidth: `${Math.max(240, rect.width)}px`,
      maxWidth: `calc(100vw - 16px)`,
      maxHeight: `${prefHeight}px`,
      zIndex: 99999,
      transformOrigin: 'bottom left',
    });
  };

  useEffect(() => { if (open) computePosition(); }, [open, filtered.length]);
  useEffect(() => {
    const onR = () => { if (open) computePosition(); };
    window.addEventListener('resize', onR);
    window.addEventListener('scroll', onR, true);
    return () => { window.removeEventListener('resize', onR); window.removeEventListener('scroll', onR, true); };
  }, [open]);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label ?? '';

  return (
    <div className="relative">
      {label && <div className="text-xs font-medium text-slate-700 mb-1">{label}</div>}

      <div
        ref={controlRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onClick={() => { if (!disabled) setOpen(s => !s); }}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 bg-white ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        id={id}
      >
        <div className="flex-1 text-sm truncate">
          {selectedLabel || <span className="text-slate-400">{placeholder}</span>}
        </div>
        <div className="text-xs text-slate-400">{open ? '▲' : '▼'}</div>
      </div>

      {open && menuStyle && ReactDOM.createPortal(
        <div ref={menuRef} style={menuStyle}>
          <div className="rounded-xl border bg-white shadow-lg h-full flex flex-col overflow-hidden" role="listbox" aria-labelledby={id}>
            <div className="px-3 py-2 bg-white">
              <input
                autoFocus
                value={q}
                onChange={(e) => { setQ(e.target.value); setActiveIndex(0); }}
                onKeyDown={onKeyDown}
                placeholder="Type to search…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="overflow-auto" style={{ flex: 1 }}>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">{noOptionsText}</div>
              ) : filtered.map((opt, i) => {
                const active = i === activeIndex;
                return (
                  <div
                    key={opt.value}
                    data-active={active ? '1' : '0'}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(opt)}
                    className={`px-3 py-2 cursor-pointer text-sm ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  >
                    <div className="truncate font-medium">{opt.label}</div>
                    {opt.secondary && <div className="text-xs text-slate-400">{opt.secondary}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ------------------------ password strength util ------------------------- */
function passwordStrength(password = '') {
  let score = 0;
  if (!password) return { score, label: 'Empty' };
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const map = { 0: 'Very weak', 1: 'Weak', 2: 'Fair', 3: 'Good', 4: 'Strong' };
  return { score, label: map[score] || 'Weak' };
}

/* --------------------------- User form modal ---------------------------- */
function UserFormModal({ open, initial = null, inventories = [], onClose = () => {}, onSubmit = () => {} }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    fullname: initial?.fullname ?? '',
    email: initial?.email ?? '',
    password: '',
    role: initial?.role ?? 'admin',
    inventoryId: initial?.managedItems?.[0]?.inventory?.id ?? initial?.inventoryId ?? '',
    phoneNumber: initial?.phoneNumber ?? ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const nepaliRegex = /^9(7|8)\d{8}$/;

  useEffect(() => {
    if (!open) return;
    setForm({
      fullname: initial?.fullname ?? '',
      email: initial?.email ?? '',
      password: '',
      role: initial?.role ?? 'admin',
      inventoryId: initial?.managedItems?.[0]?.inventory?.id ?? initial?.inventoryId ?? '',
      phoneNumber: initial?.phoneNumber ?? ''
    });
    setErrors({});
    setShowPassword(false);
  }, [open, initial]);

  function handleChange(key, value) {
    setForm(s => ({ ...s, [key]: value }));
    validateField(key, value);
  }

  function validateField(k, v) {
    const e = { ...errors };
    const setE = (name, msg) => e[name] = msg;
    const clear = (name) => { if (e[name]) delete e[name]; };

    if (k === 'fullname') {
      if (!v || v.trim().length < 3) setE('fullname', 'Full name (min 3 chars)'); else clear('fullname');
    } else if (k === 'email') {
      const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!v || !rx.test(v)) setE('email', 'Valid email required'); else clear('email');
    } else if (k === 'password') {
      if (!isEdit && (!v || v.length < 6)) setE('password', 'Password required (min 6)');
      else if (v && v.length < 6) setE('password', 'Min 6 chars'); else clear('password');
    } else if (k === 'phoneNumber') {
      if (v && !nepaliRegex.test(v)) setE('phoneNumber', 'Nepali mobile required (97/98 start, 10 digits)'); else clear('phoneNumber');
    } else if (k === 'role') {
      if (!v) setE('role', 'Role required'); else clear('role');
      if (v !== 'admin') clear('inventoryId');
    } else if (k === 'inventoryId') {
      if (form.role === 'admin' && !v) setE('inventoryId', 'Required for Admin role'); else clear('inventoryId');
    }
    setErrors(e);
    return e;
  }

  function validateAll() {
    const e = {};
    if (!form.fullname || form.fullname.trim().length < 3) e.fullname = 'Full name (min 3 chars)';
    const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email || !rx.test(form.email)) e.email = 'Valid email required';
    if (!isEdit && (!form.password || form.password.length < 6)) e.password = 'Password required (min 6)';
    if (form.password && form.password.length < 6) e.password = 'Min 6 chars';
    if (form.phoneNumber && !nepaliRegex.test(form.phoneNumber)) e.phoneNumber = 'Nepali mobile required (97/98 start, 10 digits)';
    if (!form.role) e.role = 'Role required';
    if (form.role === 'admin' && !form.inventoryId) e.inventoryId = 'Required for Admin role';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e) {
    e?.preventDefault?.();
    if (!validateAll()) return;
    const body = {
      fullname: form.fullname.trim(),
      email: form.email.trim(),
      role: form.role,
      phoneNumber: form.phoneNumber.trim() || undefined,
      inventoryId: form.inventoryId || undefined,
    };
    if (form.password) body.password = form.password;
    await onSubmit(body);
  }

  const pwdInfo = passwordStrength(form.password || '');

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />

      <div className="relative w-[min(760px,96vw)] rounded-2xl border bg-white shadow-2xl overflow-hidden">
        <form onSubmit={submit}>
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold"> {isEdit ? `Edit admin — ${initial?.fullname ?? ''}` : 'New admin'} </h3>
              <div className="text-xs text-slate-500">{isEdit ? 'Leave password empty to keep current password.' : ''}</div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><XIcon /></button>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-auto">
            <div>
              <label className="text-xs font-medium text-slate-700">Full name</label>
              <input value={form.fullname} onChange={e => handleChange('fullname', e.target.value)} className="w-full rounded-xl border px-3 py-2 mt-1" />
              {errors.fullname && <div className="mt-1 text-xs text-rose-600">{errors.fullname}</div>}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Email</label>
              <input value={form.email} onChange={e => handleChange('email', e.target.value)} className="w-full rounded-xl border px-3 py-2 mt-1" />
              {errors.email && <div className="mt-1 text-xs text-rose-600">{errors.email}</div>}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Password {isEdit ? <span className="text-xs text-slate-400">(optional)</span> : null}</label>
              <div className="mt-1 flex items-center gap-2">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => handleChange('password', e.target.value)} placeholder={isEdit ? 'Leave empty to keep current password' : ''} className="w-full rounded-xl border px-3 py-2" />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${(pwdInfo.score / 4) * 100}%` }} className={`h-2 ${pwdInfo.score >= 3 ? 'bg-emerald-500' : pwdInfo.score === 2 ? 'bg-amber-400' : 'bg-rose-500'}`} />
                </div>
                <div className="text-xs text-slate-500">{pwdInfo.label}</div>
              </div>
              {errors.password && <div className="mt-1 text-xs text-rose-600">{errors.password}</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Role</label>
                <select value={form.role} onChange={e => handleChange('role', e.target.value)} className="w-full rounded-xl border px-3 py-2 mt-1">
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
                {errors.role && <div className="mt-1 text-xs text-rose-600">{errors.role}</div>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Phone (Nepali)</label>
                <input value={form.phoneNumber} onChange={e => handleChange('phoneNumber', e.target.value.replace(/\s+/g, ''))} placeholder="9841xxxxxxxx" className="w-full rounded-xl border px-3 py-2 mt-1" />
                <div className="text-xs text-slate-400 mt-1">Must start with <span className="font-medium">97</span> or <span className="font-medium">98</span> and be 10 digits</div>
                {errors.phoneNumber && <div className="mt-1 text-xs text-rose-600">{errors.phoneNumber}</div>}
              </div>
            </div>

            <div>
              <SearchableSelect
                options={inventories.map(inv => ({ value: inv.id, label: inv.inventoryName ?? inv.name ?? `#${inv.id}` }))}
                value={form.inventoryId}
                onChange={(v) => handleChange('inventoryId', v)}
                placeholder={form.role === 'admin' ? 'Select inventory…' : 'Select role "Admin" to assign inventory'}
                disabled={form.role !== 'admin'}
                label="Managed Inventory (required for Admin)"
                id="inventory-select"
                noOptionsText="No inventories"
              />
              {form.role === 'admin' && errors.inventoryId && <div className="mt-1 text-xs text-rose-600">{errors.inventoryId}</div>}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
            <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------- Pager --------------------------------- */
function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = [];
  const maxVisible = 4;
  if (pages <= maxVisible) for (let i = 1; i <= pages; i++) nums.push(i);
  else {
    if (page <= 3) nums.push(1, 2, 3, 4, '…', pages);
    else if (page >= pages - 2) nums.push(1, '…', pages - 3, pages - 2, pages - 1, pages);
    else nums.push(1, '…', page - 1, page, page + 1, '…', pages);
  }
  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40">Prev</button>
      {nums.map((n, i) => (n === '…' ? <span key={i} className="px-2 text-slate-400">…</span> :
        <button key={n} onClick={() => onPage(n)} className={`h-9 min-w-[40px] px-3 rounded-lg text-sm font-medium ${n === page ? 'bg-slate-900 text-white' : 'border bg-white'}`}>{n}</button>
      ))}
      <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page === pages} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40">Next</button>
    </div>
  );
}

/* ------------------------------- main page ------------------------------ */
export default function UsersPage() {
  const [me, setMe] = useState(null);
  const isAdmin = me?.role === 'admin';
  const isSuper = me?.role === 'superadmin';

  const [users, setUsers] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [myManagedInvs, setMyManagedInvs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [globalNotice, setGlobalNotice] = useState(null);
  const [ok, setOk] = useState('');

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmStatus, setConfirmStatus] = useState('confirm');
  const [confirmMsg, setConfirmMsg] = useState('');

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

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setErr(''); setOk('');
        const invRes = await api.get('/inventory/');
        const invData = Array.isArray(invRes?.data?.data) ? invRes.data.data : (invRes?.data || []);
        invData.sort((a, b) => String(a.inventoryName || '').localeCompare(String(b.inventoryName || '')));
        if (mounted) setInventories(invData);

        const params = { page: 1, limit: PAGE_SIZE };
        if (q && q.trim()) params.q = q.trim();
        if (roleFilter) params.role = roleFilter;
        const uRes = await api.get('/users/', { params });
        const payload = uRes?.data || {};
        const usersData = Array.isArray(payload.data) ? payload.data : (payload || []);
        if (mounted) {
          setUsers(Array.isArray(usersData) ? usersData : []);
          const meta = payload.pagination || {};
          setTotalPages(Number(meta.pages ?? meta.totalPages ?? 1) || 1);
          setTotalCount(Number(meta.total ?? usersData.length) || 0);
          setPage(Number(meta.page) || 1);
        }
      } catch (e) {
        if (mounted) setErr(e?.response?.data?.message || e?.message || 'Error fetching users');
      } finally {
        if (mounted) setLoading(false);
      }
    }, 400);
    return () => { mounted = false; clearTimeout(timer); };
  }, [q, roleFilter]);

  useEffect(() => {
    let mounted = true;
    async function loadPage(p = 1) {
      try {
        setLoading(true);
        setErr('');
        const params = { page: p, limit: PAGE_SIZE };
        if (q && q.trim()) params.q = q.trim();
        if (roleFilter) params.role = roleFilter;
        const uRes = await api.get('/users/', { params });
        const payload = uRes?.data || {};
        const usersData = Array.isArray(payload.data) ? payload.data : (payload || []);
        if (!mounted) return;
        setUsers(Array.isArray(usersData) ? usersData : []);
        const meta = payload.pagination || {};
        setTotalPages(Number(meta.pages ?? meta.totalPages ?? 1) || 1);
        setTotalCount(Number(meta.total ?? usersData.length) || 0);
        setPage(Number(meta.page) || p);
      } catch (e) {
        if (mounted) setErr(e?.response?.data?.message || e?.message || 'Error fetching users');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPage(page);
    return () => { mounted = false; };
  }, [page, roleFilter, q]);

  useEffect(() => { fetchMe(); }, []);

  async function createUser(body) {
    try {
      setErr(''); setOk('');
      await api.post('/users/', body);
      setOk('User created');
      setModalOpen(false);
      setPage(1);
      const r = await api.get('/users/', { params: { page: 1, limit: PAGE_SIZE } });
      const payload = r?.data || {};
      setUsers(Array.isArray(payload.data) ? payload.data : []);
      const meta = payload.pagination || {};
      setTotalPages(Number(meta.pages ?? meta.totalPages ?? 1) || 1);
      setTotalCount(Number(meta.total ?? (Array.isArray(payload.data) ? payload.data.length : 0)) || 0);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Create failed';
      setGlobalNotice({ title: 'Create failed', message: msg });
      throw e;
    }
  }

  async function updateUser(id, body) {
    try {
      await api.put(`/users/${id}`, body);
      setOk('User updated');
      setModalOpen(false);
      const res = await api.get('/users/', { params: { page, limit: PAGE_SIZE } });
      const payload = res?.data || {};
      setUsers(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Update failed';
      setGlobalNotice({ title: 'Update failed', message: msg });
      throw e;
    }
  }

  async function performDeleteUser(user) {
    try {
      setConfirmStatus('confirm'); setConfirmMsg('');
      await api.delete(`/users/${user.id}`);
      setConfirmStatus('success');
      setConfirmMsg('The user has been removed.');
      const res = await api.get('/users/', { params: { page, limit: PAGE_SIZE } });
      const payload = res?.data || {};
      setUsers(Array.isArray(payload.data) ? payload.data : []);
    } catch (e) {
      setConfirmStatus('error');
      setConfirmMsg(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  function askDeleteUser(u) {
    setConfirmTarget(u);
    setConfirmStatus('confirm');
    setConfirmMsg('');
    setConfirmOpen(true);
  }

  async function handleSubmit(form) {
    try {
      if (editRow?.id) await updateUser(editRow.id, form);
      else await createUser(form);
    } catch (e) {
      // handled higher up
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term && !roleFilter) return users;
    return (users || []).filter(u => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!term) return true;
      const invNames = (u.managedItems || []).map(m => m?.inventory?.inventoryName).filter(Boolean).join(' ');
      const hay = `${u.fullname||''} ${u.email||''} ${invNames}`.toLowerCase();
      return hay.includes(term);
    });
  }, [users, q, roleFilter]);

  return (
    <div className="space-y-5">
      {globalNotice && (
        <div className="fixed left-4 top-6 z-[90]">
          <div className="rounded-2xl border bg-white p-4 shadow">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><UserIcon /></div>
              <div>
                <div className="font-semibold">{globalNotice.title}</div>
                <div className="text-sm text-slate-600">{globalNotice.message}</div>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => setGlobalNotice(null)} className="rounded-xl bg-slate-900 px-3 py-1 text-white text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <UserIcon size={20}/> Admins
            </h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? <>Connected to <code>/users</code> with server pagination (10 per page). Create, edit, delete; assign inventory to Admins.</>
                : <>Access limited. As an Admin you cannot manage users; you can view your assigned inventories below.</>}
            </p>
          </div>

          {isSuper && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
                <Search size={16} className="text-slate-400" />
                <input
                  value={q}
                  onChange={(e)=> { setQ(e.target.value); setPage(1); }}
                  placeholder="Search name / email / inventory…"
                  className="w-72 bg-transparent outline-none text-sm"
                />
              </div>

              <select
                value={roleFilter}
                onChange={e=> { setRoleFilter(e.target.value); setPage(1); }}
                className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
              >
                <option value="">All roles</option>
                <option value="driver">Driver</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>

              <button
                onClick={()=> { setPage(1); }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw size={16}/> Refresh
              </button>

              <button
                onClick={() => { setEditRow(null); setModalOpen(true); }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16}/> New Admin
              </button>
            </div>
          )}
        </div>

        {(err || ok) && (
          <div className="mt-3">
            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
            {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
          </div>
        )}
      </div>

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
                    <div className="text-xs text-slate-500">{fmtPrettyDate(u.createdAt)}</div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setEditRow(u); setModalOpen(true); }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil size={14}/> Edit
                      </button>
                      <button
                        onClick={() => askDeleteUser(u)}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                      >
                        <Trash2 size={14}/> Delete
                      </button>
                    </div>
                  </li>
                ))}
                {filtered.length === 0 && !loading && (
                  <li className="px-4 py-6 text-center text-slate-500">No users found on this page.</li>
                )}
              </ul>

              <div className="flex items-center justify-between px-4 pb-3 text-xs text-slate-500">
                <div>
                  Showing {filtered.length} on this page • Total users: {totalCount}
                </div>
                <Pager
                  page={page}
                  pages={totalPages}
                  onPage={(p)=> setPage(Math.max(1, Math.min(totalPages, p)))}
                />
              </div>
            </>
          )}
        </div>
      )}

      {isSuper && (
        <UserFormModal
          open={modalOpen}
          initial={editRow}
          inventories={inventories}
          onClose={() => { setModalOpen(false); setEditRow(null); }}
          onSubmit={async (body) => {
            try {
              if (editRow?.id) await updateUser(editRow.id, body);
              else await createUser(body);
            } catch (e) {
              // errors handled upstream
            }
          }}
        />
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[85] grid place-items-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-[min(520px,96vw)] rounded-2xl border bg-white shadow-2xl">
            <div className={`flex items-center justify-between px-5 py-4 bg-slate-900 text-white`}>
              <div className="font-semibold">Confirm deletion</div>
              <button onClick={() => setConfirmOpen(false)} className="rounded-lg p-2 text-slate-200 hover:bg-white/10"><XIcon /></button>
            </div>
            <div className="px-5 py-4">
              <div>You are about to delete user <strong>{confirmTarget?.fullname ?? '—'}</strong>. This action cannot be undone.</div>
              <div className="mt-3 text-sm text-slate-500">{confirmMsg}</div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button onClick={() => setConfirmOpen(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => { performDeleteUser(confirmTarget); setConfirmOpen(false); }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}