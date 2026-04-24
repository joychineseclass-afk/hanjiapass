// /ui/pages/hsk/hskAiTab.js
// HSK AI-Learning tab mounting (split from page.hsk.js Step 7).
// Current behaviour: thin wrapper around AI_CAPABILITY.mountAIPanel.
// No new AI logic is added in this refactor step; UI / entry state unchanged.
//
// ctx:
// {
//   lessonData,
//   lessonWords,   // panel word list (for optional context text)
//   lessonNo,
//   lessons,       // course lessons array (for localized heading)
//   lang,
// }

import { i18n } from "../../i18n.js";
import { getLocalizedLessonHeading } from "../../core/languageEngine.js";
import { AI_CAPABILITY } from "../../platform/index.js";
import {
  wordKey,
  wordPinyin,
  wordMeaning,
} from "../../modules/hsk/hskRenderer.js";

/**
 * Build an AI prompt context string (current lesson summary + words list).
 * Used by legacy callers; kept for compatibility.
 */
export function buildAIContext(ctx) {
  const { lessonData, lessons, lessonNo, lessonWords, lang } = ctx || {};
  if (!lessonData) return "";

  const found =
    Array.isArray(lessons)
      ? lessons.find((x) => {
          const n = Number(x?.lessonNo ?? x?.no ?? x?.id ?? x?.lesson ?? x?.index ?? 0) || 0;
          return n === Number(lessonNo);
        })
      : null;
  const heading = getLocalizedLessonHeading(found || lessonData, lang, found ? lessonData : null);

  const words = Array.isArray(lessonWords) ? lessonWords : [];
  const wordsLine = words
    .slice(0, 12)
    .map((w) => {
      const han = wordKey(w);
      const py = wordPinyin(w);
      const mean = wordMeaning(w, lang);
      return `${han}${py ? `(${py})` : ""}${mean ? `: ${mean}` : ""}`;
    })
    .join("\n");

  const questionLabel =
    i18n.t("practice.question_label") ||
    (lang === "jp" ? "質問" : "Question");

  return [
    heading,
    wordsLine ? `Words:\n${wordsLine}` : "",
    "",
    questionLabel + ":",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Mount the AI panel safely. container = #hskAIResult.
 * Falls back silently if AI_CAPABILITY.mountAIPanel is missing/broken.
 */
export function renderHskAiTab(container, ctx) {
  if (!container) return;
  const { lessonData, lang } = ctx || {};

  if (
    AI_CAPABILITY &&
    typeof AI_CAPABILITY.mountAIPanel === "function"
  ) {
    try {
      AI_CAPABILITY.mountAIPanel(container, {
        lesson: lessonData,
        lang,
        wordsWithMeaning: (w) => wordMeaning(w, lang),
      });
      return;
    } catch (e) {
      console.warn("[HSK] AI panel mount failed:", e?.message || e);
    }
  }

  container.innerHTML = "";
}
