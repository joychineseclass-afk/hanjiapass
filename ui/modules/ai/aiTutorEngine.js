/**
 * AI Tutor v1 Engine
 * 统一 explain / roleplay / shadowing / free_talk 四种模式
 * 为后续 HSK2 / Kids / Business 复用
 */

import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { i18n } from "../../i18n.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function t(key, fallback = "") {
  return (i18n && typeof i18n.t === "function" ? i18n.t(key, fallback) : null) || fallback || key;
}

/** 从多语言对象中按 lang 取值 */
function pickLang(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = (lang || "kr").toLowerCase();
  const key = l === "zh" || l === "cn" ? "cn" : l === "ko" || l === "kr" ? "kr" : l === "jp" || l === "ja" ? "jp" : "en";
  const v = obj[key] || obj.zh || obj.cn || obj.kr || obj.jp || obj.en;
  return str(v != null ? v : "");
}

/** 支持的 AI Tutor 模式 */
export const TUTOR_MODES = ["explain", "roleplay", "shadowing", "free_talk"];

/**
 * 构建 Tutor 教学上下文
 * @param {object} lessonData - 完整 lesson 对象
 * @param {string} lang - kr | cn | en | jp
 * @returns {object} { lessonTitle, level, version, words, dialogue, grammar, extension }
 */
export function buildTutorContext(lessonData, lang) {
  const base = buildLessonContext(lessonData, { lang });
  const extension = Array.isArray(lessonData?.extension) ? lessonData.extension : [];
  const extensionList = extension.slice(0, 10).map((e) => ({
    phrase: str((e.phrase != null ? e.phrase : e.hanzi) || e.zh || ""),
    pinyin: str((e.pinyin != null ? e.pinyin : e.py) || ""),
    translation: pickLang((e.translation != null ? e.translation : e.explain) || e, lang),
  }));

  return {
    lessonTitle: base.lessonTitle,
    level: base.level || (lessonData && lessonData.level) || "",
    version: base.version || (lessonData && lessonData.version) || "",
    words: base.vocab,
    dialogue: base.dialogue,
    grammar: base.grammar,
    extension: extensionList,
    lessonId: base.lessonId,
    lessonNo: base.lessonNo,
    lang,
  };
}

/**
 * 按 mode 生成 prompt
 * @param {string} mode - explain | roleplay | shadowing | free_talk
 * @param {object} aiItem - lesson.ai 中的单项
 * @param {object} lessonData - 完整 lesson
 * @param {string} lang
 * @param {string} [userInput] - free_talk 时用户输入
 */
