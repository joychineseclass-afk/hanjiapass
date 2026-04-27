# Lumina 真实账号系统：选型与接入边界设计

> 本文档为 **Step 2** 设计产出：不接入真实 SDK、不改运行时代码，仅定义技术选型、数据与接口边界，供后续 Step 3+ 实施引用。

---

## 1. 当前状态

- **`ui/auth/authStore.js`** 已是统一认证入口：选择 provider、暴露 `authStore` 统一 API（`signUp` / `signIn` / `signOut` / `getSession` / `getCurrentUser` / `updateProfile` / `isAuthenticated` / `onAuthChange`），并委托持久化相关方法（如 `findUserById`、`loadSession`、`saveSession`、`upsertUser` 等）。
- **`ui/auth/providers/demoLocalAuthProvider.js`** 仍负责本地 **demo 登录**（`localStorage` 用户表与会话），仅用于开发/演示，文件内已标注非生产用途。
- **`ui/auth/providers/remoteAuthProvider.placeholder.js`** 是未来 **真实远程认证** 的占位：方法抛错或返回空，提示尚未配置后端。
- **页面与业务逻辑** 应通过 `authService` / `authStore` 访问认证状态，**不应直接读写 `localStorage`** 中的用户表或会话 key。
- **当前 demo 登录** 不能作为正式账号：清缓存/换端即失、无服务端校验、不适合付费、跨设备同步、合规审计。

---

## 2. Lumina 账号系统未来需要支持什么

### A. 学生端

- 注册 / 登录（跨端一致身份）
- 跨设备登录与会话续期
- 学习进度同步
- 错题记录
- 课程购买与访问权利（与订单/权益一致）
- AI 使用额度（按用户/计划扣减，以后端为准）
- 个人资料与偏好

### B. 老师端

- 老师身份与资料（可审核、可展示字段分离）
- 创建教材、上传课件/资产
- 发布课程或教材（含审核流）
- 收益与结算信息（敏感字段仅服务端/合规通道）
- 学生/班级等管理（与报名、课程关系绑定）

### C. 管理端

- 审核老师申请与资料
- 审核教材、课程、公开内容
- 禁用或下架违规内容/账号
- 管理用户与角色（平台运营）
- 平台数据看板与审计

### D. 家长端（未来预留）

- 绑定/关联子女账号
- 查看学习进度与报告
- 代购课程与权益
- 接收学习报告与通知

> 以上能力需要 **身份（Auth）+ 数据（DB）+ 文件（Storage）+ 规则（RLS/后端）** 协同，单做「登录页」无法覆盖。

---

## 3. 角色模型初稿

原则：**多角色**用数组表示，**禁止**用单一 `role: "teacher"` 字符串作为唯一真源；权限与可访问资源以后端/RLS 为准。

| 角色 | 说明 | 典型可访问能力（需在后端落规则） |
|------|------|----------------------------------|
| **guest** | 未登录 | 公共页、试看、营销页；无个人数据写权限 |
| **student** | 学生 | 学习路径、进度、购买入口、个人资料、AI 额度内能力 |
| **teacher** | 老师 | 老师资料、教材/课件资产、发布流（经审核）、收益相关入口（非敏感展示） |
| **parent** | 家长 | 绑定子女、代付、看报告、家长通知 |
| **admin** | 管理 | 审核、内容管理、用户与角色运营、看平台数据（脱敏/分级） |
| **super_admin** | 超级管理 | 平台级配置、高危操作、审计全链路（应最小人数 + MFA） |

**建议用户主档（与 UI 强相关、非敏感部分）可抽象为：**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "显示名",
  "avatarUrl": "https://...",
  "roles": ["student"],
  "defaultRole": "student",
  "locale": "zh-CN",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

业务侧可扩展为「profiles 表 + user_roles 表」：同一用户可并存 `teacher` + `parent` 等；`defaultRole` 用于落地页与导航默认 context。

---

## 4. Provider 选型对比

| 维度 | Supabase | Clerk | Firebase Auth | 自建后端 Auth |
|------|----------|--------|-----------------|----------------|
| **跨设备账号** | 支持；Email/OAuth/Magic Link 等 | 强；多端会话体验好 | 强；与 Google 等生态成熟 | 全自建；灵活，工期长 |
| **Session 管理** | JWT + 刷新、服务端可轮换 | 托管会话/会话管理完善 | 成熟 token 与 SDK | 自研或库组合，风险与成本自担 |
| **数据库整合** | 原生 PG，与表、RLS 一体 | 需**另接**数据库；用户 ID 可同步 | 常用 Firestore/RTDB，与关系型需权衡 | 任意栈，你拥有全部 |
| **权限控制** | **RLS** 在库层，适合 B2B2C/多角色 | 组织/角色偏产品化，**业务表仍要 RLS/后端** | 安全规则在 Firestore 上，复杂关系可能绕 | 完全自定义 |
| **老师/学生/管理端** | 全部可用「用户 + 角色 + RLS + Edge Functions」落地 | 登录强；业务分端仍要自建数据层 | 可行；规则与查询复杂度随域模型上升 | 一次性设计到位，开发量大 |
| **支付与购买记录** | 用 DB 表 + Webhook/Edge，易与 `profiles` 关联 | 同左，Clerk 不替你管订单 | 可接；需防重复、幂等、对账，自建常更绕 | 完全自主 |
| **学习进度数据承接** | 关系型表 + 索引/聚合天然 | 同左，库仍自建 | 文档模型适合，但多表关联/报表要设计 | 任意 |
| **成本** | 有免费档；量上来按用量 | 常按 MAU/功能档 | 按产品与读写计费 | 人力 + 运维 + 机钱 |
| **开发复杂度** | 中；Auth+DB+Storage 同栈 | 登录低，**全栈业务仍中~高** | 中~高；规则与域模型要纪律 | 高（长期可最优） |
| **对 Lumina 当前阶段** | **高**：要的不只是 IdP，而是平台数据面 | 纯登录不解决课程/购课/老师资料/审核 | 可，但数据与规则长期维护成本常高于 PG+RLS | 团队大再做更合适 |

