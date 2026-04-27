/**
 * 无 store 副作用的查询，供 auth / profile 层复用，避免循环依赖。
 * @param {import('./schema.js').CommerceStoreSnapshot|null} snap
 * @param {string} userId
 * @returns {import('./schema.js').TeacherSellerProfile|null}
 */
export function findTeacherProfileByUserId(snap, userId) {
  if (!snap || !userId) return null;
  const list = Array.isArray(snap.teacher_profiles) ? snap.teacher_profiles : [];
  return list.find((p) => p && p.user_id === userId) || null;
}
