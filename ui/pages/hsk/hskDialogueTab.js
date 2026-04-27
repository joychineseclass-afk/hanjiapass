// /ui/pages/hsk/hskDialogueTab.js
// HSK Dialogue tab rendering (split from page.hsk.js Step 3).
// - HSK2.0 standard dialogue cards
// - HSK3.0 · HSK1 scene-canvas dialogue variant
// - Review-mode dialogue delegated to hskRenderer.renderReviewDialogue
//
// ctx:
// {
//   lessonData,
//   lang,
//   isReviewLesson,
//   isHsk30Hsk1SceneCanvas, // prebuilt by page.hsk.js
//   isHsk30Hsk1SpeakPilot,  // prebuilt by page.hsk.js
// }

import { i18n } from "../../i18n.js";
import {
  resolvePinyin,
  maybeGetManualPinyin,
  shouldShowPinyin,
  normalizePinyinDisplayAllLowercase,
} from "../../utils/pinyinEngine.js";
import { SCENE_ENGINE } from "../../platform/index.js";
import * as SceneRenderer from "../../platform/scene/sceneRenderer.js";
import { getLocalizedSceneText } from "../../platform/scene/sceneUtils.js";
import { renderReviewDialogue } from "../../modules/hsk/hskRenderer.js";
import {
  escapeHtml,
  trimStr,
  getStrictLangText,
  normalizePracticeLangAliases,
} from "./hskPageUtils.js";

/**
 * Unified dialogue cards extractor:
 * generatedDialogues > structuredDialogues > dialogueCards > dialogue
 */
export function getDialogueCards(lesson) {
  const arr =
    lesson && Array.isArray(lesson.generatedDialogues) && lesson.generatedDialogues.length
      ? lesson.generatedDialogues
      : lesson && Array.isArray(lesson.structuredDialogues) && lesson.structuredDialogues.length
      ? lesson.structuredDialogues
      : lesson && Array.isArray(lesson.dialogueCards) && lesson.dialogueCards.length
      ? lesson.dialogueCards
      : lesson && Array.isArray(lesson.dialogue) && lesson.dialogue.length
      ? lesson.dialogue
      : [];

  if (!arr.length) return [];

  const first = arr[0];
  const isCard = first && first.lines && Array.isArray(first.lines);
  const isLine =
    first &&
    (first.speaker != null ||
      first.spk != null ||
      first.cn != null ||
      first.zh != null ||
      first.text != null);

  if (isCard) return arr;
  if (isLine) return [{ title: null, lines: arr }];
  return [];
}

/**
 * Dialogue translation - strict within current language family only.
 * No cross-language fallback here.
 */
export function getDialogueTranslation(item, lang) {
  if (!item || typeof item !== "object") return "";

  const l = normalizePracticeLangAliases(lang);
  const str = (v) => trimStr(v);

  const trans = item.translation ?? item.trans ?? item.translations;
  if (trans && typeof trans === "object") {
    if (l === "kr") return str(trans.kr) || str(trans.ko) || "";
    if (l === "jp") return str(trans.jp) || str(trans.ja) || "";
    if (l === "cn") return str(trans.cn) || str(trans.zh) || "";
    return str(trans.en) || "";
  }

  if (l === "kr") {
    return str(item.kr) || str(item.ko) || str(item.translationKr) || str(item.translation_kr) || "";
  }
  if (l === "jp") {
    return str(item.jp) || str(item.ja) || str(item.translationJp) || str(item.translation_jp) || "";
  }
  if (l === "cn") {
    return str(item.cn) || str(item.zh) || str(item.translationCn) || str(item.translation_cn) || "";
  }
  return str(item.en) || str(item.translationEn) || str(item.translation_en) || "";
}

/** Current-language dialogue translation, hiding self-echo translation. */
export function pickDialogueTranslation(line, zhMain, lang) {
  const out = getDialogueTranslation(line, lang);
  if (out && zhMain && out === zhMain) return "";
  return out;
}

