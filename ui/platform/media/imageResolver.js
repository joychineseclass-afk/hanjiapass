/**
 * Image Engine v1 - 本地图片路径解析
 * 不发起请求，仅返回候选路径；找不到时返回空字符串
 */

import { resolveImageKey } from "./imageRegistry.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function getBase() {
  try {
    const base = window.DATA_PATHS?.getBase?.();
    if (base && str(base)) return String(base).replace(/\/+$/, "") + "/";
  } catch {}
  return "/";
}

function mediaPath(segment, filename, ext) {
  const base = getBase();
  return `${base}media/${segment}/${filename}.${ext}`;
}

/**
 * 词汇图：优先 /media/vocab/{hanzi}.png | .jpg | {id}.png | .jpg
 */
export function resolveWordImage(word, options = {}) {
  const hanzi = str(word?.hanzi ?? word?.word ?? word?.zh ?? word?.cn ?? "");
  const id = str(word?.id ?? options?.id ?? "");
  const key = resolveImageKey(hanzi, id);
  if (!key) return "";

  const candidates = [];
  if (hanzi) {
    candidates.push(mediaPath("vocab", hanzi, "png"), mediaPath("vocab", hanzi, "jpg"));
  }
  if (key !== hanzi) {
    candidates.push(mediaPath("vocab", key, "png"), mediaPath("vocab", key, "jpg"));
  }
  if (id && id !== hanzi && id !== key) {
    candidates.push(mediaPath("vocab", id, "png"), mediaPath("vocab", id, "jpg"));
  }

  return candidates[0] || "";
}

/**
 * 课程图：/media/lesson/{courseType}_{level}_lesson{lessonNo}.jpg | .png
 */
export function resolveLessonImage(meta) {
  const courseType = str(meta?.courseType ?? meta?.version ?? "hsk2.0");
  let level = str(meta?.level ?? meta?.lv ?? "hsk1");
  if (!/^hsk/i.test(level)) level = "hsk" + (level.replace(/\D/g, "") || "1");
  const lessonNo = Number(meta?.lessonNo ?? meta?.lesson ?? meta?.no ?? 0) || 0;
  if (!lessonNo) return "";

  const filename = `${courseType}_${level}_lesson${lessonNo}`;
  return mediaPath("lesson", filename, "jpg");
}

/**
 * 对话图：/media/dialogue/{courseType}_{level}_lesson{lessonNo}_{sceneId}.jpg | .png
 */
export function resolveDialogueImage(meta) {
  const courseType = str(meta?.courseType ?? meta?.version ?? "hsk2.0");
  let level = str(meta?.level ?? meta?.lv ?? "hsk1");
  if (!/^hsk/i.test(level)) level = "hsk" + (level.replace(/\D/g, "") || "1");
  const lessonNo = Number(meta?.lessonNo ?? meta?.lesson ?? meta?.no ?? 0) || 0;
  const sceneId = str(meta?.sceneId ?? meta?.scene ?? "0");
  if (!lessonNo) return "";

  const filename = `${courseType}_${level}_lesson${lessonNo}_${sceneId}`;
  return mediaPath("dialogue", filename, "jpg");
}
