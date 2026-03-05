// ui/platform/capabilities/ai/schemaValidator.js
// 校验 AI 输出 JSON（lesson/practice）结构、字段、越级词比例

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

export const SchemaValidator = {
  validateLessonDoc(doc) {
    const errors = [];
    if (!isObj(doc)) errors.push("lesson must be object");
    if (!doc?.schemaVersion) errors.push("schemaVersion required");
    if (!doc?.id) errors.push("id required");
    if (!doc?.course?.type) errors.push("course.type required");
    if (!doc?.course?.level) errors.push("course.level required");

    const words = doc?.content?.words;
    if (words != null && !Array.isArray(words))
      errors.push("content.words must be array");

    return { ok: errors.length === 0, errors };
  },

  validatePracticeSet(practice) {
    const errors = [];
    if (!Array.isArray(practice)) errors.push("practice must be array");
    return { ok: errors.length === 0, errors };
  },

  validateLevelConstraints({ usedWords, allowedWords, maxOutOfLevelRatio = 0.15 }) {
    const used = Array.isArray(usedWords) ? usedWords : [];
    const allow = new Set(Array.isArray(allowedWords) ? allowedWords : []);
    if (!used.length) return { ok: true, out: [], ratio: 0 };

    const out = used.filter((w) => w && !allow.has(w));
    const ratio = out.length / used.length;
    return { ok: ratio <= maxOutOfLevelRatio, out, ratio };
  },
};
