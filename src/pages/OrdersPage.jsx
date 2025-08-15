// src/pages/OrdersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Pencil, Trash2, RefreshCw, Package, User2, MapPin,
  BadgeDollarSign, Calendar, CheckCircle2, Truck, CheckCheck, XCircle
} from 'lucide-react';
import { api } from '../utils/api';

const statusStyle = (s) => {
  const k = (s || '').toLowerCase();
  const map = {
    pending:    'bg-amber-50 text-amber-700 border-amber-200',
    confirmed:  'bg-sky-50 text-sky-700 border-sky-200',
    shipped:    'bg-indigo-50 text-indigo-700 border-indigo-200',
    delivered:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled:  'bg-rose-50 text-rose-700 border-rose-200'
  };
  return map[k] || 'bg-slate-50 text-slate-700 border-slate-200';
};
const StatusBadge = ({ value }) => (
  <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${statusStyle(value)}`}>
    {value || 'pending'}
  </span>
);
const prettyDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
};

function OrderForm({ open, onClose, initial, onSaved }) {
  const isEdit = !!(initial && initial.id);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // normalize initial date -> yyyy-MM-ddTHH:mm for <input type="datetime-local">
  const initDateLocal = (() => {
    const raw = initial?.orderDate;
    if (typeof raw === 'string') {
      // ISO or string
      const iso = /T/.test(raw) ? raw : new Date(raw).toISOString();
      return iso.slice(0, 16);
    }
    if (raw instanceof Date) return raw.toISOString().slice(0, 16);
    return new Date().toISOString().slice(0, 16);
  })();

  // fields
  const [customerId, setCustomerId]   = useState(initial?.customerId ?? initial?.customer?.id ?? '');
  const [productId, setProductId]     = useState(initial?.productId ?? initial?.product?.id ?? '');
  const [inventoryId, setInventoryId] = useState(initial?.inventoryId ?? initial?.inventory?.id ?? '');
  const [quantity, setQuantity]       = useState(
    typeof initial?.quantity === 'number' ? initial.quantity : (initial?.quantity || '')
  );
  const [unit, setUnit]               = useState(initial?.unit || '');
  const [status, setStatus]           = useState(initial?.status || 'pending');
  const [paymentMethod, setPayment]   = useState(initial?.paymentMethod || 'cash');
  const [orderDate, setOrderDate]     = useState(initDateLocal);

  // option lists
  const [customers, setCustomers]     = useState([]);
  const [products, setProducts]       = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits]             = useState(['KG','BORI']);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [c, p, i] = await Promise.all([
          api.get('/customers').catch(()=>({data:[] })),   // tolerant
          api.get('/products').catch(()=>({data:[] })),
          api.get('/inventory').catch(()=>({data:[] }))
        ]);
        const cList = Array.isArray(c?.data?.data) ? c.data.data : (Array.isArray(c?.data) ? c.data : []);
        const pList = Array.isArray(p?.data?.data) ? p.data.data : (Array.isArray(p?.data) ? p.data : []);
        const iList = Array.isArray(i?.data?.data) ? i.data.data : (Array.isArray(i?.data) ? i.data : []);
        setCustomers(cList);
        setProducts(pList);
        setInventories(iList);
      } catch {/* ignore */}
    })();
  }, [open]);

  // load available units for selected product (never crash)
  useEffect(() => {
    if (!open) return;
    if (!productId) { setUnits(['KG','BORI']); return; }
    (async () => {
      try {
        const r = await api.get(`/product-units/product/${productId}`);
        const list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
        const names = [];
        for (const row of list) {
          if (row?.unit?.name) names.push(row.unit.name);
          else if (row?.unitName) names.push(row.unitName);
          else if (row?.name) names.push(row.name);
          else if (row?.unit_id || row?.unitId) {
            const id = row.unit_id ?? row.unitId;
            if (id === 1) names.push('KG');
            if (id === 2) names.push('BORI');
          }
        }
        const unique = Array.from(new Set(names));
        setUnits(unique.length ? unique : ['KG','BORI']);
        if (unit && unique.length && !unique.includes(unit)) setUnit('');
      } catch {
        setUnits(['KG','BORI']);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, open]);

  async function handleSave(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (!customerId || !productId || !inventoryId || !quantity || !unit) {
      setErr('Please fill all required fields.');
      return;
    }
    const payload = {
      customerId: Number(customerId),
      productId: Number(productId),
      inventoryId: Number(inventoryId),
      quantity: Number(quantity),
      unit,
      status,
      paymentMethod,
      orderDate: new Date(orderDate).toISOString()
    };
    try {
      setSaving(true);
      if (isEdit) await api.put(`/orders/${initial.id}`, payload);
      else       await api.post('/orders', payload);
      setOk(isEdit ? 'Order updated' : 'Order created');
      setTimeout(() => { onSaved(); onClose(); }, 250);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Could not save order');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSave} className="relative w-[min(920px,94vw)] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">{isEdit ? 'Edit Order' : 'Create Order'}</h3>
          <button type="button" onClick={onClose} className="rounded-xl border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Close</button>
        </div>

        {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Customer *</span>
            <select value={customerId} onChange={(e)=>setCustomerId(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500" required>
              <option value="">Select…</option>
              {customers.map(c => <option key={c?.id} value={c?.id}>{c?.fullname || c?.customerName || `#${c?.id}`}</option>)}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Product *</span>
            <select value={productId} onChange={(e)=>setProductId(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500" required>
              <option value="">Select…</option>
              {products.map(p => <option key={p?.id} value={p?.id}>{p?.productName || `#${p?.id}`}</option>)}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Inventory *</span>
            <select value={inventoryId} onChange={(e)=>setInventoryId(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500" required>
              <option value="">Select…</option>
              {inventories.map(w => <option key={w?.id} value={w?.id}>{w?.inventoryName || `#${w?.id}`}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Quantity *</span>
              <input type="number" step="0.01" min="0" value={quantity} onChange={(e)=>setQuantity(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Unit *</span>
              <select value={unit} onChange={(e)=>setUnit(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500" required>
                <option value="">Select…</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Status</span>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500">
              {['pending','confirmed','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Payment</span>
            <select value={paymentMethod} onChange={(e)=>setPayment(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500">
              {['cash','cheque','card','no'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="text-slate-600">Order Date</span>
            <input type="datetime-local" value={orderDate} onChange={(e)=>setOrderDate(e.target.value)} className="rounded-xl border px-3 py-2.5 outline-none focus:border-indigo-500"/>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-slate-700 hover:bg-slate-50">Cancel</button>
          <button disabled={saving} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 font-semibold text-white shadow hover:shadow-md disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OrdersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function fetchOrders() {
    setLoading(true); setErr(''); setOk('');
    try {
      const r = await api.get('/orders');
      const data = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
      setRows(data || []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Error fetching orders');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchOrders(); }, []);

  const filtered = useMemo(() => {
    let list = Array.isArray(rows) ? rows : [];
    if (statusFilter) list = list.filter(x => (x?.status || '').toLowerCase() === statusFilter);
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(x => {
      const customer = (x?.customer?.fullname || '').toLowerCase();
      const product  = (x?.product?.productName || '').toLowerCase();
      const inv      = (x?.inventory?.inventoryName || '').toLowerCase();
      const idStr    = String(x?.id || '');
      return customer.includes(s) || product.includes(s) || inv.includes(s) || idStr.includes(s);
    });
  }, [rows, q, statusFilter]);

  async function handleDelete(row) {
    if (!window.confirm(`Delete order #${row?.id}?`)) return;
    try { await api.delete(`/orders/${row.id}`); setOk('Order deleted'); fetchOrders(); }
    catch (e) { setErr(e?.response?.data?.message || e?.message || 'Delete failed'); }
  }
  async function quickStatus(row, newStatus) {
    try { await api.patch(`/orders/${row.id}/status`, { status: newStatus }); fetchOrders(); }
    catch (e) { setErr(e?.response?.data?.message || e?.message || 'Status update failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
            <p className="text-sm text-slate-500">Create, edit, and update order status.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Search…" className="w-64 bg-transparent outline-none text-sm" />
            </div>
            <select value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200">
              <option value="">All statuses</option>
              {['pending','confirmed','shipped','delivered','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={fetchOrders} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100">
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={()=>{ setEditing(null); setOpenForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md">
              <Plus size={16} /> New Order
            </button>
          </div>
        </div>
        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : (Array.isArray(filtered) && filtered.length > 0) ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(row => (
            <div key={row?.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/85 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl">
              <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">#{row?.id} • <StatusBadge value={row?.status} /></div>
                <div className="flex items-center gap-2">
                  <User2 size={16} className="text-slate-400" />
                  <div className="truncate text-base font-semibold text-slate-900">{row?.customer?.fullname || '—'}</div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                  <Package size={16} className="text-slate-400" />
                  <span className="truncate">{row?.product?.productName || '—'}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={16} className="text-slate-400" />
                  <span className="truncate">{row?.inventory?.inventoryName || '—'}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 text-slate-700">
                    <BadgeDollarSign size={16} className="text-slate-500" />
                    {typeof row?.totalAmount === 'number' ? row.totalAmount.toLocaleString() : (row?.totalAmount || '—')}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 text-slate-700">
                    <Calendar size={16} className="text-slate-500" />
                    {prettyDate(row?.orderDate)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 text-slate-700">
                    {row?.quantity} {row?.unit}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button onClick={()=>quickStatus(row, 'confirmed')}  title="Mark confirmed" className="rounded-xl border px-2.5 py-2 text-slate-600 hover:bg-slate-50"><CheckCircle2 size={16} /></button>
                <button onClick={()=>quickStatus(row, 'shipped')}    title="Mark shipped"   className="rounded-xl border px-2.5 py-2 text-slate-600 hover:bg-slate-50"><Truck size={16} /></button>
                <button onClick={()=>quickStatus(row, 'delivered')}  title="Mark delivered" className="rounded-xl border px-2.5 py-2 text-slate-600 hover:bg-slate-50"><CheckCheck size={16} /></button>
                <button onClick={()=>quickStatus(row, 'cancelled')}  title="Cancel"         className="rounded-xl border px-2.5 py-2 text-slate-600 hover:bg-slate-50"><XCircle size={16} /></button>

                <button
                  onClick={()=>{ setEditing({
                    ...row,
                    customerId: row?.customer?.id ?? row?.customerId,
                    productId: row?.product?.id ?? row?.productId,
                    inventoryId: row?.inventory?.id ?? row?.inventoryId
                  }); setOpenForm(true); }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Pencil size={16} /> Edit
                </button>
                <button onClick={()=>handleDelete(row)} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">No orders found.</div>
      )}

      <OrderForm
        open={openForm}
        initial={editing}
        onClose={() => { setOpenForm(false); setEditing(null); }}
        onSaved={fetchOrders}
      />
    </div>
  );
}