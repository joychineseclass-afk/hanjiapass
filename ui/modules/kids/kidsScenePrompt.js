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
  classroom_help_thanks:
    "Children's picture book classroom scene, one child helps another child with books or school items, the helped child says thank you, the other replies kindly, warm and polite mood.",
  classroom_apology:
    "Children's picture book classroom scene, a child makes a small mistake like dropping something or bumping a desk, the child says sorry, the other child smiles and says it's okay, gentle and forgiving mood.",
  classroom_question:
    "Children's picture book classroom scene, a child or teacher asking a clear question, another child listening carefully, speech bubble style, simple and friendly composition.",
  classroom_answer:
    "Children's picture book classroom scene, a child confidently answering a question to the teacher or classmates, supportive and encouraging mood, clear expression.",
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
