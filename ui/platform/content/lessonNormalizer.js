/**
 * 平台级 Lesson 归一化
 * 将旧字段兼容为统一 schema，供 Lesson Engine 使用
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** 多语言对象归一化：zh/cn, kr/ko, en, jp/ja */
function normI18n(obj, keys = ["zh", "cn", "kr", "ko", "en", "jp", "ja"]) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  if (obj.zh) out.zh = str(obj.zh);
  if (obj.cn) out.zh = out.zh || str(obj.cn);
  if (obj.kr) out.kr = str(obj.kr);
  if (obj.ko) out.kr = out.kr || str(obj.ko);
  if (obj.en) out.en = str(obj.en);
  if (obj.jp) out.jp = str(obj.jp);
  if (obj.ja) out.jp = out.jp || str(obj.ja);
  return out;
}

/** 标题：字符串或对象 → { zh, pinyin, kr, en } */
function normTitle(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    const parts = raw.split(/\s*\/\s*/);
    const zh = parts.find((p) => /[\u4e00-\u9fff]/.test(p)) || parts[parts.length - 1] || raw;
    const other = parts.find((p) => !/[\u4e00-\u9fff]/.test(p));
    return { zh: str(zh), kr: str(other || ""), en: str(other || "") };
  }
  return normI18n(raw);
}

/** vocab 归一化：words → vocab，兼容 meaning.kr/ko、pos.kr/ko */
function normVocab(raw) {
  const src = Array.isArray(raw?.vocab) ? raw.vocab : (Array.isArray(raw?.words) ? raw.words : []);
  return src.map((w) => {
    if (typeof w === "string") return { hanzi: w };
    const m = w?.meaning;
    const meaning = typeof m === "object" ? normI18n(m) : {};
    if (meaning.kr && !meaning.ko) meaning.ko = meaning.kr;
    const pos = typeof w?.pos === "object" ? normI18n(w.pos) : (typeof w?.pos === "string" ? { zh: str(w.pos) } : {});
    if (pos.kr && !pos.ko) pos.ko = pos.kr;
    return {
      hanzi: str(w?.hanzi ?? w?.word ?? w?.zh ?? w?.cn ?? ""),
      pinyin: str(w?.pinyin ?? w?.py ?? ""),
      meaning,
      pos,
    };
  }).filter((v) => v.hanzi);
}

/** 从 raw 提取扁平对话行：支持 dialogueCards、嵌套 dialogue、扁平 dialogue */
function extractDialogueLines(raw) {
  const cards = Array.isArray(raw?.dialogueCards) ? raw.dialogueCards : null;
  if (cards?.length) {
    return cards.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  }

  const d = raw?.dialogue;
  if (!Array.isArray(d) || !d.length) return [];

  const first = d[0];
  if (first?.lines && Array.isArray(first.lines)) {
    return d.flatMap((c) => Array.isArray(c?.lines) ? c.lines : []);
  }

  return d;
}

/** dialogue 归一化：line/zh/cn、lines，兼容 line / text（HSK lesson 定稿常用 text） */
function normDialogue(raw) {
  const src = extractDialogueLines(raw);
  return src.map((line) => {
    const zh = str(line?.zh ?? line?.cn ?? line?.line ?? line?.text ?? "");
    const py = str(line?.pinyin ?? line?.py ?? "");
    const item = {
      speaker: str(line?.speaker ?? line?.spk ?? ""),
      zh,
      line: zh,
      pinyin: py,
      kr: str(line?.kr ?? line?.ko ?? ""),
      ko: str(line?.ko ?? line?.kr ?? ""),
      en: str(line?.en ?? ""),
    };
    return item;
  });
}

/** grammar 归一化：explain/explanation、explanation_zh/kr/jp、example，兼容旧字段 */
function normGrammar(raw) {
  const src = Array.isArray(raw?.grammar) ? raw.grammar : (Array.isArray(raw?.grammar?.points) ? raw.grammar.points : []);
  return src.map((g) => {
    const title = normTitle(g?.title ?? g?.name ?? g?.pattern ?? "");
    const expl = normI18n({
      zh: g?.explanation_zh ?? g?.explanation?.zh ?? g?.explain?.zh ?? g?.explain?.cn,
      kr: g?.explanation_kr ?? g?.explanation?.kr ?? g?.explanation?.ko ?? g?.explain?.kr ?? g?.explain?.ko,
      en: g?.explanation_en ?? g?.explanation?.en ?? g?.explain?.en,
      jp: g?.explanation_jp ?? g?.explanation?.jp ?? g?.explain?.jp ?? g?.explain?.ja ?? g?.explainJp ?? g?.explanationJp,
    });
    const ex = g?.example ?? g?.examples?.[0];
    const example = typeof ex === "string"
      ? { zh: ex, pinyin: "", kr: "", en: "" }
      : (ex && typeof ex === "object" ? normI18n(ex) : {});
    return {
      title: Object.keys(title).length ? title : { zh: "语法点" },
      explanation: expl,
      explanation_zh: expl.zh,
      explanation_kr: expl.kr,
      explanation_en: expl.en,
      explanation_jp: expl.jp,
      example,
    };
  });
}

