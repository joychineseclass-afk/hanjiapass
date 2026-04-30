// #teacher-create-material — 兼容入口：合并到「我的教材」之后，仅承接旧链接与有 ?kind= 的占位下一步页。
// 无 kind 参数 → 重定向至 `#teacher-materials?new=1`（自动展开顶部新建下拉）。

import { initCommerceStore } from "../lumina-commerce/store.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";
import { i18n } from "../i18n.js";
import { navigateTo } from "../router.js";
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

/** @type {Record<string, string>} slug → type_* i18n key */
const KIND_SLUG_TO_TYPE_KEY = {
  pdf: "teacher.create_material.type_pdf",
  doc: "teacher.create_material.type_doc",
  picture_book: "teacher.create_material.type_picture_book",
  handout: "teacher.create_material.type_handout",
  deck: "teacher.create_material.type_deck",
};

/**
 * Reads `kind` from `location.hash` query (e.g. `#teacher-create-material?kind=pdf`).
 * @returns {keyof typeof KIND_SLUG_TO_TYPE_KEY|""}
 */
function readKindSlugFromLocation() {
  const h = String(location.hash || "");
  const qi = h.indexOf("?");
  if (qi < 0) return "";
  const sp = new URLSearchParams(h.slice(qi));
  const raw = String(sp.get("kind") ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return raw in KIND_SLUG_TO_TYPE_KEY ? /** @type {keyof typeof KIND_SLUG_TO_TYPE_KEY} */ (raw) : "";
}

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
  const kindSlug = readKindSlugFromLocation();

  if (u.isGuest) {
    const guestMain = `
      <section class="card"><p class="teacher-module-placeholder-p">${esc(t("teacher.create_material.guest_body"))}</p>
        <a class="teacher-hub-cta teacher-hub-cta--primary" href="#login?next=teacher-materials">${esc(t("auth.nav_login"))}</a></section>`;
    root.innerHTML = renderTeacherAdminShell({
      active: "materials",
      tx: t,
      showReviewConsole: showReview,
      shellClass: "teacher-page teacher-create-material-page",
      mainHtml: guestMain,
    });
    i18n.apply?.(root);
    return;
  }

  if (kindSlug === "") {
    navigateTo("#teacher-materials?new=1", { force: true });
    return;
  }

  const typeTitleKey = KIND_SLUG_TO_TYPE_KEY[kindSlug];
  const stepMain = `
    <section class="card teacher-create-material-hero" aria-labelledby="tcm-step-h1">
        <p class="teacher-page-kicker">${esc(t("teacher.create_material.kicker"))}</p>
        <h1 id="tcm-step-h1" class="teacher-admin-title">${esc(t(typeTitleKey))}</h1>
        <p class="teacher-admin-subtitle">${esc(t("teacher.create_material.subtitle"))}</p>
      </section>
      <section class="card teacher-create-material-step-card">
        <p class="teacher-create-material-step-placeholder">${esc(t("teacher.create_material.step_placeholder"))}</p>
        <div class="teacher-create-material-step-actions">
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-materials">${esc(t("teacher.create_material.cta_manage"))}</a>
        </div>
      </section>`;

  root.innerHTML = renderTeacherAdminShell({
    active: "materials",
    tx: t,
    showReviewConsole: showReview,
    shellClass: "teacher-page teacher-create-material-page",
    mainHtml: stepMain,
  });
  i18n.apply?.(root);
}

export function mount(c) {
  return pageTeacherCreateMaterial(c);
}
export function render(c) {
  return pageTeacherCreateMaterial(c);
}
