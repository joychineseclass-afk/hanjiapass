// /ui/platform/classroom/classroomStepRegistry.js
// 课堂步骤注册表（v1 固定顺序，后续可按课程过滤）

export const CLASSROOM_STEPS = [
  { id: "scene",    labelKey: "classroom_scene" },
  { id: "words",    labelKey: "classroom_words" },
  { id: "dialogue", labelKey: "classroom_dialogue" },
  { id: "practice", labelKey: "classroom_practice" },
  { id: "game",     labelKey: "classroom_game" },
  { id: "ai",       labelKey: "classroom_ai" }
];

export function getDefaultSteps() {
  return CLASSROOM_STEPS.map((s) => s.id);
}

