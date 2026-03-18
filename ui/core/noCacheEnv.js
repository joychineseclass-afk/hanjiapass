// ui/core/noCacheEnv.js — 单一来源：是否在开发/预览环境禁用课程数据内存缓存
// 仅用于 HSK 课程 JSON 的 MEM TTL，不把整站 .vercel.app 视为 preview，避免误伤正式站

export function isNoCacheEnv() {
  if (typeof location === "undefined") return false;
  const host = (location.hostname || "").toLowerCase();
  const search = location.search || "";
  if (/^(localhost|127\.0\.0\.1)$/.test(host)) return true;
  if (/[?&]nocache=1/.test(search)) return true;
  if (host.includes("preview")) return true;
  if (host.includes("-git-")) return true;
  return false;
}

if (typeof window !== "undefined") window.isNoCacheEnv = isNoCacheEnv;
