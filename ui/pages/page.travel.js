// 旅游独立路由保留：统一重定向到「会话」旅游 Tab，避免与 Speaking 并列为一级概念
export default async function pageTravel() {
  try {
    const { navigateTo } = await import("../router.js");
    navigateTo("#conversation?tab=travel", { force: true });
  } catch {
    if (typeof location !== "undefined") {
      location.hash = "#conversation?tab=travel";
    }
  }
}

export function mount(ctxOrRoot) {
  return pageTravel();
}
export function render(ctxOrRoot) {
  return pageTravel();
}
