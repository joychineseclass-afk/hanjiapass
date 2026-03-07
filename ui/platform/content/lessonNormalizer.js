/**
 * 平台级 Lesson 归一化
 * 将旧字段兼容为统一 schema，供 Lesson Engine 使用
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** 多语言对象归一化 */
function normI18n(obj, keys = ["zh", "cn", "kr", "ko", "en"]) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  if (obj.zh) out.zh = str(obj.zh);
  if (obj.cn) out.zh = out.zh || str(obj.cn);
  if (obj.kr) out.kr = str(obj.kr);
  if (obj.ko) out.kr = out.kr || str(obj.ko);
  if (obj.en) out.en = str(obj.en);
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

/** dialogue 归一化：line/zh/cn、lines，兼容 line 字段 */
function normDialogue(raw) {
  const src = Array.isArray(raw?.dialogue) ? raw.dialogue : (Array.isArray(raw?.dialogue?.lines) ? raw.dialogue.lines : []);
  return src.map((line) => {
    const zh = str(line?.zh ?? line?.cn ?? line?.line ?? "");
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

/** grammar 归一化：explanation_zh/kr、example 字符串或对象，兼容旧字段 */
function normGrammar(raw) {
  const src = Array.isArray(raw?.grammar) ? raw.grammar : (Array.isArray(raw?.grammar?.points) ? raw.grammar.points : []);
  return src.map((g) => {
    const title = normTitle(g?.title ?? g?.name ?? g?.pattern ?? "");
    const expl = normI18n({
      zh: g?.explanation_zh ?? g?.explanation?.zh,
      kr: g?.explanation_kr ?? g?.explanation?.kr ?? g?.explanation?.ko,
      en: g?.explanation_en ?? g?.explanation?.en,
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
      example,
    };
  });
}

/** practice 归一化 */
function normPractice(raw) {
  const src = Array.isArray(raw?.practice) ? raw.practice : [];
  return src.map((p) => ({
    type: str(p?.type ?? "choice"),
    question: typeof p?.question === "object" ? normI18n(p.question) : { zh: str(p?.question ?? "") },
    options: Array.isArray(p?.options) ? p.options : [],
    answer: str(p?.answer ?? ""),
    prompt: typeof p?.prompt === "object" ? normI18n(p.prompt) : { zh: str(p?.prompt ?? "") },
  }));
}

/** aiPractice 归一化：ai / ai_interaction */
function normAiPractice(raw) {
  const src = raw?.aiPractice ?? raw?.ai ?? raw?.ai_interaction ?? {};
  if (!src || typeof src !== "object") return {};
  const prompt = typeof src?.prompt === "object" ? normI18n(src.prompt) : { zh: str(src?.prompt ?? src?.chatPrompt ?? src?.chat_prompt ?? "") };
  return {
    prompt,
    speaking: Array.isArray(src?.speaking) ? src.speaking : [],
    chatPrompt: str(src?.chatPrompt ?? src?.chat_prompt ?? ""),
  };
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
  const levelKey = typeof rawLevel === "string" && /^hsk\d+$/i.test(rawLevel)
    ? rawLevel.toLowerCase()
    : (typeof rawLevel === "number" || (typeof rawLevel === "string" && /^\d+$/.test(rawLevel)))
      ? `hsk${String(rawLevel).replace(/\D/g, "") || "1"}`
      : "hsk1";
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
    _raw: raw,
  };
}
