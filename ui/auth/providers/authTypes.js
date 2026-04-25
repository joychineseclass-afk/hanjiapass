/**
 * Lumina 账号模型（与认证适配层/后端无关的纯类型，供 JSDoc 引用）。
 * @file
 */

/**
 * @typedef {'active'|'none'} StudentRoleState
 */

/**
 * @typedef {'none'|'pending'|'active'|'rejected'} TeacherRoleState
 */

/**
 * @typedef {Object} LuminaRolesV1
 * @property {StudentRoleState} student
 * @property {TeacherRoleState} teacher
 */

/**
 * @typedef {Object} TeacherApplicationProfileV1
 * @property {string} displayName
 * @property {string} intro
 * @property {string[]} teachingTypes
 * @property {string} experienceLevel
 * @property {string} [note]
 * @property {string} submittedAt
 */

/**
 * @typedef {Object} AuthUserV1
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {string} passwordHash
 * @property {string} created_at
 * @property {string} updated_at
 * @property {boolean} [onboardingCompleted] 缺省时按 legacy 视为 true
 * @property {LuminaRolesV1} [roles]
 * @property {TeacherApplicationProfileV1|null} [teacherProfile]
 */

/**
 * @typedef {{ v: 1, users: AuthUserV1[] }} AuthUsersFile
 */

/**
 * @typedef {{ v: 1, userId: string | null }} AuthSession
 */

/**
 * 将来切换 Supabase/Clerk 等时可与 provider `type` 字段对齐；此处仅作约定。
 * @typedef {'demo-local'|'remote-placeholder'|'remote'} LuminaAuthProviderKind
 */

export {};
