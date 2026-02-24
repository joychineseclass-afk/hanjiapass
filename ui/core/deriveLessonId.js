// /ui/core/deriveLessonId.js
// ✅ Stable lessonId derivation helper (Version-safe)
// Output format example:
//   hsk2.0_hsk1_lesson1

export function deriveLessonId(lesson, { lv, version } = {}) {
  // -------- 0) 统一拿版本 --------
  // 优先级：
  // opts.version > lesson.version > 从路径提取 > localStorage > 默认 hsk2.0

  const file = lesson?.file || lesson?.path || lesson?.url || "";

  // 从路径抓版本，例如 /hsk2.0/
  const versionFromPathMatch = String(file).match(/\/(hsk\d+(?:\.\d+)?)\//i);
  const versionFromPath = versionFromPathMatch
    ? versionFromPathMatch[1]
    : "";

  const finalVersion = String(
    version ||
      lesson?.version ||
      versionFromPath ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("hsk_vocab_version")
        : "") ||
      "hsk2.0"
  ).trim();

  // -------- 1) 如果 lesson 本身已有 lessonId --------
  const direct =
    lesson?.lessonId ||
    lesson?.id ||
    lesson?.lesson ||
    lesson?.key ||
    "";

  if (direct) {
    const base = String(direct).trim();
    // 如果已经带版本，直接返回
    if (base.startsWith("hsk")) {
      if (base.startsWith(finalVersion)) return base;
      return `${finalVersion}_${base}`;
    }
    return `${finalVersion}_${base}`;
  }

  // -------- 2) 从文件名推导 --------
  if (file) {
    const base = String(file).split("/").pop(); // hsk1_lesson1.json
    const stem = base.replace(/\.(json|txt|md)$/i, ""); // hsk1_lesson1
    return `${finalVersion}_${stem}`;
  }

  // -------- 3) lv + lessonNo 推导 --------
  const no = lesson?.lessonNo ?? lesson?.no ?? lesson?.index;
  const lvNorm = lv ?? lesson?.lv ?? lesson?.level ?? "";

  if (lvNorm != null && String(lvNorm) !== "" && no != null) {
    return `${finalVersion}_hsk${lvNorm}_lesson${no}`;
  }

  // -------- 4) 最终兜底（永不为空） --------
  return `${finalVersion}_lesson_${Date.now()}`;
}
