// 我的课程：按当前老师 profile 过滤；无课程时展示与课堂资产/教材方向一致的空状态。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import {
  getDemoCoursesForProfile,
  DEMO_COURSE_DEFAULT_LESSON_SOURCE,
  formatDemoCourseLinkedListingLine,
  formatDemoCourseListingHint,
  formatDemoCourseMaterialsChipLabel,
  formatDemoCourseMaterialsLine,
  formatDemoCourseProgressPill,
  formatDemoShortUpdated,
  getDemoCourseProgressKey,
} from "../lumina-commerce/teacherDemoCatalog.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { createClassroomAssetForLesson } from "../lumina-commerce/teacherAssetsSelectors.js";
import { i18n } from "../i18n.js";
import { demoBannerHtml } from "../components/demoBanner.js";
import {
  currentUserCanAccessTeacherReviewConsoleSync,
  renderTeacherAdminShell,
  teacherCoursesNextGuideHtml,
  teacherPathStripHtml,
  teacherPathStripClassroomHintHtml,
} from "./teacherPathNav.js";
import { mountTeacherAssetsPanel } from "../platform/teacher/teacherAssetsPanel.js";

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

/** #teacher-courses?tab=courses | assets，默认 courses */
function teacherCoursesTopTabFromHash() {
  const h = String(location.hash || "");
  const q = h.indexOf("?");
  if (q < 0) return "courses";
  const v = String(new URLSearchParams(h.slice(q + 1)).get("tab") || "").toLowerCase();
  return v === "assets" ? "assets" : "courses";
}

/**
 * @param {(a: string, b?: object) => string} t
 * @param {'courses' | 'assets'} topTab
 */
function teacherCoursesHubTabsHtml(t, topTab) {
  const coursesHref = "#teacher-courses?tab=courses";
  const assetsHref = "#teacher-courses?tab=assets";
  return `<div class="teacher-assets-tabs teacher-courses-hub-tabs" role="tablist" aria-label="${escapeHtml(t("teacher.courses_page.hub_tabs_aria"))}">
    <a role="tab" class="teacher-assets-tab ${topTab === "courses" ? "is-active" : ""}" href="${coursesHref}" aria-selected="${topTab === "courses" ? "true" : "false"}">${escapeHtml(
      t("teacher.courses_page.hub_tab_courses"),
    )}</a>
    <a role="tab" class="teacher-assets-tab ${topTab === "assets" ? "is-active" : ""}" href="${assetsHref}" aria-selected="${topTab === "assets" ? "true" : "false"}">${escapeHtml(
      t("teacher.courses_page.hub_tab_assets"),
    )}</a>
  </div>`;
}

let __crsLangHandler = /** @type {null | (() => void)} */ (null);
let __crsRootRef = /** @type {HTMLElement | null} */ (null);

/**
 * @param {Array<{ id: string, updated_at: string, materialIds: string[], listingReadinessKey: string, listingId: string|null }>} courses
 * @param {(a: string, b?: object) => string} t
 * @param {boolean} canCreate
 */
