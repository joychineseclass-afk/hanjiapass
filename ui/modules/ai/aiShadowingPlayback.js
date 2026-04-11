/**
 * 따라 말하기：驱动页面唯一句子列表（顺序领读、暂停继续、单句重播、下一句）
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

function syncLineHighlight(session) {
  const { items, i, n, phase } = session;
  items.forEach((el, idx) => {
    const done = idx < i || (phase === "completed" && idx < n);
    el.classList.toggle("is-done", done);
    el.classList.toggle("is-active", phase !== "completed" && idx === i && i < n);
  });
}

function setStatusText(session, i1, n, r1) {
  const el = session.statusEl;
  if (!el) return;
  el.textContent = `${i1}/${n} · ${r1}/3`;
}

function setPrimaryButton(session) {
  const btn = session.btn;
  if (!btn) return;
  btn.classList.toggle("is-busy", session.phase === "playing");
  btn.disabled = false;
  switch (session.phase) {
    case "idle":
      btn.textContent = t("ai.shadowing_btn_start", "따라 읽기 시작");
      break;
    case "playing":
      btn.textContent = t("ai.shadowing_btn_stop", "중지");
      break;
    case "paused":
      btn.textContent = t("ai.shadowing_btn_continue", "계속");
      break;
    case "completed":
      btn.textContent = t("ai.shadowing_btn_restart", "다시 시작");
      break;
    default:
      btn.textContent = t("ai.start_shadowing", "Start shadowing");
  }
}

function setSecondaryButtons(session) {
  const on = (session.phase === "playing" || session.phase === "paused") && !session.replayRunning;
  if (session.btnReplay) session.btnReplay.disabled = !on;
  if (session.btnNext) session.btnNext.disabled = !on;
}

function showBar(session, on) {
  session.bar?.classList.toggle("hidden", !on);
}

function bumpGeneration(session) {
  session.gen = (session.gen || 0) + 1;
  return session.gen;
}

function createSession(wrap, texts, items, n) {
  return {
    wrap,
    texts,
    items,
    n,
    i: 0,
    r: 0,
    gen: 0,
    phase: "idle",
    paused: false,
    aborted: false,
    replayRunning: false,
    driverRunning: false,
    statusEl: wrap.querySelector(".ai-shadowing-playback-status"),
    bar: wrap.querySelector(".ai-shadowing-playback-bar"),
    btn: wrap.querySelector(".ai-shadowing-run"),
    btnReplay: wrap.querySelector(".ai-shadowing-replay"),
    btnNext: wrap.querySelector(".ai-shadowing-next"),
  };
}

function setCompleted(session) {
  session.phase = "completed";
  session.paused = false;
  clearLineStates(session.wrap);
  session.items.forEach((el) => el.classList.add("is-done"));
  if (session.statusEl) {
    session.statusEl.textContent = t("ai.shadowing_done", "완료");
    setTimeout(() => {
      if (session.phase === "completed" && session.statusEl) session.statusEl.textContent = "";
    }, 2200);
  }
  showBar(session, false);
  setPrimaryButton(session);
  setSecondaryButtons(session);
}

function waitResume(session) {
  return new Promise((resolve) => {
    session._resume = () => {
      session._resume = null;
      resolve();
    };
  });
}

function resumeFromPause(session) {
  session._resume?.();
}

/**
 * 顺序领读主循环：r 为当前句已完成的遍数 0..3，r===3 时收尾并进入下一句
 */
async function runDriver(session) {
  if (session.driverRunning) return;
  const gen = bumpGeneration(session);
  session.driverRunning = true;
  session.phase = "playing";
  setPrimaryButton(session);
  setSecondaryButtons(session);

  try {
    while (session.i < session.n && !session.aborted) {
      if (session.gen !== gen) return;

      while (session.paused && session.phase === "paused") {
        await waitResume(session);
        if (session.gen !== gen) return;
      }

      const el = session.items[session.i];

      if (session.r >= 3) {
        el.classList.remove("is-active", "is-playing");
        el.classList.add("is-done");
        session.i += 1;
        session.r = 0;
        continue;
      }

      el.classList.add("is-active");
      el.classList.remove("is-done");
      setStatusText(session, session.i + 1, session.n, session.r + 1);
      syncLineHighlight(session);
      el.classList.add("is-playing");
      await speakOnceZh(session.texts[session.i]);
      el.classList.remove("is-playing");

      if (session.gen !== gen) return;

      if (session.paused && session.phase === "paused") {
        continue;
      }
      if (session.aborted) return;

      session.r += 1;
    }

    if (!session.aborted && session.i >= session.n && session.gen === gen) {
      setCompleted(session);
    }
  } finally {
    if (session.gen === gen) {
      session.driverRunning = false;
    }
  }
}

/**
 * 取消当前 wrap（切 Tab 等）
 */
export function cancelShadowingPlayback(wrap) {
  const s = wrap && shadowSessions.get(wrap);
  if (s) {
    s.aborted = true;
    bumpGeneration(s);
    s.paused = false;
    s._resume?.();
    shadowSessions.delete(wrap);
  }
  stopSpeak();
  clearLineStates(wrap);
  const btn = wrap?.querySelector(".ai-shadowing-run");
  const btnR = wrap?.querySelector(".ai-shadowing-replay");
  const btnN = wrap?.querySelector(".ai-shadowing-next");
  const bar = wrap?.querySelector(".ai-shadowing-playback-bar");
  const st = wrap?.querySelector(".ai-shadowing-playback-status");
  if (btn) {
    btn.textContent = t("ai.shadowing_btn_start", "따라 읽기 시작");
    btn.classList.remove("is-busy");
  }
  if (btnR) btnR.disabled = true;
  if (btnN) btnN.disabled = true;
  bar?.classList.add("hidden");
  if (st) st.textContent = "";
}

