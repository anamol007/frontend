// src/pages/CustomerProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import {
  ArrowLeft, FileText, Printer, CalendarClock, User2, Package, Banknote, BadgeCheck
} from "lucide-react";

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

/* ----------------------------- UI helpers ----------------------------- */
const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

function Badge({ children, tone = "bg-slate-100 text-slate-700 border-slate-200" }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {children}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-900">{value ?? "—"}</div>
    </div>
  );
}

/* ------------------------ printing / invoice helpers ------------------------ */
function buildPrintableReceiptHTML(order) {
  const id = order?.id ?? "—";
  const when = fmtPrettyDate(order?.orderDate || order?.createdAt);
  const cust = order?.customer ?? {};
  const inv = order?.inventory ?? {};
  const items = (order?.orderItems || []).map(it => ({
    name: it?.product?.productName || `#${it?.productId}`,
    unit: it?.unit?.name || "",
    qty: Number(it?.quantity || 0),
    rate: typeof it?.rate === "number" ? Number(it.rate).toFixed(2) : "—",
    amount: typeof it?.amount === "number" ? Number(it.amount).toFixed(2) : "—"
  }));
  const total = Number(order?.totalAmount ?? 0).toFixed(2);

  const css = `
    *{box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial;margin:0;color:#0f172a}
    .wrap{padding:28px;max-width:820px;margin:0 auto}
    .thead{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;background:#f8fafc;padding:10px 12px;font-size:12px;font-weight:700;color:#475569}
    .row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:12px;border-top:1px solid #e2e8f0;font-size:14px}
    .right{text-align:right}
    .summary{margin-top:16px;display:flex;justify-content:flex-end}
    .card{border:1px solid #e2e8f0;border-radius:8px;padding:12px;min-width:220px}
    @page{size:auto;margin:14mm}
  `;

  const rows = items.map(it => `
    <div class="row">
      <div>
        <div style="font-weight:600">${it.name}</div>
        <div style="font-size:12px;color:#64748b">${it.unit}</div>
      </div>
      <div class="right">${it.qty}</div>
      <div class="right">${it.rate}</div>
      <div class="right">${it.amount}</div>
    </div>
  `).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice #${id}</title><style>${css}</style></head><body>
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div><div style="font-weight:700;font-size:18px">Invoice</div><div style="font-size:12px;color:#64748b">#${id}</div></div>
        <div style="text-align:right"><div style="font-size:12px;color:#64748b">${when}</div><div style="margin-top:8px">${cust.fullname || '—'}</div><div style="font-size:12px;color:#64748b">${inv.inventoryName || ''}</div></div>
      </div>
      <div class="thead"><div>Product</div><div class="right">Qty</div><div class="right">Rate</div><div class="right">Amount</div></div>
      ${rows}
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
  const cleanup = () => { if (done) return; done = true; iframe.remove(); };
  const triggerPrint = () => {
    if (done) return;
    try { const w = iframe.contentWindow; w.focus(); w.print(); } catch (_) {}
    setTimeout(cleanup, 600);
  };

  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  iframe.addEventListener("load", triggerPrint, { once: true });
  doc.open(); doc.write(html); doc.close();
  setTimeout(triggerPrint, 300);
}

