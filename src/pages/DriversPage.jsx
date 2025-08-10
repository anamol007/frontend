// src/pages/DriversPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Truck, Mail, Phone, IdCard, Car,
  ToggleRight, ToggleLeft, Plus, Edit, Trash2, X, Search, RefreshCw, PackageCheck
} from 'lucide-react';
import { API_URL, authHeaders as h, Field } from '../utils/api';

/* map driver coming from backend */
function mapDriver(raw) {
  const d = raw || {};
  return {
    id: d.id ?? d.driverId ?? d.driver_id,
    fullname: d.fullname ?? d.name ?? d.full_name ?? '',
    email: d.email ?? '',
    phone: d.phone ?? d.phoneNumber ?? d.phone_no ?? '',
    licenseNo: d.licenseNo ?? d.license_no ?? d.license ?? '',
    vehicleNo: d.vehicleNo ?? d.vehicle_no ?? d.vehicle ?? '',
    active: (d.active ?? d.isActive ?? d.enabled ?? true) ? true : false,
    _raw: d,
  };
}

/* send all likely keys — backend will pick the ones it uses */
function payloadFromForm(f) {
  return {
    fullname: f.fullname || undefined, name: f.fullname || undefined, full_name: f.fullname || undefined,
    email: f.email || undefined,
    phone: f.phone || undefined, phoneNumber: f.phone || undefined, phone_no: f.phone || undefined,
    licenseNo: f.licenseNo || undefined, license_no: f.licenseNo || undefined,
    vehicleNo: f.vehicleNo || undefined, vehicle_no: f.vehicleNo || undefined,
    active: !!f.active,
  };
}

const avatar = (t) => ((t || 'D').trim().charAt(0) || 'D').toUpperCase();

