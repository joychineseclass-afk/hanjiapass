/**
 * 상황 대화：浏览器中文语音识别（Web Speech API，zh-CN）
 */

export function isSituationZhSpeechSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * @returns {{ start: () => void, stop: () => Promise<string>, abort: () => void, isActive: () => boolean }}
 */
export function createZhSituationRecognizer() {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR) {
    return {
      start() {},
      stop() {
        return Promise.resolve("");
      },
      abort() {},
      isActive: () => false,
    };
  }

  let recognition = null;
  let accumulated = "";
  let active = false;

  return {
    start() {
      if (active) return;
      accumulated = "";
      recognition = new SR();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) accumulated += str(res[0]?.transcript);
        }
      };

      recognition.onerror = () => {
        active = false;
        recognition = null;
      };

      try {
        recognition.start();
        active = true;
      } catch (_) {
        active = false;
      }
    },

    stop() {
      return new Promise((resolve) => {
        if (!recognition || !active) {
          active = false;
          resolve(str(accumulated));
          return;
        }
        const r = recognition;
        const acc = () => str(accumulated);
        r.onend = () => {
          active = false;
          recognition = null;
          resolve(acc());
        };
        try {
          r.stop();
        } catch (_) {
          active = false;
          recognition = null;
          resolve(acc());
        }
      });
    },

    abort() {
      if (!recognition || !active) return;
      try {
        recognition.abort();
      } catch (_) {}
      active = false;
      recognition = null;
      accumulated = "";
    },

    isActive() {
      return active;
    },
  };
}

function str(v) {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}
