# 统一学习端承载层（阶段一）

## 当前三套学习数据来源

1. **学生 HSK（`#hsk` + `ui/modules/hsk`）**  
   独立 lesson 加载与 HSK 专用渲染；`platform/course-engine` 的 `loadLesson` / `normalizeLesson` 在部分路径已复用，但页级入口尚未走统一 resolver。

2. **课堂（`#classroom` + `classroomEngine` + `classroomRenderer`）**  
   通过 hash query 或 `assetId` 进课；与商务资产、课件 draft 的 step 条联动。已在本阶段接 **统一 resolver**。

3. **Global Course Engine（`ui/platform/course-engine`）**  
   提供 `resolveCoursePath`、`loadLesson`、`normalizeLesson`、注册表等；`platform/content/courseLoader` 的 `loadLessonDetail` 在已挂载 `window.GLOBAL_COURSE_ENGINE` 时优先调 GCE。  
   **本阶段未新增第四套体系**：resolver 在课堂路径上直接 `import { loadLesson }` 自 `globalCourseEngine.js`，与现有 GCE 一致。

## 本轮统一了哪一层

- **课程 / 课次 context**：`LessonExperienceContext`（`lessonExperienceContext.js`）  
- **来源适配**：`classroomGceInputFromRouting` 等（`lessonExperienceAdapters.js`）— 将 URL/资产 语义映射为 GCE 的 `loadLesson` 输入，并补全 `kids` 下 `level=1` → 目录 `kids1` 等与数据目录一致的方向（避免仅凭裸 `"1"` 与 JSON 目录脱节）。
- **单页入口解析**：`resolveClassroomPageLessonExperience`（`lessonExperienceResolver.js`）— 内聚原 `page.classroom` 中的 `parseQuery` + `selectClassroomContextFromAssetId` + 路由字段拼装，并产出一式 **`loadedLesson`（raw + normalized lesson + resolved）**。
- **引擎集成**：`initClassroomEngine` 支持可选 `preloadedLesson`，与 resolver 的 GCE 加载 **共享一次请求**。

## 已接入页面

- **`ui/pages/page.classroom.js`**  
  通过 `resolveClassroomPageLessonExperience` 取得 `context`、`routing`、`query`、`engineInit`；`initClassroomEngine(engineInit, …)`。  
  根节点增加 `data-lesson-experience-source`（`classroom_asset` | `teacher_course`）便于与 DOM 级调试衔接。

## 尚未迁移

| 页面 / 区域 | 说明 |
|-------------|------|
| `page.hsk.js` | 次批：在入口侧调用同一 resolver 家族或 HSK 专用 `resolve*`，仍交给现有 HSK 渲染。 |
| `page.kids1.js` | 再次批。 |
| `speaking` / 未来 HSKK、YCT | 待 schema 与目录约定齐后再接。 |

## 建议迁移顺序（与任务书一致）

1. 本轮：**#classroom**（已完成）  
2. 下一轮：**#hsk** 的 context / payload 入口，loader 经 adapter 进入 GCE。  
3. 再往后：`page.kids1.js`、口语等。

## 边界与不变量

- **未**合并 HSK 与课堂的最终 UI 渲染；仅统一 **context 解析、GCE 加载、给 classroom 的 engine 入参**。
- HSK 学生主链、教师四态、listing / entitlement、E2E `#classroom?assetId=...` 行为以现有逻辑为准，resolver 对资产校验仍委托 `selectClassroomContextFromAssetId`。
