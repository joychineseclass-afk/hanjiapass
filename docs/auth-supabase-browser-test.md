# Supabase 浏览器与部署环境联调指南（Lumina Auth Step 4）

> 本仓库的 AI 不能替你完成 Supabase 控制台操作或本机/线上浏览器实点；**下列清单供你在本地与 Vercel 上自测**。

## 1. 测试前准备

- [ ] 已拥有 Supabase 项目（[Dashboard](https://supabase.com/dashboard)），或计划新建「Lumina」项目。
- [ ] 已记录 **Project URL** 与 **anon public** key（**不要**在 Git 中提交 key；仅 Vercel / 本地 `window.__LUMINA_ENV__` / `.env.local`）。
- [ ] 确认未将 **service_role** key 写进任何前端或仓库；前端仅使用 **anon** key。

## 2. 环境变量配置方式

读取顺序（`ui/integrations/supabaseClient.js`）：

1. `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（若通过 Vite 等注入）
2. `process.env.VITE_*`（部分 Node/工具链场景）
3. `globalThis.__LUMINA_ENV__.VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`（**无打包的静态** `index.html` 最常用）

本地可复制 `.env.example` 为 **`.env.local`**（已列入 `.gitignore`），在本地构建工具若支持时生效。

纯静态、无包管理注入时，在 `index.html` 的入口脚本 **之前** 可临时加：

```html
<script>
  window.__LUMINA_ENV__ = {
    VITE_SUPABASE_URL: "https://<project-ref>.supabase.co",
    VITE_SUPABASE_ANON_KEY: "<anon public key only>"
  };
</script>
```

> 将含真实 key 的 HTML 片段提交到公共仓库＝**禁止**。

## 3. Supabase 控制台设置

建议最少完成：

1. **Authentication** → **Providers** → **Email** 打开。
2. 密码登录可用（同页「Enable Email provider」/密码策略以控制台为准）。
3. **项目设置** 中拿到 **URL** 与 **anon** key（API → Project API keys → `anon` `public`）。

### 邮箱确认：方案 A / B

| 策略 | 操作 | 预期 |
|------|------|------|
| **A. 联调时关闭** | Auth → 关闭「Confirm email」类选项（文案随控制台版本变） | 注册后常立即有 `session`，前端可走完整登录流 |
| **B. 接近生产** | 开启确认 | 注册后无 `session`，返回 `email_not_confirmed`；需用户进邮箱点链接，后再登录 |

**当前建议（开发期）**：先按 **A** 跑通，上线前再切 **B** 并调邮件模板。

## 4. 本地测试步骤

1. 配好 `VITE_*` 或 `window.__LUMINA_ENV__` 后，用静态服务器或当前开发方式打开站点。
2. 打开 **开发者工具 → Console**。
3. 未配 Supabase：应见 `[Lumina] … demo local auth` 类 `console.warn`；`authStore` 回退到 **demoLocalAuthProvider**。
4. 已配全：同一会话中 **不应** 长期依赖 demo 警告（除非你显式 `VITE_LUMINA_AUTH_USE_DEMO=1`）。

### 带 Supabase 的交互清单

- [ ] 打开 `#auth-login` / `#auth-register`，`authStore.getType?.()` 或 Network 中行为体现 **supabase** 路径（代码侧 `getActiveProvider().type`）。
- [ ] 注册新账号（方案 A 下通常可直接进入「已登录」流）。
- [ ] 登录后刷新页面，仍保持已登录（Supabase 客户端持久化 session）。
- [ ] 新开同域标签，应能识别同一会话；在一标签 **登出** 后，另一标签经 `onAuthStateChange` + 全站 `emit` 应同步为未登录或刷新后一致。
- [ ] 错误用例：错误密码、未注册邮箱、**邮箱未确认**（方案 B）、断网/拦截请求，页面应通过 `res.code` 显示**可读文案**（见 `lang/*` 中 `auth.error.*`），而非裸 `Error` 对象。

## 5. Vercel 测试步骤

1. **Project → Settings → Environment Variables** 添加：
   - `VITE_SUPABASE_URL`（Production、Preview 按需分别填，通常同一项目可共用；也可 Preview 用测试项目）。
   - `VITE_SUPABASE_ANON_KEY`（**仅 anon**）。
2. **不要**在 Production 长期设置 `VITE_LUMINA_AUTH_USE_DEMO=1`（会强制仅 demo 认证并触发控制台警告）。
3. 重新 **Deploy** 后打开线上 URL，重复「本地带 Supabase」与「多标签/登出」检查。
4. 无 Supabase 时：应出现 **类部署** 提示（`[Lumina] DEPLOY: …`）及登录/注册页**黄色条**（见 `isLuminaAuthProductionSupabaseOff` 等，非 localhost 即视为可公开部署）。

> 若部署为**纯静态**且无构建注入 `import.meta.env`，务必通过 **Vercel 的 Build 时替换** 或 **入口 HTML 注入** `__LUMINA_ENV__`，否则浏览器读不到 Vercel 后台变量名。

## 6. 邮箱确认开/关 两种结果

- **关（方案 A）**：`signUp` 后常有 `data.session` → 注册+登录可连续；适合联调。
- **开（方案 B）**：`signUp` 后无 `session` → 代码路径返回 `email_not_confirmed`，多语言中已有 `auth.error.email_not_confirmed`；用户需进邮箱，确认后再在登录页用密码登录。

## 7. 常见错误与排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 一直走 demo、无跨端 | URL/Key 未注入到浏览器 | 见 §2 与 Vercel 是否注入到**前端可用**的变量名 |
| `supabase_not_configured` | 被强制 demo 或 env 空 | 检查 `VITE_LUMINA_AUTH_USE_DEMO` 与两变量是否齐 |
| 注册成功但需登录、提示邮件 | 已开邮箱确认 | 按 §6 方案 B 或到控制台关确认 |
| CORS 或 401 异常 | 少数场景 URL 填错 或 项目暂停 | 核对 Project URL 与 key 属同一项目 |
| Production 上黄色条+大量 DEPLOY 警告 | 公网可访问但无 Supabase 配置 | 配置 `VITE_*` 或接受 demo 仅作演示、勿引导真实用户 |

**严禁**：将 `service_role` 放进前端、写死进仓库，或在公开 HTML 中粘贴生产 key。

## 8. 生产 / 部署 保护（实现摘要）

- `warnIfSupabaseEnvMissing`：缺 env 时至少 warn 一次（本地为 `[Lumina] `，**非本机 host** 为 `[Lumina] DEPLOY: `）。
- `warnIfProductionAuthMisconfiguration`：在 **类生产** 或 **非 localhost** 下，对「未配 Supabase」或「`VITE_LUMINA_AUTH_USE_DEMO=1`」**额外** `console.warn`。
- 登录/注册页：若 `isLuminaAuthProductionSupabaseOff` 或 `isLuminaAuthProductionDemoForcedByEnv` 为真，显示 **非阻断** 黄色说明条（`auth.production_supabase_off` / `auth.production_demo_forced`）。

不拦截全站提交，仅**明显提示**风险。

## 9. 最终验收 checklist

- [ ] 未配 Supabase：能 fallback **demo**；Console 有明确 **warning**；业务可继续用 demo 登录自测。
- [ ] 已配全：`getActiveProvider().type === "supabase"`，注册/登录/登出、刷新、多标签（含登出传播）可接受。
- [ ] 错误类场景均有**可读** `res.code` 与 i18n 文案，无裸 `throw` 到 UI。
- [ ] 公开/类生产部署且未接 Supabase 时：**Console 警告 + 黄条** 已出现（避免误把 demo 当正式用户）。
- [ ] 仓库**无**真实 anon key 提交，**无** service_role 泄露。

---

*文档版本与 Step 3 的 `supabaseAuthProvider` / `authStore` 行为一致；若你后续增加构建管道，在本文 §2 补充「构建时注入 `import.meta`」的一节即可。*