/** practice 归一化：合并归一字段并保留题目里额外元数据（displayHint、audio、tags 等） */
function normPractice(raw) {
  const src = Array.isArray(raw?.practice) ? raw.practice : [];
  return src.map((p) => {
    if (!p || typeof p !== "object") return p;
    const core = {
      type: str(p?.type ?? "choice"),
      question: typeof p?.question === "object" ? normI18n(p.question) : { zh: str(p?.question ?? "") },
      options: Array.isArray(p?.options) ? p.options : [],
      prompt: typeof p?.prompt === "object" ? normI18n(p.prompt) : { zh: str(p?.prompt ?? "") },
    };
    if (p?.id != null && String(p.id).trim()) core.id = String(p.id).trim();
    if (p?.subtype != null && String(p.subtype).trim()) core.subtype = String(p.subtype).trim();
    if (p?.explanation != null) core.explanation = p.explanation;
    if (typeof p?.score === "number") core.score = p.score;
    if (p?.section != null && String(p.section).trim()) core.section = String(p.section).trim();
    if (p?.answer != null) core.answer = p.answer;
    else core.answer = "";
    return { ...p, ...core };
  });
}

/** aiPractice 归一化：ai / ai_interaction */
function normAiPractice(raw) {
  const src = raw?.aiPractice ?? raw?.ai ?? raw?.ai_interaction ?? {};
  if (!src || typeof src !== "object") return {};
  const prompt = typeof src?.prompt === "object" ? normI18n(src.prompt) : { zh: str(src?.prompt ?? src?.chatPrompt ?? src?.chat_prompt ?? "") };
  const out = {
    prompt,
    speaking: Array.isArray(src?.speaking) ? src.speaking : [],
    chatPrompt: str(src?.chatPrompt ?? src?.chat_prompt ?? ""),
  };
  if (src?.situationDialogue && typeof src.situationDialogue === "object") {
    out.situationDialogue = src.situationDialogue;
  }
  return out;
}

/** objectives 归一化 */
function normObjectives(raw) {
  const src = Array.isArray(raw?.objectives) ? raw.objectives : [];
  return src.map((o) => (typeof o === "string" ? { zh: o } : normI18n(o)));
}

/**
 * 将原始 lesson JSON 归一化为平台统一 schema
 * @param {object} raw - 原始 lesson 数据
 * @param {object} ctx - { courseType, level, lessonNo, file, id }
 */
export function normalizeLesson(raw, ctx = {}) {
  if (!raw || typeof raw !== "object") return null;

  const courseType = str(ctx.courseType ?? raw.courseType ?? raw.version ?? "hsk2.0");
  const rawLevel = ctx.level ?? raw.level ?? "";
  let levelKey = "hsk1";
  if (typeof rawLevel === "string" && rawLevel.trim()) {
    if (/^hsk\d+$/i.test(rawLevel)) levelKey = rawLevel.toLowerCase();
    else if (/^(kids|travel|business|culture)\d+$/i.test(rawLevel)) levelKey = rawLevel.toLowerCase();
    else if (/^\d+$/.test(rawLevel)) levelKey = `hsk${rawLevel}`;
  } else if (typeof rawLevel === "number") {
    levelKey = `hsk${rawLevel}`;
  }
  const lessonNo = Number(ctx.lessonNo ?? raw.lessonNo ?? raw.no ?? raw.lesson ?? 1) || 1;
  const file = str(ctx.file ?? raw.file ?? `lesson${lessonNo}.json`);
  const id = str(raw.id ?? ctx.id ?? `${courseType}_${levelKey}_lesson${lessonNo}`);
  const courseId = str(raw.courseId ?? ctx.courseId ?? `${courseType}_${levelKey}`);
  const type = str(raw.type ?? "lesson");
  const isReview = type === "review";

  return {
    id,
    courseId,
    courseType,
    level: levelKey,
    lessonNo,
    type,
    file,
    title: normTitle(raw.title),
    summary: normI18n(raw.summary),
    objectives: normObjectives(raw),
    vocab: normVocab(raw),
    dialogue: normDialogue(raw),
    grammar: normGrammar(raw),
    practice: normPractice(raw),
    aiPractice: normAiPractice(raw),
    review: raw?.review && typeof raw.review === "object" ? raw.review : {},
    steps: raw?.steps,
    scene: raw?.scene && typeof raw.scene === "object" ? raw.scene : undefined,
    _raw: raw,
  };
}
