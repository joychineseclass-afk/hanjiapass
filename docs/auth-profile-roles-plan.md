# profiles + user_roles 最小数据层（Step 5）

## 1. 目标

- 在 `auth.users` 之外，用 **`public.profiles`** 存跨端展示/业务主档，用 **`public.user_roles`** 存**平台级**多角色（`student` / `teacher` / `parent` / `admin` / `super_admin`）。
- 与 `AuthUserV1` 中已有 **Lumina 内嵌 `roles: { student, teacher }`（与 commerce / 老师申请流）** 区分：`user_roles` 为**服务端**真源；内嵌字段在过渡期内仍由 overlay / 业务逻辑维护，并随 `appRoles` 与审核流逐步收敛。

## 2. 方案 A / B

| 方案 | 内容 | 建议 |
|------|------|------|
| **A. DB trigger** | `auth.users` 插入后自动写 `profiles` + `user_roles` | 稳定、与客户端无关；SQL 见 `supabase-auth-profile-roles.sql` 末尾注释块 |
| **B. 前端 ensure** | 登录/会话恢复后 `ensureCurrentUserProfile()` 不存在则 `insert` | **当前先采用**，便于联调与排错 |

## 3. 默认与提权

- 首次 `ensure`：`profiles.default_role = 'student'`，`user_roles` 插入一行 `role = 'student'`。
- **禁止**在浏览器侧写入 `admin` / `super_admin`；RLS + `update` policy 限制 `default_role` 不能改为 admin/super_admin。
- `teacher` 的写入走**后续审核流或服务端**（当前前端不插入 `teacher` 行，老师申请态仍用既有 Lumina overlay）。

## 4. RLS 要点

- `profiles`：本人可读、可插首行、可改安全字段；`default_role` 的敏感值受 `WITH CHECK` 约束。
- `user_roles`：本人只读；**仅允许** `insert` 自己的 `role = 'student'`；**无** `update`/`delete` policy — 变更由后续 `service role` / 管理端实现。

## 5. 前端职责

- `ui/auth/profileService.js`：`getCurrentProfile`、`ensureCurrentUserProfile`、`getCurrentUserRoles`、`getCurrentUserProfileBundle`、`updateCurrentProfile`（仅允许 `display_name` / `avatar_url` / `locale` 等，**不提交** `default_role` 与任意 `user_roles` 提权字段）。
- `supabaseAuthProvider`：将 bundle 合并进 **Lumina 内存缓存**（`appRoles` / `defaultRole` / `avatarUrl` / `locale` / `provider: 'supabase'`）。
- **demo** 仍只用本地表，不访问上述表。

## 6. 下一步

- 审核通过老师后，用 **服务端** 或 **特权 Edge Function** 向 `user_roles` 插入 `teacher` 并视情况更新 `profiles.default_role`。
- 全站 UI 以 **`authStore.getCurrentUser()` + bundle** 为准，不直接消费 Supabase 原始 `User` 在页面散落传递。
