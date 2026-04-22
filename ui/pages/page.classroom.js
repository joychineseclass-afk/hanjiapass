// /ui/pages/page.classroom.js
// 课堂模式：支持 /#classroom?course=…&… 与 /#classroom?assetId=…

import { i18n } from "../i18n.js";
import { getLang } from "../core/languageEngine.js";
import { initClassroomEngine } from "../platform/classroom/classroomEngine.js";
import { getClassroomState } from "../platform/classroom/classroomState.js";
import { getClassroomGamesForContext } from "../modules/games/gamesRegistry.js";
import { formatGameModeType, formatTeacherHubCourseDisplay, safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { getEffectiveTeacherNote, selectClassroomContextFromAssetId } from "../lumina-commerce/teacherAssetsSelectors.js";
import { initClassroomPresentation, getClassroomViewMode, toggleClassroomViewMode, ViewMode, toggleClassroomFullscreen, isClassroomDocumentFullscreen } from "../platform/classroom/classroomPresentation.js";
import { renderClassroomStage } from "../platform/classroom/classroomRenderer.js";
import { renderClassroomToolbar } from "../platform/classroom/classroomToolbar.js";

function tx(key, params) {
  return safeUiText(key, params);
}

function parseQuery() {
  const hash = String(location.hash || "");
  const qIndex = hash.indexOf("?");
  const query = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
  const out = /** @type {Record<string, string>} */ ({});
  if (!query) return out;
  query.split("&").forEach((kv) => {
    const [k, v] = kv.split("=");
    if (!k) return;
    out[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return out;
}

/** @param {string} hash */
function hashHasQueryString(hash) {
  const qIndex = String(hash || "").indexOf("?");
  return qIndex >= 0 && String(hash || "").slice(qIndex + 1).trim().length > 0;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} asset
 * @param {string} typeLabel
 * @param {string} sourceLine
 * @param {string} statusLabel
 * @param {string} statusClass
 * @param {null|{ is_lesson_slide_draft: boolean, has_teacher_note: boolean, asset_presentation_kind: string }} [pres]
 */
function assetBannerHtml(asset, typeLabel, sourceLine, statusLabel, statusClass, pres) {
  const isCw = pres && pres.is_lesson_slide_draft;
  const stitle = (asset.subtitle && String(asset.subtitle).trim()) || "";
  const smry = (asset.summary && String(asset.summary).trim()) || "";
  const kicker = isCw ? tx("teacher.classroom.current_teacher_mode") : tx("teacher.classroom.from_asset_badge");
  const modePill = isCw
    ? `<span class="classroom-asset-ctx-mode-pill" title="${escapeHtml(kicker)}">${escapeHtml(
        tx("teacher.classroom.mode_pill_teacher_courseware"),
      )}</span>`
    : "";
  const notePill = pres && pres.has_teacher_note
    ? `<span class="classroom-asset-ctx-pill" title="${escapeHtml(getEffectiveTeacherNote(asset).slice(0, 200))}">${escapeHtml(
        tx("teacher.classroom.has_teacher_note_badge"),
      )}</span>`
    : "";
  const noteTeaser =
    pres && pres.has_teacher_note
      ? `<p class="classroom-asset-ctx-note-hint" role="note">${escapeHtml(tx("teacher.classroom.teacher_note_teaser"))}</p>`
      : "";
  return `
  <div class="classroom-asset-ctx${isCw ? " classroom-asset-ctx--courseware" : ""}" role="status" data-asset-presentation="${escapeHtml(
    String(pres?.asset_presentation_kind || "other"),
  )}" data-teacher-note="${pres && pres.has_teacher_note ? "1" : "0"}" data-teacher-courseware="${isCw ? "1" : "0"}">
    <div class="classroom-asset-ctx-mode-row">
      ${modePill}
      <span class="classroom-asset-ctx-kicker-inline">${escapeHtml(kicker)}</span>
    </div>
    <p class="classroom-asset-ctx-type-line"><span class="classroom-asset-ctx-type">${escapeHtml(typeLabel)}</span></p>
    <p class="classroom-asset-ctx-title">${escapeHtml(asset.title)}</p>
    ${stitle ? `<p class="classroom-asset-ctx-subtitle">${escapeHtml(stitle)}</p>` : ""}
    ${smry ? `<p class="classroom-asset-ctx-summary">${escapeHtml(smry)}</p>` : ""}
    <div class="classroom-asset-ctx-source-block">
      <span class="classroom-asset-ctx-source-label">${escapeHtml(tx("teacher.classroom.source_course_label"))}</span>
      <p class="classroom-asset-ctx-source-line">${escapeHtml(sourceLine)}</p>
    </div>
    ${noteTeaser}
    <p class="classroom-asset-ctx-row">
      <span class="classroom-asset-status-chip ${statusClass}">${escapeHtml(statusLabel)}</span>
      ${notePill}
    </p>
  </div>`;
}

/**
 * @param {unknown} lesson
 * @returns {string}
 */
function displayLessonTitle(lesson) {
  if (!lesson || typeof lesson !== "object") return "";
  const l = getLang();
  const norm = l === "zh" || l === "cn" ? "cn" : l === "ko" || l === "kr" ? "kr" : l === "ja" || l === "jp" ? "jp" : "en";
  const title = /** @type {Record<string, unknown>} */ (lesson).title;
  if (title && typeof title === "object") {
    const o = /** @type {Record<string, string>} */ (title);
    const pick = o[norm] || o.en || o.cn || o.zh || o.kr || o.jp || "";
    if (String(pick).trim()) return String(pick).trim();
  }
  if (typeof title === "string" && title.trim()) return title.trim();
  const core = /** @type {Record<string, unknown>} */ (lesson).coreSentence;
  if (typeof core === "string" && core.trim()) return core.trim();
  return "";
}

/**
 * @param {HTMLElement} host
 * @param {{ courseId: string, level: string, lessonNo: string }} ctx
 * @param {boolean} [hideForPresentation]
 */
function renderKidsGamesPanel(host, ctx, hideForPresentation) {
  if (!host) return;
  if (hideForPresentation) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }
  const games = getClassroomGamesForContext(ctx.courseId, ctx.level);
  if (!games.length) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }

  const title = tx("classroom.kids.games.title");
  const desc = tx("classroom.kids.games.desc");

  const cards = games
    .map((g) => {
      const typeLabel = formatGameModeType(g.type || "");
      return `<button type="button" class="teacher-game-card" data-game-id="${escapeHtml(g.id)}">
      <div class="teacher-game-title">${escapeHtml(g.title)}</div>
      <div class="teacher-game-meta">${escapeHtml(typeLabel)}</div>
    </button>`;
    })
    .join("");

  host.hidden = false;
  host.innerHTML = `
    <section class="card classroom-kids-games" style="margin-bottom:12px;">
      <h3 class="teacher-tile-title">${escapeHtml(title)}</h3>
      <p class="teacher-tile-desc">${escapeHtml(desc)}</p>
      <div class="teacher-game-list">${cards}</div>
    </section>
  `;

  host.querySelectorAll(".teacher-game-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-game-id") || "";
      if (!id) return;
      location.hash = `#game/${id}`;
    });
  });
}

