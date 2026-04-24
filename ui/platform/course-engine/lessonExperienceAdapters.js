/**
 * 统一学习承载层 — 各来源 → 标准 context / GCE 加载参数
 * page 不直接拼路径；由 adapter 把「页面路由语义」变成 engine 能吃的输入
 */

import { createLessonExperienceContext } from "./lessonExperienceContext.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * 将 HSK 简写 level（"1"）规范为 hsk1（与 data/courses 目录一致）
 * @param {string} level
 * @param {string} [courseIdHint] 如 hsk2.0
 */
function normalizeHskLevelForPath(level, courseIdHint) {
  const lv = str(level) || "1";
  if (/^hsk\d+$/i.test(lv)) return lv.toLowerCase();
  const n = lv.replace(/\D/g, "");
  if (n) return `hsk${n}`;
  return "hsk1";
}

/**
 * kids：demo / URL 里常见 level=1，数据目录为 kids1
 * @param {string} level
 */
function normalizeKidsLevelForPath(level) {
  const lv = str(level) || "1";
  if (/^kids\d+$/i.test(lv)) return lv.toLowerCase();
  const n = lv.replace(/\D/g, "");
  if (n) return `kids${n}`;
  return "kids1";
}

/**
 * 课堂 URL 中的 course/level/lesson 与 GCE `loadLesson` 输入对齐
 * @param {string} courseId 来自 query 或资产 source
 * @param {string} level
 * @param {string|number} lessonId 课次
 * @returns {{ input: { courseType: string, version?: string, level: string, lessonNo: number, file?: string, lessonId?: string }, gcePathVersion: string, gcePathLevel: string } | null}
 */
export function classroomGceInputFromRouting(courseId, level, lessonId) {
  const cid = str(courseId) || "kids";
  const lno = Number(lessonId) || 1;
  const rawLv = str(level) || "1";

  if (/^hsk[23]\.0$/i.test(cid)) {
    const gceLevel = normalizeHskLevelForPath(rawLv, cid);
    return {
      input: {
        courseType: "hsk",
        version: cid,
        level: gceLevel,
        lessonNo: lno,
      },
      gcePathVersion: cid,
      gcePathLevel: gceLevel,
    };
  }

  if (cid === "hsk" || /^hsk$/i.test(cid)) {
    const gceLevel = normalizeHskLevelForPath(rawLv, "hsk2.0");
    return {
      input: {
        courseType: "hsk",
        version: "hsk2.0",
        level: gceLevel,
        lessonNo: lno,
      },
      gcePathVersion: "hsk2.0",
      gcePathLevel: gceLevel,
    };
  }

  if (cid === "kids" || /^kids/i.test(cid)) {
    const gceLevel = normalizeKidsLevelForPath(rawLv);
    return {
      input: {
        courseType: "kids",
        version: "kids",
        level: gceLevel,
        lessonNo: lno,
      },
      gcePathVersion: "kids",
      gcePathLevel: gceLevel,
    };
  }

  // 其他课程族：交回 GCE 默认规则（如 travel1）
  return {
    input: {
      courseType: cid,
      level: rawLv,
      lessonNo: lno,
    },
    gcePathVersion: cid,
    gcePathLevel: rawLv,
  };
}

/**
 * 与 page.classroom 原默认一致，并从 query/资产 得到 routing
 * @param {Record<string, string>} q
 * @param {null|{ courseId: string, level: string, lessonNo: string }} assetRouting 资产成功时的 course/level/lesson
 */
export function buildClassroomRoutingFromQueryAndAsset(q, assetRouting) {
  let courseId = str(q.course) || "kids";
  let level = str(q.level) || "1";
  let lessonId = str(q.lesson) || "1";
  if (assetRouting) {
    courseId = str(assetRouting.courseId) || courseId;
    level = str(assetRouting.level) || level;
    lessonId = str(assetRouting.lessonNo) || lessonId;
  }
  return { courseId, level, lessonId };
}

/**
 * 课堂页专用：写满 LessonExperienceContext
 * @param {object} p
 * @param {import('./lessonExperienceContext.js').LessonExperienceContext['sourceType']} p.sourceType
 * @param {import('./lessonExperienceContext.js').LessonExperienceContext['mode']} [p.mode]
 * @param {string} p.courseId
 * @param {string} p.level
 * @param {string} p.lessonId
 * @param {string} [p.assetId]
 * @param {string} [p.version]
 * @param {string} [p.gcePathVersion]
 * @param {string} [p.gcePathLevel]
 */
export function buildClassroomLessonContext(p) {
  return createLessonExperienceContext({
    sourceType: p.sourceType,
    mode: p.mode || "teacher",
    courseId: p.courseId,
    level: p.level,
    lessonId: p.lessonId,
    assetId: p.assetId,
    version: p.version,
    gcePathVersion: p.gcePathVersion,
    gcePathLevel: p.gcePathLevel,
  });
}

/**
 * 供 initClassroomEngine 的裸参数（与现有 opts 同型）
 * @param {{ courseId: string, lessonId: string, level: string, coursewareAsset: object|null, preloadedLesson?: { raw: object, lesson: object } }} p
 */
export function buildClassroomEngineInit(p) {
  return {
    courseId: p.courseId,
    lessonId: p.lessonId,
    level: p.level,
    coursewareAsset: p.coursewareAsset,
    preloadedLesson: p.preloadedLesson,
  };
}
