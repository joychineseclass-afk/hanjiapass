/**
 * Lumina i18n 文案键名总表
 * 商业级模块化结构，支持 CN / KR / EN
 *
 * 设计原则：
 * 1. 全部使用 模块_功能 命名（如 review_start, lesson_dialogue）
 * 2. 不在代码中写死中文
 * 3. 所有模块必须用 key
 *
 * 扩展新语言：增加 jp.json, es.json 等即可
 */

const FILES = [
  "common.json",
  "nav.json",
  "hsk.json",
  "lesson.json",
  "practice.json",
  "review.json",
  "audio.json",
  "progress.json",
  "system.json",
  "teacher.json",
  "student.json",
  "future.json",
];

/**
 * 将 JSON 格式 { key: { cn, kr, en } } 转为 DICT 格式 { kr: { key: val }, cn: {}, en: {} }
 * @param {object} flat - 单个 JSON 文件内容
 * @returns {{ kr: object, cn: object, en: object }}
 */
export function jsonToDict(flat) {
  const out = { kr: {}, cn: {}, en: {} };
  if (!flat || typeof flat !== "object") return out;
  for (const [key, val] of Object.entries(flat)) {
    if (val && typeof val === "object") {
      if (val.kr) out.kr[key] = val.kr;
      if (val.cn) out.cn[key] = val.cn;
      if (val.en) out.en[key] = val.en;
    }
  }
  return out;
}

/**
 * 加载所有 i18n JSON 并合并为 DICT
 * @param {string} basePath - 如 "/ui/i18n/" 或 "https://example.com/ui/i18n/"
 * @returns {Promise<{ kr: object, cn: object, en: object }>}
 */
export async function loadAllI18n(basePath = "/ui/i18n/") {
  const merged = { kr: {}, cn: {}, en: {} };
  const path = String(basePath || "").replace(/\/+$/, "") + "/";

  for (const file of FILES) {
    try {
      const url = path + file;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const dict = jsonToDict(data);
      Object.assign(merged.kr, dict.kr);
      Object.assign(merged.cn, dict.cn);
      Object.assign(merged.en, dict.en);
    } catch {
      // 忽略单个文件加载失败
    }
  }

  return merged;
}

/**
 * 同步加载（用于构建时预合并，或内联数据）
 * 返回合并后的 DICT 结构
 */
export function getBundledDict() {
  // 占位：构建时可替换为预合并的静态数据
  return { kr: {}, cn: {}, en: {} };
}
