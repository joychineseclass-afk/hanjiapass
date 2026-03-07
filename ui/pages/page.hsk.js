// /ui/pages/page.hsk.js ✅ FINAL (Study Tabs)
// ✅ Clean HSK page: no mountGlobalComponents()
// ✅ Directory <-> Study mode
// ✅ Study Tabs: words/dialogue/grammar/ai

import { i18n } from "../i18n.js";
import { pick, getContentText, getLang as getEngineLang, getLessonDisplayTitle } from "../core/languageEngine.js";
import { mountNavBar } from "../components/navBar.js";
import { ensureHSKDeps } from "../modules/hsk/hskDeps.js";
import { getHSKLayoutHTML } from "../modules/hsk/hskLayout.js";
import { renderLessonList, renderWordCards, bindWordCardActions, wordKey, wordPinyin, wordMeaning, normalizeLang } from "../modules/hsk/hskRenderer.js";
import { resolvePinyin, maybeGetManualPinyin, shouldShowPinyin } from "../utils/pinyinEngine.js";
import { loadGlossary } from "../utils/glossary.js";
import { LESSON_ENGINE, AI_CAPABILITY, mountPractice, rerenderPractice, IMAGE_ENGINE, SCENE_ENGINE, PROGRESS_ENGINE, PROGRESS_SELECTORS, AUDIO_ENGINE, renderReviewMode, prepareReviewSession } from "../platform/index.js";
import * as SceneRenderer from "../platform/scene/sceneRenderer.js";

const state = {
  lv: 1,
  version: "hsk2.0",
  lessons: [],
  current: null,        // { lessonNo, file, lessonData, lessonWords }
  tab: "words",         // words | dialogue | grammar | extension | practice | ai
  searchKeyword: "",
  reviewMode: null,
};

var el;

/** 当前 hskState，供 rerender 使用 */
function getHskState() {
  return {
    version: state.version,
    level: state.lv,
    lessonId: state.current ? (state.current.lessonData?.id || getCourseId() + "_lesson" + state.current.lessonNo) : "",
    lessonNo: state.current?.lessonNo || 0,
    file: state.current?.file || "",
    activeTab: state.tab,
    reviewMode: state.reviewMode,
    searchKeyword: state.searchKeyword,
  };
}

function isHSKPageActive() {
  const hash = (typeof location !== "undefined" && location.hash || "").toLowerCase();
  const path = (typeof location !== "undefined" && location.pathname || "").toLowerCase();
  return hash.includes("hsk") || path.includes("hsk");
}

function getLang() {
  return normalizeLang(getEngineLang());
}

function getCourseId() {
  return `${state.version}_hsk${state.lv}`;
}

function $(id) { return document.getElementById(id); }

/** state-driven 全量重渲染：meta / lesson list / detail 区 / tabs */
function rerenderHSKFromState() {
  const lang = getLang();
  const hskState = getHskState();
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[HSK] rerender detail:", { ...hskState, lang });
  }

  updateProgressBlock();
  updateTabsLabels();

  const total = (state.lessons && state.lessons.length) || 0;
  const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total) : null) || {};
  const listEl = $("hskLessonList");
  if (listEl) renderLessonList(listEl, state.lessons, { lang, currentLessonNo: stats.lastLessonNo || 0 });

  if (state.current && state.current.lessonData) {
    const ld = state.current.lessonData;
    const lw = state.current.lessonWords || [];
    const no = state.current.lessonNo;
    const isReview = (ld && ld.type) === "review";
    const rr = (ld && ld.review && ld.review.lessonRange);

    if (typeof console !== "undefined" && console.debug) {
      console.debug("[HSK] render tab", state.tab, "lang=" + lang);
    }

    const titleStr = getLessonDisplayTitle(ld, getLang());
    const lessonNoLabel = i18n.t("hsk.lesson_no_format", { n: no });
    const headerTitle = titleStr ? `${lessonNoLabel} / ${titleStr}` : lessonNoLabel;
    const titleEl = $("hskStudyTitle");
    if (titleEl) titleEl.textContent = headerTitle;

    if (isReview && lw.length === 0 && Array.isArray(rr) && rr.length >= 2) {
      const reviewTitle = i18n.t("hsk.review_range", "复习范围");
      const reviewDesc = i18n.t("hsk.review_desc", "请回顾前面学过的词汇和对话。");
      const rangeFmt = i18n.t("hsk.review_range_format", { from: rr[0], to: rr[1], total: rr[1] });
      const pw = $("hskPanelWords");
      if (pw) pw.innerHTML = `<div class="rounded-xl border border-slate-200 p-4 bg-slate-50"><div class="font-semibold mb-2 text-slate-800">${escapeHtml(reviewTitle)}</div><p class="text-slate-700">${escapeHtml(rangeFmt)}</p><p class="text-sm opacity-70 mt-2 text-slate-600">${escapeHtml(reviewDesc)}</p></div>`;
    } else {
      renderWordCards($("hskPanelWords"), lw, undefined, { lang, scope: `hsk${state.lv}` });
    }

    $("hskDialogueBody").innerHTML = buildDialogueHTML(ld);
    $("hskGrammarBody").innerHTML = buildGrammarHTML(ld);
    $("hskExtensionBody").innerHTML = buildExtensionHTML(ld);

    if (rerenderPractice && $("hskPracticeBody")) {
      try { rerenderPractice($("hskPracticeBody"), lang); } catch {}
    }

    if (AI_CAPABILITY && typeof AI_CAPABILITY.mountAIPanel === "function" && $("hskAIResult")) {
      try {
        AI_CAPABILITY.mountAIPanel($("hskAIResult"), {
          lesson: ld,
          lang,
          wordsWithMeaning: (w) => wordMeaning(w, lang),
        });
      } catch {}
    }

    updateTabsUI();
  }
}

