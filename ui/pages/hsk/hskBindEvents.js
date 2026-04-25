// HSK 页面事件委托与监听（从 page.hsk.js 整块抽离，保持行为不变；见《Lumina HSK 页面巨石文件拆分 Step 2》）
import { i18n } from "../../i18n.js";
import { renderLessonList } from "../../modules/hsk/hskRenderer.js";
import {
  PROGRESS_ENGINE,
  PROGRESS_SELECTORS,
  AUDIO_ENGINE,
  renderReviewMode,
  prepareReviewSession,
  stopAllLearningAudio,
  playSingleText,
  TTS_SCOPE,
} from "../../platform/index.js";
import { practiceLangKeyFromUiLang, escapeHtml } from "./hskPageUtils.js";
import {
  getDialogueCards as _getDialogueCards,
  pickDialogueTranslation as _pickDialogueTranslation,
  dialogueSessionIntroTts as _dialogueSessionIntroTts,
} from "./hskDialogueTab.js";
import {
  getGrammarPointsArray as _getGrammarPointsArray,
  buildGrammarSpeakSegments as _buildGrammarSpeakSegments,
} from "./hskGrammarTab.js";
import {
  getExtensionItemsArray as _getExtensionItemsArray,
  buildExtensionFlatSpeakSegments as _buildExtensionFlatSpeakSegments,
  buildExtensionGroupSpeakSegments as _buildExtensionGroupSpeakSegments,
} from "./hskExtensionTab.js";
import {
  rerenderHskPractice,
  buildPracticeSpeakSegmentsUnified as _buildPracticeSpeakSegmentsUnified,
  resolvePracticeQuestionsForSpeak as _resolvePracticeQuestionsForSpeak,
} from "./hskPracticeTab.js";

let hskPageEventsController = null;

/**
 * 释放 HSK 页内监听（重复 mount 或嵌入切页时调用）。
 * page.hsk.js 对外仍导出为 abortHskBoundEvents。
 */
export function abortHskPageEvents() {
  try {
    hskPageEventsController?.abort();
  } catch {
    /* */
  }
  hskPageEventsController = null;
}

/**
 * 注册原 page.hsk.js 中 `bindEvents` 的全部事件逻辑。
 * `ctx` 由 page.hsk.js 注入：含 `$`、`state`、语言/重绘/进度等闭包，事件模块不自行 load lesson。
 */
