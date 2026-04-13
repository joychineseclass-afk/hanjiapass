/**
 * 따라 말하기：口语训练 — 中文目标 vs 浏览器语音识别结果，基础分档 + 反馈
 */

import { createFreeTalkSpeechInputSession } from "./freeTalkSpeechInput.js";
import { speakText } from "../../platform/audio/ttsEngine.js";

const str = (v) => (typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "");

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 比对用：去空白与常见标点
 */
export function normalizeChineseForMatch(s) {
  let x = str(s);
  x = x.replace(/\u3000/g, "");
  x = x.replace(/\s+/g, "");
  x = x.replace(/[，。、！？!?,．·…]/g, "");
  return x;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c);
    }
  }
  return dp[m][n];
}

/**
 * @returns {{ score: number, band: 'excellent'|'good'|'ok'|'retry', reason: string }}
 */
export function scoreShadowingUtterance(targetZh, recognizedRaw) {
  const target = normalizeChineseForMatch(targetZh);
  const rec = normalizeChineseForMatch(recognizedRaw);

  if (!target) {
    return { score: 0, band: "retry", reason: "empty_target" };
  }
  if (!rec) {
    return { score: 0, band: "retry", reason: "no_speech" };
  }

  if (target === rec) {
    return { score: 100, band: "excellent", reason: "exact" };
  }

  if (rec.includes(target) || target.includes(rec)) {
    const base = target.length >= rec.length ? 94 : 90;
    return { score: Math.min(98, base + 2), band: "excellent", reason: "contain" };
  }

  const dist = levenshtein(target, rec);
  const maxLen = Math.max(target.length, rec.length, 1);
  let score = Math.round((1 - dist / maxLen) * 100);
  score = Math.max(0, Math.min(100, score));

  let band = "retry";
  if (score >= 88) band = "excellent";
  else if (score >= 70) band = "good";
  else if (score >= 45) band = "ok";
  else band = "retry";

  return { score, band, reason: "similarity" };
}

/**
 * @param {(k: string, fb?: string) => string} t
 */
export function buildShadowingFeedbackMessage(result, _targetZh, recognizedText, t) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;

  if (result.reason === "no_speech" || result.reason === "empty_target") {
    return {
      title: safeT("ai.shadowing_feedback_title_retry", "再试一次"),
      body: safeT("ai.shadowing_feedback_no_speech", "没有听清楚，请大声、清楚地说一遍。"),
      score: result.score ?? 0,
      band: result.band,
    };
  }

  const band = result.band;
  let bodyKey = "ai.shadowing_feedback_retry_1";
  if (band === "excellent") bodyKey = "ai.shadowing_feedback_excellent_1";
  else if (band === "good") bodyKey = "ai.shadowing_feedback_good_1";
  else if (band === "ok") bodyKey = "ai.shadowing_feedback_ok_1";

  const titleKey =
    band === "excellent"
      ? "ai.shadowing_level_excellent"
      : band === "good"
        ? "ai.shadowing_level_good"
        : band === "ok"
          ? "ai.shadowing_level_ok"
          : "ai.shadowing_level_retry";

  return {
    title: safeT(titleKey, band),
    body: safeT(bodyKey, ""),
    score: result.score,
    band,
    recognizedPreview: str(recognizedText).slice(0, 200),
  };
}

function buildFeedbackHtml(msg, recognizedText, t) {
  const safeT = typeof t === "function" ? t : (k, fb) => fb || k;
  const score =
    msg.score != null
      ? `<div class="ai-shadowing-feedback-score"><span class="ai-shadowing-feedback-score-label">${escapeHtml(safeT("ai.shadowing_score_label", "得分"))}</span> <strong>${msg.score}</strong> / 100</div>`
      : "";
  const rec =
    recognizedText && String(recognizedText).trim()
      ? `<div class="ai-shadowing-feedback-rec"><span class="ai-shadowing-feedback-rec-label">${escapeHtml(safeT("ai.shadowing_recognized_label", "识别"))}</span> ${escapeHtml(String(recognizedText).trim())}</div>`
      : "";
  const body = msg.body ? `<div class="ai-shadowing-feedback-body">${escapeHtml(msg.body)}</div>` : "";
  return `<div class="ai-shadowing-feedback-inner">
    <div class="ai-shadowing-feedback-title">${escapeHtml(msg.title)}</div>
    ${score}
    ${rec}
    ${body}
  </div>`;
}

