// src/pages/StockPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  RefreshCw,
  Building2,
  Layers,
  X,
} from "lucide-react";
import { api } from "../utils/api";

/* ---------- helpers ---------- */
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const prettyDateTime = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  const M = dt.toLocaleString(undefined, { month: "short" });
  const D = ordinal(dt.getDate());
  const Y = dt.getFullYear();
  const T = dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${M} ${D}, ${Y}, ${T}`;
};

const normAgg = (row = {}) => {
  const pid = row.product_id ?? (row.product?.id ?? null);
  const iid = row.inventory_id ?? (row.inventory?.id ?? null);
  const uid = row.unit_id ?? (row.unit?.id ?? null);

  const avail = Number(row.availableQuantity ?? row.totalAvailableQuantity ?? row.stockQuantity ?? 0);

  return {
    key: `${pid ?? "p"}-${iid ?? "i"}-${uid ?? "u"}`,
    product_id: pid,
    inventory_id: iid,
    unit_id: uid,
    productName: row.product?.productName ?? row.productName ?? `#${pid ?? ""}`,
    inventoryName: row.inventory?.inventoryName ?? row.inventoryName ?? `#${iid ?? ""}`,
    unitName: row.unit?.name ?? row.unitName ?? `#${uid ?? ""}`,
    stockQuantity: avail,
    updatedAt: row.updatedAt ?? row.lastUpdated ?? null,
  };
};

