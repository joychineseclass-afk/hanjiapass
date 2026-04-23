/**
 * 老师课堂资产 — localStorage 领域层（与 Step 1 用户/档案隔离）。
 */
import { formatTeacherHubCourseDisplay } from "./commerceDisplayLabels.js";

export const ASSET_TYPE = Object.freeze({
  lesson_slide_draft: "lesson_slide_draft",
  /** 本地选择文件生成的导入型课件草案（仅占位元数据，未解析幻灯片） */
  uploaded_slide_draft: "uploaded_slide_draft",
  teacher_note_draft: "teacher_note_draft",
  classroom_material: "classroom_material",
});

/** 导入型草案解析/处理进度（预留） */
export const ASSET_IMPORT_STATUS = Object.freeze({
  raw_uploaded: "raw_uploaded",
});

export const ASSET_STATUS = Object.freeze({
  draft: "draft",
  ready: "ready",
  archived: "archived",
});

export const PPT_MODE = Object.freeze({
  structured: "structured",
});

/** 垃圾桶内草案保留天数，超时在读存储时自动永久清除 */
export const TEACHER_ASSET_TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TEACHER_ASSET_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const LS_KEY = "lumina_teacher_assets_v1";

/**
 * @typedef {Object} TeacherClassroomAssetSource
 * @property {string} course
 * @property {string} level
 * @property {string} lesson
 * @property {string} [kind] 如 local_upload 表示本地导入，非课次来源
 */

/**
 * @typedef {Object} TeacherAssetUploadMetaV1
 * @property {string} file_name
 * @property {string} file_type 扩展名小写，如 pptx
 * @property {string} file_size_label 展示用，如 2.4 MB
 * @property {string} uploaded_at ISO
 */

/**
 * @typedef {Object} TeacherSlideOutlineItemV1
 * @property {string} id
 * @property {string} kind  cover|vocab|dialogue|practice|notes
 * @property {string} title
 * @property {boolean} [enabled]
 */

/**
 * @typedef {Object} TeacherClassroomAsset
 * @property {string} id
 * @property {string} teacher_profile_id
 * @property {string} owner_user_id
 * @property {TeacherClassroomAssetSource} source
 * @property {keyof ASSET_TYPE} asset_type
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [summary]
 * @property {string} [teacher_note] 教师授课备注
 * @property {string} [cover_note] 封面说明
 * @property {keyof ASSET_STATUS} status
 * @property {keyof PPT_MODE} [ppt_mode]
 * @property {string} [notes] 旧版备注字段，与 teacher_note 二选一，sanitize 时合并到展示
 * @property {TeacherSlideOutlineItemV1[]} [slide_outline]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} [deleted_at] ISO，非空表示在垃圾桶
 * @property {string} [deleted_by_user_id]
 * @property {TeacherAssetUploadMetaV1} [upload_meta] 导入型草案文件信息
 * @property {string} [import_status] 如 raw_uploaded
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
 * 默认可编辑课件结构（标题可在编辑页改；kind 稳定）
 * @returns {TeacherSlideOutlineItemV1[]}
 */
export function defaultSlideOutline() {
  return [
    { id: "cover", kind: "cover", title: "Cover", enabled: true },
    { id: "vocab", kind: "vocab", title: "Vocabulary", enabled: true },
    { id: "dialogue", kind: "dialogue", title: "Dialogue", enabled: true },
    { id: "practice", kind: "practice", title: "Practice", enabled: true },
    { id: "notes", kind: "notes", title: "Teacher notes", enabled: true },
  ];
}

/**
 * @param {unknown} x
 * @returns {TeacherSlideOutlineItemV1[]}
 */
/**
 * @param {unknown} raw
 * @returns {TeacherAssetUploadMetaV1|null}
 */
function sanitizeUploadMeta(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const file_name = o.file_name != null ? String(o.file_name) : "";
  const file_type = o.file_type != null ? String(o.file_type) : "";
  const file_size_label = o.file_size_label != null ? String(o.file_size_label) : "";
  const uploaded_at = o.uploaded_at != null ? String(o.uploaded_at) : "";
  if (!file_name && !file_type) return null;
  return { file_name, file_type, file_size_label, uploaded_at };
}

function normalizeSlideOutline(x) {
  if (!Array.isArray(x) || !x.length) return defaultSlideOutline();
  return x
    .map((r, i) => {
      if (!r || typeof r !== "object") return null;
      const o = /** @type {Record<string, unknown>} */ (r);
      const id = o.id != null ? String(o.id) : `slide_${i}`;
      const kind = o.kind != null ? String(o.kind) : "cover";
      const title = o.title != null ? String(o.title) : id;
      const enabled = o.enabled !== false;
      return { id, kind, title, enabled };
    })
    .filter(Boolean);
}

