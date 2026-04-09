/**
 * HSK3.0 HSK1：单词 / 会话「整体朗读」轻量播放器（TTS 分段队列）
 */
import { getMeaningByLang } from "../../utils/wordDisplay.js";
import { getLang } from "../../core/languageEngine.js";
import { wordKey, normalizeLang, ttsBcp47ForUiMeaningLang } from "./hskRenderer.js";

function normalizeWordForCard(x) {
  if (x == null) return null;
  if (typeof x === "string") {
    const t = x.trim();
    return t ? { hanzi: t } : null;
  }
  if (typeof x !== "object") return null;
  const han = wordKey(x) || String(x.simplified || x.trad || "").trim();
  if (!han) return null;
  return { ...x, hanzi: han, pinyin: x.pinyin ?? x.py ?? "" };
}

function randomMs(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * @typedef {{ type: "speak", text: string, lang: string } | { type: "gap", ms: number }} BulkSpeakStep
 */

/**
 * @param {unknown[]} items
 * @param {{ lang?: string, scope?: string }} opts
 * @returns {BulkSpeakStep[]}
 */
export function buildWordBulkTimeline(items, opts = {}) {
  const arr = Array.isArray(items) ? items : [];
  const currentLang = normalizeLang(opts.lang ?? getLang());
  const glossaryScope = opts.scope || "";
  const out = [];
  const slice = [];

  for (const x of arr) {
    const raw = normalizeWordForCard(x);
    if (!raw) continue;
    const han = wordKey(raw) || String(raw.hanzi || raw.word || raw.zh || "").trim();
    if (!han) continue;
    let rawMeaning = getMeaningByLang(raw, currentLang, han, glossaryScope);
    if (rawMeaning && rawMeaning.includes("object Object")) rawMeaning = "";
    const meaningForTts = String(rawMeaning || "").trim();
    slice.push({ han, meaningForTts });
  }

  const uiLang = ttsBcp47ForUiMeaningLang();

  for (let i = 0; i < slice.length; i++) {
    const { han, meaningForTts } = slice[i];
    out.push({ type: "speak", text: han, lang: "zh-CN" });
    if (meaningForTts) {
      out.push({ type: "gap", ms: randomMs(400, 700) });
      out.push({ type: "speak", text: meaningForTts, lang: uiLang });
    }
    if (i < slice.length - 1) {
      out.push({ type: "gap", ms: randomMs(350, 550) });
    }
  }
  return out;
}

/**
 * @param {object} lessonData
 * @param {{
 *   getDialogueCards: (lesson: object) => any[],
 *   pickDialogueTranslation: (line: object, zh: string) => string,
 *   dialogueSessionIntroTts: (n: number) => string,
 * }} ctx
 * @returns {BulkSpeakStep[]}
 */
export function buildDialogueBulkTimeline(lessonData, ctx) {
  const { getDialogueCards, pickDialogueTranslation, dialogueSessionIntroTts } = ctx;
  const raw = (lessonData && lessonData._raw) || lessonData;
  const cards = getDialogueCards(raw) || [];
  const uiLang = ttsBcp47ForUiMeaningLang();
  const out = [];

  for (let ci = 0; ci < cards.length; ci++) {
    const card = cards[ci];
    const lines = Array.isArray(card && card.lines) ? card.lines : [];
    if (!lines.length) continue;

    out.push({ type: "speak", text: dialogueSessionIntroTts(ci + 1), lang: uiLang });
    out.push({ type: "gap", ms: randomMs(350, 550) });

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const zh = String(
        (line && line.text) ||
          (line && line.zh) ||
          (line && line.cn) ||
          (line && line.line) ||
          ""
      ).trim();
      if (!zh) continue;
      const trans = String(pickDialogueTranslation(line, zh) || "").trim();

      out.push({ type: "speak", text: zh, lang: "zh-CN" });
      if (trans) {
        out.push({ type: "gap", ms: randomMs(400, 700) });
        out.push({ type: "speak", text: trans, lang: uiLang });
      }
      const lastLineLastCard = ci === cards.length - 1 && li === lines.length - 1;
      if (!lastLineLastCard) {
        out.push({ type: "gap", ms: randomMs(350, 550) });
      }
    }
  }

  while (out.length && out[out.length - 1].type === "gap") out.pop();
  return out;
}

export class HskBulkTtsPlayer {
  constructor() {
    /** @type {BulkSpeakStep[]} */
    this.timeline = [];
    this.idx = 0;
    this.userRate = 1;
    this.playing = false;
    this._gapTimer = null;
    this._gapRemainMs = 0;
    this._gapDeadline = 0;
    this._inGap = false;
    /** 用户在中途暂停了当前 utterance，需用 resume() 续播，勿重新 _step */
    this._needsSynthResume = false;
    /** 整体朗读播完时间线后是否从头再来 */
    this.bulkLoop = false;
    /** @type {null | "words" | "dialogue"} */
    this.loopKind = null;
    this._onUi = null;
  }

