/**
 * Lumina 全站拼音机制 v2
 * 优先级：manualPinyin > cache > generatedDictionary (pinyinMap) > localFallback (pinyinFallback)
 * HSK1~6 默认显示拼音，HSK7~9 预留扩展
 */
import { PINYIN_MAP } from "../vendor/pinyinMap.mjs";
import { PINYIN_FALLBACK } from "../vendor/pinyinFallback.mjs";

/** 内存缓存 */
const CACHE_PREFIX = "pinyin::";
const _cache = new Map();

/** 缺失字符集合（自动检测新字） */
export const missingChars = new Set();
let _reportScheduled = false;

/** 记录缺失字符，并即时 console 提示 */
export function recordMissingChar(char) {
  if (!char || typeof char !== "string" || !/[\u4e00-\u9fff]/.test(char)) return;
  if (missingChars.has(char)) return;
  missingChars.add(char);
  console.warn(`[PinyinMap] Missing character "${char}". Run: npm run build:pinyin`);
  scheduleReportMissingPinyin();
}

/** 汇总提示：页面加载后输出缺失字符数量 */
export function reportMissingPinyin() {
  const n = missingChars.size;
  if (n > 0) {
    console.warn(`[PinyinMap] ${n} characters missing in map. Run: npm run build:pinyin`);
  }
}

function scheduleReportMissingPinyin() {
  if (_reportScheduled) return;
  _reportScheduled = true;
  const run = () => {
    reportMissingPinyin();
    _reportScheduled = false;
  };
  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(run, 500));
  } else {
    setTimeout(run, 500);
  }
}

/** 从 generatedDictionary 或 localFallback 获取拼音 */
function charToPinyin(ch, useFallback = true) {
  const main = PINYIN_MAP?.[ch];
  if (main) return main;
  if (useFallback && PINYIN_FALLBACK?.[ch]) return PINYIN_FALLBACK[ch];
  return "";
}

/** 将汉字转拼音：优先短语级查表，否则逐字查表 */
function toPinyin(text) {
  if (!text || typeof text !== "string") return "";
  const t = text.trim();
  if (!t) return "";
  if (PINYIN_MAP?.[t]) return PINYIN_MAP[t];
  const parts = [];
  for (const ch of t) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      if (!PINYIN_MAP?.[ch] && !PINYIN_FALLBACK?.[ch]) recordMissingChar(ch);
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

/**
 * 会话画布等显示用：拉丁字母一律小写，保留声调符号（含 ü 等）；不改动中文/译文。
 * 仅作用于展示字符串，不回写数据源。
 */
export function normalizePinyinDisplayAllLowercase(text) {
  return String(text ?? "").toLowerCase();
}

/** 朗读链：去掉仅含拉丁拼音的行，避免 UI 语言 TTS 误读 */
const _PINYIN_ONLY_LINE_RE =
  /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜńḿ\u0300-\u036f\s·\-—_,.?!…:;'"0-9]+$/u;

export function stripStandalonePinyinLinesForTts(text) {
  if (text == null) return "";
  const lines = String(text).split("\n");
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/[\u4e00-\u9fff]/.test(t) || /[\uac00-\ud7af]/.test(t)) {
      out.push(line);
      continue;
    }
    if (_PINYIN_ONLY_LINE_RE.test(t)) continue;
    out.push(line);
  }
  return out.join("\n");
}