/** 更新 tab 与 review 入口按钮文案（语言切换后） */
function updateTabsLabels() {
  const tabs = [
    ["hskTabWords", "hsk.tab.words"],
    ["hskTabDialogue", "hsk.tab.dialogue"],
    ["hskTabGrammar", "hsk.tab.grammar"],
    ["hskTabExtension", "hsk.tab.extension"],
    ["hskTabPractice", "hsk.tab.practice"],
    ["hskTabAI", "hsk.tab.ai"],
  ];
  tabs.forEach(([id, key]) => {
    const btn = $(id);
    if (btn) {
      const span = btn.querySelector("span") || btn;
      span.textContent = i18n.t(key, key.split(".").pop());
    }
  });
  const reviewBtn = $("hskReviewBtn");
  if (reviewBtn) reviewBtn.textContent = i18n.t("review.start", "복습");
  const reviewLabels = [
    ["hskReviewEntry", "span", "hsk.review_mode"],
    ["hskReviewLesson", null, "hsk.review_this_lesson"],
    ["hskReviewLevel", null, "hsk.review_this_level"],
    ["hskReviewAll", null, "hsk.review_all_wrong"],
  ];
  reviewLabels.forEach(([id, child, key]) => {
    const el = $(id);
    if (!el) return;
    const target = child ? el.querySelector(child) : el;
    if (target) target.textContent = i18n.t(key, key.split(".").pop());
  });
}

function updateProgressBlock() {
  const el = $("hskProgressBlock");
  if (!el) return;
  const courseId = getCourseId();
  const total = (state.lessons && state.lessons.length) || 0;
  const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(courseId, total) : null) || {};
  const { completedLessonCount, dueReviewCount, lastLessonNo, lastActivityAt } = stats;

  const lessonUnit = i18n.t("hsk.meta.lesson_unit", "课");
  const wordUnit = i18n.t("hsk.meta.word_unit", "词");

  const chips = [];
  chips.push(
    total > 0
      ? `${i18n.t("hsk.meta.completed", "완료")} ${completedLessonCount} / ${total} ${lessonUnit}`
      : "—"
  );
  if (lastLessonNo > 0) {
    chips.push(`${i18n.t("hsk.meta.current_lesson", "현재")} ${lastLessonNo} ${lessonUnit}`);
  }
  if (dueReviewCount > 0) {
    chips.push(`${i18n.t("hsk.meta.review_words", "복습")} ${dueReviewCount} ${wordUnit}`);
  }
  if (lastActivityAt > 0) {
    const d = new Date(lastActivityAt);
    const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    chips.push(`${i18n.t("hsk.meta.last_study", "최근 학습")} ${dateStr}`);
  }

  el.innerHTML = chips.map((text) => `<span class="hsk-meta-chip">${escapeHtml(text)}</span>`).join("");
}

function setError(msg = "") {
  const err = $("hskError");
  if (!err) return;
  if (!msg) { err.classList.add("hidden"); err.textContent = ""; return; }
  err.classList.remove("hidden");
  err.textContent = msg;
}

function setSubTitle() {
  const el = $("hskSubTitle");
  if (!el) return;
  el.textContent = `HSK ${state.lv} · ${state.version}`;
}

function showStudyMode(titleText = "") {
  var el = $("hskLessonListWrap"); if (el) el.classList.add("hidden");
  el = $("hskStudyBar"); if (el) el.classList.remove("hidden");
  el = $("hskStudyPanels"); if (el) el.classList.remove("hidden");
  if ($("hskStudyTitle")) $("hskStudyTitle").textContent = titleText || "";
}

function showListMode() {
  el = $("hskStudyBar"); if (el) el.classList.add("hidden");
  el = $("hskStudyPanels"); if (el) el.classList.add("hidden");

  el = $("hskLessonListWrap"); if (el) el.classList.remove("hidden");

  // clear panels
  el = $("hskPanelWords"); if (el) el.innerHTML = "";
  el = $("hskDialogueBody"); if (el) el.innerHTML = "";
  el = $("hskGrammarBody"); if (el) el.innerHTML = "";
  el = $("hskExtensionBody"); if (el) el.innerHTML = "";
  el = $("hskPracticeBody"); if (el) el.innerHTML = "";
  el = $("hskAIResult"); if (el) el.innerHTML = "";
  el = $("hskAIContext"); if (el) el.classList.add("hidden");
  el = $("hskSceneSection"); if (el) { el.innerHTML = ""; el.classList.add("hidden"); }

  state.current = null;
  state.tab = "words";
  updateTabsUI();
}

function updateTabsUI() {
  const ids = [
    ["words", "hskTabWords", "hskPanelWords"],
    ["dialogue", "hskTabDialogue", "hskPanelDialogue"],
    ["grammar", "hskTabGrammar", "hskPanelGrammar"],
    ["extension", "hskTabExtension", "hskPanelExtension"],
    ["practice", "hskTabPractice", "hskPanelPractice"],
    ["ai", "hskTabAI", "hskPanelAI"],
  ];

  ids.forEach(([tab, btnId, panelId]) => {
    const btn = $(btnId);
    const panel = $(panelId);
    const active = state.tab === tab;

    if (btn) btn.classList.toggle("active", active);
    // simple active style without CSS dependency
    if (btn) {
      btn.style.background = active ? "rgba(34,197,94,0.10)" : "";
      btn.style.borderColor = active ? "rgba(34,197,94,0.55)" : "";
    }

    if (!panel) return;
    panel.classList.toggle("hidden", !active);
  });
}

/** 对话翻译：统一走 languageEngine.getContentText，strict 避免混语 */
function pickDialogueTranslation(line, zhMain = "") {
  const out = getContentText(line, "translation") || pick(line, { strict: true });
  if (out && zhMain && out === zhMain) return "";
  return out;
}

/** 会话标题：pick(title, strict) 或 i18n 会話{n} */
function pickCardTitle(obj, cardIndex = 1) {
  if (obj != null && typeof obj === "string") return obj.trim();
  const v = pick(obj, { strict: true });
  if (v) return v;
  const sessionText = i18n.t("dialogue.session", { n: cardIndex });
  if (sessionText && sessionText !== "dialogue.session") return sessionText;
  return i18n.t("lesson.dialogue_card", "会话") + cardIndex;
}

/** 统一获取会话卡片：优先 dialogueCards，否则兼容 dialogue（嵌套/扁平） */
function getDialogueCards(lesson) {
  if (lesson && Array.isArray(lesson.dialogueCards) && lesson.dialogueCards.length) {
    return lesson.dialogueCards;
  }

  if (lesson && Array.isArray(lesson.dialogue) && lesson.dialogue.length) {
    const first = lesson.dialogue[0];
    if (first && first.lines && Array.isArray(first.lines)) {
      return lesson.dialogue;
    }
    return [{ title: null, lines: lesson.dialogue }];
  }

  return [];
}

