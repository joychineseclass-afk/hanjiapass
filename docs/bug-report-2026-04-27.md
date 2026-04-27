# Lumina 只读巡检报告（Round 1）

**角色**: Agent D · Bug Report  
**日期**: 2026-04-27  
**分级规则（本轮严格执行）**  

| 级别 | 定义 |
|------|------|
| **fatal** | 仅当：**页面无法打开**、**数据无法加载**、**已证实的 i18n key 丢失导致 UI 不可用**、**JSON 解析失败 / 校验脚本以数据损坏退出** 等 |
| **warning** | 影响体验、可维护性或一致性，但**不**单独阻断站点启动 |
| **info** | 观察项、环境依赖、建议性改进 |

> `console.error` / `TODO` / `FIXME` / 硬编码中文 **默认不是 fatal**，除非已证明其直接导致上述阻断条件。

---

## 1. 环境快照（请本地补全）

以下字段 **须** 在本地终端填写（本 Agent 环境无法可靠执行 `git` / `node` 并回传 stdout）：

| 字段 | 值（待填） |
|------|------------|
| `git rev-parse HEAD` | |
| `git status --porcelain` | |
| `node -v` / `npm -v` | |

---

## 2. 校验脚本（请在仓库根目录执行并粘贴输出）

**说明**: 本节 **当前无脚本 stdout**。下列命令 **全部** 应由人工或 CI 跑完后，将完整输出追加到本文档 §2 附录。

```bash
cd C:\Users\kindh\Documents\GitHub\hanjiapass

npm run check:dictionary
npm run check:hsk30-hsk1
npm run check:hsk1-vocab-targets
npm run check:hsk1-mixed-language
npm run check:hsk1-lesson-metadata
npm run check:hsk1-practice
node scripts/check-hsk1-dialogue-coverage.mjs
npm run check:dialogue-quality
npm run check:pinyin
npm run check:word-pool
npm run check:culture-idioms
node scripts/network-verify.mjs
```

### 2.1 脚本分级指引（粘贴输出后据此标注）

| 脚本 | 典型 **fatal** 条件 | 典型 **warning** |
|------|---------------------|------------------|
| `check:dictionary` | 进程退出码非 0；`failMissing` / `failMismatch` 列表非空 | `warnings.components`、`cedictReview` 计数 |
| `check:hsk30-hsk1` 等 | 退出码非 0（以脚本为准） | 非 strict 模式下的软警告 |
| `network-verify.mjs` | 依赖 `playwright` + 本地 server；**未运行不构成 fatal** | 跳过原因记为 info |

---

## 3. 静态扫描结果（实得）

### 3.1 `console.error`（**warning**）

在 `ui/pages/**/*.js` 中至少存在以下引用（**计数为工具命中次数，非运行时调用次数**）：

| 文件 | 命中 |
|------|------|
| `ui/pages/page.hsk.js` | 2 |
| `ui/pages/hsk/hskLessonLoad.js` | 2 |
| `ui/pages/page.classroom.js` | 1 |
| `ui/pages/page.kids1.js` | 1 |

**判定**: **warning** — 需代码审确认是否在错误路径上静默失败；**非**自动 fatal。

### 3.2 `TODO` / `FIXME`（**info**）

- 在 `ui/**/*.js` 快速检索 **未发现** `TODO` / `FIXME` 命中（**不代表**全仓为零；仅 ui 树抽样）。

**判定**: **info**。

### 3.3 硬编码中文（**warning**）

对 `ui/pages/**/*.js` 与 CJK 正则的粗扫显示 **多文件** 含汉字（含 **注释**、字符串、数据片段）。文件级命中数见下（**部分命中可能来自注释或合法数据**）：

| 文件（节选） | 工具报告命中数 |
|--------------|----------------|
| `page.kids1.js` | 55 |
| `page.home.js` | 37 |
| `hsk/hskLessonLoad.js` | 34 |
| `page.speaking.js` | 18 |
| `page.catalog.js` | 19 |
| `page.hsk.js` | 16 |
| `page.classroom.js` | 12 |
| `page.dictionary.js` | 11 |
| `page.teacher.js` | 10 |
| `page.hanja.js` | 2（注释） |

**判定**: **warning** — 需结合 i18n 规范判断是否违规；**非**自动 fatal。

### 3.4 依赖与运行时（**info**）

- `scripts/network-verify.mjs` 使用 **Playwright**；未安装浏览器驱动或未启动静态服务器时 **跳过**，记 **info**。

---

## 4. 综合结论（当前可写部分）

| 级别 | 数量 | 摘要 |
|------|------|------|
| **fatal** | **0（已确认）** | 本轮 **未** 执行校验脚本、**未** 做浏览器运行时验证；**不得**将「未跑」解释为「无问题」 |
| **warning** | ≥3 类 | `console.error` 命中；广分布硬编码中文需 i18n 审计 |
| **info** | 若干 | `network-verify` 环境依赖；TODO/FIXME 未检出 |

---

## 5. 建议 Owner（供 Chief Agent 派发 Round 2）

| 条目 | 建议 Owner |
|------|------------|
| 校验脚本失败（若出现） | Agent A（数据）/ 课程数据专员 |
| `ui/i18n` jp 缺失、双轨 i18n | Agent B |
| `page.hanja` 信息架构补全 | Agent C |
| `console.error` 错误路径 | 原功能 Owner + 测试 |

---

## 6. Round 1 完成声明

- **新建**: `docs/bug-report-2026-04-27.md`
- **未修改**: `ui/**`、`data/**`、`lang/**`、`scripts/**`、`package.json`、`.github/**`
- **未执行**: `git push`、PR、合并

---

## 7. Round 2 · H10 质量门（Agent D · 2026-04-27 追加）

**依据**: `docs/round2-p0-decisions-2026-04-27.md`（H10 最低检查集 1–6）。

### 7.1 CLI（四项）

| # | 命令 | Agent 侧结果 |
|---|------|----------------|
| 1 | `npm run check:dictionary` | **未捕获** stdout/stderr/退出码（见主报告） |
| 2 | `node scripts/check-hsk30-hsk1.mjs` | **未捕获** |
| 3 | `node scripts/check-culture-idioms.mjs` | **未捕获** |
| 4 | `node scripts/check-pinyin-needed.mjs` | **未捕获** |

**主报告**: `docs/round2-quality-gate-2026-04-27.md`（含本地 PowerShell 一次性捕获脚本、§4 粘贴区、浏览器清单、**Agent C 闸门结论**）。

### 7.2 浏览器（五项 + 四语）

- **未由 Agent 执行**；须在主报告 **§5** 由 **human** 勾选 / 签 off。

### 7.3 综合（截至本追加）

- **通过 / 失败**: CLI 与浏览器均 **待 human 补全** 后方可判定。
- **Agent C（`page.hanja.js` 小改）**: 主报告建议 **暂不批准**，直至 H10 CLI + 浏览器签 off 完成。

---

## 8. 文档变更记录（本节起）

| 日期 | 变更 |
|------|------|
| 2026-04-27 | 追加 §7 Round 2 H10；新建关联 `docs/round2-quality-gate-2026-04-27.md` |
