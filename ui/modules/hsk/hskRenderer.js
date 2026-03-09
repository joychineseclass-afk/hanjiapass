// /ui/modules/hsk/hskRenderer.js — Lumina Language Engine v1
// 统一使用 i18n.t() + languageEngine.pick/getContentText，禁止散乱 item.kr/item.en 判断

import { i18n } from "../../i18n.js";
import { pick, getContentText, getLang, getLessonDisplayTitle } from "../../core/languageEngine.js";
import { openStrokeInModal } from "./strokeModal.js";
import { openStrokePlayer } from "../stroke/index.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { getMeaningByLang, getPosByLang, getWordImageUrl } from "../../utils/wordDisplay.js";

/** 解析笔顺页 URL，避免 /pages/pages/ 重复 */
function resolveStrokeUrl(hanzi) {
  const ch = encodeURIComponent(hanzi || "");
  const inPages = (typeof location !== "undefined" && location.pathname) ? location.pathname.includes("/pages/") : false;
  if (inPages) return `stroke.html?ch=${ch}`; // 相对路径 → /pages/stroke.html
  return `/pages/stroke.html?ch=${ch}`;
}

/** 存在性探测，优先返回可用的 stroke 页路径 */
async function resolveStrokeUrlAsync(hanzi) {
  const ch = encodeURIComponent(hanzi || "");
  const candidates = [];
  if (typeof location !== "undefined" && location.pathname && location.pathname.includes("/pages/")) {
    candidates.push(`stroke.html?ch=${ch}`);
  }
  candidates.push(`/pages/stroke.html?ch=${ch}`, `/stroke.html?ch=${ch}`);

  for (const u of candidates) {
    try {
      const test = u.split("?")[0];
      const r = await fetch(test, { method: "HEAD" });
      if (r.ok) return u;
    } catch {}
  }
  return candidates[0] || `/pages/stroke.html?ch=${ch}`;
}

/** 归一化为 wordDisplay/glossary 用：kr|cn|en|jp，兼容 ko/zh */
export function normalizeLang(lang) {
  const l = String(lang != null ? lang : getLang()).toLowerCase();
  if (l === "kr" || l === "ko") return "kr";
  if (l === "cn" || l === "zh") return "cn";
  if (l === "jp" || l === "ja") return "jp";
  if (l === "en") return "en";
  return "kr";
}

export function wordKey(x) {
  if (x == null) return "";
  if (typeof x === "string") return x.trim();
  return String(x.hanzi || x.word || x.zh || x.cn || "").trim();
}

export function wordPinyin(x) {
  if (x == null || typeof x === "string") return "";
  return String(x.pinyin || x.py || "").trim();
}

/** 按系统语言取释义，委托给全站统一的 getMeaningByLang */
export function wordMeaning(x, lang) {
  if (x == null) return "";
  if (typeof x === "string") return "";
  const l = normalizeLang(lang);
  return getMeaningByLang(x, l, wordKey(x) || "");
}

export function renderLessonList(containerEl, lessons, { lang, currentLessonNo = 0 } = {}) {
  if (!containerEl) return;
  const list = Array.isArray(lessons) ? lessons : [];
  const arrow = "›";

  const rows = list.map((it) => {
    const lessonNo = Number(it.lessonNo || it.no || it.lesson || it.id || 0) || 0;
    const file = it.file || it.path || it.url || "";

    const titleDisplay = getLessonDisplayTitle(it, lang) || "-";

    const lessonNoFormatted = i18n.t("hsk.lesson_no_format", { n: lessonNo });
    const isActive = currentLessonNo > 0 && lessonNo === currentLessonNo;

    return `
      <button class="hsk-directory-row${isActive ? " is-active" : ""}"
        data-open-lesson="1"
        data-lesson-no="${lessonNo}"
        data-file="${escapeHtmlAttr(file)}"
      >
        <span class="hsk-directory-no">${lessonNo || ""}</span>
        <span class="hsk-directory-title">${escapeHtml(lessonNoFormatted)} / ${escapeHtml(titleDisplay)}</span>
        <span class="hsk-directory-arrow">${arrow}</span>
      </button>
    `;
  }).join("");

  const emptyMsg = i18n.t("hsk.empty_lessons");
  containerEl.innerHTML = `<div class="hsk-directory-rows">${rows || `<div class="hsk-directory-empty">${escapeHtml(emptyMsg)}</div>`}</div>`;
}

