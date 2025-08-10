import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Boxes, Package, MapPinned, AlertTriangle, Plus, Edit, Trash2, RefreshCw, X, Search, SlidersHorizontal } from 'lucide-react';
import { API_URL, authHeaders as h, Field } from '../utils/api';

const roleOK = (a)=>{ const r=(JSON.parse(localStorage.getItem('auth_user')||'{}')?.role||'').toLowerCase(); if(a==='delete')return r==='superadmin'; if(a==='edit'||a==='create')return r==='admin'||r==='superadmin'; return true; };

export default function StockPage(){
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(''); const [notice,setNotice]=useState('');
  const [showCreate,setShowCreate]=useState(false); const [showEdit,setShowEdit]=useState(false);
  const [saving,setSaving]=useState(false); const [editingId,setEditingId]=useState(null); const [deleting,setDeleting]=useState(null);
  const [form,setForm]=useState({ productId:'', inventoryId:'', stockKg:'', stockBori:'' });

  const [productId,setProductId]=useState(''); const [inventoryId,setInventoryId]=useState('');
  const [lowKg,setLowKg]=useState(''); const [lowBori,setLowBori]=useState('');
  const [q,setQ]=useState('');

  useEffect(()=>{ refresh(); },[]);
  async function refresh(){
    try{ setLoading(true); setErr('');
      const r=await axios.get(`${API_URL}/stock`,{headers:h()});
      const data=(r.data?.data??r.data)||[]; setRows(Array.isArray(data)?data:[]);
    }catch(e){ setErr(e?.response?.data?.message||'Failed to load stock'); setRows([]);}
    finally{ setLoading(false); }
  }

  async function filterFetch(){
    try{ setLoading(true); setErr('');
      let path=`/stock`;
      if(productId) path=`/stock/product/${productId}`;
      else if(inventoryId) path=`/stock/inventory/${inventoryId}`;
      const r=await axios.get(`${API_URL}${path}`,{headers:h()});
      const data=(r.data?.data??r.data)||[]; setRows(Array.isArray(data)?data:[]);
    }catch(e){ setErr(e?.response?.data?.message||'Filter failed'); } finally{ setLoading(false); }
  }
  async function lowFetch(){
    try{ setLoading(true); setErr('');
      const r=await axios.get(`${API_URL}/stock/low`,{headers:h(),params:{kgThreshold:lowKg||undefined, boriThreshold:lowBori||undefined}});
      const data=(r.data?.data??r.data)||[]; setRows(Array.isArray(data)?data:[]);
    }catch(e){ setErr(e?.response?.data?.message||'Low-stock query failed'); } finally{ setLoading(false); }
  }

  function openCreate(){ setForm({productId:'',inventoryId:'',stockKg:'',stockBori:''}); setShowCreate(true); }
  function openEdit(r){ setEditingId(r.id); setForm({productId:r.productId||r.product_id||'', inventoryId:r.inventoryId||r.inventory_id||'', stockKg:r.stockKg||r.stock_kg||'', stockBori:r.stockBori||r.stock_bori||''}); setShowEdit(true); }
  const payload=f=>({ productId:Number(f.productId)||undefined, product_id:Number(f.productId)||undefined, inventoryId:Number(f.inventoryId)||undefined, inventory_id:Number(f.inventoryId)||undefined, stockKg: Number(f.stockKg)||0, stockBori: Number(f.stockBori)||0, stock_kg:Number(f.stockKg)||undefined, stock_bori:Number(f.stockBori)||undefined });

  async function onCreate(e){ e.preventDefault(); try{ setSaving(true); setErr(''); setNotice('');
    await axios.post(`${API_URL}/stock`, payload(form), {headers:h()}); setShowCreate(false); await refresh(); setNotice('Stock record created.');
  }catch(e){ setErr(e?.response?.data?.message||'Create failed'); } finally{ setSaving(false); } }
  async function onEdit(e){ e.preventDefault(); try{ setSaving(true); setErr(''); setNotice('');
    await axios.put(`${API_URL}/stock/${editingId}`, payload(form), {headers:h()}); setShowEdit(false); setEditingId(null); await refresh(); setNotice('Stock updated.');
  }catch(e){ setErr(e?.response?.data?.message||'Update failed'); } finally{ setSaving(false); } }
  async function onDelete(id){ if(!window.confirm('Delete stock record?'))return;
    try{ setDeleting(id); setErr(''); setNotice('');
      await axios.delete(`${API_URL}/stock/${id}`,{headers:h()}); await refresh(); setNotice('Stock deleted.');
    }catch(e){ setErr(e?.response?.data?.message||'Delete failed'); } finally{ setDeleting(null); } }

  const filtered = useMemo(()=> rows.filter(r => JSON.stringify(r).toLowerCase().includes(q.trim().toLowerCase())),[rows,q]);

  return (
    <div className="animate-fade-in">
      <Header title="Stock" subtitle="Inventory quantities." onRefresh={refresh} onCreate={roleOK('create')?openCreate:null}/>

      {err && <Banner kind="error">{err}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input placeholder="Find in table…" value={q} onChange={e=>setQ(e.target.value)}
                   className="w-56 rounded-2xl border border-slate-200 bg-white/80 pl-9 pr-3 py-2 text-sm backdrop-blur"/>
          </div>
          <button onClick={filterFetch} className="pill bg-slate-900/90 text-white hover:bg-slate-900"><SlidersHorizontal size={14}/> Apply Filters</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Field label="Product ID"><input value={productId} onChange={e=>setProductId(e.target.value)} className="w-28 rounded-xl border border-slate-200 px-2 py-1.5"/></Field>
          <Field label="Inventory ID"><input value={inventoryId} onChange={e=>setInventoryId(e.target.value)} className="w-28 rounded-xl border border-slate-200 px-2 py-1.5"/></Field>
          <div className="mx-2 h-6 w-px bg-slate-200 hidden lg:block"/>
          <Field label="Low kg"><input value={lowKg} onChange={e=>setLowKg(e.target.value)} className="w-24 rounded-xl border border-slate-200 px-2 py-1.5"/></Field>
          <Field label="Low bori"><input value={lowBori} onChange={e=>setLowBori(e.target.value)} className="w-24 rounded-xl border border-slate-200 px-2 py-1.5"/></Field>
          <button onClick={lowFetch} className="pill bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-700 hover:to-red-700"><AlertTriangle size={14}/> Low Stock</button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 backdrop-blur">
        {loading ? <Loading/> : filtered.length===0 ? <Empty text="No stock records."/> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">Inventory</th>
                  <th className="px-4 py-2 text-left">Kg</th>
                  <th className="px-4 py-2 text-left">Bori</th>
                  <th className="px-4 py-2 text-left w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r=>(
                  <tr key={r.id} className="hover:bg-white/60">
                    <td className="px-4 py-2">{r.id}</td>
                    <td className="px-4 py-2 inline-flex items-center gap-2"><Package size={14}/>{r.productId||r.product_id}</td>
                    <td className="px-4 py-2 inline-flex items-center gap-2"><MapPinned size={14}/>{r.inventoryId||r.inventory_id}</td>
                    <td className="px-4 py-2">{r.stockKg??r.stock_kg??'—'}</td>
                    <td className="px-4 py-2">{r.stockBori??r.stock_bori??'—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {roleOK('edit')   && <button onClick={()=>openEdit(r)} className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-1.5"><Edit size={14}/> Edit</button>}
                        {roleOK('delete') && <button onClick={()=>onDelete(r.id)} disabled={deleting===r.id} className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 inline-flex items-center gap-1.5 disabled:opacity-60"><Trash2 size={14}/> {deleting===r.id?'Deleting…':'Delete'}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <StockModal title="Create Stock" form={form} setForm={setForm} onCancel={()=>setShowCreate(false)} onSubmit={onCreate} saving={saving}/>}
      {showEdit   && <StockModal title="Edit Stock"   form={form} setForm={setForm} onCancel={()=>{setShowEdit(false); setEditingId(null);}} onSubmit={onEdit} saving={saving}/>}
    </div>
  );
}

const Header = ({title,subtitle,onRefresh,onCreate}) => (
  <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5">
    <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-400/30 to-cyan-400/30 blur-2xl" />
    <div className="flex items-end justify-between">
      <div><h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1><p className="text-slate-500 text-sm">{subtitle}</p></div>
      <div className="flex gap-2">
        <button onClick={onRefresh} className="pill bg-slate-900/90 text-white hover:bg-slate-900"><RefreshCw size={14}/> Refresh</button>
        {onCreate && <button onClick={onCreate} className="pill bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-700 hover:to-cyan-700"><Plus size={16}/> New</button>}
      </div>
    </div>
  </div>
);
const Banner=({kind,children})=>(<div className={`mb-3 rounded-xl border px-4 py-3 ${kind==='error'?'border-rose-200 bg-rose-50 text-rose-700':'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>);
const Loading=()=> (<div className="flex items-center justify-center py-16 text-slate-500"><div className="h-5 w-5 mr-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> Loading…</div>);
const Empty=({text})=> (<div className="p-10 text-center text-slate-600">{text}</div>);

function StockModal({title,form,setForm,onCancel,onSubmit,saving}){
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-400/20 to-cyan-400/20 blur-2xl" />
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-1 hover:opacity-70" onClick={onCancel}><X size={18}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Product ID" required><input type="number" className="w-full rounded-2xl border border-slate-200 px-3 py-2" value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})} required/></Field>
            <Field label="Inventory ID" required><input type="number" className="w-full rounded-2xl border border-slate-200 px-3 py-2" value={form.inventoryId} onChange={e=>setForm({...form,inventoryId:e.target.value})} required/></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Stock (kg)"><input type="number" step="0.01" className="w-full rounded-2xl border border-slate-200 px-3 py-2" value={form.stockKg} onChange={e=>setForm({...form,stockKg:e.target.value})}/></Field>
            <Field label="Stock (bori)"><input type="number" step="0.01" className="w-full rounded-2xl border border-slate-200 px-3 py-2" value={form.stockBori} onChange={e=>setForm({...form,stockBori:e.target.value})}/></Field>
          </div>
          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-700 hover:to-cyan-700 disabled:opacity-60">{saving?'Saving…':'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}