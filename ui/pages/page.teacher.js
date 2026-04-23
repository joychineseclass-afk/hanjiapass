// /ui/pages/page.teacher.js
// 老师工作台：基于当前用户身份与 teacher profile 状态分流。

import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherWorkspaceDemoSummary } from "../lumina-commerce/teacherDemoCatalog.js";
import { initCommerceStore } from "../lumina-commerce/store.js";
import { getTeacherProfileCommerceStats } from "../lumina-commerce/teacherCommerceBridge.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { applyToBecomeTeacher, hydrateCurrentUserFromSession } from "../auth/authService.js";
import {
  devForceApproveCurrentUserTeacherProfile,
  migrateDemoTeacherProfileToAuthUser,
} from "../lumina-commerce/teacherProfileService.js";
import { logTeacherHubPageDebug } from "../lumina-commerce/teacherPageDebugLog.js";
import {
  createClassroomAssetForLesson,
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
import { teacherPathStripHtml, teacherPathStripClassroomHintHtml, teacherWorkspaceSubnavHtml } from "./teacherPathNav.js";

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
 */
function approvedWorkbenchHtml(profile, sum, t, recentAssets, commerceStats, commerceSnap) {
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

  const assetsPanel = `
    <section class="card teacher-assets-mine" aria-labelledby="tw-assets-title">
      <div class="teacher-assets-mine-head">
        <h3 id="tw-assets-title" class="teacher-assets-mine-title">${escapeHtml(t("teacher.workspace.hub_classroom_assets_title"))}</h3>
        <div class="teacher-assets-mine-head-actions">
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${escapeHtml(t("teacher.assets.view_all"))}</a>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${escapeHtml(t("teacher.assets.upload_own_draft"))}</a>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${escapeHtml(t("teacher.assets.import_local_courseware"))}</a>
        </div>
      </div>
      <p class="teacher-assets-mine-hint teacher-assets-mine-hint--tight">${escapeHtml(t("teacher.workspace.hub_classroom_assets_hint"))}</p>
      <div class="teacher-assets-quick">
        <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherQuickCreateAsset">
          ${escapeHtml(t("teacher.assets.quick_create"))}
        </button>
        <p class="teacher-assets-quick-note">${escapeHtml(t("teacher.assets.quick_create_note"))}</p>
      </div>
    </section>
  `;

  return `
    <div class="teacher-page wrap teacher-hub">
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

      ${teacherWorkspaceSubnavHtml("workspace", t)}

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

      <section class="teacher-hub-workflows" aria-labelledby="tw-hub-wf">
        <h2 id="tw-hub-wf" class="teacher-hub-section-title">${escapeHtml(t("teacher.workspace.hub_workflows_title"))}</h2>
        <div class="teacher-hub-workflow-panels">
          <article class="card teacher-hub-wf-card">
            <h3 class="teacher-hub-wf-h">${escapeHtml(t("teacher.workspace.hub_wf_decks"))}</h3>
            <p class="teacher-hub-wf-p">${escapeHtml(t("teacher.workspace.hub_wf_decks_sub"))}</p>
            <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-assets">${escapeHtml(t("teacher.workspace.hub_wf_decks_cta"))}</a>
            <a class="teacher-hub-inline-link" href="#teacher-assets">${escapeHtml(t("teacher.workspace.hub_wf_decks_secondary"))}</a>
          </article>
          <article class="card teacher-hub-wf-card teacher-hub-wf-card--primary">
            <h3 class="teacher-hub-wf-h">${escapeHtml(t("teacher.enter.classroom_section_title"))}</h3>
            <p class="teacher-hub-wf-p">${escapeHtml(t("teacher.workspace.hub_wf_class_sub"))}</p>
            <a class="teacher-hub-cta teacher-hub-cta--primary" href="#teacher-hub-classroom">${escapeHtml(
              t("teacher.workspace.hub_wf_class_scroll"),
            )}</a>
            <a class="teacher-hub-inline-link" href="#teacher-assets">${escapeHtml(t("teacher.workspace.hub_wf_class_pick"))}</a>
          </article>
          <article class="card teacher-hub-wf-card">
            <h3 class="teacher-hub-wf-h">${escapeHtml(t("teacher.workspace.hub_wf_publish"))}</h3>
            <p class="teacher-hub-wf-p">${escapeHtml(t("teacher.workspace.hub_wf_publish_sub"))}</p>
            <a class="teacher-hub-cta teacher-hub-cta--accent" href="#teacher-publishing">${escapeHtml(t("teacher.hub.listing.cta_mine"))}</a>
            <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-review">${escapeHtml(t("teacher.nav.review_console"))}</a>
          </article>
          <article class="card teacher-hub-wf-card">
            <h3 class="teacher-hub-wf-h">${escapeHtml(t("teacher.workspace.hub_wf_commerce"))}</h3>
            <p class="teacher-hub-wf-p">${escapeHtml(t("teacher.workspace.hub_wf_commerce_sub"))}</p>
            <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-publishing">${escapeHtml(t("teacher.workspace.hub_wf_commerce_cta"))}</a>
          </article>
        </div>
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

      ${assetsPanel}

      <section class="teacher-grid" id="teacher-hub-classroom" tabindex="-1">
        <article class="teacher-tile card teacher-tile--entry">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher.hub.assets.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(t("teacher.hub.assets.desc_mine"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${escapeHtml(t("teacher.hub.assets.cta_mine"))}</a>
        </article>

        <article class="teacher-tile card teacher-tile-classroom teacher-tile--primary">
          <p class="teacher-tile-stage-kicker">${escapeHtml(t("teacher.enter.classroom_stage_kicker"))}</p>
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher.enter.classroom_section_title"))}</h3>
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
        </article>

        <article class="teacher-tile card teacher-tile--entry">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher.hub.materials.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(t("teacher.hub.materials.desc_mine"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-materials">${escapeHtml(t("teacher.hub.materials.cta_mine"))}</a>
        </article>

        <article class="teacher-tile card teacher-tile--entry">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher.hub.courses.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(t("teacher.hub.courses.desc_mine"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-courses">${escapeHtml(t("teacher.hub.courses.cta_mine"))}</a>
        </article>

        <article class="teacher-tile card teacher-tile--entry">
          <div class="teacher-tile-head">
            <h3 class="teacher-tile-title teacher-tile-title--inline">${escapeHtml(t("teacher.hub.listing.title"))}</h3>
            <span class="teacher-hub-badge">${escapeHtml(t("teacher.hub.listing.badge"))}</span>
          </div>
          <p class="teacher-tile-desc">${escapeHtml(t("teacher.hub.listing.desc_mine"))}</p>
          <a class="teacher-hub-cta teacher-hub-cta--accent" href="#teacher-publishing">${escapeHtml(t("teacher.hub.listing.cta_mine"))}</a>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-review">${escapeHtml(t("teacher.nav.review_console"))}</a>
        </article>

        <article class="teacher-tile card teacher-tile--entry teacher-tile--muted">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher.ai.assistant"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(t("teacher.ai.desc"))}</p>
          <p class="teacher-tile-scope">${escapeHtml(t("teacher.ai.scope_note"))}</p>
        </article>

        <article class="teacher-tile card teacher-tile--entry teacher-tile--muted">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher.console.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(t("teacher.console.desc"))}</p>
          <p class="teacher-tile-scope">${escapeHtml(t("teacher.console.scope_note"))}</p>
        </article>
      </section>
    </div>
  `;
}

/**
 * 老师身份但尚未通过：保留导航、路径条，主功能受限。
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
function gatedTeacherShellHtml(ctx, t) {
  return `
    <div class="teacher-page wrap">
      <section class="teacher-hero card teacher-center-page teacher-hero--compact">
        <p class="teacher-page-kicker">${escapeHtml(t("teacher.manage.page_kicker_mine"))}</p>
        <h2 class="title">${escapeHtml(t("teacher.workspace.mine_title"))}</h2>
        <p class="desc teacher-hero-lead">${escapeHtml(t("teacher.workspace.gated_lead"))}</p>
      </section>
      ${teacherWorkspaceSubnavHtml("workspace", t)}
      ${teacherGatePanelHtml(ctx, t)}
      <section class="card teacher-relation-flow teacher-relation-flow--muted" aria-label="${escapeHtml(t("teacher.relation_flow.title_mine"))}">
        <p class="teacher-relation-flow-title">${escapeHtml(t("teacher.relation_flow.title_mine"))}</p>
        ${teacherPathStripHtml(null, t)}
        ${teacherPathStripClassroomHintHtml(t)}
      </section>
    </div>
  `;
}

/**
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
/**
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 */
function notTeacherShellHtml(t, ctx) {
  return `
    <div class="teacher-page wrap">
      <section class="teacher-hero card teacher-center-page teacher-hero--compact">
        <p class="teacher-page-kicker">${escapeHtml(t("teacher.manage.page_kicker"))}</p>
        <h2 class="title">${escapeHtml(t("teacher.workspace.mine_entry_title"))}</h2>
        <p class="desc teacher-hero-lead">${escapeHtml(t("teacher.workspace.mine_entry_subtitle"))}</p>
      </section>
      ${teacherGatePanelHtml(ctx, t)}
    </div>
  `;
}

/**
 * 未登录：引导注册 / 登录
 * @param {(a: string, b?: object) => string} t
 */
function guestAuthShellHtml(t) {
  return `
    <div class="teacher-page wrap teacher-gate--guest">
      <section class="card teacher-hero teacher-hero--compact">
        <h2 class="title">${escapeHtml(t("teacher.gate.guest_title"))}</h2>
        <p class="desc teacher-hero-lead">${escapeHtml(t("teacher.gate.guest_body"))}</p>
        <div class="teacher-gate-auth-actions">
          <a class="teacher-hub-cta teacher-hub-cta--primary" href="#login?next=teacher">${escapeHtml(t("auth.nav_login"))}</a>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#register?next=teacher">${escapeHtml(t("auth.nav_register"))}</a>
        </div>
      </section>
    </div>
  `;
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

/**
 * @param {HTMLElement} root
 * @param {string} profileId
 * @param {string} ownerUserId
 * @param {() => void} rerender
 */
function bindAssetQuickCreate(root, profileId, ownerUserId) {
  root.querySelector("#teacherQuickCreateAsset")?.addEventListener("click", () => {
    const a = createClassroomAssetForLesson({
      teacherProfileId: profileId,
      ownerUserId,
      course: "kids",
      level: "1",
      lesson: "1",
      t: tx,
    });
    try {
      window.dispatchEvent(new CustomEvent("joy:navigate"));
    } catch {
      /* */
    }
    location.hash = `#teacher-asset-editor?id=${encodeURIComponent(a.id)}`;
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
    const assetN = getTeacherClassroomAssetCountForProfile(ctx.profile.id);
    const base = getTeacherWorkspaceDemoSummary(listings, ctx.profile.id);
    const sum = { ...base, classroomAssetCount: assetN };
    const recent = getRecentAssetsForProfile(ctx.profile.id, 3);
    const commerceStats = commerceSnap ? getTeacherProfileCommerceStats(commerceSnap, ctx.profile.id) : null;
    root.innerHTML = approvedWorkbenchHtml(ctx.profile, sum, t, recent, commerceStats, commerceSnap);
    bindClassroomForm(root);
    bindAssetQuickCreate(root, ctx.profile.id, u.id);
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
