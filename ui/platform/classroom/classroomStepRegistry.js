// /ui/platform/classroom/classroomStepRegistry.js
// 课堂步骤注册表（v1 固定顺序，后续可按课程过滤）

export const CLASSROOM_STEPS = [
  { id: "scene",    labelKey: "classroom_scene" },
  { id: "words",    labelKey: "classroom_words" },
  { id: "dialogue", labelKey: "classroom_dialogue" },
  { id: "practice", labelKey: "classroom_practice" },
  { id: "notes",    labelKey: "teacher.classroom.nav_step_notes" },
  { id: "game",     labelKey: "classroom_game" },
  { id: "ai",       labelKey: "classroom_ai" }
];

export function getDefaultSteps() {
  // notes 仅出现在老师课件（slide_outline）序列中，不应进入普通课程直开
  return CLASSROOM_STEPS.filter((s) => s.id !== "notes").map((s) => s.id);
}

