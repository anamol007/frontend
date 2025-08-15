// src/components/FormModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

/**
 * fields: [
 *  { name, label, type:'text'|'email'|'number'|'password'|'textarea'|'select',
 *    required?, placeholder?, step?, min?, max?, options?: Array<string|{value,label}> }
 * ]
 */
export default function FormModal({
  open,
  title = "Form",
  fields = [],
  initial = {},
  onSubmit,
  onClose,
  submitLabel = "Save",
}) {
  const normalizedInitial = useMemo(() => {
    const out = {};
    fields.forEach((f) => {
      let v = initial?.[f.name];
      if (f.type === "select") {
        if (v && typeof v === "object") {
          // prefer id/value from an object
          v = v.id ?? v.value ?? "";
        }
        // keep select as string for <select>, backend can cast
        if (typeof v === "number") v = String(v);
      }
      if (v === undefined || v === null) v = f.type === "select" ? "" : "";
      out[f.name] = v;
    });
    return out;
  }, [fields, initial]);

  const [form, setForm] = useState(normalizedInitial);

  useEffect(() => setForm(normalizedInitial), [normalizedInitial, open]);

  if (!open) return null;

  function getOptions(arr = []) {
    return arr.map((opt) =>
      typeof opt === "object" ? opt : { value: String(opt), label: String(opt) }
    );
  }

  function update(name, value) {
    setForm((s) => ({ ...s, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // sanitize payload to allowed fields only
    const payload = {};
    fields.forEach((f) => {
      let v = form[f.name];
      if (f.type === "select") {
        // cast numeric select values to number if possible
        if (/^\d+$/.test(String(v))) v = Number(v);
      }
      if (f.type === "number") {
        v = v === "" ? "" : Number(v);
      }
      if (v !== "" && v !== undefined && v !== null) payload[f.name] = v;
    });
    onSubmit?.(payload);
  }

  return (
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(900px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((f) => {
                const common =
                  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";
                if (f.type === "textarea") {
                  return (
                    <label key={f.name} className="space-y-1 md:col-span-2">
                      <span className="text-sm font-medium text-slate-700">
                        {f.label} {f.required ? <span className="text-rose-600">*</span> : null}
                      </span>
                      <textarea
                        rows={4}
                        className={common}
                        placeholder={f.placeholder}
                        value={form[f.name] ?? ""}
                        onChange={(e) => update(f.name, e.target.value)}
                        required={!!f.required}
                      />
                    </label>
                  );
                }
                if (f.type === "select") {
                  const opts = getOptions(f.options || []);
                  return (
                    <label key={f.name} className="space-y-1">
                      <span className="text-sm font-medium text-slate-700">
                        {f.label} {f.required ? <span className="text-rose-600">*</span> : null}
                      </span>
                      <select
                        className={common}
                        value={form[f.name] ?? ""}
                        onChange={(e) => update(f.name, e.target.value)}
                        required={!!f.required}
                      >
                        <option value="">Select…</option>
                        {opts.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={f.name} className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">
                      {f.label} {f.required ? <span className="text-rose-600">*</span> : null}
                    </span>
                    <input
                      type={f.type || "text"}
                      className={common}
                      placeholder={f.placeholder}
                      value={form[f.name] ?? ""}
                      onChange={(e) => update(f.name, e.target.value)}
                      required={!!f.required}
                      step={f.step}
                      min={f.min}
                      max={f.max}
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:shadow-md"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}