---

## 5. 推荐结论

**当前阶段建议优先选择：Supabase**（作为「Auth + Database + Storage + RLS」的一体化承载，而不是只换一个登录按钮）。

**理由（与 Lumina 平台型需求对齐）：**

- Lumina 不只需要「能登录」，还需要 **用户表、课程进度、购买记录、老师资料、资产存储、审核状态** 等，天然落在 **Postgres 表 + RLS** 上更直接。
- 同栈提供 **Storage**（课件/资产）与 **RLS**（按角色与资源行级控权），减少「仅 IdP + 自拼数据库 + 自拼权限」的胶水成本。
- 购买记录、AI 额度、审核日志均可落在同一数据平面，用 Edge Functions 或外部 Webhook 串支付与幂等，扩展路径清晰。

**也要承认：**

- **Clerk**：登录体验、组织/用户管理产品化好，但 **数据库与业务 RLS 仍需另起**，Lumina 的「重数据」场景下总拥有成本未必更低。
- **Firebase**：Auth + Firestore/Storage 成熟，但 **多角色 + 关联系 + 管理端** 的查询与规则复杂度容易上升；与现有偏关系型的课程/购课模型未必最顺。
- **自建后端**：**自由度最高、长期可最优**，但 **当前阶段人力与周期成本过高**，适合团队扩张后再做「混合」：IdP/会话外包 + 自研业务核心。

> 若未来必须「Auth 用 Clerk + 数据用 Supabase」这类组合，可保留本文 **provider 接口边界**，将「身份由 Clerk 签发、user_id 同步到 public.profiles」作为单独迁移主题。

---

## 6. 真实 provider 边界设计

基于当前 `authStore` 的异步 provider 能力，未来 **`supabaseAuthProvider`**（名称可随实现调整）可约定实现如下形状（**示例**，与 Step 1 中 placeholder 的扩展方向一致）：

```js
export const supabaseAuthProvider = {
  type: "supabase",

  async signUp(payload) {},
  async signIn(payload) {},
  async signOut() {},
  async getSession() {},
  async getCurrentUser() {},
  async updateProfile(payload) {},
  async onAuthStateChange(callback) {}
};
```

| 方法 | 职责（边界内） | 注意 |
|------|------------------|------|
| **signUp** | 调用 Supabase Auth 注册（如 email+password 或 magic link 流程开始）；**不在前端落库用户业务表**（可由触发器/Edge 创建 `public.profiles`） | 返回统一 `{ ok, user? \| code }` 或与现有 `authStore` 消费方对齐的 Result |
| **signIn** | 建立服务端会话/刷新；成功后返回当前用户可展示摘要 | 不设本地 `passwordHash` |
| **signOut** | 清除服务端与 SDK 所管 session；**本地仅存非敏感 UI** | 与 `emitAuthStateChanged` 联动 |
| **getSession** | 返回**可安全暴露**的 session 描述（如 user id、到期时间、provider 元信息），**不含**长生命周期的秘密 | 与现有路由守卫兼容时可映射为 `AuthSession` 形态 |
| **getCurrentUser** | 与 `public.profiles` 或只读 view 同步后的用户展示模型（**含 `roles: string[]` 等，以服务端为真**） | 不替代 RLS，只是 UI 真源之一 |
| **updateProfile** | 更新允许客户端写的公开字段（displayName、locale、avatar 引用等） | 敏感/审核字段由服务端或 admin 流修改 |
| **onAuthStateChange** | 订阅 Supabase `onAuthStateChange`（或同等），在登录/登出/刷新/USER_UPDATED 时通知 `authStore` 刷新内存状态并触发 `onAuthChange` 与/或 `joy:authChanged` | **单一入口**，避免多处分发 |

**sync 型方法**（`findUserById`、`loadSession` 等）在 Step 1 中用于兼容；接入 Supabase 后应在 **同一代码路径** 上收敛为：要么由 SDK 同步读 session、要么在 `getSession`/`getCurrentUser` 的异步流中统一，避免双真源。

