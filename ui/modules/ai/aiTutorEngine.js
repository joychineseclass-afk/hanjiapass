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

  const ver =
    (lessonData && lessonData.version != null ? String(lessonData.version) : "") ||
    (base && base.version != null ? String(base.version) : "") ||
    "";

  return {
    courseId: (lessonData && lessonData.courseId != null ? lessonData.courseId : "") || "",
    lessonTitle: base.lessonTitle,
    level: base.level || (lessonData && lessonData.level) || "",
    version: ver,
    words: base.vocab,
    dialogue: base.dialogue,
    grammar: base.grammar,
    extension: extensionList,
    lessonId: base.lessonId,
    lessonNo: base.lessonNo,
    lang,
    lessonSummary: pickLang(lessonData?.summary, lang),
    sceneSummary: lessonData?.scene && typeof lessonData.scene === "object" ? pickLang(lessonData.scene.summary, lang) : "",
    scene: base.scene || null,
  };
}

/**
 * 供 /api/gemini 等后端使用的紧凑课内上下文（控制体积）
 */
export function buildTutorApiContext(lessonData, lang, mode, aiItem) {
  const ctx = buildTutorContext(lessonData, lang);
  const linesHint = Array.isArray(aiItem?.lines) ? aiItem.lines.slice(0, 10) : undefined;
  return {
    source: "lumina_tutor",
    courseId: ctx.courseId || undefined,
    lessonId: ctx.lessonId || undefined,
    lessonNo: ctx.lessonNo || undefined,
    lessonTitle: ctx.lessonTitle || undefined,
    level: ctx.level || undefined,
    version: ctx.version || undefined,
    lang: ctx.lang,
    tutorMode: mode,
    lessonSummary: ctx.lessonSummary || undefined,
    sceneTitle: ctx.scene?.title || undefined,
    sceneSummary: ctx.sceneSummary || ctx.scene?.summary || undefined,
    vocab: (ctx.words || []).slice(0, 12).map((w) => ({
      hanzi: w.hanzi,
      pinyin: w.pinyin || undefined,
      meaning: w.meaning || undefined,
    })),
    dialogue: (ctx.dialogue || []).slice(0, 10).map((d) => ({
      speaker: d.speaker || undefined,
      zh: d.zh,
      pinyin: d.pinyin || undefined,
      trans: d.trans || undefined,
    })),
    grammar: (ctx.grammar || []).slice(0, 5).map((g) => ({
      title: g.title,
      explanation: g.explanation || undefined,
    })),
    tutorTarget: aiItem?.target != null ? String(aiItem.target) : undefined,
    shadowingLines: linesHint,
    constraints: {
      outputLength: "short_to_medium",
      levelCap: "HSK1",
      chineseKeepOriginal: true,
      explanationFollowsUiLang: true,
    },
  };
}