function coursesTableBody(courses, t, canCreate) {
  return courses.map((c) => {
    const title = escapeHtml(t(`teacher.demo.course.${c.id}.title`));
    const type = escapeHtml(t(`teacher.demo.course.${c.id}.type`));
    const status = escapeHtml(t(`teacher.demo.course.${c.id}.status`));
    const progressKey = getDemoCourseProgressKey(c);
    const progressLabel = escapeHtml(formatDemoCourseProgressPill(progressKey, t));
    const progressClass = escapeHtml(String(progressKey).replace(/[^a-z0-9_-]/gi, ""));
    const matChip = escapeHtml(formatDemoCourseMaterialsChipLabel(c, t));
    const matChipMod = c.materialIds.length ? "" : " teacher-mini-chip--muted";
    const materialsDetail =
      c.materialIds.length > 0
        ? `<div class="teacher-meta-subline">${escapeHtml(formatDemoCourseMaterialsLine(c, t))}</div>`
        : "";
    const listingLinked = formatDemoCourseLinkedListingLine(c, t);
    const listingSub = listingLinked
      ? `<div class="teacher-meta-subline teacher-meta-subline--accent">${escapeHtml(listingLinked)}</div>`
      : "";
    const listingHint = escapeHtml(formatDemoCourseListingHint(c, t));
    const updated = escapeHtml(formatDemoShortUpdated(c.updated_at));
    const badge = escapeHtml(t("common.demo_badge"));
    const src = DEMO_COURSE_DEFAULT_LESSON_SOURCE[c.id] || { course: "kids", level: "1", lesson: "1" };
    const createBtn = canCreate
      ? `<button type="button" class="teacher-asset-row-btn" data-teacher-asset-from-course
          data-course="${escapeHtml(String(src.course))}" data-level="${escapeHtml(String(src.level))}" data-lesson="${escapeHtml(String(src.lesson))}">
          ${escapeHtml(t("teacher.courses_page.create_slides_draft"))}
        </button>`
      : escapeHtml(t("teacher.courses_page.demo_action_placeholder"));
    return `<tr>
      <td class="teacher-manage-cell-title">
        <span class="teacher-demo-badge">${badge}</span>
        ${title}
      </td>
      <td>${type}</td>
      <td>${status}</td>
      <td class="teacher-manage-cell-phase"><span class="teacher-phase-pill teacher-phase-pill--crs-${progressClass}">${progressLabel}</span></td>
      <td class="teacher-manage-cell-meta">
        <span class="teacher-mini-chip${matChipMod}">${matChip}</span>
        ${materialsDetail}
      </td>
      <td class="teacher-manage-cell-meta">
        <span class="teacher-listing-hint-line">${listingHint}</span>
        ${listingSub}
      </td>
      <td>${updated}</td>
      <td class="teacher-manage-col-actions teacher-manage-col-assetcell">${createBtn}</td>
    </tr>`;
  }).join("");
}

/**
 * @param {import('../lumina-commerce/teacherSelectors.js').TeacherPageContext} ctx
 * @param {(a: string, b?: object) => string} t
 */
function restrictedBannerHtml(ctx, t) {
  if (ctx.workbenchStatus === "not_teacher") {
    return `<div class="card teacher-access-gate" role="status">
      <p class="teacher-access-gate-title">${escapeHtml(t("teacher.access.not_teacher_title"))}</p>
      <p class="teacher-access-gate-body">${escapeHtml(t("teacher.access.not_teacher_body"))}</p>
    </div>`;
  }
  if (!ctx.isApproved) {
    const w = String(ctx.workbenchStatus);
    return `<div class="card teacher-access-gate" role="status">
      <p class="teacher-access-gate-title">${escapeHtml(t(`teacher.gate.title_${w}`))}</p>
      <p class="teacher-access-gate-body">${escapeHtml(t("teacher.access.need_approved_courses"))}</p>
    </div>`;
  }
  return "";
}