export function renderWordCards(gridEl, items, onClickWord, { lang, scope } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];
  const currentLang = normalizeLang(lang ?? getLang());
  const glossaryScope = scope || "";

  const cards = arr.map((x) => {
    try {
      const raw = typeof x === "string" ? { hanzi: x } : (x || {});
      const han = wordKey(raw) || String(raw.hanzi || raw.han || raw.word || raw.zh || raw.cn || raw.simplified || raw.trad || "").trim();
      let pinyinStr = wordPinyin(raw);
      if (!pinyinStr && han) pinyinStr = resolvePinyin(han, pinyinStr);

      let mainStr = getMeaningByLang(raw, currentLang, han, glossaryScope);
      if (mainStr && mainStr.includes("object Object")) mainStr = "";
      if (!mainStr) mainStr = i18n.t("hsk.meaning_empty");

      const posStr = getPosByLang(raw, currentLang, glossaryScope);

      const learnLabel = i18n.t("action.learn");
      const strokeLabel = i18n.t("action.trace");
      const audioLabel = i18n.t("action.speak");
      const strokeDisabled = !han ? " disabled" : "";
      const hanziChars = han ? Array.from(han).map((ch) =>
        `<span class="word-hanzi-char" data-char="${escapeHtmlAttr(ch)}" data-word="${escapeHtmlAttr(han)}" role="button" tabindex="0">${escapeHtml(ch)}</span>`
      ).join("") : escapeHtml(han);

      const imgUrl = getWordImageUrl(raw);
      const imgHtml = imgUrl
        ? `<img class="word-card-image" src="${escapeHtmlAttr(imgUrl)}" alt="${escapeHtmlAttr(han)}" loading="lazy" onerror="this.style.display='none'" />`
        : "";

      return `
      <div class="word-card lesson-vocab-card lesson-card" data-word-hanzi="${escapeHtmlAttr(han)}">
        ${imgHtml}
        <div class="word-hanzi">${hanziChars}</div>
        <div class="word-pinyin">${escapeHtml(pinyinStr)}</div>
        ${posStr ? `<div class="word-pos text-sm opacity-75">${escapeHtml(posStr)}</div>` : ""}
        <div class="word-meaning">
          <div class="word-meaning-main">${escapeHtml(mainStr)}</div>
        </div>
        <div class="word-actions">
          <button type="button" class="btn btn-learn" data-action="learn" data-hanzi="${escapeHtmlAttr(han)}">${escapeHtml(learnLabel)}</button>
          <button type="button" class="btn btn-stroke" data-action="stroke" data-hanzi="${escapeHtmlAttr(han)}"${strokeDisabled}>${escapeHtml(strokeLabel)}</button>
          <button type="button" class="btn btn-audio" data-action="speak" data-hanzi="${escapeHtmlAttr(han)}" data-pinyin="${escapeHtmlAttr(pinyinStr)}">${escapeHtml(audioLabel)}</button>
        </div>
      </div>
    `;
    } catch (e) {
      console.warn("[renderWordCards] failed for item:", x, e);
      return `<div class="word-card" style="border:1px solid #fecaca;color:#dc2626;"><div class="word-meaning">Error rendering word</div></div>`;
    }
  });

  const hero = `<section class="lesson-section-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.words"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.vocab_subtitle"))}</p>
  ${arr.length ? '<span class="lesson-section-count">' + escapeHtml(i18n.t("hsk.vocab_count", { n: arr.length })) + "</span>" : ""}
</section>`;
  gridEl.innerHTML = `<div class="lesson-vocab-wrap">${hero}<div class="lesson-card-grid word-grid">${cards.join("")}</div></div>`;

  // 供 bindWordCardActions 查找 learn 时用的 item 与 callback
  if (typeof window !== "undefined") {
    window.__HSK_WORD_ITEMS_BY_HANZI = window.__HSK_WORD_ITEMS_BY_HANZI || new Map();
    arr.forEach((x) => {
      const h = wordKey(x);
      if (h) window.__HSK_WORD_ITEMS_BY_HANZI.set(h, x);
    });
    window.__HSK_ON_CLICK_WORD = typeof onClickWord === "function" ? onClickWord : null;
  }

  bindWordCardActions();
}

