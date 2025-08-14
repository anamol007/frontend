import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, RefreshCw, Truck, Package, ClipboardList, X, Info, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import FormModal from '../components/FormModal';

// ---- normalize helpers (defensive against snake/camel/backref shapes)
const norm = (d = {}) => ({
  id: d.id ?? d.ID ?? null,
  order_id: d.order_id ?? d.orderId ?? d.order?.id ?? null,
  driver_id: d.driver_id ?? d.driverId ?? d.driver?.id ?? null,
  order: d.order ?? null,
  driver: d.driver ?? null,
  deliveryDate: d.deliveryDate ?? d.delivery_date ?? null,
  deliveryStatus: d.deliveryStatus ?? d.delivery_status ?? null,
  deliveryAddress: d.deliveryAddress ?? d.delivery_address ?? null,
});

const sortByLabel = (a, b) => a.label.localeCompare(b.label);

function DeliveryCard({ d, onEdit, onDelete, onView }) {
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
      </div>
    </div>
  );
}

export default function DeliveriesPage() {
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

  // modal
  const [openForm, setOpenForm] = useState(false);
  const [editRow, setEditRow] = useState(null);

  // details modal
  const [inspect, setInspect] = useState(null);

  // permissions / lazy orders loading
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersErr, setOrdersErr] = useState('');
  const [canManage, setCanManage] = useState(true); // becomes false if /orders is forbidden

  // -------- fetch public data only on load (deliveries + drivers)
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

  useEffect(() => { fetchPublic(); }, []);

  // -------- lazy load orders (admin-only). If forbidden, disable create/edit.
  async function ensureOrdersLoaded(currentOrderId) {
    if (orders.length > 0 || ordersLoading) return true;
    try {
      setOrdersErr('');
      setOrdersLoading(true);
      const r = await api.get('/orders'); // admin-only per backend
      const data = Array.isArray(r?.data?.data) ? r.data.data : (r?.data || []);
      setOrders(data);
      setCanManage(true);
      return true;
    } catch (e) {
      const code = e?.response?.status;
      if (code === 403) {
        setCanManage(false);
        setOrdersErr('Creating/updating deliveries requires admin access (orders list is restricted).');
        // fallback: if editing, at least allow the existing order id to show in the select
        if (currentOrderId && !orders.find(o => String(o?.id) === String(currentOrderId))) {
          setOrders([{ id: currentOrderId }]);
        }
      } else {
        setOrdersErr(e?.response?.data?.message || e?.message || 'Failed to load orders');
      }
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
    { name: 'order_id',  type: 'select', label: 'Order',  required: true, options: orderOptions },
    { name: 'driver_id', type: 'select', label: 'Driver', required: true, options: driverOptions },
  ]), [orderOptions, driverOptions]);

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

  // submit
  async function handleSubmit(form) {
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

  // open create/edit: make sure orders are loaded (or show warning if restricted)
  async function openCreate() {
    const ok = await ensureOrdersLoaded();
    if (!ok) return; // if completely failed, don’t open the form
    setEditRow(null);
    setOpenForm(true);
  }
  async function openEdit(row) {
    const ok = await ensureOrdersLoaded(row?.order_id);
    if (!ok) {
      // allow editing *driver only* fallback? For now, bail out to avoid a blank select list.
      return;
    }
    setEditRow(row);
    setOpenForm(true);
  }

  return (
    <div className="space-y-5">
      {/* Header / controls */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Deliveries</h1>
            <p className="text-sm text-slate-500">Link orders to drivers. Create, edit, filter and inspect.</p>
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

            {/* new */}
            <button
              onClick={openCreate}
              disabled={!canManage}
              title={!canManage ? 'Admin access required (orders are restricted)' : ''}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md
                ${canManage ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-slate-300 cursor-not-allowed'}`}
            >
              <Plus size={16} /> New Delivery
            </button>
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
              onView={(row)=> setInspect(row)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
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
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={()=> setInspect(null)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <button
              onClick={()=> setInspect(null)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                <ClipboardList size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Delivery #{inspect.id ?? '—'}</div>
                <div className="text-xs text-slate-500">Quick overview</div>
              </div>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="rounded-xl border bg-slate-50 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Order</div>
                <div className="text-slate-800">
                  #{inspect.order?.id ?? inspect.order_id ?? '—'} {inspect.order?.product?.productName ? `• ${inspect.order.product.productName}` : ''}
                  {inspect.order?.customer?.fullname ? ` • ${inspect.order.customer.fullname}` : ''}
                </div>
              </div>
              <div className="rounded-xl border bg-slate-50 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Driver</div>
                <div className="text-slate-800">
                  {inspect.driver?.user?.fullname || inspect.driver?.driverName || `#${inspect.driver_id ?? '—'}`}
                  {inspect.driver?.phone ? ` • ${inspect.driver.phone}` : ''}
                </div>
              </div>

              {(inspect.deliveryDate || inspect.deliveryStatus || inspect.deliveryAddress) && (
                <div className="rounded-xl border bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Meta</div>
                  <div className="text-slate-800 space-y-1">
                    {inspect.deliveryStatus && <div>Status: {inspect.deliveryStatus}</div>}
                    {inspect.deliveryDate && <div>Date: {new Date(inspect.deliveryDate).toLocaleString()}</div>}
                    {inspect.deliveryAddress && <div>Address: {inspect.deliveryAddress}</div>}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={()=> setInspect(null)}
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