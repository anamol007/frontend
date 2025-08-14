import { Pencil, Trash2 } from 'lucide-react';

export default function SimpleTable({ cols = [], rows = [], onEdit, onDelete }) {
  const render = (row, key) => {
    const v = row?.[key];
    if (v == null) return '—';
    if (typeof v === 'string' && v.length > 80) return v.slice(0, 80) + '…';
    return String(v);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/80">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-4 py-3 text-left font-semibold text-slate-600">{c}</th>
            ))}
            {(onEdit || onDelete) && <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length + 1} className="px-4 py-10 text-center text-slate-500">No records yet.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
              {cols.map((c) => (
                <td key={c} className="px-4 py-3 text-slate-700">{render(r, c)}</td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-4 py-3 text-right">
                  {onEdit && (
                    <button onClick={() => onEdit(r)} className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
                      <Pencil size={16} />
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete(r)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}