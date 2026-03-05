// /ui/modules/hsk/hskRenderer.js ✅ FINAL
// - renderLessonList(container, lessons, { lang })
// - renderWordCards(gridEl, items, _, { lang })
// - Helpers: normalizeLang, wordKey, wordPinyin, wordMeaning

import { i18n } from "../../i18n.js";

// Returns "ko" | "en" | "zh"
export function normalizeLang(i18nLang) {
  const l = String(i18nLang ?? i18n?.getLang?.() ?? "ko").toLowerCase();
  if (l === "kr" || l === "ko") return "ko";
  if (l === "cn" || l === "zh") return "zh";
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

export function wordMeaning(x, lang) {
  if (x == null) return "";
  if (typeof x === "string") return "";
  const m = x.meaning;
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

  if (lang === "ko") {
    return str(x.ko) || str(x.kr) || (m && (str(m.ko) || str(m.kr))) ||
      str(x.en) || (m && str(m.en)) ||
      str(x.zh) || str(x.cn) || (m && (str(m.zh) || str(m.cn))) ||
      (typeof m === "string" ? m.trim() : "") ||
      wordKey(x) || "";
  }
  if (lang === "en") {
    return str(x.en) || (m && str(m.en)) ||
      str(x.ko) || str(x.kr) || (m && (str(m.ko) || str(m.kr))) ||
      str(x.zh) || str(x.cn) || (m && (str(m.zh) || str(m.cn))) ||
      (typeof m === "string" ? m.trim() : "") ||
      wordKey(x) || "";
  }
  // zh
  return str(x.zh) || str(x.cn) || (m && (str(m.zh) || str(m.cn))) ||
    str(x.ko) || str(x.kr) || (m && (str(m.ko) || str(m.kr))) ||
    str(x.en) || (m && str(m.en)) ||
    (typeof m === "string" ? m.trim() : "") ||
    wordKey(x) || "";
}

function pickText(v, lang = "ko") {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    return (
      v[lang] ||
      v.ko || v.kr ||
      v.zh || v.cn ||
      v.en ||
      ""
    );
  }
  return String(v);
}

