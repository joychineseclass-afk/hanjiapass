/**
 * AI Tutor v1 Engine
 * 统一 explain / roleplay / shadowing / free_talk 四种模式
 * 为后续 HSK2 / Kids / Business 复用
 */

import { buildLessonContext } from "../../platform/capabilities/ai/aiLessonContext.js";
import { i18n } from "../../i18n.js";
import { classifyFreeQuestionIntent, LUMINA_LESSON_QA_PROMPT_REV } from "./freeQuestionIntent.js";
import { sanitizeLessonQAOutput } from "./lessonQaSanitize.js";

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
 * @param {{ userInput?: string }} [options]
 */
export function buildTutorApiContext(lessonData, lang, mode, aiItem, options = {}) {
  const ctx = buildTutorContext(lessonData, lang);
  const linesHint = Array.isArray(aiItem?.lines) ? aiItem.lines.slice(0, 10) : undefined;
  const userInput = str(options.userInput || "");

  const vocabSlice = mode === "free_talk" ? 24 : 12;
  const dialogueSlice = mode === "free_talk" ? 18 : 10;

  const base = {
    source: "lumina_tutor",
    courseId: ctx.courseId || undefined,
    lessonId: ctx.lessonId || undefined,
    lessonNo: ctx.lessonNo || undefined,
    lessonTitle: ctx.lessonTitle || undefined,
    level: ctx.level || undefined,
    version: ctx.version || undefined,
    lang: ctx.lang,
    tutorMode: mode === "free_talk" ? "lesson_qa" : mode,
    lessonSummary: ctx.lessonSummary || undefined,
    ...(mode === "free_talk"
      ? {}
      : {
          sceneTitle: ctx.scene?.title || undefined,
          sceneSummary: ctx.sceneSummary || ctx.scene?.summary || undefined,
        }),
    vocab: (ctx.words || []).slice(0, vocabSlice).map((w) => ({
      hanzi: w.hanzi,
      pinyin: w.pinyin || undefined,
      meaning: w.meaning || undefined,
    })),
    dialogue: (ctx.dialogue || []).slice(0, dialogueSlice).map((d) => ({
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
      levelCap: ctx.level || "HSK1",
      chineseKeepOriginal: true,
      explanationFollowsUiLang: true,
    },
    ...(mode === "explain"
      ? {
          explainLecture: {
            outlineVersion: 1,
            focalTarget: aiItem?.target != null ? String(aiItem.target) : undefined,
            sections: [
              "lesson_theme",
              "core_expressions",
              "usage_context",
              "dialogue_examples",
              "mini_check",
            ],
          },
        }
      : {}),
  };

  if (mode === "free_talk") {
    const objectives = Array.isArray(lessonData?.objectives)
      ? lessonData.objectives.slice(0, 8).map((o) => pickLang(o, lang)).filter(Boolean)
      : [];
    const ext = (ctx.extension || []).slice(0, 12).map((e) => ({
      phrase: e.phrase,
      pinyin: e.pinyin || undefined,
      translation: e.translation || undefined,
    }));
    /** 意图仅用于本地 prompt 文案；不放入 context JSON，避免模型照抄 difference/usage 等 */
    base.lessonQA = {
      version: 1,
      studentQuestion: userInput.slice(0, 800),
      objectives: objectives.length ? objectives : undefined,
      keyExpressions: ext.length ? ext : undefined,
    };
  }

  return base;
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
    const focalTarget = str(aiItem && aiItem.target != null ? aiItem.target : "");
    const focalHint = pickLang(aiItem?.hint, lang);
    const sceneTitle = ctx.scene?.title ? str(ctx.scene.title) : "";
    const objectivesLines = Array.isArray(lessonData?.objectives)
      ? lessonData.objectives
        .slice(0, 5)
        .map((o) => pickLang(o, lang))
        .filter(Boolean)
      : [];

    return [
      metaBlock,
      "",
      "【角色与体裁】你是面对初学者的中文老师，本任务为「整课串讲」，不是百科词条解释，也不是自由聊天。",
      `【输出语言】除直接引用的中文/拼音外，说明文字请使用${explainLangLabel}。`,
      "【中文与拼音】教材中的汉字、句子、拼音须保持原样，不要改写或自造拼音。",
      focalTarget
        ? `【重点焦点】请在讲解中单独用一小段突出：「${focalTarget}」${focalHint ? `（参考：${focalHint}）` : ""}；但全文必须同时覆盖整课主题、词汇与对话，不能只讲这一点。`
        : "【重点】无单独 focal 时，请仍按下面结构讲满一整课。",
      "",
      "【必须采用的输出结构】按以下五段依次撰写，每段简短，整体篇幅适合网页阅读（勿过长）：",
      "1）本课主题：用一两句话说明这课学什么、为何学。",
      "2）核心表达：列出本课最重要的 2～4 个词语或句型（可带拼音），各用一句话说明作用。",
      "3）使用场景：说明这些表达在什么情境下使用（可联系下方场景摘要）。",
      "4）对话示例讲解：从「本课对话原文」中选取 1～2 句，简要说明含义或用法（必须引用原文中的句子，勿编造课内没有的对话）。",
      "5）小练习或提问：最后给一道极简短的理解检查（如小问句、填空或二选一），只用本课已出现的内容。",
      "",
      "【课名与概要】",
      `课名：${ctx.lessonTitle || "本课"}`,
      ctx.lessonSummary ? `概要：${ctx.lessonSummary}` : "",
      sceneTitle ? `场景标题：${sceneTitle}` : "",
      ctx.sceneSummary ? `场景说明：${ctx.sceneSummary}` : "",
      objectivesLines.length ? `学习目标要点：\n${objectivesLines.map((o) => `- ${o}`).join("\n")}` : "",
      "",
      "【本课词汇】",
      vocabStr || "（若列表为空，请依据下方对话与语法归纳本课词语。）",
      "",
      "【本课语法】",
      grammarStr || "（若无单独语法块，可结合对话略讲。）",
      "",
      "【本课对话原文】（讲解第 4 段必须从中引用）",
      dialogueStr || "（若无对话行，可改用「扩展参考」中的句子做示例。）",
      extStr ? `【扩展参考】\n${extStr}` : "",
    ].filter(Boolean).join("\n\n");
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
    const q = str(userInput);
    const guide = pickLang(aiItem?.prompt, lang) || str(aiItem?.chatPrompt);
    const intent = classifyFreeQuestionIntent(q);
    /** 不用「任务类型/问题类型」等易被模型照抄的中文标记；意图仅作写作提示 */
    const intentHint =
      intent === "difference"
        ? "[Instruction] Compare two expressions: state the main difference in politeness or addressee first, then one short contrast example in quotes if needed. Never output two dictionary entries."
        : intent === "usage"
          ? "[Instruction] Focus on who/when/politeness and link to this lesson. Do not open with a glossary-style definition."
          : intent === "sentence_explain"
            ? "[Instruction] Paraphrase meaning first, then usage; simpler rewrite in quotes if asked. No field labels."
            : "[Instruction] Answer directly, then one sentence of context or collocation.";
    /** 本段进入 /api/gemini 的 prompt（与 JSON 上下文配合；避免重复粘贴整课对话以控制长度） */
    return [
      "[Scope] In-lesson Q&A only. [Critical] Your reply must NEVER include: 中文：, 拼音：, 한국어해석, 任务类型, lesson_qa, difference, usage, sentence_explain, meaning, or any colon-label lines. Output only teacher prose.",
      "【你的角色】本课任课老师，对初学者口语讲解；禁止词典卡片、禁止字段名加冒号的分行。",
      `【解释语言】除直接引用的中文词语/原句外，说明文字一律使用${explainLangLabel}。`,
      "【中文呈现】本课词语与对话句保留汉字原文；拼音如需则写在自然句中，禁止单独一行「拼音：」。",
      intentHint,
      "【回答结构】",
      "（1）第一句就答在问题上；",
      "（2）再补一两句：原因、对象差异或典型场景；",
      "（3）全篇最多 1 个例句，用引号嵌入叙述；优先本课对话或本课词。",
      "【篇幅】通常 2～4 个小句，不要长段、不要讲义体。",
      "【范围】以 JSON 里本课标题、目标、重点表达、词汇、对话、语法为主；超纲时先给本课内最接近的答案，再一句轻提示，勿拒答。",
      guide ? `【课程备忘】${guide}` : "",
      "",
      metaBlock,
      "",
      `【学习者提问】\n${q || "（尚未输入）"}`,
    ].filter(Boolean).join("\n");
  }

  return [metaBlock, "", baseContext].filter(Boolean).join("\n");
}

/**
 * 运行 Tutor：优先 JOY_RUNNER.askAI → POST /api/gemini；失败时按模式回退（free_talk 用温和网络提示）
 * @param {string} mode
 * @param {object} aiItem
 * @param {object} lessonData
 * @param {string} lang
 * @param {string} [userInput] - free_talk 时用户输入
 */
export async function runTutor(mode, aiItem, lessonData, lang, userInput = "") {
  const prompt = buildTutorPrompt(mode, aiItem, lessonData, lang, userInput);
  const contextObj = buildTutorApiContext(lessonData, lang, mode, aiItem, { userInput });

  if (typeof window !== "undefined" && window.JOY_RUNNER?.askAI) {
    try {
      if (mode === "free_talk") {
        window.__HANJIAPASS_LUMINA_LESSON_QA_REV__ = LUMINA_LESSON_QA_PROMPT_REV;
        if (typeof console !== "undefined" && console.info) {
          console.info(
            `[HANJIAPASS] LUMINA lessonQA ${LUMINA_LESSON_QA_PROMPT_REV}（出现本行=新前端 bundle；可在控制台执行 window.__HANJIAPASS_LUMINA_LESSON_QA_REV__）`,
            {
              lessonId: lessonData?.id,
              courseId: lessonData?.courseId,
              promptLength: (prompt || "").length,
              hasLessonQA: !!(contextObj && contextObj.lessonQA),
              questionIntent: classifyFreeQuestionIntent(userInput),
            },
          );
        }
      }
      const res = await window.JOY_RUNNER.askAI({ prompt, lang, mode, contextObj });
      const api = res && res.raw && typeof res.raw === "object" ? res.raw : {};
      if (mode === "free_talk" && typeof console !== "undefined" && console.info) {
        console.info("[HANJIAPASS] runTutor free_talk → 页面最终使用 res.text（经 formatTutorOutput 再 sanitize 一次）", {
          displaySource: "JOY_RUNNER.askAI → normalizeAIResult.text",
          textLength: String(res && res.text != null ? res.text : "").length,
          textPreview: String(res && res.text != null ? res.text : "").slice(0, 160),
          fallback: api.fallback,
          luminaResponseSource: api.luminaResponseSource,
          modelUsed: api.modelUsed,
          rawGeminiTextLength: api.rawGeminiTextLength,
          sanitizedEmpty: api.sanitizedEmpty,
          lastError: api.lastError,
          hasGeminiKey: api.hasGeminiKey,
          keyCount: api.keyCount,
        });
      }
      return { text: (res && res.text != null ? res.text : "") || "", raw: res };
    } catch (e) {
      if (mode === "free_talk" && typeof console !== "undefined" && console.error) {
        console.error("[LUMINA runTutor] askAI rejected", { mode, message: e?.message || String(e) });
      }
      if (typeof console !== "undefined" && console.warn) console.warn("[AI Tutor] API unavailable, using mock:", e);
      const mock = getMockTutorOutput(mode, aiItem, lessonData, lang, userInput);
      if (mode === "shadowing") {
        return { text: mock.text || "", error: e, usedMock: true };
      }
      if (mode === "free_talk") {
        return {
          text: t(
            "ai.lesson_qa_fallback_network",
            "We couldn’t reach the tutor right now. Please try again in a moment.",
          ),
          error: e,
          usedMock: true,
        };
      }
      const friendly = t("ai.not_connected_friendly", "AI connection is not ready yet. You can still use the guided practice mode.");
      return { text: [friendly, mock.text].filter(Boolean).join("\n\n"), error: e, usedMock: true };
    }
  }

  return getMockTutorOutput(mode, aiItem, lessonData, lang, userInput);
}

function explainHeadingLabels(lang) {
  const l = (lang || "kr").toLowerCase();
  if (l === "zh" || l === "cn") {
    return { h1: "1. 本课主题", h2: "2. 核心表达", h3: "3. 使用场景", h4: "4. 对话示例讲解", h5: "5. 小练习" };
  }
  if (l === "ko" || l === "kr") {
    return { h1: "1. 본과 주제", h2: "2. 핵심 표현", h3: "3. 사용 상황", h4: "4. 대화 예시 설명", h5: "5. 확인 질문" };
  }
  if (l === "jp" || l === "ja") {
    return { h1: "1. 本課のテーマ", h2: "2. 重要な表現", h3: "3. 使う場面", h4: "4. 会話例の解説", h5: "5. 小さな確認" };
  }
  return {
    h1: "1. Lesson theme",
    h2: "2. Key expressions",
    h3: "3. Usage contexts",
    h4: "4. Dialogue walk-through",
    h5: "5. Quick check",
  };
}

/** explain 离线 mock：五段式本课串讲（与 prompt 结构对齐，便于无 API 时预览） */
function buildExplainMockLessonText(ctx, lang, focalTarget, lessonData) {
  const H = explainHeadingLabels(lang);
  const themePara = ctx.lessonSummary || pickLang(lessonData?.title, lang) || ctx.lessonTitle || "—";
  const coreItems = (ctx.words && ctx.words.length)
    ? ctx.words.slice(0, 4).map((w) => `· ${w.hanzi}${w.pinyin ? `（${w.pinyin}）` : ""}${w.meaning ? ` — ${w.meaning}` : ""}`)
    : [];
  const coreBlock = coreItems.length
    ? coreItems
    : ["· （请结合下方对话中的问候语与礼貌用语。）"];
  const sceneUse = [ctx.scene?.title, ctx.sceneSummary].filter(Boolean).join(" — ") || themePara;
  const dLines = ctx.dialogue?.slice(0, 2) || [];
  const dialoguePart = dLines.length
    ? dLines.map((d) => {
      const zh = d.zh || "";
      const py = d.pinyin ? `（${d.pinyin}）` : "";
      const tr = d.trans ? `\n  → ${d.trans}` : "";
      return `${d.speaker ? `${d.speaker}：` : ""}${zh}${py}${tr}`;
    }).join("\n\n")
    : "（教材对话行）";
  const focalNote = focalTarget
    ? (lang === "kr" || lang === "ko"
      ? `【강조】${focalTarget} — 본과 대화 속에서 쓰임을 함께 짚어 보세요.`
      : lang === "jp" || lang === "ja"
        ? `【重点】${focalTarget} — 会話の中での使い分けに注目してください。`
        : `【重点】${focalTarget} — 请结合对话体会用法。`)
    : "";

  const mini =
    lang === "kr" || lang === "ko"
      ? "「谢谢」를 들었을 때 더 자연스러운 응답은?\nA) 对不起  B) 不客气  C) 没关系"
      : lang === "jp" || lang === "ja"
        ? "「谢谢」に対してよく使う返答は？\nA) 对不起  B) 不客气  C) 没关系"
        : "听到「谢谢」时，更常见的应答是？\nA) 对不起  B) 不客气  C) 没关系";

  return [
    `${H.h1}`,
    themePara,
    "",
    `${H.h2}`,
    ...coreBlock,
    focalNote,
    "",
    `${H.h3}`,
    sceneUse,
    "",
    `${H.h4}`,
    dialoguePart,
    "",
    `${H.h5}`,
    mini,
  ].filter(Boolean).join("\n");
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
    return { text: buildExplainMockLessonText(ctx, lang, target, lessonData) };
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
  const rawBeforeSanitize = mode === "free_talk" ? text : "";
  if (mode === "free_talk" && text) {
    const cleaned = sanitizeLessonQAOutput(text);
    text = cleaned.trim()
      ? cleaned
      : t(
          "ai.lesson_qa_answer_filtered",
          "We adjusted the wording for readability. If something is missing, please ask again in a moment.",
        );
  }
  const html = text ? `<div class="ai-tutor-result">${escapeHtml(text).replace(/\n/g, "<br>")}</div>` : "";
  const out = { text, html };
  if (mode === "free_talk" && rawBeforeSanitize && typeof window !== "undefined" && window.__HANJIAPASS_DEBUG_LQA__) {
    out._debugLessonQARaw = rawBeforeSanitize;
  }
  return out;
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