/* ---------- Modal (plain, like InventoriesPage) ---------- */
function PlainModal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[min(920px,96vw)] rounded-2xl border bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded p-2 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function StockPage() {
  // auth
  const [me, setMe] = useState(null);
  const isSuper = (me?.role || "") === "superadmin";

  // data & refs
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // filters + disclosure
  const [q, setQ] = useState("");
  const [invFilter, setInvFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [openKeys, setOpenKeys] = useState(new Set());

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("create"); // 'create' only used; keep edit guard
  const [initial, setInitial] = useState({});
  const [prefill, setPrefill] = useState(null);

  // fetch user
  async function fetchMe() {
    try {
      const r = await api.get("/users/verify-token");
      const u = r?.data?.data?.user || r?.data?.user || r?.data;
      setMe(u || null);
    } catch {
      setMe(null);
    }
  }

  // fetch lists: stock + full reference lists
  async function fetchAll() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      // stock aggregated rows
      const r = await api.get("/stock/");
      const list = Array.isArray(r?.data?.data) ? r.data.data : r?.data ?? [];
      const normalized = Array.isArray(list) ? list.map(normAgg) : [];
      normalized.sort((a, b) => String(a.productName || "").localeCompare(String(b.productName || "")));
      setRows(normalized);

      // fetch references explicitly so selects show all inventories/products/units
      // (This fixes the earlier issue where selects were derived only from `rows` and could miss inventories.)
      const [prodRes, invRes, unitRes] = await Promise.allSettled([
        api.get("/products/"),
        api.get("/inventory/"),
        api.get("/units/"),
      ]);

      const pick = (r) => {
        if (!r || r.status !== "fulfilled") return [];
        const root = r.value?.data ?? r.value;
        return Array.isArray(root.data) ? root.data : Array.isArray(root) ? root : (Array.isArray(r.value?.data) ? r.value.data : []);
      };

      setProducts(pick(prodRes));
      setInventories(pick(invRes));
      setUnits(pick(unitRes));
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Error fetching data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived grouping (product -> stocks)
  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (invFilter && String(r.inventory_id) !== String(invFilter)) return;
      if (unitFilter && String(r.unit_id) !== String(unitFilter)) return;

      const term = q.trim().toLowerCase();
      if (term) {
        const hay = `${r.productName || ""} ${r.inventoryName || ""} ${r.unitName || ""}`.toLowerCase();
        if (!hay.includes(term)) return;
      }

      if (!map.has(r.product_id)) {
        map.set(r.product_id, {
          productId: r.product_id,
          productName: r.productName,
          description: "",
          stocks: [],
          updatedAt: r.updatedAt,
        });
      }
      map.get(r.product_id).stocks.push(r);
    });

    const out = Array.from(map.values());
    out.forEach((g) => {
      g.inventoriesCount = new Set(g.stocks.map((s) => s.inventory_id)).size;
      g.unitsCount = new Set(g.stocks.map((s) => s.unit_id)).size;
      g.rowsCount = g.stocks.length;
      const ts = g.stocks.map((s) => s.updatedAt).filter(Boolean).map((d) => +new Date(d));
      g.updatedAt = ts.length ? new Date(Math.max(...ts)).toISOString() : g.updatedAt;
    });
    out.sort((a, b) => String(a.productName || "").localeCompare(String(b.productName || "")));
    return out;
  }, [rows, q, invFilter, unitFilter]);

  // expand/collapse helpers
  const allOpen = grouped.length > 0 && grouped.every((g) => openKeys.has(g.productId));
  const toggleAll = () => setOpenKeys(allOpen ? new Set() : new Set(grouped.map((g) => g.productId)));
  const toggleOne = (pid) => {
    const s = new Set(openKeys);
    if (s.has(pid)) s.delete(pid);
    else s.add(pid);
    setOpenKeys(s);
  };

  // selects built from fetched reference lists (ensures all inventories show)
  const productOptions = useMemo(() => (Array.isArray(products) ? products.map((p) => ({ value: p.id, label: p.productName ?? p.name ?? `#${p.id}` })) : []), [products]);
  const inventoryOptions = useMemo(() => (Array.isArray(inventories) ? inventories.map((i) => ({ value: i.id, label: i.inventoryName ?? i.name ?? `#${i.id}` })) : []), [inventories]);
  const unitOptions = useMemo(() => (Array.isArray(units) ? units.map((u) => ({ value: u.id, label: u.unitName ?? u.name ?? `#${u.id}` })) : []), [units]);

  // open create modal (prefill optional)
  function openCreate(pref = null) {
    if (!isSuper) {
      setErr("Only Super Admin can create stock transactions");
      return;
    }
    setPrefill(pref);
    setMode("create");
    setInitial({
      product_id: pref?.product_id ?? "",
      inventory_id: pref?.inventory_id ?? "",
      unit_id: pref?.unit_id ?? "",
      stockQuantity: "",
      notes: "",
      method: "damage", // default method: damage or transfer (supplier removed)
      targetInventoryId: "",
    });
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setInitial({});
    setPrefill(null);
  }

  // submit create (method choices: 'damage' or 'transfer' only)
  async function handleSubmit(payload) {
    try {
      setErr("");
      setOk("");

      if (mode === "edit") {
        setErr("Editing stock is disabled.");
        return;
      }

      // method handling
      const m = String(payload.method || "damage"); // 'damage' | 'transfer'
      // For damage -> out, transfer -> out (source). Backend should handle transfer destination logic with targetInventoryId.
      const in_out = m === "damage" ? "out" : "out";

      let targetInventoryId = undefined;
      if (m === "transfer") {
        targetInventoryId = payload.targetInventoryId ?? null;
        const src = String(payload.inventory_id || "");
        if (!targetInventoryId || String(targetInventoryId) === src) {
          setErr("Please choose a Target Inventory for transfer (must differ from source).");
          return;
        }
      }

      await api.post("/stock", {
        product_id: Number(payload.product_id),
        inventory_id: Number(payload.inventory_id),
        unit_id: Number(payload.unit_id),
        stockQuantity: Number(payload.stockQuantity),
        method: m,
        in_out,
        targetInventoryId: m === "transfer" ? Number(targetInventoryId) : undefined,
        notes: payload.notes || undefined,
      });

      setOk("Stock transaction recorded");
      closeModal();
      await fetchAll();
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Save failed");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
              <Boxes size={20} /> Stock
            </h1>
            <p className="text-sm text-slate-500">
              {isSuper
                ? "Record damaged write-offs or transfers. Aggregates are server-calculated."
                : "View-only snapshot from /stock."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search product / inventory / unit…"
                className="w-64 bg-transparent outline-none text-sm"
              />
            </div>

            {/* Plain selects (not searchable) populated from explicit API fetches */}
            <select
              value={invFilter}
              onChange={(e) => setInvFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">All inventories</option>
              {inventoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm outline-none"
            >
              <option value="">All units</option>
              {unitOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              onClick={fetchAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            {isSuper && (
              <button
                onClick={() => openCreate(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
              >
                <Plus size={16} /> New Stock
              </button>
            )}
          </div>
        </div>

        {(err || ok) && (
          <div className="mt-3">
            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
            {ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
          </div>
        )}
      </div>

      {/* Expand/Collapse all */}
      <div className="flex justify-end">
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          {allOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur">
        {/* header */}
        <div className="grid grid-cols-[32px_1.2fr_.7fr_.7fr_.8fr_.9fr] items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span />
          <span className="flex items-center gap-2">
            <Boxes size={14} /> Product
          </span>
          <span className="hidden sm:block">Inventories</span>
          <span className="hidden sm:block">Units</span>
          <span>Rows</span>
          <span className="text-right">Last Update</span>
        </div>

        {/* rows */}
        {loading ? (
          <div className="p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="mb-2 h-12 animate-pulse rounded-xl border border-slate-200 bg-white/60" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {grouped.map((g) => {
              const isOpen = openKeys.has(g.productId);
              return (
                <li key={g.productId}>
                  <div className="grid grid-cols-[32px_1.2fr_.7fr_.7fr_.8fr_.9fr] items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition">
                    <button
                      onClick={() => toggleOne(g.productId)}
                      className="grid h-8 w-8 place-items-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{g.productName}</div>
                    </div>

                    <div className="hidden sm:block">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        <Building2 size={12} /> {g.inventoriesCount}
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        <Layers size={12} /> {g.unitsCount}
                      </span>
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">Rows {g.rowsCount}</span>
                    </div>

                    <div className="text-right text-xs text-slate-500">{prettyDateTime(g.updatedAt)}</div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                        <div className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr] items-center gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <span>Inventory</span>
                          <span>Unit</span>
                          <span>Quantity</span>
                          <span>Updated</span>
                        </div>

                        {g.stocks.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-slate-500">No stock rows for this product.</div>
                        ) : (
                          g.stocks.map((row) => (
                            <div key={row.key} className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr] items-center gap-3 border-t border-slate-200 px-3 py-2.5">
                              <div className="min-w-0">
                                <div className="truncate text-sm text-slate-800">{row.inventoryName}</div>
                              </div>
                              <div className="text-sm text-slate-700">{row.unitName}</div>
                              <div className="text-sm font-semibold text-slate-900">{row.stockQuantity}</div>
                              <div className="text-xs text-slate-500">{prettyDateTime(row.updatedAt)}</div>
                            </div>
                          ))
                        )}
                      </div>

                      {isSuper && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => openCreate({ product_id: g.productId })}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                          >
                            <Plus size={16} /> Add stock for “{g.productName}”
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}

            {grouped.length === 0 && !loading && <li className="px-4 py-6 text-center text-slate-500">No matches. Try different filters or search.</li>}
          </ul>
        )}
      </div>

      {/* Modal (plain) */}
      <PlainModal open={modalOpen} title={mode === "create" ? "New Stock Transaction" : "Edit Stock"} onClose={closeModal}>
        {/* form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // gather form values from inputs by name
            const fd = new FormData(e.currentTarget);
            const payload = {
              product_id: fd.get("product_id"),
              inventory_id: fd.get("inventory_id"),
              unit_id: fd.get("unit_id"),
              stockQuantity: fd.get("stockQuantity"),
              notes: fd.get("notes"),
              method: fd.get("method"),
              targetInventoryId: fd.get("targetInventoryId"),
            };
            handleSubmit(payload);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Product *</label>
              <select name="product_id" defaultValue={initial.product_id ?? ""} required className="w-full rounded-2xl border px-3 py-2 outline-none mt-1">
                <option value="" disabled>
                  Select product…
                </option>
                {productOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Inventory (source) *</label>
              <select name="inventory_id" defaultValue={initial.inventory_id ?? ""} required className="w-full rounded-2xl border px-3 py-2 outline-none mt-1">
                <option value="" disabled>
                  Select inventory…
                </option>
                {inventoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Unit *</label>
              <select name="unit_id" defaultValue={initial.unit_id ?? ""} required className="w-full rounded-2xl border px-3 py-2 outline-none mt-1">
                <option value="" disabled>
                  Select unit…
                </option>
                {unitOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Method *</label>
              {/* Supplier removed per request — only 'damage' and 'transfer' */}
              <select name="method" defaultValue={initial.method ?? "damage"} required className="w-full rounded-2xl border px-3 py-2 outline-none mt-1">
                <option value="damage">Damaged / Write-off (out)</option>
                <option value="transfer">Transfer to another inventory (out from source)</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Quantity *</label>
              <input name="stockQuantity" type="number" step="0.01" defaultValue={initial.stockQuantity ?? ""} min="0" required className="w-full rounded-2xl border px-3 py-2 outline-none mt-1" placeholder="0.00" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
              <input name="notes" type="text" defaultValue={initial.notes ?? ""} className="w-full rounded-2xl border px-3 py-2 outline-none mt-1" placeholder="Any remarks…" />
            </div>

            {/* Transfer-only target inventory */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Target Inventory (destination) — required only for transfer</label>
              <select name="targetInventoryId" defaultValue={initial.targetInventoryId ?? ""} className="w-full rounded-2xl border px-3 py-2 outline-none mt-1">
                <option value="">Select target inventory…</option>
                {inventoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">If method is Transfer, pick a destination inventory different from the source.</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="rounded-xl border px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Save
            </button>
          </div>
        </form>
      </PlainModal>
    </div>
  );
}