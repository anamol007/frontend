import React, { useEffect, useMemo, useState } from "react";
import {
  Package,
  MapPin,
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { api } from "../utils/api";
import FormModal from "../components/FormModal";

/* Small chip for a single stock line (qty+unit) with edit/delete on hover) */
function UnitLine({ line, onEdit, onDelete }) {
  return (
    <div className="group inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
      <span className="font-semibold">{line.qty}</span>
      <span className="text-slate-500">{line.unitName || "—"}</span>

      <button
        onClick={onEdit}
        className="ml-1 hidden rounded-md p-1 text-slate-500 hover:bg-white group-hover:block"
        title="Edit"
      >
        <Pencil size={14} />
      </button>

      <button
        onClick={onDelete}
        className="hidden rounded-md p-1 text-rose-600 hover:bg-white group-hover:block"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function StockPage() {
  // data
  const [rows, setRows] = useState([]); // grouped by product -> inventories -> unit lines
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // lookups
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [units, setUnits] = useState([]);

  // ui
  const [q, setQ] = useState("");
  const [openMap, setOpenMap] = useState({}); // productId => bool (expanded)
  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState(null); // {id?, product_id, inventory_id, unit_id, stockQuantity}

  // options
  const productOptions = useMemo(
    () =>
      products
        .slice()
        .sort((a, b) => (a.productName || "").localeCompare(b.productName || ""))
        .map((p) => ({ value: String(p.id), label: p.productName })),
    [products]
  );
  const inventoryOptions = useMemo(
    () =>
      inventories
        .slice()
        .sort((a, b) => (a.inventoryName || "").localeCompare(b.inventoryName || ""))
        .map((i) => ({ value: String(i.id), label: i.inventoryName })),
    [inventories]
  );
  const unitOptions = useMemo(
    () =>
      units
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .map((u) => ({ value: String(u.id), label: u.name })),
    [units]
  );
  const unitLabel = (id) =>
    unitOptions.find((u) => u.value === String(id))?.label ||
    units.find((u) => u.id === id)?.name ||
    "";

  // fields (modal)
  const FIELDS = useMemo(
    () => [
      { name: "product_id", label: "Product", type: "select", required: true, options: productOptions },
      { name: "inventory_id", label: "Inventory", type: "select", required: true, options: inventoryOptions },
      { name: "unit_id", label: "Unit", type: "select", required: true, options: unitOptions },
      { name: "stockQuantity", label: "Quantity", type: "number", required: true, step: "any", min: 0 },
    ],
    [productOptions, inventoryOptions, unitOptions]
  );

  const modalInitial = useMemo(() => {
    if (!editRow) return {};
    return {
      product_id: editRow.product_id ? String(editRow.product_id) : "",
      inventory_id: editRow.inventory_id ? String(editRow.inventory_id) : "",
      unit_id: editRow.unit_id ? String(editRow.unit_id) : "",
      stockQuantity: editRow.stockQuantity ?? editRow.qty ?? "",
    };
  }, [editRow]);

  // load lookups + stock
  async function loadLookups() {
    try {
      const [p, i, u] = await Promise.all([
        api.get("/products"),
        api.get("/inventory"),
        api.get("/units"),
      ]);
      setProducts(p?.data?.data ?? p?.data ?? []);
      setInventories(i?.data?.data ?? i?.data ?? []);
      setUnits(u?.data?.data ?? u?.data ?? []);
    } catch {
      /* ignore */
    }
  }

  async function refresh() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const r = await api.get("/stock");
      const raw = r?.data?.data ?? r?.data ?? [];

      // normalize
      const norm = (Array.isArray(raw) ? raw : []).map((s) => ({
        id: s.id,
        productId: s.product?.id ?? s.productId ?? s.product_id,
        productName: s.product?.productName ?? s.productName,
        inventoryId: s.inventory?.id ?? s.inventoryId ?? s.inventory_id,
        inventoryName: s.inventory?.inventoryName ?? s.inventoryName,
        unitId: s.unit?.id ?? s.unit_id ?? s.unitId,
        unitName: s.unit?.name ?? s.unit ?? "",
        qty: Number(s.stockQuantity ?? s.quantity ?? 0),
      }));

      // group by product -> inventories
      const pMap = new Map();
      norm.forEach((r) => {
        if (!pMap.has(r.productId)) {
          pMap.set(r.productId, {
            productId: r.productId,
            productName: r.productName,
            inventories: new Map(),
          });
        }
        const prod = pMap.get(r.productId);
        if (!prod.inventories.has(r.inventoryId)) {
          prod.inventories.set(r.inventoryId, {
            inventoryId: r.inventoryId,
            inventoryName: r.inventoryName,
            lines: [],
          });
        }
        const inv = prod.inventories.get(r.inventoryId);
        inv.lines.push({
          id: r.id,
          unitId: r.unitId,
          unitName: r.unitName || unitLabel(r.unitId),
          qty: r.qty,
        });
      });

      const grouped = Array.from(pMap.values()).map((prod) => ({
        ...prod,
        inventories: Array.from(prod.inventories.values()).map((inv) => ({
          ...inv,
          // sort lines by unit name for readability
          lines: inv.lines.sort((a, b) => (a.unitName || "").localeCompare(b.unitName || "")),
        })),
      }));

      // sort products & inventories
      grouped.sort((a, b) => (a.productName || "").localeCompare(b.productName || ""));
      grouped.forEach((g) =>
        g.inventories.sort((a, b) => (a.inventoryName || "").localeCompare(b.inventoryName || ""))
      );

      setRows(grouped);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Error fetching stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
    refresh();
  }, []);

  // search
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.productName || "").toLowerCase().includes(s) ||
        r.inventories.some((i) => (i.inventoryName || "").toLowerCase().includes(s))
    );
  }, [rows, q]);

  // CRUD handlers
  async function handleSubmit(form) {
    try {
      setErr("");
      setOk("");
      const payload = {
        product_id: Number(form.product_id),
        inventory_id: Number(form.inventory_id),
        unit_id: Number(form.unit_id),
        stockQuantity: Number(form.stockQuantity),
      };

      if (editRow?.id) {
        await api.put(`/stock/${editRow.id}`, payload);
        setOk("Stock updated");
      } else {
        await api.post("/stock", payload);
        setOk("Stock created");
      }
      setOpen(false);
      setEditRow(null);
      refresh();
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "Stock quantity, unit ID, product ID, and inventory ID are required"
      );
    }
  }

  async function deleteLine(id) {
    const sure = window.confirm("Delete this stock line?");
    if (!sure) return;
    try {
      setErr("");
      setOk("");
      await api.delete(`/stock/${id}`);
      setOk("Stock deleted");
      refresh();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Delete failed");
    }
  }

  // UI helpers
  const toggle = (pid) => setOpenMap((m) => ({ ...m, [pid]: !m[pid] }));

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Stock</h1>
            <p className="text-sm text-slate-500">
              Products are shown once. Hover or expand to see per-inventory quantities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products or inventories…"
                className="w-64 bg-transparent outline-none"
              />
            </div>

            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw size={16} /> Refresh
            </button>

            <button
              onClick={() => {
                setEditRow(null);
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} /> New Stock
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            {err}
          </div>
        )}
        {ok && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            {ok}
          </div>
        )}
      </div>

      {/* list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          No stock records found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((prod) => {
            const isOpen = !!openMap[prod.productId];
            return (
              <div
                key={prod.productId}
                className="group rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                {/* Product header row */}
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                    <Package size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-slate-900">
                      {prod.productName}
                    </div>
                    <div className="text-xs text-slate-400">
                      Hover or expand to see inventories
                    </div>
                  </div>

                  <button
                    onClick={() => toggle(prod.productId)}
                    className={`rounded-xl border px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 ${
                      isOpen ? "rotate-180" : ""
                    } transition`}
                    title={isOpen ? "Collapse" : "Expand"}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Inventories list – shown on hover OR when toggled open */}
                <div
                  className={`mt-3 hidden gap-3 group-hover:block ${
                    isOpen ? "!block" : ""
                  }`}
                >
                  {prod.inventories.map((inv) => (
                    <div
                      key={inv.inventoryId}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin size={16} />
                          <span className="font-medium text-slate-800">
                            {inv.inventoryName}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setEditRow({
                              product_id: prod.productId,
                              inventory_id: inv.inventoryId,
                              unit_id: "",
                              stockQuantity: "",
                            });
                            setOpen(true);
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          Add unit
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {inv.lines.length === 0 ? (
                          <span className="text-sm text-slate-400">
                            No units yet.
                          </span>
                        ) : (
                          inv.lines.map((line) => (
                            <UnitLine
                              key={line.id}
                              line={line}
                              onEdit={() => {
                                setEditRow({
                                  id: line.id,
                                  product_id: prod.productId,
                                  inventory_id: inv.inventoryId,
                                  unit_id: line.unitId,
                                  stockQuantity: line.qty,
                                });
                                setOpen(true);
                              }}
                              onDelete={() => deleteLine(line.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <FormModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditRow(null);
        }}
        title={editRow?.id ? "Edit Stock" : "Add Stock"}
        fields={FIELDS}
        initial={modalInitial}
        onSubmit={handleSubmit}
        submitLabel={editRow?.id ? "Update" : "Save"}
      />
    </div>
  );
}