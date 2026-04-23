import { getCommerceStoreSync, userHasRole } from "../lumina-commerce/store.js";
import { USER_ROLE } from "../lumina-commerce/enums.js";
import { getCurrentUser } from "../lumina-commerce/currentUser.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 当前会话用户是否具备审核台权限（演示：commerce store 中的 reviewer / admin 角色）。
 * @param {import('../lumina-commerce/store.js').CommerceStoreSnapshot|null} snap
 * @param {string|null|undefined} userId
 */
export function userCanAccessTeacherReviewConsole(snap, userId) {
  if (!snap || userId == null || userId === "") return false;
  const uid = String(userId);
  return userHasRole(snap, uid, USER_ROLE.reviewer) || userHasRole(snap, uid, USER_ROLE.admin);
}

/** 依赖已初始化的 commerce store（教师页在 getTeacherPageContext 后会就绪）。 */
export function currentUserCanAccessTeacherReviewConsoleSync() {
  const snap = getCommerceStoreSync();
  const u = getCurrentUser();
  if (!snap || !u?.id || u.isGuest) return false;
  return userCanAccessTeacherReviewConsole(snap, String(u.id));
}

/**
 * 返回「我的工作台」（统一入口 #teacher）。
 * @param {(path: string, params?: object) => string} tx
 */
export function teacherBackToWorkspaceHtml(tx) {
  const m = (path) => escapeHtml(tx(path));
  return `<p class="teacher-admin-back">
    <a href="#teacher" class="teacher-back-link">${m("teacher.nav.back_mine_workbench")}</a>
  </p>`;
}

const TEACHER_MODULE_NAV_ORDER = /** @type {const} */ ([
  "workspace",
  "profile",
  "create_material",
  "materials",
  "courses",
  "assets",
  "pub_review",
  "sales_orders",
  "ai_assistant",
  "classroom_console",
]);

/**
 * 老师端模块导航单条：与已移除的横向 subnav 同一数据源，仅由侧栏 `renderTeacherAdminShell` 使用。
 * @param {'workspace' | 'profile' | 'create_material' | 'materials' | 'courses' | 'assets' | 'pub_review' | 'sales_orders' | 'listing' | 'publishing' | 'review'} kind
 * @param {string} active  当前高亮键（与页面 `renderTeacherAdminShell` 传入一致）
 * @param {(path: string) => string} m  已转义安全文案
 */
function teacherModuleNavItemSpec(kind, active, m) {
  const publishingGroup = active === "publishing" || active === "pub_review" || active === "listing";
  const materialsGroup = active === "materials" || active === "create_material";
  let href = "#teacher";
  let label = m("teacher.nav.mine_workbench");
  let isCurrent = false;

  if (kind === "workspace") {
    isCurrent = active === "workspace";
  } else if (kind === "profile") {
    href = "#teacher-profile";
    label = m("teacher.nav.teacher_profile");
    isCurrent = active === "profile";
  } else if (kind === "create_material") {
    href = "#teacher-materials";
    label = m("teacher.nav.create_material");
    isCurrent = materialsGroup;
  } else if (kind === "materials") {
    href = "#teacher-materials";
    label = m("teacher.hub.materials.title");
    isCurrent = materialsGroup;
  } else if (kind === "courses") {
    href = "#teacher-courses";
    label = m("teacher.hub.courses.title");
    isCurrent = active === "courses";
  } else if (kind === "assets") {
    href = "#teacher-assets";
    label = m("teacher.hub.assets.title");
    isCurrent = active === "assets";
  } else if (kind === "pub_review") {
    href = "#teacher-publishing";
    label = m("teacher.nav.publish_and_review");
    isCurrent = publishingGroup;
  } else if (kind === "sales_orders") {
    href = "#my-orders";
    label = m("teacher.nav.sales_and_orders");
    isCurrent = active === "sales_orders";
  } else if (kind === "ai_assistant") {
    href = "#teacher-ai";
    label = m("teacher.nav.ai_assistant");
    isCurrent = active === "ai_assistant";
  } else if (kind === "classroom_console") {
    href = "#teacher-console";
    label = m("teacher.nav.classroom_console");
    isCurrent = active === "classroom_console";
  } else if (kind === "publishing" || kind === "listing") {
    href = "#teacher-publishing";
    label = m("teacher.nav.my_publishing");
    isCurrent = publishingGroup;
  } else if (kind === "review") {
    href = "#teacher-review";
    label = m("teacher.nav.review_console");
    isCurrent = active === "review";
  }
  return { href, label, isCurrent };
}

/**
 * 侧栏内单链：块级纵向导航。
 * @param {'workspace' | 'profile' | 'create_material' | 'materials' | 'courses' | 'assets' | 'pub_review' | 'sales_orders' | 'listing' | 'publishing' | 'review'} kind
 * @param {string} active
 * @param {(path: string) => string} m
 */