export function bindHskPageEvents(ctx) {
  if (!ctx || typeof ctx !== "object") return;

  abortHskPageEvents();
  hskPageEventsController = new AbortController();
  const { signal } = hskPageEventsController;

  const {
    $,
    state,
    getLang,
    getCourseId,
    loadLessons,
    openLesson,
    showListMode,
    updateProgressBlock,
    updateTabsUI,
    shouldUseCompactLearnVocabLayout,
    shouldUseHsk30Hsk1SpeakPilot,
    isHSKPageActive,
    refreshBlueprintDisplayTitles,
    resolveBlueprintTitle,
    setSubTitle,
    rerenderHSKFromState,
  } = ctx;

  let el;

  // ===== Level change =====
  el = $("hskLevel");
  if (el) {
    el.addEventListener(
      "change",
      async function (e) {
        state.lv = Number(e.target.value || 1);
        showListMode();
        await loadLessons();
        updateProgressBlock();
      },
      { signal }
    );
  }

  // ===== Version change =====
  el = $("hskVersion");
  if (el) {
    el.addEventListener(
      "change",
      async function (e) {
        const ver =
          (window.HSK_LOADER &&
            typeof window.HSK_LOADER.normalizeVersion === "function"
            ? window.HSK_LOADER.normalizeVersion(e.target.value)
            : null) ||
          (e.target.value === "hsk3.0" ? "hsk3.0" : "hsk2.0");

        state.version = ver;

        try {
          if (
            window.HSK_LOADER &&
            typeof window.HSK_LOADER.setVersion === "function"
          ) {
            window.HSK_LOADER.setVersion(ver);
          }
        } catch {}

        await loadLessons();
        updateProgressBlock();

        if (state.current && state.current.lessonData) {
          const { lessonNo, file } = state.current;
          await openLesson({ lessonNo, file });
        } else {
          showListMode();
        }
      },
      { signal }
    );
  }

  // ===== Back to list =====
  el = $("hskBackToList");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        showListMode();
        const wrap = $("hskLessonListWrap");
        if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      { signal }
    );
  }

  // ===== Review mode =====
  function enterReviewMode(mode, lessonId = "", levelKey = "") {
    stopAllLearningAudio();
    const container = $("hskReviewContainer");
    if (!container || !renderReviewMode) return;

    const { session, questions } = prepareReviewSession({
      mode,
      lessonId,
      levelKey,
    });

    if (!questions.length) {
      container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(
        i18n.t("review_no_wrong_questions")
      )}</p></div>`;
      container.classList.remove("hidden");
      return;
    }

    container.classList.remove("hidden");

    renderReviewMode(container, session, {
      lang: getLang(),
      onFinish: ({ action }) => {
        if (action === "back") {
          container.classList.add("hidden");
          container.innerHTML = "";
        } else if (action === "continue") {
          const next = prepareReviewSession({ mode, lessonId, levelKey });
          if (!next.questions.length) {
            container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(
              i18n.t("review_no_wrong_questions")
            )}</p></div>`;
            return;
          }
          renderReviewMode(container, next.session, {
            lang: getLang(),
            onFinish: ({ action: nextAction }) => {
              if (nextAction === "back") {
                container.classList.add("hidden");
                container.innerHTML = "";
              }
            },
          });
        }
      },
    });

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  el = $("hskReviewLesson");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        const lessonId =
          (state.current &&
            state.current.lessonData &&
            state.current.lessonData.id) ||
          (state.current
            ? getCourseId() + "_lesson" + state.current.lessonNo
            : "");

        if (!lessonId) {
          const stats =
            (PROGRESS_SELECTORS &&
            typeof PROGRESS_SELECTORS.getCourseStats === "function"
              ? PROGRESS_SELECTORS.getCourseStats(
                  getCourseId(),
                  (state.lessons && state.lessons.length) || 0
                )
              : null) || {};
          const lastNo = stats.lastLessonNo || 1;
          enterReviewMode("lesson", `${getCourseId()}_lesson${lastNo}`);
        } else {
          enterReviewMode("lesson", lessonId);
        }
      },
      { signal }
    );
  }

  el = $("hskReviewLevel");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        enterReviewMode("level", "", getCourseId());
      },
      { signal }
    );
  }

  el = $("hskReviewAll");
  if (el) {
    el.addEventListener(
      "click",
      function () {
        enterReviewMode("all");
      },
      { signal }
    );
  }

  // ===== Lesson click =====
  el = $("hskLessonList");
  if (el) {
    el.addEventListener(
      "click",
      function (e) {
        const btn = e.target.closest('button[data-open-lesson="1"]');
        if (!btn) return;

        const lessonNo = Number(btn.dataset.lessonNo || 1);
        const file = btn.dataset.file || "";

        openLesson({ lessonNo, file });
      },
      { signal }
    );
  }

  // ===== 朗读：HSK3.0 HSK1 工具栏 + 会话/扩展等点读 =====
  document.addEventListener(
    "click",
    async (e) => {
      const wbtn = e.target.closest("#hskSpeakAllWordsBtn");
      if (wbtn) {
        if (!shouldUseCompactLearnVocabLayout()) return;
        e.preventDefault();
        e.stopPropagation();
        const words = state.current && state.current.lessonWords;
        if (!Array.isArray(words) || !words.length) return;
        const anchor = document.getElementById("hskWordBulkSpeakAnchor");
        const { buildWordBulkTimeline, openBulkSpeakPlayer } = await import("../../modules/hsk/hskBulkSpeakPlayer.js");
        const tl = buildWordBulkTimeline(words, { lang: getLang(), scope: `hsk${state.lv}` });
        await openBulkSpeakPlayer("words", tl, anchor || wbtn.parentElement);
        return;
      }

      const wloop = e.target.closest("#hskSpeakAllWordsLoopBtn");
      if (wloop) {
        if (!shouldUseCompactLearnVocabLayout()) return;
        e.preventDefault();
        e.stopPropagation();
        const {
          getBulkTtsPlayer,
          openBulkSpeakPlayer,
          closeBulkSpeakPlayer,
          buildWordBulkTimeline,
        } = await import("../../modules/hsk/hskBulkSpeakPlayer.js");
        const p = getBulkTtsPlayer();
        if (p.bulkLoop && p.loopKind === "words") {
          closeBulkSpeakPlayer();
          return;
        }
        const words = state.current && state.current.lessonWords;
        if (!Array.isArray(words) || !words.length) return;
        const anchor = document.getElementById("hskWordBulkSpeakAnchor");
        const tl = buildWordBulkTimeline(words, { lang: getLang(), scope: `hsk${state.lv}` });
        await openBulkSpeakPlayer("words", tl, anchor || wloop.parentElement, { loop: true });
        return;
      }

      const fbtn = e.target.closest("#hskDialogueSpeakFullBtn");
      if (fbtn) {
        if (!shouldUseHsk30Hsk1SpeakPilot()) return;
        e.preventDefault();
        e.stopPropagation();
        const ld = state.current && state.current.lessonData;
        if (!ld) return;
        const anchor =
          document.getElementById("hskDialogueBulkSpeakAnchor") || fbtn.parentElement;
        const { buildDialogueBulkTimeline, openBulkSpeakPlayer } = await import("../../modules/hsk/hskBulkSpeakPlayer.js");
        const uiLangForDialogue = getLang();
        const tl = buildDialogueBulkTimeline(ld, {
          getDialogueCards: _getDialogueCards,
          pickDialogueTranslation: (line, zh) => _pickDialogueTranslation(line, zh, uiLangForDialogue),
          dialogueSessionIntroTts: (n) => _dialogueSessionIntroTts(n, uiLangForDialogue),
        });
        await openBulkSpeakPlayer("dialogue", tl, anchor);
        return;
      }

      const floop = e.target.closest("#hskDialogueSpeakFullLoopBtn");
      if (floop) {
        if (!shouldUseHsk30Hsk1SpeakPilot()) return;
        e.preventDefault();
        e.stopPropagation();
        const {
          getBulkTtsPlayer,
          openBulkSpeakPlayer,
          closeBulkSpeakPlayer,
          buildDialogueBulkTimeline,
        } = await import("../../modules/hsk/hskBulkSpeakPlayer.js");
        const p = getBulkTtsPlayer();
        if (p.bulkLoop && p.loopKind === "dialogue") {
          closeBulkSpeakPlayer();
          return;
        }
        const ld = state.current && state.current.lessonData;
        if (!ld) return;
        const anchor =
          document.getElementById("hskDialogueBulkSpeakAnchor") || floop.parentElement;
        const uiLangForDialogueLoop = getLang();
        const tl = buildDialogueBulkTimeline(ld, {
          getDialogueCards: _getDialogueCards,
          pickDialogueTranslation: (line, zh) => _pickDialogueTranslation(line, zh, uiLangForDialogueLoop),
          dialogueSessionIntroTts: (n) => _dialogueSessionIntroTts(n, uiLangForDialogueLoop),
        });
        await openBulkSpeakPlayer("dialogue", tl, anchor, { loop: true });
        return;
      }

      const dlineLoop = e.target.closest(".hsk-dialogue-line-loopbtn");
      if (dlineLoop && shouldUseHsk30Hsk1SpeakPilot()) {
        const zh = (dlineLoop.dataset.speakText || "").trim();
        const tr = (dlineLoop.dataset.speakTranslation || "").trim();
        if (!zh || !tr) return;
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const lineEl = dlineLoop.closest(".lesson-dialogue-line");
        const { toggleDialogueLineSpeakLoop } = await import("../../modules/hsk/hskRenderer.js");
        await toggleDialogueLineSpeakLoop(zh, tr, lineEl || null);
        return;
      }

      const gListen = e.target.closest(".hsk30-card-listen[data-hsk30-grammar-idx]");
      if (gListen && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const gi = Number(gListen.dataset.hsk30GrammarIdx);
        if (!Number.isFinite(gi)) return;
        const raw = state.current?.lessonData?._raw || state.current?.lessonData;
        const pts = _getGrammarPointsArray(raw);
        const pt = pts[gi];
        if (!pt) return;
        const cardEl = gListen.closest(".lesson-grammar-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../../modules/hsk/hskRenderer.js");
        const segs = _buildGrammarSpeakSegments(pt, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: lessonCtx,
          playbackScope: TTS_SCOPE.GRAMMAR,
        });
        return;
      }

      const extFlat = e.target.closest(".hsk30-ext-listen[data-hsk30-ext-flat-idx]");
      if (extFlat && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const fi = Number(extFlat.dataset.hsk30ExtFlatIdx);
        if (!Number.isFinite(fi)) return;
        const raw = state.current?.lessonData?._raw || state.current?.lessonData;
        const arr = _getExtensionItemsArray(raw);
        const item = arr[fi];
        if (!item) return;
        const cardEl = extFlat.closest(".lesson-extension-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../../modules/hsk/hskRenderer.js");
        const segs = _buildExtensionFlatSpeakSegments(item, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: lessonCtx,
          playbackScope: TTS_SCOPE.EXTENSION,
        });
        return;
      }

      const extGroup = e.target.closest(".hsk30-ext-listen[data-hsk30-ext-group-idx]");
      if (extGroup && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const gi = Number(extGroup.dataset.hsk30ExtGroupIdx);
        if (!Number.isFinite(gi)) return;
        const raw = state.current?.lessonData?._raw || state.current?.lessonData;
        const arr = _getExtensionItemsArray(raw);
        const item = arr[gi];
        if (!item) return;
        const sentences = Array.isArray(item && item.sentences) ? item.sentences : [];
        const isGroup = sentences.length > 0 && (item.groupTitle || item.focusGrammar);
        if (!isGroup) return;
        const cardEl = extGroup.closest(".lesson-extension-group-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../../modules/hsk/hskRenderer.js");
        const segs = _buildExtensionGroupSpeakSegments(item, getLang());
        const lessonCtx = state.current?.lessonData || raw;
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: lessonCtx,
          playbackScope: TTS_SCOPE.EXTENSION,
        });
        return;
      }

      const prListen = e.target.closest(".hsk30-practice-listen[data-hsk30-practice-id]");
      if (prListen && shouldUseHsk30Hsk1SpeakPilot()) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        const qid = String(prListen.dataset.hsk30PracticeId || "").trim();
        if (!qid) return;
        const ld = state.current?.lessonData;
        if (!ld) return;
        const questions = await _resolvePracticeQuestionsForSpeak(ld);
        const q = questions.find((x) => String(x?.id || "") === qid);
        if (!q) return;
        const langKey = practiceLangKeyFromUiLang(getLang());
        const cardEl = prListen.closest(".lesson-practice-card");
        const { speakHsk30ZhUiSegmentChain } = await import("../../modules/hsk/hskRenderer.js");
        const segs = _buildPracticeSpeakSegmentsUnified(q, langKey, ld, {
          useHsk30Hsk1Pilot: shouldUseHsk30Hsk1SpeakPilot(),
        });
        await speakHsk30ZhUiSegmentChain(segs, cardEl || null, {
          lessonForPinyinMap: ld,
          playbackScope: TTS_SCOPE.PRACTICE,
        });
        return;
      }

      const dzPilot = e.target.closest(".lesson-dialogue-zh[data-speak-kind='dialogue']");
      if (
        dzPilot &&
        shouldUseHsk30Hsk1SpeakPilot() &&
        dzPilot.dataset.speakTranslation != null &&
        String(dzPilot.dataset.speakTranslation || "").trim() !== ""
      ) {
        const zh = (dzPilot.dataset.speakText || "").trim();
        const tr = (dzPilot.dataset.speakTranslation || "").trim();
        if (
          !zh ||
          !(
            AUDIO_ENGINE &&
            typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
            AUDIO_ENGINE.isSpeechSupported()
          )
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const lineEl = dzPilot.closest(".lesson-dialogue-line");
        const { speakZhThenUiTranslationPilot } = await import("../../modules/hsk/hskRenderer.js");
        await speakZhThenUiTranslationPilot(zh, tr, lineEl || null);
        return;
      }

      const target = e.target.closest(
        "[data-speak-text][data-speak-kind='dialogue'], [data-speak-text][data-speak-kind='extension'], [data-speak-text][data-speak-kind='grammar'], [data-speak-text][data-speak-kind='practice']"
      );
      if (!target) return;

      const text = (target.dataset && target.dataset.speakText || "").trim();
      if (
        !text ||
        !(
          AUDIO_ENGINE &&
          typeof AUDIO_ENGINE.isSpeechSupported === "function" &&
          AUDIO_ENGINE.isSpeechSupported()
        )
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const lineEl =
        target.closest(".lesson-dialogue-line") ||
        target.closest(".lesson-extension-card") ||
        target.closest(".lesson-extension-group-card") ||
        target.closest(".lesson-grammar-card") ||
        target.closest(".review-grammar-row") ||
        target.closest(".lesson-practice-card") ||
        target.closest(".review-question-card") ||
        target.closest(".lesson-practice-option") ||
        target.closest(".lesson-review-item") ||
        target.closest(".lesson-review-summary-word-item") ||
        target.closest(".hsk-lr-speak-row");

      const sk = String(target.dataset.speakKind || "other").toLowerCase();
      const scopeByKind = {
        dialogue: TTS_SCOPE.DIALOGUE,
        extension: TTS_SCOPE.EXTENSION,
        grammar: TTS_SCOPE.GRAMMAR,
        practice: TTS_SCOPE.PRACTICE,
      };
      const scope = scopeByKind[sk] || TTS_SCOPE.OTHER;

      playSingleText(text, {
        scope,
        lang: "zh-CN",
        rate: 0.95,
        beforePlay: () => {
          if (lineEl) lineEl.classList.add("is-speaking");
        },
        onEnd: function () {
          if (lineEl) lineEl.classList.remove("is-speaking");
        },
        onError: function () {
          if (lineEl) lineEl.classList.remove("is-speaking");
        },
      });
    },
    { signal }
  );

  // ===== Tabs =====
  el = $("hskStudyTabs");
  if (el) {
    el.addEventListener(
      "click",
      function (e) {
        const btn = e.target.closest("button[data-tab]");
        if (!btn) return;

        state.tab = btn.dataset.tab;
        stopAllLearningAudio();
        updateTabsUI();

        if (state.tab === "practice") {
          const ld = state.current && state.current.lessonData;
          const lessonId = ld ? ld.id || "" : "";
          const lessonNo = state.current ? state.current.lessonNo : 0;
          console.log("[HSK-PRACTICE-TAB-ENTERED]", {
            lessonId,
            lessonNo,
            ts: "2026-03-27-debug",
          });
        }

        const step = state.tab === "ai" ? "aiPractice" : state.tab;

        if (state.current && state.current.lessonData) {
          const courseId = getCourseId();
          const lessonId =
            state.current.lessonData.id ||
            courseId + "_lesson" + state.current.lessonNo;

          if (
            PROGRESS_ENGINE &&
            typeof PROGRESS_ENGINE.markStepCompleted === "function"
          ) {
            PROGRESS_ENGINE.markStepCompleted({
              courseId,
              lessonId,
              step,
            });
          }

          updateProgressBlock();
        }

        // ⭐ 关键：切到 practice tab 时只 rerender，不重建
        if (state.tab === "practice") {
          const practiceEl = $("hskPracticeBody");
          if (practiceEl) {
            try {
              rerenderHskPractice(practiceEl, getLang());
            } catch (err) {
              console.warn("[HSK] practice tab rerender failed:", err);
            }
          }
        }
      },
      { signal }
    );
  }

  // ===== Search =====
  el = $("hskSearch");
  if (el) {
    el.addEventListener(
      "input",
      function () {
        const q = String(($("hskSearch") && $("hskSearch").value) || "")
          .trim()
          .toLowerCase();

        const lang = getLang();
        const listEl = $("hskLessonList");
        if (!listEl) return;

        const filtered = !q
          ? state.lessons
          : state.lessons.filter((it) => {
              const title = JSON.stringify(
                (it && it.title) || (it && it.name) || ""
              ).toLowerCase();
              const pinyin = String(
                (it && it.pinyinTitle) || (it && it.pinyin) || ""
              ).toLowerCase();
              const file = String((it && it.file) || "").toLowerCase();
              return title.includes(q) || pinyin.includes(q) || file.includes(q);
            });

        const total = (state.lessons && state.lessons.length) || 0;
        const stats =
          (PROGRESS_SELECTORS &&
          typeof PROGRESS_SELECTORS.getCourseStats === "function"
            ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total)
            : null) || {};

        renderLessonList(listEl, filtered, {
          lang,
          currentLessonNo: stats.lastLessonNo || 0,
        });
      },
      { signal }
    );
  }

  // ===== Language changed =====
  window.addEventListener(
    "joy:langChanged",
    (e) => {
      const newLang = (e && e.detail && e.detail.lang) || getLang();

      if (!isHSKPageActive()) return;

      refreshBlueprintDisplayTitles(state.lessons, newLang, state.version, state.lv);

      if (
        state.current &&
        state.current.lessonData &&
        state.current.lessonData.blueprintTitle != null
      ) {
        state.current.lessonData.displayTitle = resolveBlueprintTitle(
          state.current.lessonData.blueprintTitle,
          newLang
        );
      }

      try {
        i18n.apply(document);
      } catch {}

      setSubTitle();
      rerenderHSKFromState();

      // ⭐ 关键：单独刷新 practice 显示层，不重建池
      const practiceEl = $("hskPracticeBody");
      if (practiceEl) {
        try {
          rerenderHskPractice(practiceEl, newLang);
        } catch (err) {
          console.warn("[HSK] practice rerender after lang change failed:", err);
        }
      }
    },
    { signal }
  );

  // ===== i18n bus =====
  try {
    if (i18n && typeof i18n.on === "function") {
      i18n.on("change", function () {
        window.dispatchEvent(
          new CustomEvent("joy:langChanged", {
            detail: { lang: i18n?.getLang?.() },
          })
        );
      });
    }
  } catch {}
}