/**
 * 复习课专用：单词目录式列表（一行一个单词，紧凑可浏览）
 * 每行：汉字 | 拼音 | 释义，可点击播放发音
 */
export function renderReviewWords(gridEl, items, { lang, scope } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];
  const currentLang = normalizeLang(lang ?? getLang());
  const glossaryScope = scope || "";
  const speakLabel = i18n.t("action.speak") || "听";

  const rows = arr.map((x) => {
    const raw = typeof x === "string" ? { hanzi: x } : (x || {});
    const han = wordKey(raw) || String(raw.hanzi || raw.word || "").trim();
    let pinyinStr = wordPinyin(raw);
    if (!pinyinStr && han) pinyinStr = resolvePinyin(han, pinyinStr);
    let mainStr = getMeaningByLang(raw, currentLang, han, glossaryScope);
    if (!mainStr) mainStr = i18n.t("hsk.meaning_empty");
    const zhEsc = escapeHtml(han).replaceAll('"', "&quot;");
    const attrs = han ? ` data-speak-text="${zhEsc}" data-speak-kind="review-word"` : "";
    return `<div class="review-word-row" data-word-hanzi="${escapeHtmlAttr(han)}" data-word-pinyin="${escapeHtmlAttr(pinyinStr)}">
  <span class="review-word-hanzi"${attrs}>${escapeHtml(han)}</span>
  <span class="review-word-pinyin">${escapeHtml(pinyinStr)}</span>
  <span class="review-word-meaning">${escapeHtml(mainStr)}</span>
  <button type="button" class="review-word-speak-btn" data-action="speak" data-hanzi="${escapeHtmlAttr(han)}" data-pinyin="${escapeHtmlAttr(pinyinStr)}" title="${escapeHtmlAttr(speakLabel)}">🔊</button>
</div>`;
  });

  const hero = `<section class="lesson-section-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.words"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_words_subtitle") || "复习课词汇列表")}</p>
  ${arr.length ? '<span class="lesson-section-count">' + escapeHtml(i18n.t("hsk.vocab_count", { n: arr.length })) + "</span>" : ""}
</section>`;
  gridEl.innerHTML = `<div class="lesson-vocab-wrap review-vocab-wrap">${hero}<div class="review-word-list">${rows.join("")}</div></div>`;

  if (typeof window !== "undefined") {
    window.__HSK_WORD_ITEMS_BY_HANZI = window.__HSK_WORD_ITEMS_BY_HANZI || new Map();
    arr.forEach((x) => {
      const h = wordKey(x);
      if (h) window.__HSK_WORD_ITEMS_BY_HANZI.set(h, x);
    });
  }
  bindReviewWordActions();
}

let _reviewWordBound = false;
function bindReviewWordActions() {
  if (_reviewWordBound) return;
  _reviewWordBound = true;
  document.addEventListener("click", async (e) => {
    const r = e.target.closest(".review-word-row");
    if (!r) return;
    const hanzi = (r.dataset?.wordHanzi || "").trim();
    const pinyin = (r.dataset?.wordPinyin || "").trim();
    const text = hanzi || pinyin;
    if (!text) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const { AUDIO_ENGINE } = await import("../../platform/index.js");
      if (AUDIO_ENGINE && typeof AUDIO_ENGINE.playText === "function") {
        AUDIO_ENGINE.stop();
        AUDIO_ENGINE.playText(text, { lang: "zh-CN", rate: 0.95 });
      }
    } catch (err) {
      console.warn("[AUDIO] review word speak failed:", err);
    }
  });
}

let _wordCardBound = false;

