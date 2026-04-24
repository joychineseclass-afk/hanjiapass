// /ui/pages/page.teacher.js
// 老师工作台：基于当前用户身份与 teacher profile 状态分流。

import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherWorkspaceDemoSummary } from "../lumina-commerce/teacherDemoCatalog.js";
import { initCommerceStore } from "../lumina-commerce/store.js";
import { getTeacherProfileCommerceStats } from "../lumina-commerce/teacherCommerceBridge.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { applyToBecomeTeacher, getCurrentSessionAuthUser, getTeacherNavRoleState, hydrateCurrentUserFromSession } from "../auth/authService.js";
import {
  devForceApproveCurrentUserTeacherProfile,
  migrateDemoTeacherProfileToAuthUser,
} from "../lumina-commerce/teacherProfileService.js";
import { logTeacherHubPageDebug } from "../lumina-commerce/teacherPageDebugLog.js";
import {
  getRecentAssetsForProfile,
  getTeacherClassroomAssetCountForProfile,
  listAssetsByProfileId,
  ASSET_TYPE,
  ASSET_STATUS,
} from "../lumina-commerce/teacherAssetsSelectors.js";
import { findListingByAssetId } from "../lumina-commerce/teacherListingBridge.js";
import { findAssetById } from "../lumina-commerce/teacherAssetsStore.js";
import { LISTING_STATUS, VISIBILITY } from "../lumina-commerce/enums.js";
import { i18n } from "../i18n.js";
import {
  renderTeacherAdminShell,
  teacherPathStripHtml,
  teacherPathStripClassroomHintHtml,
  userCanAccessTeacherReviewConsole,
} from "./teacherPathNav.js";

