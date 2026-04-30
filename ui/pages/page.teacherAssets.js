// 旧路由 #teacher-assets：迁移至统一课程入口 #teacher-courses?tab=assets

function redirectTeacherAssetsToCourses() {
  const raw = String(location.hash || "");
  const q = raw.indexOf("?");
  const params = q >= 0 ? new URLSearchParams(raw.slice(q + 1)) : new URLSearchParams();
  const legacyTab = String(params.get("tab") || "").toLowerCase();
  const next = new URLSearchParams();
  next.set("tab", "assets");
  if (legacyTab === "trash") next.set("assetsView", "trash");
  const target = `#teacher-courses?${next.toString()}`;
  if (raw !== target) location.replace(target);
}

/** @param {unknown} [_ctx] */
function run(_ctx) {
  redirectTeacherAssetsToCourses();
}

export default run;

export function mount(ctx) {
  return run(ctx);
}

export function render(ctx) {
  return run(ctx);
}
