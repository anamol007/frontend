// src/pages/ProductUnitsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { api } from "../utils/api";
import FormModal from "../components/FormModal";

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

/* ----------------------------- utilities ------------------------------ */
const FIELDS = [
  { name: "name", type: "text", label: "Unit name (e.g., KG, BORI)", required: true },
];

const sanitize = (fields, payload = {}) => {
  const allowed = new Set(fields.map((f) => f.name));
  const out = {};
  Object.keys(payload).forEach((k) => {
    const v = payload[k];
    if (allowed.has(k) && v !== "" && v != null) out[k] = v;
  });
  return out;
};

const byAlpha = (a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" });

/* ------------------------- small UI components ------------------------- */
function StatHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function EmptyState({ title = "Nothing here", hint = "" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
      <div className="text-lg font-medium mb-1">{title}</div>
      {hint && <div className="text-sm">{hint}</div>}
    </div>
  );
}

/* --------------------------- Confirm dialog --------------------------- */
function ConfirmDialog({ open, title, message, busy, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border bg-white shadow-lg">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldAlert size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            <div className="text-sm text-slate-500">{message}</div>
          </div>
          <button onClick={onCancel} className="ml-auto rounded p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Trash2 size={14} /> {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- main page -------------------------------- */
export default function ProductUnitsPage() {
  const [me, setMe] = useState(null);
  const isSuper = me?.role === "superadmin";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [q, setQ] = useState("");
  const qRef = useRef("");
  const debounceRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [confirm, setConfirm] = useState({ open: false, row: null, busy: false });

  const PER_PAGE = 6;
  const [page, setPage] = useState(1);

  /* ------------------------- load current user ------------------------- */
  async function fetchMe() {
    try {
      const r = await api.get("/users/verify-token");
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }

  /* ---------------------------- load units ---------------------------- */
  async function loadUnits() {
    setLoading(true);
    setErr(""); setOk("");
    try {
      const r = await api.get("/units");
      const list = r?.data?.data ?? r?.data ?? [];
      setRows(Array.isArray(list) ? list.slice().sort(byAlpha) : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Error loading units");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
    loadUnits();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  /* --------------------------- search debounce -------------------------- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      qRef.current = (q || "").trim().toLowerCase();
      setPage(1);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  /* --------------------------- derived lists --------------------------- */
  const filtered = useMemo(() => {
    const term = qRef.current || "";
    if (!term) return rows;
    return rows.filter((u) => (u.name || "").toLowerCase().includes(term));
  }, [rows, q]); // include q so effect re-evaluates after debounce

  const totalPages = Math.max(1, Math.ceil((filtered.length || 0) / PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [currentPage, page]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, currentPage]);

  /* --------------------------- actions -------------------------------- */
  function openCreate() {
    if (!isSuper) { setErr("Only Super Admin can create units"); return; }
    setEditRow(null);
    setOk(""); setErr("");
    setOpen(true);
  }

  function openEdit(row) {
    if (!isSuper) { setErr("Only Super Admin can edit units"); return; }
    setEditRow(row);
    setOk(""); setErr("");
    setOpen(true);
  }

  async function handleSubmit(form) {
    try {
      if (!isSuper) { setErr("Only Super Admin can perform this action"); return; }
      setErr(""); setOk("");
      const body = sanitize(FIELDS, form);
      if (!body.name) { setErr("Name is required"); return; }

      if (editRow?.id) {
        await api.put(`/units/${editRow.id}`, body);
        setOk("Unit updated");
      } else {
        await api.post("/units", body);
        setOk("Unit created");
      }
      setOpen(false); setEditRow(null);
      setPage(1);
      await loadUnits();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Action failed");
    }
  }

  function askDelete(row) {
    if (!isSuper) { setErr("Only Super Admin can delete units"); return; }
    setConfirm({ open: true, row, busy: false });
  }

  async function confirmDelete() {
    const row = confirm.row;
    setConfirm({ open: false, row: null, busy: false });
    if (!row) return;
    try {
      setErr(""); setOk("");
      await api.delete(`/units/${row.id}`);
      setOk("Unit deleted");
      // reload and keep page sane
      await loadUnits();
      setPage(1);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  /* --------------------------- render --------------------------------- */
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <StatHeader
          title="Product Units"
          subtitle={isSuper ? "Create and manage units (e.g., KG, BORI)." : "Browse available units (read-only)."}
        >
          <div className="hidden sm:flex items-center gap-2">
            <div className="rounded-xl border bg-white px-3 py-2.5 flex items-center gap-2 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search units…"
                className="w-72 bg-transparent outline-none text-sm"
              />
            </div>

            <button
              onClick={loadUnits}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm bg-white hover:bg-slate-50"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            {isSuper && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow"
              >
                <Plus size={16} /> New Unit
              </button>
            )}
          </div>

          {/* responsive small controls */}
          <div className="flex sm:hidden items-center gap-2">
            <button onClick={loadUnits} className="rounded-xl border px-3 py-2 text-sm">
              <RefreshCw size={16} />
            </button>
            {isSuper && <button onClick={openCreate} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"><Plus size={14} /></button>}
          </div>
        </StatHeader>

        {(err || ok) && (
          <div className="mt-3 space-y-2">
            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
            {ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border bg-white/60" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <EmptyState title="No units found" hint="Create the first unit to get started." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-white">
                  <Layers size={18} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">{u.name || "—"}</div>
                  <div className="text-xs text-slate-500 mt-1">ID: {u.id ?? "—"} • Updated {fmtPrettyDate(u.updatedAt)}</div>
                </div>
              </div>

              {isSuper && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(u)}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => askDelete(u)}
                    className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* pager */}
      <div className="flex items-center justify-center gap-2 pt-2 pb-6">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
        >
          ‹ Prev
        </button>

        {(() => {
          const nums = [];
          const start = Math.max(1, currentPage - 1);
          const end = Math.min(totalPages, currentPage + 1);
          for (let i = start; i <= end; i++) nums.push(i);
          if (currentPage === 1 && totalPages >= 2 && !nums.includes(2)) nums.push(2);
          return nums.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={
                n === currentPage
                  ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-2xl border px-4 py-2 text-sm hover:bg-slate-50"
              }
            >
              {n}
            </button>
          ));
        })()}

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
        >
          Next ›
        </button>
      </div>

      {/* modals */}
      <FormModal
        title={editRow ? "Edit Unit" : "Create Unit"}
        open={open}
        onClose={() => { setOpen(false); setEditRow(null); }}
        fields={FIELDS}
        initial={editRow || {}}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirm.open}
        title="Delete unit?"
        message={confirm.row ? `This will permanently remove unit "${confirm.row.name}".` : ""}
        busy={confirm.busy}
        onCancel={() => setConfirm({ open: false, row: null, busy: false })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}