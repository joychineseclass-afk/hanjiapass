// /ui/core/deriveLessonId.js
// ✅ Stable lessonId derivation helper
// Usage:
//   import { deriveLessonId } from "./deriveLessonId.js";
//   const lessonId = deriveLessonId(lesson, { lv, version });

export function deriveLessonId(lesson, { lv, version } = {}) {
  // 1) 优先用 lesson 自带字段
  const direct =
    lesson?.lessonId ||
    lesson?.id ||
    lesson?.lesson ||
    lesson?.key ||
    "";
  if (direct) return String(direct);

  // 2) 用文件名推导（最常见：hsk1_lesson1.json -> hsk1_lesson1）
  const file = lesson?.file || lesson?.path || lesson?.url || "";
  if (file) {
    const base = String(file).split("/").pop();       // hsk1_lesson1.json
    const id = base.replace(/\.(json|txt|md)$/i, ""); // hsk1_lesson1
    if (id) return id;
  }

  // 3) lv + “lessonX”（如果 lesson 里有 lessonNo/index）
  const no = lesson?.lessonNo ?? lesson?.no ?? lesson?.index;
  const lvNorm = lv ?? lesson?.lv ?? lesson?.level ?? "";
  if (lvNorm != null && String(lvNorm) !== "" && no != null) {
    return `hsk${lvNorm}_lesson${no}`;
  }

  // 4) version 参与兜底（可选增强：避免同编号冲突）
  //    若你未来存在同 lv/no 的多版本（2.0/3.0），可以用 version 拼进去
  //    这里先不强制拼，保持最短 id；如需启用可把 return 改成带 version 的形式
  //    e.g. `hsk${lvNorm}_${String(version).toLowerCase()}_lesson${no}`

  // 5) 最终兜底：保证永不为空（避免阻塞）
  return `lesson_${Date.now()}`;
}
