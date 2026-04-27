# 文化 · 成语模块数据规范

## 1. 数据文件结构

```
data/culture/idioms/
  idioms-index.json
  idioms-basic-001.json
  idioms-basic-002.json
  …
```

- `idioms-index.json`：目录索引，**不得**内嵌完整学习正文。
- `idioms-basic-00x.json` 等：分文件保存成语**详情**（可随批次拆分，便于懒加载与缓存）。

## 2. index 文件职责

`idioms-index.json` 为数组，每条表示左侧三级导航中的一项，结构示例：

```json
{
  "id": "idiom_0001",
  "idiom": "画蛇添足",
  "pinyin": "huà shé tiān zú",
  "file": "idioms-basic-001.json",
  "theme": ["寓言", "做事", "智慧"],
  "difficulty": 1
}
```

### 必填字段

| 字段         | 说明           |
| ------------ | -------------- |
| `id`         | 全库唯一，与详情中一致 |
| `idiom`      | 成语汉字       |
| `pinyin`     | 带声调、与详情一致     |
| `file`       | 详情 JSON 文件名（相对 `data/culture/idioms/`） |
| `theme`      | 主题标签数组   |
| `difficulty` | 难度，数字     |

**禁止**在 index 中放入长故事、多语释义大段等（仅目录与路由元数据）。

## 3. detail 文件职责

详情文件为数组，单条为完整学习内容。

### 每条必填

| 字段 | 说明 |
|------|------|
| `id` | 与 index 中对应项一致 |
| `idiom` | 与 index 一致 |
| `pinyin` | 与 index 一致 |
| `chineseExplanation` | 中文解释（阅读用正文） |
| `chineseExplanationPinyin` | 对应中文解释的拼音，小写、带声调、标点可保留；`ü` 保持正确（如 lǜ） |
| `meaning.cn` / `kr` / `en` / `jp` | 多语释义 |
| `example.cn` / `kr` / `en` / `jp` | 多语例句 |
| `examplePinyin` | 例句拼音 |

### 可选字段

- `storySource`：`cn` / `kr` / `en` / `jp`（**当前页不直出**，可留作 AI 上下文）
- `story`：同上
- `tags` / `source` / `note` 等扩展

**说明：**

- 故事类字段不默认展示，避免大段静态区占位。
- 本模块**不做**练习题、测验、错题、分数、进度等教学测评数据。

## 4. 页面显示规则

成语详情页仅展示（与 `page.culture.js` 一致）：

1. 成语、标题行拼音（来自详情 `pinyin`）
2. **释义**：`chineseExplanation` → `chineseExplanationPinyin` → 系统语言 `meaning[lang]`
3. **例句**：`example.cn` → `examplePinyin` → 系统语言 `example[lang]`
4. **AI 讲解**按钮（coming soon，不接真实故事正文）

不展示 `storySource` / `story` 的静态大段（除非后续产品单独开页）。

## 5. 禁止项

- 在 index 中塞入全部详情正文。
- 在 detail 中引入 `quiz`、`exercise`、与 `score` / `progress` / `wrongQuestions` 等测评/进度类字段做文化强依赖（本模块不承载；若仅警告级出现在数据中，以检查脚本提醒）。
- 默认展开文化页左侧全部分类三级导航由产品交互决定，**不得**为展示数据在 index 中堆量。

## 6. 质量检查

根目录执行：

```bash
npm run check:culture-idioms
```

脚本校验 index 与 detail 的字段、一致性与禁止字段提示，详见 `scripts/check-culture-idioms.mjs`。