  setTimeline(steps) {
    this.hardStop();
    this.timeline = Array.isArray(steps) ? steps : [];
    this.idx = 0;
  }

  setPlaybackRate(r) {
    const n = Number(r);
    if (!Number.isFinite(n)) return;
    this.userRate = Math.min(2, Math.max(0.5, n));
  }

  setUiCallback(fn) {
    this._onUi = typeof fn === "function" ? fn : null;
  }

  _emit() {
    if (this._onUi) {
      try {
        this._onUi({
          playing: this.playing,
          progress: this.getProgress(),
          idx: this.idx,
          total: this.timeline.length,
        });
      } catch (_) {}
    }
  }

  isSynthPaused() {
    try {
      return !!(window.speechSynthesis && window.speechSynthesis.paused);
    } catch {
      return false;
    }
  }

  getProgress() {
    const n = this.timeline.length;
    if (!n) return 0;
    return Math.min(1, this.idx / n);
  }

  seekToRatio(t) {
    const n = this.timeline.length;
    if (!n) return;
    const r = Math.min(1, Math.max(0, Number(t) || 0));
    let i = Math.floor(r * n);
    if (i >= n) i = n - 1;
    this.hardStop();
    this.idx = i;
    this.playing = true;
    this._emit();
    this._step();
  }

  hardStop() {
    if (this._gapTimer) {
      clearTimeout(this._gapTimer);
      this._gapTimer = null;
    }
    this._inGap = false;
    this._gapRemainMs = 0;
    this._gapDeadline = 0;
    this._needsSynthResume = false;
    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}
    this.playing = false;
  }

  /** 从当前 utterance 暂停点继续（不重建队列、不移动 idx） */
  resumeSynthFromPause() {
    try {
      if (this._needsSynthResume || window.speechSynthesis?.paused) {
        window.speechSynthesis.resume();
      }
    } catch (_) {}
    this._needsSynthResume = false;
    this.playing = true;
    this._emit();
  }

  play() {
    if (!this.timeline.length) return;
    if (this._needsSynthResume || this.isSynthPaused()) {
      this.resumeSynthFromPause();
      return;
    }
    this.playing = true;
    this._step();
  }

  pause() {
    if (this._inGap && this._gapTimer) {
      clearTimeout(this._gapTimer);
      this._gapTimer = null;
      this._gapRemainMs = Math.max(0, this._gapDeadline - Date.now());
      this._inGap = false;
      this.playing = false;
      this._emit();
      return;
    }
    try {
      if (window.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        this._needsSynthResume = true;
      }
    } catch (_) {}
    this.playing = false;
    this._emit();
  }

  resume() {
    if (this._needsSynthResume || this.isSynthPaused()) {
      this.resumeSynthFromPause();
      return;
    }
    if (this._gapRemainMs > 0) {
      this.playing = true;
      this._resumeGap();
      return;
    }
    this.playing = true;
    this._step();
  }

  togglePlayPause() {
    if (!this.timeline.length) return;
    if (this._needsSynthResume || this.isSynthPaused()) {
      this.resumeSynthFromPause();
      return;
    }
    if (this._inGap && this._gapTimer) {
      this.pause();
      return;
    }
    try {
      if (window.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
        this.pause();
        return;
      }
    } catch (_) {}
    if (!this.playing && this.idx < this.timeline.length) {
      this.resume();
      return;
    }
    this.play();
  }

  stop() {
    this.hardStop();
    this.idx = 0;
    this.bulkLoop = false;
    this.loopKind = null;
    this._emit();
  }

  _resumeGap() {
    const ms = this._gapRemainMs;
    this._gapRemainMs = 0;
    this._inGap = true;
    this._gapDeadline = Date.now() + ms;
    this._gapTimer = setTimeout(() => {
      this._gapTimer = null;
      this._inGap = false;
      this.idx++;
      this._step();
    }, ms);
  }

  _step() {
    if (!this.playing) {
      this._emit();
      return;
    }
    if (this.idx >= this.timeline.length) {
      if (this.bulkLoop && this.timeline.length > 0) {
        this.idx = 0;
        this._emit();
        this._step();
        return;
      }
      this.playing = false;
      this._emit();
      return;
    }

    const step = this.timeline[this.idx];
    this._emit();

    if (step.type === "gap") {
      let ms = step.ms;
      if (this._gapRemainMs > 0) {
        ms = this._gapRemainMs;
        this._gapRemainMs = 0;
      }
      this._inGap = true;
      this._gapDeadline = Date.now() + ms;
      this._gapTimer = setTimeout(() => {
        this._gapTimer = null;
        this._inGap = false;
        this.idx++;
        this._step();
      }, ms);
      return;
    }

    this._inGap = false;
    const u = new SpeechSynthesisUtterance(step.text);
    u.lang = step.lang || "zh-CN";
    u.rate = Math.min(10, Math.max(0.1, 0.95 * this.userRate));
    u.onend = () => {
      this.idx++;
      this._step();
    };
    u.onerror = () => {
      this.idx++;
      this._step();
    };
    try {
      window.speechSynthesis.speak(u);
    } catch (_) {
      this.idx++;
      this._step();
    }
  }
}

