// 我的课程：按当前老师 profile 过滤；无课程时展示与课堂资产/教材方向一致的空状态。

import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import {
  getDemoCoursesForProfile,
  formatDemoCourseLinkedListingLine,
  formatDemoCourseListingHint,
  formatDemoCourseMaterialsChipLabel,
  formatDemoCourseMaterialsLine,
  formatDemoCourseProgressPill,
  formatDemoShortUpdated,
  getDemoCourseProgressKey,
} from "../lumina-commerce/teacherDemoCatalog.js";
import { getTeacherPageContext } from "../lumina-commerce/teacherSelectors.js";
import { i18n } from "../i18n.js";
import {
  teacherBackToWorkspaceHtml,
  teacherCoursesNextGuideHtml,
  teacherPathStripHtml,
  teacherPathStripClassroomHintHtml,
  teacherWorkspaceSubnavHtml,
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

let __crsLangHandler = /** @type {null | (() => void)} */ (null);
let __crsRootRef = /** @type {HTMLElement | null} */ (null);

/**
 * @param {Array<{ id: string, updated_at: string, materialIds: string[], listingReadinessKey: string, listingId: string|null }>} courses
 * @param {(a: string, b?: object) => string} t
 */
function coursesTableBody(courses, t) {
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
      <td class="teacher-manage-col-actions">${escapeHtml(t("teacher.courses_page.demo_action_placeholder"))}</td>
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

  const canShow = ctx.isTeacherRole && ctx.isApproved;
  const courses = canShow && ctx.profile ? getDemoCoursesForProfile(ctx.profile.id) : [];
  const headTitle = canShow
    ? t("teacher.courses_page.mine_page_title", { name: ctx.profile?.display_name || "" })
    : t("teacher.courses_page.title");
  const headSubtitle = canShow
    ? t("teacher.courses_page.mine_page_subtitle")
    : t("teacher.courses_page.subtitle");
  const newHint = t("teacher.courses_page.new_next_stage");

  const tableRows = coursesTableBody(courses, t);
  const lockedBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="8">
        <div class="teacher-manage-empty">
          <p class="teacher-manage-empty-title">${escapeHtml(t("teacher.access.courses_locked_title"))}</p>
          <p class="teacher-manage-empty-intro">${escapeHtml(t("teacher.access.courses_locked_body"))}</p>
        </div>
      </td></tr></tbody>`;
  const emptyMineBody = `<tbody><tr class="teacher-manage-empty-row"><td colspan="8">
        <div class="teacher-manage-empty">
          <p class="teacher-manage-empty-title">${escapeHtml(t("teacher.courses_page.empty_mine_title"))}</p>
          <p class="teacher-manage-empty-intro">${escapeHtml(t("teacher.courses_page.empty_mine_intro"))}</p>
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

  root.innerHTML = `
    <div class="teacher-page wrap teacher-manage-page teacher-admin-shell">
      ${teacherBackToWorkspaceHtml(t)}
      <p class="teacher-page-kicker teacher-page-kicker--shell">${escapeHtml(t("teacher.manage.page_kicker_mine"))}</p>
      ${teacherWorkspaceSubnavHtml("courses", t)}
      ${restrictedBannerHtml(ctx, t)}
      ${teacherPathStripHtml("courses", t)}
      ${teacherPathStripClassroomHintHtml(t)}
      <header class="card teacher-admin-header">
        <h1 class="teacher-admin-title">${escapeHtml(headTitle)}</h1>
        <p class="teacher-admin-subtitle">${escapeHtml(headSubtitle)}</p>
        <p class="teacher-admin-tagline">${escapeHtml(t("teacher.courses_page.tagline"))}</p>
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
    </div>
  `;
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

export function mount(ctxOrRoot) {
  return pageTeacherCourses(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacherCourses(ctxOrRoot);
}
