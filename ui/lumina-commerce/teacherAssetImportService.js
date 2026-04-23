/**
 * 本地导入型课件草案：仅记录文件元数据，不上传、不解析（Step 3 占位）。
 */
import { createUploadedSlideDraftFromLocalFile } from "./teacherAssetsStore.js";

/** input accept 字符串（pptx / pdf / 图片） */
export const TEACHER_ASSET_IMPORT_ACCEPT =
  ".pptx,.pdf,.png,.jpg,.jpeg,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,image/png,image/jpeg";

const ALLOWED_EXT = new Set(["pptx", "pdf", "png", "jpg", "jpeg"]);

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSizeLabel(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {string} name
 * @returns {string} 小写扩展名，无则空
 */
export function fileExtensionFromFileName(name) {
  const base = String(name || "").trim();
  const i = base.lastIndexOf(".");
  if (i < 0 || i === base.length - 1) return "";
  return base.slice(i + 1).toLowerCase();
}

/**
 * @param {File} file
 * @returns {{ ok: true } | { ok: false, code: "empty" | "type_not_allowed" }}
 */
export function validateTeacherImportFile(file) {
  if (!file || !file.name) return { ok: false, code: "empty" };
  const ext = fileExtensionFromFileName(file.name);
  if (!ext || !ALLOWED_EXT.has(ext)) return { ok: false, code: "type_not_allowed" };
  return { ok: true };
}

/**
 * @param {File} file
 * @param {object} opts
 * @param {string} opts.teacherProfileId
 * @param {string} opts.ownerUserId
 * @returns {import('./teacherAssetsStore.js').TeacherClassroomAsset}
 */
export function createImportedSlideDraftFromFile(file, opts) {
  const ext = fileExtensionFromFileName(file.name);
  const uploadedAt = new Date().toISOString();
  return createUploadedSlideDraftFromLocalFile({
    teacherProfileId: opts.teacherProfileId,
    ownerUserId: opts.ownerUserId,
    title: String(file.name || "").trim() || "upload",
    upload_meta: {
      file_name: file.name,
      file_type: ext,
      file_size_label: formatFileSizeLabel(file.size),
      uploaded_at: uploadedAt,
    },
  });
}
