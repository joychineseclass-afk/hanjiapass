# Practice Generator v2

Lumina 平台级自动出题引擎，将「练习题主要依赖手写 JSON」升级为「课程 JSON 提供 vocab/dialogue/grammar/extension → 自动生成题目」。

## 模块结构

```
ui/platform/practice-generator/
├── index.js                 # 导出入口
├── generatorConfig.js       # 题量配置、等级配额
├── generatorUtils.js       # 通用工具（pickLang、shuffle、数据提取）
├── distractorBuilder.js    # 干扰项生成
├── questionNormalizer.js   # 题目标准化
├── practiceGeneratorV2.js  # 主入口
├── vocabQuestionGenerator.js    # 词义选择题
├── dialogueQuestionGenerator.js # 对话理解题
├── grammarQuestionGenerator.js  # 语法填空题
└── extensionQuestionGenerator.js # 扩展表达 + 语序重组
```

## 题型说明

| 题型 | subtype | 来源 | 说明 |
|------|---------|------|------|
| 词义选择 | vocab_meaning_choice | vocab / extension | 题干给中文问意思，或给翻译选中文 |
| 对话理解 | dialogue_response_choice | dialogueCards | A 说了 X，B 应该说什么？ |
| 语法填空 | grammar_fill_choice | grammar + vocab | 挖空选词，展示为 choice |
| 语序重组 | sentence_order_choice | dialogue / extension | 给乱序词块，选正确句子 |

## 题量规则

| 等级 | 目标题量 | 分配建议 |
|------|----------|----------|
| HSK1 / HSK2 | 5 题 | 2 vocab + 1 dialogue + 1 grammar + 1 extension |
| HSK3 / HSK4 | 10 题 | 4 vocab + 2 dialogue + 2 grammar + 2 extension |
| HSK5 / HSK6 | 15 题 | 5 vocab + 4 dialogue + 3 grammar + 3 extension |
| 7~9 级 | 20 题 | 6 vocab + 5 dialogue + 4 grammar + 5 extension |

## 干扰项规则

1. **来源优先级**：同课同类词汇 → 同课其他内容 → 常见混淆词 → 固定保底
2. **干扰原则**：不允许正确答案重复、拼音完全相同、空选项；尽量制造「合理但错误」的选项
3. **HSK1 初级**：避免太偏、太难的干扰项

## 接入点

- **practiceEngine.js**：`loadPractice(lesson)` 内调用 `generateV2({ lesson, lang, level, course, existing })`
- **流程**：有手写题 → 先保留；不足 → 自动补齐；超出 → 按优先级裁剪
- **输出**：统一标准结构，交给 `filterSupportedQuestions` → Practice Renderer

## 已验证 lesson

- **HSK2.0 / HSK1 / lesson1**：打招呼，5 题（含手写 + 自动补足）
- **HSK2.0 / HSK1 / lesson7**：日期，5 题
- **HSK2.0 / HSK1 / lesson18**：购物，5 题，扩展表达纳入出题

## 后续 v3 升级方向

- `listening_choice`：听力选择题
- `drag_reorder`：拖拽语序
- `input_typing`：手输填空
- `ai_adaptive_practice`：AI 个性化复习
- `review_mode_generation`：复习模式出题
