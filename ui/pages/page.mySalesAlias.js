// 别名 #my-sales → 正式路由 #teacher-publishing（便于验收清单与非正式书签）

/** @param {unknown} [_ctx] */
export default function run(_ctx) {
  const raw = String(location.hash || "").trim();
  const q = raw.indexOf("?");
  const base = q >= 0 ? raw.slice(0, q) : raw;
  if (base === "#teacher-publishing") return;
  const qs = q >= 0 ? raw.slice(q) : "";
  const target = `#teacher-publishing${qs}`;
  if (raw !== target) location.replace(target);
}

export function mount(ctx) {
  return run(ctx);
}

export function render(ctx) {
  return run(ctx);
}
