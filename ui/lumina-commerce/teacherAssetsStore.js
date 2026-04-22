/**
 * 老师课堂资产 — localStorage 领域层（与 Step 1 用户/档案隔离）。
 */
import { formatTeacherHubCourseDisplay } from "./commerceDisplayLabels.js";

export const ASSET_TYPE = Object.freeze({
  lesson_slide_draft: "lesson_slide_draft",
  teacher_note_draft: "teacher_note_draft",
  classroom_material: "classroom_material",
});

export const ASSET_STATUS = Object.freeze({
  draft: "draft",
  ready: "ready",
  archived: "archived",
});

export const PPT_MODE = Object.freeze({
  structured: "structured",
});

const LS_KEY = "lumina_teacher_assets_v1";

/**
 * @typedef {Object} TeacherClassroomAssetSource
 * @property {string} course
 * @property {string} level
 * @property {string} lesson
 */

/**
 * @typedef {Object} TeacherClassroomAsset
 * @property {string} id
 * @property {string} teacher_profile_id
 * @property {string} owner_user_id
 * @property {TeacherClassroomAssetSource} source
 * @property {keyof ASSET_TYPE} asset_type
 * @property {string} title
 * @property {keyof ASSET_STATUS} status
 * @property {keyof PPT_MODE} [ppt_mode]
 * @property {string} notes
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {{ v: 1, items: TeacherClassroomAsset[] }} TeacherAssetsFileV1
 */

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  const r = Math.random().toString(36).slice(2, 8);
  return `tasset_${Date.now().toString(36)}_${r}`;
}

/**
 * @returns {TeacherAssetsFileV1}
 */
function loadFile() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { v: 1, items: [] };
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.items)) return { v: 1, items: [] };
    return { v: 1, items: p.items.filter(Boolean).map(sanitizeItem).filter(Boolean) };
  } catch {
    return { v: 1, items: [] };
  }
}

/**
 * @param {unknown} raw
 * @returns {TeacherClassroomAsset|null}
 */
function sanitizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const id = o.id != null ? String(o.id) : "";
  if (!id.startsWith("tasset_")) return null;
  const teacher_profile_id = o.teacher_profile_id != null ? String(o.teacher_profile_id) : "";
  const owner_user_id = o.owner_user_id != null ? String(o.owner_user_id) : "";
  const src = o.source && typeof o.source === "object" ? o.source : {};
  const s = /** @type {Record<string, unknown>} */ (src);
  const course = s.course != null ? String(s.course) : "kids";
  const level = s.level != null ? String(s.level) : "1";
  const lesson = s.lesson != null ? String(s.lesson) : "1";
  const asset_type = String(o.asset_type || ASSET_TYPE.lesson_slide_draft);
  const status = String(o.status || ASSET_STATUS.draft);
  const title = o.title != null ? String(o.title) : defaultTitleEn(course, level, lesson);
  const notes = o.notes != null ? String(o.notes) : "";
  const ppt_mode = o.ppt_mode != null ? String(o.ppt_mode) : PPT_MODE.structured;
  const created_at = o.created_at != null ? String(o.created_at) : nowIso();
  const updated_at = o.updated_at != null ? String(o.updated_at) : created_at;
  return {
    id,
    teacher_profile_id,
    owner_user_id,
    source: { course, level, lesson },
    asset_type: /** @type {keyof ASSET_TYPE} */ (Object.values(ASSET_TYPE).includes(asset_type) ? asset_type : ASSET_TYPE.lesson_slide_draft),
    title,
    status: /** @type {keyof ASSET_STATUS} */ (Object.values(ASSET_STATUS).includes(status) ? status : ASSET_STATUS.draft),
    ppt_mode: /** @type {keyof PPT_MODE} */ (Object.values(PPT_MODE).includes(ppt_mode) ? ppt_mode : PPT_MODE.structured),
    notes,
    created_at,
    updated_at,
  };
}

/**
 * 无 i18n 时的兜底标题（含可读课程名）。
 * @param {string} course
 * @param {string} level
 * @param {string} lesson
 */
export function defaultTitleEn(course, level, lesson) {
  const c = formatTeacherHubCourseDisplay(String(course)) || String(course);
  return `${c} ${String(level)}-${String(lesson)} — slide draft`;
}

/**
 * @param {TeacherAssetsFileV1} data
 */
function saveFile(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, items: data.items }));
  } catch {
    /* quota */
  }
}

/** @returns {TeacherClassroomAsset[]} */
export function listAllTeacherAssets() {
  return loadFile().items;
}

