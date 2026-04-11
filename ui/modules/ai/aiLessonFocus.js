/**
 * HSK 本课重点讲解区：基于课内数据的固定模板（非 AI 流式回复）
 * 栏目标题走 lang/*.json 的 ai.* 键，随系统语言切换。
 */

import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import * as LE from "../../core/i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** 与 aiLessonContext 一致 */
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

/** UI 文案：与 languageEngine 一致，支持 ai.xxx 与插值 */
function t(key, fallback = "") {
  const out = LE.t(key, fallback);
  return typeof out === "string" && out !== key ? out : fallback || key;
}

function ti(key, params, fallback = "") {
  const out = LE.t(key, params, fallback);
  return typeof out === "string" && out !== key ? out : LE.t(key, fallback);
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

/** 本课学习目标：2～4 条，紧贴课文数据 */
function buildObjectiveLines(lesson, lang) {
  const summary = pickLang(lesson?.summary, lang) || "";
  const fromData = Array.isArray(lesson?.objectives)
    ? lesson.objectives.map((o) => pickLang(o, lang)).filter(Boolean)
    : [];

  if (fromData.length >= 2) return fromData.slice(0, 4);

  const out = [];
  if (fromData.length === 1) out.push(fromData[0]);

  const parts = summary
    .split(/[。；;]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  for (const p of parts) {
    if (out.includes(p)) continue;
    out.push(p);
    if (out.length >= 4) break;
  }

  if (out.length >= 2) return out.slice(0, 4);

  const g0 = Array.isArray(lesson?.grammar) ? lesson.grammar[0] : null;
  if (g0) {
    const pat = str(g0.pattern != null ? g0.pattern : "");
    const hint = g0.hint ? pickLang(g0.hint, lang) : "";
    if (pat || hint) {
      const line = pat && hint ? `「${pat.replace(/\s*\/\s*/g, " / ")}」：${hint}` : pat || hint;
      if (line && !out.includes(line)) out.push(line);
    }
  }

  const c0 = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards[0] : null;
  if (c0 && out.length < 2) {
    const cs = pickLang(c0.summary, lang);
    if (cs && !out.includes(cs)) out.push(cs);
  }

  if (out.length >= 2) return out.slice(0, 4);
  if (summary) {
    const one = summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
    if (!out.length) return [one];
    out.push(one);
  }

  return out.slice(0, 4);
}

/** 根据常见 HSK1 句式推断「用法」说明（多语言文案键） */
function inferUsageForZh(zh, lang) {
  const z = str(zh).replace(/\s/g, "");
  if (!z) return "";
  if (/您好/.test(z)) return t("ai.lesson_focus_use_nin_hao", "向老师、长辈问好时的礼貌说法。");
  if (/你好/.test(z)) return t("ai.lesson_focus_use_ni_hao", "同学、朋友之间常用的问候。");
  if (/再见/.test(z)) return t("ai.lesson_focus_use_zaijian", "告别、分手时的常用语。");
  if (/对不起/.test(z)) return t("ai.lesson_focus_use_duibuqi", "打扰别人或表示歉意时使用。");
  if (/没关系/.test(z)) return t("ai.lesson_focus_use_meiguanxi", "回应别人的道歉。");
  if (/谢谢/.test(z)) return t("ai.lesson_focus_use_xiexie", "表示感谢。");
  if (/不客气/.test(z)) return t("ai.lesson_focus_use_bukeqi", "回应「谢谢」时的常用搭配。");
  return "";
}

/**
 * 核心表达：表达 + 用法（避免仅词表复述；优先本课对话与语法例句）
 * @returns {{ expr: string, py: string, gloss: string, usage: string }[]}
 */
function collectExpressionUsageRows(lesson, ctx, lang) {
  const rows = [];
  const seen = new Set();

  const pushRow = (expr, py, gloss, usage) => {
    const e = str(expr);
    if (!e || seen.has(e)) return;
    seen.add(e);
    const u = str(usage) || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。");
    rows.push({
      expr: e,
      py: str(py),
      gloss: str(gloss),
      usage: u,
    });
  };

  const vocab = ctx.vocab || [];
  for (const w of vocab.slice(0, 10)) {
    const han = str(w.hanzi);
    if (!han) continue;
    const py = str(w.pinyin);
    const gloss = str(w.meaning);
    const usage = inferUsageForZh(han, lang) || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。");
    pushRow(han, py, gloss, usage);
  }

  if (rows.length >= 3) return rows.slice(0, 8);

  const grammar = Array.isArray(lesson?.grammar) ? lesson.grammar : [];
  for (const g of grammar.slice(0, 2)) {
    const examples = Array.isArray(g.examples) ? g.examples : [];
    for (const ex of examples.slice(0, 6)) {
      const zh = str(ex.zh != null ? ex.zh : ex.text != null ? ex.text : "");
      if (!zh) continue;
      const py = str(ex.pinyin != null ? ex.pinyin : ex.py != null ? ex.py : "");
      const gloss = typeof ex.translation === "object" && ex.translation
        ? pickLang(ex.translation, lang)
        : "";
      const usage = inferUsageForZh(zh, lang)
        || (pickLang(g.explanation, lang) ? str(pickLang(g.explanation, lang)).slice(0, 90) + (str(pickLang(g.explanation, lang)).length > 90 ? "…" : "") : "")
        || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。");
      pushRow(zh, py, gloss, usage);
    }
    const pat = str(g.pattern != null ? g.pattern : "");
    if (pat && rows.length < 4) {
      const parts = pat.split(/\s*\/\s*|、/).map((p) => p.trim()).filter(Boolean);
      const glossG = pickLang(g.hint, lang);
      const usageG = pickLang(g.explanation, lang);
      const shortU = usageG.length > 100 ? `${usageG.slice(0, 97)}…` : usageG;
      for (const p of parts.slice(0, 3)) {
        if (!seen.has(p)) pushRow(p, str(g.pinyin), glossG, shortU || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。"));
      }
    }
  }

  if (rows.length) return rows.slice(0, 8);

  const speak = lesson?.aiPractice && Array.isArray(lesson.aiPractice.speaking) ? lesson.aiPractice.speaking : [];
  for (const s of speak.slice(0, 8)) {
    const line = str(s);
    if (!line) continue;
    pushRow(line, "", "", inferUsageForZh(line, lang) || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。"));
  }

  for (const d of (ctx.dialogue || []).slice(0, 8)) {
    const zh = str(d.zh);
    if (!zh || zh.length > 24) continue;
    pushRow(zh, str(d.pinyin), str(d.trans), inferUsageForZh(zh, lang) || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。"));
    if (rows.length >= 6) break;
  }

  return rows.slice(0, 8);
}

function renderCoreUsageHtml(rows, lang) {
  const usageLabel = t("ai.lesson_focus_label_usage", "用法");
  return rows
    .map((r) => {
      const main = `<strong>${escapeHtml(r.expr)}</strong>${r.py ? `（${escapeHtml(r.py)}）` : ""}`;
      const glossPart = r.gloss ? `<span class="ai-lesson-focus-gloss"> — ${escapeHtml(r.gloss)}</span>` : "";
      const usageLine = `<div class="ai-lesson-focus-usage"><span class="ai-lesson-focus-usage-k">${escapeHtml(usageLabel)}：</span>${escapeHtml(r.usage)}</div>`;
      return `<li class="ai-lesson-focus-core-item">${main}${glossPart}${usageLine}</li>`;
    })
    .join("");
}

/** 老师式短讲：结合对话内容触发要点，不全课硬套 */
function buildTeacherBullets(lesson, ctx, lang) {
  const bullets = [];
  const lines = ctx.dialogue || [];
  const joined = lines.map((l) => str(l.zh)).join("\n");

  if (/您好/.test(joined)) {
    bullets.push(t("ai.lesson_focus_bullet_polite_nin", "称呼老师后用「您好」，敬称「您」更正式。"));
  }
  if (/你好/.test(joined) && (/老师/.test(joined) || /同学/.test(joined) || lines.length > 1)) {
    bullets.push(t("ai.lesson_focus_bullet_casual_ni", "老师对学生或同学之间常用「你好」，语气较随意。"));
  }
  if (/对不起/.test(joined) && /没关系/.test(joined)) {
    bullets.push(t("ai.lesson_focus_bullet_apology_pair", "「对不起」与「没关系」常成对出现。"));
  }
  if (/谢谢/.test(joined) && /不客气/.test(joined)) {
    bullets.push(t("ai.lesson_focus_bullet_thanks_pair", "「谢谢」与「不客气」是常见致谢与回应。"));
  }

  const sceneSum = ctx.scene?.summary ? str(ctx.scene.summary) : "";
  if (bullets.length < 2 && sceneSum) {
    bullets.push(ti("ai.lesson_focus_bullet_scene", { text: sceneSum }, "场景：{text}"));
  }

  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  if (bullets.length < 2 && cards[0]) {
    const ct = pickLang(cards[0].title, lang);
    const cs = pickLang(cards[0].summary, lang);
    if (ct || cs) bullets.push(ti("ai.lesson_focus_card_bridge", { title: ct || "…", summary: cs || "…" }, "「{title}」：{summary}"));
  }

  const out = bullets.filter(Boolean);
  const dedup = [];
  for (const b of out) {
    if (!dedup.includes(b)) dedup.push(b);
  }
  return dedup.slice(0, 4);
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

  const objLines = buildObjectiveLines(lesson, lang);
  const coreRows = collectExpressionUsageRows(lesson, ctx, lang);
  const tips = collectTips(lesson, ctx, lang);
  const teacherBullets = buildTeacherBullets(lesson, ctx, lang);

  const quotes = (ctx.dialogue || []).slice(0, 2).filter((d) => str(d.zh));

  const H = {
    page: t("ai.lesson_focus_page_title", "本课重点讲解"),
    a: t("ai.lesson_focus_section_objectives", "本课学习目标"),
    b: t("ai.lesson_focus_section_hsk1", "对应 HSK1 能力点"),
    c: t("ai.lesson_focus_section_expressions", "本课核心表达（用法）"),
    d: t("ai.lesson_focus_section_scene_dialogue", "场景与对话"),
    e: t("ai.lesson_focus_section_tips", "学习提醒 / 易错点"),
  };

  const showSummaryLead = summary && objLines.length <= 1;
  const objBlock = objLines.length
    ? `<ul class="ai-lesson-focus-list">${objLines.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>`
    : `<p class="ai-lesson-focus-p">${escapeHtml(summary || t("ai.lesson_focus_no_core", "请结合本课对话学习。"))}</p>`;

  const coreBlock = coreRows.length
    ? `<ul class="ai-lesson-focus-list ai-lesson-focus-core">${renderCoreUsageHtml(coreRows, lang)}</ul>`
    : `<p class="ai-lesson-focus-muted">${escapeHtml(t("ai.lesson_focus_no_core", "请结合下方对话与练习中的句子学习本课表达。"))}</p>`;

  const sceneBlock = [
    sceneTitle ? `<p class="ai-lesson-focus-p"><strong>${escapeHtml(sceneTitle)}</strong></p>` : "",
    sceneSum ? `<p class="ai-lesson-focus-p">${escapeHtml(sceneSum)}</p>` : "",
    cardScenesHtml,
  ].filter(Boolean).join("");

  const teacherGuideHtml = teacherBullets.length
    ? `<div class="ai-lesson-focus-teacher-guide">
    <h6 class="ai-lesson-focus-subh">${escapeHtml(t("ai.lesson_focus_teacher_guide_title", "老师带你看对话"))}</h6>
    <ul class="ai-lesson-focus-list ai-lesson-focus-teacher-bullets">${teacherBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    <p class="ai-lesson-focus-quotes-lead">${escapeHtml(t("ai.lesson_focus_quotes_intro", "下面请看本课对话原文。"))}</p>
  </div>`
    : `<p class="ai-lesson-focus-quotes-lead">${escapeHtml(t("ai.lesson_focus_quotes_intro", "下面请看本课对话原文。"))}</p>`;

  const quoteBlock = quotes.length
    ? quotes.map((d) => {
      const line = `${d.speaker ? `${d.speaker}：` : ""}${d.zh}${d.pinyin ? `（${d.pinyin}）` : ""}`;
      const tr = d.trans ? `<span class="ai-lesson-focus-trans">${escapeHtml(d.trans)}</span>` : "";
      return `<blockquote class="ai-lesson-focus-quote"><div class="ai-lesson-focus-zh">${escapeHtml(line)}</div>${tr ? `<div class="ai-lesson-focus-tr">${tr}</div>` : ""}</blockquote>`;
    }).join("")
    : `<p class="ai-lesson-focus-muted">${escapeHtml(t("ai.lesson_focus_no_dialogue", "本课对话见教材会话区，请对照音频练习。"))}</p>`;

  const tipsBlock = tips.map((x) => `<li>${escapeHtml(x)}</li>`).join("");

  const summaryLeadHtml = showSummaryLead && summary
    ? `<p class="ai-lesson-focus-p ai-lesson-focus-summary">${escapeHtml(summary)}</p>`
    : "";

  return `
<div class="ai-lesson-focus">
  <header class="ai-lesson-focus-head">
    <h4 class="ai-lesson-focus-page-title">${escapeHtml(H.page)}</h4>
    <p class="ai-lesson-focus-course-line">${escapeHtml(title)}</p>
  </header>

  <section class="ai-lesson-focus-section">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.a)}</h5>
    ${summaryLeadHtml}
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
    ${teacherGuideHtml}
    <div class="ai-lesson-focus-quotes">${quoteBlock}</div>
  </section>

  <section class="ai-lesson-focus-section ai-lesson-focus-section--tips">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.e)}</h5>
    <ul class="ai-lesson-focus-list ai-lesson-focus-tips">${tipsBlock}</ul>
  </section>
</div>`.trim();
}
