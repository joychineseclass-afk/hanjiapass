/**
 * Lumina Practice Engine - HSK1~4 标准题干模板
 * 供批量课程复用，避免「哪个是谢谢」等不自然表达
 *
 * 使用规则：
 * - 听音题：题干用 LISTENING 模板
 * - 母语→中文映射：题干用 NATIVE_TO_ZH 模板（如 '감사합니다'에 해당하는 중국어는?）
 * - 中文→意思：题干用 ZH_TO_MEANING 模板
 * - 填空选择：题干用 SENTENCE_BLANK 模板（句中___选词）
 */

export const PROMPT_TEMPLATES = {
  /** 听音选择正确单词 */
  LISTENING: {
    cn: "请听音，选择正确的词语。",
    kr: "오디오를 듣고 맞는 단어를 고르세요.",
    en: "Listen and choose the correct word.",
    jp: "発音を聞いて、正しい語を選んでください。",
  },

  /** 母语→中文：'{native}'에 해당하는 중국어는? */
  NATIVE_TO_ZH: {
    cn: "「{native}」对应的中文是？",
    kr: "'{native}'에 해당하는 중국어는?",
    en: "What is the Chinese for \"{native}\"?",
    jp: "「{native}」に対応する中国語は？",
  },

  /** 中文→意思：「谢谢」的意思是？ */
  ZH_TO_MEANING: {
    cn: "「{zh}」的意思是？",
    kr: "「{zh}」의 뜻은?",
    en: "What does \"{zh}\" mean?",
    jp: "「{zh}」の意味は？",
  },

  /** 意思→中文：「감사합니다」用中文怎么说？ */
  MEANING_TO_ZH: {
    cn: "「{meaning}」用中文怎么说？",
    kr: "「{meaning}」은 중국어로 무엇입니까?",
    en: "What is the Chinese word for \"{meaning}\"?",
    jp: "「{meaning}」は中国語で何と言いますか？",
  },

  /** 拼音→中文：'{pinyin}'의 한자는? */
  PINYIN_TO_ZH: {
    cn: "根据拼音「{pinyin}」选择正确的词语。",
    kr: "'{pinyin}'의 한자는?",
    en: "Choose the correct word for pinyin \"{pinyin}\".",
    jp: "ピンイン「{pinyin}」に対応する語を選んでください。",
  },

  /** 句中填空选择：他___中国人。（选词填空） */
  SENTENCE_BLANK: {
    cn: "{sentence}",
    kr: "{sentence}",
    en: "{sentence}",
    jp: "{sentence}",
  },

  /** 语序选择：下面哪一句顺序正确？ */
  SENTENCE_ORDER: {
    cn: "下面哪一句顺序正确？",
    kr: "올바른 순서의 문장은?",
    en: "Which sentence has the correct word order?",
    jp: "正しい語順の文はどれですか？",
  },

  /** 对话回应：「你好吗？」的回答是什么？ */
  DIALOGUE_RESPONSE: {
    cn: "「{line}」的回答是什么？",
    kr: "「{line}」에 대한 답은?",
    en: "What is the response to \"{line}\"?",
    jp: "「{line}」への返答は？",
  },

  /** 语法填空：句中___选词（与 SENTENCE_BLANK 共用，语法点可加说明） */
  GRAMMAR_FILL: {
    cn: "{sentence}",
    kr: "{sentence}",
    en: "{sentence}",
    jp: "{sentence}",
  },

  /** 扩展表达词义：「您好」的意思是？ */
  EXTENSION_MEANING: {
    cn: "「{zh}」的意思是？",
    kr: "「{zh}」의 뜻은?",
    en: "What does \"{zh}\" mean?",
    jp: "「{zh}」の意味は？",
  },

  /** 配对题（少量）：请将中文与对应翻译配对 */
  MATCH: {
    cn: "请将中文与对应翻译配对。",
    kr: "중국어와 해당 번역을 연결하세요.",
    en: "Match Chinese with the correct translation.",
    jp: "中国語と対応する翻訳を組み合わせてください。",
  },

  /** 排序题（少量）：请将下列词语按正确语序排列 */
  ORDER: {
    cn: "请将下列词语按正确语序排列。",
    kr: "다음 단어를 올바른 순서로 배열하세요.",
    en: "Arrange the following words in correct order.",
    jp: "次の語を正しい順序に並べてください。",
  },

  /** 填空题（少量）：句中填空，输入答案 */
  FILL: {
    cn: "{sentence}",
    kr: "{sentence}",
    en: "{sentence}",
    jp: "{sentence}",
  },
};

/**
 * 根据模板名和参数生成题干
 * @param {string} templateKey - PROMPT_TEMPLATES 的 key
 * @param {object} params - 如 { zh, meaning, native, pinyin, sentence, line }
 * @returns {{ cn, kr, en, jp }}
 */
export function buildPrompt(templateKey, params = {}) {
  const tpl = PROMPT_TEMPLATES[templateKey];
  if (!tpl || typeof tpl !== "object") return { cn: "", kr: "", en: "", jp: "" };

  const interpolate = (str) => {
    if (typeof str !== "string") return "";
    return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
  };

  return {
    cn: interpolate(tpl.cn ?? ""),
    kr: interpolate(tpl.kr ?? ""),
    en: interpolate(tpl.en ?? ""),
    jp: interpolate(tpl.jp ?? ""),
  };
}

/**
 * 检测题目 subtype，返回应使用的模板 key
 * @param {object} q - 题目对象
 * @returns {string|null}
 */
export function detectPromptTemplate(q) {
  const subtype = (q.subtype ?? q.subType ?? "").toLowerCase();
  const hasListen = !!(q.audioUrl ?? q.listen ?? q.hasListen);

  if (hasListen) return "LISTENING";
  if (subtype.includes("meaning_to_vocab") || subtype.includes("native_to_zh")) return "NATIVE_TO_ZH";
  if (subtype.includes("vocab_meaning") || subtype.includes("zh_to_meaning")) return "ZH_TO_MEANING";
  if (subtype.includes("pinyin_to_vocab")) return "PINYIN_TO_ZH";
  if (subtype.includes("sentence_order")) return "SENTENCE_ORDER";
  if (subtype.includes("dialogue_response")) return "DIALOGUE_RESPONSE";
  if (subtype.includes("extension")) return "EXTENSION_MEANING";
  if (subtype.includes("grammar_fill") || subtype.includes("sentence_completion")) return "GRAMMAR_FILL";
  return null;
}
