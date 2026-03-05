// ui/platform/content/contentLoader.js
// Content Layer 统一入口：loadCourse / loadStroke / loadHanja / loadClassroom
// 兼容 DATA_PATHS、HSK_LOADER，不改动现有 loader 实现
// Path format: data/lessons/${type}/${level}/index.json | lesson${lessonNo}.json

import { ensureHSKDeps } from "../../modules/hsk/hskDeps.js";

const MEM = new Map();
const MEM_TTL = 1000 * 60 * 30;

function safeStr(x) {
  return String(x ?? "").trim();
}

function withBase(relativePath) {
  const p = String(relativePath).replace(/^\/+/, "");
  try {
    const base = window.DATA_PATHS?.getBase?.();
    if (base && String(base).trim())
      return String(base).replace(/\/+$/, "") + "/" + p;
  } catch {}
  return (p.startsWith(".") ? p : "./" + p);
}

function buildCourseIndexUrl(type, level) {
  const levelKey = /^hsk\d+$/i.test(String(level)) ? String(level).toLowerCase() : `hsk${Number(level) || 1}`;
  return withBase(`data/lessons/${type}/${levelKey}/index.json`);
}

function buildLessonUrl(type, level, lessonNo) {
  const levelKey = /^hsk\d+$/i.test(String(level)) ? String(level).toLowerCase() : `hsk${Number(level) || 1}`;
  return withBase(`data/lessons/${type}/${levelKey}/lesson${Number(lessonNo) || 1}.json`);
}

function memGet(key) {
  const hit = MEM.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > MEM_TTL) {
    MEM.delete(key);
    return null;
  }
  return hit.data;
}

function memSet(key, data) {
  MEM.set(key, { ts: Date.now(), data });
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { cache: opts.cache ?? "no-store" });
  if (!res.ok) {
    if (opts.warnOnFail) console.warn("[CONTENT] fetch failed, attempted URL:", url);
    throw new Error(`Fetch failed ${res.status}: ${url}`);
  }
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
  const levelKey = /^hsk\d+$/i.test(String(level)) ? String(level) : `hsk${Number(level) || 1}`;
  const cacheKey = `index:${track}:${levelKey}`;
  const cached = memGet(cacheKey);
  if (cached) return cached;

  const newUrl = buildCourseIndexUrl(track, level);
  try {
    const data = await fetchJson(newUrl, { warnOnFail: false });
    const list = Array.isArray(data) ? data : data?.lessons ?? data?.data ?? [];
    memSet(cacheKey, list);
    return list;
  } catch (e) {
    console.warn("[CONTENT] loadCourseIndex failed, attempted URL:", newUrl);
    await ensureHSKDeps();
    if (window.HSK_LOADER?.loadLessons) {
      const out = await window.HSK_LOADER.loadLessons(Number(level) || 1, { version: track });
      memSet(cacheKey, out);
      return out;
    }
    const fallbackUrl =
      window.DATA_PATHS?.lessonsIndexUrl?.(level) ||
      `./data/lessons/${track}/hsk${Number(level) || 1}.json`;
    const out = await fetchJson(fallbackUrl);
    const list = Array.isArray(out) ? out : out?.lessons ?? out?.data ?? [];
    memSet(cacheKey, list);
    return list;
  }
}

async function loadHskLesson({ track, level, lessonNo, file }) {
  const lv = Number(level) || 1;
  const no = Number(lessonNo) || 1;
  const cacheKey = `lesson:${track}:${lv}:${no}:${file || ""}`;
  const cached = memGet(cacheKey);
  if (cached) return cached;

  const newUrl = buildLessonUrl(track, level, lessonNo);
  try {
    const raw = await fetchJson(newUrl, { warnOnFail: false });
    const result = {
      raw,
      doc: legacyHskToLessonDoc(raw, { track, level: lv, lessonNo: no, file: newUrl }),
    };
    memSet(cacheKey, result);
    return result;
  } catch (e) {
    console.warn("[CONTENT] loadLesson failed, attempted URL:", newUrl);
    await ensureHSKDeps();
    if (window.HSK_LOADER?.loadLessonDetail) {
      const raw = await window.HSK_LOADER.loadLessonDetail(lv, no, {
        version: track,
        file,
      });
      const result = {
        raw,
        doc: legacyHskToLessonDoc(raw, { track, level: lv, lessonNo: no, file }),
      };
      memSet(cacheKey, result);
      return result;
    }
    const fallbackUrl =
      window.DATA_PATHS?.lessonDetailUrl?.(lv, no, { file }) ||
      `./data/lessons/${track}/${file || `hsk${lv}_lesson${no}.json`}`;
    const raw = await fetchJson(fallbackUrl);
    const result = {
      raw,
      doc: legacyHskToLessonDoc(raw, { track, level: lv, lessonNo: no, file: fallbackUrl }),
    };
    memSet(cacheKey, result);
    return result;
  }
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
