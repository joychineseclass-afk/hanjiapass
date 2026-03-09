# Lumina HSK Word Pool 课程生成机制

## 1. lessonWordPool 结构

```json
{
  "lessonWordPool": {
    "reviewWords": ["爱", "八", "爸爸", ...],
    "newWords": ["忙", "累", "吧", "但是", "女人", "每", "教室"],
    "borrowWords": []
  }
}
```

- **reviewWords**: 已学词（HSK1 全部 + 之前所有课的 newWords）
- **newWords**: 本课新词
- **borrowWords**: 借用词（最多 2 个，来自后续课程）

## 2. 会话生成规则

会话（dialogue）只允许使用：
- `reviewWords` + `newWords` + `borrowWords`（最多 2 个）

## 3. 自动联动

- 若会话出现新词 → 必须自动加入 wordCard（words/vocab）
- 本课新词 ≥80% 应出现在会话
- 未进入会话的新词 → 应放入 extension 造句训练

## 4. 课程生成顺序

```
WordPool → Dialogue → Grammar → Extension → Practice
```

不再使用：先写会话再补单词的逻辑。

## 5. 脚本与命令

| 命令 | 说明 |
|------|------|
| `npm run gen:hsk2-lessons` | 从 blueprint 生成 lesson JSON（含 lessonWordPool） |
| `npm run gen:hsk2-full` | 合并 dialogue、grammar、extension、practice，并运行 word pool 检查 |
| `npm run build:word-pool` | 为已有 lesson 添加/更新 lessonWordPool |
| `npm run check:word-pool` | 检查 dialogueWords ⊆ wordCard，未收录词自动加入 |

## 6. 自动检查

- **dialogueWords ⊆ wordCard**：会话中出现的词必须在 wordCard 中
- 若发现未收录词 → 自动加入 wordCard（并计入 borrowWords 若未超限）
- 新词会话覆盖率 < 80% → 输出警告，提示未进会话的词应放入 extension
