/**
 * 따라 말하기：浏览器 Web Speech API（仅作前端即时预览）。
 *
 * 架构说明（重要）：
 * - 浏览器 SpeechRecognition 仅作即时反馈与调试；网络/引擎差异大，**空 transcript 不代表用户未开口**。
 * - **row._hanjiShadowingLastBlob（MediaRecorder）才是后续服务端 ASR / 发音评分的正式输入**；正式打分应以后端识别为准。
 * - 本模块在 STT 为空时的「未识别」仅指浏览器层，不得等同于录音失败。
 */

const STT_LOG = "[AI Speaking][STT]";

function sttLog(...args) {
  if (typeof console !== "undefined" && console.log) {
    console.log(STT_LOG, ...args);
  }
}

function logEvent(name) {
  sttLog(`event=${name}`);
}

function getSR() {
  return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isShadowingZhSttSupported() {
  return !!getSR();
}

function normalizeUtterance(s) {
  return String(s || "")
    .trim()
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * @typedef {{ text: string, source: 'final'|'interim', interimFallback: boolean }} ShadowingSttOutcome
 */

/**
 * 与 mount 侧「第一次 toggle 注册回调」配合；第二次 toggle 仅 recognition.stop()，回调仍用首次注册。
 * @returns {{
 *   toggle: Function,
 *   abort: Function,
 *   isListening: Function,
 *   getLastDebug: Function,
 *   setTargetTextForDebug: Function,
 *   setMatchStatusForDebug: Function,
 * }}
 */
export function createShadowingZhSpeechSession() {
  /** 固定中文普通话，禁止随 UI 语言变为 ko/en */
  const LANG = "zh-CN";

  let recognition = null;
  let listening = false;
  let dropCallbacks = false;

  let lastErrorEvent = null;

  /** 当前轮次：累计 final 与最近一次解析中的 interim 片段 */
  let aggregatedFinalsRaw = "";
  let lastInterimRaw = "";
  /** 最近一次非空的 final / interim 片段（raw，短词 interim 降级用） */
  let lastNonEmptyFinalRaw = "";
  let lastNonEmptyInterimRaw = "";

  let finalizeTimer = null;
  let recognitionEnded = false;

  const debug = {
    recognitionLang: LANG,
    interimResults: true,
    continuous: false,
    started: false,
    waitingFinalize: false,
    lastRawFinals: "",
    lastRawInterim: "",
    lastNonEmptyFinal: "",
    lastNonEmptyInterim: "",
    lastNormalizedOut: "",
    lastChosenSource: "none",
    lastInterimFallback: false,
    lastSttError: "",
    lastTargetText: "",
    matchStatus: "idle",
  };

  function getLastDebug() {
    return { ...debug, lastErrorEvent };
  }

  function isListeningFn() {
    return listening;
  }

  function clearFinalizeTimer() {
    if (finalizeTimer != null) {
      clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
  }

  /** 单字/双字跟读：多给一点时间等 final（300~800ms 取 700ms）；否则 500ms */
  function getFinalizeDelayMs() {
    const t = String(debug.lastTargetText || "").replace(/\s/g, "");
    return t.length > 0 && t.length <= 2 ? 700 : 500;
  }

  function pickChosen() {
    const normFinal = normalizeUtterance(aggregatedFinalsRaw);
    const normInterim = normalizeUtterance(lastNonEmptyInterimRaw || lastInterimRaw);

    if (normFinal) {
      return {
        text: normFinal,
        source: /** @type {const} */ ("final"),
        interimFallback: false,
      };
    }
    if (normInterim) {
      return {
        text: normInterim,
        source: /** @type {const} */ ("interim"),
        interimFallback: true,
      };
    }
    return { text: "", source: /** @type {const} */ ("final"), interimFallback: false };
  }

  function deliverOutcome(handlers) {
    const { onResult, onError } = handlers;
    if (dropCallbacks) {
      sttLog("deliverOutcome skipped (abort)");
      return;
    }
    const chosen = pickChosen();
    debug.lastNormalizedOut = chosen.text;
    debug.lastChosenSource = chosen.text ? (chosen.interimFallback ? "interim" : "final") : "none";
    debug.lastInterimFallback = chosen.interimFallback;
    debug.waitingFinalize = false;

    sttLog(
      "finalize chosen text=",
      JSON.stringify(chosen.text),
      "source=",
      chosen.interimFallback ? "interim (preview)" : chosen.text ? "final" : "none",
    );

    if (chosen.text) {
      onResult?.({
        text: chosen.text,
        source: chosen.source,
        interimFallback: chosen.interimFallback,
        rawFinal: aggregatedFinalsRaw,
        rawInterim: lastNonEmptyInterimRaw || lastInterimRaw,
      });
    } else {
      sttLog("finalize empty transcript → no_result");
      onError?.("no_result");
    }
  }

  function scheduleFinalize(handlers) {
    clearFinalizeTimer();
    debug.waitingFinalize = true;
    const ms = getFinalizeDelayMs();
    sttLog("scheduleFinalize", `delayMs=${ms}`, "(wait for late onresult after stop/onend)");
    finalizeTimer = window.setTimeout(() => {
      finalizeTimer = null;
      deliverOutcome(handlers);
    }, ms);
  }

  function resetRoundState() {
    clearFinalizeTimer();
    recognitionEnded = false;
    aggregatedFinalsRaw = "";
    lastInterimRaw = "";
    lastNonEmptyFinalRaw = "";
    lastNonEmptyInterimRaw = "";
    debug.lastRawFinals = "";
    debug.lastRawInterim = "";
    debug.lastNonEmptyFinal = "";
    debug.lastNonEmptyInterim = "";
    debug.lastNormalizedOut = "";
    debug.lastChosenSource = "none";
    debug.lastInterimFallback = false;
    debug.waitingFinalize = false;
  }

  /** @type {null | { onResult?: Function, onError?: Function, onListeningChange?: Function }} */
  let boundHandlers = null;

  function abort() {
    dropCallbacks = true;
    clearFinalizeTimer();
    try {
      if (recognition) recognition.abort();
    } catch (_) {}
    if (!recognition) {
      dropCallbacks = false;
      listening = false;
    }
    debug.started = false;
    debug.waitingFinalize = false;
  }

  function toggle(handlers = {}) {
    const { onResult, onError, onListeningChange } = handlers;
    const SR = getSR();
    if (!SR) {
      sttLog("recognition not available (window.SpeechRecognition missing)");
      onError?.("not_supported");
      return;
    }

    if (listening) {
      try {
        if (recognition) {
          sttLog("stop requested (second click) — recognition.stop(), then wait onend + finalize window");
          recognition.stop();
        }
      } catch (e) {
        sttLog("recognition.stop() threw", e && e.message, e);
      }
      return;
    }

    resetRoundState();
    boundHandlers = { onResult, onError, onListeningChange };

    const rec = new SR();
    recognition = rec;
    lastErrorEvent = null;
    debug.lastSttError = "";

    rec.lang = LANG;
    /** 短句跟读：单段识别；与 interim 配合便于短词拿到非空 */
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    debug.interimResults = rec.interimResults;
    debug.continuous = rec.continuous;

    sttLog("recognition created", `lang=${rec.lang}`, `interimResults=${rec.interimResults}`, `continuous=${rec.continuous}`);

    rec.onstart = () => {
      logEvent("onstart");
      debug.started = true;
    };

    rec.onaudiostart = () => logEvent("onaudiostart");
    rec.onsoundstart = () => logEvent("onsoundstart");
    rec.onspeechstart = () => logEvent("onspeechstart");
    rec.onspeechend = () => logEvent("onspeechend");
    rec.onsoundend = () => logEvent("onsoundend");
    rec.onaudioend = () => logEvent("onaudioend");

    rec.onnomatch = () => {
      logEvent("onnomatch");
    };

    rec.onresult = (event) => {
      sttLog("onresult", `resultIndex=${event.resultIndex}`, `results.length=${event.results.length}`);
      let finals = "";
      let interimParts = "";

      for (let i = 0; i < event.results.length; i++) {
        const row = event.results[i];
        const alt = row[0];
        const tr = String(alt?.transcript ?? "");
        const isFinal = !!row.isFinal;
        const conf =
          alt && typeof alt.confidence === "number" && !Number.isNaN(alt.confidence)
            ? alt.confidence.toFixed(3)
            : "n/a";
        sttLog(`result[${i}][0] isFinal=${isFinal} transcript=${JSON.stringify(tr)} confidence=${conf}`);
        if (isFinal) finals += tr;
        else interimParts += tr;
      }

      aggregatedFinalsRaw = finals;
      lastInterimRaw = interimParts;

      if (finals.trim()) lastNonEmptyFinalRaw = finals;
      if (interimParts.trim()) lastNonEmptyInterimRaw = interimParts;

      debug.lastRawFinals = finals;
      debug.lastRawInterim = interimParts;
      debug.lastNonEmptyFinal = lastNonEmptyFinalRaw;
      debug.lastNonEmptyInterim = lastNonEmptyInterimRaw;

      sttLog(
        "onresult aggregated",
        `finals(raw)=${JSON.stringify(finals)}`,
        `interim(raw)=${JSON.stringify(interimParts)}`,
      );

      if (recognitionEnded && boundHandlers) {
        sttLog("onresult after onend — reschedule finalize window");
        scheduleFinalize(boundHandlers);
      }
    };

    rec.onerror = (ev) => {
      const err = ev && "error" in ev ? String(ev.error) : "unknown";
      const msg = ev && "message" in ev ? String(ev.message || "") : "";
      logEvent("onerror");
      sttLog(`onerror name=${err} message=${JSON.stringify(msg)}`, ev);
      lastErrorEvent = { error: err, message: msg };
      debug.lastSttError = `${err}${msg ? `: ${msg}` : ""}`;
      clearFinalizeTimer();
      debug.waitingFinalize = false;

      if (err === "aborted") {
        listening = false;
        recognition = null;
        debug.started = false;
        debug.waitingFinalize = false;
        onListeningChange?.(false);
        return;
      }
      listening = false;
      onListeningChange?.(false);
      recognition = null;
      debug.started = false;
      debug.waitingFinalize = false;

      if (err === "not-allowed") {
        onError?.("permission_denied");
        return;
      }
      if (err === "no-speech") {
        onError?.("no_speech");
        return;
      }
      if (err === "language-not-supported") {
        onError?.("language_not_supported", err);
        return;
      }
      if (err === "service-not-allowed") {
        onError?.("service_not_allowed", err);
        return;
      }
      onError?.("recognition_error", err);
    };

    rec.onend = () => {
      logEvent("onend");
      recognitionEnded = true;
      listening = false;
      recognition = null;
      debug.started = false;
      onListeningChange?.(false);

      const drop = dropCallbacks;
      dropCallbacks = false;

      if (drop) {
        sttLog("onend dropped (abort)");
        clearFinalizeTimer();
        debug.waitingFinalize = false;
        return;
      }

      const h = boundHandlers;
      if (!h) {
        sttLog("onend no bound handlers");
        return;
      }

      /** 不在 onend 同步判失败：进入 waiting-final，延迟后再用 final / interim 落盘 */
      sttLog("onend → waiting-final (delayed finalize, not immediate no_result)");
      scheduleFinalize(h);
    };

    try {
      listening = true;
      onListeningChange?.(true);
      sttLog("start called");
      rec.start();
      sttLog("start() returned (sync)");
    } catch (e) {
      sttLog("start() threw", e && e.name, e && e.message, e);
      listening = false;
      recognition = null;
      debug.started = false;
      clearFinalizeTimer();
      onListeningChange?.(false);
      onError?.("start_failed", e && e.message ? String(e.message) : String(e));
    }
  }

  return {
    toggle,
    abort,
    isListening: isListeningFn,
    getLastDebug,
    setTargetTextForDebug(zh) {
      debug.lastTargetText = zh || "";
    },
    setMatchStatusForDebug(s) {
      debug.matchStatus = s || "";
    },
  };
}