/** Dialogue / scene / review card title — strict current lang first, then zh. */
function pickCardTitle(obj, cardIndex, lang) {
  if (obj != null && typeof obj === "string") return obj.trim();

  const l = normalizePracticeLangAliases(lang);
  const v =
    getStrictLangText(obj, l) ||
    trimStr(obj && obj.zh) ||
    trimStr(obj && obj.cn) ||
    "";

  if (v) return v;

  const sessionText = i18n.t("dialogue.session", { n: cardIndex });
  if (sessionText && sessionText !== "dialogue.session") return sessionText;
  return (i18n.t("lesson.dialogue_card") || "会话") + cardIndex;
}

/** Optional multilingual / string scene summary. */
function pickCardSummary(summaryObj, lang) {
  if (summaryObj == null) return "";
  if (typeof summaryObj === "string") return summaryObj.trim();

  const l = normalizePracticeLangAliases(lang);
  return (
    getStrictLangText(summaryObj, l) ||
    trimStr(summaryObj && summaryObj.zh) ||
    trimStr(summaryObj && summaryObj.cn) ||
    ""
  );
}

/**
 * Session card heading for scene-canvas layout:
 * - If a ｜/| separator exists, prefer tail.
 * - Otherwise strip common "会话一 / Dialogue 1" prefix.
 * - Fallback to original.
 */
function pickCardHeadingPrimary(titleObj, cardIndex, lang) {
  const full = pickCardTitle(titleObj, cardIndex, lang).trim();
  if (!full) return "";

  const parts = full.split(/[｜|]/);
  if (parts.length >= 2) {
    const tail = parts.slice(1).join("｜").trim();
    if (tail) return tail;
  }

  const head = parts[0].trim();
  const stripped = stripDialogueCardTitleSessionPrefix(head);
  if (stripped && stripped !== head) return stripped;
  return full;
}

function stripDialogueCardTitleSessionPrefix(text) {
  let s = String(text || "").trim();
  if (!s) return s;

  const rules = [
    /^会话\s*[一二三四五六七八九十百千两〇零0-9]{1,4}\s*[：:｜|\-－—]?\s*/u,
    /^对话\s*[一二三四五六七八九十百千两〇零0-9]{1,4}\s*[：:｜|\-－—]?\s*/u,
    /^会话\s*\d{1,2}\s*[：:｜|\-－—]?\s*/,
    /^对话\s*\d{1,2}\s*[：:｜|\-－—]?\s*/,
    /^Dialogue\s*\d{1,2}\s*[：:.｜|\-－—]?\s*/i,
    /^Session\s*\d{1,2}\s*[：:.｜|\-－—]?\s*/i,
    /^회화\s*\d{1,2}\s*[：:.｜|\-－—]?\s*/u,
    /^第\s*\d{1,2}\s*[课課]\s*[｜|]?\s*/,
  ];

  for (const re of rules) {
    const next = s.replace(re, "").trim();
    if (next !== s) return next || s;
  }
  return s;
}

function dialogueSessionAriaLabel(sessionIndex1Based) {
  const t = i18n.t("dialogue.session", { n: sessionIndex1Based });
  if (t && t !== "dialogue.session") return t;
  return `Session ${sessionIndex1Based}`;
}

/** Session intro utterance for bulk TTS (used by page.hsk.js). */
export function dialogueSessionIntroTts(sessionIndex1Based, lang) {
  const l = normalizePracticeLangAliases(lang);
  const n = Number(sessionIndex1Based) || 1;
  if (l === "kr") return `회화 ${n}`;
  if (l === "jp") return `会話 ${n}`;
  if (l === "cn") return `对话 ${n}`;
  return `Dialogue ${n}`;
}

/** One-line lesson strip (scene canvas mode) above the cards. */
function buildHsk30Hsk1SceneCanvasLessonStrip(raw, lang) {
  if (!raw?.scene || typeof raw.scene !== "object" || !SCENE_ENGINE?.getSceneFromLesson) {
    return "";
  }
  const scene = SCENE_ENGINE.getSceneFromLesson(raw);
  if (!scene?.title) return "";
  const title = getLocalizedSceneText(scene.title, lang);
  if (!title) return "";
  return `<p class="hsk1-dialogue-lesson-strip">${escapeHtml(title)}</p>`;
}

