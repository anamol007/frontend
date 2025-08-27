// src/components/FormModal.jsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function FormModal({
  open,
  onClose,
  title = '',
  fields = [],
  initial = {},
  onSubmit = () => {},
}) {
  // Lock/unlock background scroll when modal is open
  useEffect(() => {
    if (!open) return; // run effect only when open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    onSubmit(data);
  };

  return createPortal(
    <div className="fixed inset-0 z-[3000]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* modal card */}
      <div className="relative mx-auto mt-[10vh] w-[min(720px,92vw)] rounded-2xl border border-white/30 bg-white/80 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-white/60 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.name} className="grid gap-2 text-sm">
                <span className="text-slate-600">
                  {f.label} {f.required && <span className="text-rose-500">*</span>}
                </span>

                {f.type === 'select' ? (
                  <select
                    name={f.name}
                    defaultValue={initial[f.name] ?? ''}
                    className="rounded-xl border border-slate-300 bg-white/70 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    required={f.required}
                  >
                    <option value="" disabled hidden>— select —</option>
                    {(f.options || []).map((opt) =>
                      typeof opt === 'string'
                        ? <option key={opt} value={opt}>{opt}</option>
                        : <option key={opt.value} value={opt.value}>{opt.label}</option>
                    )}
                  </select>
                ) : (
                  <input
                    name={f.name}
                    type={f.type || 'text'}
                    defaultValue={initial[f.name] ?? ''}
                    step={f.step}
                    min={f.min}
                    className="rounded-xl border border-slate-300 bg-white/70 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                    required={f.required}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white/80 px-4 py-2 text-sm text-slate-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}