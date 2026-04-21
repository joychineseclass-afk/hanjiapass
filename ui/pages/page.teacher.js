// /ui/pages/page.teacher.js
// Lumina 教师工具中心：文案经 safeUiText，禁止 key 路径直出；课程名为 teacher.course.* 映射。

import { safeUiText, formatTeacherHubCourseDisplay } from "../lumina-commerce/commerceDisplayLabels.js";
import { i18n } from "../i18n.js";

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

let __teacherLangHandler = /** @type {null | (() => void)} */ (null);
let __teacherRootRef = /** @type {HTMLElement | null} */ (null);

function renderTeacherHub(root) {
  root.innerHTML = `
    <div class="teacher-page wrap">
      <section class="teacher-hero card teacher-center-page">
        <div class="hero">
          <h2 class="title">${escapeHtml(tx("teacher.tools.center"))}</h2>
          <p class="desc">${escapeHtml(tx("teacher.tools.subtitle"))}</p>
          <p class="desc" style="margin-top:10px;font-size:14px;">
            <a href="/index.html#lumina-teacher-stage0">${escapeHtml(tx("teacher.stage0.commerce.skeleton"))}</a>
          </p>
        </div>
      </section>

      <section class="teacher-grid">
        <article class="teacher-tile card teacher-tile-classroom">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.enter.classroom"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.enter.classroom_desc"))}</p>
          <div class="teacher-classroom-form">
            <label class="teacher-field">
              <span>${escapeHtml(tx("teacher.label.course"))}</span>
              <select id="teacherCourseSelect">
                <option value="kids">${escapeHtml(formatTeacherHubCourseDisplay("kids"))}</option>
                <option value="hsk">${escapeHtml(formatTeacherHubCourseDisplay("hsk"))}</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(tx("teacher.label.level"))}</span>
              <select id="teacherLevelSelect">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <label class="teacher-field">
              <span>${escapeHtml(tx("teacher.label.lesson"))}</span>
              <input id="teacherLessonInput" type="number" min="1" value="1" />
            </label>
            <button type="button" id="teacherEnterClassroomBtn" class="teacher-enter-btn">
              ${escapeHtml(tx("teacher.enter.classroom_button"))}
            </button>
          </div>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.my.materials"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.my.materials_desc"))}</p>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.ai.assistant"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.ai.desc"))}</p>
        </article>

        <article class="teacher-tile card">
          <h3 class="teacher-tile-title">${escapeHtml(tx("teacher.console.title"))}</h3>
          <p class="teacher-tile-desc">${escapeHtml(tx("teacher.console.desc"))}</p>
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
    if (__teacherRootRef?.isConnected) renderTeacherHub(__teacherRootRef);
  };
  window.addEventListener("joy:langChanged", __teacherLangHandler);

  renderTeacherHub(root);
}

export function mount(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageTeacher(ctxOrRoot);
}
