/**
 * HSK 本课重点讲解区：基于课内数据的固定模板（非 AI 流式回复）
 * 栏目标题走 lang/*.json 的 ai.* 键，随系统语言切换。
 */

import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import * as LE from "../../core/i18n.js";
import { getAiLearning, pickLessonLang, mapMultilingualLines } from "./aiLearningShared.js";
import { stripStandalonePinyinLinesForTts } from "../utils/explainPinyinTts.js";

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

/** 本课能力点：由对话/语法信号推导，不写整级 HSK1 总述；最多 3 条 */
function buildLessonAbilityItems(lesson, ctx, lang) {
  const al = getAiLearning(lesson);
  const le = al?.lessonExplain;
  /** 优先 abilityPoints（「이 과에서 기르는 말하기」）；勿被 practiceFocus 挤掉 */
  if (al?.abilityPoints?.length && Array.isArray(al.abilityPoints)) {
    const fromJson = al.abilityPoints.map((o) => pickLessonLang(o, lang)).filter(Boolean);
    if (fromJson.length >= 1) return fromJson.slice(0, 4);
  }
  if (le?.practiceFocus?.length && Array.isArray(le.practiceFocus)) {
    const lines = mapMultilingualLines(le.practiceFocus, lang);
    if (lines.length) return lines.slice(0, 4);
  }

  const joined = (ctx.dialogue || []).map((d) => str(d.zh)).join("");
  const g0 = Array.isArray(lesson?.grammar) ? lesson.grammar[0] : null;
  const pat = str(g0?.pattern != null ? g0.pattern : "");
  const skills = [];

  /** 「你」在多数课都会出现；仅当句中有敬称「您」或语法条目标出您/你对比时，才用第1课敬称模板 */
  if (/您/.test(joined) || /您/.test(pat) || (Number(lesson?.lessonNo) === 1 && /你/.test(pat))) {
    skills.push(t("ai.lesson_focus_ability_nin_ni", "能根据对象选用「您」与「你」。"));
  }
  if (/您好|你好|再见/.test(joined)) {
    skills.push(t("ai.lesson_focus_ability_greet", "能完成见面、道别等基础问候。"));
  }
  const hasApology = /对不起|没关系/.test(joined);
  const hasThanks = /谢谢|不客气/.test(joined);
  if (hasApology && hasThanks) {
    skills.push(t("ai.lesson_focus_ability_apology_thanks", "能作简单道歉、致谢及回应。"));
  } else {
    if (hasApology) skills.push(t("ai.lesson_focus_ability_apology", "能作简单道歉并恰当回应。"));
    if (hasThanks) skills.push(t("ai.lesson_focus_ability_thanks", "能致谢并回应谢意。"));
  }

  const out = skills.filter(Boolean);
  if (out.length >= 2) return out.slice(0, 3);

  const sum = pickLang(lesson?.summary, lang) || "";
  if (sum) {
    const one = sum.split(/[。；;]/)[0].trim();
    if (one.length > 8 && one.length < 120) out.push(one);
  }
  return out.slice(0, 3);
}

