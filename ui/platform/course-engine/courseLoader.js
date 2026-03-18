/**
 * Global Course Engine v1 - 课程加载器
 * 统一加载 manifest 与单课
 */

import { resolveCoursePath } from "./courseResolver.js";
import { isNoCacheEnv } from "../../core/noCacheEnv.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

const MEM = new Map();
const MEM_TTL = isNoCacheEnv() ? 0 : 1000 * 60 * 30;

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
 * 加载课程目录
 * @param {{ courseType: string, version?: string, level: string }} input
 * @returns {Promise<{ courseId, courseType, version, level, totalLessons, lessons, title }>}
 */
export async function loadCourseManifest(input = {}) {
  const courseType = str(input.courseType || "hsk");
  const version = str(input.version || (courseType === "hsk" ? "hsk2.0" : courseType));
  const level = str(input.level || "hsk1");

  const { manifestUrl, courseId, pathVersion, pathLevel } = resolveCoursePath({
    courseType,
    version,
    level,
  });

  const cacheKey = `manifest:${courseId}`;
  const cached = memGet(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(manifestUrl);
  const list = Array.isArray(data) ? data : data?.lessons ?? data?.data ?? [];

  const normLessonItem = (it) => {
    const no = Number(it.lessonNo ?? it.no ?? it.lesson ?? it.id ?? 0) || 0;
    const titleRaw = it.title;
    let title = {};
    if (typeof titleRaw === "object") {
      title = { zh: str(titleRaw.zh ?? titleRaw.cn), kr: str(titleRaw.kr ?? titleRaw.ko), en: str(titleRaw.en) };
    } else {
      const s = str(titleRaw ?? it.subtitle ?? "");
      const parts = s.split(/\s*\/\s*/);
      const zh = parts.find((p) => /[\u4e00-\u9fff]/.test(p)) || "";
      const kr = parts.find((p) => !/[\u4e00-\u9fff]/.test(p) && p.trim()) || str(it.subtitle ?? "");
      title = { zh, kr, en: "" };
    }
    return {
      lessonNo: no,
      id: str(it.id) || `${courseId}_lesson${no}`,
      file: str(it.file) || `lesson${no}.json`,
      title,
      type: str(it.type) || "lesson",
    };
  };

  const out = {
    courseId,
    courseType,
    version: pathVersion,
    level: pathLevel,
    totalLessons: list.length,
    lessons: list.map(normLessonItem),
    title: data?.title && typeof data.title === "object" ? data.title : { zh: `课程 ${pathLevel}`, kr: `과정 ${pathLevel}`, en: `Course ${pathLevel}` },
  };
  memSet(cacheKey, out);
  return out;
}

/**
 * 加载单课详情（原始 JSON）
 * @param {{ courseType: string, version?: string, level: string, lessonNo?: number, lessonId?: string, file?: string }} input
 * @returns {Promise<{ raw: object, resolved: object }>}
 */
export async function loadLesson(input = {}) {
  const courseType = str(input.courseType || "hsk");
  const version = str(input.version || (courseType === "hsk" ? "hsk2.0" : courseType));
  const level = str(input.level || "hsk1");
  const lessonNo = Number(input.lessonNo ?? 1) || 1;
  const file = str(input.file || "");

  const resolved = resolveCoursePath({
    courseType,
    version,
    level,
    lessonNo,
    file: file || undefined,
  });

  const cacheKey = `lesson:${resolved.courseId}:${lessonNo}:${resolved.lessonFile}`;
  const cached = memGet(cacheKey);
  if (cached) return { ...cached, resolved };

  const raw = await fetchJson(resolved.lessonUrl);
  const result = { raw, resolved };
  memSet(cacheKey, result);
  return result;
}
