// src/pages/CustomersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Users, Mail, Phone, MapPin, Plus, Edit, Trash2, X, Search, RefreshCw } from 'lucide-react';
import { API_URL, authHeaders as h, Field } from '../utils/api';

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapCustomer(raw) {
  const c = raw || {};
  const id = c.id ?? c.customerId ?? c.customer_id;
  const fullname = c.fullname ?? c.name ?? c.full_name ?? '';
  const email = c.email ?? '';
  const phone = c.phone ?? c.phoneNumber ?? c.phone_no ?? '';
  const address = c.address ?? c.address1 ?? c.addr ?? '';
  const city = c.city ?? c.town ?? '';
  return { id, fullname, email, phone, address, city, _raw: c };
}

// Payload sends multiple synonyms so whichever your backend expects will be present
function payloadFromForm(f) {
  const full = f.fullname?.trim() || undefined;
  const ph   = f.phone?.trim() || undefined;
  const addr = f.address?.trim() || undefined;

  return {
    // names
    fullname: full, name: full, full_name: full,
    // phone
    phone: ph, phoneNumber: ph, phone_no: ph,
    // address
    address: addr, address1: addr, addr: addr,
    // optional fields
    email: f.email?.trim() || undefined,
    city: f.city?.trim() || undefined,
  };
}

const avatar = (t) => ((t || 'C').trim().charAt(0) || 'C').toUpperCase();