---

## 7. 前端不应该保存什么

**前端不保存：**

- 明文密码
- 任何形式的 **`passwordHash`** 或与密码等价的可验证串（由服务端/Auth 服务处理）
- 可逆或长期有效的**访问令牌/刷新令牌**的明文（若 SDK 使用 secure storage，以 SDK/浏览器机制为准，应用层不自行 `localStorage.setItem`）
- 支付卡号、CVV 等支付敏感信息
- 老师完整收款/税务等 **PII+金融敏感** 的「唯一真源」
- **仅在前端** 做「是否 admin」的**唯一**判定；最多做 UI 隐藏，**授权必须在后端/RLS**

**前端可以保存：**

- UI 语言、主题、侧栏状态
- 最近选择的课程/路由偏好（**非安全关键**）
- 非敏感展示缓存（可失效）
- 由 **官方 SDK 安全管理** 的 session 引用或短期缓存元数据（依平台能力）

---

## 8. 数据表边界初稿

以下为 **逻辑边界** 与命名空间示意；**不表示** 立即建表或已确定 schema。`auth.users` 在 Supabase 中由 **Auth 服务**管理，业务表在 `public`（或其他 schema）中通过 `user_id` 关联。

| 表 / 区段 | 职责 |
|----------|------|
| **auth.users** | 由认证服务管理：身份标识、鉴权、邮箱等（具体字段以 Supabase Auth 为准） |
| **public.profiles** | 公开展示/业务主档：displayName、avatar、locale 等；**与 auth.users 1:1 或可控扩展** |
| **public.user_roles** | 多角色：多行 (user_id, role) 或等效，支持组合角色 |
| **public.student_progress** | 学生课程/单元/技能进度、错题索引引用等（细节后续建模） |
| **public.course_enrollments** | 报名/权益：与购买或赠送关联后的「可学」关系 |
| **public.teacher_profiles** | 老师业务资料与审核态 |
| **public.teacher_assets** | 老师上传的教材/课件元数据 + Storage 路径/审核状态 |
| **public.purchases** | 购买记录、订单号、与支付网关引用；**以后端/支付 webhook 为真** |
| **public.ai_usage_quotas** | AI 调用额度、周期重置；**消费扣减在服务端/Edge** |
| **public.audit_logs** | 管理端审核、禁用、角色变更、高危操作留痕（可分区/归档） |

表之间以 `user_id`、业务外键、RLS 策略联动；**购课、额度、老师审核** 等一律可追溯到服务端数据。

---

## 9. authStore 未来迁移路线

### Stage 1：当前（已具备）

- `demoLocalAuthProvider` 用于开发/演示
- 生产 `console.warn` 已提示 demo 非跨设备、非正式账号

### Stage 2：接入真实 provider

- 实现 `supabaseAuthProvider`（或命名一致的 real provider 模块）
- `authStore` 根据**环境变量/构建时开关**选择：`demo` | `supabase`；CI/预览可强制 demo
- **保留** `demoLocalAuthProvider` 作为 **本地与 Storybook/回归** 的 fallback，**不** 作为生产用户来源

### Stage 3：生产关闭 demo 作为「账号体系」

- **Production** 禁止用 `demoLocalAuthProvider` **注册/登录真实用户**（可编译期剔除或运行时拒绝并跳转）
- 所有正式账号仅走 **remote / Supabase** provider
- `localStorage` **只保留** 非敏感 UI 状态；用户身份与业务数据以服务端为准

> **不能把** demo 里 `localStorage` 的账号**迁移**为正式生产账号（无邮箱验证、无统一 id、无合规路径）；仅可做「邀请用户重新在正式环境注册」或运营侧数据迁移设计（新课题）。

---

## 10. 风险与注意事项

- **不能** 把 **demo `localStorage` 账号** 视为可迁移的正式用户；需预期 **重新注册/绑定**。
- **正式上线前** 必须有 **隐私政策、用户条款**（含家长/未成年人若适用）与数据留存说明。
- **角色与权限** 不能仅靠前端；**RLS/后端** 为最终防线。
- **老师上传内容** 必须可审核、可追溯；违规可下架/禁用。
- **购买记录、退款、对账** 以 **支付 provider + 服务端记录** 为准，前端只展示经校验的只读信息。
- **AI 调用额度** 以 **服务端计次/计量** 为准，防抓包与改本地存储。
- **生产** 需禁用**伪造身份**的调试入口（如 dev 切换 teacher 状态类 API 在 prod 中不可用）。

---

## 参考：与现有代码的对应关系

- 统一入口：`ui/auth/authStore.js`
- Demo 实现：`ui/auth/providers/demoLocalAuthProvider.js`
- 占位实现：`ui/auth/providers/remoteAuthProvider.placeholder.js`
- 业务编排与 commerce 同步：`ui/auth/authService.js`（后续按 provider 事件收敛刷新逻辑）

---

*文档版本：Lumina Auth Step 2 · 与 Step 1 适配层设计衔接*
