/**
 * Lumina Dialogue Generator v1
 * 规则驱动的会话生成引擎
 *
 * 核心目标：
 * - 只使用第1课到当前课词汇
 * - 优先使用本课新词
 * - 本课新词覆盖率 ≥95%
 * - 每课 1~3 个会话，每会话最多 4 轮
 * - 会话自然，不堆词、不重复结构
 *
 * @module curriculum/dialogueGenerator
 */

/** @typedef {Object} Turn
 * @property {string} speaker - "A" | "B"
 * @property {string} zh - 中文
 * @property {string} pinyin - 拼音
 * @property {string} [ko] - 韩文
 * @property {string} [en] - 英文
 */

/** @typedef {Object} Dialogue
 * @property {string} title - 会话标题
 * @property {string} goal - 交际任务
 * @property {Turn[]} turns - 轮次
 */

/** @typedef {Object} ExtensionSentence
 * @property {string} zh
 * @property {string} pinyin
 * @property {string} [ko]
 */

/** @typedef {Object} GeneratorInput
 * @property {string} lessonId
 * @property {string} lessonTitle
 * @property {string} communicativeGoal
 * @property {string[]} dialogueTasks - 会话蓝图中的 dialogueTasks（每 task 对应一会话）
 * @property {string[]} currentWords - 本课新词（必须与页面单词卡一致）
 * @property {string[]} previousWords - 之前课已学词
 * @property {string[]} allowedWords - current + previous
 * @property {string[]} forbiddenWords - 未来课词
 * @property {number} [preferredCoverage] - 默认 0.95
 * @property {number} [maxDialogues] - 默认 3
 * @property {number} [maxTurnsPerDialogue] - 默认 4
 */

/** @typedef {Object} GeneratorOutput
 * @property {Dialogue[]} dialogues
 * @property {ExtensionSentence[]} extensionSentences
 * @property {Object} coverage
 * @property {number} coverage.currentWordsTotal
 * @property {number} coverage.currentWordsUsed
 * @property {number} coverage.percent
 * @property {string[]} coverage.unusedWords
 */

// ========== 预定义模板（L3, L4, L5 试运行） ==========
// 严格遵循词汇边界，手写以保证质量

/** L3: 询问国籍与居住地 — dialogueTasks: 询问国籍, 询问住处 — vocab: 中国、人、哪、是、都、呢、北京、住 */
const L3_TEMPLATE = {
  dialogueTasks: ["询问国籍", "询问住处"],
  dialogues: [
    {
      title: "会话1",
      dialogueTask: "询问国籍",
      goal: "询问国籍与居住地",
      turns: [
        { speaker: "A", zh: "你是哪国人？", pinyin: "Nǐ shì nǎ guó rén?", ko: "어느 나라 사람이에요?" },
        { speaker: "B", zh: "我是中国人。", pinyin: "Wǒ shì Zhōngguó rén.", ko: "저는 중국인이에요." },
        { speaker: "A", zh: "你住哪？", pinyin: "Nǐ zhù nǎ?", ko: "어디에 살아요?" },
        { speaker: "B", zh: "我住北京。", pinyin: "Wǒ zhù Běijīng.", ko: "저는 베이징에 살아요." },
      ],
    },
    {
      title: "会话2",
      dialogueTask: "询问住处",
      goal: "询问国籍与居住地",
      turns: [
        { speaker: "A", zh: "你呢？", pinyin: "Nǐ ne?", ko: "당신은요?" },
        { speaker: "B", zh: "我住北京。", pinyin: "Wǒ zhù Běijīng.", ko: "저는 베이징에 살아요." },
        { speaker: "A", zh: "北京、中国都好。", pinyin: "Běijīng, Zhōngguó dōu hǎo.", ko: "베이징, 중국 다 좋아요." },
        { speaker: "B", zh: "是，都好。", pinyin: "Shì, dōu hǎo.", ko: "네, 다 좋아요." },
      ],
    },
  ],
  extensionSentences: [
    { zh: "你是哪国人？我是中国人。", pinyin: "Nǐ shì nǎ guó rén? Wǒ shì Zhōngguó rén.", ko: "어느 나라 사람이에요? 저는 중국인이에요." },
    { zh: "你住哪？我住北京。", pinyin: "Nǐ zhù nǎ? Wǒ zhù Běijīng.", ko: "어디에 살아요? 저는 베이징에 살아요." },
  ],
};

