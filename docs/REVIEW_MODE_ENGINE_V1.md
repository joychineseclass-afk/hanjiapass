# Lumina Review Mode Engine v1

## 概述

Review Mode Engine v1 基于 `progress.wrongQuestions` 实现错题复习功能，不重新出题，仅对已有错题进行再练。

## 数据流

```
wrongQuestions → 提取错题 → 恢复题目上下文(questionSnapshot) → 生成复习列表 → 提交后更新 wrongQuestions
```

## 目录结构

```
ui/platform/review/
├── index.js              # 统一导出
├── reviewModeEngine.js   # 核心逻辑：prepareReviewSession, submitReview
├── reviewSelectors.js    # 选择器：getWrongQuestions, getWrongQuestionsByLesson, getWrongQuestionsByCourse
├── reviewSessionBuilder.js # 会话构建：buildReviewSession
├── reviewRenderer.js     # 渲染器：renderReviewMode
├── reviewState.js        # 状态管理
└── reviewActions.js      # 动作封装
```

## wrongQuestions 结构（升级后）

```json
{
  "lessonId": "hsk2.0_hsk1_lesson1",
  "questionId": "q_001",
  "subtype": "vocab_meaning_choice",
  "selected": "B",
  "correct": "A",
  "wrongCount": 2,
  "reviewCorrectCount": 0,
  "lastWrongAt": 1710000000,
  "lastReviewAt": 0,
  "questionSnapshot": {
    "question": { "zh": "你好___？" },
    "options": [...],
    "answer": "A",
    "explanation": { "zh": "..." }
  }
}
```

## 复习模式

| 模式 | 说明 | 题量上限 |
|------|------|----------|
| lesson | 当前课错题 | 5 |
| level | 当前级错题 | 10 |
| all | 全部错题 | 15 |

## 移除规则

同一道错题在复习中**连续答对 2 次** → 从 wrongQuestions 移除。

## UI 入口

1. **目录页**：hskProgressBlock 下方 [复习本课] [复习本级] [全部错题]
2. **课程详情页**：tabs 旁 [复习] 按钮

## v1 不做

- AI 讲解
- 同类题重新生成
- 间隔复习算法
- 云端同步
- 排行榜
- 学习画像
