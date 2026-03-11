/**
 * Kids 场景元数据解析：从 lesson 数据中提取统一的 scene meta，供 prompt 与 asset 使用。
 * 课程驱动，支持 lessonData.scene 与 fallback 映射。
 */

const KIDS1_SCENE_FALLBACK = {
  "1": "classroom_greeting",
  "2": "classroom_intro",
  "3": "classroom_self_intro",
  "4": "classroom_question_answer",
  "5": "classroom_question_answer",
  "6": "classroom_objects",
  "7": "classroom_colors",
  "8": "classroom_animals",
};

const SCENE_KEY_TO_TYPE = {
  greeting: "classroom_greeting",
  name: "classroom_intro",
  age: "classroom_self_intro",
  country: "classroom_question_answer",
  family: "classroom_question_answer",
  object: "classroom_objects",
  objects: "classroom_objects",
  color: "classroom_colors",
  colors: "classroom_colors",
  animal: "classroom_animals",
  animals: "classroom_animals",
};

const SCENE_TITLES = {
  classroom_greeting: { cn: "课堂问候", kr: "수업 인사", en: "Classroom greeting", jp: "授業の挨拶" },
  classroom_intro: { cn: "自我介绍", kr: "자기 소개", en: "Self introduction", jp: "自己紹介" },
  classroom_self_intro: { cn: "介绍年龄", kr: "나이 소개", en: "Telling age", jp: "年齢の紹介" },
  classroom_question_answer: { cn: "课堂问答", kr: "수업 질문과 답", en: "Classroom Q&A", jp: "授業の質疑応答" },
  classroom_objects: { cn: "认识物品", kr: "물건 알아보기", en: "Objects in classroom", jp: "物の認識" },
  classroom_colors: { cn: "认识颜色", kr: "색깔 알아보기", en: "Colors", jp: "色の認識" },
  classroom_animals: { cn: "认识动物", kr: "동물 알아보기", en: "Animals", jp: "動物の認識" },
};

const SCENE_DESCRIPTIONS = {
  classroom_greeting: {
    cn: "老师和学生在教室里互相打招呼。",
    kr: "선생님과 학생이 교실에서 인사해요.",
    en: "Teacher and students greet each other in the classroom.",
    jp: "先生と子どもたちが教室で挨拶しています。",
  },
  classroom_intro: {
    cn: "小朋友在向大家介绍自己的名字。",
    kr: "친구들이 이름을 소개하고 있어요.",
    en: "Children are introducing their names.",
    jp: "子どもたちが名前を紹介しています。",
  },
  classroom_self_intro: {
    cn: "大家在说自己几岁了。",
    kr: "친구들이 나이를 말하고 있어요.",
    en: "Children are saying how old they are.",
    jp: "みんなが何歳か言っています。",
  },
  classroom_question_answer: {
    cn: "老师和学生在进行课堂问答。",
    kr: "선생님과 학생이 질문하고 답해요.",
    en: "Teacher and students are doing Q&A.",
    jp: "先生と子どもたちが質問と答えをしています。",
  },
  classroom_objects: {
    cn: "大家在认识教室里的物品。",
    kr: "친구들이 물건을 배우고 있어요.",
    en: "Children are learning about objects.",
    jp: "みんなが物の名前を覚えています。",
  },
  classroom_colors: {
    cn: "大家在说喜欢的颜色。",
    kr: "친구들이 좋아하는 색을 말해요.",
    en: "Children are talking about favorite colors.",
    jp: "みんなが好きな色を話しています。",
  },
  classroom_animals: {
    cn: "大家在说喜欢的动物。",
    kr: "친구들이 좋아하는 동물을 말해요.",
    en: "Children are talking about favorite animals.",
    jp: "みんなが好きな動物を話しています。",
  },
};

function normLang(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "zh" || l === "cn") return "cn";
  if (l === "ko" || l === "kr") return "kr";
  if (l === "ja" || l === "jp") return "jp";
  return "en";
}

/**
 * 从 lesson 数据中解析出统一的 scene meta。
 * @param {Object} lessonData - 单课数据（含 title, scene, dialogues 等）
 * @param {string} lang - 当前系统语言
 * @param {{ lessonNo?: string, book?: string }} context - 可选，lesson 编号与书名，用于 promptSeed/cacheKey
 * @returns {Object} scene meta
 */
