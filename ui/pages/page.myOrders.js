// 我的订单：本地订单列表（#my-orders）

import { initCommerceStore, getCommerceStoreSync } from "../lumina-commerce/store.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { listOrdersForBuyer } from "../lumina-commerce/teacherCommerceBridge.js";
import { safeUiText, formatCommerceEnum } from "../lumina-commerce/commerceDisplayLabels.js";
import { i18n } from "../i18n.js";

function tx(k, p) {
  return safeUiText(k, p);
}
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(amount, currency) {
  const n = Math.round(Number(amount) || 0);
  const cur = String(currency || "KRW");
  if (cur === "KRW") {
    return `${n.toLocaleString()} ${cur}`;
  }
  return `${n} ${cur}`;
}

export default async function pageMyOrders(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  await initCommerceStore();
  const snap = getCommerceStoreSync();
  const u = getCurrentUser();
  if (!snap) {
    root.innerHTML = `<div class="wrap learner-my-page"><p>${escapeHtml(tx("common.loading"))}</p></div>`;
    return;
  }

  const orders = listOrdersForBuyer(u.id);
  const tr = orders
    .map((o) => {
      const L = o.listing_id ? snap.listings.find((l) => l.id === o.listing_id) : null;
      const title = L?.title || o.listing_id || "—";
      const amt = formatMoney(o.amount, o.currency);
      const oSt = formatCommerceEnum("order_status", o.status);
      const pSt = formatCommerceEnum("payment_status", o.payment_status);
      const fSt = formatCommerceEnum("fulfillment_status", o.fulfillment_status);
      const resLine = pSt + " · " + fSt;
      const tStr = (o.created_at || "").replace("T", " ").slice(0, 16);
      return `<tr>
        <td>${escapeHtml(tStr)}</td>
        <td><a class="learner-my-link" href="#teacher-listing?id=${encodeURIComponent(
          String(o.listing_id || ""),
        )}">${escapeHtml(title)}</a></td>
        <td>${escapeHtml(amt)}</td>
        <td>${escapeHtml(oSt)}</td>
        <td>${escapeHtml(resLine)}</td>
      </tr>`;
    })
    .join("");

  const empty = orders.length
    ? ""
    : `<p class="learner-my-empty my-orders-empty">${escapeHtml(tx("learner.my_orders.empty"))}</p>`;
  const table = orders.length
    ? `<div class="learner-my-table-wrap"><table class="learner-my-table">
      <thead><tr>
        <th>${escapeHtml(tx("learner.my_orders.col_time"))}</th>
        <th>${escapeHtml(tx("learner.my_orders.col_title"))}</th>
        <th>${escapeHtml(tx("learner.my_orders.col_amount"))}</th>
        <th>${escapeHtml(tx("learner.my_orders.col_status"))}</th>
        <th>${escapeHtml(tx("learner.my_orders.col_outcome"))}</th>
      </tr></thead>
      <tbody>${tr}</tbody>
    </table></div>`
    : "";

  root.innerHTML = `<div class="wrap learner-my-page">
    <header class="card learner-my-hero">
      <h1 class="learner-my-title">${escapeHtml(tx("learner.nav.my_orders"))}</h1>
      <p class="learner-my-lead">${escapeHtml(tx("learner.my_orders.lead"))}</p>
    </header>
    <section class="card learner-my-section">${empty}${table}</section>
  </div>`;
  i18n.apply?.(root);
}

export function mount(c) {
  return pageMyOrders(c);
}
export function render(c) {
  return pageMyOrders(c);
}