/** 文档级事件委托，确保 rerender 后点击仍有效 */
export function bindWordCardActions() {
  if (_wordCardBound) return;
  _wordCardBound = true;

  document.addEventListener("click", async (e) => {
    const reviewRow = e.target.closest(".review-dialogue-row, .review-extension-row");
    if (reviewRow) {
      const text = (reviewRow.dataset?.speakText || "").trim();
      if (text) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const { AUDIO_ENGINE } = await import("../../platform/index.js");
          if (AUDIO_ENGINE?.playText) {
            AUDIO_ENGINE.stop();
            AUDIO_ENGINE.playText(text, { lang: "zh-CN", rate: 0.95 });
          }
        } catch (err) {
          console.warn("[AUDIO] review speak failed:", err);
        }
      }
      return;
    }

    const card = e.target.closest(".word-card");
    if (!card) return;

    const charSpan = e.target.closest(".word-hanzi-char");
    if (charSpan) {
      e.preventDefault();
      e.stopPropagation();
      const char = (charSpan.dataset.char || "").trim();
      const wordId = (charSpan.dataset.word || "").trim();
      if (!char) return;
      const lessonId = (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.lessonNo) || window.__HSK_CURRENT_LESSON_ID || "";
      try {
        await openStrokePlayer(char, {
          ctx: { from: "hsk", lessonId, wordId },
        });
      } catch (err) {
        console.warn("[stroke] openStrokePlayer failed:", err);
      }
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const hanzi = (btn.dataset.hanzi || "").trim();
    const pinyin = (btn.dataset.pinyin || "").trim();

    if (!hanzi && action !== "learn") return;
    if (action === "stroke" && btn.disabled) return;

    if (action === "speak" || action === "audio") {
      e.preventDefault();
      e.stopPropagation();
      const text = hanzi || pinyin || "";
      if (!text) return;
      try {
        const { AUDIO_ENGINE } = await import("../../platform/index.js");
        if (!(AUDIO_ENGINE && typeof AUDIO_ENGINE.isSpeechSupported === "function" && AUDIO_ENGINE.isSpeechSupported())) {
          if (typeof console !== "undefined" && console.warn) console.warn("[AUDIO] speechSynthesis not supported");
          return;
        }
        AUDIO_ENGINE.stop();
        document.querySelectorAll(".word-card.is-speaking").forEach((c) => c.classList.remove("is-speaking"));
        const cardEl = btn.closest(".word-card");
        if (cardEl) cardEl.classList.add("is-speaking");
        AUDIO_ENGINE.playText(text, {
          lang: "zh-CN",
          rate: 0.95,
          onEnd: function() { if (cardEl) cardEl.classList.remove("is-speaking"); },
          onError: function() { if (cardEl) cardEl.classList.remove("is-speaking"); },
        });
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) console.warn("[AUDIO] speak failed:", err);
      }
    }

    if (action === "stroke") {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("btn-stroke-active");
      const ctx = {
        version: (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.version) || (typeof localStorage !== "undefined" ? localStorage.getItem("hsk_vocab_version") : null) || "hsk2.0",
        level: (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.level) != null ? window.__HSK_PAGE_CTX.level : 1,
        lessonId: (window.__HSK_PAGE_CTX && window.__HSK_PAGE_CTX.lessonNo) || window.__HSK_CURRENT_LESSON_ID || "",
        wordId: hanzi,
      };
      try {
        await openStrokeInModal(hanzi, ctx);
      } catch (err) {
        console.warn("[Stroke] modal failed, fallback to new tab:", err);
        const { resolveStrokeUrl, buildReturnParams } = await import("./strokeModal.js");
        const baseUrl = resolveStrokeUrl(hanzi);
        const sep = baseUrl.includes("?") ? "&" : "?";
        window.open(`${baseUrl}${sep}${buildReturnParams(ctx)}`, "_blank", "noopener");
      } finally {
        setTimeout(() => btn.classList.remove("btn-stroke-active"), 200);
      }
    }

    if (action === "learn") {
      e.preventDefault();
      e.stopPropagation();
      const map = window.__HSK_WORD_ITEMS_BY_HANZI;
      const item = (map && typeof map.get === "function" ? map.get(hanzi) : null) || { hanzi: hanzi, pinyin: pinyin };
      const fn = window.__HSK_ON_CLICK_WORD;
      if (typeof fn === "function") fn(item);
      else if (window.LEARN_PANEL && typeof window.LEARN_PANEL.open === "function") window.LEARN_PANEL.open(item);
    }
  });
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#96;");
}

