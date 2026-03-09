# Lumina Practice Engine

## 出题策略（学生端 HSK1~4）

- **choice 选择题为主**：约 82~85%
- **fill / match / order**：少量补充，每课各最多 1 题
- **不使用自由问答题**

## 题干模板（practiceTemplates.js）

| 模板 Key | 用途 | 示例 |
|----------|------|------|
| `LISTENING` | 听音选择 | 请听音，选择正确的词语。 |
| `NATIVE_TO_ZH` | 母语→中文 | 「감사합니다」에 해당하는 중국어는? |
| `ZH_TO_MEANING` | 中文→意思 | 「谢谢」的意思是？ |
| `MEANING_TO_ZH` | 意思→中文 | 「감사합니다」用中文怎么说？ |
| `PINYIN_TO_ZH` | 拼音→中文 | 根据拼音「xièxie」选择正确的词语。 |
| `SENTENCE_BLANK` | 句中填空选择 | 他___中国人。 |
| `SENTENCE_ORDER` | 语序选择 | 下面哪一句顺序正确？ |
| `DIALOGUE_RESPONSE` | 对话回应 | 「你好吗？」的回答是什么？ |
| `EXTENSION_MEANING` | 扩展表达词义 | 「您好」的意思是？ |
| `MATCH` | 配对题 | 请将中文与对应翻译配对。 |
| `ORDER` | 排序题 | 请将下列词语按正确语序排列。 |

## 题干规范

1. **避免不自然表达**：不用「哪个是谢谢」「谢谢是哪个」
2. **听音题**：有 `hasListen`/`listen`/`audioUrl` 时，题干自动用 LISTENING
3. **母语→中文**：用 NATIVE_TO_ZH，如「'감사합니다'에 해당하는 중국어는?」
4. **词义识别**：用「表示『感谢』的词语是？」而非「谢谢是哪个」

## 老师端（预留）

`practiceStrategy.getTeacherStrategy(opts)` 预留接口：

- `questionCount`：可选题量
- `types`：可选题型（choice / fill / short answer）
- `sources`：可按词汇/语法/会话生成
- `allowShortAnswer`：是否允许简答题