export default function DriversPage() {
  const me = (() => {
    try { return JSON.parse(localStorage.getItem('auth_user') || '{}'); } catch { return {}; }
  })();
  const role = String(me?.role || '').toLowerCase();
  const canEdit = role === 'admin' || role === 'superadmin';
  const canDelete = role === 'superadmin';

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({}); // { [driverId]: deliveryCount }
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('');

  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ fullname:'', email:'', phone:'', licenseNo:'', vehicleNo:'', active:true });

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { searchOrList(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function fetchAll() {
    try {
      setLoading(true); setApiError(''); setNotice('');
      const [listRes, countRes] = await Promise.all([
        axios.get(`${API_URL}/drivers`, { headers: h() }),
        axios.get(`${API_URL}/drivers/stats/delivery-count`, { headers: h() }).catch(() => ({ data: [] })),
      ]);
      const list = listRes.data?.data ?? listRes.data?.drivers ?? listRes.data ?? [];
      setRows(Array.isArray(list) ? list.map(mapDriver) : []);
      const stats = countRes.data?.data ?? countRes.data ?? [];
      const map = {};
      if (Array.isArray(stats)) {
        for (const s of stats) {
          const id = s.driverId ?? s.driver_id ?? s.id;
          const c  = s.deliveryCount ?? s.count ?? 0;
          if (id != null) map[id] = c;
        }
      }
      setCounts(map);
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to load drivers'); setRows([]);
    } finally { setLoading(false); }
  }

  async function searchOrList() {
    if (!q.trim()) { fetchAll(); return; }
    try {
      setLoading(true); setApiError('');
      const res = await axios.get(`${API_URL}/drivers/search`, {
        headers: h(),
        params: { q: q.trim() }, // backend’s search uses /drivers/search
      });
      const data = res.data?.data ?? res.data ?? [];
      setRows(Array.isArray(data) ? data.map(mapDriver) : []);
    } catch {
      // If search route isn’t implemented properly, fall back to full list and client filter
      await fetchAll();
    } finally { setLoading(false); }
  }

  function openCreate(){ setForm({ fullname:'', email:'', phone:'', licenseNo:'', vehicleNo:'', active:true }); setShowCreate(true); }
  function openEdit(d){ setEditingId(d.id); setForm({ fullname:d.fullname||'', email:d.email||'', phone:d.phone||'', licenseNo:d.licenseNo||'', vehicleNo:d.vehicleNo||'', active: !!d.active }); setShowEdit(true); }

  async function handleCreate(e){
    e.preventDefault();
    try {
      setSaving(true); setApiError(''); setNotice('');
      await axios.post(`${API_URL}/drivers`, payloadFromForm(form), { headers: h() });
      setShowCreate(false);
      await fetchAll();
      setNotice('Driver created.');
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to create driver');
    } finally { setSaving(false); }
  }
  async function handleEdit(e){
    e.preventDefault();
    try {
      setSaving(true); setApiError(''); setNotice('');
      await axios.put(`${API_URL}/drivers/${editingId}`, payloadFromForm(form), { headers: h() });
      setShowEdit(false); setEditingId(null);
      await fetchAll();
      setNotice('Driver updated.');
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to update driver');
    } finally { setSaving(false); }
  }
  async function handleDelete(id){
    if (!window.confirm('Delete this driver? (superadmin only)')) return;
    try {
      setDeletingId(id); setApiError(''); setNotice('');
      await axios.delete(`${API_URL}/drivers/${id}`, { headers: h() });
      await fetchAll();
      setNotice('Driver deleted.');
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to delete driver');
    } finally { setDeletingId(null); }
  }

  const filtered = useMemo(() => {
    let arr = rows;
    if (activeOnly) arr = arr.filter(d => d.active);
    const term = q.trim().toLowerCase();
    if (!term) return arr;
    // client-side filter (also used when search API fallback happens)
    return arr.filter(d => [d.fullname, d.email, d.phone, d.licenseNo, d.vehicleNo].join(' ').toLowerCase().includes(term));
  }, [q, rows, activeOnly]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter(d => d.active).length;
    const withVehicle = filtered.filter(d => (d.vehicleNo || '').trim()).length;
    return { total, active, withVehicle };
  }, [filtered]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tr from-amber-400/30 to-emerald-400/30 blur-2xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-emerald-600">
              Drivers
            </h1>
            <p className="text-slate-500 text-sm">Manage delivery personnel.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} className="pill bg-slate-900/90 text-white hover:bg-slate-900"><RefreshCw size={14}/> Refresh</button>
            {canEdit && (
              <button onClick={openCreate} className="pill bg-gradient-to-r from-amber-600 to-emerald-600 text-white hover:from-amber-700 hover:to-emerald-700">
                <Plus size={16}/> New Driver
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Truck} label="Total" value={stats.total} hue="from-amber-500 to-orange-500" />
          <StatCard icon={ToggleRight} label="Active" value={stats.active} hue="from-emerald-500 to-cyan-500" />
          <StatCard icon={Car} label="With vehicle" value={stats.withVehicle} hue="from-indigo-500 to-sky-500" />
        </div>
      </div>

      {/* API messages */}
      {apiError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{apiError}</div>}
      {notice &&   <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{notice}</div>}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search drivers…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-9 py-2 text-sm backdrop-blur focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={activeOnly} onChange={(e)=>setActiveOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"/>
          Show active only
        </label>
      </div>

      {/* List */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-tr from-amber-400/15 to-emerald-400/15 blur-3xl" />
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <div className="h-5 w-5 mr-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-600">No drivers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Driver</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-left">License</th>
                  <th className="px-4 py-2 text-left">Vehicle</th>
                  <th className="px-4 py-2 text-left">Active</th>
                  <th className="px-4 py-2 text-left">Deliveries</th>
                  <th className="px-4 py-2 text-left w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-white/60">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-semibold">{avatar(d.fullname)}</div>
                        <div className="leading-tight">
                          <div className="font-medium text-slate-900">{d.fullname || '—'}</div>
                          <div className="text-xs text-slate-500">{d.id ? `#${d.id}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{d.email || '—'}</td>
                    <td className="px-4 py-2">{d.phone || '—'}</td>
                    <td className="px-4 py-2">{d.licenseNo || '—'}</td>
                    <td className="px-4 py-2">{d.vehicleNo || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[12px] ${d.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {d.active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>} {d.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-700 px-2 py-0.5 text-[12px]">
                        <PackageCheck size={14}/> {counts[d.id] ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <button onClick={()=>openEdit(d)} className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1.5"><Edit size={14}/> Edit</button>
                        )}
                        {canDelete && (
                          <button onClick={()=>handleDelete(d.id)} disabled={deletingId === d.id} className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1.5 disabled:opacity-60"><Trash2 size={14}/> {deletingId === d.id ? 'Deleting…' : 'Delete'}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <DriverModal title="Create Driver" form={form} setForm={setForm} onCancel={()=>setShowCreate(false)} onSubmit={handleCreate} saving={saving}/>
      )}
      {showEdit && (
        <DriverModal title="Edit Driver" form={form} setForm={setForm} onCancel={()=>{ setShowEdit(false); setEditingId(null); }} onSubmit={handleEdit} saving={saving}/>
      )}
    </div>
  );
}

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

function DriverModal({ title, form, setForm, onCancel, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-tr from-amber-400/20 to-emerald-400/20 blur-2xl" />
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-1 hover:opacity-70" onClick={onCancel}><X size={18}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Full name" required>
              <input className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                     value={form.fullname} onChange={(e)=>setForm({...form, fullname:e.target.value})} required/>
            </Field>
            <Field label="Email">
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                       value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Phone">
              <div className="relative">
                <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                       value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})}/>
              </div>
            </Field>
            <Field label="License No.">
              <div className="relative">
                <IdCard size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                       value={form.licenseNo} onChange={(e)=>setForm({...form, licenseNo:e.target.value})}/>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Vehicle No.">
              <div className="relative">
                <Car size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                       value={form.vehicleNo} onChange={(e)=>setForm({...form, vehicleNo:e.target.value})}/>
              </div>
            </Field>
            <Field label="Active">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur">
                <input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active:e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"/>
                {form.active ? 'Yes' : 'No'}
              </label>
            </Field>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-600 to-emerald-600 text-white hover:from-amber-700 hover:to-emerald-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}