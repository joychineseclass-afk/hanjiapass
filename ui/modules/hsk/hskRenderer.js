// /ui/modules/hsk/hskRenderer.js ✅ FINAL
// - renderLessonList(container, lessons, { lang })
// - renderWordCards(gridEl, items, _, { lang })
// - Helpers: normalizeLang, wordKey, wordPinyin, wordMeaning

import { i18n } from "../../i18n.js";
import { openStrokeInModal } from "./strokeModal.js";
import { openStrokePlayer } from "../stroke/index.js";
import { resolvePinyin } from "../../utils/pinyinEngine.js";
import { getMeaningByLang, getPosByLang, getWordImageUrl } from "../../utils/wordDisplay.js";
import { getLocalizedText } from "../../utils/localizedText.js";

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
  if (typeof location !== "undefined" && location.pathname?.includes("/pages/")) {
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

// Returns "ko" | "en" | "zh" | "jp"
export function normalizeLang(i18nLang) {
  const l = String(i18nLang ?? i18n?.getLang?.() ?? "ko").toLowerCase();
  if (l === "kr" || l === "ko") return "ko";
  if (l === "cn" || l === "zh") return "zh";
  if (l === "jp" || l === "ja") return "jp";
  if (l === "en") return "en";
  return "ko";
}

export function wordKey(x) {
  if (x == null) return "";
  if (typeof x === "string") return x.trim();
  return String(x.hanzi ?? x.word ?? x.zh ?? x.cn ?? "").trim();
}

export function wordPinyin(x) {
  if (x == null || typeof x === "string") return "";
  return String(x.pinyin ?? x.py ?? "").trim();
}

/** 按系统语言取释义，委托给全站统一的 getMeaningByLang */
export function wordMeaning(x, lang) {
  if (x == null) return "";
  if (typeof x === "string") return "";
  const l = normalizeLang(lang);
  return getMeaningByLang(x, l, wordKey(x) || "");
}

function pickText(v, lang = "ko") {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    const contentLang = lang === "ko" ? "kr" : (lang === "zh" ? "cn" : lang === "jp" ? "jp" : lang);
    return getLocalizedText(v, lang, "") || getLocalizedText(v, contentLang, "");
  }
  return String(v);
}

