// src/pages/CustomerProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import {
  ArrowLeft, FileText, Printer, CalendarClock, User2, Package, Banknote, BadgeCheck
} from "lucide-react";

/* helpers */
function formatPrettyDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(+d)) return "—";
  return d.toLocaleString();
}
const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};
function Badge({ children, tone = "bg-slate-100 text-slate-700 border-slate-200" }) {
  return <span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${tone}`}>{children}</span>;
}

/* printable HTML helper */
function buildPrintableReceiptHTML(order) {
  const id = order?.id ?? "—";
  const when = formatPrettyDate(order?.orderDate || order?.createdAt);
  const cust = order?.customer ?? {};
  const inv = order?.inventory ?? {};
  const items = (order?.orderItems || []).map(it => ({
    productName: it?.product?.productName || `#${it?.productId}`,
    unitName: it?.unit?.name || "",
    quantity: Number(it?.quantity || 0),
    rate: (typeof it?.rate === "number") ? it.rate.toFixed(2) : "—",
    amount: (typeof it?.amount === "number") ? it.amount.toFixed(2) : "—"
  }));
  const total = Number(order?.totalAmount ?? 0).toFixed(2);
  const css = `
    *{box-sizing:border-box} body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;color:#0f172a}
    .wrap{padding:28px;max-width:820px;margin:0 auto}
    .thead{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;background:#f8fafc;padding:10px 12px;font-size:12px;font-weight:700;color:#475569}
    .row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:12px;border-top:1px solid #e2e8f0;font-size:14px}
    .right{text-align:right}
    .summary{margin-top:16px;display:flex;justify-content:flex-end}
    .summary .card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;min-width:220px}
    @page{size:auto;margin:14mm}
  `;
  const itemsRows = items.map(it => `
    <div class="row">
      <div>
        <div style="font-weight:600">${it.productName}</div>
        <div style="font-size:12px;color:#64748b">${it.unitName}</div>
      </div>
      <div class="right">${it.quantity}</div>
      <div class="right">${it.rate}</div>
      <div class="right">${it.amount}</div>
    </div>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice #${id}</title><style>${css}</style></head><body>
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div><div style="font-weight:700;font-size:18px">Invoice</div><div style="font-size:12px;color:#64748b">#${id}</div></div>
        <div style="text-align:right"><div style="font-size:12px;color:#64748b">${when}</div><div style="margin-top:8px">${cust?.fullname || '—'}</div><div style="font-size:12px;color:#64748b">${inv?.inventoryName || ''}</div></div>
      </div>
      <div class="thead"><div>Product</div><div class="right">Qty</div><div class="right">Rate</div><div class="right">Amount</div></div>
      ${itemsRows}
      <div class="summary"><div class="card"><div style="display:flex;justify-content:space-between"><div>Subtotal</div><div>${total}</div></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:700"><div>Total</div><div>${total}</div></div></div></div>
    </div>
  </body></html>`;
}
function printHTMLInIframe(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.inset = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  let done = false;
  const cleanup = () => { if (done) return; done = true; if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  const triggerPrint = () => { if (done) return; try { const w = iframe.contentWindow; if (!w) return; w.focus(); w.print(); } catch (_) {} setTimeout(cleanup, 600); };
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  iframe.addEventListener("load", triggerPrint, { once: true });
  doc.open(); doc.write(html); doc.close();
  setTimeout(triggerPrint, 300);
}

/* Component */
export default function CustomerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [err, setErr] = useState("");

  // pagination for orders (server provides page)
  const PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setErr(""); setLoadingCustomer(true);
      try {
        const res = await api.get(`/customers/${id}`);
        const data = res?.data?.data ?? res?.data ?? null;
        setCustomer(data);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load customer");
      } finally {
        setLoadingCustomer(false);
      }
    })();
  }, [id]);

  /* ---------------------------
     fetchOrders: defensive & filters to this customer only
     --------------------------- */
  async function fetchOrders(nextPage = 1) {
    if (!id) return;
    setLoadingOrders(true);
    setErr("");
    try {
      let res = null;
      let used = null;

      // 1) Preferred: /orders?customerId=
      try {
        res = await api.get("/orders", { params: { customerId: id, page: nextPage, limit: PER_PAGE } });
        used = "/orders?customerId";
      } catch (e) { res = null; }

      // 2) /orders/customer/:id
      if (!res) {
        try {
          res = await api.get(`/orders/customer/${id}`, { params: { page: nextPage, limit: PER_PAGE } });
          used = `/orders/customer/${id}`;
        } catch (e) { res = null; }
      }

      // 3) /customers/:id/orders
      if (!res) {
        try {
          res = await api.get(`/customers/${id}/orders`, { params: { page: nextPage, limit: PER_PAGE } });
          used = `/customers/${id}/orders`;
        } catch (e) { res = null; }
      }

      // 4) fallback param name /orders?customer_id=
      if (!res) {
        try {
          res = await api.get("/orders", { params: { customer_id: id, page: nextPage, limit: PER_PAGE } });
          used = "/orders?customer_id";
        } catch (e) { res = null; }
      }

      // 5) last resort: fetch many orders and filter client-side
      if (!res) {
        console.warn("CustomerProfilePage: fallback to client-side filtering of /orders");
        const all = await api.get("/orders", { params: { page: 1, limit: 1000 } });
        const rootAll = all?.data ?? {};
        const rowsAll = Array.isArray(rootAll.data) ? rootAll.data
                      : Array.isArray(rootAll.rows) ? rootAll.rows
                      : Array.isArray(all?.data) ? all.data
                      : [];
        const filtered = rowsAll.filter(ro => String(ro?.customerId ?? ro?.customer?.id ?? ro?.customer_id) === String(id));
        const total = filtered.length;
        const tPages = Math.max(1, Math.ceil(total / PER_PAGE));
        const cur = Math.min(Math.max(1, nextPage), tPages);
        const slice = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

        setOrders(slice);
        setPage(cur);
        setTotalPages(tPages);
        setTotalCount(total);
        setHasNext(cur < tPages);
        setHasPrev(cur > 1);
        setLoadingOrders(false);
        console.info("CustomerProfilePage used:", "client-side filter fallback");
        return;
      }

      // Normalize the response shapes
      const root = res?.data ?? {};
      const rows = Array.isArray(root.data) ? root.data
                    : Array.isArray(root.rows) ? root.rows
                    : Array.isArray(res?.data) ? res.data
                    : [];

      const p = root.pagination || {};
      const current = Number(p.currentPage ?? nextPage) || Number(nextPage);
      const tPages = Number(p.totalPages ?? Math.max(1, Math.ceil((Number(p.totalCount ?? root.total ?? root.count ?? rows.length) || 0) / PER_PAGE))) || 1;
      const total = Number(p.totalCount ?? root.total ?? root.count ?? rows.length) || 0;
      const nextFlag = Boolean(p.hasNextPage ?? (current < tPages));
      const prevFlag = Boolean(p.hasPrevPage ?? (current > 1));

      // Safety: keep only orders that belong to this customer
      const filteredRows = (Array.isArray(rows) ? rows : []).filter(
        o => String(o?.customerId ?? o?.customer?.id ?? o?.customer_id) === String(id)
      );

      setOrders(filteredRows);
      setPage(current);
      setTotalPages(tPages);
      setTotalCount(filteredRows.length);
      setHasNext(nextFlag);
      setHasPrev(prevFlag);
      console.info("CustomerProfilePage used:", used);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to fetch orders");
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const goPrev = () => { if (hasPrev && page > 1) fetchOrders(page - 1); };
  const goNext = () => { if (hasNext && page < totalPages) fetchOrders(page + 1); };

  // safe fullname helper (use customer if available, otherwise fall back to order.customer)
  const fullnameFor = (order) => {
    return customer?.fullname ?? order?.customer?.fullname ?? order?.customerName ?? "—";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-slate-50">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-semibold">Customer profile</h1>
        </div>
        {/* Read-only profile: Edit/Delete intentionally removed */}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {loadingCustomer ? (
          <div className="text-sm text-slate-500">Loading customer…</div>
        ) : !customer ? (
          <div className="text-sm text-rose-600">Customer not found.</div>
        ) : (
          <div className="md:flex md:items-center md:justify-between">
            <div>
              <div className="text-sm text-slate-500">Name</div>
              <div className="text-lg font-semibold text-slate-900">{customer?.fullname ?? "—"}</div>
              <div className="mt-1 text-sm text-slate-600">{customer?.address ?? "—"}</div>
              <div className="mt-3 text-sm text-slate-600 flex items-center gap-3">
                <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <span className="font-medium">ID:</span> {customer?.id ?? "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 md:mt-0 flex items-center gap-6">
              <div>
                <div className="text-sm text-slate-500">Phone</div>
                <div className="text-sm font-medium text-slate-900">{customer?.phoneNumber ?? "—"}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Created</div>
                <div className="text-sm font-medium text-slate-900">{formatPrettyDate(customer?.createdAt)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent orders ({totalCount})</h2>
          <div className="text-sm text-slate-500">Page {page} / {totalPages}</div>
        </div>

        {err && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}

        {loadingOrders ? (
          <div className="mt-4 text-sm text-slate-500">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No orders found for this customer.</div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orders.map(o => {
              const prodNames = (o?.orderItems || []).map(it => it?.product?.productName || `#${it?.productId}`).join(", ");
              const qtyTotal = (o?.orderItems || []).reduce((s, it) => s + Number(it?.quantity || 0), 0);
              const statusTone = STATUS_COLORS[o?.status] || STATUS_COLORS.pending;
              return (
                <div key={o?.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white/80 to-white/60 p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="bg-slate-100 text-slate-700 border-slate-200">#{o?.id}</Badge>
                        <Badge tone={statusTone}><BadgeCheck size={12} /> {o?.status || "pending"}</Badge>
                        <Badge tone="bg-violet-100 text-violet-700 border-violet-200"><Banknote size={12}/> {Number(o?.totalAmount ?? 0).toFixed(2)}</Badge>
                      </div>
                      <h3 className="mt-2 line-clamp-1 text-base font-semibold text-slate-900">{prodNames || "—"}</h3>
                      <div className="mt-1 grid gap-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><User2 size={14} className="text-slate-400"/><span className="truncate">{fullnameFor(o)}</span></div>
                        <div className="flex items-center gap-2"><Package size={14} className="text-slate-400"/><span>{qtyTotal} items</span></div>
                        <div className="flex items-center gap-2"><CalendarClock size={14} className="text-slate-400"/><span>{formatPrettyDate(o?.orderDate || o?.createdAt)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button onClick={() => { const html = buildPrintableReceiptHTML(o); printHTMLInIframe(html); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <FileText size={16}/> Invoice
                    </button>
                    <button onClick={() => { const html = buildPrintableReceiptHTML(o); printHTMLInIframe(html); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <Printer size={16}/> Print
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* pagination */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={goPrev}
            disabled={!hasPrev || page <= 1}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
            title="Previous"
          >
            ‹ Prev
          </button>

          {(() => {
            const chips = [];
            const start = Math.max(1, page - 1);
            const end = Math.min(totalPages, page + 1);
            for (let i = start; i <= end; i++) chips.push(i);
            if (page === 1 && totalPages >= 2 && !chips.includes(2)) chips.push(2);
            return chips.map(n => (
              <button
                key={n}
                onClick={() => fetchOrders(n)}
                className={n === page ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" : "rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-gray-50"}
              >
                {n}
              </button>
            ));
          })()}

          <button
            onClick={goNext}
            disabled={!hasNext || page >= totalPages}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm disabled:opacity-40"
            title="Next"
          >
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}