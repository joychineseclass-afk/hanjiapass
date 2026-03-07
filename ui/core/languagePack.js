/**
 * Lumina Language Pack Engine v1
 * 按语言加载 /lang/{lang}.json
 * 新增语言只需添加 /lang/es.json 等，无需改代码
 */

const CACHE = new Map();

/**
 * 获取 lang 目录基础路径
 */
function getLangBase() {
  try {
    const base = typeof window !== "undefined" && window.DATA_PATHS?.getBase?.();
    if (base && String(base).trim()) {
      return String(base).replace(/\/+$/, "") + "/lang";
    }
  } catch {}
  return "/lang";
}

/**
 * 加载语言包
 * @param {string} lang - kr | cn | en | jp | ko | zh (ko→kr, zh→cn)
 * @returns {Promise<object>}
 */
export async function loadLanguagePack(lang) {
  const raw = String(lang || "kr").toLowerCase().trim();
  let fileLang = raw;
  if (raw === "ko") fileLang = "kr";
  else if (raw === "zh" || raw === "cn") fileLang = "cn";
  else if (raw !== "kr" && raw !== "cn" && raw !== "en" && raw !== "jp") {
    fileLang = "kr";
  }

  const cached = CACHE.get(fileLang);
  if (cached) return cached;

  const base = getLangBase();
  const url = base.startsWith("http") ? `${base}/${fileLang}.json` : `${base}/${fileLang}.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pack = await res.json();
    if (pack && typeof pack === "object") {
      CACHE.set(fileLang, pack);
      return pack;
    }
  } catch (e) {
    console.warn("[LanguagePack] load failed:", fileLang, e?.message);
  }

  CACHE.set(fileLang, {});
  return {};
}

/**
 * 清除缓存（语言切换时可选调用）
 */
export function clearLanguagePackCache() {
  CACHE.clear();
}