export function renderLessonList(containerEl, lessons, { lang = "ko", currentLessonNo = 0 } = {}) {
  if (!containerEl) return;
  const list = Array.isArray(lessons) ? lessons : [];
  const arrow = "›";

  const rows = list.map((it) => {
    const lessonNo = Number(it.lessonNo ?? it.no ?? it.lesson ?? it.id ?? 0) || 0;
    const file = it.file || it.path || it.url || "";

    const titleObj = it.title ?? it.name ?? it.label ?? "";
    let zh = "";
    if (typeof titleObj === "string") {
      const s = titleObj.trim();
      const parts = s.split(/\s*\/\s*/);
      zh = parts.find((p) => /[\u4e00-\u9fff]/.test(p)) || parts[parts.length - 1] || s;
    } else {
      zh = pickText(titleObj, "zh") || pickText(titleObj, "cn") || "";
    }

    const contentLang = lang === "ko" ? "kr" : (lang === "zh" ? "cn" : lang);
    let translation = getLocalizedText(titleObj, contentLang, "") || it.titleJp ?? it.titleEn ?? it.titleKo ?? "";
    if (!translation && typeof titleObj === "string") {
      const parts = String(titleObj).split(/\s*\/\s*/);
      translation = parts.find((p) => !/[\u4e00-\u9fff]/.test(p))?.trim() ?? "";
    }

    const titleDisplay = (lang === "zh" || lang === "cn") ? (zh || translation) : (translation || zh || "-");
    const lessonNoFormatted = i18n?.t?.("hsk.lesson_no_format", { n: lessonNo }) || (contentLang === "jp" ? `第 ${lessonNo} 課` : contentLang === "kr" ? `제 ${lessonNo}과` : contentLang === "cn" ? `第 ${lessonNo} 课` : `Lesson ${lessonNo}`);
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

  const emptyMsg = i18n?.t?.("hsk_empty_lessons") || "—";
  containerEl.innerHTML = `<div class="hsk-directory-rows">${rows || `<div class="hsk-directory-empty">${escapeHtml(emptyMsg)}</div>`}</div>`;
}

const MEANING_FALLBACK = {
  ko: "(뜻 정보 없음)",
  zh: "(暂无释义)",
  en: "(No meaning yet)",
  jp: "(意味なし)",
};

function meaningTextOf(val, lang) {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) return val.map(v => meaningTextOf(v, lang)).filter(Boolean).join(" / ");
  if (typeof val === "object") {
    const v = wordMeaning(val, lang);
    if (v) return v;
    const pick = val.meaning ?? val.text ?? val.def ?? val.gloss ?? "";
    if (typeof pick === "string") return pick.trim();
    if (typeof pick === "object") return wordMeaning({ meaning: pick }, lang) || "";
    return "";
  }
  return String(val);
}

export function renderWordCards(gridEl, items, onClickWord, { lang, scope } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];
  const currentLang = normalizeLang(lang ?? i18n?.getLang?.());
  const glossaryScope = scope || "";

  const cards = arr.map((x) => {
    try {
      const raw = typeof x === "string" ? { hanzi: x } : (x || {});
      const han = wordKey(raw) || String(raw.hanzi ?? raw.han ?? raw.word ?? raw.zh ?? raw.cn ?? raw.simplified ?? raw.trad ?? "").trim();
      let pinyinStr = wordPinyin(raw);
      if (!pinyinStr && han) pinyinStr = resolvePinyin(han, pinyinStr);

      let mainStr = getMeaningByLang(raw, currentLang, han, glossaryScope);
      if (mainStr && mainStr.includes("object Object")) mainStr = "";
      if (!mainStr) {
        mainStr = MEANING_FALLBACK[currentLang] ?? MEANING_FALLBACK.ko;
      }

      const posStr = getPosByLang(raw, currentLang, glossaryScope);

      const learnLabel = i18n?.t?.("lesson.learn") || (currentLang === "ko" ? "학습" : currentLang === "zh" ? "学习" : currentLang === "jp" ? "学習" : "Learn");
      const strokeLabel = i18n?.t?.("stroke.btn_trace") || (currentLang === "ko" ? "획" : currentLang === "zh" ? "笔画" : currentLang === "jp" ? "筆順" : "Stroke");
      const audioLabel = i18n?.t?.("common.listen") || i18n?.t?.("common.speak") || (currentLang === "ko" ? "발음" : currentLang === "zh" ? "发音" : currentLang === "jp" ? "発音" : "Audio");
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
  <h3 class="lesson-section-title">${escapeHtml(i18n?.t?.("hsk_tab_words") || "单词")}</h3>
  <p class="lesson-section-subtitle">${escapeHtml(i18n?.t?.("vocab_subtitle") || "本课词汇，点击可听发音。")}</p>
  ${arr.length ? `<span class="lesson-section-count">${escapeHtml((i18n?.t?.("vocab_count") || "{n}词").replace("{n}", arr.length))}</span>` : ""}
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

let _wordCardBound = false;

/** 文档级事件委托，确保 rerender 后点击仍有效 */
export function bindWordCardActions() {
  if (_wordCardBound) return;
  _wordCardBound = true;

  document.addEventListener("click", async (e) => {
    const card = e.target.closest(".word-card");
    if (!card) return;

    const charSpan = e.target.closest(".word-hanzi-char");
    if (charSpan) {
      e.preventDefault();
      e.stopPropagation();
      const char = (charSpan.dataset.char || "").trim();
      const wordId = (charSpan.dataset.word || "").trim();
      if (!char) return;
      const lessonId = window.__HSK_PAGE_CTX?.lessonNo ?? window.__HSK_CURRENT_LESSON_ID ?? "";
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
        if (!AUDIO_ENGINE?.isSpeechSupported?.()) {
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
          onEnd: () => cardEl?.classList.remove("is-speaking"),
          onError: () => cardEl?.classList.remove("is-speaking"),
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
        version: window.__HSK_PAGE_CTX?.version ?? localStorage.getItem("hsk_vocab_version") ?? "hsk2.0",
        level: window.__HSK_PAGE_CTX?.level ?? 1,
        lessonId: window.__HSK_PAGE_CTX?.lessonNo ?? window.__HSK_CURRENT_LESSON_ID ?? "",
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
      const item = window.__HSK_WORD_ITEMS_BY_HANZI?.get?.(hanzi) ?? { hanzi, pinyin };
      const fn = window.__HSK_ON_CLICK_WORD;
      if (typeof fn === "function") fn(item);
      else if (window.LEARN_PANEL?.open) window.LEARN_PANEL.open(item);
    }
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#96;");
}
