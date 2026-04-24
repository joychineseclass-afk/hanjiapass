// /ui/pages/page.resources.js — 资料与拓展：收纳笔顺/汉字/文化/复习及会话子入口，降低一级导航堆叠
import { i18n } from "../i18n.js";
import { demoBannerHtml } from "../components/demoBanner.js";

function t(key) {
  try {
    const v = i18n?.t?.(key);
    if (v == null) return key;
    const s = String(v).trim();
    if (!s || s === key) return key;
    return s;
  } catch {
    return key;
  }
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function mount() {
  const app = document.getElementById("app");
  if (!app) return;

  const hubTitle = t("resourceHub.title");
  const hubLead = t("resourceHub.lead");
  const secScript = t("resourceHub.section_script");
  const secPrac = t("resourceHub.section_practice");
  const secSpeak = t("resourceHub.section_speaking");
  const speakNote = t("resourceHub.speaking_note");

  app.innerHTML = `
    <div class="resource-hub wrap" style="max-width:var(--max,1120px);margin:0 auto;padding:12px 16px 24px">
      ${demoBannerHtml("resources")}
      <header class="card" style="padding:16px 18px;margin-bottom:12px">
        <h1 class="title" style="font-size:1.35rem;margin:0 0 8px" data-i18n="resourceHub.title">${esc(hubTitle)}</h1>
        <p class="desc" style="margin:0;color:var(--muted,#475569);line-height:1.6" data-i18n="resourceHub.lead">${esc(hubLead)}</p>
      </header>

      <section class="card" style="padding:16px 18px;margin-bottom:12px">
        <h2 class="title" style="font-size:1.05rem;margin:0 0 10px" data-i18n="resourceHub.section_script">${esc(secScript)}</h2>
        <ul style="margin:0;padding:0;list-style:none;display:grid;gap:8px">
          <li><a class="teacher-hub-cta" style="display:inline-block;text-align:center" href="#hanja" data-i18n="resourceHub.link_hanja">${esc(
            t("resourceHub.link_hanja"),
          )}</a> — <span data-i18n="nav.hanja">${esc(t("nav.hanja"))}</span></li>
          <li><a class="teacher-hub-cta" style="display:inline-block;text-align:center" href="#stroke" data-i18n="resourceHub.link_stroke">${esc(
            t("resourceHub.link_stroke"),
          )}</a> — <span data-i18n="nav.stroke">${esc(t("nav.stroke"))}</span></li>
        </ul>
      </section>

      <section class="card" style="padding:16px 18px;margin-bottom:12px">
        <h2 class="title" style="font-size:1.05rem;margin:0 0 10px" data-i18n="resourceHub.section_practice">${esc(secPrac)}</h2>
        <ul style="margin:0;padding:0;list-style:none;display:grid;gap:8px">
          <li><a class="teacher-hub-cta teacher-hub-cta--secondary" style="display:inline-block;text-align:center" href="#culture" data-i18n="resourceHub.link_culture">${esc(
            t("resourceHub.link_culture"),
          )}</a></li>
          <li><a class="teacher-hub-cta teacher-hub-cta--secondary" style="display:inline-block;text-align:center" href="#review" data-i18n="resourceHub.link_review">${esc(
            t("resourceHub.link_review"),
          )}</a></li>
        </ul>
      </section>

      <section class="card" style="padding:16px 18px">
        <h2 class="title" style="font-size:1.05rem;margin:0 0 8px" data-i18n="resourceHub.section_speaking">${esc(secSpeak)}</h2>
        <p class="desc" style="margin:0 0 10px;font-size:14px;color:var(--muted,#475569)" data-i18n="resourceHub.speaking_note">${esc(
          speakNote,
        )}</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <a class="teacher-hub-cta" href="#speaking?tab=travel" data-i18n="resourceHub.link_speaking_travel">${esc(
            t("resourceHub.link_speaking_travel"),
          )}</a>
          <a class="teacher-hub-cta" href="#speaking?tab=business" data-i18n="resourceHub.link_speaking_business">${esc(
            t("resourceHub.link_speaking_business"),
          )}</a>
          <a class="teacher-hub-cta teacher-hub-cta--secondary" href="#speaking?tab=daily" data-i18n="resourceHub.link_speaking_daily">${esc(
            t("resourceHub.link_speaking_daily"),
          )}</a>
        </div>
      </section>
    </div>
  `;

  i18n.apply?.(app);
  app.querySelectorAll('a[href^="#speaking?"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const h = a.getAttribute("href") || "";
      if (!h.startsWith("#")) return;
      import("../router.js").then((r) => r.navigateTo(h, { force: true }));
    });
  });
}
