// /ui/modules/hsk/ui/hskData.js
// ✅ Data layer: version / fetchJson / lesson detail url + loader calls

import { safeText } from "./hskDom.js";
import { fetchJsonCached } from "../../../core/fetchJsonCached.js";
import { dedupeLessonLoad } from "../lessonSession.js";

/** version 仅允许 hsk2.0 / hsk3.0 */
export function getVersion(dom) {
  const raw =
    safeText(dom?.hskVersion?.value) ||
    safeText(localStorage.getItem("hsk_vocab_version")) ||
    safeText(window.APP_VOCAB_VERSION) ||
    "hsk2.0";
  return window.DATA_PATHS?.normalizeHskVersion?.(raw) || window.HSK_LOADER?.normalizeVersion?.(raw) || (raw === "hsk3.0" ? "hsk3.0" : "hsk2.0");
}

export async function fetchJson(url) {
  return fetchJsonCached(String(url), { cache: "no-store" });
}

export function getLessonNo(lesson, idxFallback = 0) {
  const n =
    Number(lesson?.lesson) ||
    Number(lesson?.id) ||
    Number(lesson?.no) ||
    Number(idxFallback + 1);
  return Number.isFinite(n) && n > 0 ? n : idxFallback + 1;
}

export function lessonDetailUrl(level, lessonNo, version) {
  const lv = safeText(level || "1");
  const raw = safeText(version || "hsk2.0");
  const ver = window.DATA_PATHS?.normalizeHskVersion?.(raw) || (raw === "hsk3.0" ? "hsk3.0" : "hsk2.0");
  const no = Number(lessonNo || 1) || 1;
  if (window.DATA_PATHS?.lessonDetailUrl) {
    return window.DATA_PATHS.lessonDetailUrl(lv, no, { version: ver });
  }
  return `/data/courses/${ver}/hsk${lv}/lesson${no}.json`;
}

export async function loadLessonDetail({ level, lessonNo, version, detailCache, file } = {}) {
  const raw = safeText(version || "hsk2.0");
  const ver = window.DATA_PATHS?.normalizeHskVersion?.(raw) || (raw === "hsk3.0" ? "hsk3.0" : "hsk2.0");
  const lv = safeText(level || "1");
  const filePart = safeText(file || "");
  const key = `${ver}:${lv}:${lessonNo}:${filePart}`;

  const hit = detailCache?.get?.(key);
  if (hit) return hit;

  const dedupeKey = `hskData:${key}`;

  return dedupeLessonLoad(dedupeKey, async () => {
    if (window.HSK_LOADER?.loadLessonDetail) {
      try {
        const data = await window.HSK_LOADER.loadLessonDetail(lv, lessonNo, { version: ver, file: filePart || undefined });
        detailCache?.set?.(key, data);
        return data;
      } catch (e) {
        console.warn("[hskData] HSK_LOADER.loadLessonDetail failed, fallback to direct fetch:", e?.message || e);
      }
    }

    const url = lessonDetailUrl(lv, lessonNo, ver);
    const data = await fetchJson(url);
    detailCache?.set?.(key, data);
    return data;
  });
}

export async function loadLevelData({ level, version }) {
  const lv = safeText(level || "1");
  const raw = safeText(version || "hsk2.0");
  const ver = window.DATA_PATHS?.normalizeHskVersion?.(raw) || (raw === "hsk3.0" ? "hsk3.0" : "hsk2.0");

  if (!window.HSK_LOADER?.loadVocab) {
    throw new Error("HSK_LOADER.loadVocab 가 없어요. loader 스크립트 로드 상태를 확인해 주세요.");
  }

  const all = await window.HSK_LOADER.loadVocab(lv, { version: ver });

  const lessons = window.HSK_LOADER.loadLessons
    ? await window.HSK_LOADER.loadLessons(lv, { version: ver })
    : null;

  return { all, lessons };
}
