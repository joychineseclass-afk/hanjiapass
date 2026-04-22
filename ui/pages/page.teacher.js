// /ui/pages/page.teacher.js
// 老师工作台：基于当前用户身份与 teacher profile 状态分流。

import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { getTeacherWorkspaceDemoSummary } from "../lumina-commerce/teacherDemoCatalog.js";
import { initCommerceStore } from "../lumina-commerce/store.js";
import { getTeacherProfileCommerceStats } from "../lumina-commerce/teacherCommerceBridge.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { applyToBecomeTeacher } from "../auth/authService.js";
import {
  createClassroomAssetForLesson,
  getRecentAssetsForProfile,
  getTeacherClassroomAssetCountForProfile,
} from "../lumina-commerce/teacherAssetsSelectors.js";
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
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
function teacherGatePanelHtml(ctx, t) {
  const w = ctx.workbenchStatus;
  if (w === "not_teacher") {
    if (ctx.isLoggedIn) {
      return `
      <section class="card teacher-identity-gate teacher-gate" aria-labelledby="tw-gate-title">
        <h3 id="tw-gate-title" class="teacher-identity-gate-title">${escapeHtml(t("teacher.gate.logged_in_not_teacher_title"))}</h3>
        <p class="teacher-identity-gate-body">${escapeHtml(t("teacher.gate.logged_in_not_teacher_body"))}</p>
        <button type="button" class="teacher-identity-gate-cta" id="applyTeacherProfileBtn">
          ${escapeHtml(t("teacher.gate.apply_cta"))}
        </button>
        <p class="teacher-identity-gate-foot">${escapeHtml(t("teacher.gate.apply_note_v2"))}</p>
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

function teacherWorkspaceOverviewHtml(sum) {
  const p = "teacher.workspace.overview_mine";
  const chips = [
    tx(`${p}.chip_materials`, { count: String(sum.materialsCount) }),
    tx(`${p}.chip_courses`, { count: String(sum.coursesCount) }),
    tx(`${p}.chip_classroom_assets`, { count: String(sum.classroomAssetCount) }),
    tx(`${p}.chip_materials_in_use`, { count: String(sum.materialsInUseCount) }),
    tx(`${p}.chip_courses_with_listing`, { count: String(sum.coursesWithListing) }),
    tx(`${p}.chip_listings`, { count: String(sum.listingTotal) }),
    tx(`${p}.chip_pending`, { count: String(sum.pendingReview) }),
    tx(`${p}.chip_drafts`, { count: String(sum.draft) }),
    tx(`${p}.chip_approved`, { count: String(sum.approved) }),
  ];
  const chipsHtml = chips.map((c) => `<span class="teacher-workspace-chip">${escapeHtml(c)}</span>`).join("");
  return `
      <section class="card teacher-workspace-overview" aria-labelledby="teacher-workspace-overview-title">
        <h3 id="teacher-workspace-overview-title" class="teacher-workspace-overview-title">${escapeHtml(tx(`${p}.title`))}</h3>
        <p class="teacher-workspace-overview-disclosure">${escapeHtml(tx(`${p}.disclosure`))}</p>
        <div class="teacher-workspace-overview-chips">${chipsHtml}</div>
      </section>`;
}

/**
 * 已通过审核的完整工作台。
 * @param {import('../lumina-commerce/teacherSelectors.js').ResolvedTeacherProfile} profile
 * @param {ReturnType<typeof getTeacherWorkspaceDemoSummary>} sum
 * @param {(a: string, b?: object) => string} t
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset[]} recentAssets
 * @param {object|null} commerceStats
 */
function approvedWorkbenchHtml(profile, sum, t, recentAssets, commerceStats) {
  const st = String(profile.workbench_status);
  const label = escapeHtml(t(`teacher.wbstate.${st}`));
  const recentRows =
    recentAssets.length === 0
      ? `<li class="teacher-assets-recent-item teacher-assets-recent-item--empty">${escapeHtml(t("teacher.assets.recent_empty"))}</li>`
      : recentAssets
          .map((a) => {
            const stChip = `teacher-asset-status-chip--${String(a.status).replace(/[^a-z0-9_]/g, "_")}`;
            const src = t("teacher.assets.source_line", {
              course: formatTeacherHubCourseDisplay(a.source.course),
              level: a.source.level,
              lesson: a.source.lesson,
            });
            return `<li class="teacher-assets-recent-item">
              <div class="teacher-assets-recent-main">
                <span class="teacher-assets-recent-title">${escapeHtml(a.title)}</span>
                <span class="teacher-assets-recent-src">${escapeHtml(src)}</span>
              </div>
              <span class="teacher-asset-status-chip ${escapeHtml(stChip)}">${escapeHtml(t(`teacher.assets.state.${a.status}`))}</span>
              <div class="teacher-assets-recent-actions">
                <a class="teacher-asset-link" href="#classroom?assetId=${encodeURIComponent(a.id)}">${escapeHtml(t("teacher.assets.enter_classroom"))}</a>
                <button type="button" class="teacher-asset-ghost" disabled title="${escapeHtml(t("teacher.assets.edit_placeholder"))}">${escapeHtml(
              t("teacher.assets.edit"),
            )}</button>
              </div>
            </li>`;
          })
          .join("");

  const assetsPanel = `
    <section class="card teacher-assets-mine" aria-labelledby="tw-assets-title">
      <div class="teacher-assets-mine-head">
        <h3 id="tw-assets-title" class="teacher-assets-mine-title">${escapeHtml(t("teacher.assets.panel_title"))}</h3>
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-assets">${escapeHtml(t("teacher.assets.view_all"))}</a>
      </div>
      <p class="teacher-assets-mine-hint">${escapeHtml(t("teacher.assets.panel_hint"))}</p>
      <div class="teacher-assets-quick">
        <button type="button" class="teacher-hub-cta teacher-hub-cta--primary" id="teacherQuickCreateAsset">
          ${escapeHtml(t("teacher.assets.quick_create"))}
        </button>
        <p class="teacher-assets-quick-note">${escapeHtml(t("teacher.assets.quick_create_note"))}</p>
      </div>
      <h4 class="teacher-assets-recent-heading">${escapeHtml(t("teacher.assets.recent_heading"))}</h4>
      <ol class="teacher-assets-recent-list">${recentRows}</ol>
    </section>
  `;

  return `
    <div class="teacher-page wrap">
      <section class="teacher-hero card teacher-center-page teacher-hero--compact">
        <p class="teacher-page-kicker">${escapeHtml(t("teacher.manage.page_kicker_mine"))}</p>
        <div class="hero teacher-workbench-hero-row">
          <div>
            <h2 class="title">${escapeHtml(t("teacher.workspace.mine_title"))}</h2>
            <p class="desc teacher-hero-lead">${escapeHtml(t("teacher.workspace.mine_subtitle", { name: profile.display_name }))}</p>
            <p class="teacher-workbench-profile-link"><a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-profile">${escapeHtml(
              t("teacher.nav.teacher_profile"),
            )}</a></p>
          </div>
          <span class="${escapeHtml(statusChipClass(st))}">${label}</span>
        </div>
      </section>

      ${teacherWorkspaceSubnavHtml("workspace", t)}

      <section class="card teacher-relation-flow" aria-label="${escapeHtml(t("teacher.relation_flow.title"))}">
        <p class="teacher-relation-flow-title">${escapeHtml(t("teacher.relation_flow.title_mine"))}</p>
        ${teacherPathStripHtml(null, t)}
        ${teacherPathStripClassroomHintHtml(t)}
        <p class="teacher-relation-flow-classroom">${escapeHtml(t("teacher.workspace.classroom_flow_note_mine"))}</p>
      </section>
      ${teacherWorkspaceOverviewHtml(sum)}
      ${teacherSalesOverviewHtml(commerceStats, t)}
      ${assetsPanel}

      <section class="teacher-grid">
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
function bindAssetQuickCreate(root, profileId, ownerUserId, rerender) {
  root.querySelector("#teacherQuickCreateAsset")?.addEventListener("click", () => {
    createClassroomAssetForLesson({
      teacherProfileId: profileId,
      ownerUserId,
      course: "kids",
      level: "1",
      lesson: "1",
      t: tx,
    });
    rerender();
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
    i18n.apply?.(root);
    return;
  }

  if (ctx.isApproved && ctx.profile) {
    const u = getCurrentUser();
    const assetN = getTeacherClassroomAssetCountForProfile(ctx.profile.id);
    const base = getTeacherWorkspaceDemoSummary(listings, ctx.profile.id);
    const sum = { ...base, classroomAssetCount: assetN };
    const recent = getRecentAssetsForProfile(ctx.profile.id, 5);
    const commerceStats = commerceSnap ? getTeacherProfileCommerceStats(commerceSnap, ctx.profile.id) : null;
    const rerender = () => {
      if (__teacherRootRef?.isConnected) void renderTeacherHub(__teacherRootRef);
    };
    root.innerHTML = approvedWorkbenchHtml(ctx.profile, sum, t, recent, commerceStats);
    bindClassroomForm(root);
    bindAssetQuickCreate(root, ctx.profile.id, u.id, rerender);
    i18n.apply?.(root);
    return;
  }

  root.innerHTML = gatedTeacherShellHtml(ctx, t);
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
