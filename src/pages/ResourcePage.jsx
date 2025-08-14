import { useMemo, useState } from 'react';
import { Search, RefreshCw, Plus } from 'lucide-react';
import useCrud from '../utils/useCrud';
import SimpleTable from '../components/SimpleTable';
import FormModal from '../components/FormModal';
import UtilitiesPanel from '../components/UtilitiesPanel';

/** CRUD fields strictly match your API docs (no extras) */
const CONFIG = {
  users: {
    path: '/users',
    create: [
      { name: 'fullname', type: 'text',     label: 'Full Name', required: true },
      { name: 'email',    type: 'email',    label: 'Email',     required: true },
      { name: 'password', type: 'password', label: 'Password',  required: true },
      { name: 'role',     type: 'select',   label: 'Role',      required: true, options: ['admin','superadmin'] },
    ],
    update: [
      { name: 'fullname', type: 'text',   label: 'Full Name', required: true },
      { name: 'email',    type: 'email',  label: 'Email',     required: true },
      { name: 'role',     type: 'select', label: 'Role',      required: true, options: ['admin','superadmin'] },
    ],
    cols: ['id','fullname','email','role','createdAt','updatedAt'],
    utilities: 'users',
  },

  products: {
    path: '/products',
    create: [
      { name: 'productName', type: 'text',   label: 'Product Name', required: true },
      { name: 'ratePerKg',   type: 'number', step:'0.01', label: 'Rate per Kg',   required: true },
      { name: 'ratePerBori', type: 'number', step:'0.01', label: 'Rate per Bori', required: true },
      { name: 'description', type: 'text',   label: 'Description' },
      { name: 'category_id', type: 'number', label: 'Category ID', required: true },
    ],
    update: [
      { name: 'productName', type: 'text',   label: 'Product Name', required: true },
      { name: 'ratePerKg',   type: 'number', step:'0.01', label: 'Rate per Kg',   required: true },
      { name: 'ratePerBori', type: 'number', step:'0.01', label: 'Rate per Bori', required: true },
      { name: 'description', type: 'text',   label: 'Description' },
      { name: 'category_id', type: 'number', label: 'Category ID', required: true },
    ],
    cols: ['id','productName','ratePerKg','ratePerBori','description','category_id','createdAt','updatedAt'],
    utilities: 'products',
  },

  categories: {
    path: '/categories',
    create: [
      { name: 'categoryName', type: 'text', label: 'Category Name', required: true },
      { name: 'description',  type: 'text', label: 'Description' },
    ],
    update: [
      { name: 'categoryName', type: 'text', label: 'Category Name', required: true },
      { name: 'description',  type: 'text', label: 'Description' },
    ],
    cols: ['id','categoryName','description','createdAt','updatedAt'],
    utilities: 'categories',
  },

  inventories: {
    path: '/inventories',
    create: [
      { name: 'inventoryName', type: 'text', label: 'Inventory Name', required: true },
      { name: 'address',       type: 'text', label: 'Address' },
      { name: 'contactNumber', type: 'text', label: 'Contact Number' },
    ],
    update: [
      { name: 'inventoryName', type: 'text', label: 'Inventory Name', required: true },
      { name: 'address',       type: 'text', label: 'Address' },
      { name: 'contactNumber', type: 'text', label: 'Contact Number' },
    ],
    cols: ['id','inventoryName','address','contactNumber','createdAt','updatedAt'],
    searchPath: '/inventories/search',
    utilities: 'inventories',
  },

  stock: {
    path: '/stock',
    create: [
      { name: 'stockKg',      type: 'number', step:'0.01', label: 'Stock (Kg)',   required: true },
      { name: 'stockBori',    type: 'number', step:'0.01', label: 'Stock (Bori)', required: true },
      { name: 'product_id',   type: 'number', label: 'Product ID',   required: true },
      { name: 'inventory_id', type: 'number', label: 'Inventory ID', required: true },
    ],
    update: [
      { name: 'stockKg',      type: 'number', step:'0.01', label: 'Stock (Kg)',   required: true },
      { name: 'stockBori',    type: 'number', step:'0.01', label: 'Stock (Bori)', required: true },
      { name: 'product_id',   type: 'number', label: 'Product ID',   required: true },
      { name: 'inventory_id', type: 'number', label: 'Inventory ID', required: true },
    ],
    cols: ['id','stockKg','stockBori','product_id','inventory_id','createdAt','updatedAt'],
    utilities: 'stock',
  },

  customers: {
    path: '/customers',
    create: [
      { name: 'customerName', type: 'text',  label: 'Customer Name', required: true },
      { name: 'email',        type: 'email', label: 'Email' },
      { name: 'phone',        type: 'text',  label: 'Phone' },
      { name: 'address',      type: 'text',  label: 'Address' },
    ],
    update: [
      { name: 'customerName', type: 'text',  label: 'Customer Name', required: true },
      { name: 'email',        type: 'email', label: 'Email' },
      { name: 'phone',        type: 'text',  label: 'Phone' },
      { name: 'address',      type: 'text',  label: 'Address' },
    ],
    cols: ['id','customerName','email','phone','address','createdAt','updatedAt'],
    searchPath: '/customers/search',
    utilities: 'customers',
  },

  drivers: {
    path: '/drivers',
    create: [
      { name: 'driverName',    type: 'text', label: 'Driver Name', required: true },
      { name: 'licenseNumber', type: 'text', label: 'License Number' },
      { name: 'phone',         type: 'text', label: 'Phone' },
    ],
    update: [
      { name: 'driverName',    type: 'text', label: 'Driver Name', required: true },
      { name: 'licenseNumber', type: 'text', label: 'License Number' },
      { name: 'phone',         type: 'text', label: 'Phone' },
    ],
    cols: ['id','driverName','licenseNumber','phone','createdAt','updatedAt'],
    searchPath: '/drivers/search',
    utilities: 'drivers',
  },

  deliveries: {
    path: '/deliveries',
    create: [
      { name: 'orderId',         type: 'number', label: 'Order ID', required: true },
      { name: 'driverId',        type: 'number', label: 'Driver ID', required: true },
      { name: 'deliveryDate',    type: 'date',   label: 'Delivery Date' },
      { name: 'deliveryStatus',  type: 'text',   label: 'Delivery Status' },
      { name: 'deliveryAddress', type: 'text',   label: 'Delivery Address' },
    ],
    update: [
      { name: 'orderId',         type: 'number', label: 'Order ID', required: true },
      { name: 'driverId',        type: 'number', label: 'Driver ID', required: true },
      { name: 'deliveryDate',    type: 'date',   label: 'Delivery Date' },
      { name: 'deliveryStatus',  type: 'text',   label: 'Delivery Status' },
      { name: 'deliveryAddress', type: 'text',   label: 'Delivery Address' },
    ],
    cols: ['id','orderId','driverId','deliveryDate','deliveryStatus','deliveryAddress','createdAt','updatedAt'],
    utilities: 'deliveries',
  },
};