/** L4: 介绍家人 — dialogueTasks: 确认家庭关系, 介绍家庭成员 — vocab: 他、她、的、我、朋友、小（爸爸妈妈在L5，本课用朋友/小朋友） */
const L4_TEMPLATE = {
  dialogueTasks: ["确认家庭关系", "介绍家庭成员"],
  dialogues: [
    {
      title: "会话1",
      dialogueTask: "确认家庭关系",
      goal: "介绍家人",
      turns: [
        { speaker: "A", zh: "他是你朋友吗？", pinyin: "Tā shì nǐ péngyou ma?", ko: "그는 당신 친구예요?" },
        { speaker: "B", zh: "是，他是我的朋友。", pinyin: "Shì, tā shì wǒ de péngyou.", ko: "네, 그는 제 친구예요." },
        { speaker: "A", zh: "她呢？", pinyin: "Tā ne?", ko: "그녀는요?" },
        { speaker: "B", zh: "她是我朋友。", pinyin: "Tā shì wǒ péngyou.", ko: "그녀는 제 친구예요." },
      ],
    },
    {
      title: "会话2",
      dialogueTask: "介绍家庭成员",
      goal: "介绍家人",
      turns: [
        { speaker: "A", zh: "她是谁？", pinyin: "Tā shì shéi?", ko: "그녀는 누구예요?" },
        { speaker: "B", zh: "她是我朋友。他是我的小朋友。", pinyin: "Tā shì wǒ péngyou. Tā shì wǒ de xiǎo péngyou.", ko: "그녀는 제 친구예요. 그는 제 어린 친구예요." },
      ],
    },
  ],
  extensionSentences: [],
};

/** L5: 询问数量 — dialogueTasks: 询问人数, 询问物品数量 */
const L5_TEMPLATE = {
  dialogueTasks: ["询问人数", "询问物品数量"],
  dialogues: [
    {
      title: "会话1",
      dialogueTask: "询问人数",
      goal: "询问数量",
      turns: [
        { speaker: "A", zh: "你家几个人？", pinyin: "Nǐ jiā jǐ gè rén?", ko: "가족이 몇 명이에요?" },
        { speaker: "B", zh: "我家五个人。", pinyin: "Wǒ jiā wǔ gè rén.", ko: "다섯 명이에요." },
      ],
    },
    {
      title: "会话2",
      dialogueTask: "询问物品数量",
      goal: "询问数量",
      turns: [
        { speaker: "A", zh: "你家几个人？", pinyin: "Nǐ jiā jǐ gè rén?", ko: "가족이 몇 명이에요?" },
        { speaker: "B", zh: "五个人：爸爸、妈妈、我。", pinyin: "Wǔ gè rén: Bàba, māma, wǒ.", ko: "다섯 명: 아빠, 엄마, 저." },
      ],
    },
  ],
  extensionSentences: [
    { zh: "少吗？少。零个。", pinyin: "Shǎo ma? Shǎo. Líng gè.", ko: "적어요? 적어요. 영 개예요." },
    { zh: "一个、两个、四个。", pinyin: "Yī gè, liǎng gè, sì gè.", ko: "하나, 둘, 넷." },
    { zh: "六、七、八、九、十。", pinyin: "Liù, qī, bā, jiǔ, shí.", ko: "육, 칠, 팔, 구, 십." },
  ],
};

const TEMPLATES = { 3: L3_TEMPLATE, 4: L4_TEMPLATE, 5: L5_TEMPLATE };

// ========== 工具函数 ==========

/**
 * 从文本中提取出现的汉字（按词匹配，支持多字词优先）
 */
function extractWordsFromText(text, wordList) {
  const found = new Set();
  const sorted = [...wordList].sort((a, b) => b.length - a.length); // 长词优先
  for (const w of sorted) {
    if (text.includes(w)) found.add(w);
  }
  return found;
}

/**
 * 计算覆盖率
 */
