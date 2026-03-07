# Lumina i18n 文案键名总表

商业级模块化结构，支持 CN / KR / EN。

## 设计原则

1. **全部使用 `模块_功能` 命名**
   - ✅ `review_start` `lesson_dialogue` `practice_submit`
   - ❌ `submit` `start` `dialogue`（易冲突）

2. **不在代码中写死中文**
   - ✅ `<button>{t("practice_submit")}</button>`
   - ❌ `<button>提交</button>`

3. **所有模块必须用 key**
   - 按钮、提示、标题、Tab、说明

## 文件结构

| 文件 | 模块 |
|------|------|
| common.json | 全平台通用 |
| nav.json | 导航栏 |
| hsk.json | HSK 模块 |
| lesson.json | 课程 Lesson |
| practice.json | 练习 |
| review.json | 错题复习 |
| audio.json | 发音 |
| progress.json | 学习进度 |
| system.json | 系统提示 |
| teacher.json | 教师系统 |
| student.json | 学生系统 |
| future.json | 未来模块预留 |

## JSON 格式

```json
{
  "common_ok": { "cn": "确定", "kr": "확인", "en": "OK" },
  "common_submit": { "cn": "提交", "kr": "제출", "en": "Submit" }
}
```

## 扩展新语言

增加 `jp.json`、`es.json` 等，在 `index.js` 的 `jsonToDict` 中支持新字段即可。系统 UI 会自动切换语言。

## 使用

```js
import { i18n } from "/ui/i18n.js";

// 初始化后加载 JSON（可选，用于覆盖/补充）
await i18n.loadFromJson();

// 使用
i18n.t("practice_submit");           // 当前语言
i18n.t("practice_question_number", { n: 3 });  // 插值
```
