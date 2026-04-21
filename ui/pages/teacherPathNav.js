function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 返回教师工作台（统一入口 #teacher）。
 * @param {(path: string, params?: object) => string} tx
 */
export function teacherBackToWorkspaceHtml(tx) {
  const m = (path) => escapeHtml(tx(path));
  return `<p class="teacher-admin-back">
    <a href="#teacher" class="teacher-back-link">${m("teacher.nav.back_workspace")}</a>
  </p>`;
}

/**
 * 教师模块轻量子导航：工作台 + 教材 / 课程 / 上架（当前项高亮）。
 * @param {'workspace' | 'materials' | 'courses' | 'listing'} active
 * @param {(path: string, params?: object) => string} tx
 */
export function teacherWorkspaceSubnavHtml(active, tx) {
  const m = (path) => escapeHtml(tx(path));
  /** @param {'workspace'|'materials'|'courses'|'listing'} kind */
  const item = (kind) => {
    const isCurrent = active === kind;
    let href = "#teacher";
    let label = m("teacher.workspace.title");
    if (kind === "materials") {
      href = "#teacher-materials";
      label = m("teacher.hub.materials.title");
    } else if (kind === "courses") {
      href = "#teacher-courses";
      label = m("teacher.hub.courses.title");
    } else if (kind === "listing") {
      href = "#lumina-teacher-stage0";
      label = m("teacher.hub.listing.title");
    }
    if (isCurrent) {
      return `<span class="teacher-subnav-item teacher-subnav-item--current" aria-current="page">${label}</span>`;
    }
    return `<a class="teacher-subnav-item teacher-subnav-item--link" href="${href}">${label}</a>`;
  };

  return `
    <nav class="teacher-subnav card" aria-label="${m("teacher.nav.subnav_aria")}">
      <div class="teacher-subnav-row">
        ${item("workspace")}
        ${item("materials")}
        ${item("courses")}
        ${item("listing")}
      </div>
    </nav>
  `;
}

/**
 * 教材 / 课程 / Listing 轻量路径条（仅导航与展示，无数据关联）。
 * @param {'materials' | 'courses' | 'listing' | null} active 为 null 时三步均可点选（如工作台首页）
 * @param {(path: string, params?: object) => string} tx 通常为 safeUiText / commerceT
 */
export function teacherPathStripHtml(active, tx) {
  const m = (path) => escapeHtml(tx(path));
  const hrefs = {
    materials: "#teacher-materials",
    courses: "#teacher-courses",
    listing: "#lumina-teacher-stage0",
  };
  /** @param {'materials'|'courses'|'listing'} kind */
  const node = (kind) => {
    const isCurrent = active != null && active === kind;
    const label = m(`teacher.path_strip.${kind}`);
    if (isCurrent) {
      return `<span class="teacher-path-strip-node teacher-path-strip-node--current" aria-current="step">${label}</span>`;
    }
    return `<a class="teacher-path-strip-node teacher-path-strip-node--link" href="${hrefs[kind]}">${label}</a>`;
  };

  return `
    <nav class="teacher-path-strip card" aria-label="${m("teacher.path_strip.aria")}">
      <div class="teacher-path-strip-row">
        ${node("materials")}
        <span class="teacher-path-strip-arrow" aria-hidden="true">${m("teacher.path_strip.arrow")}</span>
        ${node("courses")}
        <span class="teacher-path-strip-arrow" aria-hidden="true">${m("teacher.path_strip.arrow")}</span>
        ${node("listing")}
      </div>
    </nav>
  `;
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
          <a class="teacher-guide-cta teacher-guide-cta--accent" href="#lumina-teacher-stage0">${m("teacher.flow.cta_prepare_listing")}</a>
        </div>
      </div>
    </section>
  `;
}

/** @param {(path: string, params?: object) => string} tx */
export function teacherCoursesNextGuideHtml(tx) {
  const m = (path) => escapeHtml(tx(path));
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
          <p class="teacher-guide-route-heading">${m("teacher.flow.courses_next.path_b_title")}</p>
          <p class="teacher-guide-route-body">${m("teacher.flow.courses_next.path_b_body")}</p>
          <a class="teacher-guide-cta teacher-guide-cta--accent" href="#lumina-teacher-stage0">${m("teacher.flow.cta_register_listing")}</a>
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
