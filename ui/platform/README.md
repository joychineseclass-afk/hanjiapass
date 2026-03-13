# Joy Chinese Platform Layer

平台级 Content Layer + Capability Layer 模块，不修改现有 #hsk/#stroke/#hanja 行为。

## 新增文件清单

```
ui/platform/
├── index.js                    # 统一导出
├── README.md
├── content/
│   └── contentLoader.js        # CONTENT / CONTENT_LOADER
├── capabilities/ai/
│   ├── aiService.js            # AI_SERVICE
│   ├── promptBuilder.js        # PromptBuilder
│   ├── schemaValidator.js      # SchemaValidator
│   └── learnerModel.js         # LearnerModel
└── courses/
    └── courseRouterHook.js     # getCourseRouteState 等
```

## 导出 API

### 1. CONTENT (Content Layer)

```js
import { CONTENT } from "./platform/index.js";

// 课程索引
await CONTENT.loadCourseIndex({ type: "hsk", track: "hsk2.0", level: 1 });

// 单课详情（返回 { raw, doc }，doc 为 LessonDoc 结构）
await CONTENT.loadLesson({ type: "hsk", track: "hsk2.0", level: 1, lessonNo: 1, file?: "hsk1_lesson1.json" });

// 笔画 SVG
await CONTENT.loadStroke({ char: "好" });

// Hanja 检索（MVP 占位）
await CONTENT.searchHanja({ q: "학교", level: 1, limit: 20 });

// 教室（MVP：读 data/classroom/mvp/class_*.json，404 时返回空对象）
await CONTENT.loadClassroom({ classId: "3A" });
```

### 2. AI_SERVICE (Capability Layer)

```js
import { AI_SERVICE } from "./platform/index.js";

await AI_SERVICE.generateLesson({ courseType: "hsk", track: "hsk2.0", level: 1, topic: "打招呼", lang: "zh" });
await AI_SERVICE.generatePractice({ lessonDoc, focus: "mixed", count: 8, lang: "zh" });
await AI_SERVICE.coachSpeaking({ lessonDoc, userUtterance: "你好", lang: "zh" });
await AI_SERVICE.evaluateAnswer({ task: { word: "你好", expected: "你好" }, answer: "你好" });
await AI_SERVICE.recommendNext({ context });
```

### 3. courseRouterHook

```js
import { getCourseRouteState, getStrokeRouteState, getHanjaRouteState, getClassroomRouteState, parseHashQuery } from "./platform/index.js";

getCourseRouteState();   // #course?type=hsk&level=1&lesson=1 → { type, track, level, lessonNo, view }
getStrokeRouteState();   // #stroke?char=好 → { char }
getHanjaRouteState();    // #hanja?word=學校 → { word }
getClassroomRouteState(); // #classroom?class=3A → { classId }
parseHashQuery(location.hash); // { route, query }
```

### 4. PromptBuilder / SchemaValidator / LearnerModel

```js
import { PromptBuilder, SchemaValidator, LearnerModel } from "./platform/index.js";

PromptBuilder.buildLessonPrompt({ courseType, track, level, topic, lang, schemaHint });
PromptBuilder.buildPracticePrompt({ lessonDoc, focus, count, lang, schemaHint });
PromptBuilder.buildSpeakingCoachPrompt({ lessonDoc, lang });

SchemaValidator.validateLessonDoc(doc);
SchemaValidator.validatePracticeSet(practice);
SchemaValidator.validateLevelConstraints({ usedWords, allowedWords, maxOutOfLevelRatio });

const lm = LearnerModel.load();
lm.recordWordResult("你好", true);
lm.recordLesson("hsk1_lesson1");
lm.save();
```

## 兼容说明

- 使用 `ensureHSKDeps()` 与 `window.HSK_LOADER`，不修改 HSK_LOADER 实现
- 使用 `window.DATA_PATHS` 获取 URL，兼容子目录部署
- 不改动 router.js、page.hsk、page.stroke、page.hanja

## Lumina 恢复系统（Restore System）

当需要将仓库恢复到 `stable` 分支的状态时，可以使用简单的一键恢复脚本。

在支持 Bash 的终端中运行：

```bash
bash scripts/restore-stable.sh
```

该脚本会：

- 拉取远程最新代码：`git fetch origin`
- 切换到 `main` 分支：`git checkout main`
- 强制将本地 `main` 重置为 `origin/stable`：`git reset --hard origin/stable`
- 将结果强制推送到远程 `main`：`git push --force`

完成后，`main` 分支将与 `stable` 分支保持完全一致。