/**
 * 挂载：话筒 = 中文识别（zh-CN）+ 评分；喇叭 = 仅播汉字
 * @returns {() => void} cleanup
 */
export function mountShadowingSpeakingPractice(wrap, t) {
  if (!wrap) return () => {};

  const speech = createFreeTalkSpeechInputSession({ uiLang: "cn" });
  let activeMicBtn = null;

  function cleanup() {
    speech.abort();
    activeMicBtn = null;
  }

  wrap.querySelectorAll(".ai-shadowing-train-listen").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const row = btn.closest(".ai-shadowing-train-item");
      const zh = row?.getAttribute("data-shadow-zh");
      if (!zh) return;
      speakText(zh, { lang: "zh-CN", rate: 0.95 });
    });
  });

  wrap.querySelectorAll(".ai-shadowing-train-mic").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const row = btn.closest(".ai-shadowing-train-item");
      if (!row) return;
      const targetZh = row.getAttribute("data-shadow-zh") || "";
      const feedbackEl = row.querySelector(".ai-shadowing-train-feedback");
      const statusEl = row.querySelector(".ai-shadowing-train-status");

      if (speech.isListening()) {
        if (activeMicBtn === btn) {
          speech.toggle({
            onResult() {},
            onError() {},
            onListeningChange() {},
          });
        } else {
          speech.abort();
          activeMicBtn = null;
        }
        return;
      }

      if (activeMicBtn && activeMicBtn !== btn) {
        speech.abort();
      }

      activeMicBtn = btn;
      row.classList.add("is-recording");
      btn.classList.add("is-recording");
      btn.setAttribute("aria-pressed", "true");
      if (statusEl) {
        statusEl.textContent = t("ai.shadowing_speak_now", "请说吧");
        statusEl.hidden = false;
      }
      if (feedbackEl) {
        feedbackEl.innerHTML = "";
        feedbackEl.hidden = true;
      }

      speech.toggle({
        onResult: (text) => {
          row.classList.remove("is-recording");
          btn.classList.remove("is-recording");
          btn.setAttribute("aria-pressed", "false");
          if (statusEl) statusEl.hidden = true;
          activeMicBtn = null;
          const result = scoreShadowingUtterance(targetZh, text);
          const msg = buildShadowingFeedbackMessage(result, targetZh, text, t);
          if (feedbackEl) {
            feedbackEl.hidden = false;
            feedbackEl.innerHTML = buildFeedbackHtml(msg, text, t);
          }
        },
        onError: (code) => {
          row.classList.remove("is-recording");
          btn.classList.remove("is-recording");
          btn.setAttribute("aria-pressed", "false");
          if (statusEl) statusEl.hidden = true;
          activeMicBtn = null;
          const noInput = code === "no_result" || code === "no_speech";
          const result = noInput
            ? { score: 0, band: "retry", reason: "no_speech" }
            : { score: 0, band: "retry", reason: "no_speech" };
          const msg = buildShadowingFeedbackMessage(result, targetZh, "", t);
          if (feedbackEl) {
            feedbackEl.hidden = false;
            feedbackEl.innerHTML = buildFeedbackHtml(msg, "", t);
          }
        },
        onListeningChange: (listening) => {
          if (!listening) {
            row.classList.remove("is-recording");
            btn.classList.remove("is-recording");
            btn.setAttribute("aria-pressed", "false");
            if (statusEl) statusEl.hidden = true;
            activeMicBtn = null;
          }
        },
      });
    });
  });

  return cleanup;
}