/** 渲染单条对话行，输出完整 HTML。支持新结构 text/translation 与旧结构 zh/kr */
function renderDialogueLine(line, lang, showPinyin) {
  const spk = String((line && line.spk) || (line && line.speaker) || "").trim();
  const zh = String((line && line.text) || (line && line.zh) || (line && line.cn) || (line && line.line) || "").trim();
  let py = maybeGetManualPinyin(line, "dialogue");
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
  const trans = pickDialogueTranslation(line, zh);

  const zhAttrs = zh ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"` : "";
  return `<article class="lesson-dialogue-line">
  ${spk ? `<div class="lesson-dialogue-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="lesson-dialogue-zh"${zhAttrs}>${escapeHtml(zh)}</div>
  ${py ? `<div class="lesson-dialogue-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation">${escapeHtml(trans)}</div>` : ""}
</article>`;
}

/** 对话渲染：优先 dialogueCards，回退 dialogue；每张卡单独渲染，不合并 */
function buildDialogueHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const cards = getDialogueCards(raw);
  const lang = getLang();

  const hero = `<section class="lesson-section-hero lesson-dialogue-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue", "会话"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.dialogue_subtitle", "本课会话，可点击中文朗读。"))}</p>
</section>`;

  if (!cards.length) return `${hero}<div class="lesson-empty-state">${i18n.t("hsk.empty_dialogue", "暂无会话")}</div>`;

  if (SCENE_ENGINE && typeof SCENE_ENGINE.hasScene === "function" && SCENE_ENGINE.hasScene(lessonData)) {
    const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
    const framesHtml = SceneRenderer.renderSceneFrames(scene, lessonData, lang);
    if (framesHtml) return hero + framesHtml;
  }

  const showPinyin = shouldShowPinyin({ level: (lessonData && lessonData.level), version: (lessonData && lessonData.version) });

  return `${hero}<div class="lesson-dialogue-list">
${cards.map((card, index) => {
  const lines = Array.isArray(card && card.lines) ? card.lines : [];
  if (!lines.length) return "";
  const titleText = pickCardTitle(card && card.title, index + 1);
  const lineHtml = lines.map((line) => renderDialogueLine(line, lang, showPinyin)).join("");
  return `  <section class="lesson-dialogue-card">
    <h4 class="lesson-dialogue-card-title">${escapeHtml(titleText)}</h4>
    <div class="lesson-dialogue-lines">${lineHtml}</div>
  </section>`;
}).filter(Boolean).join("\n")}
</div>`;
}

/** 语法解释：统一走 languageEngine.getContentText */
function pickGrammarExplanation(pt) {
  return getContentText(pt, "explain") || getContentText(pt, "explanation") || pick(pt) || "";
}

/** 语法例句：getContentText(example, "translation") 或 pick */
function getGrammarExamples(pt) {
  const ex = (pt && pt.example) || (pt && pt.examples);
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const toItem = (e) => {
    if (typeof e === "string") return { zh: e, pinyin: "", trans: "" };
    const zh = str((e && e.zh) || (e && e.cn) || (e && e.line) || (e && e.text));
    const pinyin = str((e && e.pinyin) || (e && e.py));
    const trans = getContentText(e, "translation") || pick(e) || "";
    return { zh, pinyin, trans };
  };
  if (!ex) return [];
  if (Array.isArray(ex)) return ex.map(toItem).filter((x) => x.zh);
  return [toItem(ex)];
}

/** 语法渲染：教材级卡片，支持点读 */
function buildGrammarHTML(lessonData) {
  const g = lessonData && lessonData.grammar;
  const lang = getLang();
  const speakLabel = i18n.t("hsk.extension_speak", "发音");
  const emptyMsg = `<div class="lesson-grammar-empty">${i18n.t("hsk.empty_grammar", "暂无语法")}</div>`;

  const hero = `<section class="lesson-section-hero lesson-grammar-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.grammar_title", "语法"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.grammar_subtitle", "本课语法"))}</p>
</section>`;

  if (!g) return `${hero}${emptyMsg}`;

  const arr = Array.isArray(g) ? g : (Array.isArray(g && g.points) ? g.points : []);
  if (!arr.length) return `${hero}${emptyMsg}`;

  const showPinyin = shouldShowPinyin({ level: (lessonData && lessonData.level), version: (lessonData && lessonData.version) });
  const cards = arr.map((pt, i) => {
    const titleZh = typeof (pt && pt.title) === "object"
      ? ((pt.title && pt.title.zh) || (pt.title && pt.title.kr) || (pt.title && pt.title.en) || "")
      : ((pt && pt.pattern) || (pt && pt.title) || (pt && pt.name) || "#" + (i + 1));
    let titlePy = maybeGetManualPinyin(pt, "grammarTitle");
    if (showPinyin && titleZh && !titlePy) titlePy = resolvePinyin(titleZh, titlePy);

    const expl = pickGrammarExplanation(pt);
    const examples = getGrammarExamples(pt);
    const idx = String(i + 1).padStart(2, "0");
    const titleEsc = escapeHtml(titleZh).replaceAll('"', "&quot;");
    const titleAttrs = titleZh ? ` data-speak-text="${titleEsc}" data-speak-kind="grammar"` : "";
    const btnAttrs = titleZh ? ` data-speak-text="${titleEsc}" data-speak-kind="grammar"` : "";

    let examplesHtml = "";
    if (examples.length) {
      examplesHtml = examples.map((ex) => {
        let exPy = ex.pinyin;
        if (showPinyin && ex.zh && !exPy) exPy = resolvePinyin(ex.zh, exPy);
        const exEsc = escapeHtml(ex.zh).replaceAll('"', "&quot;");
        const exAttrs = ex.zh ? ` data-speak-text="${exEsc}" data-speak-kind="grammar"` : "";
        return `<div class="lesson-grammar-example">
  <div class="lesson-grammar-example-zh"${exAttrs}>${escapeHtml(ex.zh)}</div>
  ${exPy ? `<div class="lesson-grammar-example-pinyin">${escapeHtml(exPy)}</div>` : ""}
  ${ex.trans ? `<div class="lesson-grammar-example-meaning">${escapeHtml(ex.trans)}</div>` : ""}
</div>`;
      }).join("");
    }

    return `<article class="lesson-grammar-card">
  <div class="lesson-grammar-card-top">
    <span class="lesson-grammar-index">${idx}</span>
    <button type="button" class="lesson-grammar-audio-btn"${btnAttrs}>${escapeHtml(speakLabel)}</button>
  </div>
  <div class="lesson-grammar-head">
    <div class="lesson-grammar-zh"${titleAttrs}>${escapeHtml(titleZh)}</div>
    ${titlePy ? `<div class="lesson-grammar-pinyin">${escapeHtml(titlePy)}</div>` : ""}
  </div>
  ${expl ? `<div class="lesson-grammar-expl">${escapeHtml(expl)}</div>` : ""}
  ${examplesHtml ? `<div class="lesson-grammar-examples">${examplesHtml}</div>` : ""}
</article>`;
  }).join("");

  return `${hero}<section class="lesson-grammar-list">${cards}</section>`;
}

/** 扩展表达：hero + 教材卡片列表，支持点读（点击中文或发音按钮） */
function buildExtensionHTML(lessonData) {
  const raw = (lessonData && lessonData._raw) || lessonData;
  const arr = Array.isArray(raw && raw.extension) ? raw.extension : [];
  const lang = getLang();
  const speakLabel = i18n.t("extension_speak");
  const hero = `<section class="lesson-section-hero lesson-extension-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.extension_title", "扩展"))}</h3>
  <span class="lesson-extension-badge">${escapeHtml(i18n.t("hsk.extension_badge", "扩展"))}</span>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.extension_subtitle", "扩展表达"))}</p>
  <p class="lesson-extension-tip">${escapeHtml(i18n.t("extension.tip", "点击可听发音"))}</p>