function computeCoverage(dialogues, extensionSentences, currentWords) {
  const allText = dialogues
    .flatMap((d) => d.turns.map((t) => t.zh))
    .concat(extensionSentences.map((e) => e.zh))
    .join("");
  const used = extractWordsFromText(allText, currentWords);
  const unused = currentWords.filter((w) => !used.has(w));
  return {
    currentWordsTotal: currentWords.length,
    currentWordsUsed: used.size,
    percent: currentWords.length ? used.size / currentWords.length : 1,
    unusedWords: unused,
  };
}

/**
 * 检测未来词（排除作为 allowed 词子串出现的情况，如 多少 含 多）
 */
function detectFutureWords(dialogues, forbiddenWords, allowedWords = []) {
  const violations = [];
  const allText = dialogues.flatMap((d) => d.turns.map((t) => t.zh)).join("");
  for (const w of forbiddenWords) {
    if (!allText.includes(w)) continue;
    const inAllowed = allowedWords.some((a) => a.includes(w) && allText.includes(a));
    if (!inAllowed) violations.push(w);
  }
  return violations;
}

/**
 * 检测同课结构重复（如 他是X吗？她是Y吗？）
 */
function detectStructuralRepetition(dialogues) {
  const patterns = [];
  for (const d of dialogues) {
    for (const t of d.turns) {
      const m = t.zh.match(/^(.+)(吗？)$/);
      if (m) patterns.push(m[1]);
    }
  }
  const seen = new Set();
  const repeats = [];
  for (const p of patterns) {
    const norm = p.replace(/[你我他她]/g, "X").replace(/[爸爸妈妈儿子女儿老师学生]/g, "N");
    if (seen.has(norm)) repeats.push(p);
    else seen.add(norm);
  }
  return repeats;
}

/**
 * 检测数字堆积
 */
function detectNumberStacking(dialogues) {
  const NUMBERS = "一二三四五六七八九十零";
  const violations = [];
  for (const d of dialogues) {
    for (const t of d.turns) {
      const nums = [...t.zh].filter((c) => NUMBERS.includes(c)).join("");
      if (nums.length >= 4) violations.push({ text: t.zh, nums });
    }
  }
  return violations;
}

/**
 * 检测词汇堆叠（如 爸爸、妈妈、我、儿子、女儿）
 */
function detectVocabStacking(dialogues, currentWords) {
  const violations = [];
  const listPattern = /[、，,]\s*[^、，,]+/g;
  for (const d of dialogues) {
    for (const t of d.turns) {
      const matches = t.zh.match(listPattern);
      if (matches && matches.length >= 3) {
        violations.push({ text: t.zh });
      }
    }
  }
  return violations;
}

// ========== 主入口 ==========

/**
 * 生成会话
 * 流程：1) 读取 dialogueTasks 2) 按 task 选取模板 3) 覆盖率与质量检测
 * @param {GeneratorInput} input
 * @returns {GeneratorOutput & { warnings?: string[], errors?: string[] }}
 */
