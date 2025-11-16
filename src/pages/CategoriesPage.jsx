// src/pages/CategoriesPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, Search, RefreshCw, Layers, Tags,
  ArrowUpAZ, ArrowDownAZ, ArrowUp01, ArrowDown10, ShieldAlert, X
} from "lucide-react";
import { api } from "../utils/api";

const slugify = (s) =>
  s?.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "";

const CATEGORY_OPTIONS = ["GRAIN", "VEGETABLE", "FRUIT", "DAIRY", "MEAT", "OTHER"];

function pickArray(root) {
  if (!root) return [];
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.items)) return root.items;
  return [];
}

/* --------------------------- date formatting ---------------------------- */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtPrettyDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(+d)) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${ordinal(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

/* ------------------------------ UI bits -------------------------------- */
function SimpleModal({ title, open, onClose, onSubmit, children, submitLabel = "Save" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
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
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-[0_30px_120px_-20px_rgba(2,6,23,.55)]">
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
            You are about to delete the category{" "}
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

function StatBadge({ icon: Icon, label, value, tone = "indigo" }) {
  const tones = {
    indigo: {
      wrap: "from-indigo-500/10 to-violet-500/10",
      text: "text-indigo-700",
      ring: "ring-indigo-200/60",
      icon: "text-indigo-600",
    },
    emerald: {
      wrap: "from-emerald-500/10 to-teal-500/10",
      text: "text-emerald-700",
      ring: "ring-emerald-200/60",
      icon: "text-emerald-600",
    },
  };
  const t = tones[tone] ?? tones.indigo;

  return (
    <div
      className={[
        "h-full w-full flex flex-col items-center justify-center gap-2 text-center",
        "rounded-2xl border border-white/60 bg-gradient-to-br backdrop-blur-xl",
        "shadow ring-1 p-4 sm:p-5",
        t.wrap,
        t.ring,
      ].join(" ")}
    >
      {Icon && <Icon className={`h-6 w-6 sm:h-7 sm:w-7 ${t.icon}`} />}
      <span className={`text-xs sm:text-sm font-medium leading-tight ${t.text}`}>{label}</span>
      <span className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">{value}</span>
    </div>
  );
}

function SearchableSelect({ value, onChange, options = [], placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [filter, options]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full rounded-lg border px-3 py-2 text-sm text-left flex items-center justify-between bg-white"
      >
        <span className="truncate">{value || <span className="text-gray-400">{placeholder}</span>}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 max-h-60 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoFocus
                className="w-full rounded-md border px-10 py-2 text-sm outline-none"
                placeholder="Search..."
              />
            </div>
          </div>

          <div className="max-h-40 overflow-auto">
            {filtered.length === 0 && <div className="p-3 text-sm text-gray-500">No options</div>}
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); setFilter(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Page ---------------------------------- */
export default function CategoriesPage() {
  const [me, setMe] = useState(null);
  const isSuper = me?.role === "superadmin";
  const isAdmin = me?.role === "admin";

  const PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", slug: "", categoryCol: "GRAIN" });
  const [editForm, setEditForm] = useState({ name: "", slug: "", categoryCol: "GRAIN" });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState([
    { icon: Tags, label: "Categories", value: "—", tone: "indigo" },
    { icon: Layers, label: "Items", value: "—", tone: "emerald" },
    { icon: RefreshCw, label: "Synced", value: "100%", tone: "indigo" },
  ]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmErr, setConfirmErr] = useState("");

  async function fetchMe() {
    try {
      const r = await api.get("/users/verify-token");
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }

  async function fetchCategories(nextPage = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/categories", {
        params: {
          page: nextPage,
          limit: PER_PAGE,
          q: query || undefined,
          sort: sortKey || undefined,
          dir: sortDir || undefined,
        },
      });

      const root = res?.data ?? {};
      const items = pickArray(root);
      const p = root.pagination || {};

      setCategories(items);
      setPage(Number(p.currentPage ?? nextPage) || 1);
      setTotalPages(Number(p.totalPages ?? 1) || 1);
      setTotalCount(Number(p.totalCount ?? items.length) || 0);
      setHasNext(Boolean(p.hasNextPage));
      setHasPrev(Boolean(p.hasPrevPage));

      setStats((old) => [
        { ...old[0], value: String(p.totalCount ?? items.length ?? "—") },
        old[1],
        old[2],
      ]);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMe(); }, []);
  useEffect(() => { fetchCategories(1); }, [query, sortKey, sortDir]);

  const onEdit = (row) => {
    setEditing(row || {});
    setEditForm({
      name: row?.name || "",
      slug: row?.slug || "",
      categoryCol: row?.categoryCol || "GRAIN",
    });
    setIsEditOpen(true);
  };

  const askDelete = (row) => {
    if (!(isSuper || isAdmin)) return;
    setConfirmRow(row);
    setConfirmErr("");
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!confirmRow) return;
    setConfirmBusy(true);
    setConfirmErr("");
    try {
      await api.delete(`/categories/${confirmRow.id}`);
      setConfirmOpen(false);
      setConfirmRow(null);
      const goBack = categories.length === 1 && page > 1;
      await fetchCategories(goBack ? page - 1 : page);
    } catch (e) {
      setConfirmErr(e?.response?.data?.message || e?.message || "Failed to delete category");
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Categories</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Search categories…"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> New Category
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setSortKey("name")}
            className={`px-3 py-2 text-sm ${sortKey === "name" ? "bg-gray-50" : ""}`}
            title="Sort by name"
          >
            {sortDir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setSortKey("items")}
            className={`px-3 py-2 text-sm border-l border-gray-200 ${sortKey === "items" ? "bg-gray-50" : ""}`}
            title="Sort by items"
          >
            {sortDir === "asc" ? <ArrowUp01 className="h-4 w-4" /> : <ArrowDown10 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setSortKey("updated")}
            className={`px-3 py-2 text-sm border-l border-gray-200 ${sortKey === "updated" ? "bg-gray-50" : ""}`}
            title="Sort by updated"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
          title="Toggle sort direction"
        >
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden md:grid grid-cols-[minmax(220px,1.2fr)_120px_180px_200px] items-center border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
          <div>Name</div>
          <div className="text-center">Items</div>
          <div>Updated</div>
          <div className="text-right">Actions</div>
        </div>
        <ul className="divide-y divide-gray-100">
          {loading && <li className="p-4 text-sm text-gray-500">Loading…</li>}
          {error && <li className="p-4 text-sm text-red-600">{error}</li>}
          {!loading && !error && categories.length === 0 && (
            <li className="p-6 text-sm text-gray-500">No categories found.</li>
          )}

          {categories.map((row) => {
            const itemCount = Array.isArray(row.products) ? row.products.length : Number(row.count) || 0;
            const showDelete = isSuper || isAdmin;
            return (
              <li
                key={row.id}
                className="md:grid md:grid-cols-[minmax(220px,1.2fr)_120px_180px_200px] md:items-center"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 md:py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Tags className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{row.name}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {row.slug && <span className="truncate">/{row.slug}</span>}
                        {row.categoryCol && (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                            {row.categoryCol}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:hidden">
                    <button
                      onClick={() => onEdit(row)}
                      className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {showDelete && (
                      <button
                        onClick={() => askDelete(row)}
                        className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-2 md:py-4 md:text-center">
                  <span className="inline-flex min-w-[3ch] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
                    {itemCount}
                  </span>
                </div>

                <div className="px-4 pb-3 text-sm text-gray-600 md:py-4">
                  {row.updatedAt ? fmtPrettyDate(row.updatedAt) : "—"}
                </div>

                <div className="hidden px-4 py-3 md:flex md:items-center md:justify-end gap-2">
                  <button
                    onClick={() => onEdit(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  {showDelete && (
                    <button
                      onClick={() => askDelete(row)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                      title="Delete category"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={() => fetchCategories(page - 1)}
          disabled={!hasPrev || page <= 1}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
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
              onClick={() => fetchCategories(n)}
              className={
                n === page
                  ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-50"
              }
            >
              {n}
            </button>
          ));
        })()}

        <button
          onClick={() => fetchCategories(page + 1)}
          disabled={!hasNext || page >= totalPages}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
          title="Next"
        >
          Next <span className="opacity-60">›</span>
        </button>
      </div>

      <SimpleModal
        title="New Category"
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={async () => {
          const payload = { name: addForm.name?.trim(), categoryCol: addForm.categoryCol };
          if (!payload.name) { alert("Category name is required"); return; }
          try {
            await api.post("/categories", payload);
            await fetchCategories(page);
            setAddForm({ name: "", slug: "", categoryCol: "GRAIN" });
            setIsAddOpen(false);
          } catch (e) {
            alert(e?.response?.data?.message || e?.message || "Failed to create category");
          }
        }}
        submitLabel="Create"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
            <input
              value={addForm.name}
              onChange={(e) =>
                setAddForm((f) => {
                  const name = e.target.value;
                  return { ...f, name, slug: f.slug ? f.slug : slugify(name) };
                })
              }
              className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Category name (e.g. Rice, Wheat)"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Type (categoryCol)</label>
            <SearchableSelect
              value={addForm.categoryCol}
              onChange={(val) => setAddForm((f) => ({ ...f, categoryCol: val }))}
              options={CATEGORY_OPTIONS}
              placeholder="Select type"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Slug (optional)</label>
            <input
              value={addForm.slug}
              onChange={(e) => setAddForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Slug (e.g. rice, wheat-flour)"
            />
          </div>
        </div>
      </SimpleModal>

      <SimpleModal
        title={`Edit: ${editing?.name ?? ""}`}
        open={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditing(null); }}
        onSubmit={async () => {
          const payload = { name: editForm.name?.trim(), categoryCol: editForm.categoryCol };
          if (!payload.name) { alert("Category name is required"); return; }
          try {
            await api.put(`/categories/${editing.id}`, payload);
            await fetchCategories(page);
            setIsEditOpen(false);
          } catch (e) {
            alert(e?.response?.data?.message || e?.message || "Failed to update category");
          }
        }}
        submitLabel="Save"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
            <input
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => {
                  const name = e.target.value;
                  return { ...f, name, slug: f.slug ? f.slug : slugify(name) };
                })
              }
              className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Category name (e.g. Rice, Wheat)"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Type (categoryCol)</label>
            <SearchableSelect
              value={editForm.categoryCol}
              onChange={(val) => setEditForm((f) => ({ ...f, categoryCol: val }))}
              options={CATEGORY_OPTIONS}
              placeholder="Select type"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Slug (optional)</label>
            <input
              value={editForm.slug}
              onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Slug (e.g. rice, wheat-flour)"
            />
          </div>
        </div>
      </SimpleModal>

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