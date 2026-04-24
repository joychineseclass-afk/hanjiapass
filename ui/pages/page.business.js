// 商务独立路由保留：统一重定向到「会话」商务 Tab
export default async function pageBusiness() {
  try {
    const { navigateTo } = await import("../router.js");
    navigateTo("#speaking?tab=business", { force: true });
  } catch {
    if (typeof location !== "undefined") {
      location.hash = "#speaking?tab=business";
    }
  }
}

export function mount(ctxOrRoot) {
  return pageBusiness();
}
export function render(ctxOrRoot) {
  return pageBusiness();
}
