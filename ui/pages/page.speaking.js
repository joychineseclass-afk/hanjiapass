// /ui/pages/page.speaking.js
// 会话模块：左侧日常 / 商务 / 旅游，右侧说明与主题占位

import { i18n } from "../i18n.js";

const SHELL_CLASS = "lumina-speaking-module-shell";
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

function getConversationBaseFromLocation() {
  const raw = String(location.hash || "").toLowerCase();
  const base = raw.split("?")[0].split("/")[0];
  if (base === "#speaking") return "#speaking";
  if (base === "#conversation") return "#conversation";
  return "#conversation";
}

function isConversationHashRoute() {
  const raw = String(location.hash || "").toLowerCase();
  const base = raw.split("?")[0].split("/")[0];
  return base === "#speaking" || base === "#conversation";
}

function parseSpeakingTab() {
  const raw = String(location.hash || "").toLowerCase();
  if (!isConversationHashRoute()) return "daily";
  const q = raw.indexOf("?");
  if (q < 0) return "daily";
  try {
    const tab = String(new URLSearchParams(raw.slice(q + 1)).get("tab") || "daily").toLowerCase();
    if (tab === "daily" || tab === "business" || tab === "travel") return tab;
  } catch {
    /* */
  }
  return "daily";
}

function navLink(tab, current, label) {
  const href = `${getConversationBaseFromLocation()}?tab=${tab}`;
  const safe = escapeHtml(label);
  if (current === tab) {
    return `<span class="teacher-shell-nav-link teacher-shell-nav-link--current" aria-current="page">${safe}</span>`;
  }
  return `<a class="teacher-shell-nav-link" href="${href}">${safe}</a>`;
}

function topicsList(key, fallbackLines) {
  const text = t(key, fallbackLines);
  const items = String(text)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!items.length) return "";
  const lis = items.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `<ul class="desc" style="margin:10px 0 0 1.1em;padding:0;line-height:1.65">${lis}</ul>`;
}

function mainHtml(tab) {
  if (tab === "business") {
    return `
      <div class="card" style="margin:0">
        <div class="hero" style="padding:18px 20px">
          <div class="title" style="font-size:clamp(20px,2.4vw,24px)">${escapeHtml(t("speaking.business_title", "商务会话"))}</div>
          <p class="desc" style="margin:8px 0 0">${escapeHtml(t("speaking.business_lead", "职场与商务场景常用表达。"))}</p>
          ${topicsList(
            "speaking.business_topics",
            ["商务问候", "会议交流", "邮件/电话表达"].join("\n"),
          )}
          <p class="desc" style="margin-top:14px;opacity:.9">${escapeHtml(t("speaking.section_placeholder", "系统内容将陆续扩展。"))}</p>
        </div>
      </div>`;
  }
  if (tab === "travel") {
    return `
      <div class="card" style="margin:0">
        <div class="hero" style="padding:18px 20px">
          <div class="title" style="font-size:clamp(20px,2.4vw,24px)">${escapeHtml(t("speaking.travel_title", "旅游会话"))}</div>
          <p class="desc" style="margin:8px 0 0">${escapeHtml(t("speaking.travel_lead", "出行常见场景口语。"))}</p>
          ${topicsList(
            "speaking.travel_topics",
            ["酒店", "机场", "交通", "景点", "餐馆"].join("\n"),
          )}
          <p class="desc" style="margin-top:14px;opacity:.9">${escapeHtml(t("speaking.section_placeholder", "系统内容将陆续扩展。"))}</p>
        </div>
      </div>`;
  }
  return `
    <div class="card" style="margin:0">
      <div class="hero" style="padding:18px 20px">
        <div class="title" style="font-size:clamp(20px,2.4vw,24px)">${escapeHtml(t("speaking.daily_title", "日常会话"))}</div>
        <p class="desc" style="margin:8px 0 0">${escapeHtml(t("speaking.daily_lead", "生活中最常用的口语场景。"))}</p>
        ${topicsList(
          "speaking.daily_topics",
          ["打招呼", "自我介绍", "购物", "点餐", "问路"].join("\n"),
        )}
        <p class="desc" style="margin-top:14px;opacity:.9">${escapeHtml(t("speaking.section_placeholder", "系统内容将陆续扩展。"))}</p>
      </div>
    </div>`;
}

function shellHtml(currentTab) {
  const brand = escapeHtml(t("speaking.sidebar_title", "会话"));
  const aria = escapeHtml(t("speaking.nav_aria", "会话分区"));
  const daily = navLink("daily", currentTab, t("speaking.tab_daily", "日常会话"));
  const business = navLink("business", currentTab, t("speaking.tab_business", "商务会话"));
  const travel = navLink("travel", currentTab, t("speaking.tab_travel", "旅游会话"));
  const main = mainHtml(currentTab);
  return `
    <div class="teacher-shell wrap ${SHELL_CLASS}">
      <aside class="teacher-shell-sidebar">
        <div class="teacher-shell-brand">
          <span class="teacher-shell-brand-text">${brand}</span>
        </div>
        <nav class="teacher-shell-nav" aria-label="${aria}">
          ${daily}
          ${business}
          ${travel}
        </nav>
      </aside>
      <div class="teacher-shell-main">
        <div class="teacher-main" data-speaking-main>
          ${main}
        </div>
      </div>
    </div>`;
}

function renderSpeaking(root) {
  const tab = parseSpeakingTab();
  root.innerHTML = shellHtml(tab);
}

function bindHashAndLang() {
  if (!_hashBound) {
    _hashBound = true;
    window.addEventListener("hashchange", () => {
      if (!isConversationHashRoute()) return;
      const root = document.getElementById("app");
      if (!root?.querySelector(`.${SHELL_CLASS}`)) return;
      renderSpeaking(root);
    });
  }
  if (!_langBound) {
    _langBound = true;
    const rerender = () => {
      if (!isConversationHashRoute()) return;
      const root = document.getElementById("app");
      if (!root?.querySelector(`.${SHELL_CLASS}`)) return;
      renderSpeaking(root);
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

export default function pageSpeaking(ctxOrRoot) {
  const root = ctxOrRoot?.root || ctxOrRoot?.app || (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) || document.getElementById("app");
  if (!root) return;
  bindHashAndLang();
  renderSpeaking(root);
}

export function mount(ctxOrRoot) {
  return pageSpeaking(ctxOrRoot);
}
export function render(ctxOrRoot) {
  return pageSpeaking(ctxOrRoot);
}