/** 复习课会话：简洁列表，每条 中文 | 拼音 | 释义 */
export function renderReviewDialogue(containerEl, cards, { lang } = {}) {
  if (!containerEl) return;
  const list = Array.isArray(cards) ? cards : [];
  const l = normalizeLang(lang ?? getLang());
  const hero = `<section class="lesson-section-hero lesson-dialogue-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.tab.dialogue"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_dialogue_subtitle") || "复习课主要会话")}</p>
</section>`;
  if (!list.length) {
    containerEl.innerHTML = `${hero}<div class="lesson-empty-state">${i18n.t("hsk.empty_dialogue")}</div>`;
    return;
  }
  const pickTrans = (line) => {
    if (!line || typeof line !== "object") return "";
    const t = line.translation || line.trans || line.explain;
    if (t && typeof t === "object") return (t[l] ?? t.kr ?? t.ko ?? t.en ?? t.zh ?? "") || "";
    return (line.kr ?? line.ko ?? line.en ?? line.zh ?? "") || "";
  };
  const rows = [];
  for (const card of list) {
    const lines = Array.isArray(card?.lines) ? card.lines : [];
    for (const line of lines) {
      const zh = String((line?.text ?? line?.zh ?? line?.cn ?? line?.line ?? "")).trim();
      const py = String((line?.pinyin ?? line?.py ?? "")).trim();
      const trans = pickTrans(line);
      if (!zh) continue;
      const pyResolved = py || resolvePinyin(zh, "");
      const zhEsc = escapeHtml(zh).replaceAll('"', "&quot;");
      rows.push(`<div class="review-dialogue-row" data-speak-text="${zhEsc}" data-speak-kind="dialogue">
  <span class="review-dialogue-zh">${escapeHtml(zh)}</span>
  <span class="review-dialogue-pinyin">${escapeHtml(pyResolved)}</span>
  <span class="review-dialogue-trans">${escapeHtml(trans)}</span>
  <button type="button" class="review-dialogue-speak" data-speak-text="${zhEsc}">🔊</button>
</div>`);
    }
  }
  containerEl.innerHTML = `${hero}<div class="review-dialogue-list">${rows.join("")}</div>`;
}

/** 复习课语法：pattern (+pinyin) — meaning | explain | example | exampleMeaning；仅当存在 pinyin 时显示拼音 */
export function renderReviewGrammar(containerEl, grammarArr, { lang, vocab = [] } = {}) {
  if (!containerEl) return;
  const arr = Array.isArray(grammarArr) ? grammarArr : [];
  const l = normalizeLang(lang ?? getLang());
  const vocabList = Array.isArray(vocab) ? vocab : [];
  const vocabByHanzi = new Map();
  vocabList.forEach((v) => {
    const h = (v?.hanzi ?? v?.word ?? "").trim();
    if (h) vocabByHanzi.set(h, v);
  });

  const hero = `<section class="lesson-section-hero lesson-grammar-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.grammar_title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_grammar_subtitle") || "复习课语法点")}</p>
</section>`;
  if (!arr.length) {
    containerEl.innerHTML = `${hero}<div class="lesson-grammar-empty">${i18n.t("hsk.empty_grammar")}</div>`;
    return;
  }

  const getExpl = (g) => {
    const ex = g?.explain ?? g?.explanation;
    if (ex && typeof ex === "object") return (ex[l] ?? ex.kr ?? ex.ko ?? ex.en ?? ex.zh ?? "") || "";
    return "";
  };
  const getExampleZh = (g) => {
    const ex = g?.example ?? g?.examples;
    if (Array.isArray(ex)) return ex.map((e) => (e?.zh ?? e?.cn ?? e?.line ?? e) || "").filter(Boolean)[0] || "";
    if (ex && typeof ex === "object") return (ex.zh ?? ex.cn ?? ex.line ?? "") || "";
    return typeof ex === "string" ? ex : "";
  };
  const getExampleMeaning = (g) => {
    const em = g?.exampleMeaning;
    if (em && typeof em === "object") return (em[l] ?? em.kr ?? em.ko ?? em.en ?? em.zh ?? "") || "";
    if (typeof em === "string") return em.trim() || "";
    const ex = g?.example ?? g?.examples;
    const first = Array.isArray(ex) ? ex[0] : ex;
    if (first && typeof first === "object") {
      const trans = first.translation;
      if (trans && typeof trans === "object") return (trans[l] ?? trans.kr ?? trans.ko ?? trans.en ?? trans.zh ?? "") || "";
      return (first[l] ?? first.kr ?? first.ko ?? first.en ?? first.zh ?? "") || "";
    }
    return "";
  };
  const getMeaningFromVocab = (hanzi) => {
    const v = vocabByHanzi.get(hanzi);
    if (!v) return "";
    const m = v?.meaning;
    if (m && typeof m === "object") return (m[l] ?? m.kr ?? m.ko ?? m.en ?? m.zh ?? "") || "";
    return "";
  };

  const rows = arr.map((g, i) => {
    const pattern = String(g?.pattern ?? g?.title ?? g?.name ?? "").trim() || "#" + (i + 1);
    const patternParts = pattern.split(/[—–\-]\s*/);
    const hanziPart = (patternParts[0] || pattern).trim();
    const meaningFromPattern = (patternParts[1] || "").trim();
    const keyForVocab = hanziPart.replace(/\s*[\+\-].*$/, "").trim() || hanziPart.slice(0, 1);
    const meaning = meaningFromPattern || (g?.meaning && typeof g.meaning === "string" ? g.meaning : "") || getMeaningFromVocab(keyForVocab);

    let pinyinToShow = "";
    const isStructurePattern = /\s+\+\s+/.test(pattern);
    const grammarPinyin = String(g?.pinyin ?? g?.py ?? "").trim();
    if (grammarPinyin && !isStructurePattern) {
      pinyinToShow = grammarPinyin.split(/[—–\-]\s*|\s*\+/)[0]?.trim() || grammarPinyin;
    }

    const titleLine = meaning
      ? (pinyinToShow ? `${pattern} (${pinyinToShow}) — ${meaning}` : `${pattern} — ${meaning}`)
      : (pinyinToShow ? `${pattern} (${pinyinToShow})` : pattern);

    const expl = getExpl(g);
    const exZh = getExampleZh(g);
    const exMeaning = getExampleMeaning(g);
    const zhEsc = escapeHtml(hanziPart).replaceAll('"', "&quot;");
    return `<div class="review-grammar-row">
  <div class="review-grammar-title" data-speak-text="${zhEsc}">${escapeHtml(titleLine)}</div>
  ${expl ? `<div class="review-grammar-expl">${escapeHtml(expl)}</div>` : ""}
  ${exZh ? `<div class="review-grammar-ex">${escapeHtml(exZh)}</div>` : ""}
  ${exMeaning ? `<div class="review-grammar-ex-meaning">${escapeHtml(exMeaning)}</div>` : ""}
</div>`;
  });
  containerEl.innerHTML = `${hero}<div class="review-grammar-list">${rows.join("")}</div>`;
}