/**
 * @returns {TeacherAssetsFileV1}
 */
/**
 * 从 localStorage 读出并 sanitize，不执行过期清理（供 loadFile / 显式 purge 复用）
 * @returns {TeacherClassroomAsset[]}
 */
function parseStorageToItems() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.items)) return [];
    return p.items.filter(Boolean).map(sanitizeItem).filter(Boolean);
  } catch {
    return [];
  }
}

function loadFile() {
  let items = parseStorageToItems();
  const { items: purged, removed } = purgeExpiredTrashedTeacherAssetsFromList(items);
  if (removed > 0) {
    saveFile({ v: 1, items: purged });
    items = purged;
  }
  return { v: 1, items };
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
  const sourceKind = s.kind != null ? String(s.kind) : "";
  let course = s.course != null ? String(s.course) : "kids";
  let level = s.level != null ? String(s.level) : "1";
  let lesson = s.lesson != null ? String(s.lesson) : "1";
  if (sourceKind === "local_upload") {
    if (s.course == null) course = "local_import";
    if (s.level == null) level = "0";
    if (s.lesson == null) lesson = "0";
  }
  const asset_type = String(o.asset_type || ASSET_TYPE.lesson_slide_draft);
  const status = String(o.status || ASSET_STATUS.draft);
  let title = o.title != null && String(o.title).trim() !== "" ? String(o.title) : "";
  if (!title) {
    if (asset_type === ASSET_TYPE.uploaded_slide_draft) {
      const umEarly = sanitizeUploadMeta(o.upload_meta);
      title = umEarly?.file_name || "upload";
    } else {
      title = defaultTitleEn(course, level, lesson);
    }
  }
  const notesLegacy = o.notes != null ? String(o.notes) : "";
  const teacher_note = o.teacher_note != null ? String(o.teacher_note) : notesLegacy;
  const subtitle = o.subtitle != null ? String(o.subtitle) : "";
  const summary = o.summary != null ? String(o.summary) : "";
  const cover_note = o.cover_note != null ? String(o.cover_note) : "";
  const isSlide = asset_type === ASSET_TYPE.lesson_slide_draft;
  const isUploadedDraft = asset_type === ASSET_TYPE.uploaded_slide_draft;
  const slide_outline = isSlide
    ? normalizeSlideOutline(o.slide_outline)
    : o.slide_outline && Array.isArray(o.slide_outline) && o.slide_outline.length
      ? normalizeSlideOutline(o.slide_outline)
      : [];
  const ppt_mode = o.ppt_mode != null ? String(o.ppt_mode) : PPT_MODE.structured;
  const created_at = o.created_at != null ? String(o.created_at) : nowIso();
  const updated_at = o.updated_at != null ? String(o.updated_at) : created_at;
  const deleted_at_raw = o.deleted_at != null ? String(o.deleted_at).trim() : "";
  const deleted_at = deleted_at_raw || "";
  const deleted_by_user_id = o.deleted_by_user_id != null ? String(o.deleted_by_user_id) : "";
  const uploadMetaSan = sanitizeUploadMeta(o.upload_meta);
  const upload_meta =
    isUploadedDraft || uploadMetaSan
      ? uploadMetaSan || {
          file_name: "",
          file_type: "",
          file_size_label: "",
          uploaded_at: "",
        }
      : undefined;
  const import_status =
    isUploadedDraft || o.import_status != null
      ? String(o.import_status || ASSET_IMPORT_STATUS.raw_uploaded)
      : "";
  /** @type {TeacherClassroomAssetSource} */
  const sourceObj = sourceKind ? { course, level, lesson, kind: sourceKind } : { course, level, lesson };
  return {
    id,
    teacher_profile_id,
    owner_user_id,
    source: sourceObj,
    asset_type: /** @type {keyof ASSET_TYPE} */ (Object.values(ASSET_TYPE).includes(asset_type) ? asset_type : ASSET_TYPE.lesson_slide_draft),
    title,
    subtitle,
    summary,
    teacher_note,
    cover_note,
    status: /** @type {keyof ASSET_STATUS} */ (Object.values(ASSET_STATUS).includes(status) ? status : ASSET_STATUS.draft),
    ppt_mode: /** @type {keyof PPT_MODE} */ (Object.values(PPT_MODE).includes(ppt_mode) ? ppt_mode : PPT_MODE.structured),
    /** @deprecated 保留读路径兼容，新数据用 teacher_note */
    notes: notesLegacy,
    slide_outline,
    created_at,
    updated_at,
    deleted_at,
    deleted_by_user_id,
    ...(upload_meta ? { upload_meta } : {}),
    ...(import_status ? { import_status } : {}),
  };
}

