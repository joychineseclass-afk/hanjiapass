/**
 * Scene Engine v1 - 场景数据归一化
 * 兼容 lesson.scene 的旧/简化写法，统一输出标准 schema
 */

import { getLocalizedSceneText } from "./sceneUtils.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");

function normTitle(raw) {
  if (!raw) return { zh: "", kr: "", en: "" };
  if (typeof raw === "string") return { zh: raw, kr: raw, en: raw };
  return {
    zh: str(raw.zh ?? raw.cn ?? ""),
    kr: str(raw.kr ?? raw.ko ?? ""),
    en: str(raw.en ?? ""),
  };
}

function normGoal(raw) {
  if (!raw) return { zh: "", kr: "", en: "" };
  if (typeof raw === "string") return { zh: raw, kr: raw, en: raw };
  return {
    zh: str(raw.zh ?? raw.cn ?? ""),
    kr: str(raw.kr ?? raw.ko ?? ""),
    en: str(raw.en ?? ""),
  };
}

function normCharacter(raw, index) {
  if (!raw) return null;
  const id = str(raw.id) || (raw.speaker ? str(raw.speaker) : "") || String(index);
  const name = normTitle(raw.name ?? raw);
  const avatar = str(raw.avatar ?? raw.image ?? "");
  return { id, name, avatar };
}

function normFrame(raw, index) {
  if (!raw) return null;
  const id = str(raw.id) || `frame${index + 1}`;
  const image = str(raw.image ?? raw.cover ?? raw.img ?? "");
  const dialogueRef = raw.dialogueRef != null ? Number(raw.dialogueRef) : index;
  const focusWords = Array.isArray(raw.focusWords) ? raw.focusWords.map(str).filter(Boolean) : [];
  return { id, image, dialogueRef, focusWords };
}

/**
 * 归一化 scene 对象
 * @param {object} raw - lesson.scene 原始数据
 * @returns {object|null} 标准 scene 或 null
 */
export function normalizeScene(raw) {
  if (!raw || typeof raw !== "object") return null;

  const id = str(raw.id) || "scene_default";
  const title = normTitle(raw.title);
  const summary = normTitle(raw.summary);
  const cover = str(raw.cover ?? raw.image ?? raw.coverImage ?? "");
  const location = str(raw.location ?? "");
  const mood = str(raw.mood ?? "");

  let goal = [];
  const rawGoal = raw.goal ?? raw.goals ?? raw.objectives;
  if (Array.isArray(rawGoal)) {
    goal = rawGoal.map((g) => (typeof g === "string" ? { zh: g, kr: g, en: g } : normGoal(g))).filter((g) => g.zh || g.kr || g.en);
  } else if (rawGoal && typeof rawGoal === "object") {
    goal = [normGoal(rawGoal)].filter((g) => g.zh || g.kr || g.en);
  }

  let characters = [];
  const rawChars = raw.characters ?? raw.roles ?? [];
  if (Array.isArray(rawChars)) {
    characters = rawChars
      .map((c, i) => (typeof c === "string" ? normCharacter({ id: String.fromCharCode(65 + i), name: c }, i) : normCharacter(c, i)))
      .filter(Boolean);
  }

  let frames = [];
  const rawFrames = raw.frames ?? raw.shots ?? [];
  if (Array.isArray(rawFrames)) {
    frames = rawFrames.map((f, i) => normFrame(f, i)).filter(Boolean);
  }

  return {
    id,
    title,
    summary,
    cover,
    location,
    mood,
    goal,
    characters,
    frames,
  };
}
