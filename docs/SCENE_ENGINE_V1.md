# Scene Engine v1

Lumina 场景驱动学习层，将课程从「内容展示」升级为「场景驱动」结构。

## 一、Scene Engine 是什么

Scene Engine 是平台级增强层，为 lesson 增加可选的 `scene` 字段。当 lesson 包含 scene 时：

- 课程顶部显示**场景封面、标题、摘要**
- 显示**学习目标**（1~3 条）
- 显示**角色卡**（头像 + 名字）
- 对话 step 使用**分镜增强版**（frame 图 + 对应对话）
- AI context 注入 scene 信息，供 roleplay 使用

当 lesson 没有 scene 时，课程照旧运行，不受影响。

## 二、scene schema 说明

```json
{
  "scene": {
    "id": "greeting_school_gate",
    "title": { "zh": "学校门口打招呼", "kr": "...", "en": "..." },
    "summary": { "zh": "...", "kr": "...", "en": "..." },
    "cover": "/media/scenes/greeting_school_gate/cover.jpg",
    "location": "school_gate",
    "mood": "friendly",
    "goal": [
      { "zh": "学会用中文打招呼", "kr": "...", "en": "..." }
    ],
    "characters": [
      { "id": "A", "name": { "zh": "小明", ... }, "avatar": "/media/scenes/.../A.png" }
    ],
    "frames": [
      { "id": "scene1", "image": "...", "dialogueRef": 0, "focusWords": ["你好"] }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 场景唯一标识 |
| title | object | 多语言标题 |
| summary | object | 多语言摘要 |
| cover | string | 场景封面图路径 |
| location | string | 场景地点（可选） |
| mood | string | 氛围（可选） |
| goal | array | 学习目标，每项为多语言对象 |
| characters | array | 角色列表，含 id、name、avatar |
| frames | array | 分镜列表，含 id、image、dialogueRef、focusWords |

`dialogueRef` 为 dialogue 数组下标，用于关联 frame 与对话行。

## 三、媒体目录规则

```
/media/scenes/{sceneId}/
  cover.jpg       # 场景封面
  A.png           # 角色 A 头像
  B.png           # 角色 B 头像
  frame1.jpg      # 分镜 1
  frame2.jpg      # 分镜 2
  ...
```

- 图片缺失时自动忽略，不报错
- 支持 `window.DATA_PATHS.getBase()` 子目录部署

## 四、lesson 中如何添加 scene

在 lesson JSON 中增加 `scene` 字段即可。scene 为可选，不添加则按旧模式运行。

## 五、如何给 scene 增加角色 / 分镜 / 图片

1. **角色**：在 `characters` 数组中添加 `{ id, name, avatar }`
2. **分镜**：在 `frames` 数组中添加 `{ id, image, dialogueRef, focusWords }`
3. **图片**：将文件放入 `/media/scenes/{sceneId}/`，按上述命名

## 六、如何与 AI / Practice 联动

### AI 联动

`aiLessonContext.buildLessonContext()` 已扩展：当 lesson 有 scene 时，在返回对象中增加 `scene` 字段：

```js
scene: {
  id, title, summary, goal[], characters[]
}
```

供 AI roleplay 使用场景上下文。

### Practice 联动

预留接口：

- `SCENE_ENGINE.getScenePracticeHints(scene)`：返回 `{ frameId, focusWords }[]`
- `frame.focusWords`：自动生成练习题时可优先使用

## 七、未来 v2 / v3 升级方向

- **v2**：场景内动画、角色表情、分镜轮播
- **v3**：真实 AI 多轮对话、语音评分、场景分支
