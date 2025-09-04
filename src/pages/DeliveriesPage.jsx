// src/pages/DeliveriesPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Pencil, Trash2, RefreshCw, Truck, Package, ClipboardList, X, Info, AlertTriangle, Banknote,
} from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

/* ---------------- helpers ---------------- */
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const prettyDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const M = dt.toLocaleString(undefined, { month: 'short' });
  const D = ordinal(dt.getDate());
  const Y = dt.getFullYear();
  const T = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${M} ${D}, ${Y}, ${T}`;
};

// ---- normalize (defensive against snake/camel/backref shapes)
const norm = (d = {}) => ({
  id: d.id ?? d.ID ?? null,
  order_id: d.order_id ?? d.orderId ?? d.order?.id ?? null,
  driver_id: d.driver_id ?? d.driverId ?? d.driver?.id ?? null,
  order: d.order ?? null,
  driver: d.driver ?? null,
  deliveryDate: d.deliveryDate ?? d.delivery_date ?? null,
  deliveryStatus: d.deliveryStatus ?? d.delivery_status ?? null,
  deliveryAddress: d.deliveryAddress ?? d.delivery_address ?? null,
  createdAt: d.createdAt ?? null,
  updatedAt: d.updatedAt ?? null,
});

const sortByLabel = (a, b) => a.label.localeCompare(b.label);

/* ---------------- UI bits ---------------- */
function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-xl bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-1 text-slate-800">{children}</div>
    </div>
  );
}

function RowKV({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="min-w-[140px] text-slate-500">{k}</div>
      <div className="flex-1 font-medium text-slate-800">{v ?? '—'}</div>
    </div>
  );
}

function DeliveryCard({ d, onEdit, onDelete, onView, canManage }) {
  const od = norm(d);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 backdrop-blur transition-shadow hover:shadow-xl">
      <div className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow">
          <ClipboardList size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">Delivery #{od.id ?? '—'}</h3>
          </div>
          <div className="mt-1 grid gap-1 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-slate-400" />
              <span className="truncate">Order: {od.order?.id ?? od.order_id ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={14} className="text-slate-400" />
              <span className="truncate">
                Driver: {od.driver?.user?.fullname || od.driver?.driverName || od.driver_id || '—'}
              </span>
            </div>
          </div>
          {od.deliveryStatus && (
            <div className="mt-2 inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {od.deliveryStatus}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => onView(od)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <Info size={16} /> View
        </button>
        {canManage && (
          <>
            <button
              onClick={() => onEdit(od)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Pencil size={16} /> Edit
            </button>
            <button
              onClick={() => onDelete(od)}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              <Trash2 size={16} /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function DeliveriesPage() {
  // auth / role
  const [me, setMe] = useState(null);
  const isSuper = me?.role === 'superadmin';

  // data
  const [rows, setRows] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // filters
  const [q, setQ] = useState('');
  const [driverFilter, setDriverFilter] = useState('');

  // modal (form)
  const [openForm, setOpenForm] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // details modal
  const [inspect, setInspect] = useState(null);
  const [inspectOrder, setInspectOrder] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectErr, setInspectErr] = useState('');

  // permissions / lazy orders loading
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersErr, setOrdersErr] = useState('');
  const [canManage, setCanManage] = useState(false); // toggled true for superadmin

  // who am I?
  async function fetchMe() {
    try {
      const r = await api.get('/users/verify-token');
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
      setCanManage((u?.role || '') === 'superadmin');
    } catch {
      setMe(null);
      setCanManage(false);
    }
  }

  // -------- fetch public data (deliveries + drivers)
  async function fetchPublic() {
    try {
      setLoading(true);
      setErr(''); setOk('');
      const [dels, drs] = await Promise.all([
        api.get('/deliveries'),
        api.get('/drivers'),
      ]);
      const list = Array.isArray(dels?.data?.data) ? dels.data.data : (dels?.data || []);
      setRows(list.map(norm));
      setDrivers(Array.isArray(drs?.data?.data) ? drs.data.data : (drs?.data || []));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load deliveries/drivers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { fetchPublic(); }, []);

  // 🔄 auto refresh
  useEffect(() => {
    const tick = () => { if (!loading) fetchPublic(); };
    const id = setInterval(tick, 30000);
    const onFocus = () => tick();
    const onOnline = () => tick();
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loading]);

  // -------- lazy load orders (superadmin only). Use only confirmed for dropdown.
  async function ensureOrdersLoaded(currentOrderId) {
    if (!isSuper) { setErr('Only Super Admin can manage deliveries'); return false; }
    if (orders.length > 0 || ordersLoading) return true;
    try {
      setOrdersErr('');
      setOrdersLoading(true);
      const r = await api.get('/orders/status/confirmed');
      const data = Array.isArray(r?.data?.data) ? r.data.data : (r?.data || []);
      setOrders(data);
      return true;
    } catch (e) {
      setOrdersErr(e?.response?.data?.message || e?.message || 'Failed to load orders');
      return false;
    } finally {
      setOrdersLoading(false);
    }
  }

  // options
  const driverOptions = useMemo(() => {
    const opts = (drivers || []).map((d) => {
      const label =
        (d?.user?.fullname ? `${d.user.fullname}` : d?.driverName) ||
        `Driver #${d?.id ?? ''}`;
      return { value: d?.id, label };
    });
    return opts.sort(sortByLabel);
  }, [drivers]);

  const orderOptions = useMemo(() => {
    const opts = (orders || []).map((o) => {
      const parts = [
        `#${o?.id ?? ''}`,
        o?.customer?.fullname || o?.customerName,
        o?.product?.productName || o?.productName,
      ].filter(Boolean);
      return { value: o?.id, label: parts.join(' • ') || `Order #${o?.id ?? ''}` };
    });
    return opts.sort(sortByLabel);
  }, [orders]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = rows;
    if (driverFilter) {
      list = list.filter((d) => {
        const id = d?.driver_id ?? d?.driverId ?? d?.driver?.id;
        return String(id) === String(driverFilter);
      });
    }
    if (!query) return list;
    return list.filter((d) => {
      const nd = norm(d);
      const hay =
        `delivery#${nd.id} order#${nd.order_id} driver#${nd.driver_id} ` +
        `${nd.driver?.user?.fullname || ''} ${nd.order?.product?.productName || ''}`;
      return hay.toLowerCase().includes(query);
    });
  }, [rows, q, driverFilter]);

  // STRICT fields: only those your backend accepts
  const FIELDS = useMemo(() => ([
    { name: 'order_id',  type: 'select', label: ordersLoading ? 'Order (loading...)' : 'Order',  required: true, options: orderOptions },
    { name: 'driver_id', type: 'select', label: 'Driver', required: true, options: driverOptions },
  ]), [orderOptions, driverOptions, ordersLoading]);

  // sanitizer
  function sanitize(fields, payload) {
    const allow = new Set(fields.map(f => f.name));
    const out = {};
    Object.keys(payload || {}).forEach(k => {
      if (!allow.has(k)) return;
      const v = payload[k];
      if (v === '' || v === undefined || v === null) return;
      out[k] = v;
    });
    return out;
  }

  // submit (superadmin only)
  async function handleSubmit(form) {
    if (!isSuper) { setErr('Only Super Admin can perform this action'); return; }
    try {
      setErr(''); setOk('');
      const body = sanitize(FIELDS, form);
      if (editRow?.id) {
        await api.put(`/deliveries/${editRow.id}`, body);
        setOk('Delivery updated');
      } else {
        await api.post('/deliveries', body);
        setOk('Delivery created');
      }
      setOpenForm(false);
      setEditRow(null);
      await fetchPublic();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Action failed');
    }
  }

  async function handleDelete(row) {
    if (!isSuper) { setErr('Only Super Admin can delete deliveries'); return; }
    if (!window.confirm(`Delete delivery #${row.id}?`)) return;
    try {
      setErr(''); setOk('');
      await api.delete(`/deliveries/${row.id}`);
      setOk('Delivery deleted');
      await fetchPublic();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  }

  // open create/edit: make sure orders are loaded
  async function openCreate() {
    const ok = await ensureOrdersLoaded();
    if (!ok) return;
    setEditRow(null);
    setOpenForm(true);
  }
  async function openEdit(row) {
    const ok = await ensureOrdersLoaded(row?.order_id);
    if (!ok) return;
    setEditRow(row);
    setOpenForm(true);
  }

  // open view: fetch full order details for richer modal
  async function openView(row) {
    setInspect(row);
    setInspectOrder(null);
    setInspectErr('');
    if (!row?.order_id && !row?.order?.id) return;
    try {
      setInspectLoading(true);
      const id = row.order_id || row.order.id;
      const res = await api.get(`/orders/${id}`);
      const full = res?.data?.data || res?.data;
      setInspectOrder(full || null);
    } catch (e) {
      setInspectErr(e?.response?.data?.message || e?.message || 'Failed to load order details');
    } finally {
      setInspectLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header / controls */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Deliveries</h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? 'Link orders to drivers. Create, edit, filter and inspect.'
                : 'Browse and inspect deliveries.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* search */}
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search order/driver…"
                className="w-56 bg-transparent outline-none text-sm"
              />
            </div>

            {/* filter by driver */}
            <select
              value={driverFilter}
              onChange={(e)=> setDriverFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All drivers</option>
              {driverOptions.map((o)=>(
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* refresh */}
            <button
              onClick={fetchPublic}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            {/* new (superadmin only) */}
            {isSuper && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                <Plus size={16} /> New Delivery
              </button>
            )}
          </div>
        </div>

        {(ordersErr || err || ok) && (
          <div className="mt-3 grid gap-2">
            {ordersErr && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                <AlertTriangle size={16} /> {ordersErr}
              </div>
            )}
            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
            {ok  && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_,i)=>(
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-10 text-center text-slate-500">
          No deliveries found. Try a different search or driver filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d)=>(
            <DeliveryCard
              key={d.id}
              d={d}
              onEdit={openEdit}
              onDelete={handleDelete}
              onView={openView}
              canManage={isSuper}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal (superadmin only, but guarded too) */}
      <FormModal
        title={editRow ? 'Edit Delivery' : 'Create Delivery'}
        open={openForm}
        onClose={()=>{ setOpenForm(false); setEditRow(null); }}
        fields={[
          { name: 'order_id',  type: 'select', label: ordersLoading ? 'Order (loading...)' : 'Order',  required: true, options: orderOptions },
          { name: 'driver_id', type: 'select', label: 'Driver', required: true, options: driverOptions },
        ]}
        initial={editRow ? { order_id: editRow.order_id, driver_id: editRow.driver_id } : {}}
        onSubmit={handleSubmit}
      />

      {/* Details Modal */}
      {inspect && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={()=> { setInspect(null); setInspectOrder(null); }} />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <button
              onClick={()=> { setInspect(null); setInspectOrder(null); }}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                <ClipboardList size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Delivery #{inspect.id ?? '—'}</div>
                <div className="text-xs text-slate-500">Quick overview</div>
              </div>
            </div>

            {/* Body */}
            <div className="grid gap-3">
              {/* ORDER */}
              <Section title="Order">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>#{inspect.order?.id ?? inspect.order_id ?? '—'}</Pill>
                  {inspectOrder?.status && <Pill>{inspectOrder.status}</Pill>}
                  {typeof inspectOrder?.totalAmount !== 'undefined' && (
                    <Pill className="inline-flex items-center gap-1">
                      <Banknote size={12} /> {Number(inspectOrder.totalAmount || 0).toFixed(2)}
                    </Pill>
                  )}
                </div>
                <div className="mt-3 grid gap-2">
                  <RowKV k="Product" v={inspectOrder?.product?.productName ?? '—'} />
                  <RowKV
                    k="Quantity"
                    v={
                      (inspectOrder?.quantity != null
                        ? `${inspectOrder.quantity} ${inspectOrder?.unit?.name || ''}`
                        : '—')
                    }
                  />
                  <RowKV k="Payment" v={inspectOrder?.paymentMethod ?? '—'} />
                  <RowKV k="Order date" v={prettyDateTime(inspectOrder?.orderDate ?? inspect.order?.orderDate)} />
                </div>
              </Section>

              {/* CUSTOMER & INVENTORY */}
              <div className="grid gap-3 md:grid-cols-2">
                <Section title="Customer">
                  <div className="grid gap-1">
                    <div className="font-medium">{inspectOrder?.customer?.fullname ?? '—'}</div>
                    {inspectOrder?.customer?.phoneNumber && (
                      <div className="text-sm text-slate-600">{inspectOrder.customer.phoneNumber}</div>
                    )}
                    {inspectOrder?.customer?.address && (
                      <div className="text-sm text-slate-600">{inspectOrder.customer.address}</div>
                    )}
                  </div>
                </Section>
                <Section title="Inventory">
                  <div className="grid gap-1">
                    <div className="font-medium">{inspectOrder?.inventory?.inventoryName ?? '—'}</div>
                    {inspectOrder?.inventory?.address && (
                      <div className="text-sm text-slate-600">{inspectOrder.inventory.address}</div>
                    )}
                  </div>
                </Section>
              </div>

              {/* DRIVER */}
              <Section title="Driver">
                <div className="grid gap-1">
                  <div className="font-medium">
                    {inspect?.driver?.user?.fullname || inspect?.driver?.driverName || `#${inspect?.driver_id ?? '—'}`}
                  </div>
                  <div className="text-sm text-slate-600">
                    {inspect?.driver?.user?.email || '—'}
                    {inspect?.driver?.phoneNumber ? ` • ${inspect.driver.phoneNumber}` : ''}
                  </div>
                </div>
              </Section>

              {/* DELIVERY META */}
              {(inspect.deliveryStatus || inspect.deliveryDate || inspect.deliveryAddress || inspect.createdAt || inspect.updatedAt) && (
                <Section title="Delivery info">
                  <div className="grid gap-2">
                    {inspect.deliveryStatus && <RowKV k="Status" v={inspect.deliveryStatus} />}
                    {inspect.deliveryDate && <RowKV k="Planned date" v={prettyDateTime(inspect.deliveryDate)} />}
                    {inspect.deliveryAddress && <RowKV k="Address" v={inspect.deliveryAddress} />}
                    {inspect.createdAt && <RowKV k="Created" v={prettyDateTime(inspect.createdAt)} />}
                    {inspect.updatedAt && <RowKV k="Updated" v={prettyDateTime(inspect.updatedAt)} />}
                  </div>
                </Section>
              )}

              {inspectLoading && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Loading order details…
                </div>
              )}
              {inspectErr && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {inspectErr}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 flex justify-end">
              <button
                onClick={()=> { setInspect(null); setInspectOrder(null); }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}