# 字典数据规范（Dictionary Data Guideline）

本说明配合 `data/dictionary/` 内 JSON 与 `scripts/check-dictionary-data.mjs` 使用，用于后续扩展时保持结构一致。

## 1. 目录结构

```text
data/dictionary/
  dictionary-index.json      # 唯一索引，不放长释义的正文堆叠
  hanzi-basic-001.json         # 单字详情分片
  words-basic-001.json         # 词语详情分片
  words-cedict-001.json        # 后续可能：CC 风格小切片
  hanzi-3000-001.json         # 后续可能：大字符集分片
```

- 新分片在 `dictionary-index.json` 中只登记 `id`、`type`、`query`、`pinyin`（检索用简字段）、`file` 等，长文本进对应 `file`。

## 2. `dictionary-index.json` 职责

只做**索引**，不放长释义正文。

### 2.1 单字（`type: "char"`）

```json
{
  "id": "hanzi_4eba",
  "type": "char",
  "query": "人",
  "char": "人",
  "pinyin": "rén",
  "file": "hanzi-basic-001.json"
}
```

- `query` 必须与 `char` 相同，且为**单个** CJK 统一表意文字（基本区 `\u4e00–\u9fff`）。
- 详情在 `file` 指向的 JSON 中按 `id` 查找。

### 2.2 词语（`type: "word"`）

```json
{
  "id": "word_0001",
  "type": "word",
  "query": "学习",
  "word": "学习",
  "pinyin": "xuéxí",
  "file": "words-basic-001.json"
}
```

- `query` 必须与 `word` 相同，且非空。
- 与单字**可以**在字面相同（如 `人` 同时有 char 与 word 条），但 engine 上 **单字查询优先** `char`。

## 3. 单字 detail（`type: "char"`）必填字段

| 路径 | 说明 |
|------|------|
| `id` | 与 index 一致 |
| `type` | 固定 `"char"` |
| `char` | 与 index 一致 |
| `pinyin` | 与 index 一致 |
| `meaning.cn` / `kr` / `en` / `jp` | 四语释义 |
| `teachingNote.cn` / `kr` / `en` / `jp` | 四语学习说明 |
| `commonWords` | 数组，至少按规范为每项补全（可为多条常用词） |

`commonWords[]` 每项建议：

- `word`
- `pinyin`
- `meaning.cn` / `kr` / `en` / `jp`

## 4. 词语 detail（`type: "word"`）必填字段

| 路径 | 说明 |
|------|------|
| `id` | 与 index 一致 |
| `type` | 固定 `"word"` |
| `word` | 与 index 一致 |
| `pinyin` | 与 index 一致 |
| `meaning.cn` / `kr` / `en` / `jp` | 四语释义 |
| `example.cn` / `kr` / `en` / `jp` | 四语例句 |
| `examplePinyin` | 例句拼音（以中文例句为基准） |

建议字段：

- `traditional`：繁体写法（如与简体不同请填写）。

## 5. 禁止项

- 把长解释全文塞进 `dictionary-index.json`（违背索引职责）。
- 省略 `type` 或 `type` 与语义不符（词语录成 `char` 等）。
- 在标准字典 JSON 内混入**练习题 / 学习进度**类字段，例如：  
  `quiz`、`exercise`、`score`、`progress`、`wrongQuestions`（见检查脚本，出现则 **warning**）。
- 把商业词典受版权保护的长内容直接整段抓入本仓库（合规风险）。

## 6. 质量检查

```bash
npm run check:dictionary
```

会校验 index / detail 一致性、字段完整性、词语单字在 index 中是否有 `char` 项（缺则 **warning**）等。详见 `scripts/check-dictionary-data.mjs` 内注释与输出说明。
