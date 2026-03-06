/**
 * Lumina 全站拼音机制 v1
 * - 人工拼音优先
 * - 主引擎（预构建 char map）自动生成
 * - 本地兜底（内联常用字）
 * - 结果缓存
 * - HSK1~6 默认显示拼音，HSK7~9 预留扩展
 */
import { PINYIN_MAP } from "../vendor/pinyinMap.mjs";

/** 本地兜底：主引擎失败或字符缺失时使用的常用字映射（HSK1~2 高频） */
const FALLBACK_MAP = {
  你: "nǐ", 好: "hǎo", 吗: "ma", 我: "wǒ", 很: "hěn", 谢: "xiè", 也: "yě",
  一: "yī", 二: "èr", 三: "sān", 四: "sì", 五: "wǔ", 六: "liù", 七: "qī", 八: "bā", 九: "jiǔ", 十: "shí",
  不: "bù", 是: "shì", 的: "de", 了: "le", 在: "zài", 有: "yǒu", 和: "hé", 人: "rén", 这: "zhè", 中: "zhōng",
  大: "dà", 上: "shàng", 下: "xià", 来: "lái", 到: "dào", 说: "shuō", 去: "qù", 要: "yào", 看: "kàn", 能: "néng",
  他: "tā", 她: "tā", 们: "men", 什: "shén", 么: "me", 哪: "nǎ", 那: "nà", 怎: "zěn", 样: "yàng", 为: "wèi",
  吃: "chī", 喝: "hē", 买: "mǎi", 学: "xué", 工: "gōng", 作: "zuò", 今: "jīn", 天: "tiān", 明: "míng", 昨: "zuó",
  小: "xiǎo", 多: "duō", 少: "shǎo", 新: "xīn", 老: "lǎo", 高: "gāo", 长: "cháng", 好: "hǎo", 快: "kuài", 慢: "màn",
};

/** 内存缓存 */
const CACHE_PREFIX = "pinyin::";
const _cache = new Map();

/** 从主引擎或兜底获取单字拼音 */
function charToPinyin(ch, useFallback = true) {
  const main = PINYIN_MAP?.[ch];
  if (main) return main;
  if (useFallback && FALLBACK_MAP[ch]) return FALLBACK_MAP[ch];
  return "";
}

/** 将汉字转拼音：逐字查表，非汉字保留原样，字间空格连接 */
function toPinyin(text) {
  if (!text || typeof text !== "string") return "";
  const t = text.trim();
  if (!t) return "";
  const parts = [];
  for (const ch of t) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      const py = charToPinyin(ch);
      parts.push(py || ch);
    } else {
      parts.push(ch);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * 解析拼音（优先级：人工 > 主引擎 > 兜底 > 空）
 * @param {string} text - 中文文本
 * @param {string} [manualPinyin] - 人工拼音
 * @param {{ skipCache?: boolean }} [options]
 */
export function resolvePinyin(text, manualPinyin, options = {}) {
  const t = String(text ?? "").trim();
  if (!t) return "";
  const manual = String(manualPinyin ?? "").trim();
  if (manual) return manual;

  if (!options.skipCache) {
    const cached = _cache.get(CACHE_PREFIX + t);
    if (cached !== undefined) return cached;
  }

  let result = "";
  try {
    result = toPinyin(t);
  } catch (e) {
    result = "";
  }
  _cache.set(CACHE_PREFIX + t, result);
  return result;
}

/** 获取缓存拼音 */
export function getCachedPinyin(text) {
  return _cache.get(CACHE_PREFIX + String(text ?? "").trim());
}

/** 设置缓存 */
export function setCachedPinyin(text, value) {
  const t = String(text ?? "").trim();
  if (t) _cache.set(CACHE_PREFIX + t, String(value ?? "").trim());
}

/**
 * 是否显示拼音
 * HSK1~6 默认 true，HSK7~9 预留可关闭
 */
export function shouldShowPinyin({ level, version, courseType } = {}) {
  const lv = typeof level === "string"
    ? parseInt(String(level).replace(/\D/g, ""), 10) || 1
    : Number(level) || 1;
  const ver = String(version ?? "").toLowerCase();
  const isHsk79 = lv >= 7 || /[789]/.test(ver);
  if (isHsk79) return false; // HSK7~9 扩展点：可改为根据设置
  return true;
}

/**
 * 从 raw 对象提取人工拼音（兼容多种字段）
 * vocab: pinyin, py
 * dialogue: pinyin, py
 * grammar title: titlePinyin, pinyin, py
 * grammar example: example.pinyin, example.py
 */
export function maybeGetManualPinyin(raw, context = "vocab") {
  if (!raw || typeof raw !== "object") return "";
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
  if (context === "vocab") return str(raw.pinyin ?? raw.py);
  if (context === "dialogue") return str(raw.pinyin ?? raw.py);
  if (context === "grammarTitle") {
    const t = raw.title;
    if (typeof t === "object") return str(t?.pinyin ?? t?.py);
    return str(raw.titlePinyin ?? raw.pinyin ?? raw.py);
  }
  if (context === "grammarExample") {
    const ex = raw.example ?? raw.examples;
    if (typeof ex === "object") return str(ex?.pinyin ?? ex?.py);
    return "";
  }
  return str(raw.pinyin ?? raw.py);
}

/** 规范化拼音输入（去除多余空格、统一格式） */
export function normalizePinyinInput(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}
