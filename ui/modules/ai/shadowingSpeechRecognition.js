/**
 * 따라 말하기 专用：浏览器 Web Speech API，**强制 recognition.lang = zh-CN**
 * 与界面语言无关；含 [AI Speaking][STT] 全链路日志与「仅 final / 含 interim」双轨合并，避免停太快无 final。
 */

const STT_LOG = "[AI Speaking][STT]";

function sttLog(...args) {
  if (typeof console !== "undefined" && console.log) {
    console.log(STT_LOG, ...args);
  }
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
 * 与 freeTalk 同形 API，供 mount 侧「第一次 toggle 注册回调」使用。
 * @returns {{ toggle: Function, abort: Function, isListening: Function, getLastDebug: Function }}
 */
export function createShadowingZhSpeechSession() {
  /** 固定中文普通话，禁止随 UI 语言变为 ko/en */
  const LANG = "zh-CN";

  let recognition = null;
  let listening = false;
  let dropCallbacks = false;

  /** 每轮 onresult 更新：仅 isFinal 拼接 vs 整段（含 interim） */
  let lastSnapshot = { finals: "", full: "" };
  let lastErrorEvent = null;

  const debug = {
    recognitionLang: LANG,
    started: false,
    lastRawFinals: "",
    lastRawFull: "",
    lastNormalizedOut: "",
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

  function abort() {
    dropCallbacks = true;
    try {
      if (recognition) recognition.abort();
    } catch (_) {}
    if (!recognition) {
      dropCallbacks = false;
      listening = false;
    }
    debug.started = false;
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
        if (recognition) recognition.stop();
      } catch (e) {
        sttLog("recognition.stop() threw", e && e.message, e);
      }
      return;
    }

    const rec = new SR();
    recognition = rec;
    lastSnapshot = { finals: "", full: "" };
    lastErrorEvent = null;
    debug.lastSttError = "";

    rec.lang = LANG;
    sttLog("recognition created", "lang=", rec.lang, "(must be zh-CN for Chinese shadowing)");

    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      sttLog("onstart");
      debug.started = true;
    };

    rec.onspeechstart = () => {
      sttLog("onspeechstart");
    };

    rec.onspeechend = () => {
      sttLog("onspeechend");
    };

    rec.onresult = (event) => {
      sttLog("onresult", "resultIndex=", event.resultIndex, "results.length=", event.results.length);
      let finals = "";
      let full = "";
      for (let i = 0; i < event.results.length; i++) {
        const row = event.results[i];
        const tr = String(row[0]?.transcript ?? "");
        const isFinal = !!row.isFinal;
        sttLog(
          `  [${i}] isFinal=${isFinal} transcript(raw)=`,
          JSON.stringify(tr),
        );
        full += tr;
        if (isFinal) finals += tr;
      }
      lastSnapshot = { finals, full };
      debug.lastRawFinals = finals;
      debug.lastRawFull = full;
      const normF = normalizeUtterance(finals);
      const normA = normalizeUtterance(full);
      sttLog("onresult aggregated finals(raw)=", JSON.stringify(finals), "full(raw)=", JSON.stringify(full));
      sttLog("onresult normalized finals=", JSON.stringify(normF), "normalized full=", JSON.stringify(normA));
    };

    rec.onerror = (ev) => {
      const err = ev && "error" in ev ? String(ev.error) : "unknown";
      const msg = ev && "message" in ev ? String(ev.message || "") : "";
      sttLog("onerror", "error=", err, "message=", msg, ev);
      lastErrorEvent = { error: err, message: msg };
      debug.lastSttError = `${err}${msg ? `: ${msg}` : ""}`;

      if (err === "aborted") {
        listening = false;
        recognition = null;
        debug.started = false;
        onListeningChange?.(false);
        return;
      }
      listening = false;
      onListeningChange?.(false);
      recognition = null;
      debug.started = false;

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
      sttLog("onend");
      const drop = dropCallbacks;
      dropCallbacks = false;

      const normFinals = normalizeUtterance(lastSnapshot.finals);
      const normFull = normalizeUtterance(lastSnapshot.full);
      const text = normFinals || normFull;
      debug.lastNormalizedOut = text;

      sttLog(
        "onend pick text: normFinals=",
        JSON.stringify(normFinals),
        "normFull=",
        JSON.stringify(normFull),
        "chosen=",
        JSON.stringify(text),
      );

      listening = false;
      recognition = null;
      debug.started = false;
      onListeningChange?.(false);

      if (drop) {
        sttLog("onend dropped (abort/tab)");
        return;
      }
      if (text) {
        onResult?.(text);
      } else {
        sttLog("onend empty transcript → no_result");
        onError?.("no_result");
      }
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
      onListeningChange?.(false);
      onError?.("start_failed", e && e.message ? String(e.message) : String(e));
    }
  }

  return {
    toggle,
    abort,
    isListening: isListeningFn,
    getLastDebug,
    /** 供 UI 绑定当前条目标文 */
    setTargetTextForDebug(zh) {
      debug.lastTargetText = zh || "";
    },
    setMatchStatusForDebug(s) {
      debug.matchStatus = s || "";
    },
  };
}
