# Round 1 · Chief Agent 人工待办合并视图

**生成日期**: 2026-04-27  
**依据**: `docs/cedict-review-sample-2026-04-27.md`、`docs/i18n-audit-2026-04-27.md`、`docs/page-hanja-cleanup-plan-2026-04-27.md`、`docs/bug-report-2026-04-27.md`（**只读引用，本文档未改动上述四份文件**）

---

## 1. 四个 Agent 输出是否合规

| Agent | 文档 | 合规结论 | 依据 |
|-------|------|----------|------|
| **A** | `cedict-review-sample-2026-04-27.md` | **合规** | 全文标明 draft；未升级 `qualityLevel`；样本含 confidence / 风险点；不确定项进待确认清单；未改 `data/**` |
| **B** | `i18n-audit-2026-04-27.md` | **合规** | 只读审计；改动均为 Pending Approval；未改 `lang/**`、`ui/i18n/**` |
| **C** | `page-hanja-cleanup-plan-2026-04-27.md` | **合规** | 仅 `page.hanja.js` 设计；未改 `ui/**`；缺 key 仅记录交 B |
| **D** | `bug-report-2026-04-27.md` | **合规** | fatal/warning/info 定义与约束一致；静态扫描有实得；**未**将 TODO/硬编码中文等一律标 fatal；未改生产文件 |

**总评**: Round 1 四份交付物均符合 Chief 既定边界；**缺口**为：A/D 中「本地脚本 stdout 待粘贴」属**计划内留白**，不视为 Agent 违规，但视为 **human 待补证据**。

---

## 2. 各 Agent 关键发现（浓缩）

### Agent A · Dictionary Data

- 主库 `words-cedict-001.json` 中 **`needsReview: true` 约 95 处**（待 `check:dictionary` 复核）。
- `cedict/words-cedict-001.json` 首部为 **raw + needsReview** 的 CC-CEDICT 全量分片形态。
- **10 条试跑草稿**已写：含符号/紧急号（教学价值低）+ 常见词（中国、学习、老师等）；**「中国」等条目**涉及表述口径，**必须人工**后再谈入库。
- **`check:dictionary` 输出尚未归档**（报告 §1 留空）。

### Agent B · I18N Audit

- **双轨文案**：`lang/*`（四语嵌套）vs `ui/i18n/*` + `ui/i18n/index.js`（**无 jp 合并**）vs `ui/i18n.js` 内联 DICT；**日语路径混用风险**为架构级发现。
- **`ui/i18n` 共 12 个 JSON 模块中，仅 `practice.json` / `review.json` 含 `jp`**；其余 10 个模块 **整文件级缺 jp**。
- **高风险抽样**：`practice_listen` 的 **en 为「Speak」与 jp「発音」语义可能不对齐**（R3）。
- **全量 key diff**（`lang` 扁平化 vs `ui/i18n`）**未做**，留 Round 2 脚本。

### Agent C · Single Page UI（hanja）

- **`page.hanja.js` 已具备** `page-shell` + 左侧二/三级 + 右侧主面板，**与导航规范骨架一致**。
- **缺口**在信息架构：`lang` 中已有 `hanja.title`、`lead`、`card_*`、`coming_soon*` 等 **未在页面上挂载**。
- Round 2 **方案 A（保守）** vs **方案 B（扩展、可能动 router）** 需人工选型。

### Agent D · Bug Report

- **校验脚本列表已列全**，但 **stdout 未粘贴**；**fatal 当前不得视为已关闭**。
- **静态扫描**：`console.error` 分布于 `page.hsk.js`、`hskLessonLoad.js`、`page.classroom.js`、`page.kids1.js`（**warning**）；多页 **硬编码中文粗扫**（**warning**）；`network-verify` 依赖 Playwright（**info**）。

---

## 3. 可进入 Round 2 的事项（建议顺序）

> 前提：**人工批准**对应 Pending 项，且 **补跑** `check:dictionary` 等脚本并确认退出码。

| 优先级 | 事项 | 依赖 |
|--------|------|------|
| P0 | 将 **`npm run check:dictionary` 等输出**粘贴进 `bug-report` §2 与 A 报告 §1 | **human** |
| P1 | **Agent B**：`ui/i18n/index.js` 增加 **jp 槽位**（若产品确认模块化 i18n 仍要使用） | **human** 架构选型 + **B** |
| P1 | **Agent B**：为缺 jp 的 10 个 `ui/i18n/*.json` 模块做 **逐 key 四语补全**（或决定废弃该轨、以 `lang/*` 为真源） | **human** |
| P2 | **Agent A**：在人工圈定样本后，**小批量**（非默认 50）审校入库流程 | **human** + **A** |
| P2 | **Agent C**：按 **方案 A** 增强 `page.hanja.js` 右栏（`hanja.lead` 等），**不**动 router | **human** 批准方案 + **C** |
| P3 | **Agent D / CI**：跑通 `network-verify`（可选） | **human** 环境 + **D** 或 DevOps |