/**
 * @param {TeacherClassroomAsset | null | undefined} a
 * @returns {boolean}
 */
export function isTeacherAssetTrashed(a) {
  return Boolean(a && String(a.deleted_at || "").trim());
}

/**
 * 距离自动永久删除剩余整天数（0 表示当天或已过期将被读时清理）
 * @param {TeacherClassroomAsset} a
 * @returns {number|null} 非垃圾桶内为 null
 */
export function teacherAssetTrashDaysRemaining(a) {
  if (!isTeacherAssetTrashed(a)) return null;
  const t = Date.parse(String(a.deleted_at));
  if (!Number.isFinite(t)) return 0;
  const expireAt = t + TRASH_RETENTION_MS;
  return Math.max(0, Math.ceil((expireAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * 读存储时：永久删除 deleted_at 超过保留期的资产（仅垃圾桶内项）。
 * @param {TeacherClassroomAsset[]} items
 * @returns {{ items: TeacherClassroomAsset[], removed: number }}
 */
export function purgeExpiredTrashedTeacherAssetsFromList(items) {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const next = items.filter((a) => {
    if (!a || !String(a.deleted_at || "").trim()) return true;
    const ts = Date.parse(String(a.deleted_at));
    if (!Number.isFinite(ts)) return true;
    return ts >= cutoff;
  });
  return { items: next, removed: items.length - next.length };
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
    .filter((a) => a.teacher_profile_id === pid && !isTeacherAssetTrashed(a))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

/**
 * 垃圾桶：当前 profile 下已软删且未过期的草案
 * @param {string} profileId
 * @returns {TeacherClassroomAsset[]}
 */
export function listTrashedAssetsByProfileId(profileId) {
  if (!profileId) return [];
  const pid = String(profileId);
  return listAllTeacherAssets()
    .filter((a) => a.teacher_profile_id === pid && isTeacherAssetTrashed(a))
    .sort((a, b) => String(b.deleted_at || "").localeCompare(String(a.deleted_at || "")));
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
    slide_outline: patch.slide_outline != null ? patch.slide_outline : prev.slide_outline,
    upload_meta: patch.upload_meta !== undefined ? patch.upload_meta : prev.upload_meta,
    import_status: patch.import_status !== undefined ? String(patch.import_status || "") : prev.import_status,
    deleted_at: patch.deleted_at !== undefined ? String(patch.deleted_at || "") : prev.deleted_at,
    deleted_by_user_id:
      patch.deleted_by_user_id !== undefined ? String(patch.deleted_by_user_id || "") : prev.deleted_by_user_id,
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
 * @param {string} [p.subtitle]
 * @param {string} [p.summary]
 * @param {string} [p.teacher_note]
 * @param {string} [p.cover_note]
 * @param {TeacherSlideOutlineItemV1[]} [p.slide_outline]
 * @returns {TeacherClassroomAsset}
 */
/**
 * 从本机选择的文件元数据创建导入型课件草案（不读文件内容、不上传服务器）。
 * @param {object} p
 * @param {string} p.teacherProfileId
 * @param {string} p.ownerUserId
 * @param {TeacherAssetUploadMetaV1} p.upload_meta
 * @param {string} [p.title] 默认用文件名
 * @param {string} [p.import_status]
 * @returns {TeacherClassroomAsset}
 */
export function createUploadedSlideDraftFromLocalFile(p) {
  const um = sanitizeUploadMeta(p.upload_meta);
  if (!um || !um.file_name) {
    throw new Error("createUploadedSlideDraftFromLocalFile: missing upload_meta.file_name");
  }
  const title = p.title != null && String(p.title).trim() !== "" ? String(p.title).trim() : um.file_name;
  return insertAsset({
    teacher_profile_id: String(p.teacherProfileId),
    owner_user_id: String(p.ownerUserId),
    source: { kind: "local_upload", course: "local_import", level: "0", lesson: "0" },
    asset_type: ASSET_TYPE.uploaded_slide_draft,
    status: ASSET_STATUS.draft,
    ppt_mode: PPT_MODE.structured,
    title,
    subtitle: "",
    summary: "",
    teacher_note: "",
    cover_note: "",
    notes: "",
    slide_outline: [],
    upload_meta: um,
    import_status: String(p.import_status || ASSET_IMPORT_STATUS.raw_uploaded),
  });
}

export function createTeacherAssetFromLesson(p) {
  const course = String(p.course ?? "kids");
  const level = String(p.level ?? "1");
  const lesson = String(p.lesson ?? "1");
  const title = p.title != null && String(p.title).trim() !== "" ? String(p.title) : defaultTitleEn(course, level, lesson);
  const at = p.asset_type != null ? p.asset_type : ASSET_TYPE.lesson_slide_draft;
  const slideOutline = at === ASSET_TYPE.lesson_slide_draft
    ? p.slide_outline && Array.isArray(p.slide_outline)
      ? normalizeSlideOutline(p.slide_outline)
      : defaultSlideOutline()
    : [];
  return insertAsset({
    teacher_profile_id: String(p.teacherProfileId),
    owner_user_id: String(p.ownerUserId),
    source: { course, level, lesson },
    asset_type: at,
    status: p.status != null ? p.status : ASSET_STATUS.draft,
    ppt_mode: p.ppt_mode != null ? p.ppt_mode : PPT_MODE.structured,
    notes: p.notes != null ? String(p.notes) : "",
    title,
    subtitle: p.subtitle != null ? String(p.subtitle) : "",
    summary: p.summary != null ? String(p.summary) : "",
    teacher_note: p.teacher_note != null ? String(p.teacher_note) : "",
    cover_note: p.cover_note != null ? String(p.cover_note) : "",
    slide_outline: slideOutline,
  });
}

/**
 * 合并 teacher_note 与历史 notes
 * @param {import('./teacherAssetsStore.js').TeacherClassroomAsset | null} a
 * @returns {string}
 */
export function getEffectiveTeacherNote(a) {
  if (!a) return "";
  if (a.teacher_note && String(a.teacher_note).trim()) return String(a.teacher_note).trim();
  if (a.notes && String(a.notes).trim()) return String(a.notes).trim();
  return "";
}

/**
 * 将原 demo 等账号在资产上的 owner_user_id 显式改到新用户（与 commerce profile 迁移配套）。
 * @param {string} fromUserId
 * @param {string} toUserId
 * @returns {boolean} 是否写入了变更
 */
/**
 * 软删：写入 deleted_at，主列表与课堂入口将隐藏。
 * @param {string} assetId
 * @param {string} userId
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function moveTeacherAssetToTrash(assetId, userId) {
  const id = String(assetId || "").trim();
  if (!id) return { ok: false, code: "missing_id" };
  const a = findAssetById(id);
  if (!a) return { ok: false, code: "not_found" };
  if (isTeacherAssetTrashed(a)) return { ok: false, code: "already_trashed" };
  if (a.status === ASSET_STATUS.archived) return { ok: false, code: "archived" };
  updateTeacherAsset({
    id,
    deleted_at: nowIso(),
    deleted_by_user_id: String(userId || ""),
  });
  return { ok: true };
}

/**
 * 从垃圾桶恢复
 * @param {string} assetId
 * @param {string} [_userId] 预留校验
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function restoreTeacherAssetFromTrash(assetId, _userId) {
  const id = String(assetId || "").trim();
  if (!id) return { ok: false, code: "missing_id" };
  const a = findAssetById(id);
  if (!a) return { ok: false, code: "not_found" };
  if (!isTeacherAssetTrashed(a)) return { ok: false, code: "not_trashed" };
  updateTeacherAsset({
    id,
    deleted_at: "",
    deleted_by_user_id: "",
  });
  return { ok: true };
}

/**
 * 手动清空当前老师 profile 下垃圾桶：永久删除所有已软删项。不影响未删除草案与其他 profile。
 * @param {string} profileId
 * @returns {{ ok: true, removed: number } | { ok: false, code: string }}
 */
export function permanentlyDeleteAllTrashedForTeacherProfile(profileId) {
  const pid = String(profileId || "").trim();
  if (!pid) return { ok: false, code: "missing_profile" };
  const f = loadFile();
  const before = f.items.length;
  const next = f.items.filter((a) => {
    if (!a) return true;
    if (String(a.teacher_profile_id || "") !== pid) return true;
    if (!isTeacherAssetTrashed(a)) return true;
    return false;
  });
  const removed = before - next.length;
  if (removed > 0) saveFile({ v: 1, items: next });
  return { ok: true, removed };
}

/**
 * 显式执行过期清理并写回（通常 loadFile 已自动执行；供调试或外部调用）
 * @returns {number} 移除条数
 */
export function purgeExpiredTrashedTeacherAssets() {
  const items = parseStorageToItems();
  const { items: next, removed } = purgeExpiredTrashedTeacherAssetsFromList(items);
  if (removed > 0) saveFile({ v: 1, items: next });
  return removed;
}

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