/**
 * 主按钮：idle→开始 | playing→暂停 | paused→继续 | completed→再次开始
 */
export async function toggleShadowingPlayback(wrap, aiItem) {
  if (!wrap) return;

  const texts = normalizeShadowingLines(aiItem);
  const items = wrap.querySelectorAll(".ai-shadowing-line-item");
  if (!texts.length || !items.length) return;

  const n = Math.min(texts.length, items.length);

  let session = shadowSessions.get(wrap);
  if (!session) {
    session = createSession(wrap, texts, items, n);
    shadowSessions.set(wrap, session);
  } else {
    session.texts = texts;
    session.items = items;
    session.n = n;
  }

  if (session.phase === "playing") {
    session.paused = true;
    session.phase = "paused";
    stopSpeak();
    setPrimaryButton(session);
    setSecondaryButtons(session);
    showBar(session, true);
    return;
  }

  if (session.phase === "paused") {
    session.paused = false;
    session.phase = "playing";
    setPrimaryButton(session);
    setSecondaryButtons(session);
    resumeFromPause(session);
    return;
  }

  if (session.phase === "completed") {
    session.aborted = false;
    bumpGeneration(session);
    session.i = 0;
    session.r = 0;
    session.items.forEach((el) => el.classList.remove("is-done", "is-active", "is-playing"));
    clearLineStates(session.wrap);
    if (session.statusEl) session.statusEl.textContent = "";
    showBar(session, true);
    setPrimaryButton(session);
    setSecondaryButtons(session);
    if (!isSpeechSupported() && session.statusEl) {
      session.statusEl.textContent = t("ai.shadowing_tts_unsupported", "브라우저 음성을 사용할 수 없습니다.");
    }
    runDriver(session);
    return;
  }

  if (session.phase === "idle") {
    session.aborted = false;
    session.i = 0;
    session.r = 0;
    clearLineStates(wrap);
    showBar(session, true);
    setPrimaryButton(session);
    setSecondaryButtons(session);
    if (!isSpeechSupported() && session.statusEl) {
      session.statusEl.textContent = t("ai.shadowing_tts_unsupported", "브라우저 음성을 사용할 수 없습니다.");
    }
    runDriver(session);
  }
}

/**
 * 单句重播：当前句再 3 遍。暂停：保持 i/r；播放中：结束后进下一句并重启 driver
 */
export async function replayShadowingSentence(wrap, aiItem) {
  const session = shadowSessions.get(wrap);
  if (!session || session.replayRunning) return;
  if (session.phase !== "playing" && session.phase !== "paused") return;
  if (session.i >= session.n) return;

  const snapI = session.i;
  const snapR = session.r;
  const wasPaused = session.phase === "paused";

  session.replayRunning = true;
  setSecondaryButtons(session);

  if (!wasPaused) {
    stopSpeak();
    bumpGeneration(session);
    resumeFromPause(session);
  }

  const el = session.items[snapI];
  for (let k = 0; k < 3; k++) {
    if (session.aborted) break;
    setStatusText(session, snapI + 1, session.n, k + 1);
    el?.classList.add("is-active", "is-playing");
    syncLineHighlight(session);
    await speakOnceZh(session.texts[snapI]);
    el?.classList.remove("is-playing");
  }

  session.replayRunning = false;

  if (wasPaused) {
    session.i = snapI;
    session.r = snapR;
    session.phase = "paused";
    session.paused = true;
    setStatusText(session, session.i + 1, session.n, session.r + 1);
    syncLineHighlight(session);
  } else {
    el?.classList.remove("is-active");
    el?.classList.add("is-done");
    session.i = snapI + 1;
    session.r = 0;
    session.phase = "playing";
    session.paused = false;
    if (session.i >= session.n) {
      setCompleted(session);
      return;
    }
    setStatusText(session, session.i + 1, session.n, 1);
    syncLineHighlight(session);
    runDriver(session);
  }

  setPrimaryButton(session);
  setSecondaryButtons(session);
}

/**
 * 下一句：跳过当前句剩余遍数
 */
export function skipShadowingNext(wrap, aiItem) {
  const session = shadowSessions.get(wrap);
  if (!session || session.replayRunning) return;
  if (session.phase !== "playing" && session.phase !== "paused") return;
  if (session.i >= session.n) return;

  stopSpeak();
  bumpGeneration(session);
  resumeFromPause(session);

  session.items[session.i]?.classList.remove("is-active", "is-playing");
  session.items[session.i]?.classList.add("is-done");

  session.i += 1;
  session.r = 0;

  if (session.i >= session.n) {
    setCompleted(session);
    return;
  }

  session.phase = "playing";
  session.paused = false;
  setStatusText(session, session.i + 1, session.n, 1);
  syncLineHighlight(session);
  setPrimaryButton(session);
  setSecondaryButtons(session);
  runDriver(session);
}
