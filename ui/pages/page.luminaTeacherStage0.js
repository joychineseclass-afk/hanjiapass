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
  formatListingManagePrimaryLabel,
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

/** @param {string} status */
function listingStatusPill(status) {
  const label = formatCommerceEnum("listing_status", status);
  const safe = String(status || "unknown")
    .replace(/[^a-z0-9_]/gi, "")
    .toLowerCase();
  const mod = safe || "unknown";
  return `<span class="lts0-status-pill lts0-status-pill--${escapeHtml(mod)}">${escapeHtml(label)}</span>`;
}

/** @param {string|null|undefined} iso */
function formatListingUpdatedCell(iso) {
  if (iso == null || iso === "") return commerceT("commerce.table.empty_cell");
  const s = String(iso);
  const short = s.includes("T") ? s.replace("T", " ").slice(0, 16) : s.slice(0, 16);
  return escapeHtml(short);
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

  const listingRows =
    snap.listings.length === 0
      ? `<tr><td colspan="7" class="lts0-list-empty-cell">
          <div class="lts0-empty-in-table" role="status">
            <p class="lts0-empty-in-table-title">${escapeHtml(commerceT("commerce.stage0.list_empty_title"))}</p>
            <p class="lts0-empty-in-table-desc">${escapeHtml(commerceT("commerce.stage0.list_empty_hint"))}</p>
          </div>
        </td></tr>`
      : snap.listings
          .map((L) => {
            const tp =
              L.seller_type === SELLER_TYPE.teacher
                ? snap.teacher_profiles.find((x) => x.id === L.teacher_id) || null
                : null;
            const canSubmit =
              L.status === LISTING_STATUS.draft && assertCanSubmitListingForReview(tp, L).ok;
            const submitDisabled = canSubmit ? "" : "disabled";
            const primaryName = formatListingManagePrimaryLabel(L);
            const titleAttr = formatDemoListingContentTitleAttr(L);
            const nameHtml = titleAttr
              ? `<span title="${escapeHtml(titleAttr)}">${escapeHtml(primaryName)}</span>`
              : escapeHtml(primaryName);
            return `<tr data-listing-id="${escapeHtml(L.id)}">
        <td class="lts0-cell-strong">${nameHtml}</td>
        <td>${escapeHtml(formatCommerceEnum("listing_type", L.listing_type))}</td>
        <td>${listingStatusPill(L.status)}</td>
        <td>${escapeHtml(formatCommerceEnum("visibility", L.visibility))}</td>
        <td>${escapeHtml(String(L.price_amount))} ${escapeHtml(String(L.price_currency))}</td>
        <td>${formatListingUpdatedCell(L.updated_at)}</td>
        <td class="lts0-cell-actions">
          <button type="button" class="lts0-btn lts0-btn--teacher lts0-submit-review" data-id="${escapeHtml(L.id)}" ${submitDisabled}>${escapeHtml(commerceT("commerce.form.submit_review"))}</button>
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
    ? `<section class="card lts0-reviewer-zone">
        <h2 class="lts0-reviewer-zone-title">${escapeHtml(commerceT("commerce.review.zone_title"))}</h2>
        <p class="lts0-reviewer-zone-sub">${escapeHtml(commerceT("commerce.review.zone_subtitle"))}</p>
        <h3 class="lts0-reviewer-panel-title">${escapeHtml(commerceT("commerce.review.panel_title"))}</h3>
        <p class="lts0-reviewer-panel-desc">${escapeHtml(commerceT("commerce.review.panel_desc"))}</p>
        <div class="lts0-review-controls">
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
          <label class="lts0-review-reason-text">${escapeHtml(commerceT("commerce.review.reason_text"))}<br/><input id="lts0ReasonText" type="text" placeholder="${escapeHtml(commerceT("commerce.review.reason_placeholder"))}"/></label>
          <button type="button" class="lts0-btn lts0-btn--reviewer" id="lts0ApplyReview">${escapeHtml(commerceT("commerce.review.apply"))}</button>
        </div>
      </section>`
    : "";

  const accessUser = demoUserId;
  const accessListingId = snap.listings[0]?.id || "";
  const hasAccess = hasListingAccess(snap.entitlements, accessUser, accessListingId);
  const accessUserLabel = formatDemoUserDisplay(accessUser, snap.users.find((u) => u.id === accessUser)?.display_name);
  const accessListingObj = snap.listings.find((x) => x.id === accessListingId) || snap.listings[0];
  const accessListingLabel = accessListingObj
    ? formatDemoListingSelectLabel(accessListingObj)
    : commerceT("commerce.table.empty_cell");

  const secondaryFoldBody = `
      <div class="lts0-secondary-chunk">
        <p class="teacher-info-note-lead lts0-chunk-banner">${escapeHtml(commerceT("commerce.stage0.access_banner"))}</p>
        <h4 class="lts0-chunk-title">${escapeHtml(commerceT("commerce.stage0.access_title"))}</h4>
        <p class="lts0-access-line">${escapeHtml(
          String(i18n.t("commerce.stage0.access_body", { user: accessUserLabel, listing: accessListingLabel }) || "")
        )}
          <strong>${escapeHtml(hasAccess ? commerceT("commerce.stage0.access_yes") : commerceT("commerce.stage0.access_no"))}</strong>
          ${escapeHtml(commerceT("commerce.stage0.access_note"))}</p>
      </div>
      <div class="lts0-secondary-chunk">
        <p class="teacher-info-note-lead lts0-chunk-banner">${escapeHtml(commerceT("commerce.stage0.profile_note"))}</p>
        <h4 class="lts0-chunk-title">${escapeHtml(commerceT("commerce.stage0.profile_title"))}</h4>
        <p class="lts0-profile-caption">${escapeHtml(commerceT("commerce.stage0.profile_caption"))}</p>
        <div class="lts0-table-scroll">
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
      </div>
      <div class="lts0-secondary-chunk">
        <h4 class="lts0-chunk-title">${escapeHtml(commerceT("commerce.stage0.review_log_title"))}</h4>
        <div class="lts0-table-scroll">
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
      </div>
      <div class="lts0-secondary-chunk">
        <p class="teacher-info-note-lead lts0-chunk-banner">${escapeHtml(commerceT("commerce.stage0.entitlement_banner"))}</p>
        <h4 class="lts0-chunk-title">${escapeHtml(commerceT("commerce.stage0.entitlement_title"))}</h4>
        <form id="lts0Grant" class="lts0-grant-form">
          <label>${escapeHtml(commerceT("commerce.form.grant_user"))}<input name="user_id" value="u_student_demo_001"/></label>
          <label>${escapeHtml(commerceT("commerce.form.grant_listing"))}<select name="listing_id">${snap.listings
            .map((L) => {
              const lab = formatDemoListingSelectLabel(L);
              const tit = formatDemoListingContentTitleAttr(L);
              return `<option value="${escapeHtml(L.id)}" title="${escapeHtml(tit)}">${escapeHtml(lab)}</option>`;
            })
            .join("")}</select></label>
          <button type="submit" class="lts0-btn lts0-btn--ghost">${escapeHtml(commerceT("commerce.form.grant_submit"))}</button>
        </form>
        <div class="lts0-table-scroll lts0-table-scroll--tight">
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
      </div>
      <div class="lts0-secondary-chunk">
        <p class="teacher-info-note-lead lts0-chunk-banner">${escapeHtml(commerceT("commerce.stage0.order_banner"))}</p>
        <h4 class="lts0-chunk-title">${escapeHtml(commerceT("commerce.stage0.order_title"))}</h4>
        <p class="desc lts0-order-note">${escapeHtml(commerceT("commerce.stage0.order_note"))}</p>
        <div class="lts0-table-scroll">
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
      </div>`;

  root.innerHTML = `
    <div class="wrap lts0-page teacher-admin-shell">
      <p class="teacher-page-kicker teacher-page-kicker--shell">${escapeHtml(commerceT("teacher.manage.page_kicker"))}</p>
      <section class="card lts0-hero">
        <p class="teacher-admin-back">
          <a href="#teacher" class="teacher-back-link">${escapeHtml(commerceT("commerce.stage0.back_workspace"))}</a>
        </p>
        <div class="lts0-hero-top">
          <div class="lts0-hero-text">
            <h2 class="title">${escapeHtml(commerceT("commerce.stage0.title"))}</h2>
            <p class="desc">${escapeHtml(commerceT("commerce.stage0.subtitle"))}</p>
            <p class="lts0-stage-note">${escapeHtml(commerceT("commerce.stage0.stage_note"))}</p>
          </div>
          <span class="lts0-stage-badge" aria-label="${escapeHtml(commerceT("commerce.stage0.stage_badge"))}">${escapeHtml(commerceT("commerce.stage0.stage_badge"))}</span>
        </div>
      </section>

      <section class="card lts0-actions-hub">
        <div class="lts0-actions-grid">
          <div class="lts0-panel lts0-panel--primary">
            <h3 class="lts0-panel-title">${escapeHtml(commerceT("commerce.stage0.new_draft_title"))}</h3>
            <p class="lts0-panel-desc">${escapeHtml(commerceT("commerce.stage0.panel_draft_desc"))}</p>
            <form id="lts0NewListing" class="lts0-form-draft">
              <div class="lts0-form-primary-grid">
                <label>${escapeHtml(commerceT("commerce.form.title"))}<input name="title" required value="${escapeHtml(commerceT("commerce.form.default_title"))}"/></label>
                <label>${escapeHtml(commerceT("commerce.form.listing_type"))}<select name="listing_type">${optEnumLocalized(Object.values(LISTING_TYPE), LISTING_TYPE.course, "listing_type")}</select></label>
                <label>${escapeHtml(commerceT("commerce.form.delivery_type"))}<select name="delivery_type">${optEnumLocalized(Object.values(DELIVERY_TYPE), DELIVERY_TYPE.recorded, "delivery_type")}</select></label>
                <label>${escapeHtml(commerceT("commerce.form.visibility"))}<select name="visibility">${optEnumLocalized(Object.values(VISIBILITY), VISIBILITY.private, "visibility")}</select></label>
                <label>${escapeHtml(commerceT("commerce.form.price_amount"))}<input name="price_amount" value="10000"/></label>
                <label>${escapeHtml(commerceT("commerce.form.refund_policy"))}<select name="refund_policy_type">${optEnumLocalized(
                  Object.values(REFUND_POLICY_TYPE),
                  REFUND_POLICY_TYPE.within_7_days,
                  "refund_policy_type"
                )}</select></label>
              </div>
              <details class="lts0-form-more">
                <summary class="lts0-form-more-summary">
                  <span class="lts0-form-more-title">${escapeHtml(commerceT("commerce.form.more_settings"))}</span>
                  <span class="lts0-form-more-hint">${escapeHtml(commerceT("commerce.form.more_settings_hint"))}</span>
                </summary>
                <div class="lts0-form-more-grid">
                  <label>${escapeHtml(commerceT("commerce.form.seller_type"))}<select name="seller_type">${optEnumLocalized(Object.values(SELLER_TYPE), SELLER_TYPE.teacher, "seller_type")}</select></label>
                  <label>${escapeHtml(commerceT("commerce.form.teacher_profile_id"))}<input name="teacher_id" placeholder="${escapeHtml(commerceT("commerce.form.teacher_placeholder"))}" value="tp_demo_seller_001"/></label>
                  <label>${escapeHtml(commerceT("commerce.form.price_currency"))}<input name="price_currency" value="${DEFAULT_SETTLEMENT_CURRENCY}"/></label>
                </div>
              </details>
              <div class="lts0-form-actions">
                <button type="submit" class="lts0-btn lts0-btn--primary">${escapeHtml(commerceT("commerce.form.create_draft"))}</button>
              </div>
            </form>
          </div>
          <div class="lts0-panel lts0-panel--identity">
            <h3 class="lts0-panel-title">${escapeHtml(commerceT("commerce.stage0.identity_title"))}</h3>
            <p class="lts0-panel-desc">${escapeHtml(commerceT("commerce.stage0.identity_desc"))}</p>
            <div class="lts0-identity-row">
              <label class="lts0-identity-select">${escapeHtml(commerceT("commerce.stage0.identity_switch"))}
                <select id="lts0DemoUser" aria-label="${escapeHtml(commerceT("commerce.stage0.identity_switch"))}">
                  ${snap.users
                    .map((u) => {
                      const label = formatDemoUserDisplay(u.id, u.display_name);
                      return `<option value="${escapeHtml(u.id)}" ${u.id === demoUserId ? "selected" : ""}>${escapeHtml(label)}</option>`;
                    })
                    .join("")}
                </select>
              </label>
              <button type="button" class="lts0-btn lts0-btn--ghost" id="lts0ResetSeed">${escapeHtml(commerceT("commerce.stage0.reset_seed"))}</button>
            </div>
            ${
              isReviewer
                ? `<p class="lts0-reviewer-hint">${escapeHtml(commerceT("commerce.stage0.identity_reviewer_active"))}</p>`
                : `<p class="lts0-muted">${escapeHtml(commerceT("commerce.review.hidden"))}</p>`
            }
          </div>
          <div class="lts0-panel lts0-panel--guide">
            <h3 class="lts0-panel-title">${escapeHtml(commerceT("commerce.stage0.guide_title"))}</h3>
            <ul class="lts0-guide-list">
              <li>${escapeHtml(commerceT("commerce.stage0.guide_1"))}</li>
              <li>${escapeHtml(commerceT("commerce.stage0.guide_2"))}</li>
              <li>${escapeHtml(commerceT("commerce.stage0.guide_3"))}</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="card lts0-listing-main">
        <h2 class="lts0-listing-main-title">${escapeHtml(commerceT("commerce.stage0.listing_title"))}</h2>
        <p class="lts0-listing-main-hint">${escapeHtml(commerceT("commerce.stage0.list_section_hint"))}</p>
        <div class="lts0-table-scroll">
          <table class="lts0-table lts0-table--listing">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(formatCommerceTableHead("content_name"))}</th>
                <th scope="col">${escapeHtml(formatCommerceTableHead("listing_type"))}</th>
                <th scope="col">${escapeHtml(formatCommerceTableHead("status"))}</th>
                <th scope="col">${escapeHtml(formatCommerceTableHead("visibility"))}</th>
                <th scope="col">${escapeHtml(formatCommerceTableHead("price"))}</th>
                <th scope="col">${escapeHtml(formatCommerceTableHead("updated_at"))}</th>
                <th scope="col" class="lts0-th-actions">${escapeHtml(formatCommerceTableHead("actions"))}</th>
              </tr>
            </thead>
            <tbody>${listingRows}</tbody>
          </table>
        </div>
      </section>

      ${reviewPanel}

      <details class="card lts0-fold-secondary">
        <summary class="lts0-fold-secondary-summary">
          <span class="lts0-fold-secondary-title">${escapeHtml(commerceT("commerce.stage0.secondary_fold_title"))}</span>
          <span class="lts0-fold-secondary-hint">${escapeHtml(commerceT("commerce.stage0.secondary_fold_hint"))}</span>
        </summary>
        <div class="lts0-fold-secondary-body">
          ${secondaryFoldBody}
        </div>
      </details>
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