function teacherShellNavItemHtml(kind, active, m) {
  const { href, label, isCurrent } = teacherModuleNavItemSpec(kind, active, m);
  if (isCurrent) {
    return `<span class="teacher-shell-nav-link teacher-shell-nav-link--current" aria-current="page">${label}</span>`;
  }
  return `<a class="teacher-shell-nav-link" href="${href}">${label}</a>`;
}

/**
 * 老师端统一后台布局：左侧固定模块导航 + 右侧主内容。不改变 hash 与权限语义。
 * @param {object} opts
 * @param {string} opts.active  如 workspace、materials、create_material、pub_review、sales_orders、publishing、listing、review 等
 * @param {(path: string, params?: object) => string} opts.tx
 * @param {string} opts.mainHtml
 * @param {boolean} [opts.showReviewConsole]  省略时按 currentUser 与 commerce store 同步判断
 * @param {string} [opts.shellClass]  附加在 .teacher-shell 上的类名（如 teacher-page、teacher-manage-page）
 * @param {string} [opts.brandKey]  侧栏品牌/模块标题的 i18n 路径，默认 teacher.workspace.hub_hero_kicker
 */
export function renderTeacherAdminShell(opts) {
  const { active, tx, mainHtml } = opts;
  const m = (path) => escapeHtml(tx(path));
  const showReview =
    typeof opts.showReviewConsole === "boolean"
      ? opts.showReviewConsole
      : currentUserCanAccessTeacherReviewConsoleSync();
  const includeReviewNav = showReview || active === "review";
  const brandKey = opts.brandKey != null && opts.brandKey !== "" ? opts.brandKey : "teacher.workspace.hub_hero_kicker";
  const shellClass = (opts.shellClass || "").trim();
  const shellExtra = shellClass ? ` ${shellClass}` : "";
  const kinds = includeReviewNav ? [...TEACHER_MODULE_NAV_ORDER, "review"] : [...TEACHER_MODULE_NAV_ORDER];
  const navItems = kinds.map((k) => teacherShellNavItemHtml(/** @type {any} */ (k), active, m)).join("");

  return `<div class="teacher-shell wrap${shellExtra}">
    <aside class="teacher-shell-sidebar">
      <div class="teacher-shell-brand">
        <span class="teacher-shell-brand-text">${m(brandKey)}</span>
      </div>
      <nav class="teacher-shell-nav" aria-label="${m("teacher.nav.subnav_aria")}">
        ${navItems}
      </nav>
    </aside>
    <div class="teacher-shell-main">
      <div class="teacher-main" data-teacher-main>${mainHtml}</div>
    </div>
  </div>`;
}

/**
 * 工作流条：选教材/课程 → 建课堂资产 → 上架；进入课堂在资产或工作台完成。
 * @param {'materials' | 'courses' | 'assets' | 'listing' | null} active
 * @param {(path: string, params?: object) => string} tx
 * @param {{ showLead?: boolean }} [options] 为 false 时不渲染段首说明句（与页面标题区副标去重，如 #teacher-assets）
 */
export function teacherPathStripHtml(active, tx, options = {}) {
  const m = (path) => escapeHtml(tx(path));
  const showLead = options.showLead !== false;
  const leadHtml = showLead
    ? `<p class="teacher-path-strip-lead">${m("teacher.path_strip.step2_lead")}</p>`
    : "";
  const hrefs = {
    materials: "#teacher-materials",
    courses: "#teacher-courses",
    assets: "#teacher-assets",
    listing: "#teacher-publishing",
  };
  /** @param {'materials'|'courses'|'assets'|'listing'} kind */
  const node = (kind) => {
    const isCurrent = active != null && active === kind;
    const label = m(`teacher.path_strip.${kind}`);
    if (isCurrent) {
      return `<span class="teacher-path-strip-node teacher-path-strip-node--current" aria-current="step">${label}</span>`;
    }
    return `<a class="teacher-path-strip-node teacher-path-strip-node--link" href="${hrefs[kind]}">${label}</a>`;
  };

  return `
    <nav class="teacher-path-strip card${showLead ? "" : " teacher-path-strip--no-lead"}" aria-label="${m("teacher.path_strip.aria_mine")}">
      ${leadHtml}
      <div class="teacher-path-strip-row">
        ${node("materials")}
        <span class="teacher-path-strip-arrow" aria-hidden="true">${m("teacher.path_strip.arrow")}</span>
        ${node("courses")}
        <span class="teacher-path-strip-arrow" aria-hidden="true">${m("teacher.path_strip.arrow")}</span>
        ${node("assets")}
        <span class="teacher-path-strip-arrow" aria-hidden="true">${m("teacher.path_strip.arrow")}</span>
        ${node("listing")}
      </div>
    </nav>
  `;
}

/**
 * 课堂入口从课程/教材进入的说明（避免误以为路径坏了）。
 * @param {(path: string, params?: object) => string} tx
 */
