// /ui/pages/page.classroom.js
// 课堂模式入口：/#classroom?course=kids&level=1&lesson=1

import { i18n } from "../i18n.js";
import { initClassroomEngine } from "../platform/classroom/classroomEngine.js";
import { getClassroomState } from "../platform/classroom/classroomState.js";
import { getClassroomGamesForContext } from "../modules/games/gamesRegistry.js";
import { formatGameModeType, formatTeacherHubCourseDisplay, safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";

function tx(key, params) {
  return safeUiText(key, params);
}

function parseQuery() {
  const hash = String(location.hash || "");
  const qIndex = hash.indexOf("?");
  const query = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
  const out = {};
  if (!query) return out;
  query.split("&").forEach((kv) => {
    const [k, v] = kv.split("=");
    if (!k) return;
    out[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return out;
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

export default async function pageClassroom(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  const q = parseQuery();
  const courseId = q.course || "kids";
  const level = q.level || "1";
  const lessonNo = q.lesson || "1";

  const title = tx("classroom.title");
  const backLabel = tx("classroom.back.to.teacher");

  root.innerHTML = `
    <section class="lumina-classroom-page wrap">
      <header class="classroom-topbar">
        <button type="button" class="classroom-back" id="classroomBackBtn">← ${escapeHtml(backLabel)}</button>
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
    location.hash = "#teacher";
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
