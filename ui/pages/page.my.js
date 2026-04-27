// /ui/pages/page.my.js
import { i18n } from "../i18n.js";
import { getCurrentSessionAuthUser, getTeacherNavRoleState } from "../auth/authService.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";
import { readLearnerResume, LUMINA_DEFAULT_LEARNING_ENTRY_HASH } from "../learner/luminaLearnerResume.js";

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

function teacherStatusCardHtml() {
  const u = getCurrentSessionAuthUser();
  if (!u) return "";
  const st = getTeacherNavRoleState() ?? "none";
  let inner = "";
  if (st === "active") {
    inner = `
      <p class="my-teacher__desc" data-i18n="myLumina.teacher_blurb_active">${esc(tx("myLumina.teacher_blurb_active"))}</p>
      <a class="learner-my-link" href="#teacher" data-nav-teacher="1" data-i18n="myLumina.teacher_goto">${esc(tx("myLumina.teacher_goto"))}</a>`;
  } else if (st === "pending") {
    inner = `
      <p class="my-teacher__desc" data-i18n="myLumina.teacher_blurb_pending">${esc(tx("myLumina.teacher_blurb_pending"))}</p>
      <a class="learner-my-link" href="#teacher" data-nav-teacher="1" data-i18n="myLumina.teacher_see_status">${esc(tx("myLumina.teacher_see_status"))}</a>`;
  } else if (st === "rejected") {
    inner = `
      <p class="my-teacher__desc" data-i18n="myLumina.teacher_blurb_rejected">${esc(tx("myLumina.teacher_blurb_rejected"))}</p>
      <a class="learner-my-link" href="#teacher" data-nav-teacher="1" data-i18n="myLumina.teacher_reapply">${esc(tx("myLumina.teacher_reapply"))}</a>`;
  } else {
    inner = `
      <p class="my-teacher__desc" data-i18n="myLumina.teacher_blurb_none">${esc(tx("myLumina.teacher_blurb_none"))}</p>
      <a class="learner-my-link" href="#teacher" data-nav-teacher="1" data-i18n="myLumina.teacher_apply_cta">${esc(tx("myLumina.teacher_apply_cta"))}</a>`;
  }
  return `
    <section class="my-teacher card" style="margin-top:12px; padding:16px; border:1px solid var(--line); border-radius: var(--radius);">
      <h3 class="title" style="margin:0 0 8px; font-size:1rem" data-i18n="myLumina.teacher_section">${esc(tx("myLumina.teacher_section"))}</h3>
      <div class="my-teacher__body">
        ${inner}
      </div>
    </section>
  `;
}

function learnerResumeCardHtml() {
  const resume = readLearnerResume();
  const has = Boolean(resume && resume.lastVisitedAt && resume.entryHash);
  const href = has ? resume.entryHash : LUMINA_DEFAULT_LEARNING_ENTRY_HASH;
  const line = has
    ? esc(tx("learner.resume.last_studied_line", { level: String(resume.level), title: String(resume.lessonTitle) }))
    : "";
  const cardStyle =
    "margin-bottom:14px;padding:14px 16px;border:1px solid var(--line,#e2e8f0);border-radius:var(--radius,12px);background:linear-gradient(135deg,#f8fafc 0%,#fff 100%);";
  if (has) {
    return `
    <section class="learner-resume-card" style="${cardStyle}">
      <h3 class="title" style="margin:0 0 6px;font-size:1.05rem" data-i18n="learner.resume.continue_title">${esc(tx("learner.resume.continue_title"))}</h3>
      <p class="desc" style="margin:0 0 10px;font-size:14px;color:var(--muted,#475569)">${line}</p>
      <a class="auth-submit" style="display:inline-block;text-align:center;text-decoration:none" data-learner-resume-nav="1" href="${esc(href)}" data-i18n="learner.resume.continue_cta">${esc(tx("learner.resume.continue_cta"))}</a>
      <p class="desc" style="margin:10px 0 0;font-size:12px;opacity:0.85" data-i18n="learner.resume.continue_hint">${esc(tx("learner.resume.continue_hint"))}</p>
    </section>`;
  }
  return `
    <section class="learner-resume-card" style="${cardStyle}">
      <h3 class="title" style="margin:0 0 6px;font-size:1.05rem" data-i18n="learner.resume.start_title">${esc(tx("learner.resume.start_title"))}</h3>
      <p class="desc" style="margin:0 0 10px;font-size:14px;color:var(--muted,#475569)" data-i18n="learner.resume.start_subtitle">${esc(tx("learner.resume.start_subtitle"))}</p>
      <a class="auth-submit" style="display:inline-block;text-align:center;text-decoration:none" data-learner-resume-nav="1" href="${esc(href)}" data-i18n="learner.resume.start_cta">${esc(tx("learner.resume.start_cta"))}</a>
      <p class="desc" style="margin:10px 0 0;font-size:12px;opacity:0.85" data-i18n="learner.resume.start_hint">${esc(tx("learner.resume.start_hint"))}</p>
    </section>`;
}

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      ${learnerResumeCardHtml()}
      <section class="card" style="margin-bottom:12px;padding:16px 18px;border:1px solid var(--line,#e2e8f0);border-radius:var(--radius,12px);box-shadow:0 8px 20px rgba(15,23,42,.06)">
        <h3 class="title" style="font-size:1.05rem;margin:0 0 8px" data-i18n="myLearning.review_title">${esc(tx("myLearning.review_title"))}</h3>
        <p class="desc" style="margin:0;font-size:14px;color:var(--muted,#475569);line-height:1.6" data-i18n="myLearning.review_desc">${esc(tx("myLearning.review_desc"))}</p>
      </section>
      <section class="hero">
        <h2 class="title" data-i18n="nav.myLearning">${esc(tx("nav.myLearning"))}</h2>
        <p class="desc" data-i18n="learner.my_page_subtitle">${esc(tx("learner.my_page_subtitle"))}</p>
        <p class="learner-my-quicklinks">
          <a class="learner-my-link" href="#my-content" data-i18n="learner.nav.my_content">My content</a>
          <span class="learner-my-quicksep" aria-hidden="true">·</span>
          <a class="learner-my-link" href="#my-orders" data-i18n="learner.nav.my_orders">My orders</a>
        </p>
        ${getCurrentSessionAuthUser() ? teacherStatusCardHtml() : ""}
      </section>
    </div>
  `;

  i18n.apply?.(app);
  app.querySelectorAll("a[data-learner-resume-nav]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const raw = a.getAttribute("href") || "";
      if (!raw.startsWith("#")) return;
      import("../router.js").then((r) => r.navigateTo(raw, { force: true }));
    });
  });
  app.querySelectorAll('a[href^="#"][data-nav-teacher="1"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const h = a.getAttribute("href") || "";
      const q = h.indexOf("#");
      if (q < 0) return;
      import("../router.js").then((r) => r.navigateTo(h.slice(q), { force: true }));
    });
  });
}
