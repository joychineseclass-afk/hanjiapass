// ui/platform/courses/courseEngine.js
// loadCourse(idOrObj, opts) — thin wrapper over CONTENT.loadLesson

import { CONTENT } from "../content/contentLoader.js";

function parseId(id) {
  const s = String(id ?? "").trim();
  const parts = s.split(":").filter(Boolean);
  if (parts.length >= 3) {
    return { type: parts[0], level: Number(parts[1]) || 1, lessonNo: Number(parts[2]) || 1 };
  }
  return null;
}

export async function loadCourse(idOrObj, opts = {}) {
  let type, level, lessonNo;
  if (typeof idOrObj === "object" && idOrObj !== null) {
    type = idOrObj.type || "hsk";
    level = Number(idOrObj.level ?? idOrObj.lv ?? 1) || 1;
    lessonNo = Number(idOrObj.lessonNo ?? idOrObj.lesson ?? idOrObj.no ?? 1) || 1;
  } else {
    const p = parseId(idOrObj);
    if (!p) throw new Error("loadCourse: invalid id, use 'hsk:1:1' or {type,level,lessonNo}");
    ({ type, level, lessonNo } = p);
  }

  const track = opts.track ?? opts.version ?? null;
  const file = opts.file ?? null;

  const { raw, doc } = await CONTENT.loadLesson({
    type,
    track: track || undefined,
    level,
    lessonNo,
    file: file || undefined,
  });

  const courseId = `${type}:${level}:${lessonNo}`;
  return { courseId, type, level, lessonNo, raw, doc };
}
