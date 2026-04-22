// /ui/pages/page.classroom.js
// 课堂模式：支持 /#classroom?course=…&… 与 /#classroom?assetId=…

import { i18n } from "../i18n.js";
import { initClassroomEngine } from "../platform/classroom/classroomEngine.js";
import { getClassroomState } from "../platform/classroom/classroomState.js";
import { getClassroomGamesForContext } from "../modules/games/gamesRegistry.js";
import { formatGameModeType, formatTeacherHubCourseDisplay, safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { selectClassroomContextFromAssetId } from "../lumina-commerce/teacherAssetsSelectors.js";

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
 * @param {HTMLElement} host
 * @param {{ courseId: string, level: string, lessonNo: string }} ctx
 */
function renderKidsGamesPanel(host, ctx) {
  if (!host) return;
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

/**
 * @param {import('../lumina-commerce/teacherAssetsStore.js').TeacherClassroomAsset} asset
 * @param {string} statusLabel
 */
function assetBannerHtml(asset, statusLabel) {
  return `
  <div class="classroom-asset-ctx" role="status">
    <p class="classroom-asset-ctx-kicker">${escapeHtml(tx("teacher.classroom.from_asset_badge"))}</p>
    <p class="classroom-asset-ctx-title">${escapeHtml(asset.title)}</p>
    <p class="classroom-asset-ctx-row"><span class="classroom-asset-ctx-status">${escapeHtml(statusLabel)}</span></p>
  </div>`;
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

  if (assetId) {
    const res = selectClassroomContextFromAssetId(assetId);
    if (res.ok) {
      courseId = res.courseId;
      level = res.level;
      lessonNo = res.lessonNo;
      activeAsset = res.asset;
    } else {
      assetError = res.error;
    }
  }

  const hasUrlParams = hashHasQueryString(String(location.hash || ""));

  const title = tx("classroom.title");
  const backLabel = tx("teacher.nav.back_mine_workbench");
  const backCourses = tx("teacher.classroom.back_courses");
  const backAssets = tx("teacher.classroom.back_assets");
  const modeLabel = tx("teacher.classroom.context.mode_label");
  const fromWs = tx("teacher.classroom.context.from_workspace");
  const fromAsset = tx("teacher.classroom.context.from_teacher_asset");

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

  const invalidBanner =
    assetId && assetError
      ? `<div class="classroom-asset-warn" role="alert">
          <p>${escapeHtml(
            tx(assetError === "forbidden" ? "teacher.classroom.asset_forbidden" : "teacher.classroom.asset_not_found"),
          )}</p>
        </div>`
      : "";

  const statusForBanner = activeAsset
    ? tx(`teacher.assets.state.${activeAsset.status}`)
    : "";
  const assetBlock = activeAsset ? assetBannerHtml(activeAsset, statusForBanner) : invalidBanner;

  const line1Text = activeAsset ? fromAsset : fromWs;
  const line1 = `<p class="classroom-ctx-line1">
            <span class="classroom-ctx-badge">${escapeHtml(modeLabel)}</span>
            <span class="classroom-ctx-muted">${escapeHtml(line1Text)}</span>
          </p>`;

  root.innerHTML = `
    <section class="lumina-classroom-page wrap">
      <header class="classroom-topbar">
        <div class="classroom-topbar-actions">
          <button type="button" class="classroom-back" id="classroomBackBtn">← ${escapeHtml(backLabel)}</button>
          <a class="classroom-back-secondary" href="#teacher-assets">${escapeHtml(backAssets)}</a>
          <a class="classroom-back-secondary" href="#teacher-courses">${escapeHtml(backCourses)}</a>
        </div>
        <div class="classroom-asset-wrap" id="classroomAssetBannerHost">${assetBlock}</div>
        <div class="classroom-teacher-ctx" id="classroomTeacherContext">
          ${line1}
          <p class="classroom-ctx-line2">${escapeHtml(ctxLine2)}</p>
        </div>
        <div class="classroom-title-wrap">
          <div class="classroom-title">${escapeHtml(title)}</div>
          <div class="classroom-subtitle" id="classroomMeta"></div>
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

  const kidsHost = root.querySelector("#classroomKidsGamesHost");
  renderKidsGamesPanel(kidsHost, { courseId, level, lessonNo });

  const toolbarEl = root.querySelector("#classroomToolbar");
  const stageEl = root.querySelector("#classroomStage");
  try {
    await initClassroomEngine(
      { courseId, lessonId: lessonNo, level },
      { toolbarEl, stageEl }
    );
    const st = getClassroomState();
    const metaEl = root.querySelector("#classroomMeta");
    if (metaEl) {
      const courseLabel = formatTeacherHubCourseDisplay(courseId);
      metaEl.textContent = tx("classroom.meta.format", {
        course: courseLabel,
        level,
        lesson: String(st.lessonId || lessonNo),
      });
    }
  } catch (e) {
    console.error("[page.classroom] init failed:", e);
    if (stageEl) {
      stageEl.innerHTML = `<p class="classroom-empty">${escapeHtml(tx("classroom.init.failed"))}</p>`;
    }
  }

  i18n.apply?.(root);
}

export function mount(ctxOrRoot) {
  return pageClassroom(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageClassroom(ctxOrRoot);
}
