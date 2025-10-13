// src/pages/CategoriesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Layers,
  Tags,
  ArrowUpAZ,
  ArrowDownAZ,
  ArrowUp01,
  ArrowDown10,
} from "lucide-react";
import { api } from "../utils/api";

/* ---------- helpers ---------- */
const slugify = (s) =>
  s?.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "";

const CATEGORY_OPTIONS = ["GRAIN", "VEGETABLE", "FRUIT", "DAIRY", "MEAT", "OTHER"];

function normalizeCategoriesResponse(res) {
  const root = res?.data ?? res;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.items)) return root.items;
  if (root?.data && !Array.isArray(root.data)) return [root.data];
  return [];
}

/* ---------- Simple modal ---------- */
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

/* ---------- Stat badge ---------- */
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

/* ---------- Page ---------- */
export default function CategoriesPage() {
  // auth / role
  const [me, setMe] = useState(null);
  const isSuper = me?.role === "superadmin";
  const isAdmin = me?.role === "admin";

  // query / sort
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("name"); // name | items | updated
  const [sortDir, setSortDir] = useState("asc");  // asc | desc

  // modals + forms
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", slug: "", categoryCol: "GRAIN" });
  const [editForm, setEditForm] = useState({ name: "", slug: "", categoryCol: "GRAIN" });

  // data & status
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // stats
  const [stats, setStats] = useState([
    { icon: Tags, label: "Categories", value: "—", tone: "indigo" },
    { icon: Layers, label: "Items", value: "—", tone: "emerald" },
    { icon: RefreshCw, label: "Synced", value: "100%", tone: "indigo" },
  ]);

  // pagination
  const PER_PAGE = 5;
  const [page, setPage] = useState(1);

  // fetch me
  async function fetchMe() {
    try {
      const r = await api.get("/users/verify-token");
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }

  // refetch categories
  const refetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get("/categories");
      const arr = normalizeCategoriesResponse(res);
      setCategories(Array.isArray(arr) ? arr : []);

      const total = arr.length;
      const totalItems = arr.reduce(
        (acc, c) => acc + (Array.isArray(c.products) ? c.products.length : Number(c.count) || 0),
        0
      );
      setStats([
        { icon: Tags, label: "Categories", value: String(total), tone: "indigo" },
        { icon: Layers, label: "Items", value: String(totalItems), tone: "emerald" },
        { icon: RefreshCw, label: "Synced", value: "100%", tone: "indigo" },
      ]);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  // bootstrap
  useEffect(() => { fetchMe(); refetchCategories(); }, []);

  // filter/sort
  const filtered = useMemo(() => {
    const arr = Array.isArray(categories) ? categories : [];
    const q = query.trim().toLowerCase();
    const base = q ? arr.filter((c) => String(c.name || "").toLowerCase().includes(q)) : arr;

    const copy = Array.from(base);
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return String(a.name || "").localeCompare(String(b.name || "")) * dir;
      if (sortKey === "items") {
        const av = Array.isArray(a.products) ? a.products.length : Number(a.count) || 0;
        const bv = Array.isArray(b.products) ? b.products.length : Number(b.count) || 0;
        return (av - bv) * dir;
      }
      if (sortKey === "updated") {
        const av = new Date(a.updatedAt || 0).getTime();
        const bv = new Date(b.updatedAt || 0).getTime();
        return (av - bv) * dir;
      }
      return 0;
    });
    return copy;
  }, [categories, query, sortKey, sortDir]);

  // compute pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, currentPage]);

  // actions
  const onEdit = (row) => {
    setEditing(row || {});
    setEditForm({
      name: row?.name || "",
      slug: row?.slug || "",
      categoryCol: row?.categoryCol || "GRAIN",
    });
    setIsEditOpen(true);
  };

  const onDelete = async (row) => {
    if (!isSuper) return; // admins cannot delete
    const hasProducts = Array.isArray(row?.products) && row.products.length > 0;
    if (hasProducts) {
      alert(
        `Cannot delete "${row.name}" because it has ${row.products.length} product${
          row.products.length > 1 ? "s" : ""
        }. Please delete or reassign products first.`
      );
      return;
    }
    if (!window.confirm(`Delete category "${row?.name}"?`)) return;
    try {
      await api.delete(`/categories/${row.id}`);
      await refetchCategories();
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Failed to delete category");
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Categories</h1>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> New Category
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch mb-6">
        {stats.map((s, i) => (
          <StatBadge key={i} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>

      {/* Search + Sort */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Search categories..."
          />
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Table */}
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
          {!loading && !error && paged.length === 0 && (
            <li className="p-6 text-sm text-gray-500">No categories found.</li>
          )}

          {paged.map((row) => {
            const itemCount = Array.isArray(row.products) ? row.products.length : Number(row.count) || 0;
            const cannotDelete = itemCount > 0;
            const showDelete = isSuper; // admins cannot delete
            return (
              <li key={row.id} className="md:grid md:grid-cols-[minmax(220px,1.2fr)_120px_180px_200px] md:items-center">
                {/* Name */}
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

                  {/* Mobile actions */}
                  <div className="flex items-center gap-2 md:hidden">
                    <button
                      onClick={() => onEdit(row)}
                      className="rounded-lg border border-gray-200 bg-white p-2 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {showDelete && (
                      <button
                        onClick={() => onDelete(row)}
                        disabled={cannotDelete}
                        title={cannotDelete ? "Cannot delete: category has products" : "Delete"}
                        className={[
                          "rounded-lg border p-2",
                          cannotDelete
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "border-gray-200 bg-white hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="px-4 pb-2 md:py-4 md:text-center">
                  <span className="inline-flex min-w-[3ch] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
                    {itemCount}
                  </span>
                </div>

                {/* Updated */}
                <div className="px-4 pb-3 text-sm text-gray-600 md:py-4">
                  {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                </div>

                {/* Desktop actions */}
                <div className="hidden px-4 py-3 md:flex md:items-center md:justify-end gap-2">
                  <button
                    onClick={() => onEdit(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  {showDelete && (
                    <button
                      onClick={() => onDelete(row)}
                      disabled={cannotDelete}
                      title={cannotDelete ? "Cannot delete: category has products" : "Delete"}
                      className={[
                        "inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium",
                        cannotDelete
                          ? "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "border border-red-200 bg-white text-red-600 hover:bg-red-50",
                      ].join(" ")}
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

      {/* Pagination — compact to match other pages */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {/* Prev */}
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
          title="Previous"
        >
          <span className="opacity-60">‹</span> Prev
        </button>

        {/* number chips: current, plus neighbor */}
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
                  : "rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-50"
              }
            >
              {n}
            </button>
          ));
        })()}

        {/* Next */}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
          title="Next"
        >
          Next <span className="opacity-60">›</span>
        </button>
      </div>

      {/* Add Modal */}
      <SimpleModal
        title="New Category"
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={async () => {
          const payload = { name: addForm.name?.trim(), categoryCol: addForm.categoryCol };
          if (!payload.name) {
            alert("Category name is required");
            return;
          }
          try {
            await api.post("/categories", payload);
            await refetchCategories();
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
            <select
              value={addForm.categoryCol}
              onChange={(e) => setAddForm((f) => ({ ...f, categoryCol: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Example: <span className="font-medium">GRAIN</span>
            </p>
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

      {/* Edit Modal */}
      <SimpleModal
        title={`Edit: ${editing?.name ?? ""}`}
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditing(null);
        }}
        onSubmit={async () => {
          const payload = { name: editForm.name?.trim(), categoryCol: editForm.categoryCol };
          if (!payload.name) {
            alert("Category name is required");
            return;
          }
          try {
            await api.put(`/categories/${editing.id}`, payload);
            await refetchCategories();
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
            <select
              value={editForm.categoryCol}
              onChange={(e) => setEditForm((f) => ({ ...f, categoryCol: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Example: <span className="font-medium">GRAIN</span>
            </p>
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
    </div>
  );
}