# Round 2 启动前 · P0 决议文档

**决议日期**: 2026-04-27  
**性质**: 书面决议（H5 / H7 / H10）；用于约束 Round 2 及后续短周期内的 i18n、合并与质量门流程。  
**约束**: 本文档为**新建**；未修改 `ui/**`、`data/**`、`lang/**`、`scripts/**`、`package.json`、CI，亦未改动既有 Round 1 报告、`round1-chief-summary`、`round1-human-checklist`。

---

## H5｜i18n 单一真源决议

- **当前阶段正式四语 UI 文案真源**暂定为 **`lang/{cn,kr,en,jp}.json`**。
- **`ui/i18n/*.json`** 暂作为**待迁移资源**，**不在本轮大规模扩写**。
- **`ui/i18n.js`** **暂不修改**，避免破坏旧链路。
- **后续**如需统一 i18n 架构，必须**另开专项迁移任务**，**不混入**页面 UI 收口任务。

---

## H7｜译文覆盖签字规则

- **新增 key**：可以由 Agent B 提供四语草稿，但必须列入**人工确认表**。
- **修改既有** cn / kr / en / jp 译文时，必须逐条列出：**key、语言、原值、建议值、理由、confidence、审核状态**。
- **未经人工确认**，**不允许**静默覆盖既有译文。

---

## H10｜质量门与签 off

| 角色 | 职责 |
|------|------|
| **Cursor Agent D** | 负责提供**检查报告**（汇总脚本结果与手动检查结论，可写入 `docs/` 指定报告文件）。 |
| **human** | 负责**最终签 off**。 |
| **G宝** | **辅助**判断风险与下一轮任务范围。 |

### 最低检查集（Minimum Gate）

1. `npm run check:dictionary`
2. `node scripts/check-hsk30-hsk1.mjs`
3. `node scripts/check-culture-idioms.mjs`
4. `node scripts/check-pinyin-needed.mjs`
5. **浏览器手动检查**路由：`#hanja` / `#dictionary` / `#culture` / `#hsk` / `#teacher`
6. **四语切换** cn / kr / en / jp：**不出现** `undefined`、**裸 key**（界面不应回退为 key 名字符串）

---

## Round 2 启动裁定（Chief Agent 输出区）

### 1. H5 / H7 / H10 是否已通过

| 决议项 | 状态 | 说明 |
|--------|------|------|
| **H5** | **已通过** | 以本文档「H5｜i18n 单一真源决议」为准，真源定为 `lang/*`。 |
| **H7** | **已通过** | 以本文档「H7｜译文覆盖签字规则」为准，合并前须满足逐条确认。 |
| **H10** | **已通过（流程）** / **签 off 待 human** | 流程与最低检查集以本文档为准；**具体一轮运行的脚本输出与浏览器结论**仍须由 Agent D 汇总后由 **human 签 off**。 |

### 2. 是否允许启动「真正」Round 2

**允许**，条件如下：

- 一切文案与四语改动**优先**落在 **`lang/{cn,kr,en,jp}.json`**，并遵守 **H7**。
- **不**对 `ui/i18n/*.json` 做大规模扩写，**不**改 `ui/i18n.js`（与 **H5** 一致）。
- 合并前满足 **H10** 最低检查集，并由 **human** 完成当次 **签 off**。

### 3. 若允许，建议第一个动手的 Agent 是谁

**Agent D（优先）**：先跑 **H10 最低检查集**、汇总报告，供 **human** 与 **G宝** 评估；**通过后再**由 **Agent B** 在 `lang/*` 上按 **H7** 做小步、可审阅的改动。

（若当前仓库状态已明确「检查全绿」且仅需补文案，可与 human 约定由 **Agent B** 并行准备签字表草稿，但**仍以 D 报告 + human 签 off 为合并闸门**。）

### 4. 第一个 Round 2 任务允许修改哪些文件

在遵守 H5/H7/H10 的前提下，**首包任务**建议白名单：

- **`docs/**`**：检查报告、签字表、任务说明（含 Agent D 输出）。
- **`lang/cn.json`、`lang/kr.json`、`lang/en.json`、`lang/jp.json`**：仅针对**已列入人工确认表**且**已批准**的 key（Agent B）。

*若首包任务仅为「质量门」，则本轮可**仅**动 `docs/**`（报告归档），不动 `lang/*`。*

### 5. 禁止修改哪些文件（与 H5 对齐的硬边界）

- **`ui/i18n/*.json`**：禁止**大规模扩写**；非经专项迁移任务，不视为 Round 2 主战场。
- **`ui/i18n.js`**：**禁止修改**（本轮）。
- **`data/**`**：禁止（**另有授权的词典/课程任务除外**，且须单独 Chief 批条；默认不包含在首包）。
- **`scripts/**`、`package.json`、CI workflow**：禁止。
- **核心结构**（除非单独专项）：`ui/router.js`、`ui/app.js`、`ui/core/**`、`ui/platform/course-engine/**`、`ui/auth/**`、`ui/lumina-commerce/**` 等——**禁止大面积重构**。
- **HSK3.0 已人工校对的 `dialogueCards` / 对话正文**：禁止自动改写。

---

## 本文档元信息

- **新建**: `docs/round2-p0-decisions-2026-04-27.md`
- **未修改**: 生产代码路径及既有 Round 1 / checklist / summary 文档
