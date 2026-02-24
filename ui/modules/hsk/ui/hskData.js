// /ui/modules/hsk/ui/hskData.js
// ✅ Data layer: version / fetchJson / lesson detail url + loader calls

import { safeText } from "./hskDom.js";

export function getVersion(dom) {
  return (
    safeText(dom?.hskVersion?.value) ||
    safeText(localStorage.getItem("hsk_vocab_version")) ||
    safeText(window.APP_VOCAB_VERSION) ||
    "hsk2.0"
  );
}

export async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`);
  return res.json();
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
  const ver = safeText(version || "hsk2.0");
  return `/data/lessons/${ver}/hsk${lv}_lesson${lessonNo}.json`;
}

export async function loadLessonDetail({ level, lessonNo, version, detailCache }) {
  const ver = safeText(version || "hsk2.0");
  const lv = safeText(level || "1");
  const key = `${ver}:${lv}:${lessonNo}`;

  const hit = detailCache?.get?.(key);
  if (hit) return hit;

  const url = lessonDetailUrl(lv, lessonNo, ver);
  const data = await fetchJson(url);

  detailCache?.set?.(key, data);
  return data;
}

export async function loadLevelData({ level, version }) {
  const lv = safeText(level || "1");
  const ver = safeText(version || "hsk2.0");

  if (!window.HSK_LOADER?.loadVocab) {
    throw new Error("HSK_LOADER.loadVocab 가 없어요. loader 스크립트 로드 상태를 확인해 주세요.");
  }

  const all = await window.HSK_LOADER.loadVocab(lv, { version: ver });

  const lessons = window.HSK_LOADER.loadLessons
    ? await window.HSK_LOADER.loadLessons(lv, { version: ver })
    : null;

  return { all, lessons };
}
