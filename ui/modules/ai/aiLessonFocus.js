/**
 * HSK 本课重点讲解区：基于课内数据的固定模板（非 AI 流式回复）
 */

import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { i18n } from "../../i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function t(key, fallback = "") {
  return (i18n && typeof i18n.t === "function" ? i18n.t(key, fallback) : null) || fallback || key;
}

/** 与 aiLessonContext 一致，便于读取 zh/cn、kr/ko 等别名 */
function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "ko").toLowerCase();
  const key = l === "zh" || l === "cn" ? "zh" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  const v = obj[key] != null ? obj[key] : obj[key === "kr" ? "ko" : key === "zh" ? "cn" : key === "jp" ? "ja" : key];
  return str(v != null ? v : "");
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hsk1AbilityNarrative(lang) {
  const l = (lang || "kr").toLowerCase();
  if (l === "zh" || l === "cn") {
    return "HSK 一级面向最基础日常交际：能用简短固定表达完成问候、告别、致谢、道歉、简单回应等。本课内容均在该难度范围内。";
  }
  if (l === "ko" || l === "kr") {
    return "HSK 1급은 일상에서 꼭 필요한 아주 기초적인 의사소통(인사·작별·감사·사과·간단한 응답 등)을 다룹니다. 본과 내용은 이 범위 안에서만 구성되어 있습니다.";
  }
  if (l === "jp" || l === "ja") {
    return "HSK1級は、あいさつ・別れ・感謝・謝罪・短い返答など、日常生活に必要な最小限の表現力です。本課の内容はこの水準に収めています。";
  }
  return "HSK Level 1 covers basic survival communication: greetings, thanks, apologies, and short fixed phrases. This lesson stays within that scope.";
}

function collectCoreLines(lesson, ctx, lang) {
  const lines = [];
  for (const w of (ctx.vocab || []).slice(0, 8)) {
    const han = str(w.hanzi || "");
    if (!han) continue;
    const py = str(w.pinyin || "");
    const m = str(w.meaning || "");
    lines.push(`${han}${py ? `（${py}）` : ""}${m ? ` — ${m}` : ""}`);
  }
  if (lines.length) return lines;
  const g = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  for (const it of g.slice(0, 3)) {
    const pat = str(it.pattern != null ? it.pattern : "");
    if (pat) lines.push(pat);
  }
  const speak = lesson?.aiPractice && Array.isArray(lesson.aiPractice.speaking) ? lesson.aiPractice.speaking : [];
  for (const s of speak.slice(0, 8)) {
    const x = str(s);
    if (x) lines.push(x);
  }
  for (const d of (ctx.dialogue || []).slice(0, 6)) {
    const zh = str(d.zh || "");
    if (zh) lines.push(`${zh}${d.pinyin ? `（${d.pinyin}）` : ""}`);
  }
  return lines.slice(0, 8);
}

function collectTips(lesson, ctx, lang) {
  const tips = [];
  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  const g0 = grammar[0];
  if (g0?.hint) {
    const h = pickLang(g0.hint, lang);
    if (h) tips.push(h);
  }
  if (g0?.explanation) {
    const ex = pickLang(g0.explanation, lang);
    if (ex && tips.length < 2) {
      const short = ex.length > 180 ? `${ex.slice(0, 177)}…` : ex;
      if (!tips.includes(short)) tips.push(short);
    }
  }
  if (tips.length < 1) {
    tips.push(t("ai.lesson_tip_fallback_1", "注意礼貌用语与场合：对长辈、师长多用「您」，同辈或较随意场合常用「你」。"));
  }
  if (tips.length < 2) {
    tips.push(t("ai.lesson_tip_fallback_2", "先听清对话场景，再模仿本课句子，不要跳级使用未学过的说法。"));
  }
  return tips.slice(0, 2);
}

/**
 * 生成本课重点讲解 HTML（进入 tab 即展示，无按钮、无 AI 回复区）
 * @param {object} lesson
 * @param {string} lang
 * @returns {string}
 */
