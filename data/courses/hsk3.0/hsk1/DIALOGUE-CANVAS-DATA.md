# HSK 3.0 · HSK1 会话画布数据规范（简版）

适用于 `page.hsk.js` 中 **HSK3.0 + HSK1** 会话画布模式；与词汇/练习等其它区块独立。

## 顶层 `scene`（可选）

| 字段 | 要求 | 说明 |
|------|------|------|
| `scene.id` | 建议有 | 字符串，标识场景，便于后续扩展。 |
| `scene.title` | **可选** | 多语言对象（至少常用键：`zh`、`kr`、`en`、`jp` 等，与课件一致）。**有则**在会话 Tab 顶部显示**一行**整课场景标题；**无则**不显示该行，不留占位。 |
| `scene.summary` | 不用于画布 | 画布为减轻重复**不展示** `scene.summary`；内容可写在各 `dialogueCards[].summary`。 |

## `dialogueCards[]`

### `title`（建议有）

- 类型：多语言对象或字符串。
- **推荐**：`标签｜短主题`（全角 `｜` 或半角 `|`），展示时优先取**分隔符后半段**为主标题（与左侧 `01/02` 编号搭配）。
- **无分隔符**时：引擎会尝试剥掉常见前缀（如 `会话一`、`Dialogue 1`）；无法识别则**整段原样**作为标题。

### `summary`（可选）

- 类型：多语言对象或字符串。
- **有则**显示在卡片标题下的场景说明；**无则**不渲染说明区，布局仍正常。

### 预留扩展（可选，当前不触发大图与自由排版 UI）

以下字段**已读入并输出为 `data-*`**（或极少量 class），便于日后接场景图、主题与坐标布局；**缺省时不改变现有默认画布外观**。

| 字段 | 类型 | 默认回退 |
|------|------|----------|
| `dialogueCards[].sceneImage` | 字符串 URL | 无则不输出 `data-scene-image`，无图。 |
| `dialogueCards[].bubbleStyle` | 字符串（主题/变体 slug） | 无则不输出 `data-bubble-style`。 |
| `dialogueCards[].lines[].position` | `{ "x": number \| string, "y": number \| string }` | 无或空则不输出坐标；若任一行含 `x`/`y`，卡片根节点增加 `data-layout="free"`（仅占位，当前不据此改 flex 流）。 |
| `dialogueCards[].lines[].align` | `"left"` \| `"right"` \| `"center"`（大小写不敏感） | **无**则仍按行号 **左/右交替**（与 lesson1 试点一致）。`center` 时气泡行居中。 |

**说明**：不接 Gemini / 图片生成 API；`sceneImage` 仅预留属性，不渲染 `<img>`。

### `lines[]`（必填，且非空）

每行**最低建议字段**：

| 字段 | 要求 | 说明 |
|------|------|------|
| `text` | **必填** | 中文正文（或课件使用的 `zh`/`cn`/`line` 等价字段，以加载器合并结果为准）。 |
| `pinyin` | 强烈建议 | 无则按课程设置可能自动推拼音。 |
| `translation` | 强烈建议 | 多语言对象，键与全站一致（如 `kr`、`en`、`jp`）；用于系统语言译文。**译文须自然、像母语教材表述，禁止生硬直译**——见同目录 [`AUTHORING-I18N.md`](./AUTHORING-I18N.md)。 |
| `speaker` | 可选 | 有则显示在气泡内；**可省略**（如旁白一句），省略时不显示说话人一行。 |
| `align` | 可选 | 见上表「预留扩展」。 |
| `position` | 可选 | 见上表「预留扩展」。 |

## 校验清单（接入新课）

- [ ] 至少一张 `dialogueCards` 且每张 `lines.length > 0`
- [ ] 需要整课场景条时提供 `scene.title`；不需要则可省略
- [ ] 需要卡片说明时写 `summary`；不需要可省略
- [ ] `translation` 各语言已按 [`AUTHORING-I18N.md`](./AUTHORING-I18N.md) 人工润色（非机翻直出）
