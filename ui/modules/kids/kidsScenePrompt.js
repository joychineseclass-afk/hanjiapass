/**
 * Kids 场景 prompt 构建：根据 scene meta 生成标准化生图 prompt，风格统一为儿童绘本。
 */

const STYLE_BASE =
  "Children's picture book style, soft pastel colors, clean educational illustration, friendly characters, simple composition.";

const SCENE_TYPE_PROMPTS = {
  classroom_greeting:
    "Warm classroom scene, a friendly teacher and a little girl greeting each other, soft light, welcoming mood.",
  classroom_intro:
    "Classroom scene, children introducing themselves with name tags, teacher smiling, bright and friendly.",
  classroom_self_intro:
    "Classroom scene, children showing numbers with fingers or cards, teacher encouraging, playful mood.",
  classroom_question_answer:
    "Classroom Q&A scene, teacher asking and children answering, hand raised, engaged and warm.",
  classroom_objects:
    "Classroom scene with simple objects like fruit or school supplies, children pointing and learning, clear and simple.",
  classroom_colors:
    "Classroom scene with colorful items or drawings, children naming colors, bright pastel palette.",
  classroom_animals:
    "Classroom scene with cute animal pictures or toys, children smiling, soft and friendly animals.",
};

/**
 * 根据 scene meta 生成标准化 prompt。
 * @param {Object} sceneMeta - resolveKidsSceneMeta() 的返回值
 * @param {{ includeStyle?: boolean }} options - 可选
 * @returns {{ prompt: string, shortPrompt: string, stylePreset: string }}
 */
export function buildKidsScenePrompt(sceneMeta, options = {}) {
  const includeStyle = options.includeStyle !== false;
  const type = sceneMeta?.type || "classroom_greeting";
  const part = SCENE_TYPE_PROMPTS[type] || SCENE_TYPE_PROMPTS.classroom_greeting;
  const prompt = includeStyle ? `${STYLE_BASE} ${part}` : part;
  const shortPrompt = `Kids ${type.replace(/_/g, " ")} scene`;
  return {
    prompt,
    shortPrompt,
    stylePreset: "lumina-kids-picturebook-v1",
  };
}