function tx(path, params) {
  return safeUiText(path, params);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** @param {string|undefined|null} iso */
function fmtProfileTime(iso) {
  if (!iso) return "";
  const s = String(iso);
  return s.includes("T") ? s.replace("T", " ").slice(0, 19) : s.slice(0, 19);
}

let __teacherLangHandler = /** @type {null | (() => void)} */ (null);
let __teacherAuthHandler = /** @type {null | (() => void)} */ (null);
let __teacherRootRef = /** @type {HTMLElement | null} */ (null);

/**
 * @param {string} st
 * @param {(a: string, b?: object) => string} t
 */
function statusChipClass(st) {
  const s = String(st).replace(/[^a-z0-9_]/gi, "_");
  return `teacher-wb-status-chip teacher-wb-status-chip--${s}`;
}

/**
 * 发布项状态 pill：与三页 `teacher-state-pill` 术语统一。
 * @param {import('../lumina-commerce/schema.js').Listing} L
 * @param {(a: string, b?: object) => string} t
 */
function listingUnifiedPillsHtml(L, t) {
  const st = L.status;
  const stMod =
    st === LISTING_STATUS.pending_review
      ? "pending"
      : st === LISTING_STATUS.approved
        ? "approved"
        : st === LISTING_STATUS.rejected
          ? "rejected"
          : "draft";
  const stKey =
    st === LISTING_STATUS.pending_review
      ? "status_pending"
      : st === LISTING_STATUS.approved
        ? "status_approved"
        : st === LISTING_STATUS.rejected
          ? "status_rejected"
          : "status_draft";
  const pub = L.visibility === VISIBILITY.public;
  const visKey = pub ? "vis_public" : "vis_private";
  const visMod = pub ? "vis_public" : "vis_private";
  return `<span class="teacher-state-pill teacher-state-pill--${stMod}">${escapeHtml(
    t(`teacher.unified.${stKey}`),
  )}</span><span class="teacher-state-pill teacher-state-pill--${visMod}">${escapeHtml(t(`teacher.unified.${visKey}`))}</span>`;
}

/**
 * @param {import('../lumina-commerce/store.js').CommerceStoreSnapshot|null|undefined} snap
 * @param {string} profileId
 * @param {number} limit
 * @returns {import('../lumina-commerce/schema.js').Listing[]}
 */
function listRecentListingsForTeacher(snap, profileId, limit) {
  if (!snap || !Array.isArray(snap.listings)) return [];
  return snap.listings
    .filter((L) => String(L.teacher_id || "") === String(profileId))
    .sort((a, b) => (String(a.updated_at) < String(b.updated_at) ? 1 : -1))
    .slice(0, Math.max(0, limit));
}

/**
 * 轻量推荐下一步：按「课件/发布项」链路的简单优先级，取任意课件上最先需要处理的一项。
 * @param {string} profileId
 * @param {import('../lumina-commerce/store.js').CommerceStoreSnapshot|null|undefined} snap
 * @param {(a: string, b?: object) => string} t
 */
function computeRecommendedNextStep(profileId, snap, t) {
  const assets = listAssetsByProfileId(profileId).filter(
    (a) => a.asset_type === ASSET_TYPE.lesson_slide_draft && a.status !== ASSET_STATUS.archived,
  );
  if (assets.length === 0) {
    return {
      key: "no_deck",
      rank: 0,
      lineKey: "teacher.recommended.line_no_deck",
      primaryLabelKey: "teacher.recommended.primary_create_deck",
      primaryHref: "#teacher-assets",
    };
  }
  const candidates = [];
  for (const a of assets) {
    const L = snap ? findListingByAssetId(snap, a.id) : null;
    if (!L) {
      candidates.push({
        rank: 1,
        key: "no_listing",
        lineKey: "teacher.recommended.line_no_listing",
        primaryLabelKey: "teacher.recommended.primary_create_listing",
        primaryHref: `#teacher-asset-editor?id=${encodeURIComponent(a.id)}`,
        secondaryLabelKey: "teacher.recommended.secondary_open_assets",
        secondaryHref: "#teacher-assets",
      });
      continue;
    }
    if (L.status === LISTING_STATUS.draft || L.status === LISTING_STATUS.rejected) {
      candidates.push({
        rank: 2,
        key: "submit",
        lineKey: "teacher.recommended.line_submit",
        primaryLabelKey: "teacher.recommended.primary_submit",
        primaryHref: `#teacher-asset-editor?id=${encodeURIComponent(a.id)}`,
      });
      continue;
    }
    if (L.status === LISTING_STATUS.pending_review) {
      candidates.push({
        rank: 3,
        key: "pending",
        lineKey: "teacher.recommended.line_pending",
        primaryLabelKey: "teacher.recommended.primary_open_publishing",
        primaryHref: "#teacher-publishing",
      });
      continue;
    }
    if (L.status === LISTING_STATUS.approved && L.visibility !== VISIBILITY.public) {
      candidates.push({
        rank: 4,
        key: "gopub",
        lineKey: "teacher.recommended.line_go_public",
        primaryLabelKey: "teacher.recommended.primary_preview_and_publish",
        primaryHref: `#teacher-listing?id=${encodeURIComponent(L.id)}`,
      });
    }
  }
  if (candidates.length === 0) {
    return {
      key: "all_ok",
      rank: 99,
      lineKey: "teacher.recommended.line_all_ok",
      primaryLabelKey: "teacher.recommended.primary_manage_assets",
      primaryHref: "#teacher-assets",
    };
  }
  candidates.sort((x, y) => x.rank - y.rank);
  return candidates[0];
}

/**
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
function teacherGatePanelHtml(ctx, t) {
  const w = ctx.workbenchStatus;
  if (w === "not_teacher") {
    if (ctx.isLoggedIn) {
      const devTakeoverBlock =
        ctx.showDemoTakeoverCta
          ? `<p class="teacher-migration-hint">${escapeHtml(t("teacher.gate.migration_dev_hint"))}</p>
        <button type="button" class="teacher-identity-gate-cta teacher-identity-gate-cta--dev" id="takeoverDemoTeacherBtn">
          ${escapeHtml(t("teacher.gate.takeover_demo_cta"))}
        </button>
        <p class="teacher-takeover-sub">${escapeHtml(t("teacher.gate.takeover_demo_sub"))}</p>`
          : "";
      return `
      <section class="card teacher-identity-gate teacher-gate" aria-labelledby="tw-gate-title">
        <h3 id="tw-gate-title" class="teacher-identity-gate-title">${escapeHtml(t("teacher.gate.logged_in_not_teacher_title"))}</h3>
        <p class="teacher-identity-gate-body">${escapeHtml(t("teacher.gate.logged_in_not_teacher_body"))}</p>
        <button type="button" class="teacher-identity-gate-cta" id="applyTeacherProfileBtn">
          ${escapeHtml(t("teacher.gate.apply_cta"))}
        </button>
        <p class="teacher-identity-gate-foot">${escapeHtml(t("teacher.gate.apply_note_v2"))}</p>
        ${devTakeoverBlock}
      </section>`;
    }
    return `
      <section class="card teacher-identity-gate" aria-labelledby="tw-gate-title">
        <h3 id="tw-gate-title" class="teacher-identity-gate-title">${escapeHtml(t("teacher.gate.not_teacher_title"))}</h3>
        <p class="teacher-identity-gate-body">${escapeHtml(t("teacher.gate.not_teacher_body"))}</p>
        <p class="teacher-identity-gate-scope">${escapeHtml(t("teacher.gate.not_teacher_scope"))}</p>
        <button type="button" class="teacher-identity-gate-cta" disabled aria-disabled="true">
          ${escapeHtml(t("teacher.gate.apply_cta"))}
        </button>
        <p class="teacher-identity-gate-foot">${escapeHtml(t("teacher.gate.apply_note"))}</p>
      </section>`;
  }
  const label = escapeHtml(t(`teacher.wbstate.${w}`));
  const titleKey = `teacher.gate.title_${w}`;
  const bodyKey = `teacher.gate.body_${w}`;
  const nextKey = `teacher.gate.next_${w}`;
  const title = escapeHtml(t(titleKey));
  const body = escapeHtml(t(bodyKey));
  const next = escapeHtml(t(nextKey));
  const showProfileCta = w === "no_profile" || w === "draft" || w === "rejected";
  const showPendingOnly = w === "pending_review";
  const showDraftPath = w === "draft" || w === "no_profile";
  const devForceBlock =
    w !== "not_teacher" && ctx.showDevForceApproveCta
      ? `<p class="teacher-migration-hint">${escapeHtml(t("teacher.gate.dev_force_hint"))}</p>
        <button type="button" class="teacher-identity-gate-cta teacher-identity-gate-cta--dev" id="devForceApproveTeacherProfileBtn">
          ${escapeHtml(t("teacher.gate.dev_force_approve_cta"))}
        </button>`
      : "";
  const reasonBlock =
    w === "rejected"
      ? `<p class="teacher-identity-gate-reason"><strong>${escapeHtml(t("teacher.gate.rejected_reason_label"))}</strong> ${escapeHtml(
          ctx.profile?.rejection_reason || t("teacher.gate.rejected_reason_placeholder"),
        )}</p>
         <p class="teacher-identity-gate-resubmit"><a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-profile">${escapeHtml(
           t("teacher.gate.resubmit_link"),
         )}</a></p>`
      : "";
  return `
    <section class="card teacher-identity-gate teacher-gate" aria-labelledby="tw-gate-teacher-title">
      <div class="teacher-identity-gate-row">
        <h3 id="tw-gate-teacher-title" class="teacher-identity-gate-title">${title}</h3>
        <span class="${escapeHtml(statusChipClass(w))}" aria-label="${label}">${label}</span>
      </div>
      <p class="teacher-identity-gate-body">${body}</p>
      <p class="teacher-identity-gate-next"><strong>${escapeHtml(t("teacher.gate.next_label"))}</strong> ${next}</p>
      ${showProfileCta && w !== "rejected" ? `<p class="teacher-gate-cta-row"><a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-profile">${escapeHtml(
        t("teacher.gate.cta_profile"),
      )}</a></p>` : ""}
      ${
        showDraftPath
          ? `<p class="teacher-gate-draft-hint">${escapeHtml(t("teacher.gate.draft_path_hint"))}</p>`
          : ""
      }
      ${showPendingOnly ? `<p class="teacher-gate-pending-hint">${escapeHtml(t("teacher.gate.pending_teacher_apply"))}</p>` : ""}
      ${
        showPendingOnly && ctx.profile?.submitted_at
          ? `<p class="teacher-gate-submitted-line"><strong>${escapeHtml(t("teacher.gate.submitted_time_label"))}:</strong> ${escapeHtml(
              fmtProfileTime(ctx.profile.submitted_at),
            )}</p><p class="teacher-gate-pending-ability">${escapeHtml(t("teacher.gate.pending_ability"))}</p>`
          : ""
      }
      ${reasonBlock}
      ${devForceBlock}
      <p class="teacher-identity-gate-locked-note">${escapeHtml(t("teacher.gate.workbench_limited"))}</p>
    </section>`;
}

/**
 * @param {ReturnType<typeof getTeacherWorkspaceDemoSummary>} sum
 */
/**
 * @param {object} st
 * @param {(a: string, b?: object) => string} t
 */
function teacherSalesOverviewHtml(st, t) {
  if (!st) return "";
  const fmt = (n) => String(Math.round(Number(n) || 0).toLocaleString());
  return `
    <section class="card teacher-sales-overview" aria-labelledby="teacher-sales-title">
      <h3 id="teacher-sales-title" class="teacher-sales-title">${escapeHtml(t("teacher.sales.title"))}</h3>
      <p class="teacher-sales-lead">${escapeHtml(t("teacher.sales.lead"))}</p>
      <div class="teacher-sales-chips">
        <span class="teacher-sales-chip"><strong>${fmt(st.publicListingCount)}</strong> ${escapeHtml(t("teacher.sales.chip_public_listings"))}</span>
        <span class="teacher-sales-chip"><strong>${fmt(st.grantOrSaleCount)}</strong> ${escapeHtml(t("teacher.sales.chip_grants_or_sales"))}</span>
        <span class="teacher-sales-chip"><strong>${fmt(st.totalGross)} KRW</strong> ${escapeHtml(t("teacher.sales.chip_gross"))}</span>
        <span class="teacher-sales-chip"><strong>${fmt(st.totalTeacherIncome)} KRW</strong> ${escapeHtml(t("teacher.sales.chip_teacher_income"))}</span>
        <span class="teacher-sales-chip"><strong>${fmt(st.totalPlatformIncome)} KRW</strong> ${escapeHtml(t("teacher.sales.chip_platform_share"))}</span>
      </div>
      <p class="teacher-sales-pending">${escapeHtml(t("teacher.sales.pending_settlement"))}</p>
    </section>`;
}

/** 核心数据摘要：更短说明，用于已批准工作台。 */
function teacherWorkspaceOverviewHtmlHub(sum, t) {
  const p = "teacher.workspace.overview_mine";
  const chips = [
    t(`${p}.chip_materials`, { count: String(sum.materialsCount) }),
    t(`${p}.chip_courses`, { count: String(sum.coursesCount) }),
    t(`${p}.chip_classroom_assets`, { count: String(sum.classroomAssetCount) }),
    t(`${p}.chip_listings`, { count: String(sum.listingTotal) }),
    t(`${p}.chip_pending`, { count: String(sum.pendingReview) }),
    t(`${p}.chip_approved`, { count: String(sum.approved) }),
  ];
  const chipsHtml = chips.map((c) => `<span class="teacher-workspace-chip teacher-workspace-chip--hub">${escapeHtml(c)}</span>`).join("");
  return `
      <section class="card teacher-workspace-overview teacher-workspace-overview--hub" aria-labelledby="tw-hub-summary">
        <h3 id="tw-hub-summary" class="teacher-workspace-overview-title">${escapeHtml(t("teacher.workspace.hub_summary_title"))}</h3>
        <p class="teacher-workspace-overview-disclosure teacher-workspace-overview-disclosure--short">${escapeHtml(
          t("teacher.workspace.hub_summary_disclosure"),
        )}</p>
        <div class="teacher-workspace-overview-chips">${chipsHtml}</div>
      </section>`;
}

/**
 * 课堂资产状态 pill（与三页统一样式类名）。
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} a
 * @param {(a: string, b?: object) => string} t
 */
function assetStatePillHtml(a, t) {
  const s = String(a.status);
  const mod = s.replace(/[^a-z0-9_]/g, "_");
  return `<span class="teacher-state-pill teacher-state-pill--asset_${mod}">${escapeHtml(t(`teacher.assets.state.${s}`))}</span>`;
}

/**
 * 已通过审核的完整工作台。
 * @param {import('../lumina-commerce/teacherSelectors.js').ResolvedTeacherProfile} profile
 * @param {ReturnType<typeof getTeacherWorkspaceDemoSummary>} sum
 * @param {(a: string, b?: object) => string} t
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset[]} recentAssets
 * @param {object|null} commerceStats
 * @param {import('../lumina-commerce/store.js').CommerceStoreSnapshot|null|undefined} commerceSnap
 * @param {boolean} showReviewConsole
 */
function approvedWorkbenchHtml(profile, sum, t, recentAssets, commerceStats, commerceSnap, showReviewConsole) {
  const st = String(profile.workbench_status);
  const label = escapeHtml(t(`teacher.wbstate.${st}`));
  const rec = computeRecommendedNextStep(String(profile.id), commerceSnap, t);
  const recSec = /** @type {typeof rec & { secondaryLabelKey?: string; secondaryHref?: string }} */ (rec);
  const secondaryCta =
    recSec.secondaryHref && recSec.secondaryLabelKey
      ? `<a class="teacher-hub-cta teacher-hub-cta--secondary" href="${escapeHtml(recSec.secondaryHref)}">${escapeHtml(
          t(recSec.secondaryLabelKey),
        )}</a>`
      : "";
  const recentListings = listRecentListingsForTeacher(commerceSnap, String(profile.id), 3);
  const recentListRows =
    recentListings.length === 0
      ? `<li class="teacher-hub-recent-listing-item teacher-hub-recent-listing-item--empty">${escapeHtml(
          t("teacher.workspace.hub_listings_empty"),
        )}</li>`
      : recentListings
          .map((L) => {
            const src =
              L.source_kind === "classroom_asset" && L.source_id
                ? findAssetById(String(L.source_id))
                : null;
            const title0 =
              String(L.title || "")
                .trim() || (src && String(src.title).trim()) || t("teacher.unified.term_listing");
            return `<li class="teacher-hub-recent-listing-item">
  <a class="teacher-hub-recent-listing-link" href="#teacher-listing?id=${encodeURIComponent(L.id)}"><span class="teacher-hub-recent-listing-title">${escapeHtml(
    title0,
  )}</span></a>
  <span class="teacher-hub-recent-listing-pills">${listingUnifiedPillsHtml(L, t)}</span>
</li>`;
          })
          .join("");
  const recentRows =
    recentAssets.length === 0
      ? `<li class="teacher-assets-recent-item teacher-assets-recent-item--empty">${escapeHtml(t("teacher.assets.recent_empty"))}</li>`
      : recentAssets
          .map((a) => {
            const isUploaded = a.asset_type === ASSET_TYPE.uploaded_slide_draft;
            const src = isUploaded
              ? t("teacher.assets.source_local_import")
              : t("teacher.assets.source_line", {
                  course: formatTeacherHubCourseDisplay(a.source.course),
                  level: a.source.level,
                  lesson: a.source.lesson,
                });
            const editDeck = isUploaded
              ? `<a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
                  t("teacher.assets.open_import_draft"),
                )}</a>`
              : a.asset_type === ASSET_TYPE.lesson_slide_draft
                ? `<a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-asset-editor?id=${encodeURIComponent(a.id)}">${escapeHtml(
                    t("teacher.workspace.hub_deck_edit"),
                  )}</a>`
                : `<span class="teacher-hub-muted" title="${escapeHtml(t("teacher.assets.edit_placeholder"))}">${escapeHtml(
                    t("teacher.assets.edit"),
                  )}</span>`;
            const enterClass = isUploaded
              ? `<span class="teacher-hub-muted" title="${escapeHtml(t("teacher.assets.enter_classroom_blocked_upload_title"))}">${escapeHtml(
                  t("teacher.assets.enter_classroom_blocked_upload_short"),
                )}</span>`
              : `<a class="teacher-hub-cta teacher-hub-cta--primary teacher-hub-cta--compact" href="#classroom?assetId=${encodeURIComponent(
                  a.id,
                )}">${escapeHtml(t("teacher.assets.enter_classroom"))}</a>`;
            return `<li class="teacher-assets-recent-item">
              <div class="teacher-assets-recent-main">
                <span class="teacher-assets-recent-title">${escapeHtml(a.title)}</span>
                <span class="teacher-assets-recent-src">${escapeHtml(src)}</span>
              </div>
              ${assetStatePillHtml(a, t)}
              <div class="teacher-assets-recent-actions">
                ${enterClass}
                ${editDeck}
              </div>
            </li>`;
          })
          .join("");

  const workbenchMain =
    teacherActiveHomeWorkflowHtml(t) +
    `
      <section class="card teacher-surface-hero teacher-hub-surface" aria-labelledby="tw-hub-h1">
        <p class="teacher-page-kicker">${escapeHtml(t("teacher.workspace.hub_hero_kicker"))}</p>
        <div class="teacher-hub-surface-row">
          <div class="teacher-hub-surface-main">
            <h1 id="tw-hub-h1" class="teacher-hub-surface-title">${escapeHtml(t("teacher.workspace.mine_title"))}</h1>
            <p class="teacher-hub-identity">
              <span class="teacher-hub-identity-k">${escapeHtml(t("teacher.workspace.hub_label_identity"))}</span>
              <span class="teacher-hub-identity-v">${escapeHtml(profile.display_name)}</span>
              <a class="teacher-hub-inline-link" href="#teacher-profile">${escapeHtml(t("teacher.nav.teacher_profile"))}</a>
            </p>
            <p class="teacher-hub-identity">
              <span class="teacher-hub-identity-k">${escapeHtml(t("teacher.workspace.hub_label_review"))}</span>
              <span class="${escapeHtml(statusChipClass(st))} teacher-hub-profile-chip" aria-label="${label}">${label}</span>
            </p>
          </div>
        </div>
      </section>

      <section class="card teacher-hub-recommended" aria-labelledby="tw-hub-rec">
        <h2 id="tw-hub-rec" class="teacher-hub-section-title">${escapeHtml(t("teacher.workspace.hub_recommended_title"))}</h2>
        <p class="teacher-hub-recommended-line">${escapeHtml(t(rec.lineKey))}</p>
        <div class="teacher-hub-recommended-cta">
          <a class="teacher-hub-cta teacher-hub-cta--primary" href="${escapeHtml(rec.primaryHref)}">${escapeHtml(t(rec.primaryLabelKey))}</a>
          ${secondaryCta}
        </div>
      </section>

      ${teacherWorkspaceOverviewHtmlHub(sum, t)}

      <section class="card teacher-relation-flow teacher-relation-flow--tight" aria-label="${escapeHtml(t("teacher.relation_flow.title"))}">
        <p class="teacher-relation-flow-title">${escapeHtml(t("teacher.workspace.hub_path_lead"))}</p>
        ${teacherPathStripHtml(null, t)}
        ${teacherPathStripClassroomHintHtml(t)}
      </section>

      ${teacherSalesOverviewHtml(commerceStats, t)}

      <section class="card teacher-hub-recent-dual" aria-label="${escapeHtml(t("teacher.workspace.hub_recent_aria"))}">
        <div class="teacher-hub-recent-col">
          <h2 class="teacher-hub-section-title teacher-hub-section-title--small">${escapeHtml(t("teacher.workspace.hub_recent_decks"))}</h2>
          <ol class="teacher-assets-recent-list teacher-assets-recent-list--hub">${recentRows}</ol>
        </div>
        <div class="teacher-hub-recent-col">
          <h2 class="teacher-hub-section-title teacher-hub-section-title--small">${escapeHtml(t("teacher.workspace.hub_recent_listings"))}</h2>
          <p class="teacher-hub-recent-dual-hint">
            <a class="teacher-hub-inline-link" href="#teacher-publishing">${escapeHtml(t("teacher.workspace.hub_listings_link"))}</a>
          </p>
          <ul class="teacher-hub-recent-listing-list">${recentListRows}</ul>
        </div>
      </section>

      <section class="card teacher-tile-classroom teacher-tile--primary teacher-hub-classroom-only" id="teacher-hub-classroom" tabindex="-1">
        <p class="teacher-tile-stage-kicker">${escapeHtml(t("teacher.enter.classroom_stage_kicker"))}</p>
        <h2 class="teacher-hub-classroom-h2">${escapeHtml(t("teacher.enter.classroom_section_title"))}</h2>
        <p class="teacher-tile-desc">${escapeHtml(t("teacher.enter.classroom_section_lead"))}</p>
        <p class="teacher-tile-workflow-note">${escapeHtml(t("teacher.enter.classroom_workflow_note_mine"))}</p>
        <div class="teacher-classroom-form teacher-classroom-form--primary">
          <label class="teacher-field">
            <span>${escapeHtml(t("teacher.label.course"))}</span>
            <select id="teacherCourseSelect">
              <option value="kids">${escapeHtml(formatTeacherHubCourseDisplay("kids"))}</option>
              <option value="hsk">${escapeHtml(formatTeacherHubCourseDisplay("hsk"))}</option>
            </select>
          </label>
          <label class="teacher-field">
            <span>${escapeHtml(t("teacher.label.level"))}</span>
            <select id="teacherLevelSelect">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
          <label class="teacher-field">
            <span>${escapeHtml(t("teacher.label.lesson"))}</span>
            <input id="teacherLessonInput" type="number" min="1" value="1" />
          </label>
          <button type="button" id="teacherEnterClassroomBtn" class="teacher-hub-cta teacher-hub-cta--primary">
            ${escapeHtml(t("teacher.enter.classroom_button"))}
          </button>
        </div>
      </section>
  `;
  return renderTeacherAdminShell({
    active: "workspace",
    tx: t,
    showReviewConsole,
    shellClass: "teacher-page teacher-hub",
    mainHtml: workbenchMain,
  });
}

/**
 * 老师身份但尚未通过：保留导航、路径条，主功能受限。
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
function gatedTeacherShellHtml(ctx, t) {
  const main = `
      <section class="teacher-hero card teacher-center-page teacher-hero--compact">
        <p class="teacher-page-kicker">${escapeHtml(t("teacher.manage.page_kicker_mine"))}</p>
        <h2 class="title">${escapeHtml(t("teacher.workspace.mine_title"))}</h2>
        <p class="desc teacher-hero-lead">${escapeHtml(t("teacher.workspace.gated_lead"))}</p>
      </section>
      ${teacherGatePanelHtml(ctx, t)}
      <section class="card teacher-relation-flow teacher-relation-flow--muted" aria-label="${escapeHtml(t("teacher.relation_flow.title_mine"))}">
        <p class="teacher-relation-flow-title">${escapeHtml(t("teacher.relation_flow.title_mine"))}</p>
        ${teacherPathStripHtml(null, t)}
        ${teacherPathStripClassroomHintHtml(t)}
      </section>
  `;
  return renderTeacherAdminShell({ active: "workspace", tx: t, mainHtml: main, shellClass: "teacher-page" });
}

/**
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
/**
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 */
function notTeacherShellHtml(t, ctx) {
  const main = `
      <section class="teacher-hero card teacher-center-page teacher-hero--compact">
        <p class="teacher-page-kicker">${escapeHtml(t("teacher.manage.page_kicker"))}</p>
        <h2 class="title">${escapeHtml(t("teacher.workspace.mine_entry_title"))}</h2>
        <p class="desc teacher-hero-lead">${escapeHtml(t("teacher.workspace.mine_entry_subtitle"))}</p>
      </section>
      ${teacherGatePanelHtml(ctx, t)}
  `;
  return renderTeacherAdminShell({ active: "workspace", tx: t, mainHtml: main, shellClass: "teacher-page" });
}

/**
 * 未登录：引导注册 / 登录
 * @param {(a: string, b?: object) => string} t
 */
function guestAuthShellHtml(t) {
  const main = `
      <section class="card teacher-hero teacher-hero--compact">
        <h2 class="title">${escapeHtml(t("teacher.gate.guest_title"))}</h2>
        <p class="desc teacher-hero-lead">${escapeHtml(t("teacher.gate.guest_body"))}</p>
        <div class="teacher-gate-auth-actions">
          <a class="teacher-hub-cta teacher-hub-cta--primary" href="#auth-login">${escapeHtml(t("auth.nav_login"))}</a>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#auth-register">${escapeHtml(t("auth.nav_register"))}</a>
        </div>
      </section>
  `;
  return renderTeacherAdminShell({ active: "workspace", tx: t, mainHtml: main, shellClass: "teacher-page teacher-gate--guest" });
}

/**
 * Lumina 身份层：工作流总览（仅 active 且已通过 commerce 工作台时插在原有内容前）
 * @param {(a: string, b?: object) => string} t
 */
function teacherActiveHomeWorkflowHtml(t) {
  return `
    <div class="teacher-lumina-home" data-teacher-lumina-home>
      <section class="card teacher-lumina-home__hero">
        <p class="teacher-page-kicker">${escapeHtml(t("teacher.home.kicker"))}</p>
        <h1 class="teacher-lumina-home__h1">${escapeHtml(t("teacher.home.title"))}</h1>
        <p class="desc teacher-lumina-home__lead">${escapeHtml(t("teacher.home.subtitle"))}</p>
        <span class="role-pill role-pill--ok teacher-lumina-home__badge" data-i18n="teacher.home.badge_open">${escapeHtml(
          t("teacher.home.badge_open"),
        )}</span>
        <p class="teacher-lumina-home__top-actions">
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#my" data-teacher-spa="1">${escapeHtml(t("teacher.home.back_my"))}</a>
        </p>
      </section>
      <div class="teacher-lumina-wf-grid">
        <article class="card teacher-lumina-wf-card">
          <h2 class="teacher-lumina-wf-card__h">${escapeHtml(t("teacher.home.card_courses_title"))}</h2>
          <p class="teacher-lumina-wf-card__d">${escapeHtml(t("teacher.home.card_courses_desc"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-courses" data-teacher-spa="1">${escapeHtml(
            t("teacher.home.card_courses_cta"),
          )}</a>
        </article>
        <article class="card teacher-lumina-wf-card">
          <h2 class="teacher-lumina-wf-card__h">${escapeHtml(t("teacher.home.card_assets_title"))}</h2>
          <p class="teacher-lumina-wf-card__d">${escapeHtml(t("teacher.home.card_assets_desc"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-assets" data-teacher-spa="1">${escapeHtml(
            t("teacher.home.card_assets_cta"),
          )}</a>
        </article>
        <article class="card teacher-lumina-wf-card">
          <h2 class="teacher-lumina-wf-card__h">${escapeHtml(t("teacher.home.card_classroom_title"))}</h2>
          <p class="teacher-lumina-wf-card__d">${escapeHtml(t("teacher.home.card_classroom_desc"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--primary" href="#classroom" data-teacher-spa="1">${escapeHtml(
            t("teacher.home.card_classroom_cta"),
          )}</a>
        </article>
        <article class="card teacher-lumina-wf-card teacher-lumina-wf-card--muted">
          <h2 class="teacher-lumina-wf-card__h">${escapeHtml(t("teacher.home.card_publish_title"))}</h2>
          <p class="teacher-lumina-wf-card__d">${escapeHtml(t("teacher.home.card_publish_desc"))}</p>
          <span class="teacher-lumina-soon" data-i18n="teacher.home.card_publish_soon">${escapeHtml(t("teacher.home.card_publish_soon"))}</span>
        </article>
      </div>
      <section class="card teacher-lumina-next">
        <h2 class="teacher-hub-section-title">${escapeHtml(t("teacher.home.next_title"))}</h2>
        <ol class="teacher-lumina-next__steps">
          <li><span class="teacher-lumina-next__i">1</span> ${escapeHtml(t("teacher.home.next_step1"))}</li>
          <li><span class="teacher-lumina-next__i">2</span> ${escapeHtml(t("teacher.home.next_step2"))}</li>
          <li><span class="teacher-lumina-next__i">3</span> ${escapeHtml(t("teacher.home.next_step3"))}</li>
        </ol>
      </section>
      <section class="card teacher-lumina-footnote">
        <p class="teacher-lumina-footnote__p" data-i18n="teacher.home.status_hint">${escapeHtml(t("teacher.home.status_hint"))}</p>
      </section>
    </div>
  `;
}

/**
 * @param {(a: string, b?: object) => string} t
 */
function renderTeacherEntryNone(t) {
  const cap = (key) => escapeHtml(t(`teacher.entry.cap_${key}`));
  const main = `
    <section class="card teacher-lumina-guide">
      <p class="teacher-page-kicker">${escapeHtml(t("teacher.entry.none_kicker"))}</p>
      <h1 class="teacher-lumina-guide__h1">${escapeHtml(t("teacher.entry.none_title"))}</h1>
      <p class="desc teacher-lumina-guide__lead">${escapeHtml(t("teacher.entry.none_lead"))}</p>
      <p class="teacher-lumina-guide__state"><strong data-i18n="teacher.entry.none_status_label">${escapeHtml(
        t("teacher.entry.none_status_label"),
      )}</strong> <span data-i18n="teacher.entry.none_status_value">${escapeHtml(t("teacher.entry.none_status_value"))}</span></p>
      <div class="teacher-lumina-wf-grid teacher-lumina-wf-grid--4">
        <article class="card teacher-lumina-cap"><p class="teacher-lumina-cap__t">${cap("1")}</p></article>
        <article class="card teacher-lumina-cap"><p class="teacher-lumina-cap__t">${cap("2")}</p></article>
        <article class="card teacher-lumina-cap"><p class="teacher-lumina-cap__t">${cap("3")}</p></article>
        <article class="card teacher-lumina-cap"><p class="teacher-lumina-cap__t">${cap("4")}</p></article>
      </div>
      <p class="teacher-lumina-guide__cta">
        <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-apply" data-teacher-spa="1">${escapeHtml(
          t("teacher.entry.cta_apply"),
        )}</a>
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#my" data-teacher-spa="1">${escapeHtml(
          t("teacher.entry.cta_back_my"),
        )}</a>
      </p>
    </section>
  `;
  return renderTeacherAdminShell({ active: "workspace", tx: t, mainHtml: main, shellClass: "teacher-page teacher-lumina-entry" });
}

/**
 * @param {(a: string, b?: object) => string} t
 */
function renderTeacherEntryPending(t) {
  const main = `
    <section class="card teacher-lumina-guide">
      <p class="teacher-page-kicker">${escapeHtml(t("teacher.entry.pending_kicker"))}</p>
      <h1 class="teacher-lumina-guide__h1">${escapeHtml(t("teacher.entry.pending_title"))}</h1>
      <p class="desc">${escapeHtml(t("teacher.entry.pending_lead"))}</p>
      <p class="desc teacher-lumina-guide__mute">${escapeHtml(t("teacher.entry.pending_learn_ok"))}</p>
      <p class="teacher-lumina-guide__cta">
        <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-status" data-teacher-spa="1">${escapeHtml(
          t("teacher.entry.pending_cta_status"),
        )}</a>
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#my" data-teacher-spa="1">${escapeHtml(
          t("teacher.entry.cta_back_my"),
        )}</a>
      </p>
    </section>
  `;
  return renderTeacherAdminShell({ active: "workspace", tx: t, mainHtml: main, shellClass: "teacher-page teacher-lumina-entry" });
}

/**
 * @param {(a: string, b?: object) => string} t
 */
function renderTeacherEntryRejected(t) {
  const main = `
    <section class="card teacher-lumina-guide">
      <p class="teacher-page-kicker">${escapeHtml(t("teacher.entry.rejected_kicker"))}</p>
      <h1 class="teacher-lumina-guide__h1">${escapeHtml(t("teacher.entry.rejected_title"))}</h1>
      <p class="desc">${escapeHtml(t("teacher.entry.rejected_lead"))}</p>
      <p class="desc teacher-lumina-guide__hint">${escapeHtml(t("teacher.entry.rejected_hint"))}</p>
      <p class="teacher-lumina-guide__cta">
        <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-apply" data-teacher-spa="1">${escapeHtml(
          t("teacher.entry.cta_reapply"),
        )}</a>
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#my" data-teacher-spa="1">${escapeHtml(
          t("teacher.entry.cta_back_my"),
        )}</a>
      </p>
    </section>
  `;
  return renderTeacherAdminShell({ active: "workspace", tx: t, mainHtml: main, shellClass: "teacher-page teacher-lumina-entry" });
}

/**
 * @param {HTMLElement} root
 */
function bindTeacherSpaLinks(root) {
  root.querySelectorAll("[data-teacher-spa='1']")?.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const h = a.getAttribute("href") || "";
      if (!h.startsWith("#")) return;
      import("../router.js").then((r) => r.navigateTo(h, { force: true }));
    });
  });
}

