// /ui/pages/page.teacher.js
// Lumina 教师工具中心（平台级入口）：不包含课程内小游戏；小游戏仅在课堂页按课程上下文展示。

import { i18n } from "../i18n.js";

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

  root.innerHTML = `
    <div class="teacher-page wrap">
      <section class="teacher-hero card teacher-center-page">
        <div class="hero">
          <h2 class="title">${escapeHtml(t("teacher_tools_center", "Teacher hub"))}</h2>
          <p class="desc">${escapeHtml(
            t("teacher_tools_subtitle", "Entry points for classroom, materials, AI, and console. Course tools open after you enter a lesson.")
          )}</p>
          <p class="desc" style="margin-top:10px;font-size:14px;">
            <a href="/index.html#lumina-teacher-stage0">${escapeHtml(
              t("teacher_stage0_commerce_skeleton", "Commerce Stage 0 (placeholders)")
            )}</a>
          </p>
        </div>
      </section>

      <section class="teacher-grid">
        <article class="teacher-tile card teacher-tile-classroom">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher_enter_classroom", "Enter classroom"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(
            t("teacher_enter_classroom_desc", "Choose a course, level, and lesson to open classroom mode.")
          )}</p>
          <div class="teacher-classroom-form">
            <label class="teacher-field">
              <span>${escapeHtml(t("teacher_label_course", "Course"))}</span>
              <select id="teacherCourseSelect">
                <option value="kids">${escapeHtml(t("teacher_course_kids", "Kids"))}</option>
                <option value="hsk">${escapeHtml(t("teacher_course_hsk", "HSK"))}</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(t("teacher_level", "Level"))}</span>
              <select id="teacherLevelSelect">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(t("teacher_lesson", "Lesson"))}</span>
              <input id="teacherLessonInput" type="number" min="1" value="1" />
            </label>
            <button type="button" id="teacherEnterClassroomBtn" class="teacher-enter-btn">
              ${escapeHtml(t("teacher_enter_classroom_button", "Open classroom"))}
            </button>
          </div>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher_my_materials", "My materials"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(
            t("teacher_my_materials_desc", "Manage private teaching materials. (Coming soon)")
          )}</p>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher_ai_assistant", "AI teaching assistant"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(
            t("teacher_ai_desc", "Generate practice and dialogues with AI. (Coming soon)")
          )}</p>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(t("teacher_console_title", "Classroom console"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(
            t("teacher_console_desc", "Lesson flow, attendance, polls, timers. (Coming soon)")
          )}</p>
        </article>
      </section>
    </div>
  `;

  root.querySelector("#teacherEnterClassroomBtn")?.addEventListener("click", () => {
    const course = String(root.querySelector("#teacherCourseSelect")?.value || "kids");
    const level = String(root.querySelector("#teacherLevelSelect")?.value || "1");
    const lessonRaw = String(root.querySelector("#teacherLessonInput")?.value || "1");
    const lesson = String(Math.max(1, parseInt(lessonRaw, 10) || 1));
    location.hash = `#classroom?course=${encodeURIComponent(course)}&level=${encodeURIComponent(level)}&lesson=${encodeURIComponent(lesson)}`;
  });

  i18n.apply?.(root);
}

export function mount(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}