export default function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [notice, setNotice] = useState('');

  const [q, setQ] = useState('');

  // modal + form state
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ fullname:'', email:'', phone:'', address:'', city:'' });
  const [errors, setErrors] = useState({});

  useEffect(() => { fetchRows(); }, []);

  async function fetchRows() {
    try {
      setLoading(true); setApiError(''); setNotice('');
      const res = await axios.get(`${API_URL}/customers`, { headers: h() });
      const data = res.data?.data ?? res.data?.customers ?? res.data ?? [];
      setRows(Array.isArray(data) ? data.map(mapCustomer) : []);
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to load customers'); setRows([]);
    } finally { setLoading(false); }
  }

  function openCreate(){
    setForm({ fullname:'', email:'', phone:'', address:'', city:'' });
    setErrors({});
    setShowCreate(true);
  }
  function openEdit(c){
    setEditingId(c.id);
    setForm({ fullname:c.fullname||'', email:c.email||'', phone:c.phone||'', address:c.address||'', city:c.city||'' });
    setErrors({});
    setShowEdit(true);
  }

  function validate() {
    const e = {};
    if (!form.fullname.trim()) e.fullname = 'Full name is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (form.email && !emailRx.test(form.email.trim())) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate(ev){
    ev.preventDefault();
    setApiError('');
    if (!validate()) return;
    try {
      setSaving(true); setNotice('');
      await axios.post(`${API_URL}/customers`, payloadFromForm(form), { headers: h() });
      setShowCreate(false);
      setNotice('Customer created.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to create customer');
    } finally { setSaving(false); }
  }

  async function handleEdit(ev){
    ev.preventDefault();
    setApiError('');
    if (!validate()) return;
    try {
      setSaving(true); setNotice('');
      await axios.put(`${API_URL}/customers/${editingId}`, payloadFromForm(form), { headers: h() });
      setShowEdit(false); setEditingId(null);
      setNotice('Customer updated.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to update customer');
    } finally { setSaving(false); }
  }

  async function handleDelete(id){
    if (!window.confirm('Delete this customer?')) return;
    try {
      setDeletingId(id); setApiError(''); setNotice('');
      await axios.delete(`${API_URL}/customers/${id}`, { headers: h() });
      setNotice('Customer deleted.');
      await fetchRows();
    } catch (e) {
      setApiError(e?.response?.data?.message || 'Failed to delete customer');
    } finally { setDeletingId(null); }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(c => [c.fullname, c.email, c.phone, c.address, c.city].join(' ').toLowerCase().includes(term));
  }, [q, rows]);

  const stats = useMemo(() => ({
    total: filtered.length,
    withEmail: filtered.filter(c => c.email).length,
    withPhone: filtered.filter(c => c.phone).length,
  }), [filtered]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tr from-sky-400/30 to-indigo-400/30 blur-2xl" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-indigo-600">
              Customers
            </h1>
            <p className="text-slate-500 text-sm">Your contacts and buyers.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRows} className="pill bg-slate-900/90 text-white hover:bg-slate-900"><RefreshCw size={14}/> Refresh</button>
            <button onClick={openCreate} className="pill bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700"><Plus size={16}/> New Customer</button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Total" value={stats.total} hue="from-sky-500 to-indigo-500" />
          <StatCard icon={Mail}  label="With email" value={stats.withEmail} hue="from-fuchsia-500 to-pink-500" />
          <StatCard icon={Phone} label="With phone" value={stats.withPhone} hue="from-emerald-500 to-cyan-500" />
        </div>
      </div>

      {/* Alerts */}
      {apiError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{apiError}</div>}
      {notice  && <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{notice}</div>}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search customers…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-9 py-2 text-sm backdrop-blur focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </div>
      </div>

      {/* List */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-tr from-sky-400/15 to-indigo-400/15 blur-3xl" />
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <div className="h-5 w-5 mr-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-600">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-left">Address</th>
                  <th className="px-4 py-2 text-left w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-white/60">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-semibold">{avatar(c.fullname)}</div>
                        <div className="leading-tight">
                          <div className="font-medium text-slate-900">{c.fullname || '—'}</div>
                          <div className="text-xs text-slate-500">{c.city || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{c.email || '—'}</td>
                    <td className="px-4 py-2">{c.phone || '—'}</td>
                    <td className="px-4 py-2 text-slate-600 max-w-[40ch] truncate" title={c.address || ''}>{c.address || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={()=>openEdit(c)} className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1.5"><Edit size={14}/> Edit</button>
                        <button onClick={()=>handleDelete(c.id)} disabled={deletingId === c.id} className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1.5 disabled:opacity-60"><Trash2 size={14}/> {deletingId === c.id ? 'Deleting…' : 'Delete'}</button>
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
        <CustModal
          title="Create Customer"
          form={form}
          setForm={setForm}
          onCancel={()=>setShowCreate(false)}
          onSubmit={handleCreate}
          saving={saving}
          errors={errors}
        />
      )}
      {showEdit && (
        <CustModal
          title="Edit Customer"
          form={form}
          setForm={setForm}
          onCancel={()=>{ setShowEdit(false); setEditingId(null); }}
          onSubmit={handleEdit}
          saving={saving}
          errors={errors}
        />
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

function CustModal({ title, form, setForm, onCancel, onSubmit, saving, errors }) {
  // helper to style invalid fields
  const invalid = (name) => errors?.[name] ? 'border-rose-400 ring-rose-100' : 'border-slate-200 focus:border-sky-500 ring-sky-100';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-tr from-sky-400/20 to-indigo-400/20 blur-2xl" />
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-1 hover:opacity-70" onClick={onCancel}><X size={18}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Full name" required>
              <input
                className={`w-full rounded-2xl border bg-white/80 px-3 py-2 backdrop-blur focus:ring-2 ${invalid('fullname')}`}
                value={form.fullname}
                onChange={(e)=>setForm({...form, fullname:e.target.value})}
                required
                aria-invalid={!!errors?.fullname}
              />
              {errors?.fullname && <p className="mt-1 text-xs text-rose-600">{errors.fullname}</p>}
            </Field>
            <Field label="Email">
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className={`w-full rounded-2xl border bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:ring-2 ${invalid('email')}`}
                  value={form.email}
                  onChange={(e)=>setForm({...form, email:e.target.value})}
                  aria-invalid={!!errors?.email}
                />
                {errors?.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Phone" required>
              <div className="relative">
                <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`w-full rounded-2xl border bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:ring-2 ${invalid('phone')}`}
                  value={form.phone}
                  onChange={(e)=>setForm({...form, phone:e.target.value})}
                  required
                  aria-invalid={!!errors?.phone}
                />
                {errors?.phone && <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>}
              </div>
            </Field>
            <Field label="City">
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={form.city}
                onChange={(e)=>setForm({...form, city:e.target.value})}
              />
            </Field>
          </div>

          <Field label="Address" required>
            <div className="relative">
              <MapPin size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <textarea
                rows={3}
                className={`w-full rounded-2xl border bg-white/80 pl-9 pr-3 py-2 backdrop-blur focus:ring-2 ${invalid('address')}`}
                value={form.address}
                onChange={(e)=>setForm({...form, address:e.target.value})}
                required
                aria-invalid={!!errors?.address}
              />
              {errors?.address && <p className="mt-1 text-xs text-rose-600">{errors.address}</p>}
            </div>
          </Field>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}