/**
 * Scene Engine v1 - 工具函数
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** 按 lang 取多语言文本 */
export function getLocalizedSceneText(obj, lang) {
  if (!obj || typeof obj !== "object") return "";
  const l = String(lang || "ko").toLowerCase();
  if (l === "zh" || l === "cn") return str(obj.zh ?? obj.cn) || str(obj.kr ?? obj.ko) || str(obj.en);
  if (l === "ko" || l === "kr") return str(obj.kr ?? obj.ko) || str(obj.en) || str(obj.zh ?? obj.cn);
  return str(obj.en) || str(obj.kr ?? obj.ko) || str(obj.zh ?? obj.cn);
}

/** 按 id 查找角色 */
export function mapCharacterById(scene, id) {
  const chars = Array.isArray(scene?.characters) ? scene.characters : [];
  return chars.find((c) => str(c?.id) === str(id)) ?? null;
}

/** 根据 frame.dialogueRef 解析对应 dialogue 行 */
export function resolveFrameDialogue(frame, lesson) {
  const dialogue = Array.isArray(lesson?.dialogue) ? lesson.dialogue : [];
  const ref = frame?.dialogueRef;
  if (ref == null) return null;
  const idx = Number(ref);
  if (Number.isNaN(idx) || idx < 0 || idx >= dialogue.length) return null;
  return dialogue[idx] ?? null;
}

/** 获取 frame 的 focusWords */
export function getSceneFocusWords(frame) {
  const words = Array.isArray(frame?.focusWords) ? frame.focusWords : [];
  return words.filter((w) => str(w));
}
