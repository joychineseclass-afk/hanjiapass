// /ui/modules/hsk/ui/hskIndex.js
// ✅ Index + filtering helpers

import { safeText, normalizeWord } from "./hskDom.js";

/** 从词条或字符串提取 hanzi（lesson-vocab 解耦：lesson 可只存 words: ["好","你","我"]） */
function extractHanzi(w) {
  if (w == null) return "";
  if (typeof w === "string") return normalizeWord(w);
  return normalizeWord(w?.hanzi ?? w?.word ?? w?.zh ?? w?.cn ?? "");
}

export function buildAllMap(ALL) {
  const map = new Map();
  for (const w of ALL || []) {
    const key = extractHanzi(w);
    if (key && !map.has(key)) map.set(key, w);
  }
  return map;
}

/** lesson.words 可为 ["好","你","我"] 或 [{hanzi:"好"},...]，释义从 vocab 按 hanzi 查；未命中则用占位词条 */
export function buildLessonWordList(lesson, allMap) {
  const raw = Array.isArray(lesson?.words) ? lesson.words : [];
  const keys = raw.map(extractHanzi).filter(Boolean);
  const seen = new Set();

  const list = [];
  let missing = 0;
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    const found = allMap.get(k);
    if (found) {
      list.push(found);
    } else {
      missing++;
      list.push({
        hanzi: k,
        word: k,
        pinyin: "",
        meaning: { zh: "", en: "", ko: "" },
        tags: { generated: true },
        meta: {},
      });
    }
  }
  return { list, missing };
}

export function filterWordList(list, q) {
  const qq = safeText(q).toLowerCase();
  if (!qq) return list || [];

  return (list || []).filter((x) => {
    const blob = `${x.word ?? ""} ${x.pinyin ?? ""} ${JSON.stringify(
      x.meaning ?? ""
    )} ${JSON.stringify(x.example ?? "")}`.toLowerCase();
    return blob.includes(qq);
  });
}

export function buildLessonIndex({ LESSONS, ALL }) {
  if (!Array.isArray(LESSONS) || LESSONS.length === 0) return null;

  const allMap = buildAllMap(ALL);
  const lessons = LESSONS.map((lesson, idx) => {
    const title = safeText(lesson?.title) || `Lesson ${lesson?.id ?? idx + 1}`;
    const subtitle = safeText(lesson?.subtitle);

    const { list, missing } = buildLessonWordList(lesson, allMap);

    const wordsBlob = list
      .map(
        (w) =>
          `${w.word ?? ""} ${w.pinyin ?? ""} ${JSON.stringify(
            w.meaning ?? ""
          )} ${JSON.stringify(w.example ?? "")}`
      )
      .join(" | ");

    const blob = `${title} ${subtitle} ${wordsBlob}`.toLowerCase();

    return { idx, key: lesson?.id ?? idx, lesson, wordsResolved: list, missing, blob };
  });

  return { lessons };
}

export function getLessonMatches({ LESSON_INDEX, query }) {
  if (!LESSON_INDEX?.lessons) return [];
  const q = safeText(query).toLowerCase();

  if (!q) {
    return LESSON_INDEX.lessons.map((it) => ({
      ...it,
      matchCount: it.wordsResolved.length,
      hitType: "all",
    }));
  }

  return LESSON_INDEX.lessons
    .filter((it) => it.blob.includes(q))
    .map((it) => {
      const matchCount = it.wordsResolved.reduce((acc, w) => {
        const wb = `${w.word ?? ""} ${w.pinyin ?? ""} ${JSON.stringify(
          w.meaning ?? ""
        )} ${JSON.stringify(w.example ?? "")}`.toLowerCase();
        return acc + (wb.includes(q) ? 1 : 0);
      }, 0);
      return { ...it, matchCount, hitType: matchCount > 0 ? "words" : "title" };
    });
}
