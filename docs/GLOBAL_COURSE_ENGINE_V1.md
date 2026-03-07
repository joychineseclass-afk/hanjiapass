# Global Course Engine v1

## 一、定位

Global Course Engine 是 Lumina 平台级**课程系统抽象层**，负责：

- 统一课程注册与路径解析
- 统一课程加载与标准化
- 统一课程能力映射

**不重写** Lesson Engine、Practice Generator、Review、Progress、Audio 等，只统一「课程类型」和「课程内容来源」。

---

## 二、目录结构

```
ui/platform/course-engine/
├── index.js              # 统一导出，挂载 window.GLOBAL_COURSE_ENGINE
├── globalCourseEngine.js # 对外统一接口
├── courseRegistry.js     # 课程注册表
├── courseResolver.js     # 路径解析
├── courseLoader.js       # 课程加载器
├── courseNormalizer.js   # 课程标准化
├── courseCapabilities.js # 课程能力映射
└── courseSelectors.js   # 课程选择器
```

---

## 三、课程注册机制

`courseRegistry.js` 配置式注册：

| 课程类型 | versions | supportedLevels |
|----------|----------|-----------------|
| hsk | hsk2.0, hsk3.0 | hsk1 ~ hsk9 |
| kids | kids | kids1, kids2, kids3 |
| travel | travel | travel1, travel2 |
| business | business | business1, business2 |
| culture | culture | culture1, culture2 |

新增课程只需在 `COURSE_REGISTRY` 中添加配置，无需改其他代码。

---

## 四、路径解析规则

`courseResolver.js` 输出标准路径：

| 课程 | 路径格式 | 示例 |
|------|----------|------|
| HSK | `data/courses/{version}/{level}/` | `data/courses/hsk2.0/hsk1/lesson1.json` |
| Kids | `data/courses/{courseType}/{level}/` | `data/courses/kids/kids1/lesson1.json` |
| Travel | 同上 | `data/courses/travel/travel1/lesson1.json` |

**courseId 规则：**

- HSK（兼容）：`hsk2.0_hsk1`
- 其他：`{courseType}_{version}_{level}`，如 `kids_kids_kids1`

**lessonId 规则：** `{courseId}_lesson{n}`，如 `hsk2.0_hsk1_lesson1`

---

## 五、统一 Lesson Schema

`courseNormalizer.js` 输出统一结构：

```json
{
  "id": "hsk2.0_hsk1_lesson1",
  "courseType": "hsk",
  "version": "hsk2.0",
  "level": "hsk1",
  "title": { "zh", "pinyin", "kr", "en" },
  "vocab": [],
  "dialogueCards": [],
  "dialogue": [],
  "grammar": [],
  "extension": [],
  "practice": [],
  "aiScope": {},
  "aiPractice": {},
  "meta": { "courseId", "lessonNo", "file", "type" },
  "_raw": {}
}
```

缺字段时提供空数组兜底，兼容现有 HSK lesson 与未来 kids/travel/business/culture。

---

## 六、Capability 机制

`courseCapabilities.js` 定义某类课程启用哪些 tab：

| 能力 | hsk | kids | travel |
|------|-----|------|--------|
| vocab | ✓ | ✓ | ✓ |
| dialogue | ✓ | ✓ | ✓ |
| grammar | ✓ | ✗ | ✓ |
| extension | ✓ | ✓ | ✓ |
| practice | ✓ | ✓ | ✓ |
| ai | ✓ | ✓ | ✓ |
| review | ✓ | ✓ | ✗ |
| scene | ✓ | ✓ | ✓ |

页面层根据 `getCourseCapabilities(courseType)` 自动显示/隐藏模块。

---

## 七、HSK 接入方式

**底层替换**：`ui/platform/content/courseLoader.js` 优先委托 `GLOBAL_COURSE_ENGINE`：

1. `loadCourseIndex` → `GCE.loadCourse`
2. `loadLessonDetail` → `GCE.loadLesson`

`page.hsk.js` 无需修改，仍调用 `LESSON_ENGINE.loadCourseIndex` / `loadLessonDetail`，底层自动走 Global Course Engine。

**Legacy 兼容**：`courseType: "hsk2.0"` 自动映射为 `courseType: "hsk", version: "hsk2.0"`。

---

## 八、Kids 样例说明

**目录：** `data/courses/kids/kids1/`

**lessons.json：**

```json
{
  "level": 1,
  "lessons": [
    { "no": 1, "id": 1, "title": "打招呼 / Hello", "file": "lesson1.json" }
  ]
}
```

**lesson1.json：** 最小结构（2 单词、1 会话卡、1 扩展、1 题练习）

**验证：**

```js
const { raw, lesson } = await GLOBAL_COURSE_ENGINE.loadLesson({
  courseType: "kids",
  level: "kids1",
  lessonNo: 1
});
console.log(lesson.vocab.length, lesson.dialogueCards.length);
```

---

## 九、未来接入 Travel / Business / Culture

1. 在 `data/courses/` 下新增目录，如 `travel/travel1/`
2. 添加 `lessons.json` 和 `lesson1.json` 等
3. 课程注册已在 `COURSE_REGISTRY` 中配置
4. 新建对应页面（如 `page.travel.js`）时，调用 `GCE.loadCourse` / `GCE.loadLesson` 即可

无需改 course-engine 代码。

---

## 十、API 速查

| 方法 | 说明 |
|------|------|
| `getCourseRegistry()` | 获取课程注册表 |
| `resolveCourse(input)` | 解析路径 |
| `loadCourse(input)` | 加载课程目录 |
| `loadLesson(input)` | 加载单课（原始 + 归一化） |
| `normalizeLessonForEngine(raw, ctx)` | 标准化 lesson |
| `getCourseCapabilities(courseType)` | 获取课程能力 |

**调试：** `window.GLOBAL_COURSE_ENGINE` 在控制台可用。
