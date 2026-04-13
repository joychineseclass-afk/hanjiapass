/**
 * 자유 질문：浏览器端语音识别（Web Speech API，按 UI 语言设 recognition.lang）
 */

function getSR() {
  return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isFreeTalkSpeechInputSupported() {
  return !!getSR();
}

/** @param {string} uiLang */
export function uiLangToRecognitionLang(uiLang) {
  const l = String(uiLang || "kr").toLowerCase();
  if (l === "kr" || l === "ko") return "ko-KR";
  if (l === "cn" || l === "zh") return "zh-CN";
  if (l === "jp" || l === "ja") return "ja-JP";
  return "en-US";
}

export function normalizeFreeTalkSpeechText(s) {
  return String(s || "")
    .trim()
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * @returns {{ toggle: (handlers: { onResult?: (text: string) => void, onError?: (code: string, detail?: string) => void, onListeningChange?: (listening: boolean) => void }) => void, abort: () => void, isListening: () => boolean }}
 */
export function createFreeTalkSpeechInputSession({ uiLang }) {
  const recLang = uiLangToRecognitionLang(uiLang);
  let recognition = null;
  let listening = false;
  /** Tab 切换等场景：丢弃 onend 的提交与报错 */
  let dropCallbacks = false;

  function isListening() {
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
  }

  /**
   * 第一次点击开始听；再点一次 stop() 结束本轮并尽量提交已识别文本。
   */
  function toggle(handlers = {}) {
    const { onResult, onError, onListeningChange } = handlers;
    const SR = getSR();
    if (!SR) {
      onError?.("not_supported");
      return;
    }

    if (listening) {
      try {
        if (recognition) recognition.stop();
      } catch (_) {}
      return;
    }

    const rec = new SR();
    recognition = rec;
    rec.lang = recLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let accumulated = "";

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        if (row.isFinal) {
          accumulated += String(row[0]?.transcript || "");
        }
      }
    };

    rec.onerror = (ev) => {
      const err = ev && "error" in ev ? String(ev.error) : "unknown";
      if (err === "aborted") {
        listening = false;
        recognition = null;
        onListeningChange?.(false);
        return;
      }
      listening = false;
      onListeningChange?.(false);
      recognition = null;
      if (err === "not-allowed") {
        onError?.("permission_denied");
        return;
      }
      if (err === "no-speech") {
        onError?.("no_speech");
        return;
      }
      onError?.("recognition_error", err);
    };

    rec.onend = () => {
      const drop = dropCallbacks;
      dropCallbacks = false;
      const text = normalizeFreeTalkSpeechText(accumulated);
      listening = false;
      recognition = null;
      onListeningChange?.(false);
      if (drop) {
        return;
      }
      if (text) {
        onResult?.(text);
      } else {
        onError?.("no_result");
      }
    };

    try {
      listening = true;
      onListeningChange?.(true);
      rec.start();
    } catch (e) {
      listening = false;
      recognition = null;
      onListeningChange?.(false);
      onError?.("start_failed", e && e.message ? String(e.message) : String(e));
    }
  }

  return { toggle, abort, isListening };
}