</section>`;

  if (!arr.length) {
    return `${hero}<div class="lesson-extension-empty">${i18n.t("hsk.extension_empty", "暂无扩展")}</div>`;
  }

  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const cards = arr.map((item, i) => {
    const zh = str((item && item.hanzi) || (item && item.zh) || (item && item.cn) || (item && item.line) || "");
    const pinyin = str((item && item.pinyin) || (item && item.py) || "");
    const meaning = getContentText(item, "translation") || pick(item) || "";

    const idx = String(i + 1).padStart(2, "0");
    const zhEsc = escapeHtml(zh).replaceAll('"', "&quot;");
    const zhAttrs = zh ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";
    const btnAttrs = zh ? ` data-speak-text="${zhEsc}" data-speak-kind="extension"` : "";

    return `<article class="lesson-extension-card">
  <div class="lesson-extension-card-top">
    <span class="lesson-extension-index">${idx}</span>
    <button type="button" class="lesson-extension-audio-btn"${btnAttrs}>${escapeHtml(speakLabel)}</button>
  </div>
  <div class="lesson-extension-body">
    <div class="lesson-extension-zh"${zhAttrs}>${escapeHtml(zh)}</div>
    ${pinyin ? `<div class="lesson-extension-pinyin">${escapeHtml(pinyin)}</div>` : ""}
    ${meaning ? `<div class="lesson-extension-meaning">${escapeHtml(meaning)}</div>` : ""}
  </div>
