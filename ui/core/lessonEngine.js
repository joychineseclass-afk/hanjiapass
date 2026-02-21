// /ui/core/lessonEngine.js
// ✅ Lesson Engine v1 (ESM)
// 目标：统一控制 “单词 → 会话 → 语法 → 练习 → AI” 的流程与切换
// 不依赖 hsk.js，可被 router / 页面入口调用

const DEFAULT_STEPS = ["words", "dialogue", "grammar", "practice", "ai"];

function safeJsonParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function storageKey(lessonId) {
  return `joy_lesson_state:${lessonId}`;
}

export const LESSON_ENGINE = (() => {
  let state = {
    lessonId: null,
    steps: [...DEFAULT_STEPS],
    stepIndex: 0,
    completedSteps: {}, // { words:true, dialogue:true ... }
    lang: "kr",
  };

  let listeners = new Set();

  function emit() {
    for (const fn of listeners) fn(getState());
    // 同时广播事件，方便你用 window.addEventListener 监听
    window.dispatchEvent(new CustomEvent("lesson:state", { detail: getState() }));
  }

  function getState() {
    return structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  }

  function setLang(lang) {
    state.lang = lang || "kr";
    emit();
  }

  function load(lessonId) {
    const raw = localStorage.getItem(storageKey(lessonId));
    if (!raw) return null;
    const saved = safeJsonParse(raw, null);
    return saved;
  }

  function save() {
    if (!state.lessonId) return;
    localStorage.setItem(storageKey(state.lessonId), JSON.stringify(state));
  }

  function start({ lessonId, steps, lang } = {}) {
    if (!lessonId) throw new Error("LESSON_ENGINE.start requires lessonId");

    const saved = load(lessonId);
    state = saved || {
      lessonId,
      steps: Array.isArray(steps) && steps.length ? steps : [...DEFAULT_STEPS],
      stepIndex: 0,
      completedSteps: {},
      lang: lang || localStorage.getItem("joy_lang") || localStorage.getItem("site_lang") || "kr",
    };

    // 若外部传入steps/lang，允许覆盖
    if (Array.isArray(steps) && steps.length) state.steps = steps;
    if (lang) state.lang = lang;

    save();
    emit();
    return getState();
  }

  function currentStep() {
    return state.steps[state.stepIndex] || state.steps[0];
  }

  function go(stepName) {
    const idx = state.steps.indexOf(stepName);
    if (idx < 0) throw new Error(`Unknown step: ${stepName}`);
    state.stepIndex = idx;
    save();
    emit();
    return getState();
  }

  function next() {
    if (state.stepIndex < state.steps.length - 1) {
      state.stepIndex += 1;
      save();
      emit();
    }
    return getState();
  }

  function prev() {
    if (state.stepIndex > 0) {
      state.stepIndex -= 1;
      save();
      emit();
    }
    return getState();
  }

  function markDone(stepName = currentStep()) {
    state.completedSteps[stepName] = true;
    save();
    emit();
    return getState();
  }

  function reset(lessonId = state.lessonId) {
    if (!lessonId) return;
    localStorage.removeItem(storageKey(lessonId));
    state = {
      lessonId,
      steps: [...DEFAULT_STEPS],
      stepIndex: 0,
      completedSteps: {},
      lang: localStorage.getItem("joy_lang") || localStorage.getItem("site_lang") || "kr",
    };
    save();
    emit();
    return getState();
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    start,
    go,
    next,
    prev,
    markDone,
    reset,
    currentStep,
    getState,
    setLang,
    onChange,
  };
})();
