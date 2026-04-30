/**
 * 教师注册/实名相关字段校验（申请表与老师档案共用）
 */

/** @param {unknown} val */
export function normalizeName(val) {
  return String(val ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {unknown} p */
export function normalizePhoneDigits(p) {
  return String(p ?? "").replace(/\D/g, "");
}

/**
 * YYYY-MM-DD
 * @returns {string | null}
 */
export function normalizeBirthdayIso(val) {
  const raw = String(val ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map((x) => parseInt(x, 10));
  if ([y, m, d].some(Number.isNaN)) return null;
  const bd = new Date(y, m - 1, d);
  if (bd.getFullYear() !== y || bd.getMonth() !== m - 1 || bd.getDate() !== d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const b0 = new Date(y, m - 1, d);
  if (b0 > today) return null;
  const oldest = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  if (b0 < oldest) return null;
  return raw;
}

/** @param {string} [iso] */
export function ageFromBirthdayIso(iso) {
  const s = normalizeBirthdayIso(iso || "");
  if (!s) return null;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}
