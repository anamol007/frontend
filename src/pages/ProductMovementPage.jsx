// src/pages/ProductMovementPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, Search as SearchIcon } from "lucide-react";
import { api } from "../utils/api";

/* helpers */
const ordinalSuffix = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const formatPrettyDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(+d)) return "—";
  const day = ordinalSuffix(d.getDate());
  const mon = d.toLocaleString(undefined, { month: "short" });
  const year = d.getFullYear();
  return `${day} ${mon}, ${year}`;
};
const safeName = (obj, ...keys) => {
  if (!obj) return "—";
  for (const k of keys) if (obj[k] != null) return obj[k];
  return obj.name ?? obj.unitName ?? obj.inventoryName ?? Object.values(obj)[0] ?? "—";
};

/* small searchable select component */
function SearchableSelect({ value, onChange, options = [], placeholder = "Select…", className = "" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const normalized = useMemo(
    () => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
    [options]
  );

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return normalized;
    return normalized.filter(
      (o) => (o.label || "").toLowerCase().includes(s) || String(o.value).toLowerCase().includes(s)
    );
  }, [q, normalized]);

  const selected = normalized.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm flex items-center justify-between"
      >
        <span className={`truncate ${selected ? "" : "text-gray-400"}`}>{selected ? selected.label : placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl border bg-white shadow">
          <div className="p-2">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                className="w-full rounded-md border px-10 py-2 text-sm outline-none"
                placeholder="Search..."
              />
            </div>
          </div>

          <div className="max-h-44 overflow-auto">
            {filtered.length === 0 && <div className="p-3 text-sm text-gray-500">No options</div>}
            {filtered.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* main component */
export default function ProductMovementPage() {
  const [inventories, setInventories] = useState([]);
  const [products, setProducts] = useState([]);
  const [globalUnits, setGlobalUnits] = useState([]);

  const [inventoryId, setInventoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({ totalInQuantity: null, totalOutQuantity: null, netQuantity: null });
  const [counts, setCounts] = useState({ stockMovements: 0, orders: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const PER_PAGE = 20;
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const [invRes, prodRes, unitRes] = await Promise.allSettled([
          api.get("/inventory/"),
          api.get("/products/"),
          api.get("/units/"),
        ]);
        if (!mountedRef.current) return;

        const pick = (r) => {
          if (!r || r.status !== "fulfilled") return [];
          const root = r.value?.data ?? {};
          if (Array.isArray(root.data)) return root.data;
          if (Array.isArray(root.rows)) return root.rows;
          if (Array.isArray(r.value?.data)) return r.value.data;
          return [];
        };

        setInventories(pick(invRes));
        setProducts(pick(prodRes));
        setGlobalUnits(
          pick(unitRes).map((u) => ({ id: u.id ?? u.unit_id ?? u.unitId, name: safeName(u, "name", "unitName") }))
        );
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const unitsToShow = useMemo(() => globalUnits, [globalUnits]);

  const selectedProductName = useMemo(() => {
    if (!productId) return null;
    const p = products.find((x) => String(x.id) === String(productId));
    return p ? safeName(p, "productName", "name") : null;
  }, [productId, products]);

  const selectedUnitName = useMemo(() => {
    if (!unitId) return null;
    const u = unitsToShow.find((x) => String(x.id) === String(unitId));
    return u ? u.name ?? "—" : null;
  }, [unitId, unitsToShow]);

  function validate() {
    if (dateFrom && isNaN(new Date(dateFrom).getTime())) {
      setErr("Invalid From date");
      return false;
    }
    if (dateTo && isNaN(new Date(dateTo).getTime())) {
      setErr("Invalid To date");
      return false;
    }
    setErr("");
    return true;
  }

  async function fetchHistory(nextPage = 1) {
    if (!validate()) return;
    setLoading(true);
    setErr("");
    setHistory([]);
    setSummary({ totalInQuantity: null, totalOutQuantity: null, netQuantity: null });
    setCounts({ stockMovements: 0, orders: 0, total: 0 });
    setHasNext(false);
    setHasPrev(false);

    try {
      const params = { page: nextPage, limit: PER_PAGE };
      if (inventoryId) params.inventoryId = inventoryId;
      if (productId) params.productId = productId;
      if (unitId) params.unit_id = unitId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await api.get("/stock/history/product", { params });
      const root = res?.data ?? {};
      const d = root.data ?? root;

      const maybeHistory = Array.isArray(d.history)
        ? d.history
        : Array.isArray(d.rows)
        ? d.rows
        : Array.isArray(d.data)
        ? d.data
        : Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.rows)
        ? root.rows
        : Array.isArray(res?.data)
        ? res.data
        : [];

      const summaryObj = d.summary ?? root.summary ?? null;
      const hc = d.historyCount ?? d.counts ?? root.counts ?? { stockMovements: 0, orders: 0, total: maybeHistory.length };

      const pagination = d.pagination ?? root.pagination ?? null;

      setHistory(maybeHistory || []);
      setSummary(summaryObj ? summaryObj : { totalInQuantity: null, totalOutQuantity: null, netQuantity: null });
      setCounts(hc);
      setPage(Number(nextPage || 1));

      if (pagination) {
        setHasNext(Boolean(pagination.hasNextPage ?? (pagination.page < pagination.pages)));
        setHasPrev(Boolean(pagination.hasPrevPage ?? (pagination.page > 1)));
      } else {
        setHasPrev(nextPage > 1);
        setHasNext((maybeHistory?.length ?? 0) >= PER_PAGE);
      }

      if ((maybeHistory || []).length === 0) {
        console.info("No history rows parsed. Raw response:", res?.data ?? res);
      }
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Failed to fetch history");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function exportCSV() {
    if (!history.length) return alert("No rows to export");
    const headers = ["id", "date", "product", "unit", "type", "method", "direction", "quantity", "runningBalance", "notes"];
    const rows = history.map((r) => ({
      id: r.id ?? r.historyId ?? "",
      date: r.date ?? r.createdAt ?? r.created_at ?? "",
      product: r.product?.productName ?? r.productName ?? r.product?.name ?? (r.productId ? `#${r.productId}` : ""),
      unit: r.unit?.name ?? r.unitName ?? r.unit_id ?? "",
      type: r.type ?? (r.method ? "stock" : ""),
      method: r.method ?? "",
      direction: r.direction ?? (r.in_out === "in" ? "IN" : r.in_out === "out" ? "OUT" : ""),
      quantity: r.quantity ?? r.stockQuantity ?? "",
      runningBalance: r.runningBalance ?? r.running_balance ?? "",
      notes: r.notes ?? r.description ?? "",
    }));

    const esc = (v) => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = [headers.join(",")].concat(rows.map((row) => headers.map((h) => esc(row[h])).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product_movement_${inventoryId || "all"}_${productId || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printTable() {
    if (!history.length) return alert("No rows to print");
    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up blocked");
    const rowsHtml = history
      .map(
        (it) => `<tr>
        <td>${it.id ?? ""}</td>
        <td>${formatPrettyDate(it.date ?? it.createdAt ?? it.created_at)}</td>
        <td>${it.product?.productName ?? it.productName ?? it.product?.name ?? (it.productId ? `#${it.productId}` : "")}</td>
        <td>${it.unit?.name ?? it.unitName ?? it.unit_id ?? ""}</td>
        <td>${it.type ?? (it.method ? "stock" : "")}</td>
        <td>${it.method ?? ""}</td>
        <td>${it.direction ?? (it.in_out === "in" ? "IN" : it.in_out === "out" ? "OUT" : "")}</td>
        <td style="text-align:right">${it.quantity ?? it.stockQuantity ?? ""}</td>
        <td style="text-align:right">${it.runningBalance ?? it.running_balance ?? ""}</td>
        <td>${it.notes ?? it.description ?? ""}</td>
      </tr>`
      )
      .join("");
    w.document.write(
      `<html><head><title>Product movement</title><style>body{font-family:Inter,Arial,Helvetica,sans-serif;margin:18px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #eef2f6;padding:10px}th{background:#f8fafc;text-align:left}</style></head><body><h3>Product movement</h3><table><thead><tr><th>#</th><th>Date</th><th>Product</th><th>Unit</th><th>Type</th><th>Method</th><th>Dir</th><th>Qty</th><th>Running</th><th>Notes</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`
    );
    w.document.close();
    w.print();
  }

  function clearFilters() {
    setInventoryId("");
    setProductId("");
    setUnitId("");
    setDateFrom("");
    setDateTo("");
    setErr("");
    setHistory([]);
    setSummary({ totalInQuantity: null, totalOutQuantity: null, netQuantity: null });
    setCounts({ stockMovements: 0, orders: 0, total: 0 });
    setPage(1);
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Product movement</h1>
          <p className="mt-1 text-sm text-slate-500">Complete stock & order history. Leave product empty to list all products.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            title="Export CSV"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-100 hover:shadow"
            disabled={loading}
          >
            <Download size={16} /> CSV
          </button>

          <button
            title="Print"
            onClick={printTable}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-100 hover:shadow"
            disabled={loading}
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-6 items-end">
        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Inventory</label>
          <SearchableSelect
            value={inventoryId}
            onChange={setInventoryId}
            options={[{ value: "", label: "All inventories" }, ...inventories.map((inv) => ({ value: inv.id, label: safeName(inv, "inventoryName", "name") }))]}
            placeholder="All inventories"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Product</label>
          <SearchableSelect
            value={productId}
            onChange={setProductId}
            options={[{ value: "", label: "All products" }, ...products.map((p) => ({ value: p.id, label: safeName(p, "productName", "name") }))]}
            placeholder="All products"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Unit</label>
          <SearchableSelect
            value={unitId}
            onChange={setUnitId}
            options={[{ value: "", label: "Any unit" }, ...unitsToShow.map((u) => ({ value: u.id, label: u.name }))]}
            placeholder="Any unit"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Date from</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Date to</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          />
        </div>

        <div className="md:col-span-1 flex items-center gap-2">
          <button
            onClick={() => fetchHistory(1)}
            title="Search"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            disabled={loading}
          >
            <SearchIcon size={16} /> Search
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500">Total In</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{summary?.totalInQuantity != null ? Number(summary.totalInQuantity).toFixed(2) : "0.00"}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500">Total Out</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{summary?.totalOutQuantity != null ? Number(summary.totalOutQuantity).toFixed(2) : "0.00"}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500">Net</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{summary?.netQuantity != null ? Number(summary.netQuantity).toFixed(2) : "0.00"}</div>
        </div>
      </div>

      <div className="mt-4 text-sm text-slate-600">Stock movements: {counts.stockMovements} • Orders: {counts.orders} • Total: {counts.total}</div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No history rows found. Use filters and click <span className="font-medium">Search</span>.
            <div className="mt-2">
              <button onClick={clearFilters} className="rounded-md bg-white px-3 py-1 text-sm border">Clear filters</button>
            </div>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left font-medium">Date</th>
                  <th className="px-6 py-4 text-left font-medium">Product</th>
                  <th className="px-6 py-4 text-left font-medium">Unit</th>
                  <th className="px-6 py-4 text-left font-medium">Type</th>
                  <th className="px-6 py-4 text-right font-medium">Qty</th>
                  <th className="px-6 py-4 text-right font-medium">Running</th>
                  <th className="px-6 py-4 text-left font-medium">Notes / Order</th>
                </tr>
              </thead>
              <tbody>
                {history.map((it, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-6 py-4 align-top">{formatPrettyDate(it.date ?? it.createdAt ?? it.created_at)}</td>
                    <td className="px-6 py-4 align-top">
                      {it.product?.productName ?? it.productName ?? it.product?.name ?? (productId ? (selectedProductName ?? `#${productId}`) : (it.productId ? `#${it.productId}` : "—"))}
                    </td>
                    <td className="px-6 py-4 align-top">
                      {it.unit?.name ?? it.unitName ?? it.unit_id ?? (unitId ? (selectedUnitName ?? `#${unitId}`) : "—")}
                    </td>
                    <td className="px-6 py-4 align-top">{it.type ?? (it.method ? "stock" : "")}{it.method ? ` • ${it.method}` : ""}</td>
                    <td className="px-6 py-4 text-right align-top">{it.quantity != null ? Number(it.quantity).toFixed(2) : (it.stockQuantity != null ? Number(it.stockQuantity).toFixed(2) : "—")}</td>
                    <td className="px-6 py-4 text-right align-top">{it.runningBalance != null ? Number(it.runningBalance).toFixed(2) : (it.running_balance != null ? Number(it.running_balance).toFixed(2) : "—")}</td>
                    <td className="px-6 py-4 align-top">
                      {(it.type === "order" || it.orderId || it.order_id) ? (
                        <>
                          <div className="font-medium">#{it.orderId ?? it.order_id}</div>
                          <div className="mt-1 text-xs text-slate-500">{it.customerName ?? it.customer?.fullname ?? ""}</div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-600">{it.notes ?? it.description ?? ""}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={() => { if (hasPrev) fetchHistory(page - 1); }}
          disabled={!hasPrev || loading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40"
        >
          Prev
        </button>

        <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">{page}</div>

        <button
          onClick={() => { if (hasNext) fetchHistory(page + 1); }}
          disabled={!hasNext || loading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}