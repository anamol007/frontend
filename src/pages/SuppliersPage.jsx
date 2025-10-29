// src/pages/SuppliersPage.jsx
import React, { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Search, RefreshCw, X, ShieldAlert
} from "lucide-react";
import { api } from "../utils/api";

/* ---------- Small helpers / simple modal components ---------- */

function SimpleModal({ title, open, onClose, onSubmit, children, submitLabel = "Save" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="px-4 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ open, name, busy, error, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow">
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-br from-rose-600 to-rose-700 px-5 py-4 text-white">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert size={18} /> Confirm deletion
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-slate-800">
            You are about to delete the supplier{" "}
            <span className="font-semibold">“{name || "—"}”</span>. This cannot be undone.
          </p>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-3xl border-t border-white/60 bg-white/70 px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            <Trash2 size={16} /> {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Suppliers page -------------------- */

export default function SuppliersPage() {
  // auth
  const [me, setMe] = useState(null);
  const isSuper = (me?.role || "") === "superadmin";

  // server pagination (backend controls pages)
  const PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // rows for current page
  const [suppliers, setSuppliers] = useState([]);

  // filters / sort (sent to backend)
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("DESC");

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // add/edit modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [addForm, setAddForm] = useState({ name: "", phone: "", address: "", pan: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "", pan: "" });

  // delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmErr, setConfirmErr] = useState("");

  // messages
  const [ok, setOk] = useState("");

  // who am i?
  async function fetchMe() {
    try {
      const r = await api.get("/users/verify-token");
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }
  useEffect(() => { fetchMe(); }, []);

  // fetch suppliers (server-side pagination)
  async function fetchSuppliers(nextPage = 1) {
    setLoading(true);
    setError("");
    try {
      const params = { page: nextPage, limit: PER_PAGE };
      if (q) params.q = q;
      if (sortKey) params.sort = sortKey;
      if (sortDir) params.dir = sortDir;

      const res = await api.get("/suppliers", { params });

      const root = res?.data ?? {};
      // pick items array from common shapes
      const items = Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.rows)
        ? root.rows
        : Array.isArray(res?.data)
        ? res.data
        : [];

      const p = root.pagination || {};
      let current = Number(p.currentPage ?? nextPage) || nextPage;
      let tPages = Number(p.totalPages ?? 1) || 1;
      let tCount = Number(p.totalCount ?? (root.total ?? root.count ?? items.length)) || (items.length || 0);
      let nextFlag = Boolean(p.hasNextPage ?? (tPages > current));
      let prevFlag = Boolean(p.hasPrevPage ?? (current > 1));

      // Sequelize fallback
      if (Array.isArray(root.rows) && typeof root.count === "number") {
        tCount = Number(root.count);
        tPages = Math.max(1, Math.ceil(tCount / PER_PAGE));
        current = Number(nextPage);
        nextFlag = current < tPages;
        prevFlag = current > 1;
      }

      // top-level array fallback (headers)
      if (Array.isArray(res?.data) && !root.pagination) {
        const headerTotal = Number(res?.headers?.["x-total-count"] ?? 0);
        if (headerTotal > 0) {
          tCount = headerTotal;
          tPages = Math.max(1, Math.ceil(tCount / PER_PAGE));
        } else {
          tCount = items.length;
          tPages = Math.max(1, Math.ceil(tCount / PER_PAGE));
        }
        current = Number(nextPage);
        nextFlag = current < tPages;
        prevFlag = current > 1;
      }

      setSuppliers(Array.isArray(items) ? items : []);
      setPage(Number(current || nextPage));
      setTotalPages(Number(tPages || 1));
      setTotalCount(Number(tCount || 0));
      setHasNext(Boolean(nextFlag));
      setHasPrev(Boolean(prevFlag));
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // reset to page 1 when query/sort change
    setPage(1);
    fetchSuppliers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sortKey, sortDir]);

  // helper to navigate pages
  const goPrev = () => { if (hasPrev && page > 1) fetchSuppliers(page - 1); };
  const goNext = () => { if (hasNext && page < totalPages) fetchSuppliers(page + 1); };

  /* ---------- actions: create, edit, delete (superadmin only) ---------- */

  const openEdit = (row) => {
    if (!isSuper) { setError("Only Super Admin can edit suppliers"); return; }
    setEditing(row);
    setEditForm({
      name: row.name || "",
      phone: row.phone || "",
      address: row.address || "",
      pan: row.pan || ""
    });
    setIsEditOpen(true);
  };

  const createNow = async () => {
    const payload = {
      name: addForm.name?.trim(),
      phone: addForm.phone?.trim() || undefined,
      address: addForm.address?.trim() || undefined,
      pan: addForm.pan?.trim() || undefined
    };
    if (!payload.name) { setError("Supplier name is required"); return; }
    try {
      setError(""); setOk("");
      await api.post("/suppliers", payload);
      setOk("Supplier created");
      setIsAddOpen(false);
      setAddForm({ name: "", phone: "", address: "", pan: "" });
      // reload current page
      fetchSuppliers(page);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to create supplier");
    }
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const payload = {
      name: editForm.name?.trim(),
      phone: editForm.phone?.trim() || undefined,
      address: editForm.address?.trim() || undefined,
      pan: editForm.pan?.trim() || undefined
    };
    if (!payload.name) { setError("Supplier name is required"); return; }
    try {
      setError(""); setOk("");
      await api.put(`/suppliers/${editing.id}`, payload);
      setOk("Supplier updated");
      setIsEditOpen(false);
      setEditing(null);
      fetchSuppliers(page);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to update supplier");
    }
  };

  const askDelete = (row) => {
    if (!isSuper) { setError("Only Super Admin can delete suppliers"); return; }
    setConfirmRow(row);
    setConfirmErr("");
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!confirmRow) return;
    setConfirmBusy(true);
    setConfirmErr("");
    try {
      await api.delete(`/suppliers/${confirmRow.id}`);
      setConfirmOpen(false);
      setConfirmRow(null);
      // if last item on page removed, go back one page
      const goBack = suppliers.length === 1 && page > 1;
      await fetchSuppliers(goBack ? page - 1 : page);
    } catch (e) {
      setConfirmErr(e?.response?.data?.message || e?.message || "Failed to delete supplier");
    } finally {
      setConfirmBusy(false);
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500">List of suppliers. Only Super Admin may create, edit or delete.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, pan…"
              className="pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-sm outline-none w-64"
            />
          </div>

          <select
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = (e.target.value || "createdAt:DESC").split(":");
              setSortKey(k); setSortDir(d);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
          >
            <option value="createdAt:DESC">Newest</option>
            <option value="createdAt:ASC">Oldest</option>
            <option value="name:ASC">Name A→Z</option>
            <option value="name:DESC">Name Z→A</option>
          </select>

          <button
            onClick={() => fetchSuppliers(page)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={16} /> Refresh
          </button>

          {isSuper && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:shadow-md whitespace-nowrap"
              title="Create new supplier"
            >
              <Plus size={14} /> New Supplier
            </button>
          )}
        </div>
      </div>

      {(error || ok) && (
        <div className="space-y-2">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</div>}
          {ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden md:grid grid-cols-[1fr_160px_1fr_140px] items-center border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div>Supplier</div>
          <div>Phone</div>
          <div>Address</div>
          <div className="text-right">Actions</div>
        </div>

        <ul className="divide-y divide-slate-100">
          {loading && <li className="p-4 text-sm text-slate-500">Loading…</li>}
          {!loading && suppliers.length === 0 && (
            <li className="p-6 text-sm text-slate-500">No suppliers found.</li>
          )}

          {suppliers.map((s) => (
            <li key={s.id} className="md:grid md:grid-cols-[1fr_160px_1fr_140px] md:items-center">
              <div className="flex items-center gap-3 px-4 py-3 md:py-4 min-w-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
                </div>
              </div>

              <div className="px-4 py-3 text-sm text-slate-700">
                {s.phone || "—"}
              </div>

              <div className="px-4 py-3 text-sm text-slate-600">
                <div className="truncate max-w-[60ch]">{s.address || "—"}</div>
              </div>

              <div className="px-4 py-3 md:flex md:items-center md:justify-end gap-2">
                <div className="text-sm text-slate-500 mr-3 md:mr-6">{s.pan || "—"}</div>

                {isSuper && (
                  <>
                    <button
                      onClick={() => openEdit(s)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => askDelete(s)}
                      className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pagination — server-driven style (same as CategoriesPage) */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={() => fetchSuppliers(page - 1)}
          disabled={!hasPrev || page <= 1}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
          title="Previous"
        >
          <span className="opacity-60">‹</span> Prev
        </button>

        {(() => {
          const chips = [];
          const start = Math.max(1, page - 1);
          const end = Math.min(totalPages, page + 1);
          for (let i = start; i <= end; i++) chips.push(i);
          if (page === 1 && totalPages >= 2 && !chips.includes(2)) chips.push(2);
          return chips.map((n) => (
            <button
              key={n}
              onClick={() => fetchSuppliers(n)}
              className={
                n === page
                  ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-50"
              }
            >
              {n}
            </button>
          ));
        })()}

        <button
          onClick={() => fetchSuppliers(page + 1)}
          disabled={!hasNext || page >= totalPages}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
          title="Next"
        >
          Next <span className="opacity-60">›</span>
        </button>
      </div>

      {/* Add modal */}
      <SimpleModal
        title="New Supplier"
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={createNow}
        submitLabel="Create"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Name *</label>
            <input
              value={addForm.name}
              onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
              className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Supplier name"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
            <input
              value={addForm.phone}
              onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Phone number"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Address</label>
            <input
              value={addForm.address}
              onChange={(e) => setAddForm(f => ({ ...f, address: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Address"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">PAN</label>
            <input
              value={addForm.pan}
              onChange={(e) => setAddForm(f => ({ ...f, pan: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="PAN"
            />
          </div>
        </div>
      </SimpleModal>

      {/* Edit modal */}
      <SimpleModal
        title={`Edit Supplier: ${editing?.name ?? ""}`}
        open={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditing(null); }}
        onSubmit={saveEdit}
        submitLabel="Save"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Name *</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Supplier name"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
            <input
              value={editForm.phone}
              onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Phone number"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Address</label>
            <input
              value={editForm.address}
              onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Address"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">PAN</label>
            <input
              value={editForm.pan}
              onChange={(e) => setEditForm(f => ({ ...f, pan: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="PAN"
            />
          </div>
        </div>
      </SimpleModal>

      {/* Delete confirm */}
      <ConfirmDeleteModal
        open={confirmOpen}
        name={confirmRow?.name}
        busy={confirmBusy}
        error={confirmErr}
        onCancel={() => { if (!confirmBusy) { setConfirmOpen(false); setConfirmRow(null); setConfirmErr(""); } }}
        onConfirm={doDelete}
      />
    </div>
  );
}