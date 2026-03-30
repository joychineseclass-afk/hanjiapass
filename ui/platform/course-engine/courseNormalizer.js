/**
 * Global Course Engine v1 - 课程标准化
 * 将不同课程的 lesson 数据归一化为 Lumina lesson schema
 * 复用 platform/content/lessonNormalizer 逻辑，输出统一结构
 */

import { normalizeLesson as platformNormalize } from "../content/lessonNormalizer.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * 标准化 lesson 为 Global Course Engine 统一 schema
 * @param {object} rawLesson - 原始 lesson JSON
 * @param {object} context - { courseType, version, level, lessonNo, file, lessonId }
 * @returns {object} 统一结构
 */
export function normalizeLesson(rawLesson, context = {}) {
  if (!rawLesson || typeof rawLesson !== "object") {
    return createEmptyLesson(context);
  }

  const courseType = str(context.courseType ?? rawLesson.courseType ?? "hsk");
  const version = str(context.version ?? rawLesson.version ?? (courseType === "hsk" ? "hsk2.0" : courseType));
  const level = str(context.level ?? rawLesson.level ?? "hsk1");
  const lessonNo = Number(context.lessonNo ?? rawLesson.lessonNo ?? rawLesson.no ?? 1) || 1;
  const file = str(context.file ?? rawLesson.file ?? `lesson${lessonNo}.json`);
  const courseId = str(rawLesson.courseId ?? context.courseId ?? `${courseType}_${version}_${level}`);
  const id = str(rawLesson.id ?? context.lessonId ?? `${courseId}_lesson${lessonNo}`);

  const normalized = platformNormalize(rawLesson, {
    courseType: courseType === "hsk" ? version : `${courseType}_${version}`,
    level,
    lessonNo,
    file,
    id,
    courseId,
  });

  if (!normalized) return createEmptyLesson(context);

  const raw = rawLesson?._raw ?? rawLesson;

  return {
    id,
    courseType,
    version,
    level,
    /** 与 platform lessonNormalizer 一致；page.hsk 用 type==='review' 分支复习 UI（勿只放在 meta） */
    type: str(normalized?.type ?? raw?.type ?? "lesson"),
    title: normalized.title ?? {},
    vocab: Array.isArray(normalized.vocab) ? normalized.vocab : [],
    dialogueCards: Array.isArray(raw?.dialogueCards) ? raw.dialogueCards : buildDialogueCardsFromFlat(normalized.dialogue),
    dialogue: normalized.dialogue ?? [],
    grammar: Array.isArray(normalized.grammar) ? normalized.grammar : [],
    extension: Array.isArray(raw?.extension) ? raw.extension : (Array.isArray(normalized.extension) ? normalized.extension : []),
    practice: Array.isArray(normalized.practice) ? normalized.practice : [],
    aiScope: raw?.aiPractice ?? raw?.ai ?? {},
    aiPractice: normalized.aiPractice ?? {},
    meta: {
      courseId,
      lessonNo,
      file,
      type: str(normalized?.type ?? raw?.type ?? "lesson"),
    },
    _raw: raw,
  };
}

function buildDialogueCardsFromFlat(flatLines) {
  if (!Array.isArray(flatLines) || !flatLines.length) return [];
  return [{ title: { zh: "会话", kr: "회화", en: "Dialogue" }, lines: flatLines }];
}

function createEmptyLesson(context) {
  const courseType = str(context.courseType ?? "hsk");
  const version = str(context.version ?? "hsk2.0");
  const level = str(context.level ?? "hsk1");
  const lessonNo = Number(context.lessonNo ?? 1) || 1;
  const courseId = `${courseType}_${version}_${level}`;
  const id = context.lessonId ?? `${courseId}_lesson${lessonNo}`;

  return {
    id,
    courseType,
    version,
    level,
    type: "lesson",
    title: {},
    vocab: [],
    dialogueCards: [],
    dialogue: [],
    grammar: [],
    extension: [],
    practice: [],
    aiScope: {},
    aiPractice: {},
    meta: { courseId, lessonNo, file: `lesson${lessonNo}.json`, type: "lesson" },
    _raw: {},
  };
}
