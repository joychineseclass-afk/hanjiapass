Lumina Kids Scene Placeholder Images
====================================

请在本目录下放置以下占位图文件（JPG 或 PNG 均可，但路径建议使用 .jpg）：

- greeting.jpg  — 打招呼场景（课堂问候）
- thanks.jpg    — 表达感谢场景
- sorry.jpg     — 表达道歉场景
- intro.jpg     — 自我介绍场景
- question.jpg  — 问答 / 提问场景
- friends.jpg   — 好朋友 / 同学互动场景
- school.jpg    — 一般课堂 / 学校场景
- generic.jpg   — 通用占位图（找不到特定场景类型时使用）

当前代码会根据 scene.type 自动选择这些占位图：

- classroom_greeting      → greeting.jpg
- classroom_help_thanks   → thanks.jpg
- classroom_apology       → sorry.jpg
- classroom_intro / self  → intro.jpg
- classroom_question_answer → question.jpg
- classroom_objects / colors → school.jpg
- classroom_animals       → friends.jpg
- 其他 / 未识别类型        → generic.jpg

后续接入 AI 生图时，只需在 kidsSceneAsset.js 中替换 generateSceneImage() 的实现即可。