</article>`;
  }).filter(Boolean).join("");

  return `${hero}<section class="lesson-extension-list">${cards}</section>`;
}

function buildAIContext() {
  if (!state.current || !state.current.lessonData) return "";
  const lang = getLang();
  const ld = state.current.lessonData;
  const no = state.current.lessonNo;

  const found = state.lessons && state.lessons.find(function(x) { return Number(x.lessonNo) === Number(no); });
  const titleObj = found && found.title;
  const title = titleObj ? (typeof titleObj === "object" ? pick(titleObj) : String(titleObj)) : "";

  const words = Array.isArray(state.current.lessonWords) ? state.current.lessonWords : [];
  const wordsLine = words.slice(0, 12).map(w => {
    const han = wordKey(w);
    const py = wordPinyin(w);
    const mean = wordMeaning(w, lang);
    return `${han}${py ? `(${py})` : ""}${mean ? `: ${mean}` : ""}`;
  }).join("\n");

  const lessonLabel = i18n.t("hsk.lesson_no_format", { n: no }) || (lang === "jp" ? `第 ${no} 課` : lang === "kr" ? `제 ${no}과` : `Lesson ${no}`);
  const questionLabel = i18n.t("practice.question_label") || (lang === "jp" ? "質問" : "Question");
  const titleLabel = lang === "jp" ? "タイトル" : "Title";
  return [
    lessonLabel,
    title ? `${titleLabel}: ${title}` : "",
    wordsLine ? `Words:\n${wordsLine}` : "",
    "",
    questionLabel + ":",
  ].filter(Boolean).join("\n");
}

/** 获取 vocab-distribution.json：distribution 键顺序 + lessonThemes 主题标题
 *  返回 { order: string[], lessonThemes: Record<string, string> } 或 null */
const _vocabDistCache = new Map();
async function getVocabDistribution(lv, version) {
  const key = `${version}:hsk${lv}`;
  if (_vocabDistCache.has(key)) return _vocabDistCache.get(key);
  const base = String(window.__APP_BASE__ || "").replace(/\/+$/, "");
  const root = base ? base + "/" : "/";
  const url = `${root}data/courses/${version}/hsk${lv}/vocab-distribution.json`;
  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) return null;
    const data = await res.json();
    const dist = data && data.distribution;
    const order = dist && typeof dist === "object" ? Object.keys(dist) : null;
    const lessonThemes = (data && data.lessonThemes && typeof data.lessonThemes === "object") ? data.lessonThemes : null;
    const out = { order, lessonThemes };
    _vocabDistCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

/** 按 vocab-distribution 的 distribution 键顺序排序课程 */
function sortLessonsByDistributionOrder(lessons, order) {
  if (!Array.isArray(lessons) || !Array.isArray(order) || order.length === 0) return lessons;
  const idxMap = new Map(order.map((k, i) => [k, i]));
  return [...lessons].sort((a, b) => {
    const noA = Number((a && a.lessonNo) || (a && a.lesson) || (a && a.id) || (a && a.no) || 0) || 0;
    const noB = Number((b && b.lessonNo) || (b && b.lesson) || (b && b.id) || (b && b.no) || 0) || 0;
    const keyA = noA ? `lesson${noA}` : "";
    const keyB = noB ? `lesson${noB}` : "";
    const iA = idxMap.has(keyA) ? idxMap.get(keyA) : Infinity;
    const iB = idxMap.has(keyB) ? idxMap.get(keyB) : Infinity;
    return iA - iB;
  });
}

/** vocab-distribution 主题的多语言翻译（供课程卡片显示）JP: jp->cn->en->kr */
const HSK1_THEME_TRANSLATIONS = {
  "打招呼": { ko: "인사하기", en: "Greetings", jp: "あいさつ" },
  "介绍名字": { ko: "이름 소개하기", en: "Introducing names", jp: "名前の紹介" },
  "国籍/国家": { ko: "국적 / 국가", en: "Nationality", jp: "国籍" },
  "家庭": { ko: "가족", en: "Family", jp: "家族" },
  "数字与数量": { ko: "숫자와 수량", en: "Numbers and quantity", jp: "数字と数量" },
  "年龄": { ko: "나이 묻기", en: "Age", jp: "年齢" },
  "日期": { ko: "날짜", en: "Date", jp: "日付" },
  "时间": { ko: "시간", en: "Time", jp: "時間" },
  "打电话": { ko: "전화하기", en: "Making calls", jp: "電話をかける" },
  "问地点/在哪儿": { ko: "장소 묻기 / 어디에", en: "Asking location", jp: "場所を聞く" },
  "学校生活": { ko: "학교 생활", en: "School life", jp: "学校生活" },
  "工作": { ko: "직업", en: "Work", jp: "仕事" },
  "爱好": { ko: "취미", en: "Hobbies", jp: "趣味" },
  "饮食1": { ko: "음식 1", en: "Food 1", jp: "飲食1" },
  "饮食2": { ko: "음식 2", en: "Food 2", jp: "飲食2" },
  "位置/方向": { ko: "위치 / 방향", en: "Location / direction", jp: "位置・方向" },
  "交通/出行": { ko: "교통 / 출행", en: "Transport", jp: "交通" },
  "购物": { ko: "쇼핑", en: "Shopping", jp: "買い物" },
  "天气": { ko: "날씨", en: "Weather", jp: "天気" },
  "看病/综合应用": { ko: "병원 / 종합 활용", en: "Doctor visit", jp: "病院・総合" },
  "复习1": { ko: "복습 1", en: "Review 1", jp: "復習1" },
  "复习2": { ko: "복습 2", en: "Review 2", jp: "復習2" },
};

/** 用 vocab-distribution 的 lessonThemes 覆盖课程标题，并附加多语言翻译 */
function applyVocabDistributionTitles(lessons, lessonThemes) {
  if (!Array.isArray(lessons) || !lessonThemes || typeof lessonThemes !== "object") return lessons;
  return lessons.map((l) => {
    const no = Number((l && l.lessonNo) || (l && l.lesson) || (l && l.id) || (l && l.no) || 0) || 0;
    const theme = no ? (lessonThemes[String(no)] || lessonThemes[no]) : null;
    if (!theme || typeof theme !== "string") return l;
    const tr = HSK1_THEME_TRANSLATIONS[theme];
    return {
      ...l,
      title: {
        zh: theme,
        kr: (tr && tr.ko) || "",
        en: (tr && tr.en) || "",
        jp: (tr && tr.jp) || "",
      },
      titleKo: (tr && tr.ko) || "",
      titleEn: (tr && tr.en) || "",
      titleJp: (tr && tr.jp) || "",
    };
  });
}

async function loadLessons() {
  setError("");
  setSubTitle();

  const lang = getLang();
  const listEl = $("hskLessonList");
  if (listEl) listEl.innerHTML = `<div class="text-sm opacity-70">${i18n.t("common_loading")}</div>`;

  try {
    let lessons = [];
    if (LESSON_ENGINE && typeof LESSON_ENGINE.loadCourseIndex === "function") {
      try {
        const index = await LESSON_ENGINE.loadCourseIndex({
          courseType: state.version,
          level: `hsk${state.lv}`,
        });
        lessons = Array.isArray(index && index.lessons) ? index.lessons : [];
      } catch (engineErr) {
        console.warn("[HSK] Lesson Engine loadCourseIndex failed, fallback to HSK_LOADER:", engineErr && engineErr.message);
      }
    }
    if (!lessons.length && window.HSK_LOADER && typeof window.HSK_LOADER.loadLessons === "function") {
      lessons = await window.HSK_LOADER.loadLessons(state.lv, { version: state.version });
    }
    lessons = Array.isArray(lessons) ? lessons : [];

    const vocabDist = await getVocabDistribution(state.lv, state.version);
    let result = sortLessonsByDistributionOrder(lessons, (vocabDist && vocabDist.order) || null);
    result = applyVocabDistributionTitles(result, (vocabDist && vocabDist.lessonThemes) || null);

    state.lessons = result;
    const total = state.lessons.length;
    const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total) : null) || {};
    renderLessonList(listEl, state.lessons, { lang: lang, currentLessonNo: stats.lastLessonNo || 0 });
    updateProgressBlock();
  } catch (e) {
    console.error(e);
    setError("Lessons load failed: " + (e && e.message ? e.message : e));
  }
}

async function openLesson({ lessonNo, file }) {
  setError("");
  const lang = getLang();
  const no = Number(lessonNo || 1);

  try {
    let lessonData = null;
    if (LESSON_ENGINE && typeof LESSON_ENGINE.loadLessonDetail === "function") {
      try {
        const { lesson } = await LESSON_ENGINE.loadLessonDetail({
          courseType: state.version,
          level: `hsk${state.lv}`,
          lessonNo: no,
          file: file || "",
        });
        lessonData = lesson;
      } catch (engineErr) {
        console.warn("[HSK] Lesson Engine loadLessonDetail failed, fallback to HSK_LOADER:", engineErr && engineErr.message);
      }
    }
    if (!lessonData && window.HSK_LOADER && typeof window.HSK_LOADER.loadLessonDetail === "function") {
      lessonData = await window.HSK_LOADER.loadLessonDetail(state.lv, no, {
        version: state.version,
        file: file || "",
      });
    }
    if (!lessonData) throw new Error("Failed to load lesson");

    const lessonWordsRaw = Array.isArray(lessonData && lessonData.words) ? lessonData.words : (Array.isArray(lessonData && lessonData.vocab) ? lessonData.vocab : []);
    const needsVocabEnrichment = lessonWordsRaw.some((w) => typeof w === "string");
    let vocab = [];
    if (needsVocabEnrichment && window.HSK_LOADER && typeof window.HSK_LOADER.loadVocab === "function") {
      vocab = await window.HSK_LOADER.loadVocab(state.lv, { version: state.version });
    }

    const vocabArr = Array.isArray(vocab) ? vocab : [];
    const vocabByKey = new Map(vocabArr.map((v) => [wordKey(v), v]).filter(([k]) => k));

    const lessonWords = lessonWordsRaw.map((w) => {
      if (typeof w === "string") {
        const key = String(w != null ? w : "").trim();
        return vocabByKey.get(key) || { hanzi: key };
      }
      return w || {};
    }).filter((w) => wordKey(w));

    state.current = { lessonNo: no, file: file || "", lessonData, lessonWords };

    const courseId = (lessonData && lessonData.courseId) || getCourseId();
    const lessonId = (lessonData && lessonData.id) || (courseId + "_lesson" + no);
    if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.markLessonStarted === "function") PROGRESS_ENGINE.markLessonStarted({ courseId: courseId, lessonId: lessonId, lessonNo: no });

    const lessonCoverUrl = (IMAGE_ENGINE && typeof IMAGE_ENGINE.getLessonImage === "function" ? IMAGE_ENGINE.getLessonImage(lessonData, {
      courseType: state.version,
      level: "hsk" + state.lv,
    }) : null);
    const coverWrap = $("hskLessonCoverWrap");
    const coverImg = $("hskLessonCover");
    if (coverWrap && coverImg) {
      if (lessonCoverUrl) {
        coverImg.src = lessonCoverUrl;
        coverImg.alt = typeof (lessonData && lessonData.title) === "object" ? ((lessonData.title && lessonData.title.zh) || (lessonData.title && lessonData.title.en) || "") : String((lessonData && lessonData.title) || "");
        coverImg.onerror = () => { coverWrap.classList.add("hidden"); };
        coverWrap.classList.remove("hidden");
    } else {
      coverWrap.classList.add("hidden");
      }
    }

    const sceneSection = $("hskSceneSection");
    if (sceneSection) {
      if (SCENE_ENGINE && typeof SCENE_ENGINE.hasScene === "function" && SCENE_ENGINE.hasScene(lessonData)) {
        const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
        sceneSection.innerHTML = SceneRenderer.renderSceneHeader(scene, lang) +
          SceneRenderer.renderSceneGoals(scene, lang) +
          SceneRenderer.renderSceneCharacters(scene, lang);
        sceneSection.classList.remove("hidden");
      } else {
        sceneSection.innerHTML = "";
        sceneSection.classList.add("hidden");
      }
    }

    const titleStr = getLessonDisplayTitle(lessonData, lang);
    const lessonNoLabel = i18n.t("hsk.lesson_no_format", { n: no });
    const headerTitle = titleStr ? `${lessonNoLabel} / ${titleStr}` : lessonNoLabel;
    showStudyMode(headerTitle);
    el = $("hskStudyBar"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    updateProgressBlock();

    // 供 Stroke 弹窗 / fallback 使用的上下文
    window.__HSK_PAGE_CTX = {
      version: state.version,
      level: state.lv,
      lessonNo: no,
      from: typeof location !== "undefined" ? location.pathname : "/pages/hsk.html",
    };

    // Default tab: words
    state.tab = "words";
    if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.markStepCompleted === "function") PROGRESS_ENGINE.markStepCompleted({ courseId: courseId, lessonId: lessonId, step: "vocab" });
    updateTabsUI();

    // Render panels
    const isReview = (lessonData && lessonData.type) === "review";
    const reviewRange = (lessonData && lessonData.review && lessonData.review.lessonRange);
    if (isReview && (!lessonWords || lessonWords.length === 0) && Array.isArray(reviewRange) && reviewRange.length >= 2) {
      const reviewTitle = i18n.t("hsk.review_range") || i18n.t("hsk_review_range") || "复习范围";
      const reviewDesc = i18n.t("hsk.review_desc") || i18n.t("hsk_review_desc") || "请回顾前面学过的词汇和对话。";
      const rangeFmt = i18n.t("hsk.review_range_format", { from: reviewRange[0], to: reviewRange[1], total: reviewRange[1] }) || `第 ${reviewRange[0]}–${reviewRange[1]} 课`;
      $("hskPanelWords").innerHTML = `
        <div class="rounded-xl border border-slate-200 p-4 bg-slate-50">
          <div class="font-semibold mb-2 text-slate-800">${escapeHtml(reviewTitle)}</div>
          <p class="text-slate-700">${escapeHtml(rangeFmt)}</p>
          <p class="text-sm opacity-70 mt-2 text-slate-600">${escapeHtml(reviewDesc)}</p>
        </div>
      `;
    } else {
      renderWordCards($("hskPanelWords"), lessonWords, undefined, { lang, scope: `hsk${state.lv}` });
      if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.touchLessonVocab === "function") PROGRESS_ENGINE.touchLessonVocab({
        courseId,
        lessonId,
        vocabItems: lessonWords.map((w) => wordKey(w) || w),
      });
    }
    $("hskDialogueBody").innerHTML = buildDialogueHTML(lessonData);
    $("hskGrammarBody").innerHTML = buildGrammarHTML(lessonData);
    $("hskExtensionBody").innerHTML = buildExtensionHTML(lessonData);

    // Practice panel: 平台级 Practice Engine
    if (mountPractice && $("hskPracticeBody")) {
      try {
        mountPractice($("hskPracticeBody"), {
          lesson: lessonData,
          lang,
          onComplete: ({ total, correct, score, lesson, wrongItems = [] }) => {
            if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.recordPracticeResult === "function") PROGRESS_ENGINE.recordPracticeResult({
              courseId,
              lessonId,
              total,
              correct,
              score,
              vocabItems: ((lesson && lesson.vocab) || (lesson && lesson.words) || []).map(function(w) { return typeof w === "string" ? w : (w && w.hanzi) || (w && w.word) || ""; }).filter(Boolean),
              wrongItems,
            });
            updateProgressBlock();
          },
        });
      } catch (e) {
        console.warn("[HSK] Practice mount failed:", e && e.message);
        $("hskPracticeBody").innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("practice.load_failed") || i18n.t("practice.empty"))}</div>`;
      }
    }

    // AI panel: 平台级 AI 对话训练入口
    $("hskAIInput").value = "";
    el = $("hskAIContext"); if (el) el.classList.add("hidden");
    if (AI_CAPABILITY && typeof AI_CAPABILITY.mountAIPanel === "function" && $("hskAIResult")) {
      try {
        AI_CAPABILITY.mountAIPanel($("hskAIResult"), {
          lesson: lessonData,
          lang,
          wordsWithMeaning: (w) => wordMeaning(w, lang),
        });
      } catch (e) {
        console.warn("[HSK] AI panel mount failed, fallback:", e && e.message);
        $("hskAIResult").innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("hsk_ai_tip", {}))}</div>`;
      }
    } else {
      $("hskAIResult").innerHTML = "";
    }

  } catch (e) {
    console.error(e);
    setError("Lesson load failed: " + (e && e.message ? e.message : e));
  }
}

function bindEvents() {
  const controller = new AbortController();
  const { signal } = controller;

  el = $("hskLevel"); if (el) el.addEventListener("change", async function(e) {
    state.lv = Number(e.target.value || 1);
    showListMode();
    await loadLessons();
    updateProgressBlock();
  }, { signal });

  el = $("hskVersion"); if (el) el.addEventListener("change", async function(e) {
    const ver = (window.HSK_LOADER && typeof window.HSK_LOADER.normalizeVersion === "function" ? window.HSK_LOADER.normalizeVersion(e.target.value) : null) || (e.target.value === "hsk3.0" ? "hsk3.0" : "hsk2.0");
    state.version = ver;
    try { if (window.HSK_LOADER && typeof window.HSK_LOADER.setVersion === "function") window.HSK_LOADER.setVersion(ver); } catch (err) {}
    await loadLessons();
    updateProgressBlock();
    if (state.current && state.current.lessonData) {
      const { lessonNo, file } = state.current;
      await openLesson({ lessonNo, file });
    } else {
      showListMode();
    }
  }, { signal });

  el = $("hskBackToList"); if (el) el.addEventListener("click", function() {
    showListMode();
    el = $("hskLessonListWrap"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, { signal });

  // Review Mode 入口
  function enterReviewMode(mode, lessonId = "", levelKey = "") {
    const container = $("hskReviewContainer");
    if (!container || !renderReviewMode) return;
    const { session, questions } = prepareReviewSession({ mode, lessonId, levelKey });
    if (!questions.length) {
      container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(i18n.t("review_no_wrong_questions"))}</p></div>`;
      container.classList.remove("hidden");
      return;
    }
    container.classList.remove("hidden");
    const doRender = () => {
      const { session: s, questions: qs } = prepareReviewSession({ mode, lessonId, levelKey });
      if (!qs.length) {
        container.innerHTML = `<div class="review-empty-state p-4"><p>${escapeHtml(i18n.t("review_no_wrong_questions"))}</p></div>`;
        return;
      }
      renderReviewMode(container, s, {
        lang: getLang(),
        onFinish: ({ action }) => {
          if (action === "back") {
            container.classList.add("hidden");
            container.innerHTML = "";
          } else if (action === "continue") {
            doRender();
          }
        },
      });
    };
    doRender();
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  el = $("hskReviewLesson"); if (el) el.addEventListener("click", function() {
    const lessonId = (state.current && state.current.lessonData && state.current.lessonData.id) || (state.current ? getCourseId() + "_lesson" + state.current.lessonNo : "");
    if (!lessonId) {
      const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), (state.lessons && state.lessons.length) || 0) : null) || {};
      const lastNo = stats.lastLessonNo || 1;
      enterReviewMode("lesson", `${getCourseId()}_lesson${lastNo}`);
    } else {
      enterReviewMode("lesson", lessonId);
    }
  }, { signal });

  el = $("hskReviewLevel"); if (el) el.addEventListener("click", function() {
    enterReviewMode("level", "", getCourseId());
  }, { signal });

  el = $("hskReviewAll"); if (el) el.addEventListener("click", function() {
    enterReviewMode("all");
  }, { signal });

  el = $("hskReviewBtn"); if (el) el.addEventListener("click", function() {
    const lessonId = (state.current && state.current.lessonData && state.current.lessonData.id) || (state.current ? getCourseId() + "_lesson" + state.current.lessonNo : "");
    enterReviewMode("lesson", lessonId);
  }, { signal });

  // Lesson click (delegate)
  el = $("hskLessonList"); if (el) el.addEventListener("click", function(e) {
    const btn = e.target.closest('button[data-open-lesson="1"]');
    if (!btn) return;
    const lessonNo = Number(btn.dataset.lessonNo || 1);
    const file = btn.dataset.file || "";
    openLesson({ lessonNo, file });
  }, { signal });

  // 点读：会话 / 扩展 / 语法 / 练习区点击中文
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-speak-text][data-speak-kind='dialogue'], [data-speak-text][data-speak-kind='extension'], [data-speak-text][data-speak-kind='grammar'], [data-speak-text][data-speak-kind='practice']");
    if (!el) return;
    const text = (el.dataset && el.dataset.speakText || "").trim();
    if (!text || !(AUDIO_ENGINE && typeof AUDIO_ENGINE.isSpeechSupported === "function" && AUDIO_ENGINE.isSpeechSupported())) return;
    e.preventDefault();
    e.stopPropagation();
    AUDIO_ENGINE.stop();
    document.querySelectorAll(".is-speaking").forEach((x) => x.classList.remove("is-speaking"));
    const lineEl = el.closest(".lesson-dialogue-line") || el.closest(".lesson-extension-card") || el.closest(".lesson-grammar-card") || el.closest(".lesson-practice-card") || el.closest(".review-question-card") || el.closest(".lesson-practice-option");
    if (lineEl) lineEl.classList.add("is-speaking");
    AUDIO_ENGINE.playText(text, {
      lang: "zh-CN",
      onEnd: function() { if (lineEl) lineEl.classList.remove("is-speaking"); },
      onError: function() { if (lineEl) lineEl.classList.remove("is-speaking"); },
    });
  }, { signal });

  // Tabs
  el = $("hskStudyTabs"); if (el) el.addEventListener("click", function(e) {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    updateTabsUI();

    const step = state.tab === "ai" ? "aiPractice" : state.tab;
    if (state.current && state.current.lessonData) {
      const courseId = getCourseId();
      const lessonId = (state.current.lessonData && state.current.lessonData.id) || (courseId + "_lesson" + state.current.lessonNo);
      if (PROGRESS_ENGINE && typeof PROGRESS_ENGINE.markStepCompleted === "function") PROGRESS_ENGINE.markStepCompleted({ courseId: courseId, lessonId: lessonId, step: step });
      updateProgressBlock();
    }

    if (state.tab === "ai") {
      // keep it light; user can click copy
    }
  }, { signal });

  // Search filter (client-side)
  el = $("hskSearch"); if (el) el.addEventListener("input", function() {
    const q = String(($("hskSearch") && $("hskSearch").value) || "").trim().toLowerCase();
    const lang = getLang();
    const listEl = $("hskLessonList");
    if (!listEl) return;

    const filtered = !q
      ? state.lessons
      : state.lessons.filter((it) => {
          const title = JSON.stringify((it && it.title) || (it && it.name) || "").toLowerCase();
          const pinyin = String((it && it.pinyinTitle) || (it && it.pinyin) || "").toLowerCase();
          const file = String((it && it.file) || "").toLowerCase();
          return title.includes(q) || pinyin.includes(q) || file.includes(q);
        });

    const total = (state.lessons && state.lessons.length) || 0;
    const stats = (PROGRESS_SELECTORS && typeof PROGRESS_SELECTORS.getCourseStats === "function" ? PROGRESS_SELECTORS.getCourseStats(getCourseId(), total) : null) || {};
    renderLessonList(listEl, filtered, { lang: lang, currentLessonNo: stats.lastLessonNo || 0 });
  }, { signal });

  // AI: copy context
  el = $("hskAICopyContext"); if (el) el.addEventListener("click", async function() {
    const ctx = buildAIContext();
    const pre = $("hskAIContext");
    if (pre) {
      pre.textContent = ctx;
      pre.classList.remove("hidden");
    }
    try { await navigator.clipboard.writeText(ctx); } catch {}
  }, { signal });

  // AI: send (placeholder – integrate later with your AI backend / step runner)
  el = $("hskAISend"); if (el) el.addEventListener("click", async function() {
  const input = String(($("hskAIInput") && $("hskAIInput").value) || "").trim();
  const out = $("hskAIResult");
  if (!out) return;

  if (!input) {
    out.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("hsk_ai_empty"))}</div>`;
    return;
  }

  const lang = getLang(); // "ko" | "zh"
  const context = buildAIContext();

  // UI: loading
  out.innerHTML = `<div class="text-sm opacity-70">${escapeHtml(i18n.t("common_loading"))}</div>`;

  try {
    if (!window.JOY_RUNNER || typeof window.JOY_RUNNER.askAI !== "function") {
      throw new Error("JOY_RUNNER.askAI not found. (Did you patch lessonStepRunner.js?)");
    }

    // ✅ Call StepRunner AI
    const res = await window.JOY_RUNNER.askAI({
      prompt: input,
      context,
      lang,
      mode: "Kids",
    });

    const text = (res && res.text) || "";

    out.innerHTML = `
      <div class="border rounded-xl p-3">
        <div class="text-xs opacity-60 mb-2">AI</div>
        <div class="text-sm whitespace-pre-wrap">${escapeHtml(text)}</div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    out.innerHTML = `
      <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
        AI error: ${escapeHtml(e && e.message ? e.message : e)}
      </div>
      <div class="text-xs opacity-60 mt-2">
        체크: ① lessonStepRunner.js에 JOY_RUNNER.askAI 추가했는지
        ② aiAsk/AI.ask/JOY_AI.ask 중 하나가 실제로 존재하는지
        ③ 또는 /api/ai-chat 엔드포인트가 있는지
      </div>
    `;
  }
});

  // joy:langChanged — 统一事件名，state-driven 全量重渲染
  window.addEventListener("joy:langChanged", (e) => {
    const newLang = (e && e.detail && e.detail.lang) || getLang();
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[HSK] joy:langChanged received ->", newLang);
    }
    if (!isHSKPageActive()) return;

    try { i18n.apply(document); } catch {}
    setSubTitle();
    rerenderHSKFromState();
  }, { signal });

  // i18n bus
  try {
    if (i18n && typeof i18n.on === "function") i18n.on("change", function() { window.dispatchEvent(new CustomEvent("joy:langChanged", { detail: { lang: i18n?.getLang?.() } })); });
  } catch {}
}

