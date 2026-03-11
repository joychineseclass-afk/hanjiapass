// /ui/modules/games/gamesEngine.js
// MVP：课堂小游戏数据加载引擎（仅读取本地 pedagogy JSON，不接后端）

import { getGameById } from "./gamesRegistry.js";

function getDataUrl(course) {
  const base = (typeof window !== "undefined" && window.DATA_PATHS?.getBase?.())
    ? String(window.DATA_PATHS.getBase()).replace(/\/+$/, "") + "/"
    : (String(window.__APP_BASE__ || "").replace(/\/+$/, "") + "/") || "/";
  const c = course || "kids1";
  return `${base}data/pedagogy/games/${c}_games.json`;
}

export async function loadGameData(gameId) {
  const meta = getGameById(gameId);
  const course = meta?.course || "kids1";
  const url = getDataUrl(course);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { meta, detail: null };
    }
    const json = await res.json();
    const list = Array.isArray(json?.games) ? json.games : [];
    const found =
      list.find((g) => g.id === gameId) ||
      list.find((g) => g.title === meta?.title) ||
      null;
    return { meta, detail: found };
  } catch {
    return { meta, detail: null };
  }
}

