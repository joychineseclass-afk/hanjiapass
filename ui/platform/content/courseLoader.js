/**
 * 平台级课程加载器
 * 路径约定：data/courses/{courseType}/{level}/lessons.json | lesson{N}.json
 * 不写死 HSK，支持 hsk2.0 / kids / travel / business / culture
 */

import { isNoCacheEnv } from "../../core/noCacheEnv.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

const MEM = new Map();
const MEM_TTL = isNoCacheEnv() ? 0 : 1000 * 60 * 30;

function getBase() {
  try {
    const base = window.DATA_PATHS?.getBase?.();
    if (base && str(base) && base !== ".") return String(base).replace(/\/+$/, "") + "/";
  } catch {}
  return "/";
}

function withBase(path) {
  const p = String(path).replace(/^\/+/, "");
  return getBase() + p;
}

/** 构建 lessons.json URL */
export function buildIndexUrl(courseType, level) {
  const ct = str(courseType) || "hsk2.0";
  const lv = str(level) || "hsk1";
  return withBase(`data/courses/${ct}/${lv}/lessons.json`);
}

/** 构建 lesson{N}.json URL */
export function buildLessonUrl(courseType, level, lessonNo, file) {
  const ct = str(courseType) || "hsk2.0";
  const lv = str(level) || "hsk1";
  const no = Number(lessonNo) || 1;
  if (file && /^lesson\d+\.json$/i.test(file)) {
    return withBase(`data/courses/${ct}/${lv}/${file}`);
  }
  if (file && /^hsk\d+_lesson\d+\.json$/i.test(file)) {
    const m = file.match(/^hsk(\d+)_lesson(\d+)\.json$/i);
    if (m) return withBase(`data/courses/${ct}/hsk${m[1]}/lesson${m[2]}.json`);
  }
  return withBase(`data/courses/${ct}/${lv}/lesson${no}.json`);
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

async function fetchJson(url) {
  let u = String(url || "");
  if (u.startsWith("./data/")) u = "/" + u.slice(2);
  try {
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch ${res.status}: ${u}`);
    return res.json();
  } catch (e) {
    if (typeof location !== "undefined" && u.startsWith("/data/")) {
      try {
        return await fetch("." + u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
      } catch {}
    }
    throw e;
  }
}

/**
 * 加载课程目录 lessons.json
 * 优先使用 Global Course Engine（若已加载）
 * @param {{ courseType: string, level: string }} opts
 * @returns {Promise<{ courseId, courseType, level, title, lessons }>}
 */
export async function loadCourseIndex({ courseType, level } = {}) {
  const GCE = window.GLOBAL_COURSE_ENGINE;
  if (GCE?.loadCourse) {
    try {
      const manifest = await GCE.loadCourse({ courseType, level });
      return {
        courseId: manifest.courseId,
        courseType: manifest.courseType === "hsk" ? manifest.version : manifest.courseType,
        level: manifest.level,
        title: manifest.title,
        lessons: manifest.lessons ?? [],
      };
    } catch (e) {
      console.warn("[courseLoader] GLOBAL_COURSE_ENGINE.loadCourse failed, fallback:", e?.message);
    }
  }

  const ct = str(courseType) || "hsk2.0";
  const lv = str(level) || "hsk1";
  const cacheKey = `index:${ct}:${lv}`;
  const cached = memGet(cacheKey);
  if (cached) return cached;

  const url = buildIndexUrl(ct, lv);
  const data = await fetchJson(url);
  const list = Array.isArray(data) ? data : data?.lessons ?? data?.data ?? [];

  const normLessonItem = (it) => {
    const no = Number(it.lessonNo ?? it.no ?? it.lesson ?? it.id ?? 0) || 0;
    const titleRaw = it.title;
    let title = {};
    if (typeof titleRaw === "object") {
      title = { zh: str(titleRaw.zh ?? titleRaw.cn), kr: str(titleRaw.kr ?? titleRaw.ko), en: str(titleRaw.en), jp: str(titleRaw.jp ?? titleRaw.ja), cn: str(titleRaw.cn ?? titleRaw.zh) };
    } else {
      const s = str(titleRaw ?? it.subtitle ?? "");
      const parts = s.split(/\s*\/\s*/);
      const zh = parts.find((p) => /[\u4e00-\u9fff]/.test(p)) || "";
      const kr = parts.find((p) => !/[\u4e00-\u9fff]/.test(p) && p.trim()) || str(it.subtitle ?? "");
      title = { zh, kr, en: "" };
    }
    return {
      lessonNo: no,
      id: str(it.id) || `${ct}_${lv}_lesson${no}`,
      file: str(it.file) || `lesson${no}.json`,
      title,
      type: str(it.type) || "lesson",
    };
  };

  const out = {
    courseId: `${ct}_${lv}`,
    courseType: ct,
    level: lv,
    title: data?.title && typeof data.title === "object" ? data.title : { zh: `课程 ${lv}`, kr: `과정 ${lv}`, en: `Course ${lv}` },
    lessons: list.map(normLessonItem),
  };
  memSet(cacheKey, out);
  return out;
}

/**
 * 加载单课详情
 * 优先使用 Global Course Engine（若已加载）
 * @param {{ courseType, level, lessonNo, file, lessonId }} opts
 * @returns {Promise<{ raw, lesson }>} lesson 为归一化后的标准对象
 */
export async function loadLessonDetail({ courseType, level, lessonNo, file, lessonId } = {}) {
  const GCE = window.GLOBAL_COURSE_ENGINE;
  if (GCE?.loadLesson) {
    try {
      const { raw, lesson } = await GCE.loadLesson({ courseType, level, lessonNo, file, lessonId });
      if (lesson) return { raw, lesson };
    } catch (e) {
      console.warn("[courseLoader] GLOBAL_COURSE_ENGINE.loadLesson failed, fallback:", e?.message);
    }
  }

  const ct = str(courseType) || "hsk2.0";
  const lv = str(level) || "hsk1";
  const no = Number(lessonNo || 1) || 1;
  const f = str(file) || `lesson${no}.json`;
  const cacheKey = `lesson:${ct}:${lv}:${no}:${f}`;
  const cached = memGet(cacheKey);
  if (cached) return cached;

  const url = buildLessonUrl(ct, lv, no, f);
  const raw = await fetchJson(url);

  const { normalizeLesson } = await import("./lessonNormalizer.js");
  const lesson = normalizeLesson(raw, { courseType: ct, level: lv, lessonNo: no, file: f, id: lessonId });

  const result = { raw, lesson };
  memSet(cacheKey, result);
  return result;
}
