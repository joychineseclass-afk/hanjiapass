/**
 * 上架与售卖管理（Stage 0）：listing / 审核 / 老师档案等占位，本地演示数据。
 * 文案与枚举显示走 commerceDisplayLabels + i18n。
 */

import {
  DEFAULT_SETTLEMENT_CURRENCY,
  DELIVERY_TYPE,
  ENTITLEMENT_SOURCE_TYPE,
  ENTITLEMENT_STATUS,
  ENTITLEMENT_TYPE,
  LISTING_STATUS,
  LISTING_TYPE,
  REFUND_POLICY_TYPE,
  REVIEW_REASON_CODE,
  SELLER_TYPE,
  USER_ROLE,
  VISIBILITY,
  LISTING_REVIEW_ACTION,
} from "../lumina-commerce/enums.js";
import {
  commerceT,
  formatCommerceEnum,
  formatCommerceFieldLabel,
  formatCommerceBool,
  formatDemoUserDisplay,
  formatCommerceErrorCode,
  formatDemoTeacherProfileDisplayName,
  formatCommerceTableHead,
  formatDemoListingSelectLabel,
  formatDemoListingContentTitleAttr,
} from "../lumina-commerce/commerceDisplayLabels.js";
import { hasListingAccess } from "../lumina-commerce/entitlementService.js";
import { canTransitionListingStatus } from "../lumina-commerce/listingStateMachine.js";
import { assertCanSubmitListingForReview } from "../lumina-commerce/teacherRules.js";
import {
  initCommerceStore,
  mutateCommerceStore,
  resetCommerceStoreToSeed,
  userHasRole,
} from "../lumina-commerce/store.js";
import { i18n } from "../i18n.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {string[]} values @param {string} selected @param {string} group */
function optEnumLocalized(values, selected, group) {
  return values
    .map((v) => {
      const label = formatCommerceEnum(group, v);
      return `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function cellDash(val) {
  if (val == null || val === "") return commerceT("commerce.table.empty_cell");
  return escapeHtml(String(val));
}

function renderPage(root, ctx) {
  const snap = ctx.snap;
  const demoUserId = ctx.demoUserId;

  const teacherRows = snap.teacher_profiles
    .map(
      (t) => `<tr>
      <td>${cellDash(t.id)}</td>
      <td>${cellDash(t.user_id)}</td>
      <td>${escapeHtml(formatDemoTeacherProfileDisplayName(t.id, t.display_name))}</td>
      <td>${escapeHtml(formatCommerceEnum("teacher_level", t.teacher_level))}</td>
      <td>${escapeHtml(formatCommerceEnum("verification_status", t.verification_status))}</td>
      <td>${escapeHtml(formatCommerceEnum("seller_eligibility", t.seller_eligibility))}</td>
      <td>${escapeHtml(formatCommerceBool(!!t.payout_ready))}</td>
    </tr>`
    )
    .join("");

  const listingRows = snap.listings
    .map((L) => {
      const tp =
        L.seller_type === SELLER_TYPE.teacher
          ? snap.teacher_profiles.find((x) => x.id === L.teacher_id) || null
          : null;
      const canSubmit =
        L.status === LISTING_STATUS.draft && assertCanSubmitListingForReview(tp, L).ok;
      const submitDisabled = canSubmit ? "" : "disabled";
      return `<tr data-listing-id="${escapeHtml(L.id)}">
        <td>${cellDash(L.id)}</td>
        <td>${escapeHtml(formatCommerceEnum("seller_type", L.seller_type))}</td>
        <td>${cellDash(L.teacher_id)}</td>
        <td>${escapeHtml(formatCommerceEnum("listing_type", L.listing_type))}</td>
        <td>${escapeHtml(formatCommerceEnum("listing_status", L.status))}</td>
        <td>${escapeHtml(formatCommerceEnum("visibility", L.visibility))}</td>
        <td>${escapeHtml(String(L.price_amount))} ${escapeHtml(String(L.price_currency))}</td>
        <td>
          <button type="button" class="lts0-submit-review" data-id="${escapeHtml(L.id)}" ${submitDisabled}>${escapeHtml(commerceT("commerce.form.submit_review"))}</button>
        </td>
      </tr>`;
    })
    .join("");

  const logRows = snap.listing_review_logs
    .slice()
    .reverse()
    .map(
      (r) => `<tr>
      <td>${cellDash(r.created_at)}</td>
      <td>${cellDash(r.listing_id)}</td>
      <td>${escapeHtml(formatCommerceEnum("listing_review_action", r.action))}</td>
      <td>${escapeHtml(formatCommerceEnum("review_reason_code", r.reason_code))}</td>
      <td>${cellDash(r.reason_text)}</td>
    </tr>`
    )
    .join("");

  const entRows = snap.entitlements
    .map(
      (e) => `<tr>
      <td>${cellDash(e.id)}</td>
      <td>${cellDash(e.user_id)}</td>
      <td>${escapeHtml(formatCommerceEnum("entitlement_type", e.entitlement_type))}</td>
      <td>${cellDash(e.listing_id)}</td>
      <td>${escapeHtml(formatCommerceEnum("entitlement_status", e.status))}</td>
      <td>${escapeHtml(formatCommerceEnum("entitlement_source_type", e.source_type))}</td>
    </tr>`
    )
    .join("");

  const orderRows = snap.orders
    .map(
      (o) => `<tr>
      <td>${cellDash(o.id)}</td>
      <td>${cellDash(o.buyer_id)}</td>
      <td>${cellDash(o.listing_id)}</td>
      <td>${escapeHtml(formatCommerceEnum("seller_type", o.seller_type))}</td>
      <td>${escapeHtml(formatCommerceEnum("order_status", o.status))}</td>
      <td>${escapeHtml(String(o.amount))} ${escapeHtml(String(o.currency))}</td>
      <td>${o.provider ? cellDash(o.provider) : cellDash(null)}</td>
    </tr>`
    )
    .join("");

  const isReviewer =
    userHasRole(snap, demoUserId, USER_ROLE.reviewer) || userHasRole(snap, demoUserId, USER_ROLE.admin);

  const reviewPanel = isReviewer
    ? `<section class="card" style="margin-top:14px;">
        <h3>${escapeHtml(commerceT("commerce.review.panel_title"))}</h3>
        <p class="desc" style="font-size:13px;color:#64748b;">${escapeHtml(commerceT("commerce.review.panel_desc"))}</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;">
          <label>${escapeHtml(commerceT("commerce.review.pick_listing"))}<br/><select id="lts0ReviewListing">${snap.listings
            .map((L) => {
              const lab = formatDemoListingSelectLabel(L);
              const tit = formatDemoListingContentTitleAttr(L);
              return `<option value="${escapeHtml(L.id)}" title="${escapeHtml(tit)}">${escapeHtml(lab)}</option>`;
            })
            .join("")}</select></label>
          <label>${escapeHtml(commerceT("commerce.review.new_status"))}<br/><select id="lts0ReviewNext">${optEnumLocalized(
            [
              LISTING_STATUS.pending_review,
              LISTING_STATUS.approved,
              LISTING_STATUS.rejected,
              LISTING_STATUS.delisted,
              LISTING_STATUS.archived,
            ],
            LISTING_STATUS.approved,
            "listing_status"
          )}</select></label>
          <label>${escapeHtml(commerceT("commerce.review.reason_code"))}<br/><select id="lts0ReasonCode">${optEnumLocalized(
            Object.values(REVIEW_REASON_CODE),
            REVIEW_REASON_CODE.other,
            "review_reason_code"
          )}</select></label>
          <label style="min-width:220px;">${escapeHtml(commerceT("commerce.review.reason_text"))}<br/><input id="lts0ReasonText" type="text" placeholder="${escapeHtml(commerceT("commerce.review.reason_placeholder"))}" style="width:100%;"/></label>
          <button type="button" id="lts0ApplyReview">${escapeHtml(commerceT("commerce.review.apply"))}</button>
        </div>
      </section>`
    : `<p style="font-size:13px;color:#94a3b8;">${escapeHtml(commerceT("commerce.review.hidden"))}</p>`;

  const accessUser = demoUserId;
  const accessListingId = snap.listings[0]?.id || "";
  const hasAccess = hasListingAccess(snap.entitlements, accessUser, accessListingId);
  const accessUserLabel = formatDemoUserDisplay(accessUser, snap.users.find((u) => u.id === accessUser)?.display_name);
  const accessListingObj = snap.listings.find((x) => x.id === accessListingId) || snap.listings[0];
  const accessListingLabel = accessListingObj
    ? formatDemoListingSelectLabel(accessListingObj)
    : commerceT("commerce.table.empty_cell");

  root.innerHTML = `
    <div class="wrap" style="padding-bottom:48px;">
      <section class="card">
        <p style="margin:0 0 10px;">
          <a href="#teacher" class="teacher-back-link">${escapeHtml(commerceT("commerce.stage0.back_workspace"))}</a>
        </p>
        <h2 class="title">${escapeHtml(commerceT("commerce.stage0.title"))}</h2>
        <p class="desc">${escapeHtml(commerceT("commerce.stage0.subtitle"))}</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:10px;">
          <label>${escapeHtml(commerceT("commerce.stage0.demo_user"))}
            <select id="lts0DemoUser">
              ${snap.users
                .map((u) => {
                  const label = formatDemoUserDisplay(u.id, u.display_name);
                  return `<option value="${escapeHtml(u.id)}" ${u.id === demoUserId ? "selected" : ""}>${escapeHtml(label)}</option>`;
                })
                .join("")}
            </select>
          </label>
          <button type="button" id="lts0ResetSeed">${escapeHtml(commerceT("commerce.stage0.reset_seed"))}</button>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>${escapeHtml(commerceT("commerce.stage0.access_title"))}</h3>
        <p style="font-size:13px;">${escapeHtml(
          String(i18n.t("commerce.stage0.access_body", { user: accessUserLabel, listing: accessListingLabel }) || "")
        )}
          <strong>${escapeHtml(hasAccess ? commerceT("commerce.stage0.access_yes") : commerceT("commerce.stage0.access_no"))}</strong>
          ${escapeHtml(commerceT("commerce.stage0.access_note"))}</p>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>${escapeHtml(commerceT("commerce.stage0.profile_title"))}</h3>
        <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">${escapeHtml(commerceT("commerce.stage0.profile_caption"))}</p>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr>
              <th>${escapeHtml(formatCommerceTableHead("record_id"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("user_id"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("display_name"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("teacher_level"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("verification_status"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("seller_eligibility"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("payout_ready"))}</th>
            </tr></thead>
            <tbody>${teacherRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>${escapeHtml(commerceT("commerce.stage0.listing_title"))}</h3>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr>
              <th>${escapeHtml(formatCommerceTableHead("record_id"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("seller_type"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("teacher_id"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("listing_type"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("status"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("visibility"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("price"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("actions"))}</th>
            </tr></thead>
            <tbody>${listingRows}</tbody>
          </table>
        </div>
        <h4 style="margin-top:16px;">${escapeHtml(commerceT("commerce.stage0.new_draft_title"))}</h4>
        <form id="lts0NewListing" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end;">
          <label>${escapeHtml(commerceT("commerce.form.title"))}<input name="title" required value="${escapeHtml(commerceT("commerce.form.default_title"))}"/></label>
          <label>${escapeHtml(commerceT("commerce.form.seller_type"))}<select name="seller_type">${optEnumLocalized(Object.values(SELLER_TYPE), SELLER_TYPE.teacher, "seller_type")}</select></label>
          <label>${escapeHtml(commerceT("commerce.form.teacher_profile_id"))}<input name="teacher_id" placeholder="${escapeHtml(commerceT("commerce.form.teacher_placeholder"))}" value="tp_demo_seller_001"/></label>
          <label>${escapeHtml(commerceT("commerce.form.listing_type"))}<select name="listing_type">${optEnumLocalized(Object.values(LISTING_TYPE), LISTING_TYPE.course, "listing_type")}</select></label>
          <label>${escapeHtml(commerceT("commerce.form.delivery_type"))}<select name="delivery_type">${optEnumLocalized(Object.values(DELIVERY_TYPE), DELIVERY_TYPE.recorded, "delivery_type")}</select></label>
          <label>${escapeHtml(commerceT("commerce.form.visibility"))}<select name="visibility">${optEnumLocalized(Object.values(VISIBILITY), VISIBILITY.private, "visibility")}</select></label>
          <label>${escapeHtml(commerceT("commerce.form.price_amount"))}<input name="price_amount" value="10000"/></label>
          <label>${escapeHtml(commerceT("commerce.form.price_currency"))}<input name="price_currency" value="${DEFAULT_SETTLEMENT_CURRENCY}"/></label>
          <label>${escapeHtml(commerceT("commerce.form.refund_policy"))}<select name="refund_policy_type">${optEnumLocalized(
            Object.values(REFUND_POLICY_TYPE),
            REFUND_POLICY_TYPE.within_7_days,
            "refund_policy_type"
          )}</select></label>
          <button type="submit" style="grid-column:1/-1;justify-self:start;">${escapeHtml(commerceT("commerce.form.create_draft"))}</button>
        </form>
      </section>

      ${reviewPanel}

      <section class="card" style="margin-top:14px;">
        <h3>${escapeHtml(commerceT("commerce.stage0.review_log_title"))}</h3>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr>
              <th>${escapeHtml(formatCommerceTableHead("time"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("listing_id"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("action"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("reason_code"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("reason_text"))}</th>
            </tr></thead>
            <tbody>${snap.listing_review_logs.length ? logRows : `<tr><td colspan="5">${escapeHtml(commerceT("commerce.table.no_rows"))}</td></tr>`}</tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>${escapeHtml(commerceT("commerce.stage0.entitlement_title"))}</h3>
        <form id="lts0Grant" style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;">
          <label>${escapeHtml(commerceT("commerce.form.grant_user"))}<input name="user_id" value="u_student_demo_001"/></label>
          <label>${escapeHtml(commerceT("commerce.form.grant_listing"))}<select name="listing_id">${snap.listings
            .map((L) => {
              const lab = formatDemoListingSelectLabel(L);
              const tit = formatDemoListingContentTitleAttr(L);
              return `<option value="${escapeHtml(L.id)}" title="${escapeHtml(tit)}">${escapeHtml(lab)}</option>`;
            })
            .join("")}</select></label>
          <button type="submit">${escapeHtml(commerceT("commerce.form.grant_submit"))}</button>
        </form>
        <div style="overflow:auto;margin-top:10px;">
          <table class="lts0-table">
            <thead><tr>
              <th>${escapeHtml(formatCommerceTableHead("record_id"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("user_id"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("entitlement_type"))}</th>
              <th>${escapeHtml(formatCommerceFieldLabel("listing_id"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("status"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("source"))}</th>
            </tr></thead>
            <tbody>${entRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>${escapeHtml(commerceT("commerce.stage0.order_title"))}</h3>
        <p class="desc" style="font-size:13px;">${escapeHtml(commerceT("commerce.stage0.order_note"))}</p>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr>
              <th>${escapeHtml(formatCommerceTableHead("record_id"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("buyer"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("listing"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("seller_type"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("status"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("amount"))}</th>
              <th>${escapeHtml(formatCommerceTableHead("provider"))}</th>
            </tr></thead>
            <tbody>${orderRows}</tbody>
          </table>
        </div>
      </section>

      <style>
        .lts0-table { width:100%; border-collapse:collapse; font-size:13px; }
        .lts0-table th, .lts0-table td { border:1px solid #e2e8f0; padding:6px 8px; text-align:left; }
        .lts0-table th { background:#f8fafc; }
      </style>
    </div>
  `;

  const demoSel = root.querySelector("#lts0DemoUser");
  demoSel?.addEventListener("change", () => {
    ctx.demoUserId = String(demoSel.value || "");
    try {
      sessionStorage.setItem("lumina_stage0_demo_user", ctx.demoUserId);
    } catch {}
    renderPage(root, ctx);
  });

  root.querySelector("#lts0ResetSeed")?.addEventListener("click", async () => {
    ctx.snap = await resetCommerceStoreToSeed();
    renderPage(root, ctx);
  });

  root.querySelector("#lts0NewListing")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(/** @type {HTMLFormElement} */ (ev.target));
    const seller_type = String(fd.get("seller_type") || SELLER_TYPE.teacher);
    const teacher_id_raw = String(fd.get("teacher_id") || "").trim();
    const teacher_id = seller_type === SELLER_TYPE.platform ? null : teacher_id_raw || null;
    mutateCommerceStore((draft) => {
      const now = new Date().toISOString();
      const titleIn = String(fd.get("title") || "").trim();
      const defaultTitle = commerceT("commerce.form.default_title");
      draft.listings.push({
        id: uid("lst"),
        seller_type,
        teacher_id,
        listing_type: String(fd.get("listing_type")),
        delivery_type: String(fd.get("delivery_type")),
        title: titleIn || defaultTitle,
        summary: "",
        description: "",
        status: LISTING_STATUS.draft,
        visibility: String(fd.get("visibility")),
        price_amount: String(fd.get("price_amount") || "0"),
        price_currency: String(fd.get("price_currency") || DEFAULT_SETTLEMENT_CURRENCY),
        list_price_amount: null,
        sale_price_amount: null,
        refund_policy_type: String(fd.get("refund_policy_type")),
        review_reason_code: null,
        review_reason_text: null,
        ownership_declaration_accepted: null,
        created_at: now,
        updated_at: now,
        published_at: null,
        delisted_at: null,
      });
    });
    renderPage(root, ctx);
  });

  root.querySelectorAll(".lts0-submit-review").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (!id) return;
      mutateCommerceStore((draft) => {
        const L = draft.listings.find((x) => x.id === id);
        if (!L || L.status !== LISTING_STATUS.draft) return;
        const tp =
          L.seller_type === SELLER_TYPE.teacher
            ? draft.teacher_profiles.find((x) => x.id === L.teacher_id) || null
            : null;
        const gate = assertCanSubmitListingForReview(tp, L);
        if (!gate.ok) {
          alert(formatCommerceErrorCode(gate.code));
          return;
        }
        if (!canTransitionListingStatus(L.status, LISTING_STATUS.pending_review)) return;
        L.status = LISTING_STATUS.pending_review;
        L.updated_at = new Date().toISOString();
        draft.listing_review_logs.push({
          id: uid("lrl"),
          listing_id: L.id,
          reviewer_user_id: demoUserId,
          action: LISTING_REVIEW_ACTION.submitted,
          reason_code: null,
          reason_text: null,
          created_at: new Date().toISOString(),
        });
      });
      renderPage(root, ctx);
    });
  });

  root.querySelector("#lts0ApplyReview")?.addEventListener("click", () => {
    const listingId = String(root.querySelector("#lts0ReviewListing")?.value || "");
    const next = String(root.querySelector("#lts0ReviewNext")?.value || "");
    const reason_code = String(root.querySelector("#lts0ReasonCode")?.value || "");
    const reason_text = String(root.querySelector("#lts0ReasonText")?.value || "");
    if (!listingId || !next) return;
    mutateCommerceStore((draft) => {
      const L = draft.listings.find((x) => x.id === listingId);
      if (!L) return;
      if (!canTransitionListingStatus(L.status, next)) {
        alert(
          i18n.t("commerce.review.transition_denied", {
            from: formatCommerceEnum("listing_status", L.status),
            to: formatCommerceEnum("listing_status", next),
          })
        );
        return;
      }
      const now = new Date().toISOString();
      L.status = next;
      L.updated_at = now;
      if (next === LISTING_STATUS.rejected || next === LISTING_STATUS.delisted) {
        L.review_reason_code = reason_code;
        L.review_reason_text = reason_text;
      } else {
        L.review_reason_code = null;
        L.review_reason_text = null;
      }
      if (next === LISTING_STATUS.approved) L.published_at = L.published_at || now;
      if (next === LISTING_STATUS.delisted) L.delisted_at = now;
      const action =
        next === LISTING_STATUS.approved
          ? LISTING_REVIEW_ACTION.approved
          : next === LISTING_STATUS.rejected
            ? LISTING_REVIEW_ACTION.rejected
            : next === LISTING_STATUS.delisted
              ? LISTING_REVIEW_ACTION.delisted
              : next === LISTING_STATUS.archived
                ? LISTING_REVIEW_ACTION.appeal_resolved
                : LISTING_REVIEW_ACTION.approved;
      draft.listing_review_logs.push({
        id: uid("lrl"),
        listing_id: L.id,
        reviewer_user_id: demoUserId,
        action,
        reason_code: reason_code || null,
        reason_text: reason_text || null,
        created_at: now,
      });
    });
    renderPage(root, ctx);
  });

  root.querySelector("#lts0Grant")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(/** @type {HTMLFormElement} */ (ev.target));
    const user_id = String(fd.get("user_id") || "").trim();
    const listing_id = String(fd.get("listing_id") || "").trim();
    if (!user_id || !listing_id) return;
    mutateCommerceStore((draft) => {
      const now = new Date().toISOString();
      const L = draft.listings.find((l) => l.id === listing_id);
      draft.entitlements.push({
        id: uid("ent"),
        user_id,
        entitlement_type: ENTITLEMENT_TYPE.manual_grant,
        listing_id,
        teacher_id: L?.seller_type === SELLER_TYPE.teacher ? L.teacher_id : null,
        source_type: ENTITLEMENT_SOURCE_TYPE.admin,
        source_id: uid("grant"),
        status: ENTITLEMENT_STATUS.active,
        starts_at: now,
        ends_at: null,
        created_at: now,
        updated_at: now,
      });
    });
    renderPage(root, ctx);
  });
}

let __stage0LangHandler = /** @type {null | (() => void)} */ (null);
let __stage0RootRef = /** @type {HTMLElement | null} */ (null);
let __stage0CtxRef = /** @type {{ snap: any, demoUserId: string } | null} */ (null);

export default async function pageLuminaTeacherStage0(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  const snap = await initCommerceStore();

  let demoUserId = "u_student_demo_001";
  try {
    demoUserId = sessionStorage.getItem("lumina_stage0_demo_user") || demoUserId;
  } catch {}

  const ctx = { snap, demoUserId };
  __stage0RootRef = root;
  __stage0CtxRef = ctx;
  if (__stage0LangHandler) window.removeEventListener("joy:langChanged", __stage0LangHandler);
  __stage0LangHandler = () => {
    if (__stage0RootRef?.isConnected && __stage0CtxRef) renderPage(__stage0RootRef, __stage0CtxRef);
  };
  window.addEventListener("joy:langChanged", __stage0LangHandler);
  renderPage(root, ctx);
}

export function mount(ctxOrRoot) {
  return pageLuminaTeacherStage0(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageLuminaTeacherStage0(ctxOrRoot);
}