export function buildTutorPrompt(mode, aiItem, lessonData, lang, userInput = "") {
  const ctx = buildTutorContext(lessonData, lang);
  const langKey = lang === "zh" || lang === "cn" ? "zh" : lang === "ko" || lang === "kr" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en";

  const vocabStr = ctx.words?.slice(0, 15).map((w) => `${w.hanzi}${w.pinyin ? `(${w.pinyin})` : ""}${w.meaning ? `: ${w.meaning}` : ""}`).join("\n") || "";
  const dialogueStr = ctx.dialogue?.map((d) => `[${d.speaker}] ${d.zh}${d.trans ? ` → ${d.trans}` : ""}`).join("\n") || "";
  const grammarStr = ctx.grammar?.map((g) => `- ${g.title}: ${g.explanation || ""}`).join("\n") || "";
  const extStr = ctx.extension?.map((e) => `- ${e.phrase}${e.pinyin ? ` (${e.pinyin})` : ""}: ${e.translation || ""}`).join("\n") || "";

  const baseContext = [
    `课程: ${ctx.lessonTitle || "本课"}`,
    `水平: ${ctx.level || "HSK1"}`,
    vocabStr ? `词汇:\n${vocabStr}` : "",
    dialogueStr ? `对话:\n${dialogueStr}` : "",
    grammarStr ? `语法:\n${grammarStr}` : "",
    extStr ? `扩展:\n${extStr}` : "",
  ].filter(Boolean).join("\n\n");

  if (mode === "explain") {
    const target = str(aiItem && aiItem.target != null ? aiItem.target : "");
    const hint = pickLang(aiItem?.hint, lang);
    return [
      `请像老师一样讲解以下中文内容。`,
      `目标: ${target}`,
      hint ? `提示: ${hint}` : "",
      `系统语言: ${langKey}`,
      `要求: 简洁、适合学习者，用${langKey === "zh" ? "中文" : langKey === "kr" ? "韩语" : langKey === "jp" ? "日语" : "英语"}解释。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  if (mode === "roleplay") {
    const scenario = str((aiItem && aiItem.scenario != null ? aiItem.scenario : "greeting") || "greeting");
    const promptText = pickLang(aiItem?.prompt, lang);
    return [
      `请进行情景对话练习。`,
      `场景: ${scenario}`,
      promptText ? `任务: ${promptText}` : "",
      `学生水平: ${ctx.level || "HSK1"}`,
      `要求: 只使用本课相关表达，简单自然。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  if (mode === "shadowing") {
    const lines = Array.isArray(aiItem?.lines) ? aiItem.lines : [];
    const linesStr = lines.join("\n");
    return [
      `请引导学生一句一句跟读。`,
      `句子列表:\n${linesStr}`,
      `要求: 一步一步给提示，先听、再跟读、再自己说。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  if (mode === "free_talk") {
    return [
      `学生问题: ${userInput || "(无)"}`,
      `要求: 简短、教学型回答，尽量围绕本课内容，不要偏题太远。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  return baseContext;
}

/**
 * 运行 Tutor（本轮 mock，后续替换为真实 AI API）
 * @param {string} mode
 * @param {object} aiItem
 * @param {object} lessonData
 * @param {string} lang
 * @param {string} [userInput] - free_talk 时用户输入
 */
export async function runTutor(mode, aiItem, lessonData, lang, userInput = "") {
  const prompt = buildTutorPrompt(mode, aiItem, lessonData, lang, userInput);

  if (typeof window !== "undefined" && window.JOY_RUNNER?.askAI) {
    try {
      const res = await window.JOY_RUNNER.askAI({ prompt, context: prompt, lang, mode });
      return { text: (res && res.text != null ? res.text : "") || "", raw: res };
    } catch (e) {
      if (typeof console !== "undefined" && console.error) console.error("[AI Tutor]", e);
      const friendly = t("ai.not_connected_friendly", "AI connection is not ready yet. You can still use the guided practice mode.");
      return { text: friendly + "\n\n" + (getMockTutorOutput(mode, aiItem, lessonData, lang, userInput).text || ""), error: e };
    }
  }

  return getMockTutorOutput(mode, aiItem, lessonData, lang, userInput);
}

/**
 * Mock 输出（像样的教学反馈）
 */
function getMockTutorOutput(mode, aiItem, lessonData, lang, userInput) {
  const ctx = buildTutorContext(lessonData, lang);
  const target = str(aiItem && aiItem.target != null ? aiItem.target : "");
  const scenario = str((aiItem && aiItem.scenario != null ? aiItem.scenario : "greeting") || "greeting");
  const lines = Array.isArray(aiItem?.lines) ? aiItem.lines : [];
  const promptText = pickLang(aiItem?.prompt, lang);

  const langLabels = {
    kr: { grammar: "문법", usage: "사용법", step: "단계", listen: "먼저 들어보세요", repeat: "따라 읽어보세요", say: "직접 말해보세요", ai: "AI", student: "학생" },
    cn: { grammar: "语法", usage: "用法", step: "步骤", listen: "先听", repeat: "跟读", say: "自己说", ai: "AI", student: "学生" },
    en: { grammar: "Grammar", usage: "Usage", step: "Step", listen: "Listen first", repeat: "Repeat after", say: "Say it yourself", ai: "AI", student: "Student" },
    jp: { grammar: "文法", usage: "使い方", step: "ステップ", listen: "まず聞いて", repeat: "ついて読んで", say: "自分で言って", ai: "AI", student: "生徒" },
  };
  const L = langLabels[lang === "zh" || lang === "cn" ? "cn" : lang === "kr" || lang === "ko" ? "kr" : lang === "jp" || lang === "ja" ? "jp" : "en"] || langLabels.en;

  if (mode === "explain") {
    const vocabSample = ctx.words?.slice(0, 3).map((w) => `${w.hanzi}(${w.pinyin})`).join("、") || "";
    const targetLine = target ? `${target}\n\n` : "";
    const meaningLine = target ? t("ai.explain_meaning", { target }) : "";
    return {
      text: [
        targetLine,
        meaningLine,
        t("ai.explain_grammar"),
        "",
        t("ai.explain_example"),
        "我是中国人。",
        "他是老师。",
        "",
        vocabSample ? t("ai.explain_vocab") + " " + vocabSample : "",
        t("ai.explain_tip"),
      ].filter(Boolean).join("\n"),
    };
  }

  if (mode === "roleplay") {
    const dialogueLines = ctx.dialogue?.slice(0, 2).map((d) => d.zh).filter(Boolean) || ["你好！", "你好吗？"];
    return {
      text: [
        `【${L.ai}】你好！`,
        "",
        t("ai.roleplay_student_reply"),
        `- ${dialogueLines[0] || "你好！"}`,
        `- ${dialogueLines[1] || "你好吗？"} 或 我很好。`,
        "",
        promptText || t("ai.roleplay_task"),
      ].join("\n"),
    };
  }

  if (mode === "shadowing") {
    const steps = lines.map((line, i) => {
      const n = i + 1;
      return `${t("ai.shadowing_step", { n })} ${line}\n  → ${L.listen} → ${L.repeat} → ${L.say}`;
    });
    return {
      text: [
        t("ai.shadowing_heading"),
        "",
        steps.length ? steps.join("\n\n") : `${t("ai.shadowing_step", { n: 1 })} ${L.listen}\n${t("ai.shadowing_step", { n: 2 })} ${L.repeat}\n${t("ai.shadowing_step", { n: 3 })} ${L.say}`,
      ].join("\n"),
    };
  }

  if (mode === "free_talk") {
    const q = str(userInput).toLowerCase();
    let answer = "";
    if (q.includes("你好") || q.includes("您好")) {
      answer = t("ai.free_talk_answer_hello", "\"你好\" and \"您好\" are both greetings. \"您好\" is more polite, \"你好\" is more common.");
    } else if (q.includes("吗") || q.includes("疑问") || q.includes("ma")) {
      answer = t("ai.free_talk_answer_ma", "\"吗\" is the question particle. Add it after a statement to form a question. E.g. 你好吗？");
    } else if (q) {
      answer = t("ai.free_talk_answer_generic", "Good question. Please try asking within the words and sentences from this lesson.");
    } else {
      answer = t("ai.free_talk_answer_empty", "Please enter your question. I'll answer based on this lesson's content.");
    }
    return { text: answer };
  }

  return { text: "" };
}

/**
 * 格式化 Tutor 输出为页面可显示结构
 * 技术错误原文不暴露给用户，替换为友好提示
 */
export function formatTutorOutput(mode, result, lang) {
  let text = (result && result.text != null ? result.text : "") || "";
  const techErrorPatterns = ["AI not connected", "cannot find", "api/ai-chat", "aiAsk", "JOY_AI"];
  if (techErrorPatterns.some((p) => text.indexOf(p) >= 0)) {
    text = t("ai.not_connected_friendly", "AI connection is not ready yet. You can still use the guided practice mode.");
  }
  const html = text ? `<div class="ai-tutor-result">${escapeHtml(text).replace(/\n/g, "<br>")}</div>` : "";
  return { text, html };
}

function escapeHtml(s) {
  return String(s != null ? s : "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 获取 lesson.ai 配置（支持 mode 和 type，mode 优先）
 * @param {object} lesson
 * @returns {Array<{ mode: string, ... }>}
 */
const TYPE_TO_MODE = { repeat: "shadowing", substitute: "roleplay", free_talk: "free_talk", explain: "explain", roleplay: "roleplay", shadowing: "shadowing" };

export function getLessonAIConfig(lesson) {
  const arr = (lesson && (lesson.aiPrompts ?? lesson.ai) != null ? (lesson.aiPrompts ?? lesson.ai) : []);
  if (!Array.isArray(arr)) return [];
  const mapped = arr
    .filter((item) => item && (item.mode || item.type))
    .map((item) => {
      const rawMode = item.mode || item.type;
      const mode = TYPE_TO_MODE[rawMode] || rawMode;
      return { ...item, mode };
    });
  const hasExplain = mapped.some((i) => i.mode === "explain");
  if (!hasExplain && mapped.length > 0 && lesson) {
    const first = lesson.dialogue && lesson.dialogue[0] ? lesson.dialogue[0] : null;
    const target = first ? (first.cn || first.zh || first.text || "") : "";
    const hint = first && first.translations ? (first.translations.kr || first.translations.en || first.translations.jp || "") : "";
    mapped.unshift({
      mode: "explain",
      type: "explain",
      target,
      hint: hint ? { kr: hint, en: hint, jp: hint } : undefined,
      title: { cn: "说明", kr: "설명", en: "Explain", jp: "説明" },
    });
  }
  return mapped;
}
