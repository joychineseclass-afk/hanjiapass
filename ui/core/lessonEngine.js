// /ui/core/lessonEngine.js
// ✅ Lesson Engine v1 (ESM)
// 目标：统一控制 vocab → dialogue → grammar → practice → aiPractice 的流程
// step keys: vocab | dialogue | grammar | practice | review | aiPractice

import { DEFAULT_STEPS, stepKeys, stepKey } from "./lessonSteps.js";

const DEFAULT_STEP_KEYS = stepKeys(DEFAULT_STEPS);

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
    stepKeys: [...DEFAULT_STEP_KEYS],
    stepIndex: 0,
    completedSteps: {},
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

  function start({ lessonId, steps, stepKeys: sk, lang } = {}) {
    if (!lessonId) throw new Error("LESSON_ENGINE.start requires lessonId");

    const saved = load(lessonId);
    const keys = Array.isArray(sk) && sk.length ? sk : (Array.isArray(steps) && steps.length ? stepKeys(steps) : DEFAULT_STEP_KEYS);

    state =
      saved ||
      {
        lessonId,
        steps: Array.isArray(steps) && steps.length ? steps : DEFAULT_STEPS,
        stepKeys: keys,
        stepIndex: 0,
        completedSteps: {},
        lang:
          lang ||
          localStorage.getItem("joy_lang") ||
          localStorage.getItem("site_lang") ||
          "kr",
      };

    if (Array.isArray(steps) && steps.length) state.steps = steps;
    if (Array.isArray(sk) && sk.length) state.stepKeys = sk;
    else if (Array.isArray(steps) && steps.length) state.stepKeys = stepKeys(steps);
    else if (!state.stepKeys || !state.stepKeys.length) state.stepKeys = stepKeys(state.steps);
    if (lang) state.lang = lang;

    save();
    emit();
    return getState();
  }

  function currentStep() {
    const keys = state.stepKeys || stepKeys(state.steps);
    return keys[state.stepIndex] || keys[0] || "vocab";
  }

  function go(stepName) {
    const k = stepKey(stepName);
    const keys = state.stepKeys || stepKeys(state.steps);
    const idx = keys.indexOf(k);
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
      stepKeys: [...DEFAULT_STEP_KEYS],
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
