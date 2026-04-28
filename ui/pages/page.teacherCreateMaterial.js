// #teacher-create-material — 创建教材 / 制作工作台（与「我的教材」列表职责分离）

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

/** @type {readonly { kind: keyof typeof KIND_SLUG_TO_TYPE_KEY; labelKey: string }[]} */
const CREATE_TYPES = [
  { kind: "pdf", labelKey: KIND_SLUG_TO_TYPE_KEY.pdf },
  { kind: "doc", labelKey: KIND_SLUG_TO_TYPE_KEY.doc },
  { kind: "picture_book", labelKey: KIND_SLUG_TO_TYPE_KEY.picture_book },
  { kind: "handout", labelKey: KIND_SLUG_TO_TYPE_KEY.handout },
  { kind: "deck", labelKey: KIND_SLUG_TO_TYPE_KEY.deck },
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
  const kindSlug = readKindSlugFromLocation();
  /** 已登录且 URL 指明类型 → 占位「下一步」页 */
  const showKindStep = !u.isGuest && kindSlug !== "";

  const typeCards = CREATE_TYPES.map(
    ({ kind, labelKey }) => `
      <div class="teacher-create-material-type-card">
        <button type="button" class="teacher-create-material-type-btn" data-tcm-kind="${esc(kind)}">
          ${esc(t(labelKey))}
        </button>
      </div>`,
  ).join("");

  const guestMain = `
    <section class="card"><p class="teacher-module-placeholder-p">${esc(t("teacher.create_material.guest_body"))}</p>
        <a class="teacher-hub-cta teacher-hub-cta--primary" href="#login?next=teacher-create-material">${esc(t("auth.nav_login"))}</a></section>`;

  /** 选择类型入口（登录后且无 ?kind=） */
  const landingMain = `
    <section class="card teacher-create-material-hero" aria-labelledby="tcm-h1">
        <p class="teacher-page-kicker">${esc(t("teacher.create_material.kicker"))}</p>
        <h1 id="tcm-h1" class="teacher-admin-title">${esc(t("teacher.create_material.title"))}</h1>
        <p class="teacher-admin-subtitle">${esc(t("teacher.create_material.subtitle"))}</p>
      </section>
      <section class="card teacher-create-material-types" aria-labelledby="tcm-types">
        <h2 id="tcm-types" class="teacher-admin-list-heading">${esc(t("teacher.create_material.types_title"))}</h2>
        <div class="teacher-create-material-grid" role="group" aria-label="${esc(t("teacher.create_material.types_title"))}">
          ${typeCards}
        </div>
      </section>
      <section class="card teacher-create-material-next">
        <p class="teacher-create-material-next-lead">${esc(t("teacher.create_material.manage_hint"))}</p>
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-materials">${esc(t("teacher.create_material.cta_manage"))}</a>
      </section>`;

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
          <button type="button" class="teacher-hub-cta teacher-hub-cta--secondary" id="tcmStepBack">${esc(t("teacher.create_material.step_back"))}</button>
        </div>
      </section>
      <section class="card teacher-create-material-next">
        <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#teacher-materials">${esc(t("teacher.create_material.cta_manage"))}</a>
      </section>`;

  let main = "";
  if (u.isGuest) {
    main = guestMain;
  } else if (showKindStep && typeTitleKey) {
    main = stepMain;
  } else {
    main = landingMain;
  }

  root.innerHTML = renderTeacherAdminShell({
    active: "create_material",
    tx: t,
    showReviewConsole: showReview,
    shellClass: "teacher-page teacher-create-material-page",
    mainHtml: main,
  });
  i18n.apply?.(root);

  root.querySelectorAll("[data-tcm-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-tcm-kind");
      if (!kind || u.isGuest) return;
      navigateTo(`#teacher-create-material?kind=${encodeURIComponent(kind)}`);
    });
  });

  root.querySelector("#tcmStepBack")?.addEventListener("click", () => {
    navigateTo("#teacher-create-material", { force: true });
  });
}

export function mount(c) {
  return pageTeacherCreateMaterial(c);
}
export function render(c) {
  return pageTeacherCreateMaterial(c);
}
