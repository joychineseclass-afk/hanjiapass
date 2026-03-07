# 平台级统一 Lesson Engine v1

## 一、新增/修改文件清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `ui/platform/content/lessonNormalizer.js` | 将原始 lesson JSON 归一化为平台统一 schema |
| `ui/platform/content/courseLoader.js` | 平台级课程加载器，路径 `data/courses/{courseType}/{level}/` |
| `ui/platform/engine/lessonEngine.js` | 统一 Lesson Engine：loadCourseIndex、loadLessonDetail、getStepList、startLesson |
| `ui/platform/engine/stepRegistry.js` | Step 注册表：STEP_KEYS、normalizeStepKey、getDefaultStepsByLesson |
| `ui/platform/engine/index.js` | Engine 统一导出 |
| `ui/platform/renderers/stepRenderers.js` | 各 step 渲染器：vocab/dialogue/grammar/practice/aiPractice/review |
| `ui/platform/renderers/lessonRenderer.js` | 统一 lesson 渲染器 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `ui/platform/index.js` | 导出 LESSON_ENGINE、LESSON_RENDERER、STEP_RENDERERS |
| `ui/pages/page.hsk.js` | 接入 Lesson Engine：loadLessons/openLesson 优先走 engine，失败回退 HSK_LOADER |

---

## 二、统一课程引擎结构

```
ui/platform/
├── content/
│   ├── contentLoader.js      # 原有 CONTENT（HSK 等）
│   ├── courseLoader.js       # 新增：通用 courseType + level 路径
│   └── lessonNormalizer.js   # 新增：lesson 归一化
├── engine/
│   ├── lessonEngine.js       # loadCourseIndex, loadLessonDetail, getStepList, startLesson
│   ├── stepRegistry.js       # STEP_KEYS, normalizeSteps
│   └── index.js
└── renderers/
    ├── lessonRenderer.js     # renderStep, renderLessonTabs
    └── stepRenderers.js      # renderVocabStep, renderDialogueStep, ...
```

---

## 三、统一 Lesson Schema

归一化后的 lesson 对象：

```js
{
  id, courseId, courseType, level, lessonNo, type, file,
  title: { zh, kr, en },
  summary: { zh, kr, en },
  objectives: [{ zh, kr, en }],
  vocab: [{ hanzi, pinyin, meaning: { zh, kr, en }, pos: { zh, kr, en } }],
  dialogue: [{ speaker, zh, line, pinyin, kr, en }],
  grammar: [{ title, explanation, explanation_zh, explanation_kr, explanation_en, example }],
  practice: [{ type, question, options, answer, prompt }],
  aiPractice: { prompt, speaking, chatPrompt },
  review: { lessonRange, focusAreas },
  steps: [{ key, label }]
}
```

---

## 四、旧字段兼容说明

| 旧字段 | 归一化后 |
|--------|----------|
| words | vocab |
| line / line.zh / line.cn | dialogue[].zh, dialogue[].line |
| py | pinyin |
| meaning.kr / meaning.ko | meaning.kr, meaning.ko |
| explanation_zh / explanation_kr | explanation_zh, explanation_kr |
| title 字符串 | title: { zh, kr }（按 `/` 分割） |
| steps 字符串数组 | normalizeSteps 转为对象数组 |
| ai / ai_interaction | aiPractice |
| type: "review" | 保留，steps 用 REVIEW_STEPS |

---

## 五、HSK 页面接入点

1. **loadLessons**：优先 `LESSON_ENGINE.loadCourseIndex({ courseType: state.version, level: \`hsk${state.lv}\` })`，失败回退 `HSK_LOADER.loadLessons`
2. **openLesson**：优先 `LESSON_ENGINE.loadLessonDetail({ courseType, level, lessonNo, file })`，失败回退 `HSK_LOADER.loadLessonDetail`
3. 渲染仍使用现有 `buildDialogueHTML`、`buildGrammarHTML`、`renderWordCards`，数据来自归一化 lesson

---

## 六、验证方式

1. 打开 HSK 页面
2. 选择 HSK 1 级、HSK 2.0
3. 确认课程目录加载（22 课）
4. 点击 lesson1、lesson2，确认进入详情
5. 切换 单词 / 会话 / 语法 / AI 标签，确认内容正常显示

---

## 七、平台级可复用部分

- **courseLoader**：任意 courseType + level 均可加载
- **lessonNormalizer**：任意 lesson JSON 均可归一化
- **stepRegistry**：step key 与默认 steps 定义
- **stepRenderers**：统一接收标准 lesson，不按课程类型分叉

---

## 八、扩展到 kids / travel / business / culture

1. 新增数据目录，例如：
   - `data/courses/kids/level1/lessons.json`
   - `data/courses/kids/level1/lesson1.json`
2. 调用 `LESSON_ENGINE.loadCourseIndex({ courseType: "kids", level: "level1" })`
3. 调用 `LESSON_ENGINE.loadLessonDetail({ courseType: "kids", level: "level1", lessonNo: 1 })`
4. 使用 `LESSON_RENDERER.renderStep` 或 `STEP_RENDERERS` 渲染
5. 无需修改 engine / renderer 代码
