// /ui/pages/page.teacher.js
// Lumina 教师入口：教师工具中心 + 课堂小游戏入口

import { i18n } from "../i18n.js";
import { games } from "../modules/games/gamesRegistry.js";

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    if (!v) return fallback;
    const s = String(v).trim();
    return s && s !== key ? s : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function pageTeacher(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  const title = t("teacher_tools_center", "教师工具中心");
  const gamesTitle = t("teacher_games", "课堂小游戏");
  const materialTitle = t("teacher_materials", "课堂教材");
  const aiTitle = t("teacher_ai_assistant", "AI课堂助手");
  const consoleTitle = t("teacher_console", "课堂控制台");

  const gamesDesc = t("teacher_games_desc", "为课堂准备的互动小游戏，仅在教师模式下显示。");
  const materialDesc = t("teacher_materials_desc", "管理你的私有教材和课堂课件。（即将上线）");
  const aiDesc = t("teacher_ai_desc", "用 AI 设计练习、生成情境对话。（即将上线）");
  const consoleDesc = t("teacher_console_desc", "控制课堂进度、点名、投票等。（即将上线）");

  const gameCards = games.map((g) => {
    const typeLabel = g.type || "";
    return `<button type="button" class="teacher-game-card" data-game-id="${escapeHtml(g.id)}">
      <div class="teacher-game-title">${escapeHtml(g.title)}</div>
      <div class="teacher-game-meta">${escapeHtml(typeLabel)}</div>
    </button>`;
  }).join("");

  root.innerHTML = `
    <div class="teacher-page wrap">
      <section class="teacher-hero card teacher-center-page">
        <div class="hero">
          <h2 class="title">${escapeHtml(title)}</h2>
          <p class="desc">${escapeHtml(t("teacher_tools_subtitle", "为课堂准备的工具面板：小游戏、教材、AI 助手与课堂控制。"))}</p>
        </div>
      </section>

      <section class="teacher-grid">
        <article class="teacher-tile card teacher-tile-classroom">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher_enter_classroom", "进入课堂"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(t("teacher_enter_classroom_desc", "选择课程与课次，进入课堂投屏模式。"))}</p>
          <div class="teacher-classroom-form">
            <label class="teacher-field">
              <span>${escapeHtml(t("teacher_course", "课程"))}</span>
              <select id="teacherCourseSelect">
                <option value="kids">${escapeHtml(t("teacher_course_kids", "Kids"))}</option>
                <option value="hsk">${escapeHtml(t("teacher_course_hsk", "HSK"))}</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(t("teacher_level", "级别/册"))}</span>
              <select id="teacherLevelSelect">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(t("teacher_lesson", "课次"))}</span>
              <input id="teacherLessonInput" type="number" min="1" value="1" />
            </label>
            <button type="button" id="teacherEnterClassroomBtn" class="teacher-enter-btn">
              ${escapeHtml(t("teacher_enter_classroom_button", "进入课堂"))}
            </button>
          </div>
        </article>

        <article class="teacher-tile card teacher-tile-games">
          <h3 class="teacher-tile-title">${escapeHtml(gamesTitle)}</h3>
          <p class="teacher-tile-desc">${escapeHtml(gamesDesc)}</p>
          <div class="teacher-game-list">
            ${gameCards}
          </div>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(materialTitle)}</h3>
          <p class="teacher-tile-desc">${escapeHtml(materialDesc)}</p>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(aiTitle)}</h3>
          <p class="teacher-tile-desc">${escapeHtml(aiDesc)}</p>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(consoleTitle)}</h3>
          <p class="teacher-tile-desc">${escapeHtml(consoleDesc)}</p>
        </article>
      </section>
    </div>
  `;

  root.querySelectorAll(".teacher-game-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-game-id") || "";
      if (!id) return;
      // 保持 hash 形如 #game/hello-ball，router 会归一化为 #game
      location.hash = `#game/${id}`;
    });
  });

  i18n.apply?.(root);
}

export function mount(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}