async function renderCoursesDom(root) {
  const t = tx;
  let ctx;
  try {
    ctx = await getTeacherPageContext();
  } catch {
    root.innerHTML = `<div class="teacher-page wrap teacher-manage-page"><p>${escapeHtml(t("common.loading"))}</p></div>`;
    return;
  }

  const topTab = teacherCoursesTopTabFromHash();
  const canShow = ctx.isTeacherRole && ctx.isApproved;
  const courses = canShow && ctx.profile ? getDemoCoursesForProfile(ctx.profile.id) : [];
  const headTitle = canShow
    ? t("teacher.courses_page.mine_page_title", { name: ctx.profile?.display_name || "" })
    : t("teacher.courses_page.title");
  const headSubtitle = canShow
    ? t("teacher.courses_page.mine_page_subtitle")
    : t("teacher.courses_page.subtitle");
  const newHint = t("teacher.courses_page.new_next_stage");

  const tableRows = coursesTableBody(courses, t, canShow && !!ctx.profile);
  const lockedBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="8">
        <div class="teacher-manage-empty">
          <p class="teacher-manage-empty-title">${escapeHtml(t("teacher.access.courses_locked_title"))}</p>
          <p class="teacher-manage-empty-intro">${escapeHtml(t("teacher.access.courses_locked_body"))}</p>
        </div>
      </td></tr></tbody>`;
  const emptyCreate =
    canShow && ctx.profile
      ? `<p class="teacher-courses-empty-create">
          <button type="button" class="teacher-asset-row-btn" data-teacher-asset-from-default data-course="kids" data-level="1" data-lesson="1">
            ${escapeHtml(t("teacher.courses_page.create_slides_draft"))}
          </button>
         </p>`
      : "";
  const emptyMineBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="8">
        <div class="teacher-manage-empty">
          <p class="teacher-manage-empty-title">${escapeHtml(t("teacher.courses_page.empty_mine_title"))}</p>
          <p class="teacher-manage-empty-intro">${escapeHtml(t("teacher.courses_page.empty_mine_intro"))}</p>
          ${emptyCreate}
          <ul class="teacher-manage-empty-list">
            <li>${escapeHtml(t("teacher.courses_page.empty_mine_item_1"))}</li>
            <li>${escapeHtml(t("teacher.courses_page.empty_mine_item_2"))}</li>
            <li>${escapeHtml(t("teacher.courses_page.empty_mine_item_3"))}</li>
          </ul>
        </div>
      </td></tr></tbody>`;
  let tbodyOnly = `<tbody>${tableRows}</tbody>`;
  if (!canShow) {
    tbodyOnly = lockedBody;
  } else if (courses.length === 0) {
    tbodyOnly = emptyMineBody;
  }

  const showReview = currentUserCanAccessTeacherReviewConsoleSync();
  const hubTabs = teacherCoursesHubTabsHtml(t, topTab);
  const pathStrip =
    topTab === "assets"
      ? teacherPathStripHtml("assets", t, { showLead: false })
      : teacherPathStripHtml("courses", t);

  const assetsTabBody = (() => {
    if (!ctx.isTeacherRole) {
      return `<section class="card teacher-identity-gate"><p class="teacher-identity-gate-body">${escapeHtml(
        t("teacher.access.not_teacher_body"),
      )}</p></section>`;
    }
    if (!ctx.isApproved || !ctx.profile) {
      const w = String(ctx.workbenchStatus);
      return `<section class="card teacher-access-gate">
        <p class="teacher-access-gate-title">${escapeHtml(t(`teacher.gate.title_${w}`))}</p>
        <p class="teacher-access-gate-body">${escapeHtml(t("teacher.assets.gated"))}</p>
      </section>`;
    }
    return `<div class="teacher-courses-assets-panel-host" id="teacher-courses-assets-panel-host"></div>`;
  })();

  const coursesTabBody = `
      ${teacherPathStripClassroomHintHtml(t)}
      <header class="card teacher-admin-header">
        <h1 class="teacher-admin-title">${escapeHtml(headTitle)}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(headSubtitle)}</p>
        <p class="teacher-admin-tagline">${escapeHtml(t("teacher.courses_page.tagline"))}</p>
        ${
          canShow && ctx.profile
            ? `<p class="teacher-courses-import-cta">
              <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-courses?tab=assets">${escapeHtml(t("teacher.assets.upload_own_draft"))}</a>
              <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-courses?tab=assets">${escapeHtml(
                t("teacher.assets.import_local_courseware"),
              )}</a>
              <span class="teacher-hub-muted teacher-courses-import-cta-hint">${escapeHtml(t("teacher.assets.upload_own_draft_sub"))}</span>
            </p>`
            : ""
        }
      </header>
      ${ctx.isApproved ? teacherCoursesNextGuideHtml(t) : ""}

      <section class="card teacher-admin-toolbar" aria-label="${escapeHtml(t("teacher.courses_page.new_cta"))}">
        <div class="teacher-admin-toolbar-row">
          <button type="button" class="teacher-admin-btn teacher-admin-btn--disabled" disabled>
            ${escapeHtml(t("teacher.courses_page.new_cta"))}
          </button>
          <p class="teacher-admin-toolbar-hint teacher-admin-toolbar-hint--stage">${escapeHtml(newHint)}</p>
        </div>
      </section>

      <section class="card teacher-admin-list-card" aria-labelledby="teacher-courses-list-title">
        <h2 id="teacher-courses-list-title" class="teacher-admin-list-heading">${escapeHtml(t("teacher.courses_page.list_title_mine"))}</h2>
        <p class="teacher-demo-disclosure">${escapeHtml(t("teacher.demo.disclosure_mine_courses"))}</p>
        <p class="teacher-list-demo-note">${escapeHtml(t("teacher.courses_page.list_mine_note"))}</p>
        <div class="teacher-manage-table-scroll">
          <table class="teacher-manage-table">
            <thead>
              <tr>
                <th scope="col">${escapeHtml(t("teacher.courses_page.th_name"))}</th>
                <th scope="col">${escapeHtml(t("teacher.courses_page.th_type"))}</th>
                <th scope="col">${escapeHtml(t("teacher.courses_page.th_status"))}</th>
                <th scope="col">${escapeHtml(t("teacher.courses_page.th_prepare_progress"))}</th>
                <th scope="col">${escapeHtml(t("teacher.courses_page.th_uses_materials"))}</th>
                <th scope="col">${escapeHtml(t("teacher.courses_page.th_listing_track"))}</th>
                <th scope="col">${escapeHtml(t("teacher.courses_page.th_updated"))}</th>
                <th scope="col" class="teacher-manage-col-actions">${escapeHtml(t("teacher.courses_page.th_actions"))}</th>
              </tr>
            </thead>
            ${tbodyOnly}
          </table>
        </div>
      </section>

      <aside class="teacher-info-note">
        <p class="teacher-info-note-title">${escapeHtml(t("teacher.courses_page.relation_title"))}</p>
        <p class="teacher-info-note-lead">${escapeHtml(t("teacher.courses_page.relation_note_mine"))}</p>
        <ul class="teacher-info-note-list">
          <li>${escapeHtml(t("teacher.courses_page.relation_item_1"))}</li>
          <li>${escapeHtml(t("teacher.courses_page.relation_item_2"))}</li>
          <li>${escapeHtml(t("teacher.courses_page.relation_item_3"))}</li>
        </ul>
      </aside>
  `;

  const main =
    topTab === "courses"
      ? `${demoBannerHtml("courses")}${restrictedBannerHtml(ctx, t)}${pathStrip}${hubTabs}${coursesTabBody}`
      : `${pathStrip}${hubTabs}${assetsTabBody}`;

  const shellExtra =
    topTab === "assets"
      ? "teacher-page teacher-manage-page teacher-admin-shell teacher-courses-hub-page teacher-assets-page"
      : "teacher-page teacher-manage-page teacher-admin-shell teacher-courses-hub-page";

  root.innerHTML = renderTeacherAdminShell({
    active: "courses",
    tx: t,
    showReviewConsole: showReview,
    mainHtml: main,
    shellClass: shellExtra,
  });

  if (topTab === "courses" && ctx.isApproved && ctx.profile) {
    const pid = ctx.profile.id;
    const uid = getCurrentUser().id;
    root.querySelectorAll("[data-teacher-asset-from-course], [data-teacher-asset-from-default]").forEach((b) => {
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        const course = b.getAttribute("data-course") || "kids";
        const level = b.getAttribute("data-level") || "1";
        const lesson = b.getAttribute("data-lesson") || "1";
        const a = createClassroomAssetForLesson({ teacherProfileId: pid, ownerUserId: uid, course, level, lesson, t: tx });
        location.hash = `#teacher-asset-editor?id=${encodeURIComponent(a.id)}`;
      });
    });
  }

  if (topTab === "assets" && ctx.isTeacherRole && ctx.isApproved && ctx.profile) {
    const host = root.querySelector("#teacher-courses-assets-panel-host");
    if (host) {
      await mountTeacherAssetsPanel(host, {
        profileId: ctx.profile.id,
        userId: ctx.user?.id || "",
        displayName: ctx.profile.display_name || "",
        onRefresh: () => {
          void renderCoursesDom(root).catch((err) => {
            console.warn("[teacher-courses] panel refresh failed:", err);
          });
        },
      });
    }
  }

  i18n.apply?.(root);
}

export default function pageTeacherCourses(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  __crsRootRef = root;
  if (__crsLangHandler) window.removeEventListener("joy:langChanged", __crsLangHandler);
  __crsLangHandler = () => {
    if (__crsRootRef?.isConnected) void renderCoursesDom(__crsRootRef);
  };
  window.addEventListener("joy:langChanged", __crsLangHandler);

  void renderCoursesDom(root);
}

export function unmount() {
  if (__crsLangHandler) window.removeEventListener("joy:langChanged", __crsLangHandler);
  __crsLangHandler = null;
  __crsRootRef = null;
}

export function mount(ctxOrRoot) {
  return pageTeacherCourses(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherCourses(ctxOrRoot);
}
