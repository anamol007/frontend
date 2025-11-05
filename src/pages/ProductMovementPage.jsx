// src/pages/ProductMovementPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer, X, Search as SearchIcon } from "lucide-react";
import { api } from "../utils/api";

/* ---------- helpers ---------- */
function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function formatPrettyDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(+d)) return "—";
  const day = ordinalSuffix(d.getDate());
  const mon = d.toLocaleString(undefined, { month: "short" });
  const year = d.getFullYear();
  return `${day} ${mon}, ${year}`; // "1st Jan, 2025"
}
function safeName(obj, ...keys) {
  if (!obj) return "—";
  for (const k of keys) if (obj[k] != null) return obj[k];
  return obj.name ?? obj.unitName ?? obj.inventoryName ?? Object.values(obj)[0] ?? "—";
}

/* ---------- main component (simplified UI) ---------- */
export default function ProductMovementPage() {
  // refs
  const [inventories, setInventories] = useState([]);
  const [products, setProducts] = useState([]);
  const [globalUnits, setGlobalUnits] = useState([]);

  // filters (inventory required; product/unit optional)
  const [inventoryId, setInventoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");

  // data + UI
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({ totalInQuantity: null, totalOutQuantity: null, netQuantity: null });
  const [counts, setCounts] = useState({ stockMovements: 0, orders: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // simple pagination
  const PER_PAGE = 20;
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  /* load references once */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [invRes, prodRes, unitRes] = await Promise.allSettled([
          api.get("/inventory/"),
          api.get("/products/"),
          api.get("/units/")
        ]);
        if (!mounted) return;
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
        const units = pick(unitRes).map(u => ({ id: u.id ?? u.unit_id ?? u.unitId, name: safeName(u, "name", "unitName") }));
        setGlobalUnits(units);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // units shown: if unit selected use it; otherwise show global units
  const unitsToShow = useMemo(() => globalUnits, [globalUnits]);

  // Derived display names for selected filters (used as fallbacks in table)
  const selectedProductName = useMemo(() => {
    if (!productId) return null;
    const p = products.find(x => String(x.id) === String(productId));
    return p ? safeName(p, "productName", "name") : null;
  }, [productId, products]);

  const selectedUnitName = useMemo(() => {
    if (!unitId) return null;
    const u = unitsToShow.find(x => String(x.id) === String(unitId));
    return u ? (u.name ?? "—") : null;
  }, [unitId, unitsToShow]);

  /* validate: inventory is recommended but not strictly required (we show all products if empty) */
  function validate() {
    // keep minimal UX: no required fields. But if dates are invalid, show error.
    if (dateFrom && isNaN(new Date(dateFrom).getTime())) { setErr("Invalid From date"); return false; }
    if (dateTo && isNaN(new Date(dateTo).getTime())) { setErr("Invalid To date"); return false; }
    setErr("");
    return true;
  }

  /* fetch history (robust parsing) */
  async function fetchHistory(nextPage = 1) {
    if (!validate()) return;
    setLoading(true);
    setHistory([]);
    setSummary({ totalInQuantity: null, totalOutQuantity: null, netQuantity: null });
    setCounts({ stockMovements: 0, orders: 0, total: 0 });
    setHasNext(false); setHasPrev(false);
    setErr("");

    try {
      const params = { page: nextPage, limit: PER_PAGE };
      if (inventoryId) params.inventoryId = inventoryId;
      if (productId) params.productId = productId;
      if (unitId) params.unit_id = unitId;
      if (q) params.q = q;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      // If your API path is prefixed with /api, change below to "/api/stock/history/product"
      const res = await api.get("/stock/history/product", { params });
      const root = res?.data ?? {};
      const d = root.data ?? root;

      // robust detection of history array
      const maybeHistory = Array.isArray(d.history) ? d.history
        : Array.isArray(d.rows) ? d.rows
        : Array.isArray(d.data) ? d.data
        : Array.isArray(root.data) ? root.data
        : Array.isArray(root.rows) ? root.rows
        : Array.isArray(res?.data) ? res.data
        : [];

      const summaryObj = d.summary ?? root.summary ?? null;
      const hc = d.historyCount ?? d.counts ?? root.counts ?? { stockMovements: 0, orders: 0, total: (maybeHistory?.length || 0) };
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

      // small console hint if empty
      if ((maybeHistory || []).length === 0) {
        console.info("No history rows parsed. Raw response:", res?.data ?? res);
      }
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Failed to fetch history");
    } finally {
      setLoading(false);
    }
  }

  /* small export + print helpers */
  function exportCSV() {
    if (!history.length) return alert("No rows to export");
    const headers = ["id", "date", "product", "unit", "type", "method", "direction", "quantity", "runningBalance", "notes"];
    const rows = history.map(r => ({
      id: r.id ?? r.historyId ?? "",
      date: r.date ?? r.createdAt ?? r.created_at ?? "",
      product: r.product?.productName ?? r.productName ?? r.product?.name ?? (r.productId ? `#${r.productId}` : ""),
      unit: r.unit?.name ?? r.unitName ?? r.unit_id ?? "",
      type: r.type ?? (r.method ? "stock" : ""),
      method: r.method ?? "",
      direction: r.direction ?? (r.in_out === "in" ? "IN" : (r.in_out === "out" ? "OUT" : "")),
      quantity: r.quantity ?? r.stockQuantity ?? "",
      runningBalance: r.runningBalance ?? r.running_balance ?? "",
      notes: r.notes ?? r.description ?? ""
    }));
    const esc = v => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = [headers.join(",")].concat(rows.map(row => headers.map(h => esc(row[h])).join(","))).join("\n");
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
    const rowsHtml = history.map(it => `
      <tr>
        <td>${it.id ?? ""}</td>
        <td>${formatPrettyDate(it.date ?? it.createdAt ?? it.created_at)}</td>
        <td>${it.product?.productName ?? it.productName ?? it.product?.name ?? (it.productId ? `#${it.productId}` : "")}</td>
        <td>${it.unit?.name ?? it.unitName ?? it.unit_id ?? ""}</td>
        <td>${it.type ?? (it.method ? "stock" : "")}</td>
        <td>${it.method ?? ""}</td>
        <td>${it.direction ?? (it.in_out === "in" ? "IN" : (it.in_out === "out" ? "OUT" : ""))}</td>
        <td style="text-align:right">${(it.quantity ?? it.stockQuantity ?? "")}</td>
        <td style="text-align:right">${it.runningBalance ?? it.running_balance ?? ""}</td>
        <td>${it.notes ?? it.description ?? ""}</td>
      </tr>`).join("");
    w.document.write(`<html><head><title>Product movement</title><style>body{font-family:Inter,Arial,Helvetica,sans-serif;margin:18px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #eef2f6;padding:10px}th{background:#f8fafc;text-align:left}</style></head><body><h3>Product movement</h3><table><thead><tr><th>#</th><th>Date</th><th>Product</th><th>Unit</th><th>Type</th><th>Method</th><th>Dir</th><th>Qty</th><th>Running</th><th>Notes</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
    w.document.close();
    w.print();
  }

  /* clear filters */
  function clearFilters() {
    setInventoryId("");
    setProductId("");
    setUnitId("");
    setDateFrom("");
    setDateTo("");
    setQ("");
    setErr("");
    setHistory([]);
    setSummary({ totalInQuantity: null, totalOutQuantity: null, netQuantity: null });
    setCounts({ stockMovements: 0, orders: 0, total: 0 });
    setPage(1);
  }

  /* ---------- UI (modern minimal) ---------- */
  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Product movement</h1>
          <p className="mt-1 text-sm text-slate-500">Complete stock & order history. Leave product empty to list all products.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Fetch removed as requested */}
          <button
            title="Export CSV"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-100 hover:shadow"
          >
            <Download size={16} /> CSV
          </button>

          <button
            title="Print"
            onClick={printTable}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-100 hover:shadow"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-6 items-end">
        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Inventory</label>
          <select
            value={inventoryId}
            onChange={e => setInventoryId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          >
            <option value="">All inventories</option>
            {inventories.map(inv => <option key={inv.id} value={inv.id}>{safeName(inv, "inventoryName", "name")}</option>)}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Product</label>
          <select
            value={productId}
            onChange={e => setProductId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          >
            <option value="">All products</option>
            {products.map(p => <option key={p.id} value={p.id}>{safeName(p, "productName", "name")}</option>)}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Unit</label>
          <select
            value={unitId}
            onChange={e => setUnitId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          >
            <option value="">Any unit</option>
            {unitsToShow.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Date from</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-2">Date to</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
          />
        </div>

        {/* replaced X with Search button as requested */}
        <div className="md:col-span-1 flex items-center gap-2">
          <button
            onClick={() => fetchHistory(1)}
            title="Search"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            <SearchIcon size={16} /> Search
          </button>
        </div>
      </div>

      {/* small search */}
      <div className="mt-5">
        <input
          placeholder="Search description, order id or customer..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm"
        />
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {err}
        </div>
      )}

      {/* summary */}
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

      {/* table */}
      <div className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No history rows found. Click <span className="font-medium">Search</span> to try again.</div>
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

                    {/* PRODUCT: show row product if available, otherwise fallback to selectedProductName */}
                    <td className="px-6 py-4 align-top">
                      {it.product?.productName
                        ?? it.productName
                        ?? it.product?.name
                        ?? (productId ? (selectedProductName ?? `#${productId}`) : (it.productId ? `#${it.productId}` : "—"))
                      }
                    </td>

                    {/* UNIT: show row unit if available, otherwise fallback to selectedUnitName */}
                    <td className="px-6 py-4 align-top">
                      {it.unit?.name
                        ?? it.unitName
                        ?? it.unit_id
                        ?? (unitId ? (selectedUnitName ?? `#${unitId}`) : "—")
                      }
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

      {/* pagination */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={() => { if (hasPrev) fetchHistory(page - 1); }}
          disabled={!hasPrev}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40"
        >
          Prev
        </button>

        <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">{page}</div>

        <button
          onClick={() => { if (hasNext) fetchHistory(page + 1); }}
          disabled={!hasNext}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}