export function renderLessonList(containerEl, lessons, { lang = "ko" } = {}) {
  if (!containerEl) return;
  const list = Array.isArray(lessons) ? lessons : [];

  containerEl.innerHTML = `
    <div class="lesson-list">
      ${list.map((it) => {
        const lessonNo = Number(it.lessonNo ?? it.no ?? it.lesson ?? it.id ?? 0) || 0;
        const file = it.file || it.path || it.url || "";
        const titleObj = it.title ?? it.name ?? it.label ?? "";
        const title = pickText(titleObj, lang) || pickText(titleObj, lang === "ko" ? "zh" : "ko") || "";
        const zh = pickText(titleObj, "zh");
        const ko = pickText(titleObj, "ko");
        const pinyin = pickText(it.pinyinTitle ?? it.pinyin ?? it.py ?? "", "zh");

        // Display lines:
        // - KR mode: show KO big, ZH small, pinyin small
        // - CN mode: show ZH big, KO small, pinyin small
        const big = (lang === "zh" || lang === "cn") ? (zh || title) : (ko || title);
        const small = (lang === "zh" || lang === "cn") ? (ko || "") : (zh || "");

        return `
          <button class="lesson-row w-full text-left rounded-2xl border border-slate-200 hover:border-slate-300 px-4 py-3 mb-3"
            data-open-lesson="1"
            data-lesson-no="${lessonNo}"
            data-file="${escapeHtmlAttr(file)}"
          >
            <div class="flex items-center gap-3">
              <div class="w-14 text-sm font-bold opacity-70">${lessonNo ? (i18n?.t?.("hsk_lesson_unit", { n: lessonNo }) || `${lessonNo}과`) : ""}</div>
              <div class="flex-1">
                <div class="text-base font-semibold">${escapeHtml(big)}</div>
                ${small ? `<div class="text-sm opacity-70">${escapeHtml(small)}</div>` : ``}
                ${pinyin ? `<div class="text-sm italic opacity-70">${escapeHtml(pinyin)}</div>` : ``}
              </div>
            </div>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

const MEANING_FALLBACK = {
  ko: "(뜻 정보 없음)",
  zh: "(暂无释义)",
  en: "(No meaning yet)",
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

/** 主释义 + 次要释义（老师对照用）：ko主+en次 / zh主+en次 / en主+zh次 */
function getMeaningMainAndSub(raw, lang) {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const m = raw?.meaning ?? raw;
  const obj = typeof m === "object" ? m : {};
  const ko = str(raw?.ko ?? raw?.kr ?? obj.ko ?? obj.kr);
  const zh = str(raw?.zh ?? raw?.cn ?? obj.zh ?? obj.cn) || wordKey(raw);
  const en = str(raw?.en ?? obj.en ?? obj.english);

  if (lang === "ko") return { main: ko || en || zh, sub: en };
  if (lang === "zh") return { main: zh || en || ko, sub: en };
  return { main: en || zh || ko, sub: zh };
}

/** 打开笔顺：跳转 stroke 页面（?ch= 已支持）；MODALS 可用时弹窗占位 */
function openStroke(hanzi) {
  const ch = String(hanzi ?? "").trim();
  if (!ch) return;

  const modals = window.__HSK_GENERIC_MODALS?.generic;
  if (modals?.open) {
    modals.open({
      title: (i18n?.t?.("stroke_title") || "笔顺") + "：" + ch,
      html: `<div class="p-4"><p class="text-lg font-bold">${escapeHtml(ch)}</p><p class="text-sm text-gray-500 mt-2">(TODO: stroke player)</p></div>`,
    });
    return;
  }
  const base = (window.DATA_PATHS?.getBase?.()) || ".";
  window.location.href = `${String(base).replace(/\/+$/, "")}/pages/stroke.html?ch=${encodeURIComponent(ch)}`;
}

export function renderWordCards(gridEl, items, onClickWord, { lang } = {}) {
  if (!gridEl) return;
  const arr = Array.isArray(items) ? items : [];
  const currentLang = normalizeLang(lang ?? i18n?.getLang?.());

  const cards = arr.map((x) => {
    try {
      const raw = typeof x === "string" ? { hanzi: x } : (x || {});
      const han = wordKey(raw) || String(raw.hanzi ?? raw.han ?? raw.word ?? raw.zh ?? raw.cn ?? raw.simplified ?? raw.trad ?? "").trim();
      const pinyinStr = wordPinyin(raw);
      const { main: meaningMain, sub: meaningSub } = getMeaningMainAndSub(raw, currentLang);
      let mainStr = meaningMain;
      if (mainStr && mainStr.includes("object Object")) mainStr = "";
      if (!mainStr) {
        mainStr = MEANING_FALLBACK[currentLang] ?? MEANING_FALLBACK.ko;
      }
      const subStr = meaningSub || "";

      const learnLabel = currentLang === "ko" ? "학습" : currentLang === "zh" ? "学习" : "Learn";
      const strokeLabel = currentLang === "ko" ? "획" : currentLang === "zh" ? "笔画" : "Stroke";
      const audioLabel = currentLang === "ko" ? "발음" : currentLang === "zh" ? "发音" : "Audio";
      const strokeDisabled = !han ? " disabled" : "";

      return `
      <div class="word-card" data-word-hanzi="${escapeHtmlAttr(han)}">
        <div class="word-hanzi">${escapeHtml(han)}</div>
        <div class="word-pinyin">${escapeHtml(pinyinStr)}</div>
        <div class="word-meaning">
          <div class="word-meaning-main">${escapeHtml(mainStr)}</div>
          ${subStr ? `<div class="word-meaning-sub">${escapeHtml(subStr)}</div>` : ""}
        </div>
        <div class="word-actions">
          <button type="button" class="btn btn-learn" data-action="learn" data-hanzi="${escapeHtmlAttr(han)}">${escapeHtml(learnLabel)}</button>
          <button type="button" class="btn btn-stroke" data-action="stroke" data-hanzi="${escapeHtmlAttr(han)}"${strokeDisabled}>${escapeHtml(strokeLabel)}</button>
          <button type="button" class="btn btn-audio" data-action="audio" data-hanzi="${escapeHtmlAttr(han)}" data-pinyin="${escapeHtmlAttr(pinyinStr)}">${escapeHtml(audioLabel)}</button>
        </div>
      </div>
    `;
    } catch (e) {
      console.warn("[renderWordCards] failed for item:", x, e);
      return `<div class="word-card" style="border:1px solid #fecaca;color:#dc2626;"><div class="word-meaning">Error rendering word</div></div>`;
    }
  });

  gridEl.innerHTML = `<div class="word-grid">${cards.join("")}</div>`;

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
    const btn = e.target.closest("[data-action]");
    if (!btn || !btn.closest(".word-card")) return;

    const action = btn.dataset.action;
    const hanzi = (btn.dataset.hanzi || "").trim();
    const pinyin = (btn.dataset.pinyin || "").trim();

    if (!hanzi && action !== "learn") return;
    if (action === "stroke" && btn.disabled) return;

    if (action === "audio") {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("btn-audio-active");
      try {
        const { speakChinese } = await import("../../core/tts.js");
        await speakChinese(hanzi || pinyin, { rate: 0.9, lang: "zh-CN" });
      } catch (err) {
        console.error("[TTS] failed:", err);
        if (typeof alert === "function") alert("TTS failed. Check console.");
      } finally {
        setTimeout(() => btn.classList.remove("btn-audio-active"), 400);
      }
    }

    if (action === "stroke") {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("btn-stroke-active");
      try {
        const modals = window.__HSK_GENERIC_MODALS?.generic;
        if (modals?.open) {
          modals.open({
            title: (i18n?.t?.("stroke_title") || "笔顺") + "：" + hanzi,
            html: `<div style="font-size:48px;font-weight:700;line-height:1">${escapeHtml(hanzi)}</div><div style="margin-top:8px;opacity:.7">笔顺模块待接入</div>`,
          });
        } else {
          const base = (window.DATA_PATHS?.getBase?.()) || ".";
          const url = `${String(base).replace(/\/+$/, "")}/pages/stroke.html?ch=${encodeURIComponent(hanzi)}`;
          window.location.href = url;
        }
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
