// /ui/pages/page.examLearning.js
// 考试学术模块壳：左侧 HSK / HSKK / YCT，右侧内容（HSK 复用 page.hsk 嵌入挂载）

import { i18n } from "../i18n.js";
import { stopAllLearningAudio } from "../platform/audio/stopAllLearningAudio.js";

const SHELL_CLASS = "lumina-exam-learning-shell";
let _hashBound = false;
let _langBound = false;

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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getExamBaseFromLocation() {
  const raw = String(location.hash || "").toLowerCase();
  const base = raw.split("?")[0].split("/")[0];
  if (base === "#exam-learning") return "#exam-learning";
  if (base === "#exam") return "#exam";
  return "#exam";
}

function isExamHashRoute() {
  const raw = String(location.hash || "").toLowerCase();
  const base = raw.split("?")[0].split("/")[0];
  return base === "#exam" || base === "#exam-learning";
}

function parseExamTab() {
  const raw = String(location.hash || "").toLowerCase();
  if (!isExamHashRoute()) return "hsk";
  const q = raw.indexOf("?");
  if (q < 0) return "hsk";
  try {
    const tab = String(new URLSearchParams(raw.slice(q + 1)).get("tab") || "hsk").toLowerCase();
    if (tab === "hsk" || tab === "hskk" || tab === "yct") return tab;
  } catch {
    /* */
  }
  return "hsk";
}

function navLink(tab, current, label) {
  const href = `${getExamBaseFromLocation()}?tab=${tab}`;
  const safe = escapeHtml(label);
  if (current === tab) {
    return `<span class="teacher-shell-nav-link teacher-shell-nav-link--current" aria-current="page">${safe}</span>`;
  }
  return `<a class="teacher-shell-nav-link" href="${href}">${safe}</a>`;
}

function placeholderCard(title, lead, bodyHtml) {
  return `
    <div class="card" style="margin:0">
      <div class="hero" style="padding:18px 20px">
        <div class="title" style="font-size:clamp(20px,2.4vw,24px)">${escapeHtml(title)}</div>
        <p class="desc" style="margin:8px 0 0">${escapeHtml(lead)}</p>
        <div class="desc" style="margin-top:14px;line-height:1.65">${bodyHtml}</div>
      </div>
    </div>`;
}

function renderPlaceholder(tab) {
  if (tab === "hskk") {
    return placeholderCard(
      t("examLearning.hskk_title", "HSKK"),
      t("examLearning.hskk_lead", "汉语水平口语考试学习区。"),
      `<p class="desc" style="opacity:.9">${escapeHtml(t("examLearning.hskk_placeholder", "内容陆续上线，可先使用左侧 HSK 系统课。"))}</p>`,
    );
  }
  if (tab === "yct") {
    return placeholderCard(
      t("examLearning.yct_title", "YCT"),
      t("examLearning.yct_lead", "儿童汉语考试（YCT）入门与等级学习区。"),
      `<p class="desc" style="opacity:.9">${escapeHtml(t("examLearning.yct_placeholder", "内容陆续上线。"))}</p>`,
    );
  }
  return "";
}

function shellHtml(currentTab) {
  const brand = escapeHtml(t("examLearning.sidebar_title", "考试学术"));
  const aria = escapeHtml(t("examLearning.nav_aria", "考试学习分区"));
  const hsk = navLink("hsk", currentTab, t("examLearning.tab_hsk", "HSK"));
  const hskk = navLink("hskk", currentTab, t("examLearning.tab_hskk", "HSKK"));
  const yct = navLink("yct", currentTab, t("examLearning.tab_yct", "YCT"));
  return `
    <div class="teacher-shell wrap ${SHELL_CLASS}">
      <aside class="teacher-shell-sidebar">
        <div class="teacher-shell-brand">
          <span class="teacher-shell-brand-text">${brand}</span>
        </div>
        <nav class="teacher-shell-nav" aria-label="${aria}">
          ${hsk}
          ${hskk}
          ${yct}
        </nav>
      </aside>
      <div class="teacher-shell-main">
        <div class="teacher-main" data-exam-main></div>
      </div>
    </div>`;
}

async function fillMain(mainEl, tab) {
  if (!mainEl) return;
  if (tab === "hsk") {
    const { mount: mountHsk, abortHskBoundEvents } = await import("./page.hsk.js");
    abortHskBoundEvents?.();
    stopAllLearningAudio();
    await mountHsk({ root: mainEl, embed: true });
    return;
  }
  const { abortHskBoundEvents } = await import("./page.hsk.js");
  abortHskBoundEvents?.();
  stopAllLearningAudio();
  mainEl.innerHTML = renderPlaceholder(tab);
}

async function renderExam(root) {
  const tab = parseExamTab();
  root.innerHTML = shellHtml(tab);
  const main = root.querySelector("[data-exam-main]");
  await fillMain(main, tab);
}

function bindHashAndLang() {
  if (_hashBound) {
    /* */
  } else {
    _hashBound = true;
    window.addEventListener("hashchange", async () => {
      if (!isExamHashRoute()) return;
      const root = document.getElementById("app");
      if (!root?.querySelector(`.${SHELL_CLASS}`)) return;
      try {
        const { abortHskBoundEvents } = await import("./page.hsk.js");
        abortHskBoundEvents?.();
      } catch {
        /* */
      }
      stopAllLearningAudio();
      await renderExam(root);
    });
  }

  if (!_langBound) {
    _langBound = true;
    const rerender = async () => {
      if (!isExamHashRoute()) return;
      const root = document.getElementById("app");
      if (!root?.querySelector(`.${SHELL_CLASS}`)) return;
      await renderExam(root);
    };
    window.addEventListener("joy:langChanged", rerender);
    try {
      i18n?.on?.("change", rerender);
    } catch {
      /* */
    }
    try {
      i18n?.onChange?.(rerender);
    } catch {
      /* */
    }
  }
}

export default async function pageExamLearning(ctx) {
  const root = ctx?.root || document.getElementById("app");
  if (!root) return;
  bindHashAndLang();
  await renderExam(root);
}

export async function mount(ctx) {
  return pageExamLearning(ctx);
}