/** Render a single dialogue line (HSK2.0 default layout). */
function renderDialogueLine(line, lang, showPinyin, speakPilot) {
  const spk = String((line && line.spk) || (line && line.speaker) || "").trim();
  const zh = String(
    (line && line.text) ||
      (line && line.zh) ||
      (line && line.cn) ||
      (line && line.line) ||
      ""
  ).trim();

  let py = maybeGetManualPinyin(line, "dialogue");
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);

  const trans = pickDialogueTranslation(line, zh, lang);
  const transTrim = trans ? String(trans).trim() : "";
  let zhAttrs = zh
    ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"`
    : "";
  if (zh && speakPilot && transTrim) {
    zhAttrs += ` data-speak-translation="${escapeHtml(transTrim).replaceAll('"', "&quot;")}"`;
  }

  const zAttrQ = escapeHtml(zh).replaceAll('"', "&quot;");
  const trAttrQ = escapeHtml(transTrim).replaceAll('"', "&quot;");
  const lineLoopBtn =
    zh && speakPilot && transTrim
      ? `<button type="button" class="hsk-dialogue-line-loopbtn" data-speak-text="${zAttrQ}" data-speak-translation="${trAttrQ}" aria-label="반복" title="반복">🔁</button>`
      : "";

  return `<article class="lesson-dialogue-line">
  ${spk ? `<div class="lesson-dialogue-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="hsk-dialogue-zh-row">${zh ? `<div class="lesson-dialogue-zh"${zhAttrs}>${escapeHtml(zh)}</div>${lineLoopBtn}` : ""}</div>
  ${py ? `<div class="lesson-dialogue-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation">${escapeHtml(trans)}</div>` : ""}