/** 复习课扩展：紧凑列表，中文 | 拼音 | 释义 */
export function renderReviewExtension(containerEl, extArr, { lang } = {}) {
  if (!containerEl) return;
  const arr = Array.isArray(extArr) ? extArr : [];
  const l = normalizeLang(lang ?? getLang());
  const hero = `<section class="lesson-section-hero lesson-extension-hero">
  <h3 class="lesson-section-title">${escapeHtml(i18n.t("hsk.section.extension") || i18n.t("hsk.extension_title"))}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n.t("hsk.review_extension_subtitle") || "复习课扩展表达")}</p>
</section>`;
  if (!arr.length) {
    containerEl.innerHTML = `${hero}<div class="lesson-extension-empty">${i18n.t("hsk.extension_empty")}</div>`;
    return;
  }
  const getExpl = (item) => {
    const ex = item?.explain ?? item?.explanation;
    if (ex && typeof ex === "object") return (ex[l] ?? ex.kr ?? ex.ko ?? ex.en ?? ex.zh ?? "") || "";
    return "";
  };
  const rows = arr.map((item) => {
    const phrase = String((item?.phrase ?? item?.hanzi ?? item?.zh ?? item?.cn ?? "")).trim();
    const pinyin = String((item?.pinyin ?? item?.py ?? "")).trim();
    const expl = getExpl(item);
    if (!phrase) return "";
    const zhEsc = escapeHtml(phrase).replaceAll('"', "&quot;");
    return `<div class="review-extension-row" data-speak-text="${zhEsc}">
  <span class="review-extension-zh">${escapeHtml(phrase)}</span>
  <span class="review-extension-pinyin">${escapeHtml(pinyin)}</span>
  <span class="review-extension-meaning">${escapeHtml(expl)}</span>
  <button type="button" class="review-extension-speak" data-speak-text="${zhEsc}">🔊</button>
</div>`;
  }).filter(Boolean);
  containerEl.innerHTML = `${hero}<div class="review-extension-list">${rows.join("")}</div>`;
}