export function renderLessonFocusHtml(lesson, lang) {
  const ctx = buildLessonContext(lesson, { lang });
  const title = ctx.lessonTitle || pickLang(lesson?.title, lang) || "—";
  const summary = pickLang(lesson?.summary, lang) || "";
  const sceneTitle = ctx.scene?.title || "";
  const sceneSum = ctx.scene?.summary || "";
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  const cardScenesHtml = cards.slice(0, 3).map((c) => {
    const ct = pickLang(c.title, lang);
    const cs = pickLang(c.summary, lang);
    if (!ct && !cs) return "";
    return `<div class="ai-lesson-focus-mini-scene">
      ${ct ? `<p class="ai-lesson-focus-p"><strong>${escapeHtml(ct)}</strong></p>` : ""}
      ${cs ? `<p class="ai-lesson-focus-p">${escapeHtml(cs)}</p>` : ""}
    </div>`;
  }).filter(Boolean).join("");
  const objectives = Array.isArray(lesson?.objectives)
    ? lesson.objectives.map((o) => pickLang(o, lang)).filter(Boolean)
    : [];

  const coreLines = collectCoreLines(lesson, ctx, lang);
  const tips = collectTips(lesson, ctx, lang);

  const quotes = (ctx.dialogue || []).slice(0, 2).filter((d) => str(d.zh));

  const H = {
    page: t("ai.lesson_focus_page_title", "本课重点讲解"),
    a: t("ai.lesson_focus_section_a", "本课学习目标"),
    b: t("ai.lesson_focus_section_b", "对应 HSK1 能力点"),
    c: t("ai.lesson_focus_section_c", "本课核心表达"),
    d: t("ai.lesson_focus_section_d", "场景与对话"),
    e: t("ai.lesson_focus_section_e", "学习提醒 / 易错点"),
  };

  const objBlock = objectives.length
    ? `<ul class="ai-lesson-focus-list">${objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>`
    : `<p class="ai-lesson-focus-p">${escapeHtml(summary || "—")}</p>`;

  const coreBlock = coreLines.length
    ? `<ul class="ai-lesson-focus-list ai-lesson-focus-core">${coreLines.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
    : `<p class="ai-lesson-focus-muted">${escapeHtml(t("ai.lesson_focus_no_core", "请结合下方对话与练习中的句子学习本课表达。"))}</p>`;

  const sceneBlock = [
    sceneTitle ? `<p class="ai-lesson-focus-p"><strong>${escapeHtml(sceneTitle)}</strong></p>` : "",
    sceneSum ? `<p class="ai-lesson-focus-p">${escapeHtml(sceneSum)}</p>` : "",
    cardScenesHtml,
  ].filter(Boolean).join("");

  const quoteBlock = quotes.length
    ? quotes.map((d) => {
      const line = `${d.speaker ? `${d.speaker}：` : ""}${d.zh}${d.pinyin ? `（${d.pinyin}）` : ""}`;
      const tr = d.trans ? `<span class="ai-lesson-focus-trans">${escapeHtml(d.trans)}</span>` : "";
      return `<blockquote class="ai-lesson-focus-quote"><div class="ai-lesson-focus-zh">${escapeHtml(line)}</div>${tr ? `<div class="ai-lesson-focus-tr">${tr}</div>` : ""}</blockquote>`;
    }).join("")
    : `<p class="ai-lesson-focus-muted">${escapeHtml(t("ai.lesson_focus_no_dialogue", "本课对话见教材会话区，请对照音频练习。"))}</p>`;

  const tipsBlock = tips.map((x) => `<li>${escapeHtml(x)}</li>`).join("");

  return `
<div class="ai-lesson-focus">
  <header class="ai-lesson-focus-head">
    <h4 class="ai-lesson-focus-page-title">${escapeHtml(H.page)}</h4>
    <p class="ai-lesson-focus-course-line">${escapeHtml(title)}</p>
  </header>

  <section class="ai-lesson-focus-section">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.a)}</h5>
    ${summary ? `<p class="ai-lesson-focus-p ai-lesson-focus-summary">${escapeHtml(summary)}</p>` : ""}
    ${objBlock}
  </section>

  <section class="ai-lesson-focus-section">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.b)}</h5>
    <p class="ai-lesson-focus-p">${escapeHtml(hsk1AbilityNarrative(lang))}</p>
  </section>

  <section class="ai-lesson-focus-section">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.c)}</h5>
    ${coreBlock}
  </section>

  <section class="ai-lesson-focus-section">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.d)}</h5>
    ${sceneBlock}
    <div class="ai-lesson-focus-quotes">${quoteBlock}</div>
  </section>

  <section class="ai-lesson-focus-section ai-lesson-focus-section--tips">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.e)}</h5>
    <ul class="ai-lesson-focus-list ai-lesson-focus-tips">${tipsBlock}</ul>
  </section>
</div>`.trim();
}
