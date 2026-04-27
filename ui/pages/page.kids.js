// /ui/pages/page.kids.js
// ✅ Kids 课程域主页 — 统一平台风格
// ✅ 全部文案走 i18n，支持 KR/CN/EN/JP
// ✅ 语言切换后完整 rerender

import { i18n } from "../i18n.js";

const STYLE_ID = "lumina-kids-style";
let _bound = false;

function t(key, fallback = "") {
  try {
    const v = i18n?.t?.(key);
    if (v == null) return fallback;
    const s = String(v).trim();
    if (!s || s === key || s === `[${key}]`) return fallback;
    return s;
  } catch {
    return fallback;
  }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .lumina-kids{ background: var(--soft,#f8fafc); color: var(--text,#0f172a); }
    .lumina-kids .wrap{ max-width: var(--max,1120px); margin:0 auto; padding:0 16px; }
    .lumina-kids .section{ padding:10px 0 18px; }
    .lumina-kids .card{ background:rgba(255,255,255,.72); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.45); border-radius:calc(var(--radius,18px) + 8px); box-shadow:0 20px 50px rgba(0,0,0,.08); overflow:hidden; }
    .lumina-kids .inner{ padding:18px; display:grid; gap:12px; }
    .lumina-kids .page-title{ margin:0; font-size:24px; font-weight:900; letter-spacing:-0.3px; }
    .lumina-kids .page-desc{ margin:0; color:var(--muted,#475569); font-size:15px; line-height:1.6; }
    .lumina-kids .section-title{ margin:0; font-size:16px; font-weight:800; }
    .lumina-kids .card-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
    .lumina-kids .course-card{ padding:16px; border:1px solid var(--line,#e2e8f0); border-radius:14px; background:#fff; transition:transform .15s, box-shadow .15s; }
    .lumina-kids .course-card:hover{ transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.08); }
    .lumina-kids .course-card .card-title{ font-weight:800; font-size:15px; margin-bottom:4px; }
    .lumina-kids .course-card .card-desc{ font-size:13px; color:var(--muted,#475569); }
    .lumina-kids .badge{ font-size:12px; font-weight:800; color:#ec4899; background:rgba(236,72,153,.12); border:1px solid rgba(236,72,153,.2); padding:6px 10px; border-radius:999px; width:fit-content; }
  `;
  document.head.appendChild(style);
}

function renderKids(root) {
  ensureStyles();
  const homeTitle = t("kids.homeTitle", "Kids Chinese");
  const homeSubtitle = t("kids.homeSubtitle", "Learn Chinese with fun");
  const stageBasic = t("kids.stageBasic", "Beginner Stage");
  const book1Title = t("kids.book1Title", "Kids Book 1");
  const book1Desc = t("kids.book1Desc", "8 lessons · Core · Dialogue · Extra · Practice · AI Tutor");
  const comingSoon = t("kids.comingSoon", "Coming Soon");
  const basicTitle = t("kids.basicChineseTitle", "Basic Chinese");
  const basicDesc = t("kids.basicChineseDesc", "Coming Soon");
  const pinyinTitle = t("kids.pinyinIntroTitle", "Pinyin Intro");
  const pinyinDesc = t("kids.pinyinIntroDesc", "Coming Soon");
  const conversation = t("kids.conversation", "Conversation & songs");
  const pictureTalk = t("kids.pictureTalk", "Picture expression");
  const songs = t("kids.songs", "Songs");
  const story = t("kids.story", "Picture talk");

  root.innerHTML = `
    <div class="lumina-kids">
      <section class="section">
        <div class="wrap">
          <div class="card">
            <div class="inner">
              <span class="badge">${escapeHtml(t("nav.kids", "Kids"))}</span>
              <h1 class="page-title">${escapeHtml(homeTitle)}</h1>
              <p class="page-desc">${escapeHtml(homeSubtitle)}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <h2 class="section-title">${escapeHtml(stageBasic)}</h2>
          <div class="card-grid">
            <a href="#kids-kids1" class="course-card" style="text-decoration:none; color:inherit;">
              <div class="card-title">${escapeHtml(book1Title)}</div>
              <div class="card-desc">${escapeHtml(book1Desc)}</div>
            </a>
            <div class="course-card">
              <div class="card-title">${escapeHtml(basicTitle)}</div>
              <div class="card-desc">${escapeHtml(basicDesc)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(pinyinTitle)}</div>
              <div class="card-desc">${escapeHtml(pinyinDesc)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(conversation)}</div>
              <div class="card-desc">${escapeHtml(songs)} · ${escapeHtml(comingSoon)}</div>
            </div>
            <div class="course-card">
              <div class="card-title">${escapeHtml(pictureTalk)}</div>
              <div class="card-desc">${escapeHtml(story)} · ${escapeHtml(comingSoon)}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** 与 router normalizeHash 一致：仅取 # 后第一段，忽略 query（避免语言切换时误渲染其它路由） */
function routeBaseForKidsGuard() {
  const raw = String(location.hash || "").trim();
  if (!raw) return "#home";
  const noQuery = raw.includes("?") ? raw.slice(0, raw.indexOf("?")) : raw;
  const withHash = noQuery.startsWith("#") ? noQuery : `#${noQuery}`;
  const slash = withHash.indexOf("/", 1);
  return (slash > 0 ? withHash.slice(0, slash) : withHash).toLowerCase();
}

function bindLiveRerender(root) {
  if (_bound) return;
  _bound = true;
  const rerender = () => {
    if (routeBaseForKidsGuard() !== "#kids") return;
    const el = root?.isConnected ? root : document.getElementById("app");
    if (!el) return;
    renderKids(el);
  };
  window.addEventListener("joy:langChanged", rerender);
  try { i18n?.on?.("change", rerender); } catch {}
  try { i18n?.onChange?.(rerender); } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key === "joy_lang" || e.key === "site_lang") rerender();
  });
}

export default function pageKids(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;
  bindLiveRerender(root);
  renderKids(root);
}

export function mount(ctxOrRoot) { return pageKids(ctxOrRoot); }
export function render(ctxOrRoot) { return pageKids(ctxOrRoot); }
