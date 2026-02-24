// /ui/modules/hsk/ui/hskIndex.js
// ✅ Index + filtering helpers

import { safeText, normalizeWord } from "./hskDom.js";

export function buildAllMap(ALL) {
  const map = new Map();
  for (const w of ALL || []) {
    const key = normalizeWord(w?.word);
    if (key && !map.has(key)) map.set(key, w);
  }
  return map;
}

export function buildLessonWordList(lesson, allMap) {
  const raw = Array.isArray(lesson?.words) ? lesson.words : [];
  const keys = raw.map(normalizeWord).filter(Boolean);
  const set = new Set(keys);

  const list = [];
  let missing = 0;
  for (const k of set) {
    const found = allMap.get(k);
    if (found) list.push(found);
    else missing++;
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
