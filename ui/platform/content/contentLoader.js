// ui/platform/content/contentLoader.js
// Content Layer 统一入口：loadCourse / loadStroke / loadHanja / loadClassroom
// 兼容 DATA_PATHS、HSK_LOADER，不改动现有 loader 实现

import { ensureHSKDeps } from "../../modules/hsk/hskDeps.js";

function safeStr(x) {
  return String(x ?? "").trim();
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return await res.json();
}

function getTrackDefault() {
  return localStorage.getItem("hsk_vocab_version") || "hsk2.0";
}

function legacyHskToLessonDoc(raw, { track, level, lessonNo, file }) {
  const id = `hsk|${track}|lv${level}|lesson${lessonNo}`;
  return {
    schemaVersion: "lesson.v1",
    id,
    course: { type: "hsk", track, level, lessonNo, tags: [] },
    i18n: {
      title: { zh: raw?.title || "", ko: "" },
      topic: { zh: raw?.topic || "", ko: "" },
    },
    content: {
      words: Array.isArray(raw?.words)
        ? raw.words.map((w) => ({ hanzi: typeof w === "string" ? w : w?.hanzi || w?.word || "" }))
        : [],
      dialogue: Array.isArray(raw?.dialogue) ? raw.dialogue : [],
      grammar: Array.isArray(raw?.grammar)
        ? raw.grammar.map((g) => ({
            title: { zh: g?.title || "", ko: "" },
            explain: { zh: g?.explanation_zh || "", ko: g?.explanation_kr || "" },
            examples: g?.example ? [g.example] : [],
          }))
        : [],
      practice: Array.isArray(raw?.practice) ? raw.practice : [],
    },
    ai: {
      speakingPhrases: raw?.ai_interaction?.speaking || [],
      coachHint: raw?.ai_interaction?.chat_prompt || "",
    },
    source: { kind: "legacy-hsk", legacyFile: file || "" },
  };
}

async function loadHskIndex({ track, level }) {
  await ensureHSKDeps();
  if (window.HSK_LOADER?.loadLessons) {
    return await window.HSK_LOADER.loadLessons(level, { version: track });
  }
  const idxUrl =
    window.DATA_PATHS?.lessonsIndexUrl?.(level) ||
    `./data/lessons/${track}/hsk${level}.json`;
  return await fetchJson(idxUrl);
}

async function loadHskLesson({ track, level, lessonNo, file }) {
  await ensureHSKDeps();
  if (window.HSK_LOADER?.loadLessonDetail) {
    const raw = await window.HSK_LOADER.loadLessonDetail(level, lessonNo, {
      version: track,
      file,
    });
    return {
      raw,
      doc: legacyHskToLessonDoc(raw, { track, level, lessonNo, file }),
    };
  }
  const url =
    window.DATA_PATHS?.lessonDetailUrl?.(level, lessonNo, { file }) ||
    `./data/lessons/${track}/${file || `hsk${level}_lesson${lessonNo}.json`}`;
  const raw = await fetchJson(url);
  return {
    raw,
    doc: legacyHskToLessonDoc(raw, { track, level, lessonNo, file: url }),
  };
}

async function loadStroke({ char }) {
  const ch = safeStr(char);
  if (!ch) throw new Error("stroke char required");
  const cp = [...ch][0]?.codePointAt?.(0) || 0;
  if (!cp) throw new Error("stroke char invalid");
  const url =
    window.DATA_PATHS?.strokeUrl?.(ch) || `./data/strokes/${cp}.svg`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Stroke SVG not found: ${url}`);
  const svgText = await res.text();
  return { char: ch, url, svgText };
}

export const CONTENT = {
  async loadCourseIndex({ type, track, level }) {
    const t = safeStr(type);
    if (t === "hsk")
      return await loadHskIndex({
        track: track || getTrackDefault(),
        level: Number(level || 1),
      });
    throw new Error(`Unsupported course type: ${t}`);
  },

  async loadLesson({ type, track, level, lessonNo, file }) {
    const t = safeStr(type);
    if (t === "hsk")
      return await loadHskLesson({
        track: track || getTrackDefault(),
        level: Number(level || 1),
        lessonNo: Number(lessonNo || 1),
        file: safeStr(file),
      });
    throw new Error(`Unsupported course type: ${t}`);
  },

  loadStroke,

  async searchHanja({ q, level, limit } = {}) {
    return {
      q: safeStr(q),
      level: level ?? null,
      limit: limit ?? 20,
      hits: [],
    };
  },

  async loadClassroom({ classId } = {}) {
    const id = safeStr(classId);
    if (!id) return { classes: [] };
    const url = `./data/classroom/mvp/class_${encodeURIComponent(id)}.json`;
    try {
      return await fetchJson(url);
    } catch {
      return { classId: id, assignments: [], students: [] };
    }
  },
};

try {
  window.CONTENT = CONTENT;
  window.CONTENT_LOADER = CONTENT;
} catch {}