</article>`;
}

/** lines[].align reservation — left/right/center, else alternate by index. */
function resolveSceneCanvasBubbleSide(line, lineIndex0) {
  const a = String((line && line.align) || "").trim().toLowerCase();
  if (a === "left" || a === "right" || a === "center") return a;
  return lineIndex0 % 2 === 0 ? "left" : "right";
}

/** lines[].position.{x,y} reservation — data-only, no layout change. */
function sceneCanvasLinePositionDataAttrs(line) {
  const pos = line && line.position;
  if (!pos || typeof pos !== "object") return "";
  const x = pos.x;
  const y = pos.y;
  const esc = (v) => escapeHtml(String(v)).replaceAll('"', "&quot;");
  const parts = [];
  if (x != null && String(x).trim() !== "") parts.push(`data-pos-x="${esc(x)}"`);
  if (y != null && String(y).trim() !== "") parts.push(`data-pos-y="${esc(y)}"`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** dialogueCards[].sceneImage / bubbleStyle reservation — data-only. */
function sceneCanvasCardReservedDataAttrs(card, lines) {
  const parts = [];
  const img = card && card.sceneImage;
  if (img != null && String(img).trim() !== "") {
    parts.push(`data-scene-image="${escapeHtml(String(img).trim()).replaceAll('"', "&quot;")}"`);
  }
  const bstyle = card && card.bubbleStyle;
  if (bstyle != null && String(bstyle).trim() !== "") {
    parts.push(`data-bubble-style="${escapeHtml(String(bstyle).trim()).replaceAll('"', "&quot;")}"`);
  }
  const hasFreePos =
    Array.isArray(lines) &&
    lines.some((ln) => {
      const p = ln && ln.position;
      return p && typeof p === "object" && (p.x != null || p.y != null);
    });
  if (hasFreePos) parts.push(`data-layout="free"`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** Scene-canvas-mode bubble line (keep lesson-dialogue-line for speak highlight). */
function renderDialogueLineSceneCanvasBubble(line, lang, showPinyin, lineIndex0, speakPilot) {
  const spk = String((line && line.spk) || (line && line.speaker) || "").trim();
  const zh = String(
    (line && line.text) ||
      (line && line.zh) ||
      (line && line.cn) ||
      (line && line.line) ||
      ""
  ).trim();

  let py = maybeGetManualPinyin(line, "dialogue");
  if (showPinyin && zh && !py) py = resolvePinyin(zh, py);
  if (py) py = normalizePinyinDisplayAllLowercase(py);

  const trans = pickDialogueTranslation(line, zh, lang);
  const transTrim = trans ? String(trans).trim() : "";
  let zhAttrs = zh
    ? ` data-speak-text="${escapeHtml(zh).replaceAll('"', "&quot;")}" data-speak-kind="dialogue"`
    : "";
  if (zh && speakPilot && transTrim) {
    zhAttrs += ` data-speak-translation="${escapeHtml(transTrim).replaceAll('"', "&quot;")}"`;
  }

  const zAttrQSc = zh ? escapeHtml(zh).replaceAll('"', "&quot;") : "";
  const trAttrQSc = transTrim ? escapeHtml(transTrim).replaceAll('"', "&quot;") : "";
  const sceneLineLoopBtn =
    zh && speakPilot && transTrim
      ? `<button type="button" class="hsk-dialogue-line-loopbtn" data-speak-text="${zAttrQSc}" data-speak-translation="${trAttrQSc}" aria-label="반복" title="반복">🔁</button>`
      : "";

  const side = resolveSceneCanvasBubbleSide(line, lineIndex0);
  const sideClass =
    side === "right"
      ? "hsk1-scene-bubble-line--right"
      : side === "center"
        ? "hsk1-scene-bubble-line--center"
        : "hsk1-scene-bubble-line--left";

  const posAttrs = sceneCanvasLinePositionDataAttrs(line);

  return `<article class="lesson-dialogue-line hsk1-scene-bubble-line ${sideClass}"${posAttrs}>
  <div class="hsk1-scene-bubble">
  ${spk ? `<div class="hsk1-scene-bubble-speaker">${escapeHtml(spk)}</div>` : ""}
  <div class="hsk1-scene-bubble-zh-row">${zh ? `<div class="lesson-dialogue-zh hsk1-scene-bubble-zh"${zhAttrs}>${escapeHtml(zh)}</div>${sceneLineLoopBtn}` : ""}</div>
  ${py ? `<div class="lesson-dialogue-pinyin hsk1-scene-bubble-pinyin">${escapeHtml(py)}</div>` : ""}
  ${trans ? `<div class="lesson-dialogue-translation hsk1-scene-bubble-trans">${escapeHtml(trans)}</div>` : ""}
  </div>
</article>`;
}

function buildHsk30Hsk1SceneCanvasDialogueHTML(raw, cards, lang, showPinyin, speakPilot) {
  const fullSpeakLabel = escapeHtml(i18n.t("hsk.dialogue_speak_full"));
  const fullSpeakBtn = speakPilot
    ? `<button type="button" class="hsk-dialogue-speak-full-btn" id="hskDialogueSpeakFullBtn" aria-label="${fullSpeakLabel}" title="${fullSpeakLabel}">${fullSpeakLabel}</button>`
    : "";
  const fullSpeakLoopBtn = speakPilot
    ? `<button type="button" class="hsk-dialogue-speak-loop-btn" id="hskDialogueSpeakFullLoopBtn" aria-label="🔁 전체 회화 반복" title="🔁 전체 회화 반복">🔁 전체 회화 반복</button>`
    : "";

  const lessonStripInner = buildHsk30Hsk1SceneCanvasLessonStrip(raw, lang);

  const heroHead =
    speakPilot && !lessonStripInner
      ? `<div class="hsk-dialogue-hero-head hsk-dialogue-hero-head--with-speak" id="hskDialogueBulkSpeakAnchor">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  ${fullSpeakBtn}${fullSpeakLoopBtn}
</div>`
      : `<h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>`;

  const heroCanvas = `<section class="lesson-section-hero lesson-dialogue-hero hsk1-dialogue-hero--scene-canvas">
  ${heroHead}
</section>`;

  const lessonStripWrap =
    lessonStripInner && speakPilot
      ? `<div class="hsk1-dialogue-lesson-strip-wrap hsk1-dialogue-topic-row" id="hskDialogueBulkSpeakAnchor">${lessonStripInner}${fullSpeakBtn}${fullSpeakLoopBtn}</div>`
      : lessonStripInner
        ? `<div class="hsk1-dialogue-lesson-strip-wrap">${lessonStripInner}</div>`
        : "";

  const blocks = cards
    .map((card, index) => {
      const lines = Array.isArray(card && card.lines) ? card.lines : [];
      if (!lines.length) return "";
      const sessionNo = index + 1;
      const noLabel = String(sessionNo).padStart(2, "0");
      const aria = dialogueSessionAriaLabel(sessionNo);
      const headingPrimary = pickCardHeadingPrimary(card && card.title, sessionNo, lang);
      const summaryText = pickCardSummary(card && card.summary, lang);
      const cardReservedAttrs = sceneCanvasCardReservedDataAttrs(card, lines);
      const lineHtml = lines
        .map((line, li) => renderDialogueLineSceneCanvasBubble(line, lang, showPinyin, li, speakPilot))
        .join("");

      return `<section class="lesson-dialogue-card hsk1-dialogue-scene-card"${cardReservedAttrs}>
  <header class="hsk1-dialogue-scene-card-head">
    <div class="hsk1-dialogue-scene-card-head-row">
      <span class="hsk1-dialogue-scene-card-no" aria-label="${escapeHtml(aria).replaceAll('"', "&quot;")}">${escapeHtml(noLabel)}</span>
      <h4 class="hsk1-dialogue-scene-card-heading">${escapeHtml(headingPrimary)}</h4>
    </div>
    ${summaryText ? `<p class="hsk1-dialogue-scene-card-summary">${escapeHtml(summaryText)}</p>` : ""}
  </header>
  <div class="hsk1-dialogue-canvas">
    <div class="hsk1-dialogue-bubbles">${lineHtml}</div>
  </div>
</section>`;
    })
    .filter(Boolean)
    .join("\n");

  return `${heroCanvas}${lessonStripWrap}<div class="lesson-dialogue-list hsk1-dialogue-scene-list">${blocks}</div>`;
}

/** Build dialogue tab HTML (non-review). */
export function buildDialogueHTML(lessonData, ctx) {
  const { lang, isHsk30Hsk1SceneCanvas, isHsk30Hsk1SpeakPilot } = ctx || {};
  const raw = (lessonData && lessonData._raw) || lessonData;
  const cards = getDialogueCards(raw);
  const speakPilot = !!isHsk30Hsk1SpeakPilot;

  const hero = `<section class="lesson-section-hero lesson-dialogue-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.dialogue_subtitle"))}</p>
</section>`;

  if (!cards.length) {
    return `${hero}<div class="lesson-empty-state">${escapeHtml(i18n.t("hsk.empty_dialogue"))}</div>`;
  }

  if (
    SCENE_ENGINE &&
    typeof SCENE_ENGINE.hasScene === "function" &&
    SCENE_ENGINE.hasScene(lessonData)
  ) {
    const scene = SCENE_ENGINE.getSceneFromLesson(lessonData);
    const framesHtml = SceneRenderer.renderSceneFrames(scene, lessonData, lang);
    if (framesHtml) return hero + framesHtml;
  }

  const showPinyin = shouldShowPinyin({
    level: lessonData && lessonData.level,
    version: lessonData && lessonData.version,
  });

  if (isHsk30Hsk1SceneCanvas) {
    return buildHsk30Hsk1SceneCanvasDialogueHTML(raw, cards, lang, showPinyin, speakPilot);
  }

  return `${hero}<div class="lesson-dialogue-list">
${cards
  .map((card, index) => {
    const lines = Array.isArray(card && card.lines) ? card.lines : [];
    if (!lines.length) return "";
    const titleText = pickCardTitle(card && card.title, index + 1, lang);
    const lineHtml = lines.map((line) => renderDialogueLine(line, lang, showPinyin, speakPilot)).join("");
    return `<section class="lesson-dialogue-card">
    <h4 class="lesson-dialogue-card-title">${escapeHtml(titleText)}</h4>
    <div class="lesson-dialogue-lines">${lineHtml}</div>
  </section>`;
  })
  .filter(Boolean)
  .join("\n")}
</div>`;
}

/** Render dialogue tab into container (#hskDialogueBody). */
export function renderHskDialogueTab(container, ctx) {
  if (!container) return;
  const { lessonData, lang, isReviewLesson } = ctx || {};

  if (isReviewLesson) {
    renderReviewDialogue(container, lessonData, { lang });
    return;
  }

  container.innerHTML = buildDialogueHTML(lessonData, ctx);
}
