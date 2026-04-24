// /ui/pages/page.my.js
import { i18n } from "../i18n.js";
import { getCurrentSessionAuthUser, getTeacherNavRoleState } from "../auth/authService.js";
import { safeUiText } from "../lumina-commerce/commerceDisplayLabels.js";

function tx(k) {
  return safeUiText(k);
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

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="card">
      <section class="hero">
        <h2 class="title" data-i18n="my_title">내 학습</h2>
        <p class="desc" data-i18n="coming_soon">
          개인 학습 기록 기능을 준비 중입니다.
        </p>
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