export function teacherPathStripClassroomHintHtml(tx) {
  const m = (path) => escapeHtml(tx(path));
  return `<p class="teacher-path-classroom-hint">${m("teacher.path_strip.classroom_from_mine")}</p>`;
}

/** @param {(path: string, params?: object) => string} tx */
export function teacherMaterialsNextGuideHtml(tx) {
  const m = (path) => escapeHtml(tx(path));
  return `
    <section class="card teacher-guide-panel" aria-labelledby="teacher-flow-materials-next-title">
      <h2 id="teacher-flow-materials-next-title" class="teacher-guide-panel-title">${m("teacher.flow.materials_next.title")}</h2>
      <p class="teacher-guide-panel-intro">${m("teacher.flow.materials_next.intro")}</p>
      <div class="teacher-guide-routes">
        <div class="teacher-guide-route">
          <p class="teacher-guide-route-heading">${m("teacher.flow.materials_next.path_a_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.materials_next.path_a_body")}</p>
          <a class="teacher-guide-cta" href="#teacher-courses">${m("teacher.flow.cta_organize_courses")}</a>
        </div>
        <div class="teacher-guide-route">
          <p class="teacher-guide-route-heading">${m("teacher.flow.materials_next.path_b_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.materials_next.path_b_body")}</p>
          <a class="teacher-guide-cta teacher-guide-cta--accent" href="#teacher-publishing">${m("teacher.flow.cta_prepare_listing")}</a>
        </div>
      </div>
    </section>
  `;
}

/** @param {(path: string, params?: object) => string} tx */
export function teacherCoursesNextGuideHtml(tx) {
  const m = (path) => escapeHtml(tx(path));
  const classroomHref = "#classroom?course=kids&level=1&lesson=1";
  return `
    <section class="card teacher-guide-panel" aria-labelledby="teacher-flow-courses-next-title">
      <h2 id="teacher-flow-courses-next-title" class="teacher-guide-panel-title">${m("teacher.flow.courses_next.title")}</h2>
      <p class="teacher-guide-panel-intro">${m("teacher.flow.courses_next.intro")}</p>
      <p class="teacher-guide-panel-note">${m("teacher.flow.courses_next.note")}</p>
      <div class="teacher-guide-routes">
        <div class="teacher-guide-route">
          <p class="teacher-guide-route-heading">${m("teacher.flow.courses_next.path_a_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.courses_next.path_a_body")}</p>
          <a class="teacher-guide-cta" href="#teacher-courses">${m("teacher.flow.cta_continue_courses")}</a>
        </div>
        <div class="teacher-guide-route">
          <p class="teacher-guide-route-heading">${m("teacher.flow.courses_next.path_classroom_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.courses_next.path_classroom_body")}</p>
          <a class="teacher-guide-cta teacher-guide-cta--classroom" href="${classroomHref}">${m("teacher.flow.cta_open_classroom")}</a>
        </div>
        <div class="teacher-guide-route">
          <p class="teacher-guide-route-heading">${m("teacher.flow.courses_next.path_b_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.courses_next.path_b_body")}</p>
          <a class="teacher-guide-cta teacher-guide-cta--accent" href="#teacher-publishing">${m("teacher.flow.cta_register_listing")}</a>
        </div>
      </div>
      <p class="teacher-guide-panel-foot">
        <a class="teacher-guide-cta teacher-guide-cta--ghost" href="#teacher-materials">${m("teacher.flow.cta_refine_materials")}</a>
      </p>
    </section>
  `;
}

/** @param {(path: string, params?: object) => string} tx */
export function teacherListingSourceGuideHtml(tx) {
  const m = (path) => escapeHtml(tx(path));
  return `
    <section class="card teacher-guide-panel" aria-labelledby="teacher-flow-listing-source-title">
      <h2 id="teacher-flow-listing-source-title" class="teacher-guide-panel-title">${m("teacher.flow.listing_source.title")}</h2>
      <p class="teacher-guide-panel-intro">${m("teacher.flow.listing_source.intro")}</p>
      <p class="teacher-guide-panel-scope">${m("teacher.flow.listing_source.scope")}</p>
      <div class="teacher-guide-routes">
        <div class="teacher-guide-route">
          <p class="teacher-guide-route-heading">${m("teacher.flow.listing_source.source_a_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.listing_source.source_a_body")}</p>
          <a class="teacher-guide-cta" href="#teacher-courses">${m("teacher.flow.cta_view_courses")}</a>
        </div>
        <div class="teacher-guide-route">
          <p class="teacher-guide-route-heading">${m("teacher.flow.listing_source.source_b_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.listing_source.source_b_body")}</p>
          <a class="teacher-guide-cta teacher-guide-cta--accent" href="#teacher-materials">${m("teacher.flow.cta_view_materials")}</a>
        </div>
      </div>
    </section>
  `;
}
