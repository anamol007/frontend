// src/components/FormModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Props:
 *  - title: string
 *  - open: boolean
 *  - onClose: () => void
 *  - fields: Array<{ name, label, type, required?, options? }>
 *      type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea'
 *      options: string[]     (for select)
 *  - initial: object
 *  - onSubmit: (values) => Promise<void> | void
 */
export default function FormModal({
  title = 'Form',
  open = false,
  onClose,
  fields = [],
  initial = {},
  onSubmit,
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});

  // Reset values/errors whenever dialog opens or initial changes
  useEffect(() => {
    if (open) {
      setValues(initial || {});
      setErrors({});
    }
  }, [open, initial]);

  const byCols = useMemo(() => {
    // auto 2-column on desktop for nice layout
    return fields.length > 1;
  }, [fields.length]);

  function setVal(name, raw) {
    let v = raw;
    if (typeof v === 'string') v = v; // keep as is while typing; trim on submit
    setValues((s) => ({ ...s, [name]: v }));
  }

  function validate() {
    const e = {};
    for (const f of fields) {
      const raw = values[f.name];
      const v = typeof raw === 'string' ? raw.trim() : raw;

      if (f.required && (v === undefined || v === null || v === '')) {
        e[f.name] = `${f.label || f.name} is required`;
        continue;
      }
      if (f.type === 'email' && v) {
        const ok = /^\S+@\S+\.\S+$/.test(v);
        if (!ok) e[f.name] = 'Enter a valid email address';
      }
      if (f.type === 'number' && v !== '' && v !== undefined && v !== null) {
        if (Number.isNaN(Number(v))) e[f.name] = `${f.label || f.name} must be a number`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault(); // prevent native validation bubbles
    if (!validate()) return;

    // Trim strings before sending
    const cleaned = {};
    for (const [k, raw] of Object.entries(values || {})) {
      cleaned[k] = typeof raw === 'string' ? raw.trim() : raw;
    }
    await onSubmit?.(cleaned);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Card */}
      <div className="relative z-10 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        {/* Title bar */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form noValidate onSubmit={handleSubmit}>
          <div
            className={`grid gap-4 ${byCols ? 'sm:grid-cols-2' : 'grid-cols-1'}`}
          >
            {fields.map((f) => (
              <div key={f.name} className="flex flex-col">
                <label className="mb-1 text-sm font-medium text-slate-700">
                  {f.label}
                  {f.required && <span className="text-rose-600"> *</span>}
                </label>

                {f.type === 'select' ? (
                  <select
                    value={values[f.name] ?? ''}
                    onChange={(e) => setVal(f.name, e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    value={values[f.name] ?? ''}
                    onChange={(e) => setVal(f.name, e.target.value)}
                    rows={3}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={f.placeholder || ''}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setVal(f.name, e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    placeholder={f.placeholder || ''}
                    // do NOT set required; we validate ourselves
                  />
                )}

                {errors[f.name] && (
                  <p className="mt-1 text-xs text-rose-600">{errors[f.name]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:shadow-md"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}