export default async function pageClassroom(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  const q = parseQuery();
  const assetIdRaw = q.assetId || q.assetid || "";
  const assetId = String(assetIdRaw).trim();

  let courseId = String(q.course || "kids");
  let level = String(q.level || "1");
  let lessonNo = String(q.lesson || "1");
  let activeAsset = /** @type {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset | null} */ (null);
  let assetError = /** @type {null | 'not_found' | 'forbidden'} */ (null);
  let assetPresentation = /** @type {null | { is_lesson_slide_draft: boolean, has_teacher_note: boolean, asset_presentation_kind: string }} */ (null);

  if (assetId) {
    const res = await selectClassroomContextFromAssetId(assetId);
    if (res.ok) {
      courseId = res.courseId;
      level = res.level;
      lessonNo = res.lessonNo;
      activeAsset = res.asset;
      assetPresentation = res.presentation;
    } else {
      assetError = res.error;
    }
  }

  const hasUrlParams = hashHasQueryString(String(location.hash || ""));

  const titleBase = tx("classroom.title");
  const backLabel = tx("teacher.nav.back_mine_workbench");
  const backCourses = tx("teacher.classroom.back_courses");
  const backAssets = tx("teacher.classroom.back_assets");
  const modeLabel = tx("teacher.classroom.context.mode_label");
  const teachingLine = tx("teacher.classroom.presentation.teaching_mode");
  const fromWs = tx("teacher.classroom.context.from_workspace");
  const fromAsset = tx("teacher.classroom.context.from_teacher_asset");
  const viewStandard = tx("teacher.classroom.presentation.mode_standard");
  const viewPresent = tx("teacher.classroom.presentation.mode_presentation");
  const fsEnter = tx("teacher.classroom.presentation.fullscreen");
  const fsExit = tx("teacher.classroom.presentation.exit_fullscreen");
  let ctxLine2;
  if (activeAsset) {
    ctxLine2 = tx("teacher.classroom.context.asset_params_hint", {
      course: formatTeacherHubCourseDisplay(courseId),
      level: String(level),
      lesson: String(lessonNo),
    });
  } else if (hasUrlParams) {
    ctxLine2 = tx("teacher.classroom.context.params_hint", {
      course: formatTeacherHubCourseDisplay(courseId),
      level: String(level),
      lesson: String(lessonNo),
    });
  } else {
    ctxLine2 = tx("teacher.classroom.context.no_url_params");
  }

  const notFoundKey = "teacher.classroom.asset_not_found";
  const forbiddenKey = "teacher.classroom.asset_forbidden";
  const invalidBanner =
    assetId && assetError
      ? `<div class="classroom-asset-warn" role="alert">
          <p class="classroom-asset-warn-title">${escapeHtml(
            tx(assetError === "forbidden" ? forbiddenKey : notFoundKey),
          )}</p>
        </div>`
      : "";

  const statusForBanner = activeAsset
    ? tx(`teacher.assets.state.${activeAsset.status}`)
    : "";
  const typeLabel = activeAsset ? tx(`teacher.assets.type.${activeAsset.asset_type || "classroom_material"}`) : "";
  const sourceLine = activeAsset
    ? tx("teacher.classroom.presentation.source_line", {
        course: formatTeacherHubCourseDisplay(activeAsset.source?.course || courseId),
        level: String(activeAsset.source?.level || level),
        lesson: String(activeAsset.source?.lesson || lessonNo),
      })
    : "";
  const statusClass =
    activeAsset && activeAsset.status === "ready"
      ? "classroom-asset-status-chip--ready"
      : activeAsset && activeAsset.status === "archived"
        ? "classroom-asset-status-chip--archived"
        : "classroom-asset-status-chip--draft";
  const assetBlock =
    activeAsset && !assetError
      ? assetBannerHtml(activeAsset, typeLabel, sourceLine, statusForBanner, statusClass, assetPresentation)
      : invalidBanner;

  const line1Text = activeAsset ? fromAsset : fromWs;
  const line1 = `<p class="classroom-ctx-line1">
            <span class="classroom-ctx-badge">${escapeHtml(modeLabel)}</span>
            <span class="classroom-ctx-badge classroom-ctx-badge--teach">${escapeHtml(teachingLine)}</span>
            <span class="classroom-ctx-muted">${escapeHtml(line1Text)}</span>
          </p>`;

  const isPres0 = (() => {
    if (q.present === "1" || /^(presentation|present)$/i.test(String(q.view || q.viewMode || ""))) return true;
    return false;
  })();
  const openFs = isClassroomDocumentFullscreen();

  const initialViewTgl = (isPres0 || getClassroomViewMode() === ViewMode.PRESENTATION) ? viewStandard : viewPresent;
  const initialFsL = openFs ? fsExit : fsEnter;

  const apKind = activeAsset && assetPresentation ? String(assetPresentation.asset_presentation_kind || "") : "";
  const apSlide = apKind === "lesson_slide_draft" ? "1" : "0";
  const fromAssetClass = activeAsset && assetId ? " lumina-classroom-page--from-asset" : "";
  const coursewareClass = apSlide === "1" ? " lumina-classroom-page--teacher-courseware-shell" : "";
  root.innerHTML = `
    <section class="lumina-classroom-page wrap${fromAssetClass}${coursewareClass}" id="luminaClassroomPage" data-asset-presentation-kind="${escapeHtml(
      apKind,
    )}" data-teacher-courseware="${apSlide}"${activeAsset && assetId ? ` data-classroom-asset-id="${escapeHtml(assetId)}"` : ""}>
      <header class="classroom-topbar classroom-control-bar">
        <div class="classroom-control-bar-row1">
        <div class="classroom-topbar-actions">
          <button type="button" class="classroom-back" id="classroomBackBtn">← ${escapeHtml(backLabel)}</button>
          <a class="classroom-back-secondary" href="#teacher-assets">${escapeHtml(backAssets)}</a>
          <a class="classroom-back-secondary" href="#teacher-courses">${escapeHtml(backCourses)}</a>
        </div>
        <div class="classroom-topbar-ctrl">
          <button type="button" class="classroom-ctrl-btn" id="classroomViewModeTop" aria-pressed="${isPres0}">${escapeHtml(initialViewTgl)}</button>
          <button type="button" class="classroom-ctrl-btn classroom-ctrl-btn--primary" id="classroomFsTop" aria-pressed="${openFs}">${escapeHtml(initialFsL)}</button>
        </div>
        </div>
        <div class="classroom-title-block">
        <h1 class="classroom-title classroom-title--main" id="classroomTitleMain">${escapeHtml(titleBase)}</h1>
        <div class="classroom-subtitle" id="classroomMeta"></div>
        </div>
        <div class="classroom-asset-wrap" id="classroomAssetBannerHost">${assetBlock}</div>
        <div class="classroom-teacher-ctx" id="classroomTeacherContext">
          ${line1}
          <p class="classroom-ctx-line2 classroom-ctx-line2--meta">${escapeHtml(ctxLine2)}</p>
        </div>
      </header>
      <div id="classroomKidsGamesHost"></div>
      <section class="classroom-toolbar-wrap" id="classroomToolbar"></section>
      <main class="classroom-stage" id="classroomStage">
        <p class="classroom-empty">${escapeHtml(tx("common.loading"))}</p>
      </main>
    </section>
  `;

  root.querySelector("#classroomBackBtn")?.addEventListener("click", () => {
    location.hash = activeAsset ? "#teacher-assets" : "#teacher";
  });

  const pageSection = root.querySelector("#luminaClassroomPage");
  const kidsHost = root.querySelector("#classroomKidsGamesHost");
  const toolbarEl = root.querySelector("#classroomToolbar");
  const stageEl = root.querySelector("#classroomStage");

  /** 顶栏、游戏区、工具栏、舞台 同步 */
  function shellRefresh() {
    const st = getClassroomState();
    const tMain = displayLessonTitle(st.lessonData);
    const titleHost = root.querySelector("#classroomTitleMain");
    if (titleHost) {
      titleHost.textContent = tMain || titleBase;
    }
    const metaEl = root.querySelector("#classroomMeta");
    if (metaEl) {
      const courseLabel = formatTeacherHubCourseDisplay(courseId);
      metaEl.textContent = tx("classroom.meta.format", {
        course: courseLabel,
        level,
        lesson: String(st.lessonId || lessonNo),
      });
    }
    const pres = getClassroomViewMode() === ViewMode.PRESENTATION;
    const fs = isClassroomDocumentFullscreen();
    if (pageSection) {
      pageSection.setAttribute("data-presentation", pres ? "1" : "0");
      pageSection.setAttribute("data-classroom-fullscreen", fs ? "1" : "0");
    }
    const vTop = root.querySelector("#classroomViewModeTop");
    const fTop = root.querySelector("#classroomFsTop");
    if (vTop) {
      vTop.textContent = pres ? viewStandard : viewPresent;
      vTop.setAttribute("aria-pressed", pres ? "true" : "false");
    }
    if (fTop) {
      fTop.textContent = fs ? fsExit : fsEnter;
      fTop.setAttribute("aria-pressed", fs ? "true" : "false");
    }
    renderKidsGamesPanel(kidsHost, { courseId, level, lessonNo }, pres);
    if (toolbarEl && stageEl) {
      renderClassroomToolbar(toolbarEl, stageEl);
      renderClassroomStage(stageEl);
    }
    i18n.apply?.(root);
  }

  try {
    await initClassroomEngine({ courseId, lessonId: lessonNo, level }, { toolbarEl, stageEl });
  } catch (e) {
    console.error("[page.classroom] init failed:", e);
    if (stageEl) {
      stageEl.innerHTML = `<p class="classroom-empty">${escapeHtml(tx("classroom.init.failed"))}</p>`;
    }
  }

  if (pageSection) {
    initClassroomPresentation({
      pageEl: pageSection,
      getEls: () => ({ toolbarEl, stageEl }),
      query: q,
      onShellRefresh: shellRefresh,
    });
  } else {
    shellRefresh();
  }

  const vTop = root.querySelector("#classroomViewModeTop");
  const fTop = root.querySelector("#classroomFsTop");
  vTop?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleClassroomViewMode();
  });
  fTop?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleClassroomFullscreen();
  });

  i18n.apply?.(root);
}

export function mount(ctxOrRoot) {
  return pageClassroom(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageClassroom(ctxOrRoot);
}
