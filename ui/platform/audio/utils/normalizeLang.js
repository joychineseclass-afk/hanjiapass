/**
 * Lumina Audio Engine v2 — 语言代码归一化
 */
export function normalizeLang(lang) {
  const l = String(lang ?? "ko").toLowerCase();
  if (l === "kr" || l === "ko") return "ko";
  if (l === "cn" || l === "zh") return "zh";
  if (l === "en") return "en";
  return "ko";
}
