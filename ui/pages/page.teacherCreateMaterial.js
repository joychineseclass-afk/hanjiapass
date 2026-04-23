// #teacher-create-material — 创建教材 / 制作工作台（占位；与「我的教材」列表职责分离）

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

/** @type {readonly { key: string }[]} */
const CREATE_TYPE_KEYS = [
  { key: "teacher.create_material.type_pdf" },
  { key: "teacher.create_material.type_doc" },
  { key: "teacher.create_material.type_picture_book" },
  { key: "teacher.create_material.type_handout" },
  { key: "teacher.create_material.type_deck" },
];

export default async function pageTeacherCreateMaterial(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  try {
    await initCommerceStore();
  } catch {
    /* */
  }

  const t = tx;
  const u = getCurrentUser();
  const showReview = currentUserCanAccessTeacherReviewConsoleSync();

  const typeCards = CREATE_TYPE_KEYS.map(
    ({ key }) => `
      <div class="teacher-create-material-type-card">
        <button type="button" class="teacher-create-material-type-btn" disabled aria-disabled="true">
          ${esc(t(key))}
        </button>
        <span class="teacher-create-material-type-badge">${esc(t("teacher.create_material.cta_placeholder"))}</span>
      </div>`,
  ).join("");

  const main = u.isGuest
    ? `<section class="card"><p class="teacher-module-placeholder-p">${esc(t("teacher.create_material.guest_body"))}</p>
        <a class="teacher-hub-cta teacher-hub-cta--primary" href="#login?next=teacher-create-material">${esc(t("auth.nav_login"))}</a></section>`
    : `<section class="card teacher-create-material-hero" aria-labelledby="tcm-h1">
        <p class="teacher-page-kicker">${esc(t("teacher.create_material.kicker"))}</p>
        <h1 id="tcm-h1" class="teacher-admin-title">${esc(t("teacher.create_material.title"))}</h1>
        <p class="teacher-admin-subtitle">${esc(t("teacher.create_material.subtitle"))}</p>
        <p class="teacher-create-material-lead">${esc(t("teacher.create_material.lead"))}</p>
      </section>
      <section class="card teacher-create-material-types" aria-labelledby="tcm-types">
        <h2 id="tcm-types" class="teacher-admin-list-heading">${esc(t("teacher.create_material.types_title"))}</h2>
        <p class="teacher-create-material-types-hint">${esc(t("teacher.create_material.types_hint"))}</p>
        <div class="teacher-create-material-grid" role="group" aria-label="${esc(t("teacher.create_material.types_title"))}">
          ${typeCards}
        </div>
      </section>
      <section class="card teacher-create-material-next">
        <p class="teacher-create-material-next-lead">${esc(t("teacher.create_material.manage_hint"))}</p>
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-materials">${esc(t("teacher.create_material.cta_manage"))}</a>
      </section>`;

  root.innerHTML = renderTeacherAdminShell({
    active: "create_material",
    tx: t,
    showReviewConsole: showReview,
    shellClass: "teacher-page teacher-create-material-page",
    mainHtml: main,
  });
  i18n.apply?.(root);
}

export function mount(c) {
  return pageTeacherCreateMaterial(c);
}
export function render(c) {
  return pageTeacherCreateMaterial(c);
}