export function resolveKidsSceneMeta(lessonData, lang, context = {}) {
  const L = normLang(lang);
  const lessonNo = context.lessonNo != null ? String(context.lessonNo) : "";
  const book = context.book || "kids1";

  let type = "";
  let characters = ["teacher", "student_girl"];
  let location = "classroom";
  let mood = "warm";
  let dialogueFocus = "greeting";

  const rawScene = lessonData?.scene;
  if (rawScene != null && typeof rawScene === "object") {
    type = rawScene.type || SCENE_KEY_TO_TYPE[rawScene.type] || "";
    characters = Array.isArray(rawScene.characters) ? rawScene.characters : characters;
    location = rawScene.location || location;
    mood = rawScene.mood || mood;
    dialogueFocus = rawScene.dialogueFocus || dialogueFocus;
  }
  if (!type && typeof rawScene === "string") {
    type = SCENE_KEY_TO_TYPE[String(rawScene).toLowerCase()] || "";
  }
  if (!type && lessonNo) {
    type = KIDS1_SCENE_FALLBACK[lessonNo] || "classroom_greeting";
  }
  if (!type) {
    type = "classroom_greeting";
  }

  const titleMap = SCENE_TITLES[type] || SCENE_TITLES.classroom_greeting;
  const descMap = SCENE_DESCRIPTIONS[type] || SCENE_DESCRIPTIONS.classroom_greeting;

  return {
    type,
    title: titleMap[L] || titleMap.cn || "Scene",
    description: descMap[L] || descMap.cn || "",
    characters,
    mood,
    dialogueFocus,
    location,
    promptSeed: {
      lessonId: lessonNo ? `${book}-lesson${lessonNo}` : `${book}-lesson`,
      book,
      lessonNo: lessonNo ? Number(lessonNo) : 0,
    },
  };
}

/**
 * 基于单个 scene（而不是整课）解析 scene meta，供 per-scene 生图使用。
 * @param {Object} scene - lesson.scenes[i] 中的单个场景配置
 * @param {string} lang - 当前系统语言
 * @param {{ lessonNo?: string|number, book?: string }} context
 */
export function resolveKidsSceneMetaForScene(scene, lang, context = {}) {
  const L = normLang(lang);
  const lessonNo = context.lessonNo != null ? String(context.lessonNo) : "";
  const book = context.book || "kids1";

  let type = scene?.type || "";
  if (!type && scene?.id) {
    type = SCENE_KEY_TO_TYPE[String(scene.id).toLowerCase()] || "";
  }
  if (!type && lessonNo) {
    type = KIDS1_SCENE_FALLBACK[lessonNo] || "classroom_greeting";
  }
  if (!type) type = "classroom_greeting";

  const titleMap = SCENE_TITLES[type] || SCENE_TITLES.classroom_greeting;
  const descMap = SCENE_DESCRIPTIONS[type] || SCENE_DESCRIPTIONS.classroom_greeting;

  const rawTitle = scene?.title;
  const rawDesc = scene?.description;

  const title =
    (typeof rawTitle === "string"
      ? rawTitle.trim()
      : rawTitle && (rawTitle[L] || rawTitle.cn || rawTitle.en || rawTitle.kr || rawTitle.jp)) ||
    titleMap[L] ||
    titleMap.cn ||
    "Scene";

  const description =
    (typeof rawDesc === "string"
      ? rawDesc.trim()
      : rawDesc && (rawDesc[L] || rawDesc.cn || rawDesc.en || rawDesc.kr || rawDesc.jp)) ||
    descMap[L] ||
    descMap.cn ||
    "";

  const characters = Array.isArray(scene?.characters) && scene.characters.length ? scene.characters : ["teacher", "student_girl"];

  const sceneId = scene?.id || "scene1";

  return {
    type,
    title,
    description,
    characters,
    mood: scene?.mood || "warm",
    dialogueFocus: scene?.dialogueFocus || "",
    location: scene?.location || "classroom",
    promptSeed: {
      lessonId: lessonNo ? `${book}-lesson${lessonNo}-scene-${sceneId}` : `${book}-scene-${sceneId}`,
      book,
      lessonNo: lessonNo ? Number(lessonNo) : 0,
    },
  };
}
