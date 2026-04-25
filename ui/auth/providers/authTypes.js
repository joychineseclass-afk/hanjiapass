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
 * 平台级角色（与 public.user_roles 对齐，不含 guest；guest=未登录）
 * @typedef {'student'|'teacher'|'parent'|'admin'|'super_admin'} LuminaPlatformRole
 */

/**
 * public.profiles 行（与 DB 列名一致，供 profileService 使用）
 * @typedef {Object} LuminaProfileRow
 * @property {string} id
 * @property {string|null} [email]
 * @property {string|null} [display_name]
 * @property {string|null} [avatar_url]
 * @property {string} [locale]
 * @property {string} [default_role]
 * @property {string} [created_at]
 * @property {string} [updated_at]
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
 * @property {LuminaRolesV1} [roles] commerce / 老师申请内嵌态（与 appRoles 并存过渡）
 * @property {TeacherApplicationProfileV1|null} [teacherProfile]
 * @property {LuminaPlatformRole[]} [appRoles] Supabase public.user_roles 派生
 * @property {LuminaPlatformRole|''} [defaultRole]
 * @property {string} [avatarUrl]
 * @property {string} [locale]
 * @property {'supabase'|'demo-local'|''} [provider]
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
