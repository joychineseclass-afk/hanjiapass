/**
 * HSK 练习展示策略（语义驱动，不按 UI 语言丢弃题目）
 *
 * choice 展示模式：
 * - zh_options：学习目标是中文选项（字/词/句），选项以中文呈现
 * - meaning_ui：考查中文对应的释义，选项以系统语言呈现
 * - sentence_translation：选项为句义/翻译文本（系统语言），用于阅读类句义匹配
 */

const _trim = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function _optionHasLetterKey(o) {
  return !!(o && typeof o === "object" && _trim(o.key));
}

function _optionsLookLikeLetterKeyedMeanings(opts) {
  if (!Array.isArray(opts) || !opts.length) return false;
  if (!opts.every((x) => x && typeof x === "object")) return false;
  if (!opts.some((o) => _optionHasLetterKey(o))) return false;

  return opts.some((o) => {
    const z = _trim(o.zh ?? o.cn);
    return (
      z &&
      /[\u4e00-\u9fff]/.test(z) &&
      (_trim(o.kr) ||
        _trim(o.ko) ||
        _trim(o.en) ||
        _trim(o.jp) ||
        _trim(o.ja))
    );
  });
}

/**
 * 根据 subtype / 选项形态推断选择题展示模式（判题数据不变，仅影响展示）
 * @param {object} q
 * @returns {"zh_options"|"meaning_ui"|"sentence_translation"}
 */
export function resolveChoiceDisplayKind(q) {
  const st = String(q?.subtype ?? q?.subType ?? "").toLowerCase();
  const listen = !!(q?.audioUrl ?? q?.listen ?? q?.hasListen);

  if (listen) return "zh_options";

  if (st.includes("dialogue_response")) return "zh_options";

  if (st.includes("pinyin_to_vocab")) return "zh_options";

  /** 汉字 → 拼音选项（拉丁字符，放在 cn/zh 字段供展示） */
  if (st.includes("zh_to_pinyin")) return "zh_options";

  if (st.includes("meaning_to_vocab") || st.includes("native_to_zh")) return "zh_options";

  if (st.includes("sentence_blank") || st.includes("sentence_order")) return "zh_options";

  if (st.includes("vocab_meaning_choice") || st.includes("extension_meaning_choice")) {
    return "meaning_ui";
  }

  if (st.includes("zh_to_meaning")) {
    const opts = q?.options;
    if (!Array.isArray(opts) || !opts.length) return "infer";

    const first = opts[0];
    if (typeof first === "string") {
      return /[\u4e00-\u9fff]/.test(first) ? "zh_options" : "meaning_ui";
    }

    if (_optionsLookLikeLetterKeyedMeanings(opts)) return "meaning_ui";

    return "zh_options";
  }

  if (st.includes("grammar") || st.includes("blank") || st.includes("order")) return "zh_options";

  if (
    st.includes("sentence_translation") ||
    st.includes("reading_meaning") ||
    st.includes("comprehension_meaning")
  ) {
    return "meaning_ui";
  }

  if (
    st.includes("dialogue") ||
    st.includes("sentence") ||
    st.includes("translation")
  ) {
    return "sentence_translation";
  }

  return "infer";
}

/**
 * infer：无 subtype 时的兜底（不依赖 UI 语言）
 */
export function resolveChoiceDisplayKindWithInfer(q) {
  let kind = resolveChoiceDisplayKind(q);
  if (kind !== "infer") return kind;

  const opts = q?.options;
  if (
    Array.isArray(opts) &&
    opts.length >= 2 &&
    opts.every((x) => typeof x === "string" && _trim(x))
  ) {
    const allHan = opts.every((x) => /[\u4e00-\u9fff]/.test(x));
    if (allHan) return "zh_options";
  }

  if (_optionsLookLikeLetterKeyedMeanings(opts)) return "meaning_ui";

  if (
    Array.isArray(opts) &&
    opts.length >= 2 &&
    opts.every((x) => typeof x === "string" && _trim(x))
  ) {
    return "zh_options";
  }

  return "sentence_translation";
}

/**
 * 题干：优先系统语言，再按内容回退（不因缺韩语而丢题）
 */
export function stemTextWithFallback(getControlledLangText, q, langKey) {
  if (!q || typeof q !== "object") return "";

  const prompt = q.prompt ?? q.question;
  let direct = "";

  if (prompt && typeof prompt === "object") {
    direct = getControlledLangText(prompt, langKey, "prompt");
  } else if (typeof prompt === "string") {
    direct = prompt.trim();
  }

  if (direct) return direct;

  if (prompt && typeof prompt === "object") {
    return (
      _trim(prompt.kr) ||
      _trim(prompt.ko) ||
      _trim(prompt.cn) ||
      _trim(prompt.zh) ||
      _trim(prompt.en) ||
      _trim(prompt.jp) ||
      _trim(prompt.ja) ||
      ""
    );
  }

  return "";
}
