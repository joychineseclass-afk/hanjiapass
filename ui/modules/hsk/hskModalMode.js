// /ui/modules/hsk/hskModalMode.js
import { modalTpl, createModalSystem } from "../../components/modalBase.js";
import { restoreLastLessonIfNeeded, getCurrentLessonIdSafe } from "./lessonSession.js";

export function enableHSKModalMode() {
  // bind once
  if (document.body.dataset.__hskModalMode === "1") return;
  document.body.dataset.__hskModalMode = "1";

  ensureHSKModalModeCSS();
  const MODALS = ensureHSKGenericModals();

  document.addEventListener(
    "click",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      const btn = t.closest("button, a, [role='tab']");
      if (!btn) return;

      const label = (btn.textContent || "").trim();
      const key = btn.getAttribute("data-tab") || btn.getAttribute("data-key") || "";
      const tab = normalizeTabKey(key, label);
      if (!tab) return;

      // ✅ 恢复/读取 current lesson
      restoreLastLessonIfNeeded();
      const currentLessonId = getCurrentLessonIdSafe();

      if (!currentLessonId) {
        e.preventDefault();
        e.stopPropagation();
        MODALS.generic.open({
          title: "레슨을 먼저 선택해주세요",
          subtitle: "수업을 선택해야 회화/문법/연습/AI를 열 수 있어요.",
          html: `<div class="text-sm text-gray-600">레슨을 먼저 클릭해 주세요.</div>`,
        });
        return;
      }

      // ✅ 有课：拦截默认行为 → 只用弹窗
      e.preventDefault();
      e.stopPropagation();

      suppressInlineLessonArea();

      // ✅ 优先走 StepRunner/Engine
      if (typeof window.joyOpenStep === "function") {
        window.joyOpenStep(tab, currentLessonId);
        return;
      }

      // fallback（不推荐常用，但保证不崩）
      MODALS.generic.open({
        title: "학습",
        subtitle: `lessonId: ${currentLessonId}`,
        html: `<div class="text-sm text-gray-600">joyOpenStep가 없습니다. StepRunner를 먼저 로드해주세요.</div>`,
      });
    },
    true
  );
}

/* -----------------------------
   CSS: hide inline lesson content
------------------------------ */
function ensureHSKModalModeCSS() {
  const id = "__hsk_modal_mode_css__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    #lessonContent, #hskLessonContent, #hskContent, #tabContent,
    .lesson-content, .hsk-lesson-content, .tab-content, .hsk-tab-content,
    #dialogueContent, #grammarContent, #practiceContent, #aiContent {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/* -----------------------------
   Generic Modals
------------------------------ */
function ensureHSKGenericModals() {
  if (window.__HSK_GENERIC_MODALS) return window.__HSK_GENERIC_MODALS;

  let portal = document.getElementById("portal-root");
  if (!portal) {
    portal = document.createElement("div");
    portal.id = "portal-root";
    document.body.appendChild(portal);
  }

  const root = document.createElement("div");
  root.id = "hsk-generic-modals-root";
  root.innerHTML = `
    ${modalTpl({ id:"hsk-generic-modal", titleId:"hskGenTitle", backId:"hskGenBack", closeId:"hskGenClose", bodyId:"hskGenBody", titleText:"", maxWidth: 860 })}
  `;
  portal.appendChild(root);

  const generic = createModalSystem(root, {
    id: "hsk-generic-modal",
    titleId: "hskGenTitle",
    backId: "hskGenBack",
    closeId: "hskGenClose",
    bodyId: "hskGenBody",
    lockScroll: true,
    escClose: true,
  });

  ensureGenericModalCSS();

  window.__HSK_GENERIC_MODALS = {
    generic: {
      open: ({ title, subtitle, html }) => {
        generic.setTitle(title || "");
        generic.body.innerHTML = `
          <div class="p-4">
            ${subtitle ? `<div class="text-sm text-gray-500 mb-3">${escapeHTML(subtitle)}</div>` : ""}
            ${html || ""}
          </div>
        `;
        generic.open();
      },
      close: () => generic.close(),
    },
  };

  return window.__HSK_GENERIC_MODALS;
}

function ensureGenericModalCSS() {
  const id = "__hsk_generic_modal_css__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    #hsk-generic-modal{
      position: fixed !important;
      inset: 0 !important;
      z-index: 99999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 24px !important;
      background: rgba(0,0,0,0.62) !important;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    #hsk-generic-modal.joy-modal-hidden{
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/* -----------------------------
   Hide inline content area (runtime)
------------------------------ */
function suppressInlineLessonArea() {
  const known =
    document.getElementById("lessonContent") ||
    document.getElementById("hskLessonContent") ||
    document.getElementById("hskContent") ||
    document.querySelector(".lesson-content") ||
    document.querySelector(".hsk-lesson-content") ||
    null;

  if (known) {
    known.style.display = "none";
    return;
  }

  const tabBar = findHSKTabBar();
  if (tabBar) {
    const content = findNextBlock(tabBar);
    if (content) content.style.display = "none";
  }
}

function findHSKTabBar() {
  const labels = ["단어", "회화", "문법", "연습", "AI"];
  const candidates = Array.from(document.querySelectorAll("div, nav, section"));
  for (const el of candidates) {
    const txt = (el.textContent || "").trim();
    if (!txt) continue;
    if (labels.every((x) => txt.includes(x))) return el;
  }
  return null;
}

function findNextBlock(el) {
  let cur = el;
  for (let i = 0; i < 5 && cur; i++) {
    const next = cur.nextElementSibling;
    if (next && next.getBoundingClientRect && next.getBoundingClientRect().height > 40) return next;
    cur = cur.parentElement;
  }
  return null;
}

function normalizeTabKey(key, label) {
  const k = String(key || "").toLowerCase();
  const L = String(label || "").trim();

  if (k === "words" || L === "단어" || L === "词" || L === "单词") return "words";
  if (k === "dialogue" || L === "회화" || L === "会话" || L === "對話" || L === "对话") return "dialogue";
  if (k === "grammar" || L === "문법" || L === "语法") return "grammar";
  if (k === "practice" || L === "연습" || L === "练习") return "practice";
  if (k === "ai" || L === "AI" || L.toLowerCase() === "ai") return "ai";
  return "";
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
