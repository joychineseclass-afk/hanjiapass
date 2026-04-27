# 汉字学习页（`page.hanja.js`）整理方案（Round 1 · 设计-only）

**角色**: Agent C · Single Page UI Cleanup  
**日期**: 2026-04-27  
**范围**: 仅 **`ui/pages/page.hanja.js`** 的后续可落地改造方案；**本轮未修改**任何源文件、样式或 i18n 资源。

---

## 1. §1 现状盘点

### 1.1 路由与 hash

- **BASE**: `#hanja`
- **查询参数**: `tab`（`basic3000` | `oracle` | `korean-test`）、`level`（1–6，仅 `basic3000` 有效）
- **默认归一**: `queueMicrotask` 后若缺 `level` 且 tab 为 basic3000，则 `navigateTo(#hanja?tab=basic3000&level=1, { force: true })`

### 1.2 DOM 与布局（已符合导航规范骨架）

页面已使用：

- `.page-shell.page-shell--resource`
- `aside.section-side-nav`（左侧）
- `main.section-main-panel`（右侧）
- 二级：`button.section-side-nav-item.level-2` + `data-hanja-nav`
- 三级：`button.section-side-nav-item.level-3.hanja-level-item` + `data-hanja-level`，包在 `[data-hanja-level-wrap]` 内（非 basic3000 时 `hidden`）

**结论**: 与 `docs/lumina-page-navigation-guideline.md` 的「左栏二/三级 + 右主面板」**在结构上已对齐**，Round 2 更可能是 **信息架构补全** 与 **视觉微调**，而非从零搭壳。

### 1.3 对外接口

- `export function mount()`
- `export function unmount()`
- `export default { mount, unmount }`

**约束**: Round 2 改动须保留上述导出，避免破坏 `router` 约定。

### 1.4 已使用的 i18n key（来自代码通读）

| 用途 | key |
|------|-----|
| 侧栏标题 | `hanja.side_nav_label` |
| 二级 tab | `hanja.nav.basic3000`, `hanja.nav.oracle`, `hanja.nav.koreanTest` |
| 三级 level 标签 | `hanja.basic3000.level1` … `level6` |
| 右栏标题/描述（basic3000） | `hanja.basic3000.level1Title` … `level6Title`, `hanja.basic3000.levelDesc`（含 `{count}`） |
| 右栏标题/描述（oracle / korean-test） | `hanja.oracle.title`, `hanja.oracle.desc`, `hanja.koreanTest.title`, `hanja.koreanTest.desc`（通过 `hanjaSectionContentKeys`） |

### 1.5 `lang/cn.json` 中 **已存在但未在页面使用** 的 `hanja.*` 文案（节选）

来自 `lang/cn.json` `hanja` 命名空间：

- `title`, `lead`
- `card_levels_title`, `card_levels_desc`
- `card_vocab_title`, `card_vocab_desc`
- `card_quiz_title`, `card_quiz_desc`
- `section_vocab`, `section_compare`
- `coming_soon`, `coming_soon_detail`, `compare_placeholder`

以及 `basic3000.title` / `basic3000.desc`（与当前右栏用的 `level{n}Title` + `levelDesc` **并存**）

**观察**: 语言包已为一组更丰富的「卡片/分区」预留文案，但 **当前页未挂载**，属于 **产品信息架构缺口**，不是单纯 CSS 问题。

---

## 2. §2 目标结构（Round 2 提案 · 待人工批准）

### 2.1 方案 A（保守 · 推荐作第一轮落地）

- **保持**现有 3 个二级 tab + basic3000 下 6 级三级导航不变。
- **右栏增强**：在 `levelDesc` 下增加静态区块（不碰引擎）：
  - 展示 `hanja.lead`（全页引言）
  - 展示 `coming_soon_detail` 或 `card_vocab_desc` 等 **一段**辅助说明（择一，避免右栏过长）
- **左栏**：可选增加 `aria-expanded` / 键盘焦点顺序（a11y），不改视觉层级。

### 2.2 方案 B（扩展 · 工作量大，需 Chief 另批）

- 将 `card_levels_* / card_vocab_* / card_quiz_*` 做成 **四级导航** 或 **右栏内 Tab**。
- 风险：与 `#hanja` hash 约定冲突，需设计新 query（如 `section=vocab`），**router 级协调**（超出单文件小改）。

### 2.3 Hash 兼容

- **必须保留**: `#hanja`, `#hanja?tab=basic3000`, `#hanja?tab=basic3000&level=N`, `#hanja?tab=oracle`, `#hanja?tab=korean-test`
- 若引入新参数，须列 **旧链→新链** 映射表（Round 2 设计文档中给出）。

---

## 3. §3 i18n 缺 key / 键名对齐清单（**仅记录 · Round 2 交 Agent B**）

当前页使用的 key 形如 `hanja.nav.basic3000`，而 `lang/cn.json` 嵌套为 `hanja.nav.basic3000`（对象字段名 `basic3000`）。**需验证** `ui/i18n.js` / `core/i18n` 的扁平化规则是否将二者对齐为同一点查路径。

| 议题 | 行动 |
|------|------|
| 点查路径是否一致 | Round 2 在浏览器四语下各点一次侧栏 + 三级，确认无 **裸 key** |
| 若发现裸 key | 由 Agent B 在 `lang/*.json` **或** 引擎映射层修（**不由 C 静默加 key**） |

**若采用方案 A 右栏增强**，可能需 **新增**（或复用）下列 key 的四语版本 — **须 Pending Approval**：

| 建议 key（扁平） | 用途 |
|------------------|------|
| `hanja.right_panel.lead` | 是否单独抽离 `lead`（或继续用 `hanja.lead`） |
| `hanja.right_panel.footer_note` | 底部「即将上线」说明 |

（**仅为命名建议**；最终 key 由 B 统一命名规范。）

---

## 4. §4 对核心模块的零改动承诺（Round 2 仍适用）

- 不改 `ui/router.js`, `ui/app.js`, `ui/core/**`, `ui/platform/**`, `ui/auth/**`, `ui/lumina-commerce/**`
- 不改 `ui/components/sideSectionNav.js` 的导出 API（若仅消费现有 helper，可讨论极小补丁 — 须 Chief 批准并避免与 B 文件冲突）
- 不改 `data/courses/**`

---

## 5. §5 落地工时与回归清单（供 Round 2）

| 项 | 估计 |
|----|------|
| 方案 A 编码 | 0.5–1.5 人日（视 i18n 验证复杂度） |
| 方案 B | 3+ 人日（hash / 信息架构 / 多屏文案） |

**回归用例**

1. `#hanja` 冷启动 → 是否自动落到 `basic3000&level=1`
2. 切换 oracle / korean-test → 三级是否隐藏，右栏文案是否正确
3. `joy:langChanged` × 4 语言 → 侧栏与右栏是否同步
4. 移动端窄屏 → 侧栏是否可滚动、按钮可点按区域足够

---

## 6. Round 1 完成声明

- **新建**: `docs/page-hanja-cleanup-plan-2026-04-27.md`
- **未修改**: `ui/pages/page.hanja.js` 及所有其他仓库文件