/* ------------------------ CustomerProfilePage ------------------------ */
export default function CustomerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [err, setErr] = useState("");

  // pagination
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
        setCustomer(res?.data?.data ?? res?.data ?? null);
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load customer");
      } finally {
        setLoadingCustomer(false);
      }
    })();
  }, [id]);

  async function fetchOrders(nextPage = 1) {
    if (!id) return;
    setLoadingOrders(true);
    setErr("");
    try {
      // try multiple endpoint shapes (defensive)
      const endpoints = [
        () => api.get("/orders", { params: { customerId: id, page: nextPage, limit: PER_PAGE } }),
        () => api.get(`/orders/customer/${id}`, { params: { page: nextPage, limit: PER_PAGE } }),
        () => api.get(`/customers/${id}/orders`, { params: { page: nextPage, limit: PER_PAGE } }),
        () => api.get("/orders", { params: { customer_id: id, page: nextPage, limit: PER_PAGE } }),
      ];

      let res = null;
      for (const fn of endpoints) {
        try { res = await fn(); break; } catch (e) { res = null; }
      }

      // fallback: fetch a chunk and filter client-side
      if (!res) {
        const all = await api.get("/orders", { params: { page: 1, limit: 1000 } });
        const rootAll = all?.data ?? {};
        const rowsAll = Array.isArray(rootAll.data) ? rootAll.data : (Array.isArray(rootAll.rows) ? rootAll.rows : (Array.isArray(all?.data) ? all.data : []));
        const filtered = rowsAll.filter(r => String(r?.customerId ?? r?.customer?.id ?? r?.customer_id) === String(id));
        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / PER_PAGE));
        const cur = Math.min(Math.max(1, nextPage), pages);
        const slice = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

        setOrders(slice);
        setPage(cur); setTotalPages(pages); setTotalCount(total);
        setHasNext(cur < pages); setHasPrev(cur > 1);
        setLoadingOrders(false);
        return;
      }

      // normalize response
      const root = res?.data ?? {};
      const rows = Array.isArray(root.data) ? root.data : (Array.isArray(root.rows) ? root.rows : (Array.isArray(res?.data) ? res.data : []));
      const p = root.pagination || {};
      const current = Number(p.currentPage ?? nextPage) || Number(nextPage);
      const pages = Number(p.totalPages ?? Math.max(1, Math.ceil((Number(p.totalCount ?? root.total ?? root.count ?? rows.length) || 0) / PER_PAGE))) || 1;
      const total = Number(p.totalCount ?? root.total ?? root.count ?? rows.length) || 0;

      const filteredRows = (rows || []).filter(o => String(o?.customerId ?? o?.customer?.id ?? o?.customer_id) === String(id));
      setOrders(filteredRows);
      setPage(current); setTotalPages(pages); setTotalCount(filteredRows.length);
      setHasNext(Boolean(p.hasNextPage ?? (current < pages))); setHasPrev(Boolean(p.hasPrevPage ?? (current > 1)));
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

  const fullnameFor = (order) => customer?.fullname ?? order?.customer?.fullname ?? order?.customerName ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-slate-50">
            <ArrowLeft size={18} />
          </button>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold">Customer profile</h1>
            <div className="text-xs text-slate-500">Read-only view — invoices and history</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {loadingCustomer ? (
          <div className="text-sm text-slate-500">Loading customer…</div>
        ) : !customer ? (
          <div className="text-sm text-rose-600">Customer not found.</div>
        ) : (
          <>
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Name</div>
              <div className="text-lg font-semibold text-slate-900 truncate">{customer.fullname ?? "—"}</div>
              <div className="text-sm text-slate-600 mt-1 truncate">{customer.address ?? "—"}</div>
            </div>

            <div className="flex gap-6">
              <InfoRow label="Phone" value={customer.phoneNumber ?? "—"} />
              <InfoRow label="Created" value={fmtPrettyDate(customer.createdAt)} />
              <InfoRow label="ID" value={customer.id ?? "—"} />
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent orders <span className="text-sm text-slate-400">({totalCount})</span></h2>
          <div className="text-sm text-slate-500">Page {page} / {totalPages}</div>
        </div>

        {err && <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-700">{err}</div>}

        {loadingOrders ? (
          <div className="text-sm text-slate-500">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="text-sm text-slate-500">No orders found for this customer.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orders.map(o => {
              const names = (o.orderItems || []).map(it => it?.product?.productName || `#${it?.productId}`).join(", ");
              const qtyTotal = (o.orderItems || []).reduce((s, it) => s + Number(it?.quantity || 0), 0);
              const tone = STATUS_COLORS[o.status] || STATUS_COLORS.pending;
              return (
                <div key={o.id} className="group rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-lg transition">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="bg-slate-100 text-slate-700 border-slate-200">#{o.id}</Badge>
                          <Badge tone={tone}><BadgeCheck size={12} /> <span className="capitalize">{o.status || "pending"}</span></Badge>
                          <Badge tone="bg-violet-100 text-violet-700 border-violet-200"><Banknote size={12} /> ${Number(o.totalAmount ?? 0).toFixed(2)}</Badge>
                        </div>

                        <h3 className="mt-2 text-base font-semibold text-slate-900 line-clamp-1">{names || "—"}</h3>

                        <div className="mt-2 text-sm text-slate-600 space-y-1">
                          <div className="flex items-center gap-2"><User2 size={14} className="text-slate-400" /><span className="truncate">{fullnameFor(o)}</span></div>
                          <div className="flex items-center gap-2"><Package size={14} className="text-slate-400" /><span>{qtyTotal} items</span></div>
                          <div className="flex items-center gap-2"><CalendarClock size={14} className="text-slate-400" /><span>{fmtPrettyDate(o.orderDate || o.createdAt)}</span></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => printHTMLInIframe(buildPrintableReceiptHTML(o))}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <FileText size={16} /> Invoice
                      </button>
                      <button
                        onClick={() => printHTMLInIframe(buildPrintableReceiptHTML(o))}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <Printer size={16} /> Print
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={goPrev} disabled={!hasPrev || page <= 1} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">‹ Prev</button>

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
                className={n === page ? "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" : "rounded-2xl border px-4 py-2 text-sm"}
              >
                {n}
              </button>
            ));
          })()}

          <button onClick={goNext} disabled={!hasNext || page >= totalPages} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Next ›</button>
        </div>
      </div>
    </div>
  );
}