export function generateDialogues(input) {
  const {
    lessonId,
    dialogueTasks = [],
    currentWords = [],
    previousWords = [],
    allowedWords = [],
    forbiddenWords = [],
    preferredCoverage = 0.95,
    maxDialogues = 3,
    maxTurnsPerDialogue = 4,
  } = input;

  const n = parseInt(lessonId, 10);
  const template = TEMPLATES[n];

  if (!template) {
    return {
      dialogues: [],
      extensionSentences: [],
      coverage: {
        currentWordsTotal: currentWords.length,
        currentWordsUsed: 0,
        percent: 0,
        unusedWords: [...currentWords],
      },
      warnings: [`Lesson ${lessonId}: No template implemented yet.`],
    };
  }

  // dialogueTasks 主导：只输出与 blueprint 中 task 匹配的会话
  const templateTasks = template.dialogueTasks || [];
  const requestedTasks = Array.isArray(dialogueTasks) && dialogueTasks.length ? dialogueTasks : templateTasks;
  let dialogues = (template.dialogues || []).filter((d) => {
    const task = d.dialogueTask || d.title;
    return requestedTasks.length === 0 || requestedTasks.some((t) => task === t || String(task).includes(t));
  });
  if (dialogues.length === 0 && template.dialogues?.length) {
    dialogues = template.dialogues;
  }
  const extensionSentences = template.extensionSentences || [];
  const coverage = computeCoverage(dialogues, extensionSentences, currentWords);

  // 校验
  const errors = [];
  const warnings = [];

  const futureViolations = detectFutureWords(dialogues, forbiddenWords, allowedWords);
  if (futureViolations.length) {
    errors.push(`Future word violations: ${futureViolations.join(", ")}`);
  }

  const repeats = detectStructuralRepetition(dialogues);
  if (repeats.length) {
    warnings.push(`Structural repetition: ${repeats.join("; ")}`);
  }

  const numStack = detectNumberStacking(dialogues);
  if (numStack.length) {
    warnings.push(`Number stacking: ${numStack.map((x) => x.text).join("; ")}`);
  }

  const vocabStack = detectVocabStacking(dialogues, currentWords);
  if (vocabStack.length) {
    warnings.push(`Vocab stacking: ${vocabStack.map((x) => x.text).join("; ")}`);
  }

  if (dialogues.some((d) => d.turns.length > maxTurnsPerDialogue)) {
    warnings.push(`Some dialogue exceeds ${maxTurnsPerDialogue} turns`);
  }

  if (coverage.percent < preferredCoverage && coverage.unusedWords.length) {
    warnings.push(
      `Coverage ${(coverage.percent * 100).toFixed(1)}% < ${preferredCoverage * 100}%. Unused: ${coverage.unusedWords.join(", ")}`
    );
  }

  return {
    dialogues,
    extensionSentences,
    coverage,
    ...(warnings.length && { warnings }),
    ...(errors.length && { errors }),
  };
}

/**
 * 构建生成器输入（从 lesson + vocabDistribution）
 * 若传入 opts.currentWords（来自 getFinalLessonWords），则优先使用，与页面单词 tab 一致。
 * @param {Object} lesson - lesson JSON
 * @param {Object} vocabDistribution - vocab-distribution.json
 * @param {Object} goals - hsk1-communication-goals.json goals
 * @param {Object} [opts] - { currentWords, previousWords, forbiddenWords } 覆盖
 */
export function buildGeneratorInput(lesson, vocabDistribution, goals, opts = {}) {
  const lessonNo = lesson.lessonNo || parseInt(lesson.id?.match(/\d+$/)?.[0], 10) || 1;
  const dist = vocabDistribution?.distribution || {};

  const currentWords =
    opts.currentWords !== undefined
      ? (Array.isArray(opts.currentWords) ? opts.currentWords : [])
      : (lesson.vocab || []).map((v) => v.hanzi).filter(Boolean);

  const previousWords =
    opts.previousWords !== undefined
      ? (Array.isArray(opts.previousWords) ? opts.previousWords : [])
      : (() => {
          const out = [];
          for (let i = 1; i < lessonNo; i++) {
            const key = `lesson${i}`;
            if (dist[key]) out.push(...dist[key]);
          }
          return out;
        })();

  const forbiddenWords =
    opts.forbiddenWords !== undefined
      ? (Array.isArray(opts.forbiddenWords) ? opts.forbiddenWords : [])
      : (() => {
          const out = [];
          for (let i = lessonNo + 1; i <= 22; i++) {
            const key = `lesson${i}`;
            if (dist[key]) out.push(...dist[key]);
          }
          return out;
        })();

  const allowedWords = [...new Set([...currentWords, ...previousWords])];

  const title = typeof lesson.title === "object" ? lesson.title.zh || lesson.title.en : String(lesson.title || "");
  const goal = (goals && goals[String(lessonNo)]) || vocabDistribution?.lessonThemes?.[String(lessonNo)] || "";
  const dialogueTasks = (opts.dialogueBlueprint && opts.dialogueBlueprint[String(lessonNo)]?.dialogueTasks) || [];

  return {
    lessonId: String(lessonNo),
    lessonTitle: title,
    communicativeGoal: goal,
    dialogueTasks,
    currentWords,
    previousWords,
    allowedWords,
    forbiddenWords,
    preferredCoverage: 0.95,
    maxDialogues: 3,
    maxTurnsPerDialogue: 4,
    langSupport: ["zh", "pinyin", "ko"],
  };
}
