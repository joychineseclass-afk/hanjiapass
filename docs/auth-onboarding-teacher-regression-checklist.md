# Lumina 账号 / Onboarding / 教师申请 — 手工回归清单

在修改 `ui/auth/*`、相关页面或导航后，按本清单快速验证。需使用支持 hash 的入口（如 `index.html`）。

**通用准备**

- 打开开发者工具 → Application（或本地存储）查看/清空 `lumina_auth_session_v1`、`lumina_auth_users_v1` 等键（参见 `ui/auth/authStore.js` 注释的 key 名）。

**开发态调试（本地启用 Dev UI 时）**

- 控制台可使用 `window.__LUMINA_AUTH_DEV__`（在 `app.js` 中挂载），包含例如：
  - `runSessionRouteGuards` — 手动跑一轮守卫
  - `getResolvedSessionLandingHash` — 看当前会落地到哪
  - `devSetMockTeacherState('none' | 'pending' | 'rejected' | 'active')`
  - `devResetOnboardingForTest`
  - `setMockTeacherRoleActiveForTest`
- 在 `#teacher-status` 页也有 Dev 按钮区（仅 dev 环境）。

---

## 路径 1：新学生注册

1. 清空 `localStorage` 中与认证相关的项。
2. 打开站点 → 注册新账号（`#auth-register`）。
3. 应进入 `#onboarding-role`，不得直接进入 `#my`。
4. 选「学习」→ 应到 `#my`；刷新，仍应是已登录且**不再**被拉回 onboarding（除非用 dev 重置 onboarding）。
5. 退出（顶栏）→ 再登录 → 应进入 `#my`（或已登录访问 auth 时跳转到落地页，不残留表单页）。

**期望**：注册后**无法**通过改 URL 绕过 onboarding；完成后默认落地为学习主页 `#my`，不强制进教师端。

---

## 路径 2：新老师申请

1. 清空后重新注册。
2. 在 `#onboarding-role` 选「教学 / 申请教师」→ `#teacher-apply`。
3. 填写并提交 → `teacher` 为 pending → 进入 `#teacher-status`（或同义状态页）。
4. 顶栏应显示「审核中」类文案，**不应**出现完整「教师工作台」主入口；点击顶栏应进状态/申请相关页，而不是完整后台。
5. 地址栏改 `#teacher`（或点主导航教师入口）→ 应被拦到 `#teacher-status`（pending），不进入完整工作台。

---

## 路径 3：rejected 重提

1. 在已登录状态下，用 `devSetMockTeacherState('rejected')` 或 Dev 区按钮将状态置为 `rejected`（需先有基本会话）。
2. 打开 `#teacher-status`：应见「未通过」类说明 + **重新申请**。
3. 点重新申请 → `#teacher-apply`，表单应**预填**上次内容（如本地有存档）。
4. 修改后提交 → 状态应回到 `pending`，并可在状态页/顶栏看到审核中。

---

## 路径 4：active 教师

1. 使用 `setMockTeacherRoleActiveForTest()` 或 Dev 的 active。
2. 顶栏应显示「教师工作台」；进入 `#teacher` 应能打开工作台，刷新后仍一致。
3. 再访问 `#teacher-apply` 应被重定向到 `#teacher`（或工作台），避免已开通仍看到申请表。

---

## 路径 5：旧数据兼容

1. 使用**升级前**已存在的 `lumina_auth_users_v1` 数据（无 `onboardingCompleted` 字段的账号）。
2. 登录后**不应**被强制进 `#onboarding-role`（应视为已 onboard）。
3. 若该账号在 commerce 中已有教师身份但 Lumina 未写 `roles.teacher`，应仍能在导航/路由上与「教师 active」表现一致（见 `getTeacherNavRoleState` 兼容逻辑）。

---

## 路径 6：已登录访问 auth 页

1. 保持登录态，在地址栏打开 `#auth-login`、`#auth-register`（及兼容 `#login` / `#register`）。
2. 应**短路径跳转**到当前落地结果（onboarding 未完成 → `#onboarding-role`，否则 `#my`），**不**应长时间停留在登录/注册表单。

---

## 路径 7：onboarding 守卫

1. 新注册**未**在 onboarding 点「学习/教学」前，尝试手动将 hash 改为 `#my`、`#hsk`、`#teacher` 等「业务白名单外」路由。
2. 应被拉回 `#onboarding-role`。
3. 白名单内仅允许：auth 系、`#onboarding-role`、`#teacher-apply`、`#teacher-status`（见 `ui/auth/resolveSessionRoute.js`）。
4. 在 onboarding 完成后，再访问 `#onboarding-role` 应被重定向到 `#my`（若已实现）。

---

## 仍为 Mock / 未覆盖说明

- 无真实短信/邮件、无服务端鉴权、无管理审核后台；教师 `active` 依赖本地 commerce mock / `devForceApprove` 等。

若某步与预期不符，请记录：当前 `location.hash`、相关 localStorage 片段、控制台报错，并检查 `ui/auth/authFlow.js` 的 `runSessionRouteGuards` 调用顺序与 `getTeacherNavRoleState()` 返回值。