/**
 * @param {string} profileId
 * @returns {TeacherClassroomAsset[]}
 */
export function listAssetsByProfileId(profileId) {
  if (!profileId) return [];
  const pid = String(profileId);
  return listAllTeacherAssets()
    .filter((a) => a.teacher_profile_id === pid)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

/**
 * @param {string} id
 * @returns {TeacherClassroomAsset|null}
 */
export function findAssetById(id) {
  if (!id) return null;
  const found = listAllTeacherAssets().find((a) => a.id === String(id)) || null;
  return found ? sanitizeItem(found) : null;
}

/**
 * @param {Partial<TeacherClassroomAsset> & { id: string }} patch
 * @returns {TeacherClassroomAsset|null}
 */
export function updateTeacherAsset(patch) {
  if (!patch?.id) return null;
  const f = loadFile();
  const ix = f.items.findIndex((a) => a && a.id === patch.id);
  if (ix < 0) return null;
  const prev = sanitizeItem(f.items[ix]);
  if (!prev) return null;
  const merged = {
    ...prev,
    ...patch,
    source: patch.source ? { ...prev.source, ...patch.source } : prev.source,
    updated_at: nowIso(),
  };
  const clean = sanitizeItem(merged);
  if (!clean) return null;
  f.items[ix] = clean;
  saveFile(f);
  return clean;
}

/**
 * @param {Omit<TeacherClassroomAsset, "id" | "created_at" | "updated_at"> & { id?: string, title?: string }} input
 * @returns {TeacherClassroomAsset}
 */
function insertAsset(input) {
  const f = loadFile();
  const t = nowIso();
  const id = input.id && String(input.id).startsWith("tasset_") ? String(input.id) : newId();
  const row = /** @type {TeacherClassroomAsset} */ (
    sanitizeItem({
      ...input,
      id,
      created_at: t,
      updated_at: t,
    })
  );
  f.items.push(row);
  saveFile(f);
  return row;
}

/**
 * @param {object} p
 * @param {string} p.teacherProfileId
 * @param {string} p.ownerUserId
 * @param {string} p.course
 * @param {string} p.level
 * @param {string} p.lesson
 * @param {string} [p.title] 可传入本地化后的标题
 * @param {keyof ASSET_TYPE} [p.asset_type]
 * @param {keyof ASSET_STATUS} [p.status]
 * @param {keyof PPT_MODE} [p.ppt_mode]
 * @param {string} [p.notes]
 * @returns {TeacherClassroomAsset}
 */
export function createTeacherAssetFromLesson(p) {
  const course = String(p.course ?? "kids");
  const level = String(p.level ?? "1");
  const lesson = String(p.lesson ?? "1");
  const title = p.title != null && String(p.title).trim() !== "" ? String(p.title) : defaultTitleEn(course, level, lesson);
  return insertAsset({
    teacher_profile_id: String(p.teacherProfileId),
    owner_user_id: String(p.ownerUserId),
    source: { course, level, lesson },
    asset_type: p.asset_type != null ? p.asset_type : ASSET_TYPE.lesson_slide_draft,
    status: p.status != null ? p.status : ASSET_STATUS.draft,
    ppt_mode: p.ppt_mode != null ? p.ppt_mode : PPT_MODE.structured,
    notes: p.notes != null ? String(p.notes) : "",
    title,
  });
}

/**
 * 将原 demo 等账号在资产上的 owner_user_id 显式改到新用户（与 commerce profile 迁移配套）。
 * @param {string} fromUserId
 * @param {string} toUserId
 * @returns {boolean} 是否写入了变更
 */
export function reassignTeacherAssetOwnersFromUserId(fromUserId, toUserId) {
  const f = loadFile();
  const from = String(fromUserId);
  const to = String(toUserId);
  if (from === to) return false;
  let changed = false;
  f.items = f.items.map((a) => {
    if (!a) return a;
    const o = sanitizeItem(a);
    if (!o) return a;
    if (o.owner_user_id === from) {
      changed = true;
      return /** @type {TeacherClassroomAsset} */ (
        sanitizeItem({
          ...o,
          owner_user_id: to,
          updated_at: nowIso(),
        })
      );
    }
    return o;
  });
  if (changed) saveFile(f);
  return changed;
}

/**
 * 开发/测试用：慎用于生产
 */
export function __dangerClearAllAssetsForTests() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* */
  }
}

export const TEACHER_ASSETS_STORAGE_KEY = LS_KEY;
