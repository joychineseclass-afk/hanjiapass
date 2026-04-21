// /ui/pages/page.classroom.js
// 课堂模式入口：/#classroom?course=kids&level=1&lesson=1
// 课程级工具（如 Kids 小游戏）仅在本页按 course/level/lesson 上下文渲染。

import { i18n } from "../i18n.js";
import { initClassroomEngine } from "../platform/classroom/classroomEngine.js";
import { getClassroomState } from "../platform/classroom/classroomState.js";
import { getClassroomGamesForContext } from "../modules/games/gamesRegistry.js";

function t(key, fallback = "", params) {
  try {
    if (params && typeof params === "object") {
      const v = i18n?.t?.(key, params);
      if (v != null && String(v).trim() && String(v) !== key) return String(v);
    } else {
      const v = i18n?.t?.(key);
      if (v != null) {
        const s = String(v).trim();
        if (s && s !== key) return s;
      }
    }
  } catch {}
  return fallback;
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

  const title = t("classroom_kids_games_title", "Kids classroom games");
  const desc = t(
    "classroom_kids_games_desc",
    "Interactive games for this course appear only in classroom mode after you pick a lesson."
  );

  const cards = games
    .map((g) => {
      const typeLabel = g.type || "";
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

  const title = t("classroom_title", "Classroom mode");
  const backLabel = t("classroom_back_to_teacher", "Back to teacher hub");

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
        <p class="classroom-empty">${escapeHtml(t("common.loading", "Loading..."))}</p>
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
      const courseLabel =
        String(courseId).toLowerCase() === "kids"
          ? t("teacher_course_kids", "Kids")
          : t("teacher_course_hsk", "HSK");
      metaEl.textContent = t("classroom_meta_format", {
        course: courseLabel,
        level,
        lesson: String(st.lessonId || lessonNo),
      });
    }
  } catch (e) {
    console.error("[page.classroom] init failed:", e);
    if (stageEl) {
      stageEl.innerHTML = `<p class="classroom-empty">${escapeHtml(t("classroom_init_failed", "Failed to load classroom"))}</p>`;
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
