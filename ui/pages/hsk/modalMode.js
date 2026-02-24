// /ui/pages/hsk/modalMode.js
import { modalTpl, createModalSystem } from "../../components/modalBase.js";
import { restoreLastLessonToGlobals, getCurrentLessonIdSafe } from "./state.js";
import { escapeHTML, normalizeTabKey, pickTextAny, renderListBlock } from "./utils.js";

export function enableHSKModalMode({ onOpenStep } = {}) {
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

      restoreLastLessonToGlobals();
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

      e.preventDefault();
      e.stopPropagation();

      suppressInlineLessonArea();

      // ✅ 优先走 StepRunner/Engine（由 page.hsk.js 注入）
      if (typeof onOpenStep === "function") {
        onOpenStep(tab, currentLessonId);
        return;
      }

      // fallback：用当前 lessonData 打开
      const cur = window.__HSK_CURRENT_LESSON || {};
      const lessonData = cur?.lessonData || {};
      const lv = cur?.lv || "";
      const version = cur?.version || "";
      const titleBase = pickTextAny(lessonData?.title) || "학습";
      const subtitle = `HSK ${lv} · ${version}`;

      if (tab === "grammar") {
        const grammar = lessonData?.grammar || lessonData?.grammarPoints || [];
        MODALS.grammar.open({ title: `${titleBase} · 문법`, subtitle, data: grammar });
        return;
      }
      if (tab === "practice") {
        const practice = lessonData?.practice || lessonData?.exercises || [];
        MODALS.practice.open({ title: `${titleBase} · 연습`, subtitle, data: practice });
        return;
      }
      if (tab === "ai") {
        MODALS.ai.open({ title: `${titleBase} · AI`, subtitle, lessonData });
        return;
      }
      if (tab === "words") {
        document.querySelector("#hskGrid")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        MODALS.generic.open({
          title: `${titleBase} · 단어`,
          subtitle,
          html: `<div class="text-sm text-gray-600">단어는 아래 카드에서 학습해요.</div>`,
        });
        return;
      }

      // dialogue：你如果要接你现有 DIALOGUE_PANEL，这里再加
      if (tab === "dialogue") {
        MODALS.generic.open({
          title: `${titleBase} · 회화`,
          subtitle,
          html: `<div class="text-sm text-gray-600">회화 모달 연결 예정</div>`,
        });
        return;
      }
    },
    true
  );
}

/* CSS + Modals + helpers 下面保持你原来的即可 */

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
    ${modalTpl({ id:"hsk-grammar-modal", titleId:"hskGrammarTitle", backId:"hskGrammarBack", closeId:"hskGrammarClose", bodyId:"hskGrammarBody", titleText:"문법", maxWidth: 860 })}
    ${modalTpl({ id:"hsk-practice-modal", titleId:"hskPracticeTitle", backId:"hskPracticeBack", closeId:"hskPracticeClose", bodyId:"hskPracticeBody", titleText:"연습", maxWidth: 860 })}
    ${modalTpl({ id:"hsk-ai-modal", titleId:"hskAiTitle", backId:"hskAiBack", closeId:"hskAiClose", bodyId:"hskAiBody", titleText:"AI", maxWidth: 860 })}
  `;
  portal.appendChild(root);

  const generic = createModalSystem(root, { id:"hsk-generic-modal", titleId:"hskGenTitle", backId:"hskGenBack", closeId:"hskGenClose", bodyId:"hskGenBody", lockScroll:true, escClose:true });
  const grammar = createModalSystem(root, { id:"hsk-grammar-modal", titleId:"hskGrammarTitle", backId:"hskGrammarBack", closeId:"hskGrammarClose", bodyId:"hskGrammarBody", lockScroll:true, escClose:true });
  const practice = createModalSystem(root, { id:"hsk-practice-modal", titleId:"hskPracticeTitle", backId:"hskPracticeBack", closeId:"hskPracticeClose", bodyId:"hskPracticeBody", lockScroll:true, escClose:true });
  const ai = createModalSystem(root, { id:"hsk-ai-modal", titleId:"hskAiTitle", backId:"hskAiBack", closeId:"hskAiClose", bodyId:"hskAiBody", lockScroll:true, escClose:true });

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
    },
    grammar: {
      open: ({ title, subtitle, data }) => {
        grammar.setTitle(title || "문법");
        grammar.body.innerHTML = renderListBlock(subtitle, data, "문법 데이터가 없어요.");
        grammar.open();
      },
    },
    practice: {
      open: ({ title, subtitle, data }) => {
        practice.setTitle(title || "연습");
        practice.body.innerHTML = renderListBlock(subtitle, data, "연습 데이터가 없어요.");
        practice.open();
      },
    },
    ai: {
      open: ({ title, subtitle }) => {
        ai.setTitle(title || "AI");
        ai.body.innerHTML = `<div class="p-4">${subtitle ? `<div class="text-sm text-gray-500 mb-3">${escapeHTML(subtitle)}</div>` : ""}AI panel</div>`;
        ai.open();
      },
    },
  };

  return window.__HSK_GENERIC_MODALS;
}

function suppressInlineLessonArea() {
  const known =
    document.getElementById("lessonContent") ||
    document.getElementById("hskLessonContent") ||
    document.getElementById("hskContent") ||
    document.querySelector(".lesson-content") ||
    document.querySelector(".hsk-lesson-content") ||
    null;

  if (known) known.style.display = "none";
}
