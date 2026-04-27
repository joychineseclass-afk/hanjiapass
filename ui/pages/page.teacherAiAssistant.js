// #teacher-ai — AI 教学助手（占位；说明从工作台首页移入本页）

import { initCommerceStore } from "../lumina-commerce/store.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { i18n } from "../i18n.js";
import { currentUserCanAccessTeacherReviewConsoleSync, renderTeacherAdminShell } from "./teacherPathNav.js";

function tx(k, p) {
  return safeUiText(k, p);
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function pageTeacherAiAssistant(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;
  const t = tx;
  try {
    await initCommerceStore();
  } catch {
    /* */
  }
  const u = getCurrentUser();
  const showReview = currentUserCanAccessTeacherReviewConsoleSync();
  const main = u.isGuest
    ? `<section class="card"><p class="teacher-module-placeholder-p">${esc(t("teacher.gate.guest_body"))}</p>
        <a class="teacher-hub-cta teacher-hub-cta--primary" href="#login?next=teacher-ai">${esc(t("auth.nav_login"))}</a></section>`
    : `<section class="card teacher-module-placeholder" aria-labelledby="teacher-ai-h1">
        <h1 id="teacher-ai-h1" class="teacher-module-placeholder-h1">${esc(t("teacher.ai.assistant"))}</h1>
        <p class="teacher-module-placeholder-lead">${esc(t("teacher.ai.desc"))}</p>
        <p class="teacher-module-placeholder-note">${esc(t("teacher.ai.scope_note"))}</p>
      </section>`;
  root.innerHTML = renderTeacherAdminShell({
    active: "ai_assistant",
    tx: t,
    showReviewConsole: showReview,
    shellClass: "teacher-page teacher-module-placeholder-page",
    mainHtml: main,
  });
  i18n.apply?.(root);
}

export function mount(c) {
  return pageTeacherAiAssistant(c);
}
export function render(c) {
  return pageTeacherAiAssistant(c);
}
