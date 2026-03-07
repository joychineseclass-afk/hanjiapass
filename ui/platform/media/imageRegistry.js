/**
 * Image Engine v1 - 图片别名映射
 * 支持汉字到文件名的映射，便于使用英文/拼音文件名
 */

/** 可选图片别名：汉字 -> 文件名（不含扩展名） */
export const IMAGE_ALIAS = {
  打电话: "phone_call",
  学校: "school",
  苹果: "apple",
  你好: "hello",
  谢谢: "thanks",
  再见: "goodbye",
};

/**
 * 获取词汇对应的图片文件名（优先别名）
 * @param {string} hanzi - 汉字
 * @param {string} id - 可选 id
 * @returns {string} 用于路径的文件名（不含扩展名）
 */
export function resolveImageKey(hanzi, id = "") {
  const h = String(hanzi ?? "").trim();
  const i = String(id ?? "").trim();
  if (IMAGE_ALIAS[h]) return IMAGE_ALIAS[h];
  if (h) return h;
  if (i) return i;
  return "";
}

/**
 * 注册别名（运行时扩展）
 */
export function registerAlias(hanzi, filename) {
  if (hanzi && filename) IMAGE_ALIAS[hanzi] = String(filename).trim();
}