export async function mount() {
  const navRoot = $("siteNav");
  const app = $("app");
  if (!navRoot || !app) {
    console.error("HSK Page Error: missing #siteNav or #app");
    return false;
  }

  await ensureHSKDeps();

  // ✅ 预加载 glossary（HSK1 的 kr/en/jp），供词卡释义回退
  const scope = `hsk${state.lv}`;
  loadGlossary("kr", scope).catch(() => {});
  loadGlossary("en", scope).catch(() => {});
  loadGlossary("jp", scope).catch(() => {});

  // ✅ mini nav: Home + Lang only
  navRoot.dataset.mode = "mini";
  mountNavBar(navRoot);

  app.innerHTML = getHSKLayoutHTML();

  // init controls — sync version from localStorage（仅允许 hsk2.0 / hsk3.0）
  const savedVer = localStorage.getItem("hsk_vocab_version") || state.version;
  state.version = (window.HSK_LOADER && typeof window.HSK_LOADER.normalizeVersion === "function" ? window.HSK_LOADER.normalizeVersion(savedVer) : null) || (savedVer === "hsk3.0" ? "hsk3.0" : "hsk2.0");
  $("hskLevel") && ($("hskLevel").value = String(state.lv));
  $("hskVersion") && ($("hskVersion").value = String(state.version));

  try { i18n.apply(document); } catch {}

  bindWordCardActions();
  bindEvents();
  await loadLessons();
  showListMode();
  return true;
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stringifyMaybe(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}
