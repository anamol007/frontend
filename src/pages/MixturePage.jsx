// src/pages/MixturePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Beaker, Plus, Trash2, RefreshCw } from "lucide-react";
import { api } from "../utils/api";

/**
 * MixturePage
 * - dropdowns for inventory / product / unit
 * - separate mixIn (inputs) and mixOut (outputs) sections
 * - preview/outcome shown for both sections
 * - create, list, delete
 * - uses /mixtures endpoint
 * - shows inline errors under dropdowns/inputs
 */
export default function MixturePage() {
  // data lists
  const [inventories, setInventories] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);

  // mixtures list
  const [mixtures, setMixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // modal / create form
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // form state: inventory chosen + notes + arrays for inputs/outputs
  const defaultInput = { productId: "", unitId: "", qty: "" };
  const defaultOutput = { productId: "", unitId: "", qty: "" };

  const [form, setForm] = useState({
    inventoryId: "",
    notes: "",
    inputs: [{ ...defaultInput }],
    outputs: [{ ...defaultOutput }],
  });

  // inline errors state
  const [formErrors, setFormErrors] = useState({
    inventory: "",
    inputs: [],
    outputs: [],
    general: "",
  });

  /* ---------- fetch reference lists & mixtures ---------- */
  async function fetchReferences() {
    try {
      const [invRes, prodRes, unitRes] = await Promise.allSettled([
        api.get("/inventory"),
        api.get("/products"),
        api.get("/units"),
      ]);

      const inv =
        invRes.status === "fulfilled"
          ? (invRes.value?.data?.data ?? invRes.value?.data ?? [])
          : [];
      const prod =
        prodRes.status === "fulfilled"
          ? (prodRes.value?.data?.data ?? prodRes.value?.data ?? [])
          : [];
      const unit =
        unitRes.status === "fulfilled"
          ? (unitRes.value?.data?.data ?? unitRes.value?.data ?? [])
          : [];

      setInventories(Array.isArray(inv) ? inv : []);
      setProducts(Array.isArray(prod) ? prod : []);
      setUnits(Array.isArray(unit) ? unit : []);
    } catch (e) {
      // non-fatal
    }
  }

  async function fetchMixtures() {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/mixtures");
      const data = res?.data?.data ?? res?.data ?? [];
      setMixtures(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load mixtures");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReferences();
    fetchMixtures();
  }, []);

  /* ---------- helper to update form arrays ---------- */
  function updateInput(idx, key, value) {
    setForm((f) => {
      const inputs = f.inputs.slice();
      inputs[idx] = { ...inputs[idx], [key]: value };
      return { ...f, inputs };
    });
    // clear specific error for this field
    setFormErrors(prev => {
      const next = { ...prev, inputs: prev.inputs.slice() };
      next.inputs[idx] = ""; // clear error message for this input row
      next.general = "";
      return next;
    });
  }
  function updateOutput(idx, key, value) {
    setForm((f) => {
      const outputs = f.outputs.slice();
      outputs[idx] = { ...outputs[idx], [key]: value };
      return { ...f, outputs };
    });
    // clear specific error for this field
    setFormErrors(prev => {
      const next = { ...prev, outputs: prev.outputs.slice() };
      next.outputs[idx] = "";
      next.general = "";
      return next;
    });
  }
  function addInput() {
    setForm((f) => ({ ...f, inputs: [...f.inputs, { ...defaultInput }] }));
    setFormErrors(prev => ({ ...prev, inputs: [...(prev.inputs || []), ""] }));
  }
  function addOutput() {
    setForm((f) => ({ ...f, outputs: [...f.outputs, { ...defaultOutput }] }));
    setFormErrors(prev => ({ ...prev, outputs: [...(prev.outputs || []), ""] }));
  }
  function removeInput(idx) {
    setForm((f) => ({ ...f, inputs: f.inputs.filter((_, i) => i !== idx) }));
    setFormErrors(prev => {
      const inputs = (prev.inputs || []).slice();
      inputs.splice(idx, 1);
      return { ...prev, inputs };
    });
  }
  function removeOutput(idx) {
    setForm((f) => ({ ...f, outputs: f.outputs.filter((_, i) => i !== idx) }));
    setFormErrors(prev => {
      const outputs = (prev.outputs || []).slice();
      outputs.splice(idx, 1);
      return { ...prev, outputs };
    });
  }

  /* ---------- create ---------- */
  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    setFormErrors({ inventory: "", inputs: [], outputs: [], general: "" });
    setCreating(true);

    try {
      // basic validation with inline errors
      const errors = { inventory: "", inputs: [], outputs: [], general: "" };
      let hasError = false;

      if (!form.inventoryId) {
        errors.inventory = "Please select an inventory.";
        hasError = true;
      }

      const inputsClean = [];
      for (let i = 0; i < form.inputs.length; i++) {
        const row = form.inputs[i] || {};
        if (!row.productId || !row.unitId || !row.qty) {
          errors.inputs[i] = "Select product, unit and qty.";
          hasError = true;
        } else if (Number(row.qty) <= 0) {
          errors.inputs[i] = "Qty must be > 0.";
          hasError = true;
        } else {
          errors.inputs[i] = "";
          inputsClean.push({
            productId: Number(row.productId),
            unitId: Number(row.unitId),
            qty: Number(row.qty),
            status: "mixIn",
          });
        }
      }

      const outputsClean = [];
      for (let i = 0; i < form.outputs.length; i++) {
        const row = form.outputs[i] || {};
        if (!row.productId || !row.unitId || !row.qty) {
          errors.outputs[i] = "Select product, unit and qty.";
          hasError = true;
        } else if (Number(row.qty) <= 0) {
          errors.outputs[i] = "Qty must be > 0.";
          hasError = true;
        } else {
          errors.outputs[i] = "";
          outputsClean.push({
            productId: Number(row.productId),
            unitId: Number(row.unitId),
            qty: Number(row.qty),
            status: "mixOut",
          });
        }
      }

      if (inputsClean.length === 0) {
        errors.general = errors.general || "Add at least one valid input (mixIn).";
        hasError = true;
      }
      if (outputsClean.length === 0) {
        errors.general = errors.general || "Add at least one valid output (mixOut).";
        hasError = true;
      }

      if (hasError) {
        setFormErrors(errors);
        setCreating(false);
        return;
      }

      const payload = {
        inventoryId: Number(form.inventoryId),
        notes: form.notes || "",
        productMixtures: [...inputsClean, ...outputsClean],
      };

      await api.post("/mixtures", payload);
      setOk("Mixture created.");
      setOpen(false);
      // reset
      setForm({
        inventoryId: "",
        notes: "",
        inputs: [{ ...defaultInput }],
        outputs: [{ ...defaultOutput }],
      });
      setFormErrors({ inventory: "", inputs: [], outputs: [], general: "" });
      await fetchMixtures();
    } catch (e) {
      // if backend validation returns field-level messages, try to reflect that
      const msg = e?.response?.data?.message || e?.message || "Create failed";
      setFormErrors(prev => ({ ...prev, general: msg }));
      setErr(msg);
    } finally {
      setCreating(false);
    }
  }

  /* ---------- delete ---------- */
  async function handleDelete(id) {
    if (!window.confirm("Delete this mixture? This will reverse associated stock entries.")) return;
    try {
      await api.delete(`/mixtures/${id}`);
      setOk("Mixture deleted.");
      fetchMixtures();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  /* ---------- helpers to resolve names for preview ---------- */
  const productMap = useMemo(() => {
    const m = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const unitMap = useMemo(() => {
    const m = {};
    for (const u of units) m[u.id] = u;
    return m;
  }, [units]);

  const inventoryMap = useMemo(() => {
    const m = {};
    for (const i of inventories) m[i.id] = i;
    return m;
  }, [inventories]);

  // live preview arrays for the create form
  const previewInputs = (form.inputs || []).filter((i) => i.productId && i.unitId && i.qty);
  const previewOutputs = (form.outputs || []).filter((o) => o.productId && o.unitId && o.qty);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_1px_0_rgba(255,255,255,.6),0_10px_30px_-12px_rgba(2,6,23,.25)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
              <Beaker size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Product Mixtures</h1>
              <p className="text-sm text-slate-500">Create mixtures (mixIn → mixOut) and automatically update stock.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setOpen(true); setErr(""); setOk(""); setFormErrors({ inventory: "", inputs: [], outputs: [], general: "" }); }}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              <Plus size={16}/> New Mixture
            </button>
            <button
              onClick={() => { fetchMixtures(); fetchReferences(); }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <RefreshCw size={16}/> Refresh
            </button>
          </div>
        </div>

        {err && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        {ok  && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-slate-500">Loading mixtures…</div>
      ) : mixtures.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/70 p-10 text-center text-slate-500">No mixtures found.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mixtures.map((m) => {
            const inputs = (m.productMixtures || []).filter(p => p.status === "mixIn");
            const outputs = (m.productMixtures || []).filter(p => p.status === "mixOut");
            return (
              <div key={m.id} className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{ inventoryMap[m.inventoryId]?.inventoryName || m.inventory?.inventoryName || "—" }</div>
                    <div className="text-xs text-slate-500">{ new Date(m.createdAt).toLocaleString() }</div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50">
                    <Trash2 size={16}/>
                  </button>
                </div>

                <div className="mt-3 text-sm text-slate-700 space-y-2">
                  <div>
                    <div className="text-xs text-slate-500">Inputs (mixIn)</div>
                    <div className="mt-1">{ inputs.length ? inputs.map(p => (
                      <div key={p.id || `${p.productId}-${p.unitId}`} className="text-sm">
                        • { (p.product?.productName || productMap[p.productId]?.productName) || `#${p.productId}` } — {p.qty} { (p.unit?.unitName || unitMap[p.unitId]?.unitName) || "" }
                      </div>
                    )) : <div className="text-xs text-slate-400">—</div> }</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Outputs (mixOut)</div>
                    <div className="mt-1">{ outputs.length ? outputs.map(p => (
                      <div key={p.id || `${p.productId}-${p.unitId}`} className="text-sm">
                        • { (p.product?.productName || productMap[p.productId]?.productName) || `#${p.productId}` } +{p.qty} { (p.unit?.unitName || unitMap[p.unitId]?.unitName) || "" }
                      </div>
                    )) : <div className="text-xs text-slate-400">—</div> }</div>
                  </div>

                  {m.notes && <div className="mt-2 text-xs text-slate-500">Note: {m.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-slate-900/45" onClick={() => setOpen(false)} />
          <div className="relative w-[min(980px,96vw)] bg-white rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Mixture</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-50">Close</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600">Inventory *</label>
                  <select
                    required
                    value={form.inventoryId}
                    onChange={(e) => { setForm(f => ({ ...f, inventoryId: e.target.value })); setFormErrors(prev => ({ ...prev, inventory: "" })); }}
                    className={`mt-1 w-full rounded-2xl border px-3 py-2 outline-none ${formErrors.inventory ? "border-rose-500" : "border-slate-300"}`}
                  >
                    <option value="">Select inventory…</option>
                    {inventories.map(inv => <option key={inv.id} value={inv.id}>{inv.inventoryName || inv.name || `#${inv.id}`}</option>)}
                  </select>
                  {formErrors.inventory && <div className="mt-1 text-xs text-rose-600">{formErrors.inventory}</div>}
                </div>

                <div>
                  <label className="text-sm text-slate-600">Notes</label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                    className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 outline-none"
                  />
                </div>
              </div>

              {/* general form-level error */}
              {formErrors.general && <div className="text-sm text-rose-600">{formErrors.general}</div>}

              {/* inputs / outputs sections side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Inputs */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Inputs (mixIn)</div>
                    <button type="button" onClick={addInput} className="text-sm rounded-full px-2 py-1 border">+ Add</button>
                  </div>

                  <div className="space-y-2">
                    {form.inputs.map((it, idx) => (
                      <div key={idx}>
                        <div className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 items-center">
                          <select required value={it.productId} onChange={(e) => updateInput(idx, "productId", e.target.value)} className={`rounded-2xl border px-2 py-1 ${formErrors.inputs[idx] ? "border-rose-500" : "border-slate-300"}`}>
                            <option value="">Product…</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.productName}</option>)}
                          </select>

                          <select required value={it.unitId} onChange={(e) => updateInput(idx, "unitId", e.target.value)} className={`rounded-2xl border px-2 py-1 ${formErrors.inputs[idx] ? "border-rose-500" : "border-slate-300"}`}>
                            <option value="">Unit…</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.unitName || u.name}</option>)}
                          </select>

                          <input required type="number" min="0" step="0.01" placeholder="Qty" value={it.qty} onChange={(e) => updateInput(idx, "qty", e.target.value)} className={`rounded-2xl border px-2 py-1 ${formErrors.inputs[idx] ? "border-rose-500" : "border-slate-300"}`} />

                          <button type="button" onClick={() => removeInput(idx)} className="p-2 text-rose-600"><Trash2 size={14}/></button>
                        </div>
                        {formErrors.inputs[idx] && <div className="mt-1 text-xs text-rose-600">{formErrors.inputs[idx]}</div>}
                      </div>
                    ))}
                  </div>

                  {/* preview */}
                  <div className="mt-3 text-xs text-slate-500">
                    <div className="font-medium text-slate-700 mb-1">Preview</div>
                    {previewInputs.length === 0 ? <div className="text-xs text-slate-400">No valid inputs yet</div> :
                      previewInputs.map((p, i) => (
                        <div key={i} className="text-sm">• {productMap[p.productId]?.productName || `#${p.productId}`} — {p.qty} {unitMap[p.unitId]?.unitName || ""}</div>
                      ))
                    }
                  </div>
                </div>

                {/* Outputs */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Outputs (mixOut)</div>
                    <button type="button" onClick={addOutput} className="text-sm rounded-full px-2 py-1 border">+ Add</button>
                  </div>

                  <div className="space-y-2">
                    {form.outputs.map((it, idx) => (
                      <div key={idx}>
                        <div className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 items-center">
                          <select required value={it.productId} onChange={(e) => updateOutput(idx, "productId", e.target.value)} className={`rounded-2xl border px-2 py-1 ${formErrors.outputs[idx] ? "border-rose-500" : "border-slate-300"}`}>
                            <option value="">Product…</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.productName}</option>)}
                          </select>

                          <select required value={it.unitId} onChange={(e) => updateOutput(idx, "unitId", e.target.value)} className={`rounded-2xl border px-2 py-1 ${formErrors.outputs[idx] ? "border-rose-500" : "border-slate-300"}`}>
                            <option value="">Unit…</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.unitName || u.name}</option>)}
                          </select>

                          <input required type="number" min="0" step="0.01" placeholder="Qty" value={it.qty} onChange={(e) => updateOutput(idx, "qty", e.target.value)} className={`rounded-2xl border px-2 py-1 ${formErrors.outputs[idx] ? "border-rose-500" : "border-slate-300"}`} />

                          <button type="button" onClick={() => removeOutput(idx)} className="p-2 text-rose-600"><Trash2 size={14}/></button>
                        </div>
                        {formErrors.outputs[idx] && <div className="mt-1 text-xs text-rose-600">{formErrors.outputs[idx]}</div>}
                      </div>
                    ))}
                  </div>

                  {/* preview */}
                  <div className="mt-3 text-xs text-slate-500">
                    <div className="font-medium text-slate-700 mb-1">Preview</div>
                    {previewOutputs.length === 0 ? <div className="text-xs text-slate-400">No valid outputs yet</div> :
                      previewOutputs.map((p, i) => (
                        <div key={i} className="text-sm">• {productMap[p.productId]?.productName || `#${p.productId}`} +{p.qty} {unitMap[p.unitId]?.unitName || ""}</div>
                      ))
                    }
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">Cancel</button>
                <button type="submit" disabled={creating} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
                  {creating ? "Creating…" : "Create Mixture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}