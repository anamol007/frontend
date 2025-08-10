import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Edit, X } from 'lucide-react';
import { API_URL, authHeaders as h, Field } from '../utils/api';

const DRIVERS_OPTIONAL = true;

export default function DeliveriesPage() {
  const [rows, setRows] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ driverId:'', orderId:'', deliveredAt:'', notes:'' });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      setLoading(true); setApiError('');
      const dels = await axios.get(`${API_URL}/deliveries`, { headers: h() });
      const data = dels.data?.data ?? dels.data ?? [];
      setRows(Array.isArray(data) ? data : []);

      if (DRIVERS_OPTIONAL) {
        try {
          const dvs = await axios.get(`${API_URL}/drivers`, { headers: h() });
          const ds = dvs.data?.data ?? dvs.data?.drivers ?? dvs.data ?? [];
          setDrivers(Array.isArray(ds) ? ds : []);
        } catch { setDrivers([]); }
      }
    } catch (e) {
      setApiError(e.response?.data?.message || 'Failed to load deliveries');
    } finally { setLoading(false); }
  }

  function openCreate(){ setForm({ driverId:'', orderId:'', deliveredAt:'', notes:'' }); setShowCreate(true); }
  function openEdit(r){ setEditingId(r.id);
    setForm({
      driverId: r.driverId ?? r.driver_id ?? r.driver?.id ?? '',
      orderId: r.orderId ?? r.order_id ?? '',
      deliveredAt: (r.deliveredAt ?? r.delivered_at ?? '').slice(0,16),
      notes: r.notes || ''
    });
    setShowEdit(true);
  }

  function payload(){
    const did = form.driverId ? Number(form.driverId) : undefined;
    const oid = form.orderId ? Number(form.orderId) : undefined;
    const dt  = form.deliveredAt || undefined;
    return { driverId: did, orderId: oid, deliveredAt: dt, notes: form.notes || undefined,
             driver_id: did, order_id: oid, delivered_at: dt };
  }

  async function handleCreate(e){ e.preventDefault();
    try{ setSaving(true); setApiError(''); await axios.post(`${API_URL}/deliveries`, payload(), { headers: h() }); setShowCreate(false); await fetchAll(); }
    catch(e){ setApiError(e.response?.data?.message || 'Failed to create'); }
    finally{ setSaving(false); }
  }
  async function handleEdit(e){ e.preventDefault();
    try{ setSaving(true); setApiError(''); await axios.put(`${API_URL}/deliveries/${editingId}`, payload(), { headers: h() }); setShowEdit(false); setEditingId(null); await fetchAll(); }
    catch(e){ setApiError(e.response?.data?.message || 'Failed to update'); }
    finally{ setSaving(false); }
  }

  const driverName = (id) =>
    drivers.find(d => d.id === id)?.name || drivers.find(d => d.id === id)?.fullname;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-semibold text-slate-800">Deliveries</h1><p className="text-slate-500 text-sm">Track delivery tasks.</p></div>
        <button onClick={openCreate} className="pill bg-emerald-600 text-white hover:bg-emerald-700"><Plus size={16}/> New Delivery</button>
      </div>
      {apiError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{apiError}</div>}

      <div className="card overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16 text-slate-500"><div className="h-5 w-5 mr-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Loading…</div>
                 : rows.length === 0 ? <div className="p-8 text-center text-slate-600">No deliveries yet.</div>
                 : (
          <ul>
            {rows.map(r => {
              const did = r.driverId ?? r.driver_id;
              const when = r.deliveredAt ?? r.delivered_at ?? r.createdAt ?? Date.now();
              return (
                <li key={r.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
                  <div>
                    <div className="font-medium text-slate-800">
                      Driver: {driverName(did) || (did ? `#${did}` : '—')}
                    </div>
                    <div className="text-sm text-slate-500">
                      Order: {(r.orderId ?? r.order_id ?? '—')} · {new Date(when).toLocaleString()}
                    </div>
                  </div>
                  <button onClick={()=>openEdit(r)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm inline-flex items-center gap-1.5"><Edit size={14}/> Edit</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(showCreate || showEdit) && (
        <DelModal
          title={showCreate ? 'Create Delivery' : 'Edit Delivery'}
          drivers={drivers}
          form={form}
          setForm={setForm}
          onCancel={()=>{ setShowCreate(false); setShowEdit(false); setEditingId(null); }}
          onSubmit={showCreate ? handleCreate : handleEdit}
          saving={saving}
        />
      )}
    </div>
  );
}

function DelModal({ title, drivers, form, setForm, onCancel, onSubmit, saving }) {
  const showDriverSelect = drivers.length > 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="card w-full max-w-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100"><div className="text-lg font-semibold">{title}</div><button className="p-1 hover:opacity-70" onClick={onCancel}><X size={18}/></button></div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {showDriverSelect && (
              <Field label="Driver" required>
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white" value={form.driverId} onChange={e=>setForm({...form, driverId:e.target.value})} required>
                  <option value="">Select…</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name || d.fullname}</option>)}
                </select>
              </Field>
            )}
            <Field label="Order ID"><input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.orderId} onChange={e=>setForm({...form, orderId:e.target.value})}/></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Delivered at (optional)"><input type="datetime-local" className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.deliveredAt} onChange={e=>setForm({...form, deliveredAt:e.target.value})}/></Field>
            <Field label="Notes"><input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></Field>
          </div>
          <div className="pt-2 flex items-center justify-end gap-2"><button type="button" className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200" onClick={onCancel}>Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button></div>
        </form>
      </div>
    </div>
  );
}