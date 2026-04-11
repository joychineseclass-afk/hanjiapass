/**
 * 따라 말하기：驱动页面既有句子列表顺序领读（每句 3 遍），不重复渲染练习区
 */

import { speakText, stopSpeak, isSpeechSupported } from "../../platform/audio/ttsEngine.js";
import { i18n } from "../../i18n.js";

const shadowSessions = new WeakMap();

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function t(key, fallback = "") {
  return (i18n && typeof i18n.t === "function" ? i18n.t(key, fallback) : null) || fallback || key;
}

/** @param {object} aiItem */
export function normalizeShadowingLines(aiItem) {
  let lines = Array.isArray(aiItem?.lines) ? aiItem.lines : [];
  if (!lines.length && aiItem && aiItem.sampleAnswer) {
    const sa = typeof aiItem.sampleAnswer === "string"
      ? aiItem.sampleAnswer
      : (aiItem.sampleAnswer && (aiItem.sampleAnswer.cn || aiItem.sampleAnswer.zh)) || "";
    if (str(sa)) lines = [sa.trim()];
  }
  return lines
    .map((line) => str(typeof line === "string" ? line : (line && (line.cn || line.zh || line.text)) || ""))
    .filter(Boolean);
}

function speakOnceZh(text) {
  return new Promise((resolve) => {
    speakText(text, {
      lang: "zh-CN",
      rate: 0.95,
      onEnd: () => resolve(),
      onError: () => resolve(),
    });
  });
}

function clearLineStates(wrap) {
  wrap.querySelectorAll(".ai-shadowing-line-item").forEach((el) => {
    el.classList.remove("is-active", "is-playing", "is-done");
  });
}

/**
 * 取消当前 wrap 上的领读（若正在播放）
 */
export function cancelShadowingPlayback(wrap) {
  const s = wrap && shadowSessions.get(wrap);
  if (s && typeof s.cancel === "function") s.cancel();
  stopSpeak();
  clearLineStates(wrap);
}

/**
 * 开始或停止：进行中则停止并复位；否则从第一句顺序领读，每句 3 遍
 */
export async function toggleShadowingPlayback(wrap, aiItem) {
  if (!wrap) return;

  const prev = shadowSessions.get(wrap);
  if (prev?.running) {
    prev.cancel();
    return;
  }

  const texts = normalizeShadowingLines(aiItem);
  const items = wrap.querySelectorAll(".ai-shadowing-line-item");
  if (!texts.length || !items.length) return;

  const n = Math.min(texts.length, items.length);
  const statusEl = wrap.querySelector(".ai-shadowing-playback-status");
  const bar = wrap.querySelector(".ai-shadowing-playback-bar");
  const btn = wrap.querySelector(".ai-shadowing-run");

  clearLineStates(wrap);

  let cancelled = false;
  const session = {
    running: true,
    cancel() {
      cancelled = true;
      stopSpeak();
      clearLineStates(wrap);
      bar?.classList.add("hidden");
      if (statusEl) statusEl.textContent = "";
      if (btn) {
        btn.disabled = false;
        btn.textContent = t("ai.start_shadowing", "Start shadowing");
        btn.classList.remove("is-busy");
      }
      session.running = false;
      shadowSessions.delete(wrap);
    },
  };
  shadowSessions.set(wrap, session);

  if (btn) {
    btn.textContent = t("ai.shadowing_stop", "중지");
    btn.classList.add("is-busy");
  }
  bar?.classList.remove("hidden");

  if (!isSpeechSupported() && statusEl) {
    statusEl.textContent = t("ai.shadowing_tts_unsupported", "브라우저 음성을 사용할 수 없습니다.");
  }

  for (let i = 0; i < n && !cancelled; i++) {
    const el = items[i];
    el.classList.add("is-active");
    el.classList.remove("is-done");

    for (let r = 0; r < 3 && !cancelled; r++) {
      if (statusEl) {
        statusEl.textContent = `${i + 1}/${n} · ${r + 1}/3`;
      }
      el.classList.add("is-playing");
      await speakOnceZh(texts[i]);
      el.classList.remove("is-playing");
    }

    el.classList.remove("is-active");
    el.classList.add("is-done");
  }

  if (!cancelled) {
    stopSpeak();
    clearLineStates(wrap);
    items.forEach((el) => el.classList.add("is-done"));
    if (statusEl) statusEl.textContent = t("ai.shadowing_done", "완료");
    bar?.classList.add("hidden");
    if (statusEl) setTimeout(() => { statusEl.textContent = ""; }, 2500);
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = t("ai.start_shadowing", "Start shadowing");
    btn.classList.remove("is-busy");
  }
  session.running = false;
  shadowSessions.delete(wrap);
}