const toNum = (v) => (v === '' || v === null || v === undefined) ? undefined : Number(v);
function sanitize(fields, payload) {
  const allow = new Set(fields.map(f => f.name));
  const numeric = new Set(fields.filter(f => f.type === 'number').map(f => f.name));
  const out = {};
  Object.keys(payload || {}).forEach(k => {
    if (!allow.has(k)) return;
    const val = payload[k];
    if (val === '' || val === undefined || val === null) return;
    out[k] = numeric.has(k) ? toNum(val) : val;
  });
  return out;
}

export default function ResourcePage({ resourceKey, title }) {
  // hooks must ALWAYS be called — no early returns before this
  const cfg = CONFIG[resourceKey] || { path:'/invalid', create:[], update:[], cols:[] };

  const { rows, loading, err, refresh, create, update, remove, search } = useCrud(
    cfg.path,
    cfg.searchPath
  );
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [q, setQ] = useState('');

  const fields = useMemo(() => (editRow ? cfg.update : cfg.create), [cfg, editRow]);

  async function doSearch(v){
    setQ(v);
    if (!cfg.searchPath || !v.trim()) { refresh(); return; }
    await search(v.trim());
  }

  async function onSubmit(form){
    const payload = sanitize(fields, form);
    if (editRow?.id) await update(editRow.id, payload);
    else await create(payload);
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">Manage {title.toLowerCase()}.</p>
          </div>

          <div className="flex items-center gap-2">
            {cfg.searchPath && (
              <div className="hidden sm:flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
                <Search size={16} className="text-slate-400" />
                <input
                  value={q}
                  onChange={(e)=>doSearch(e.target.value)}
                  placeholder={`Search ${title.toLowerCase()}…`}
                  className="w-52 bg-transparent outline-none text-sm"
                />
              </div>
            )}
            <button
              onClick={()=>refresh()}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={()=>{ setEditRow(null); setOpen(true); }}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md inline-flex items-center gap-2"
            >
              <Plus size={16} /> New {title.slice(0,-1)}
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            {err}
          </div>
        )}
      </div>

      {/* table */}
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
      ) : (
        <SimpleTable
          cols={cfg.cols}
          rows={rows}
          onEdit={(r)=>{ setEditRow(r); setOpen(true); }}
          onDelete={(r)=>{ if (window.confirm('Delete this record?')) remove(r.id).catch(e=>alert(e?.response?.data?.message || e.message)); }}
        />
      )}

      {/* utilities (safe: separate component, no conditional hooks) */}
      {cfg.utilities ? <UtilitiesPanel kind={cfg.utilities} /> : null}

      {/* modal */}
      <FormModal
        title={(editRow ? 'Edit ' : 'Create ') + (title.slice(0,-1))}
        open={open}
        onClose={()=>setOpen(false)}
        fields={fields}
        initial={editRow || {}}
        onSubmit={onSubmit}
      />
    </div>
  );
}