---

## 4. 必须人工确认的事项（合并清单）

| ID | 内容 | 来源 |
|----|------|------|
| H1 | **词典**：`cedict_full_000003`（119）**原始英文释义**核对后再定四语 | A |
| H2 | **词典**：「中国」等 **地理/政治表述口径**（是否出现 PRC、是否脚注） | A |
| H3 | **词典**：是否收录 `%`、是否保留 「(Tw)」等地域标注 | A |
| H4 | **词典**：日语「生徒/学生」及韩日例句风格与全站术语表对齐 | A |
| H5 | **i18n**：**单一真源**——`lang/*` vs `ui/i18n` vs `i18n.js` 长期策略 | B |
| H6 | **i18n**：`practice_listen` / `practice_submit` 等 **en·jp 语义与 UI 习惯**是否修订 | B |
| H7 | **i18n**：任何 **覆盖既有 KR/CN/EN/JP** 须逐条签字 | B |
| H8 | **hanja**：Round 2 采用 **方案 A 还是 B**（B 可能涉及 router） | C |
| H9 | **hanja**：右栏增强若需 **新 key**，命名与四语由 **B** 统一、**human** 批准 | C + B |
| H10 | **质量门**：全套 `check:*` 与 **浏览器四语**回归谁签 off | **human** |

---

## 5. 暂缓事项

| 事项 | 理由 |
|------|------|
| CC-CEDICT **50 条批量**升级 | A 报告明确须先试跑质量与人工圈定 |
| **`page.kids` / `business` / `travel` / `culture` / `speaking` / `stroke` 壳改造** | Round 1 范围仅 hanja 规划 |
| **`ui/i18n.js` 大 DICT 重构** | B 建议 Round 2+ 再议，避免与双轨策略冲突 |
| **`network-verify` 未跑** | 不构成 Round 1 阻塞；环境就绪后再做 |
| **全量 `lang` ↔ `ui/i18n` key diff** | Round 1 未产出；需专用脚本 |

---

## 6. 风险等级（合并视图）

| 领域 | 等级 | 说明 |
|------|------|------|
| 双轨/三轨 i18n 与日语回退 | **high** | 可导致 jp 界面 key 裸露或混语；需架构决策 |
| `practice_listen` 等 en/jp 不对齐 | **high**（产品文案） |  learners 端误解功能；待确认后修 |
| 词典政治/地理表述（「中国」等） | **high**（合规/品牌） | 入库前须定稿 |
| `check:*` 未执行 | **medium** | 数据/课程问题可能被掩盖 |
| `console.error` / 硬编码中文 | **medium** | 维护性与 i18n 一致性；非自动判定为宕机 |
| hanja 方案 B（四级导航） | **medium** | 路由与测试面扩大 |
| cedict 符号/紧急号码词条策略 | **low–medium** | 教学优先级与编辑成本 |

---

## 7. 建议 Owner

| 工作包 | Owner |
|--------|--------|
| 脚本输出归档、发布签核 | **human** |
| 词典试跑定稿、批量规则、合规表述 | **human** + **A** |
| i18n 真源决策、jp 补全、Pending 列表执行 | **human** + **B** |
| `page.hanja` 方案 A/B 落地与回归 | **human** + **C** |
| 巡检模板维护、下一轮 bug 报告 | **D**（或 QA） |
| `check:*` 失败时的数据/课程修复 | **human** 分派 **A** 或课程专员 |

---

## 8. 是否建议进入代码修改阶段

**结论**: **条件具备后可进入，但不应「立即全盘开工」。**

| 条件 | 状态 |
|------|------|
| Round 1 文档齐 | **已满足** |
| `check:dictionary` 等 **本地通过**并归档 | **未满足**（待 human） |
| i18n **真源与 jp 策略**拍板 | **未满足**（待 human） |
| 词典 **入库样本与表述口径**拍板 | **未满足**（待 human） |
| hanja **方案 A/B**选定 | **未满足**（待 human） |

**建议路径**:

1. **human** 先补跑脚本、粘贴输出，关闭或登记 **fatal**。  
2. **human** 对 §4（H1–H10）做 **最小可行**决议（可先只批：i18n 真源 + hanja 方案 A + 词典暂不批量）。  
3. 再开 **Round 2**：优先 **B（i18n）** 与 **C（hanja 方案 A）** 小步 PR；**A** 保持小批量；**D** 更新 bug 报告作为闸门。

---

## 9. 本文档元信息

- **新建**: `docs/round1-chief-summary-2026-04-27.md`  
- **未修改**: `ui/**`、`data/**`、`lang/**`、`scripts/**`、`package.json`、CI workflow、以及 Round 1 四份子报告