/**
 * @param {HTMLElement} root
 */
function bindClassroomForm(root) {
  root.querySelector("#teacherEnterClassroomBtn")?.addEventListener("click", () => {
    const course = String(root.querySelector("#teacherCourseSelect")?.value || "kids");
    const level = String(root.querySelector("#teacherLevelSelect")?.value || "1");
    const lessonRaw = String(root.querySelector("#teacherLessonInput")?.value || "1");
    const lesson = String(Math.max(1, parseInt(lessonRaw, 10) || 1));
    location.hash = `#classroom?course=${encodeURIComponent(course)}&level=${encodeURIComponent(level)}&lesson=${encodeURIComponent(lesson)}`;
  });
}

async function renderTeacherHub(root) {
  const t = tx;
  let ctx;
  let listings = [];
  /** @type {any} */
  let commerceSnap = null;
  try {
    commerceSnap = await initCommerceStore();
    listings = Array.isArray(commerceSnap?.listings) ? commerceSnap.listings : [];
  } catch {
    listings = [];
  }
  const au = getCurrentSessionAuthUser();
  if (au) {
    const tr = getTeacherNavRoleState() ?? "none";
    if (tr === "none") {
      root.innerHTML = renderTeacherEntryNone(t);
      bindTeacherSpaLinks(root);
      i18n.apply?.(root);
      return;
    }
    if (tr === "pending") {
      root.innerHTML = renderTeacherEntryPending(t);
      bindTeacherSpaLinks(root);
      i18n.apply?.(root);
      return;
    }
    if (tr === "rejected") {
      root.innerHTML = renderTeacherEntryRejected(t);
      bindTeacherSpaLinks(root);
      i18n.apply?.(root);
      return;
    }
  }

  try {
    ctx = await getTeacherPageContext();
    void logTeacherHubPageDebug(ctx);
  } catch {
    root.innerHTML = `<div class="teacher-page wrap card teacher-identity-gate"><p class="teacher-identity-gate-body">${escapeHtml(
      t("common.loading"),
    )}</p></div>`;
    return;
  }

  if (ctx.workbenchStatus === "guest") {
    root.innerHTML = guestAuthShellHtml(t);
    i18n.apply?.(root);
    return;
  }

  if (ctx.workbenchStatus === "not_teacher") {
    root.innerHTML = notTeacherShellHtml(t, ctx);
    root.querySelector("#applyTeacherProfileBtn")?.addEventListener("click", async () => {
      const r = await applyToBecomeTeacher();
      if (r && r.ok) {
        location.hash = "#teacher-profile";
        return;
      }
      try {
        alert(t("teacher.gate.apply_failed"));
      } catch {
        /* */
      }
    });
    root.querySelector("#takeoverDemoTeacherBtn")?.addEventListener("click", async () => {
      const u = getCurrentUser();
      const r = await migrateDemoTeacherProfileToAuthUser(String(u.id));
      if (r && r.ok) {
        await hydrateCurrentUserFromSession();
        try {
          window.dispatchEvent(new CustomEvent("joy:authChanged"));
        } catch {
          /* */
        }
        try {
          alert(t("teacher.gate.migration_dev_done"));
        } catch {
          /* */
        }
        void renderTeacherHub(root);
        return;
      }
      try {
        alert(t("teacher.gate.migration_dev_failed"));
      } catch {
        /* */
      }
    });
    i18n.apply?.(root);
    return;
  }

  if (ctx.isApproved && ctx.profile) {
    const u = getCurrentUser();
    const showReviewConsole = commerceSnap ? userCanAccessTeacherReviewConsole(commerceSnap, String(u.id)) : false;
    const assetN = getTeacherClassroomAssetCountForProfile(ctx.profile.id);
    const base = getTeacherWorkspaceDemoSummary(listings, ctx.profile.id);
    const sum = { ...base, classroomAssetCount: assetN };
    const recent = getRecentAssetsForProfile(ctx.profile.id, 3);
    const commerceStats = commerceSnap ? getTeacherProfileCommerceStats(commerceSnap, ctx.profile.id) : null;
    root.innerHTML = approvedWorkbenchHtml(ctx.profile, sum, t, recent, commerceStats, commerceSnap, showReviewConsole);
    bindTeacherSpaLinks(root);
    bindClassroomForm(root);
    i18n.apply?.(root);
    return;
  }

  root.innerHTML = gatedTeacherShellHtml(ctx, t);
  root.querySelector("#devForceApproveTeacherProfileBtn")?.addEventListener("click", async () => {
    const u = getCurrentUser();
    const r = await devForceApproveCurrentUserTeacherProfile(String(u.id));
    if (r && r.ok) {
      await hydrateCurrentUserFromSession();
      try {
        window.dispatchEvent(new CustomEvent("joy:authChanged"));
      } catch {
        /* */
      }
      try {
        alert(t("teacher.gate.dev_force_approve_done"));
      } catch {
        /* */
      }
      void renderTeacherHub(root);
      return;
    }
    try {
      alert(t("teacher.gate.dev_force_approve_failed"));
    } catch {
      /* */
    }
  });
  i18n.apply?.(root);
}

export default function pageTeacher(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  __teacherRootRef = root;
  if (__teacherLangHandler) window.removeEventListener("joy:langChanged", __teacherLangHandler);
  __teacherLangHandler = () => {
    if (__teacherRootRef?.isConnected) void renderTeacherHub(__teacherRootRef);
  };
  window.addEventListener("joy:langChanged", __teacherLangHandler);
  if (__teacherAuthHandler) window.removeEventListener("joy:authChanged", __teacherAuthHandler);
  __teacherAuthHandler = () => {
    if (__teacherRootRef?.isConnected) void renderTeacherHub(__teacherRootRef);
  };
  window.addEventListener("joy:authChanged", __teacherAuthHandler);

  void renderTeacherHub(root);
}

export function mount(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}