let _singleton = null;
export function getBulkTtsPlayer() {
  if (!_singleton) _singleton = new HskBulkTtsPlayer();
  return _singleton;
}

let _hostEl = null;

function removeHost() {
  if (_hostEl && _hostEl.parentNode) {
    _hostEl.parentNode.removeChild(_hostEl);
  }
  _hostEl = null;
}

function renderPlayerBarHTML() {
  return `
<div class="hsk-bulk-player" role="region" aria-label="bulk TTS">
  <div class="hsk-bulk-player__row">
    <button type="button" class="hsk-bulk-player__play" data-bulk-act="toggle" title="Play/Pause">▶</button>
    <input type="range" class="hsk-bulk-player__scrub" min="0" max="1000" value="0" step="1" data-bulk-act="scrub" aria-label="Progress" />
    <select class="hsk-bulk-player__rate" data-bulk-act="rate" aria-label="Speed">
      <option value="0.5">0.5×</option>
      <option value="1" selected>1×</option>
      <option value="1.5">1.5×</option>
      <option value="2">2×</option>
    </select>
    <button type="button" class="hsk-bulk-player__close" data-bulk-act="close" title="Close">✕</button>
  </div>
</div>`;
}

function bindPlayerUi(player, root) {
  const playBtn = root.querySelector("[data-bulk-act='toggle']");
  const scrub = root.querySelector("[data-bulk-act='scrub']");
  const rate = root.querySelector("[data-bulk-act='rate']");
  const closeBtn = root.querySelector("[data-bulk-act='close']");

  const syncPlayIcon = () => {
    if (!playBtn) return;
    let active = false;
    try {
      active =
        !!(window.speechSynthesis?.speaking && !window.speechSynthesis.paused) || !!player._inGap;
    } catch (_) {
      active = !!player._inGap;
    }
    playBtn.textContent = active ? "⏸" : "▶";
  };

  player.setUiCallback(() => {
    const sc = root.querySelector("[data-bulk-act='scrub']");
    if (sc) sc.value = String(Math.round(player.getProgress() * 1000));
    syncPlayIcon();
  });

  playBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    player.togglePlayPause();
    syncPlayIcon();
  });

  scrub?.addEventListener("change", (e) => {
    const v = Number(e.target.value) / 1000;
    player.seekToRatio(v);
  });

  rate?.addEventListener("change", (e) => {
    player.setPlaybackRate(Number(e.target.value));
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    player.stop();
    removeHost();
  });

  syncPlayIcon();
}

/**
 * 关闭整体朗读条并停止播放（含循环标记）
 */
export function closeBulkSpeakPlayer() {
  removeHost();
  getBulkTtsPlayer().stop();
}

/**
 * @param {"words"|"dialogue"} _kind
 * @param {BulkSpeakStep[]} timeline
 * @param {HTMLElement | null} anchor
 * @param {{ loop?: boolean }} [opts]
 */
export async function openBulkSpeakPlayer(_kind, timeline, anchor, opts = {}) {
  const { startNewHskSpeakChain, clearHsk30SingleItemLoopState } = await import("./hskRenderer.js");
  startNewHskSpeakChain();
  clearHsk30SingleItemLoopState();
  try {
    window.speechSynthesis?.cancel();
  } catch (_) {}

  removeHost();
  if (!anchor || !anchor.parentNode) return;
  if (!timeline || !timeline.length) return;

  const player = getBulkTtsPlayer();
  player.hardStop();
  player.setTimeline(timeline);
  player.setPlaybackRate(1);
  player.bulkLoop = !!opts.loop;
  player.loopKind = opts.loop ? _kind : null;

  _hostEl = document.createElement("div");
  _hostEl.className = "hsk-bulk-player-host";
  _hostEl.innerHTML = renderPlayerBarHTML();
  anchor.insertAdjacentElement("afterend", _hostEl);

  const rateEl = _hostEl.querySelector(".hsk-bulk-player__rate");
  if (rateEl) rateEl.value = "1";

  bindPlayerUi(player, _hostEl);

  player.playing = true;
  player.idx = 0;
  player._step();
}
