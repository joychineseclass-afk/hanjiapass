// /ui/platform/classroom/classroomState.js
// 单文件课堂状态容器（无框架依赖）

const DEFAULT_STEPS = ["scene", "words", "dialogue", "practice", "game", "ai"];

let STATE = {
  courseId: "",
  lessonId: "",
  lessonData: null,
  currentStep: "scene",
  availableSteps: [...DEFAULT_STEPS],
  mode: "teacher"
};

export function getClassroomState() {
  return { ...STATE };
}

export function resetClassroomState() {
  STATE = {
    courseId: "",
    lessonId: "",
    lessonData: null,
    currentStep: "scene",
    availableSteps: [...DEFAULT_STEPS],
    mode: "teacher"
  };
}

export function setClassroomCourse(courseId) {
  STATE.courseId = String(courseId || "");
}

export function setClassroomLesson(lessonId, lessonData) {
  STATE.lessonId = String(lessonId || "");
  STATE.lessonData = lessonData || null;
}

export function setClassroomStep(step) {
  if (!step) return;
  if (!STATE.availableSteps.includes(step)) return;
  STATE.currentStep = step;
}

export function nextClassroomStep() {
  const idx = STATE.availableSteps.indexOf(STATE.currentStep);
  if (idx < 0) return;
  if (idx >= STATE.availableSteps.length - 1) return;
  STATE.currentStep = STATE.availableSteps[idx + 1];
}

export function prevClassroomStep() {
  const idx = STATE.availableSteps.indexOf(STATE.currentStep);
  if (idx <= 0) return;
  STATE.currentStep = STATE.availableSteps[idx - 1];
}

export function setClassroomMode(mode) {
  STATE.mode = mode === "student" ? "student" : "teacher";
}

export function setAvailableSteps(steps) {
  const arr = Array.isArray(steps) && steps.length ? steps : DEFAULT_STEPS;
  STATE.availableSteps = arr;
  if (!STATE.availableSteps.includes(STATE.currentStep)) {
    STATE.currentStep = STATE.availableSteps[0];
  }
}

