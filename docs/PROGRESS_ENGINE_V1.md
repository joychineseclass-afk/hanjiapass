# Progress Engine v1

平台级学习进度与复习调度系统。

## 数据结构

```json
{
  "version": 1,
  "updatedAt": 0,
  "courses": {
    "hsk2.0_hsk1": {
      "courseId": "hsk2.0_hsk1",
      "lastLessonNo": 1,
      "lessons": {
        "hsk2.0_hsk1_lesson1": {
          "lessonId": "hsk2.0_hsk1_lesson1",
          "lessonNo": 1,
          "startedAt": 0,
          "completedAt": 0,
          "currentStep": "dialogue",
          "completedSteps": ["vocab"],
          "practice": {
            "total": 3,
            "correct": 2,
            "score": 2,
            "updatedAt": 0
          }
        }
      },
      "vocab": {
        "你": {
          "hanzi": "你",
          "lessonId": "hsk2.0_hsk1_lesson1",
          "status": "learning",
          "correctCount": 1,
          "wrongCount": 0,
          "lastSeenAt": 0,
          "lastReviewedAt": 0,
          "nextReviewAt": 0
        }
      }
    }
  }
}
```

## Review Scheduler 规则

- **初次学习**：status = new
- **学过一次**：status = learning，nextReviewAt = 今天
- **答对**：correctCount + 1
  - 第 1 次答对 → 1 天后复习
  - 第 2 次答对 → 3 天后复习
  - 第 3 次答对 → 7 天后复习
  - 第 4 次及以上 → status = mastered，15 天后复习
- **答错**：wrongCount + 1，status = learning，nextReviewAt = 今天

## 接入点

1. **打开课程**：`markLessonStarted({ courseId, lessonId, lessonNo })`
2. **切换 step**：`markStepCompleted({ courseId, lessonId, step })`
3. **完成练习**：`recordPracticeResult({ courseId, lessonId, total, correct, score, vocabItems })`
4. **打开单词页**：`touchLessonVocab({ courseId, lessonId, vocabItems })`

## 存储

- localStorage key: `lumina_progress_v1`
- 无登录、无云端同步