/** 从课文中收集可跟读的中文句子（dialogueCards / dialogue 优先，可辅以 extension） */
function collectLessonChineseLines(lessonData) {
  const out = [];
  const seen = new Set();
  const push = (s) => {
    const t = str(s);
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const cards = Array.isArray(lessonData?.dialogueCards) ? lessonData.dialogueCards : [];
  for (const c of cards) {
    const lines = Array.isArray(c?.lines) ? c.lines : [];
    for (const ln of lines) {
      push((ln.text != null ? ln.text : ln.zh != null ? ln.zh : ln.cn) || "");
    }
  }
  const legacy = Array.isArray(lessonData?.dialogue) ? lessonData.dialogue : [];
  for (const ln of legacy) {
    push((ln.zh != null ? ln.zh : ln.cn != null ? ln.cn : ln.text) || "");
  }

  const ext = Array.isArray(lessonData?.extension) ? lessonData.extension : [];
  for (const g of ext) {
    const sents = Array.isArray(g?.sentences) ? g.sentences : [];
    for (const s of sents) {
      push(s.zh != null ? s.zh : s.cn || "");
    }
  }

  const ap = lessonData?.aiPractice && typeof lessonData.aiPractice === "object" ? lessonData.aiPractice : {};
  const speaking = Array.isArray(ap.speaking) ? ap.speaking : [];
  for (const s of speaking) push(s);

  return out.slice(0, 24);
}

/**
 * 无 aiPrompts/ai 时，将 aiPractice + 课内语料映射为 Tutor 配置项（HSK3.0 HSK1 等）
 * 优先级由 getLessonAIConfig 保证：仅在前两者缺省或为空数组时启用
 */
function mapAiPracticeToTutorItems(lesson) {
  const ap = lesson?.aiPractice && typeof lesson.aiPractice === "object" ? lesson.aiPractice : {};
  const chatPrompt = str(ap.chatPrompt);
  const lines = collectLessonChineseLines(lesson);

  const grammar0 = Array.isArray(lesson?.grammar) && lesson.grammar[0] ? lesson.grammar[0] : null;
  const grammarTarget = grammar0
    ? str(grammar0.pattern != null ? grammar0.pattern : pickLang(grammar0.title, "kr") || pickLang(grammar0.hint, "kr"))
    : "";
  const firstDialogueZh = lines[0] || "";
  const explainTarget = grammarTarget || firstDialogueZh || pickLang(lesson?.title, "kr") || "本课";

  const hintObj = lesson?.summary && typeof lesson.summary === "object" ? lesson.summary : null;
  const promptFromChat = chatPrompt
    ? { zh: chatPrompt, cn: chatPrompt, kr: chatPrompt, en: chatPrompt, jp: chatPrompt }
    : null;

  const titles = {
    explain: { cn: "讲解本课", kr: "본과 설명", en: "Explain", jp: "本課の解説" },
    roleplay: { cn: "情景对话", kr: "상황 대화", en: "Roleplay", jp: "ロールプレイ" },
    shadowing: { cn: "跟读练习", kr: "따라 말하기", en: "Shadowing", jp: "シャドーイング" },
    free_talk: { cn: "自由问答", kr: "자유 질문", en: "Free talk", jp: "自由な質問" },
  };

  return [
    {
      mode: "explain",
      type: "explain",
      target: explainTarget,
      hint: hintObj || undefined,
      title: titles.explain,
      _fromAiPractice: true,
    },
    {
      mode: "roleplay",
      type: "roleplay",
      scenario: "greeting",
      prompt: promptFromChat || hintObj || { cn: "根据本课对话进行角色扮演。", kr: "본과 대화를 바탕으로 역할을 나누어 연습합니다.", en: "Role-play using this lesson’s dialogue.", jp: "本課の会話を使ってロールプレイします。" },
      title: titles.roleplay,
      _fromAiPractice: true,
    },
    {
      mode: "shadowing",
      type: "shadowing",
      lines: lines.length ? lines : [],
      title: titles.shadowing,
      _fromAiPractice: true,
    },
    {
      mode: "free_talk",
      type: "free_talk",
      prompt: promptFromChat || hintObj || { cn: "围绕本课主题提问。", kr: "본과 주제로 질문해 보세요.", en: "Ask about this lesson’s topic.", jp: "本課のテーマについて質問してください。" },
      title: titles.free_talk,
      _fromAiPractice: true,
    },
  ];
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
  const explainLangLabel = langKey === "zh" ? "中文" : langKey === "kr" ? "韩语" : langKey === "jp" ? "日语" : "英语";

  const vocabStr = ctx.words?.slice(0, 15).map((w) => `${w.hanzi}${w.pinyin ? `(${w.pinyin})` : ""}${w.meaning ? `: ${w.meaning}` : ""}`).join("\n") || "";
  const dialogueStr = ctx.dialogue?.map((d) => `[${d.speaker}] ${d.zh}${d.trans ? ` → ${d.trans}` : ""}`).join("\n") || "";
  const grammarStr = ctx.grammar?.map((g) => `- ${g.title}: ${g.explanation || ""}`).join("\n") || "";
  const extStr = ctx.extension?.map((e) => `- ${e.phrase}${e.pinyin ? ` (${e.pinyin})` : ""}: ${e.translation || ""}`).join("\n") || "";

  const metaBlock = [
    `[课元] courseId=${ctx.courseId || "-"} | lessonId=${ctx.lessonId || "-"} | lessonNo=${ctx.lessonNo ?? "-"}`,
    `[标题] ${ctx.lessonTitle || "本课"}`,
    `[界面语言] ${langKey}（说明、讲解使用${explainLangLabel}；中文与拼音保持原样）`,
    ctx.lessonSummary ? `[本课主题] ${ctx.lessonSummary}` : "",
    ctx.sceneSummary ? `[场景摘要] ${ctx.sceneSummary}` : "",
    `[难度] 控制在 ${ctx.level || "HSK1"} 范围，避免明显超纲`,
    `[篇幅] 适中，避免过长`,
  ].filter(Boolean).join("\n");

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
      metaBlock,
      "",
      `请像中文教师一样讲解本课内容（不是泛泛闲聊）。`,
      `讲解目标: ${target}`,
      hint ? `补充提示: ${hint}` : "",
      `系统语言代码: ${langKey}`,
      `要求: 结构清晰、适合初学者；用${explainLangLabel}解释；结合上面对话与语法点。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  if (mode === "roleplay") {
    const scenario = str((aiItem && aiItem.scenario != null ? aiItem.scenario : "greeting") || "greeting");
    const promptText = pickLang(aiItem?.prompt, lang);
    return [
      metaBlock,
      "",
      `请进行情景对话练习（角色扮演）。`,
      `场景 key: ${scenario}`,
      promptText ? `任务说明: ${promptText}` : "",
      `学生水平: ${ctx.level || "HSK1"}`,
      `要求: 只使用本课相关表达；可先给一句示范再让学生接话。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  if (mode === "shadowing") {
    const lines = Array.isArray(aiItem?.lines) ? aiItem.lines : [];
    const linesStr = lines.join("\n");
    return [
      metaBlock,
      "",
      `请引导学生进行跟读（shadowing）练习。`,
      `句子列表:\n${linesStr}`,
      `要求: 逐步提示「先听 → 再跟读 → 再自己说」；内容适合口语跟读，不要改成无关话题。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  if (mode === "free_talk") {
    const guide = pickLang(aiItem?.prompt, lang) || str(aiItem?.chatPrompt);
    return [
      metaBlock,
      "",
      `学生输入: ${userInput || "(尚未输入)"}`,
      guide ? `本课自由对话引导: ${guide}` : "",
      `要求: 简短、教学型回答；尽量只用本课词汇与句型；用${explainLangLabel}回复说明。`,
      "",
      baseContext,
    ].filter(Boolean).join("\n");
  }

  return [metaBlock, "", baseContext].filter(Boolean).join("\n");
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
  const contextObj = buildTutorApiContext(lessonData, lang, mode, aiItem);

  if (typeof window !== "undefined" && window.JOY_RUNNER?.askAI) {
    try {
      const res = await window.JOY_RUNNER.askAI({ prompt, lang, mode, contextObj });
      return { text: (res && res.text != null ? res.text : "") || "", raw: res };
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("[AI Tutor] API unavailable, using mock:", e);
      const mock = getMockTutorOutput(mode, aiItem, lessonData, lang, userInput);
      if (mode === "shadowing") {
        return { text: mock.text || "", error: e, usedMock: true };
      }
      const friendly = t("ai.not_connected_friendly", "AI connection is not ready yet. You can still use the guided practice mode.");
      return { text: [friendly, mock.text].filter(Boolean).join("\n\n"), error: e, usedMock: true };
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
    const lineStrs = lines.map((line) =>
      str(typeof line === "string" ? line : (line && (line.cn || line.zh || line.text)) || ""),
    ).filter(Boolean);
    const body = lineStrs.map((line, i) => `${i + 1}. ${line}`).join("\n");
    return { text: body };
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
  const techErrorPatterns = ["AI not connected", "cannot find", "api/ai-chat", "aiAsk", "JOY_AI", "/api/gemini"];
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

function finalizeTutorItems(mapped, lesson) {
  const hasExplain = mapped.some((i) => i.mode === "explain");
  if (!hasExplain && mapped.length > 0 && lesson) {
    const flat = buildLessonContext(lesson, { lang: "kr" });
    const first = flat.dialogue?.[0];
    const target = first ? str(first.zh) : "";
    const hint = first ? str(first.trans) : "";
    mapped.unshift({
      mode: "explain",
      type: "explain",
      target,
      hint: hint ? { kr: hint, en: hint, jp: hint, zh: hint } : undefined,
      title: { cn: "说明", kr: "설명", en: "Explain", jp: "説明" },
    });
  }
  return mapped;
}

/**
 * 读取 Tutor 配置：aiPrompts > ai > aiPractice（映射）
 */
export function getLessonAIConfig(lesson) {
  const raw = lesson?.aiPrompts ?? lesson?.ai;
  const hasExplicit = Array.isArray(raw) && raw.length > 0;

  if (!hasExplicit && lesson?.aiPractice && typeof lesson.aiPractice === "object") {
    const mapped = mapAiPracticeToTutorItems(lesson)
      .filter((item) => item && item.mode)
      .map((item) => {
        const rawMode = item.mode || item.type;
        const mode = TYPE_TO_MODE[rawMode] || rawMode;
        return { ...item, mode };
      });
    return finalizeTutorItems(mapped, lesson);
  }

  const arr = Array.isArray(raw) ? raw : [];
  const mapped = arr
    .filter((item) => item && (item.mode || item.type))
    .map((item) => {
      const rawMode = item.mode || item.type;
      const mode = TYPE_TO_MODE[rawMode] || rawMode;
      return { ...item, mode };
    });
  return finalizeTutorItems(mapped, lesson);
}
