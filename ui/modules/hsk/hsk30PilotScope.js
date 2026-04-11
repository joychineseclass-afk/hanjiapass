/**
 * HSK3.0 · HSK1 试点能力范围（供渲染层判断，避免循环依赖）
 */
export function isHsk30Hsk1PilotContext() {
  try {
    const c = typeof window !== "undefined" && window.__HSK_PAGE_CTX;
    return String(c?.version || "").toLowerCase() === "hsk3.0" && Number(c?.level) === 1;
  } catch {
    return false;
  }
}
