// /ui/core/lessonEngine.js
// ✅ Lesson Engine v1 (ESM)
// 目标：统一控制 “单词 → 会话 → 语法 → 练习 → AI” 的流程与切换
// 不依赖 hsk.js，可被 router / 页面入口调用

const DEFAULT_STEPS = ["words", "dialogue", "grammar", "practice", "ai"];

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function storageKey(lessonId) {
  return `joy_lesson_state:${lessonId}`;
}

// ✅ 更稳的 clone（避免 structuredClone 未定义时报错）
function cloneState(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

export const LESSON_ENGINE = (() => {
  let state = {
    lessonId: null,
    steps: [...DEFAULT_STEPS],
    stepIndex: 0,
    completedSteps: {}, // { words:true, dialogue:true ... }
    lang: "kr",
  };

  const listeners = new Set();

  function emit() {
    const snapshot = getState();

    // 1) 内部订阅回调
    for (const fn of listeners) {
      try {
        fn(snapshot);
      } catch (e) {
        console.warn("[LESSON_ENGINE] listener error:", e);
      }
    }

    // 2) 广播 window 事件给 StepRunner
    window.dispatchEvent(
      new CustomEvent("lesson:state", { detail: snapshot })
    );
  }

  function getState() {
    return cloneState(state);
  }

  function setLang(lang) {
    state.lang = lang || "kr";
    save();
    emit();
  }

  function load(lessonId) {
    const raw = localStorage.getItem(storageKey(lessonId));
    if (!raw) return null;
    return safeJsonParse(raw, null);
  }

  function save() {
    if (!state.lessonId) return;
    localStorage.setItem(storageKey(state.lessonId), JSON.stringify(state));
  }

  function start({ lessonId, steps, lang } = {}) {
    if (!lessonId) throw new Error("LESSON_ENGINE.start requires lessonId");

    const saved = load(lessonId);

    state =
      saved ||
      {
        lessonId,
        steps:
          Array.isArray(steps) && steps.length ? steps : [...DEFAULT_STEPS],
        stepIndex: 0,
        completedSteps: {},
        lang:
          lang ||
          localStorage.getItem("joy_lang") ||
          localStorage.getItem("site_lang") ||
          "kr",
      };

    // 若外部传入 steps/lang，允许覆盖
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
      lang:
        localStorage.getItem("joy_lang") ||
        localStorage.getItem("site_lang") ||
        "kr",
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
