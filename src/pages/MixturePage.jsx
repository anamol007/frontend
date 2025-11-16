// src/pages/MixturePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Beaker,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Search as SearchIcon,
} from "lucide-react";
import { api } from "../utils/api";

/* --------------------------- date formatting --------------------------- */
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtPrettyDate(input) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(+d)) return "—";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${ordinal(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

/* ---------- small reusable searchable select (compact + accessible) ---------- */
function SearchableSelect({ value, onChange, options = [], placeholder = "Select…", className = "" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const items = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string"
          ? { value: o, label: o }
          : { value: o.value ?? o.id ?? o, label: o.label ?? o.name ?? o.unitName ?? String(o.value ?? o.id ?? o) }
      ),
    [options]
  );

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return items;
    return items.filter((it) => (it.label || "").toLowerCase().includes(s) || String(it.value).toLowerCase().includes(s));
  }, [q, items]);

  const selected = items.find((i) => String(i.value) === String(value));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm flex items-center justify-between shadow-sm"
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>{selected ? selected.label : placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl border bg-white shadow-lg">
          <div className="p-2">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                className="w-full rounded-md border px-10 py-2 text-sm outline-none"
                placeholder="Search..."
              />
            </div>
          </div>

          <div className="max-h-44 overflow-auto">
            {filtered.length === 0 && <div className="p-3 text-sm text-gray-500">No options</div>}
            {filtered.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- core page --------------------------- */
export default function MixturePage() {
  const [inventories, setInventories] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);

  const [mixtures, setMixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const defaultInput = { productId: "", unitId: "", qty: "" };
  const defaultOutput = { productId: "", unitId: "", qty: "" };

  const [form, setForm] = useState({
    inventoryId: "",
    notes: "",
    inputs: [{ ...defaultInput }],
    outputs: [{ ...defaultOutput }],
  });

  const [formErrors, setFormErrors] = useState({
    inventory: "",
    inputs: [],
    outputs: [],
    general: "",
  });

  /* fetch references & mixtures */
  async function fetchReferences() {
    try {
      const [invRes, prodRes, unitRes] = await Promise.allSettled([api.get("/inventory"), api.get("/products"), api.get("/units")]);
      const pick = (r) => (r?.status === "fulfilled" ? (r.value?.data?.data ?? r.value?.data ?? []) : []);
      setInventories(Array.isArray(pick(invRes)) ? pick(invRes) : []);
      setProducts(Array.isArray(pick(prodRes)) ? pick(prodRes) : []);
      setUnits(Array.isArray(pick(unitRes)) ? pick(unitRes) : []);
    } catch {
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

  /* helpers to update form arrays */
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateInput = (i, k, v) => {
    setForm((f) => {
      const inputs = f.inputs.slice();
      inputs[i] = { ...inputs[i], [k]: v };
      return { ...f, inputs };
    });
    setFormErrors((p) => ({ ...p, inputs: p.inputs.slice().map((x, idx) => (idx === i ? "" : x)), general: "" }));
  };
  const updateOutput = (i, k, v) => {
    setForm((f) => {
      const outputs = f.outputs.slice();
      outputs[i] = { ...outputs[i], [k]: v };
      return { ...f, outputs };
    });
    setFormErrors((p) => ({ ...p, outputs: p.outputs.slice().map((x, idx) => (idx === i ? "" : x)), general: "" }));
  };
  const addInput = () => {
    setForm((f) => ({ ...f, inputs: [...f.inputs, { ...defaultInput }] }));
    setFormErrors((p) => ({ ...p, inputs: [...(p.inputs || []), ""] }));
  };
  const addOutput = () => {
    setForm((f) => ({ ...f, outputs: [...f.outputs, { ...defaultOutput }] }));
    setFormErrors((p) => ({ ...p, outputs: [...(p.outputs || []), ""] }));
  };
  const removeInput = (i) => {
    setForm((f) => ({ ...f, inputs: f.inputs.filter((_, idx) => idx !== i) }));
    setFormErrors((p) => ({ ...p, inputs: (p.inputs || []).filter((_, idx) => idx !== i) }));
  };
  const removeOutput = (i) => {
    setForm((f) => ({ ...f, outputs: f.outputs.filter((_, idx) => idx !== i) }));
    setFormErrors((p) => ({ ...p, outputs: (p.outputs || []).filter((_, idx) => idx !== i) }));
  };

  /* create mixture */
  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    setFormErrors({ inventory: "", inputs: [], outputs: [], general: "" });
    setCreating(true);

    try {
      const errors = { inventory: "", inputs: [], outputs: [], general: "" };
      let hasError = false;

      if (!form.inventoryId) {
        errors.inventory = "Please select an inventory.";
        hasError = true;
      }

      const inputsClean = [];
      for (let i = 0; i < form.inputs.length; i++) {
        const r = form.inputs[i] || {};
        if (!r.productId || !r.unitId || r.qty === "" || r.qty == null) {
          errors.inputs[i] = "Select product, unit and qty.";
          hasError = true;
        } else if (Number(r.qty) <= 0 || Number.isNaN(Number(r.qty))) {
          errors.inputs[i] = "Qty must be > 0.";
          hasError = true;
        } else {
          errors.inputs[i] = "";
          inputsClean.push({ productId: Number(r.productId), unitId: Number(r.unitId), qty: Number(r.qty), status: "mixIn" });
        }
      }

      const outputsClean = [];
      for (let i = 0; i < form.outputs.length; i++) {
        const r = form.outputs[i] || {};
        if (!r.productId || !r.unitId || r.qty === "" || r.qty == null) {
          errors.outputs[i] = "Select product, unit and qty.";
          hasError = true;
        } else if (Number(r.qty) <= 0 || Number.isNaN(Number(r.qty))) {
          errors.outputs[i] = "Qty must be > 0.";
          hasError = true;
        } else {
          errors.outputs[i] = "";
          outputsClean.push({ productId: Number(r.productId), unitId: Number(r.unitId), qty: Number(r.qty), status: "mixOut" });
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
      setForm({
        inventoryId: "",
        notes: "",
        inputs: [{ ...defaultInput }],
        outputs: [{ ...defaultOutput }],
      });
      setFormErrors({ inventory: "", inputs: [], outputs: [], general: "" });
      await fetchMixtures();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Create failed";
      setFormErrors((p) => ({ ...p, general: msg }));
      setErr(msg);
    } finally {
      setCreating(false);
    }
  }

  /* delete mixture */
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

  /* maps and previews */
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

  const previewInputs = (form.inputs || []).filter((i) => i.productId && i.unitId && i.qty);
  const previewOutputs = (form.outputs || []).filter((o) => o.productId && o.unitId && o.qty);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-white p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
            <Beaker size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Product Mixtures</h1>
            <p className="text-sm text-slate-500">Create mixIn → mixOut entries and update inventory stock.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setOpen(true);
              setErr("");
              setOk("");
              setFormErrors({ inventory: "", inputs: [], outputs: [], general: "" });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} /> New Mixture
          </button>

          <button onClick={() => { fetchMixtures(); fetchReferences(); }} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      {ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}

      {/* mixtures list */}
      {loading ? (
        <div className="text-sm text-slate-500">Loading mixtures…</div>
      ) : mixtures.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">No mixtures found.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mixtures.map((m) => {
            const inputs = (m.productMixtures || []).filter((p) => p.status === "mixIn");
            const outputs = (m.productMixtures || []).filter((p) => p.status === "mixOut");
            return (
              <div key={m.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{inventoryMap[m.inventoryId]?.inventoryName || m.inventory?.inventoryName || `#${m.inventoryId}`}</div>
                    <div className="text-xs text-slate-500">{fmtPrettyDate(m.createdAt)}</div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-3 text-sm text-slate-700 space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Inputs (mixIn)</div>
                    <div className="mt-2 space-y-1">
                      {inputs.length ? inputs.map((p) => (
                        <div key={p.id || `${p.productId}-${p.unitId}`} className="text-sm flex items-center justify-between">
                          <div className="truncate">• {productMap[p.productId]?.productName || `#${p.productId}`}</div>
                          <div className="text-xs text-slate-500 ml-4">{p.qty} {unitMap[p.unitId]?.unitName || ""}</div>
                        </div>
                      )) : <div className="text-xs text-slate-400">—</div>}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 font-medium">Outputs (mixOut)</div>
                    <div className="mt-2 space-y-1">
                      {outputs.length ? outputs.map((p) => (
                        <div key={p.id || `${p.productId}-${p.unitId}`} className="text-sm flex items-center justify-between">
                          <div className="truncate">• {productMap[p.productId]?.productName || `#${p.productId}`}</div>
                          <div className="text-xs text-slate-500 ml-4">+{p.qty} {unitMap[p.unitId]?.unitName || ""}</div>
                        </div>
                      )) : <div className="text-xs text-slate-400">—</div>}
                    </div>
                  </div>

                  {m.notes && <div className="mt-2 text-xs text-slate-500">Note: {m.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* create modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-[min(980px,96vw)] bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Mixture</h2>
              <button onClick={() => setOpen(false)} className="rounded p-2 hover:bg-slate-100"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600">Inventory *</label>
                  <SearchableSelect
                    value={form.inventoryId}
                    onChange={(v) => { setField("inventoryId", v); setFormErrors((p) => ({ ...p, inventory: "" })); }}
                    options={[{ value: "", label: "Select inventory…" }, ...inventories.map((i) => ({ value: i.id, label: i.inventoryName || i.name || `#${i.id}` }))]}
                  />
                  {formErrors.inventory && <div className="mt-1 text-xs text-rose-600">{formErrors.inventory}</div>}
                </div>

                <div>
                  <label className="text-sm text-slate-600">Notes</label>
                  <input value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Optional notes" className="mt-1 w-full rounded-xl border px-3 py-2" />
                </div>
              </div>

              {formErrors.general && <div className="text-sm text-rose-600">{formErrors.general}</div>}

              <div className="grid grid-cols-2 gap-4">
                {/* Inputs */}
                <div className="rounded-xl border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Inputs (mixIn)</div>
                    <button type="button" onClick={addInput} className="text-sm rounded-full px-2 py-1 border">+ Add</button>
                  </div>

                  <div className="space-y-2">
                    {form.inputs.map((it, idx) => (
                      <div key={idx}>
                        <div className="grid grid-cols-[1fr_1fr_80px_36px] gap-2 items-center">
                          <SearchableSelect
                            value={it.productId}
                            onChange={(v) => updateInput(idx, "productId", v)}
                            options={[{ value: "", label: "Product…" }, ...products.map((p) => ({ value: p.id, label: p.productName || p.name || `#${p.id}` }))]}
                          />
                          <SearchableSelect
                            value={it.unitId}
                            onChange={(v) => updateInput(idx, "unitId", v)}
                            options={[{ value: "", label: "Unit…" }, ...units.map((u) => ({ value: u.id, label: u.unitName || u.name || `#${u.id}` }))]}
                          />
                          <input value={it.qty} onChange={(e) => updateInput(idx, "qty", e.target.value)} required type="number" step="0.01" placeholder="Qty" className={`rounded-xl border px-2 py-2 ${formErrors.inputs[idx] ? "border-rose-500" : "border-slate-300"}`} />
                          <button type="button" onClick={() => removeInput(idx)} className="p-2 text-rose-600"><Trash2 size={14} /></button>
                        </div>
                        {formErrors.inputs[idx] && <div className="mt-1 text-xs text-rose-600">{formErrors.inputs[idx]}</div>}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    <div className="font-medium text-slate-700 mb-1">Preview</div>
                    {previewInputs.length === 0 ? <div className="text-xs text-slate-400">No valid inputs yet</div> : previewInputs.map((p, i) => (
                      <div key={i} className="text-sm">• {productMap[p.productId]?.productName || `#${p.productId}`} — {p.qty} {unitMap[p.unitId]?.unitName || ""}</div>
                    ))}
                  </div>
                </div>

                {/* Outputs */}
                <div className="rounded-xl border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Outputs (mixOut)</div>
                    <button type="button" onClick={addOutput} className="text-sm rounded-full px-2 py-1 border">+ Add</button>
                  </div>

                  <div className="space-y-2">
                    {form.outputs.map((it, idx) => (
                      <div key={idx}>
                        <div className="grid grid-cols-[1fr_1fr_80px_36px] gap-2 items-center">
                          <SearchableSelect
                            value={it.productId}
                            onChange={(v) => updateOutput(idx, "productId", v)}
                            options={[{ value: "", label: "Product…" }, ...products.map((p) => ({ value: p.id, label: p.productName || p.name || `#${p.id}` }))]}
                          />
                          <SearchableSelect
                            value={it.unitId}
                            onChange={(v) => updateOutput(idx, "unitId", v)}
                            options={[{ value: "", label: "Unit…" }, ...units.map((u) => ({ value: u.id, label: u.unitName || u.name || `#${u.id}` }))]}
                          />
                          <input value={it.qty} onChange={(e) => updateOutput(idx, "qty", e.target.value)} required type="number" step="0.01" placeholder="Qty" className={`rounded-xl border px-2 py-2 ${formErrors.outputs[idx] ? "border-rose-500" : "border-slate-300"}`} />
                          <button type="button" onClick={() => removeOutput(idx)} className="p-2 text-rose-600"><Trash2 size={14} /></button>
                        </div>
                        {formErrors.outputs[idx] && <div className="mt-1 text-xs text-rose-600">{formErrors.outputs[idx]}</div>}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    <div className="font-medium text-slate-700 mb-1">Preview</div>
                    {previewOutputs.length === 0 ? <div className="text-xs text-slate-400">No valid outputs yet</div> : previewOutputs.map((p, i) => (
                      <div key={i} className="text-sm">• {productMap[p.productId]?.productName || `#${p.productId}`} +{p.qty} {unitMap[p.unitId]?.unitName || ""}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={creating} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
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