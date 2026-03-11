// /ui/pages/page.classroom.js
// 课堂模式入口：/#classroom?course=kids&level=1&lesson=1

import { i18n } from "../i18n.js";
import { initClassroomEngine } from "../platform/classroom/classroomEngine.js";
import { getClassroomState } from "../platform/classroom/classroomState.js";

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

  const title = t("classroom_title", "课堂模式");
  const backLabel = t("classroom_back_to_teacher", "返回教师中心");

  root.innerHTML = `
    <section class="lumina-classroom-page wrap">
      <header class="classroom-topbar">
        <button type="button" class="classroom-back" id="classroomBackBtn">← ${backLabel}</button>
        <div class="classroom-title-wrap">
          <div class="classroom-title">${escapeHtml(title)}</div>
          <div class="classroom-subtitle" id="classroomMeta"></div>
        </div>
      </header>
      <section class="classroom-toolbar-wrap" id="classroomToolbar"></section>
      <main class="classroom-stage" id="classroomStage">
        <p class="classroom-empty">${escapeHtml(t("common_loading", "加载中..."))}</p>
      </main>
    </section>
  `;

  root.querySelector("#classroomBackBtn")?.addEventListener("click", () => {
    location.hash = "#teacher";
  });

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
      metaEl.textContent = `${st.courseId || courseId} · Lesson ${st.lessonId || lessonNo}`;
    }
  } catch (e) {
    console.error("[page.classroom] init failed:", e);
    if (stageEl) {
      stageEl.innerHTML = `<p class="classroom-empty">${escapeHtml(t("classroom_init_failed", "无法加载课堂数据"))}</p>`;
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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

