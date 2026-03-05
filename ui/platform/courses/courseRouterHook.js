// ui/platform/courses/courseRouterHook.js
// 解析 #course?type=hsk&level=1&lesson=1 等 query，供页面使用

function parseHashQuery(hash) {
  const raw = String(hash ?? location.hash ?? "");
  const qIdx = raw.indexOf("?");
  if (qIdx < 0) return { route: raw.replace(/^#/, ""), query: {} };

  const route = raw.slice(0, qIdx).replace(/^#/, "");
  const qs = raw.slice(qIdx + 1);
  const query = {};
  for (const part of qs.split("&")) {
    const [k, v] = part.split("=");
    if (!k) continue;
    query[decodeURIComponent(k)] = decodeURIComponent((v ?? "").replace(/\+/g, " "));
  }
  return { route, query };
}

export function getCourseRouteState() {
  const { route, query } = parseHashQuery();
  if (route !== "course") return null;

  const rawTrack = query.track || localStorage.getItem("hsk_vocab_version") || "hsk2.0";
  const track = window.DATA_PATHS?.normalizeHskVersion?.(rawTrack) || (rawTrack === "hsk3.0" ? "hsk3.0" : "hsk2.0");
  return {
    type: query.type || "hsk",
    track,
    level: Number(query.level || 1),
    lessonNo: query.lesson ? Number(query.lesson) : null,
    lessonId: query.lessonId || "",
    view: query.view || (query.lesson ? "lesson" : "index"),
  };
}

export function getStrokeRouteState() {
  const { route, query } = parseHashQuery();
  if (route !== "stroke") return null;
  return { char: query.char || "" };
}

export function getHanjaRouteState() {
  const { route, query } = parseHashQuery();
  if (route !== "hanja") return null;
  return { word: query.word || query.q || "" };
}

export function getClassroomRouteState() {
  const { route, query } = parseHashQuery();
  if (route !== "classroom") return null;
  return { classId: query.class || query.classId || "" };
}

export { parseHashQuery };
