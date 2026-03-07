# Practice Generator v2 - 题型蓝图表

Lumina 平台级自动出题引擎，严格遵循题型蓝图，确保题型稳定、问法统一、选项逻辑正确。

## 一、题型总原则

1. **统一输出**：`type: "choice"`，通过 `subtype` 区分真实题型
2. **每题必备**：明确题干、正确答案、合理干扰项、多语言 explanation、source
3. **语言规则**：KR/CN/EN 模式题干和解释跟随系统语言；中文原文保留在 prompt，拼音尽量保留

## 二、标准题型表

### A 类：词义识别类

| subtype | 用途 | 来源 | 适用 |
|---------|------|------|------|
| vocab_meaning_choice | 给中文词，选正确意思（选项为目标语言） | vocab | HSK1~9 |
| meaning_to_vocab_choice | 给意思，选正确中文 | vocab | HSK1~4 |
| pinyin_to_vocab_choice | 给拼音，选正确中文 | vocab | HSK1~3 |

### B 类：对话理解类

| subtype | 用途 | 来源 |
|---------|------|------|
| dialogue_response_choice | 根据一句对话，选最合适的回答 | dialogueCards |
| dialogue_meaning_choice | 给短句对话，选正确意思 | dialogueCards |
| dialogue_detail_choice | 根据对话内容回答细节问题 | dialogueCards |

### C 类：语法应用类

| subtype | 用途 | 来源 |
|---------|------|------|
| grammar_fill_choice | 填空选词 | grammar + vocab |
| grammar_pattern_choice | 根据语法点选正确句子 | grammar |
| grammar_example_meaning | 给语法例句问意思 | grammar.examples |

### D 类：语序/句型类

| subtype | 用途 | 来源 |
|---------|------|------|
| sentence_order_choice | 给乱序词，选正确句子 | dialogueCards / grammar |
| sentence_completion_choice | 给半句，选能构成正确句子的后半句 | dialogueCards |

### E 类：扩展表达类

| subtype | 用途 | 来源 |
|---------|------|------|
| extension_meaning_choice | 扩展表达词义识别 | extension |
| extension_usage_choice | 判断扩展表达适合的场景（HSK2+） | extension |

### F/G 类：未来预留

- **F1** mixed_review_choice：综合小测
- **F2** weak_point_review_choice：错题复习
- **G** listening_choice, drag_reorder, typing_fill, ai_roleplay_check, shadowing_repeat

## 三、按等级推荐组合

| 等级 | 题量 | 组合 |
|------|------|------|
| HSK1/2 | 5 | vocab_meaning + meaning_to_vocab + dialogue_response + grammar_fill + extension |
| HSK3/4 | 10 | 3 vocab + 2 dialogue + 2 grammar + 2 sentence_order + 1 extension |
| HSK5/6 | 15 | 5 vocab + 4 dialogue + 3 grammar + 3 extension |
| HSK7~9 | 20 | 6 vocab + 5 dialogue + 4 grammar + 5 extension |

## 四、标准输出模板

```json
{
  "id": "q_001",
  "type": "choice",
  "subtype": "dialogue_response_choice",
  "source": "dialogueCards",
  "question": { "zh": "...", "kr": "...", "en": "..." },
  "prompt": { "zh": "...", "pinyin": "...", "kr": "...", "en": "..." },
  "options": [
    { "key": "A", "zh": "...", "pinyin": "...", "kr": "...", "en": "..." }
  ],
  "answer": "A",
  "explanation": { "zh": "...", "kr": "...", "en": "..." },
  "meta": { "lessonId": "...", "generator": "practice-generator-v2" }
}
```

## 五、干扰项规则

- **vocab**：同课词 → 同类词 → 易混淆词 → 同课 extension
- **dialogue**：同课其他回答句、场景不匹配但语法正确的句子
- **grammar**：词性相近、表面像对但语法不对

## 六、禁止事项

- 题干问「意思」选项却全是中文近义词
- 同一题中中韩英混乱拼接
- 填空位置与词性不匹配
- 对话理解正确答案无法从对话推出
- 干扰项与正确答案重复
- explanation 只重复题干无解释价值

## 七、模块结构

```
ui/platform/practice-generator/
├── index.js
├── generatorConfig.js
├── generatorUtils.js
├── distractorBuilder.js
├── questionNormalizer.js
├── practiceGeneratorV2.js
├── vocabQuestionGenerator.js
├── dialogueQuestionGenerator.js
├── grammarQuestionGenerator.js
└── extensionQuestionGenerator.js
```

## 八、验收 lesson

- **lesson1**：打招呼类题目自然
- **lesson7**：日期类题目不混乱
- **lesson18**：购物类题目场景明确
