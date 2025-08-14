import { useState } from 'react';
import { api } from '../utils/api';

/* UI helpers */
function Panel({ title, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
      <div className="mb-3 text-sm font-semibold text-slate-700">{title}</div>
      {children}
    </div>
  );
}
function Button({ children, className = '', ...p }) {
  return <button {...p} className={`rounded-xl bg-slate-900 text-white px-3 py-2 text-sm hover:opacity-95 ${className}`}>{children}</button>;
}
function Input({ onEnter, className = '', ...p }) {
  return (
    <input
      {...p}
      onKeyDown={(e)=> e.key==='Enter' && onEnter?.()}
      className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 ${className}`}
    />
  );
}
function List({ rows = [], fields = [], empty }) {
  if (!rows?.length) return <div className="mt-2 text-sm text-slate-500">{empty}</div>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr>{fields.map(f => <th key={f} className="px-3 py-2 text-left text-slate-600">{f}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {fields.map(f => <td key={f} className="px-3 py-2 text-slate-700">{String((r && r[f]) ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Pre({ obj, empty }) {
  if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) return <div className="mt-2 text-sm text-slate-500">{empty}</div>;
  return <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-slate-900/90 p-3 text-xs text-emerald-200">{JSON.stringify(obj, null, 2)}</pre>;
}
function ErrorMsg({ err }) { return err ? <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div> : null; }

export default function UtilitiesPanel({ kind }) {
  // all hooks at top level (never conditional)
  const [state, setState] = useState({});
  const [rows, setRows]   = useState([]);
  const [obj, setObj]     = useState(null);
  const [ok, setOk]       = useState('');
  const [err, setErr]     = useState('');

  const norm = (r) => (r && r.data && (r.data.data ?? r.data)) || [];

  const run = (fn) => async () => {
    setErr(''); setOk(''); setObj(null); setRows([]);
    try { await fn(); } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message || 'Request failed';
      setErr(msg);
    }
  };

  switch (kind) {
    case 'categories':
      return (
        <Panel title="Category Stats">
          <Button onClick={run(async ()=>{ const r = await api.get('/categories/stats/product-count'); setRows(norm(r)); })}>
            Load product counts
          </Button>
          <List rows={rows} fields={['categoryName','productCount']} empty="No stats yet." />
          <ErrorMsg err={err} />
        </Panel>
      );

    case 'drivers':
      return (
        <Panel title="Driver Stats & Search">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={run(async ()=>{ const r = await api.get('/drivers/stats/delivery-count'); setRows(norm(r)); })}>
              Delivery counts
            </Button>
            <Input placeholder="Search name/phone" value={state.q || ''} onChange={(e)=> setState(s=>({...s, q: e.target.value}))}
              onEnter={run(async ()=>{ const r = await api.get('/drivers/search', { params: { query: (state.q || '').trim() } }); setRows(norm(r)); })}
            />
            <Button onClick={run(async ()=>{ const r = await api.get('/drivers/search', { params: { query: (state.q || '').trim() } }); setRows(norm(r)); })}>
              Search
            </Button>
          </div>
          <List rows={rows} fields={['id','driverName','phone','deliveries']} empty="No results." />
          <ErrorMsg err={err} />
        </Panel>
      );

    case 'inventories':
      return (
        <Panel title="Inventory Search & Stats">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Search name/address" value={state.q || ''} onChange={(e)=> setState(s=>({...s, q: e.target.value}))}
              onEnter={run(async ()=>{ const r = await api.get('/inventories/search', { params: { query: (state.q || '').trim() } }); setRows(norm(r)); })}
            />
            <Button onClick={run(async ()=>{ const r = await api.get('/inventories/search', { params: { query: (state.q || '').trim() } }); setRows(norm(r)); })}>
              Search
            </Button>
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <Input placeholder="Inventory ID for stats" value={state.invId || ''} onChange={(e)=> setState(s=>({...s, invId: e.target.value}))}
              onEnter={run(async ()=>{ const r = await api.get(`/inventories/${Number(state.invId)}/stats`); setObj((r && r.data && (r.data.data ?? r.data)) || {}); })}
            />
            <Button onClick={run(async ()=>{ const r = await api.get(`/inventories/${Number(state.invId)}/stats`); setObj((r && r.data && (r.data.data ?? r.data)) || {}); })}>
              Get stats
            </Button>
          </div>

          <Pre obj={obj} empty="No stats loaded yet." />
          <ErrorMsg err={err} />
        </Panel>
      );

    case 'customers':
      return (
        <Panel title="Customer Search">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Search name/phone" value={state.q || ''} onChange={(e)=> setState(s=>({...s, q: e.target.value}))}
              onEnter={run(async ()=>{ const r = await api.get('/customers/search', { params: { query: (state.q || '').trim() } }); setRows(norm(r)); })}
            />
            <Button onClick={run(async ()=>{ const r = await api.get('/customers/search', { params: { query: (state.q || '').trim() } }); setRows(norm(r)); })}>
              Search
            </Button>
          </div>
          <List rows={rows} fields={['id','customerName','email','phone']} empty="No results." />
          <ErrorMsg err={err} />
        </Panel>
      );

    case 'stock':
      return (
        <Panel title="Stock Utilities">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Kg threshold" value={state.kg || '20'} onChange={(e)=> setState(s=>({...s, kg: e.target.value}))} />
            <Input placeholder="Bori threshold" value={state.bori || '10'} onChange={(e)=> setState(s=>({...s, bori: e.target.value}))} />
            <Button onClick={run(async ()=>{ const r = await api.get('/stock/low', {
              params: { kgThreshold: Number(state.kg || 20), boriThreshold: Number(state.bori || 10) }
            }); setRows(norm(r)); })}>
              Low stock
            </Button>
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <Input placeholder="Product ID" value={state.pid || ''} onChange={(e)=> setState(s=>({...s, pid: e.target.value}))} />
            <Button onClick={run(async ()=>{ const r = await api.get(`/stock/product/${Number(state.pid)}`); setRows(norm(r)); })}>
              By product
            </Button>

            <Input placeholder="Inventory ID" value={state.iid || ''} onChange={(e)=> setState(s=>({...s, iid: e.target.value}))} />
            <Button onClick={run(async ()=>{ const r = await api.get(`/stock/inventory/${Number(state.iid)}`); setRows(norm(r)); })}>
              By inventory
            </Button>
          </div>

          <List rows={rows} fields={['id','product_id','inventory_id','stockKg','stockBori']} empty="No results." />
          <ErrorMsg err={err} />
        </Panel>
      );

    case 'deliveries':
      return (
        <Panel title="Deliveries Filters">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Driver ID" value={state.did || ''} onChange={(e)=> setState(s=>({...s, did: e.target.value}))} />
            <Button onClick={run(async ()=>{ const r = await api.get(`/deliveries/driver/${Number(state.did)}`); setRows(norm(r)); })}>
              By driver
            </Button>

            <Input placeholder="Order ID" value={state.oid || ''} onChange={(e)=> setState(s=>({...s, oid: e.target.value}))} />
            <Button onClick={run(async ()=>{ const r = await api.get(`/deliveries/order/${Number(state.oid)}`); setRows(norm(r)); })}>
              By order
            </Button>
          </div>
          <List rows={rows} fields={['id','orderId','driverId','deliveryStatus','deliveryDate']} empty="No results." />
          <ErrorMsg err={err} />
        </Panel>
      );

    case 'products':
      return (
        <Panel title="Products by Category">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Category ID" value={state.cid || ''} onChange={(e)=> setState(s=>({...s, cid: e.target.value}))} />
            <Button onClick={run(async ()=>{ const r = await api.get(`/products/category/${Number(state.cid)}`); setRows(norm(r)); })}>
              Load
            </Button>
          </div>
          <List rows={rows} fields={['id','productName','category_id','ratePerKg','ratePerBori']} empty="No results." />
          <ErrorMsg err={err} />
        </Panel>
      );

    case 'users':
      return (
        <Panel title="User Utilities">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="User ID" value={state.uid || ''} onChange={(e)=> setState(s=>({...s, uid: e.target.value}))} />
            <Input placeholder="New Password" type="password" value={state.np || ''} onChange={(e)=> setState(s=>({...s, np: e.target.value}))} />
            <Button onClick={run(async ()=>{ await api.put(`/users/${Number(state.uid)}/change-password`, { newPassword: state.np }); setOk('Password updated.'); })}>
              Change password
            </Button>
          </div>
          {ok && <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
          <ErrorMsg err={err} />
        </Panel>
      );

    default:
      return null;
  }
}