/** 本课学习目标：2～4 条，紧贴课文数据 */
function buildObjectiveLines(lesson, lang) {
  const al = getAiLearning(lesson);
  const le = al?.lessonExplain;
  if (le?.learningGoals?.length && Array.isArray(le.learningGoals)) {
    const lines = mapMultilingualLines(le.learningGoals, lang);
    if (lines.length) return lines.slice(0, 4);
  }

  const summary = pickLang(lesson?.summary, lang) || "";
  const fromData = Array.isArray(lesson?.objectives)
    ? lesson.objectives.map((o) => pickLang(o, lang)).filter(Boolean)
    : [];

  if (fromData.length >= 2) return fromData.slice(0, 3);

  const out = [];
  if (fromData.length === 1) out.push(fromData[0]);

  const parts = summary
    .split(/[。；;]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  for (const p of parts) {
    if (out.includes(p)) continue;
    out.push(p);
    if (out.length >= 3) break;
  }

  if (out.length >= 2) return out.slice(0, 3);

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

  if (out.length >= 2) return out.slice(0, 3);
  if (summary) {
    const one = summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
    if (!out.length) return [one];
    out.push(one);
  }

  return out.slice(0, 3);
}

/**
 * 重点表达精选：最多 4 组，与本课对话强相关，不复述全词表
 * @returns {{ expr: string, py: string, gloss: string, usage: string }[]}
 */
function collectCuratedExpressionGroups(lesson, ctx, lang) {
  const al = getAiLearning(lesson);
  if (al?.coreExpressions?.length && Array.isArray(al.coreExpressions)) {
    const mapped = al.coreExpressions
      .slice(0, 4)
      .map((ce) => {
        const expr = str(ce.expr != null ? ce.expr : ce.pattern);
        const py = str(ce.pinyin != null ? ce.pinyin : "");
        const usage = ce.usage && typeof ce.usage === "object" ? pickLessonLang(ce.usage, lang) : str(ce.usage);
        return { expr, py, gloss: "", usage: usage || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。") };
      })
      .filter((r) => r.expr);
    if (mapped.length) return mapped;
  }

  const joined = (ctx.dialogue || []).map((d) => str(d.zh)).join("");
  const g0 = Array.isArray(lesson?.grammar) ? lesson.grammar[0] : null;
  const pat = str(g0?.pattern != null ? g0.pattern : "");
  const patPy = str(g0?.pinyin != null ? g0.pinyin : "");
  const rows = [];

  const add = (expr, py, usageKey, usageFb) => {
    rows.push({
      expr: str(expr),
      py: str(py),
      gloss: "",
      usage: t(usageKey, usageFb),
    });
  };

  const lessonNo = Number(lesson?.lessonNo);
  const l1StyleGreeting =
    lessonNo === 1 || (lessonNo <= 1 && (/您好/.test(joined) || /王老师/.test(joined)));

  if (/您/.test(joined) || /您/.test(pat) || (Number(lesson?.lessonNo) === 1 && /你/.test(pat))) {
    add("您 / 你", patPy || "nín / nǐ", "ai.lesson_focus_group_usage_nin_ni", "按对象选用敬称「您」或一般「你」。");
  }
  if (l1StyleGreeting && (/您好/.test(joined) || /你好/.test(joined))) {
    add("您好 / 你好", "nín hǎo / nǐ hǎo", "ai.lesson_focus_group_usage_greeting", "「您好」更正式；「你好」常用于平辈、同学。");
  }
  if (/对不起/.test(joined) && /没关系/.test(joined)) {
    add("对不起 / 没关系", "duìbuqǐ / méi guānxi", "ai.lesson_focus_group_usage_apology", "道歉后，对方常接「没关系」。");
  }
  if (/谢谢/.test(joined) && /不客气/.test(joined)) {
    add("谢谢 / 不客气", "xièxie / bú kèqi", "ai.lesson_focus_group_usage_thanks", "致谢后，对方常接「不客气」。");
  }

  if (rows.length) return rows.slice(0, 4);

  if (g0?.pattern) {
    const hint = pickLang(g0.hint, lang);
    const ex = pickLang(g0.explanation, lang);
    const raw = (hint || ex || "").trim();
    const short = raw.length > 88 ? `${raw.slice(0, 85)}…` : raw;
    rows.push({
      expr: str(g0.pattern),
      py: patPy,
      gloss: "",
      usage: short || t("ai.lesson_focus_usage_fallback", "在本课对话里按角色与场合使用。"),
    });
  }

  return rows.slice(0, 4);
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

/** 课堂点题：短句，一条一点 */
function buildTeacherBullets(lesson, ctx, lang) {
  const al = getAiLearning(lesson);
  if (al?.lessonExplain?.scenarioSummary && typeof al.lessonExplain.scenarioSummary === "object") {
    return [];
  }
  if (al && (al.coreExpressions?.length || al.focusTips?.length || al.abilityPoints?.length)) {
    const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
    const out = [];
    for (const c of cards.slice(0, 2)) {
      const ct = pickLessonLang(c.title, lang);
      const cs = pickLessonLang(c.summary, lang);
      if (ct && cs) out.push(`${ct} — ${cs}`);
      else if (cs) out.push(cs);
      else if (ct) out.push(ct);
    }
    if (out.length) return out.slice(0, 4);
  }

  const joined = (ctx.dialogue || []).map((l) => str(l.zh)).join("\n");
  const bullets = [];

  if (/您好/.test(joined)) {
    bullets.push(t("ai.lesson_focus_bullet_short_nin", "对老师、长辈：用「您好」。"));
  }
  if (/你好/.test(joined)) {
    bullets.push(t("ai.lesson_focus_bullet_short_ni", "对同学、朋友：常用「你好」。"));
  }
  if (/对不起/.test(joined) && /没关系/.test(joined)) {
    bullets.push(t("ai.lesson_focus_bullet_short_apology", "「对不起」→「没关系」。"));
  }
  if (/谢谢/.test(joined) && /不客气/.test(joined)) {
    bullets.push(t("ai.lesson_focus_bullet_short_thanks", "「谢谢」→「不客气」。"));
  }

  const seen = new Set();
  const out = [];
  for (const b of bullets) {
    if (b && !seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out.slice(0, 4);
}

function collectTipsFinal(lesson, lang) {
  const al = getAiLearning(lesson);
  const le = al?.lessonExplain;
  if (le?.confusionPoints?.length && Array.isArray(le.confusionPoints)) {
    const tips = mapMultilingualLines(le.confusionPoints, lang);
    if (tips.length) return tips.slice(0, 4);
  }
  if (al?.focusTips?.length && Array.isArray(al.focusTips)) {
    const tips = al.focusTips.map((tip) => pickLessonLang(tip, lang)).filter(Boolean);
    if (tips.length) return tips.slice(0, 4);
  }
  const no = Number(lesson?.lessonNo);
  if (no > 1) {
    return [
      t("ai.lesson_focus_tip_fallback_generic_1", "结合本课对话，注意问句与答句配对，生词在句子里记。"),
      t("ai.lesson_focus_tip_fallback_generic_2", "不确定时先模仿课文原句，再替换人名、数字或国名。"),
    ];
  }
  return [
    t("ai.lesson_focus_tip_final_1", "「您」偏敬称（师长、长辈）；「你」多用在平辈、熟人。"),
    t("ai.lesson_focus_tip_final_2", "「没关系」应道歉；「不客气」应谢谢——别混。"),
  ];
}

/** 场景区：与会话卡一致，单段略写，减少与下方对话重复 */
function buildCompactSceneHtml(lesson, ctx, lang) {
  const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
  const parts = [];
  const st = ctx.scene?.title ? str(ctx.scene.title) : "";
  if (st) {
    parts.push(`<p class="ai-lesson-focus-p ai-lesson-focus-scene-lead"><strong>${escapeHtml(st)}</strong></p>`);
  }
  for (const c of cards.slice(0, 2)) {
    const ct = pickLang(c.title, lang);
    const cs = pickLang(c.summary, lang);
    if (!cs && !ct) continue;
    const short = cs.length > 76 ? `${cs.slice(0, 73)}…` : cs;
    const line = ct && short ? `${escapeHtml(ct)}：${escapeHtml(short)}` : escapeHtml(ct || short);
    parts.push(`<p class="ai-lesson-focus-p ai-lesson-focus-scene-line">${line}</p>`);
  }
  if (!parts.length && ctx.scene?.summary) {
    const ss = str(ctx.scene.summary);
    parts.push(`<p class="ai-lesson-focus-p">${escapeHtml(ss.length > 100 ? `${ss.slice(0, 97)}…` : ss)}</p>`);
  }
  return parts.join("");
}

/** 情境与对话：有 lessonExplain.scenarioSummary 时优先用本课概括，避免与第1课通用模板混用 */
function buildSceneSectionHtml(lesson, ctx, lang) {
  const le = getAiLearning(lesson)?.lessonExplain;
  if (le?.scenarioSummary && typeof le.scenarioSummary === "object") {
    const text = pickLessonLang(le.scenarioSummary, lang);
    if (text) {
      return `<p class="ai-lesson-focus-p ai-lesson-focus-scenario-summary">${escapeHtml(text)}</p>`;
    }
  }
  return buildCompactSceneHtml(lesson, ctx, lang);
}

/**
 * 生成本课重点讲解 HTML（进入 tab 即展示，无按钮、无 AI 回复区）
 */
export function renderLessonFocusHtml(lesson, lang) {
  const ctx = buildLessonContext(lesson, { lang });
  const title = ctx.lessonTitle || pickLang(lesson?.title, lang) || "—";
  const summary = pickLang(lesson?.summary, lang) || "";
  const al = getAiLearning(lesson);
  const le = al?.lessonExplain;

  const objLines = buildObjectiveLines(lesson, lang);
  const abilityItems = buildLessonAbilityItems(lesson, ctx, lang);
  const coreRows = collectCuratedExpressionGroups(lesson, ctx, lang);
  const tips = collectTipsFinal(lesson, lang);
  const teacherBullets = buildTeacherBullets(lesson, ctx, lang);

  const quotes = (ctx.dialogue || []).slice(0, 2).filter((d) => str(d.zh));

  const usePracticeFocusLabel = !!(
    le?.practiceFocus?.length &&
    Array.isArray(le.practiceFocus) &&
    !(al?.abilityPoints?.length && Array.isArray(al.abilityPoints))
  );
  const H = {
    page: t("ai.lesson_focus_page_title", "本课重点讲解"),
    a: t("ai.lesson_focus_section_objectives", "本课学习目标"),
    b: usePracticeFocusLabel
      ? t("ai.lesson_focus_section_practice_focus", "这课练什么说法")
      : t("ai.lesson_focus_section_hsk1", "本课能力点"),
    c: le
      ? t("ai.lesson_focus_section_core_pick", "核心表达挑着看")
      : t("ai.lesson_focus_section_expressions", "重点表达精选"),
    d: t("ai.lesson_focus_section_scene_dialogue", "场景与对话"),
    e: t("ai.lesson_focus_section_tips", "易混提醒"),
  };

  const showSummaryLead = !le && summary && objLines.length <= 1;
  const objBlock = objLines.length
    ? `<ul class="ai-lesson-focus-list ai-lesson-focus-list--multiline">${objLines.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>`
    : `<p class="ai-lesson-focus-p">${escapeHtml(summary || t("ai.lesson_focus_no_core", "请结合本课对话学习。"))}</p>`;

  const coreBlock = coreRows.length
    ? `<ul class="ai-lesson-focus-list ai-lesson-focus-core">${renderCoreUsageHtml(coreRows, lang)}</ul>`
    : `<p class="ai-lesson-focus-muted">${escapeHtml(t("ai.lesson_focus_no_core", "请结合下方对话与练习中的句子学习本课表达。"))}</p>`;

  const sceneBlock = buildSceneSectionHtml(lesson, ctx, lang);

  const abilityBlock = abilityItems.length
    ? `<ul class="ai-lesson-focus-list ai-lesson-focus-ability-list ai-lesson-focus-list--multiline">${abilityItems.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
    : `<p class="ai-lesson-focus-muted">${escapeHtml(t("ai.lesson_focus_ability_empty", "请结合学习目标与对话掌握本课交际。"))}</p>`;

  const teacherGuideHtml = teacherBullets.length
    ? `<div class="ai-lesson-focus-teacher-guide">
    <h6 class="ai-lesson-focus-subh">${escapeHtml(t("ai.lesson_focus_teacher_guide_title", "老师带你看对话"))}</h6>
    <ul class="ai-lesson-focus-list ai-lesson-focus-teacher-bullets">${teacherBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    <p class="ai-lesson-focus-quotes-lead">${escapeHtml(t("ai.lesson_focus_quotes_intro_short", "对话示例："))}</p>
  </div>`
    : `<p class="ai-lesson-focus-quotes-lead">${escapeHtml(t("ai.lesson_focus_quotes_intro_short", "对话示例："))}</p>`;

  const quoteBlock = quotes.length
    ? quotes.map((d) => {
      const line = `${d.speaker ? `${d.speaker}：` : ""}${d.zh}${d.pinyin ? `（${d.pinyin}）` : ""}`;
      const tr = d.trans ? `<span class="ai-lesson-focus-trans">${escapeHtml(d.trans)}</span>` : "";
      return `<blockquote class="ai-lesson-focus-quote"><div class="ai-lesson-focus-zh">${escapeHtml(line)}</div>${tr ? `<div class="ai-lesson-focus-tr">${tr}</div>` : ""}</blockquote>`;
    }).join("")
    : `<p class="ai-lesson-focus-muted">${escapeHtml(t("ai.lesson_focus_no_dialogue", "本课对话见教材会话区，请对照音频练习。"))}</p>`;

  const tipsBlock = tips.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  const tipsListClass =
    "ai-lesson-focus-list ai-lesson-focus-tips" + (tips.some((x) => String(x).includes("\n")) ? " ai-lesson-focus-list--multiline" : "");

  const summaryLeadHtml = showSummaryLead && summary
    ? `<p class="ai-lesson-focus-p ai-lesson-focus-summary">${escapeHtml(summary)}</p>`
    : "";

  const speakBtnLabel = t("ai.lesson_focus_speak_all", "全文朗读");

  return `
<div class="ai-lesson-focus">
  <header class="ai-lesson-focus-head">
    <div class="ai-lesson-focus-speak-row">
      <button type="button" class="ai-btn ai-btn-secondary ai-lesson-focus-speak-all" aria-label="${escapeHtml(speakBtnLabel)}"><span class="ai-lesson-focus-speak-ic" aria-hidden="true">🔊</span><span class="ai-lesson-focus-speak-txt">${escapeHtml(speakBtnLabel)}</span></button>
    </div>
    <h4 class="ai-lesson-focus-page-title">${escapeHtml(H.page)}</h4>
    <p class="ai-lesson-focus-course-line">${escapeHtml(title)}</p>
  </header>

  <section class="ai-lesson-focus-section ai-lesson-focus-section--fold">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.a)}</h5>
    ${summaryLeadHtml}
    ${objBlock}
  </section>

  <section class="ai-lesson-focus-section ai-lesson-focus-section--fold">
    <h5 class="ai-lesson-focus-h">${escapeHtml(H.b)}</h5>
    ${abilityBlock}
  </section>

  <section class="ai-lesson-focus-section ai-lesson-focus-section--fold">
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
    <ul class="${escapeHtml(tipsListClass)}">${tipsBlock}</ul>
  </section>
</div>`.trim();
}

/**
 * 去掉全角/半角括号内的拼音，避免 TTS 与汉字重复朗读
 */
export function stripParenPinyinForSpeak(s) {
  let x = String(s ?? "");
  x = x.replace(/（[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ\s，,.·\-—0-9]+）/gu, "");
  x = x.replace(/\([a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùü\s,.\-·—0-9]+\)/g, "");
  return x.replace(/\s+/g, " ").trim();
}

/**
 * 供「全文朗读」：与页面展示顺序一致，分段交给 speakHsk30ZhUiSegmentChain（汉字中文读、释义系统语言读；括号内拼音不读）
 * @returns {{ zh?: string, ui?: string }[]}
 */
export function buildLessonFocusSpeakSegments(lesson, lang) {
  const ctx = buildLessonContext(lesson, { lang });
  const title = ctx.lessonTitle || pickLang(lesson?.title, lang) || "";
  const summary = pickLang(lesson?.summary, lang) || "";
  const al = getAiLearning(lesson);
  const le = al?.lessonExplain;
  const objLines = buildObjectiveLines(lesson, lang);
  const abilityItems = buildLessonAbilityItems(lesson, ctx, lang);
  const coreRows = collectCuratedExpressionGroups(lesson, ctx, lang);
  const tips = collectTipsFinal(lesson, lang);
  const teacherBullets = buildTeacherBullets(lesson, ctx, lang);
  const quotes = (ctx.dialogue || []).slice(0, 2).filter((d) => str(d.zh));

  const usePracticeFocusLabel = !!(
    le?.practiceFocus?.length &&
    Array.isArray(le.practiceFocus) &&
    !(al?.abilityPoints?.length && Array.isArray(al.abilityPoints))
  );
  const H = {
    page: t("ai.lesson_focus_page_title", "本课重点讲解"),
    a: t("ai.lesson_focus_section_objectives", "本课学习目标"),
    b: usePracticeFocusLabel
      ? t("ai.lesson_focus_section_practice_focus", "这课练什么说法")
      : t("ai.lesson_focus_section_hsk1", "本课能力点"),
    c: le
      ? t("ai.lesson_focus_section_core_pick", "核心表达挑着看")
      : t("ai.lesson_focus_section_expressions", "重点表达精选"),
    d: t("ai.lesson_focus_section_scene_dialogue", "场景与对话"),
    e: t("ai.lesson_focus_section_tips", "易混提醒"),
  };

  const segs = [];
  const pushUi = (u) => {
    const s = str(u);
    if (s) segs.push({ ui: s });
  };
  const pushZhUi = (zh, ui) => {
    const z = str(stripParenPinyinForSpeak(zh));
    const u = str(ui);
    if (z && u) segs.push({ zh: z, ui: u });
    else if (z) segs.push({ zh: z });
    else if (u) segs.push({ ui: u });
  };

  pushUi(H.page);
  if (title) {
    if (/[\u4e00-\u9fff]/.test(title)) segs.push({ zh: stripParenPinyinForSpeak(title) });
    else pushUi(title);
  }

  pushUi(H.a);
  const showSummaryLead = !le && summary && objLines.length <= 1;
  if (showSummaryLead && summary) pushUi(summary);
  for (const o of objLines) pushUi(stripStandalonePinyinLinesForTts(o));

  pushUi(H.b);
  for (const x of abilityItems) pushUi(stripStandalonePinyinLinesForTts(x));

  pushUi(H.c);
  for (const r of coreRows) {
    pushZhUi(r.expr, r.usage);
  }

  pushUi(H.d);
  const sceneIdx = segs.length;
  if (le?.scenarioSummary && typeof le.scenarioSummary === "object") {
    const ss = pickLessonLang(le.scenarioSummary, lang);
    if (ss) pushUi(stripStandalonePinyinLinesForTts(ss));
  } else {
    const st = ctx.scene?.title ? str(ctx.scene.title) : "";
    if (st) pushUi(st);
    const cards = Array.isArray(lesson?.dialogueCards) ? lesson.dialogueCards : [];
    for (const c of cards.slice(0, 2)) {
      const ct = pickLang(c.title, lang);
      const cs = pickLang(c.summary, lang);
      if (!cs && !ct) continue;
      const short = cs.length > 76 ? `${cs.slice(0, 73)}…` : cs;
      const line = ct && short ? `${ct}：${short}` : ct || short;
      pushUi(line);
    }
    if (segs.length === sceneIdx && ctx.scene?.summary) {
      const ss = str(ctx.scene.summary);
      pushUi(ss.length > 100 ? `${ss.slice(0, 97)}…` : ss);
    }
  }

  pushUi(t("ai.lesson_focus_teacher_guide_title", "老师带你看对话"));
  for (const b of teacherBullets) pushUi(b);

  for (const d of quotes) {
    const zhLine = `${d.speaker ? `${d.speaker}：` : ""}${str(d.zh)}`;
    const tr = str(d.trans);
    pushZhUi(zhLine, tr);
  }

  pushUi(H.e);
  for (const tip of tips) pushUi(stripStandalonePinyinLinesForTts(tip));

  return segs.filter((s) => str(s.zh) || str(s.ui));
}
