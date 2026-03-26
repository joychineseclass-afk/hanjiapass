/**
 * Lumina stage / pack configuration.
 * Add packs (kids, travel, business) by extending STAGES with a new id + vocabList.
 */

/** Remove before stage matching (same family as lesson JSON cleanup). */
export const PUNCTUATION_STRIP_RE =
  /[\s\u3000-\u303F\uFF0C-\uFF65\u2000-\u206F\u2E00-\u2E7F，。！？、；：「」『』（）【】《》…—·,.!?;:|/[\]{}()<>"'`~@#$%^&*+=\\]/gu;

/**
 * Per-stage ordered list of known lemmas (multi-char phrases first in authoring helps readability;
 * runtime always sorts by length for longest-match).
 */
export const STAGES = {
  hsk1: {
    id: "hsk1",
    pack: "hsk",
    level: 1,
    vocabList: [
      // greetings & politeness (example set + common extensions)
      "不客气",
      "对不起",
      "没关系",
      "很高兴认识你",
      "请问",
      "谢谢",
      "再见",
      "你好",
      "您好",
      "大家好",
      "早上好",
      "晚上好",
      "请进",
      "请坐",
      "慢走",
      // people & identity
      "中国人",
      "韩国人",
      "美国人",
      "日本人",
      "外国人",
      "学生",
      "老师",
      "同学",
      "朋友",
      "妈妈",
      "爸爸",
      "哥哥",
      "姐姐",
      "弟弟",
      "妹妹",
      "孩子",
      "名字",
      "什么",
      "介绍",
      "认识",
      // common function words / short items (fallback still single-char if not listed)
      "怎么样",
      "为什么",
      "多少",
      "几个",
      "哪儿",
      "哪里",
      "这儿",
      "那儿",
      "学校",
      "医院",
      "商店",
      "饭店",
      "机场",
      "火车站",
      "地铁",
      "公共汽车",
      "出租车",
      "天气",
      "下雨",
      "冷",
      "热",
      "饿",
      "渴",
      "累",
      "忙",
      "高兴",
      "喜欢",
      "吃",
      "喝",
      "买",
      "卖",
      "去",
      "来",
      "回",
      "走",
      "坐",
      "站",
      "看",
      "听",
      "说",
      "读",
      "写",
      "学习",
      "工作",
      "住",
      "打电话",
      "手机",
      "电脑",
      "钱",
      "块",
      "角",
      "分",
      "今天",
      "明天",
      "昨天",
      "现在",
      "以后",
      "以前",
      "星期",
      "点",
      "半",
      "岁",
      "年",
      "月",
      "号",
      "日",
      // single chars often taught early (still stage-governed; longest match prefers longer lemmas above)
      "我",
      "你",
      "他",
      "她",
      "它",
      "们",
      "的",
      "了",
      "吗",
      "呢",
      "吧",
      "很",
      "也",
      "都",
      "就",
      "还",
      "会",
      "能",
      "要",
      "想",
      "叫",
      "是",
      "有",
      "没",
      "不",
      "在",
      "和",
      "跟",
      "从",
      "到",
      "给",
      "对",
      "好",
      "大",
      "小",
      "多",
      "少",
      "哪",
      "谁",
      "几",
      "这",
      "那",
      "个",
      "些",
      "里",
      "上",
      "下",
      "中",
      "国",
      "汉",
      "语",
      "英",
      "文",
      "韩",
      "日",
      "美",
    ],
  },

  /** Placeholder: fill `vocabList` when Kids track ships. */
  kids_l1: {
    id: "kids_l1",
    pack: "kids",
    level: 1,
    vocabList: [],
  },

  /** Placeholder: fill `vocabList` when Travel pack ships. */
  travel_core: {
    id: "travel_core",
    pack: "travel",
    level: 0,
    vocabList: [],
  },

  /** Placeholder: fill `vocabList` when Business pack ships. */
  business_core: {
    id: "business_core",
    pack: "business",
    level: 0,
    vocabList: [],
  },
};

export const DEFAULT_STAGE_ID = "hsk1";

export function listStageIds() {
  return Object.keys(STAGES);
}

export function getStage(stageId) {
  const s = STAGES[stageId];
  if (!s) {
    throw new Error(`Lumina: unknown stage "${stageId}". Known: ${listStageIds().join(", ")}`);
  }
  return s;
}

/** Deduplicated list as authored. */
export function getStageVocabList(stageId = DEFAULT_STAGE_ID) {
  const { vocabList } = getStage(stageId);
  const out = [];
  const seen = new Set();
  for (const w of vocabList) {
    const t = String(w || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Longest strings first for greedy left-to-right matching. */
export function getStageVocabLongestFirst(stageId = DEFAULT_STAGE_ID) {
  return [...getStageVocabList(stageId)].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, "zh-Hans-CN")
  );
}
