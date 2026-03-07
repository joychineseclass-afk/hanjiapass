# Image Engine v1

平台级统一图片解析机制，为词汇卡、课程页、对话页提供本地图片自动匹配，并预留 AI 生成图片接口。

## 一、目录结构

```
ui/platform/media/
├── imageEngine.js      # 统一平台接口
├── imageResolver.js    # 本地路径解析
├── imagePromptBuilder.js  # AI prompt 占位
└── imageRegistry.js   # 图片别名映射

/media/                 # 静态资源根目录（项目根或 public）
├── vocab/             # 词汇图
├── lesson/            # 课程封面
└── dialogue/          # 对话场景图
```

## 二、文件命名规则

### 词汇图 `/media/vocab/`

| 优先级 | 路径示例 | 说明 |
|--------|----------|------|
| 1 | `{hanzi}.png` | 汉字作为文件名，如 `你好.png` |
| 2 | `{hanzi}.jpg` | 同上 |
| 3 | `{id}.png` | 词条 id |
| 4 | `{id}.jpg` | 同上 |

支持 `imageRegistry` 别名：如 `你好` → `hello`，则匹配 `hello.png` / `hello.jpg`。

### 课程封面 `/media/lesson/`

| 格式 | 示例 |
|------|------|
| `{courseType}_{level}_lesson{lessonNo}.jpg` | `hsk2.0_hsk1_lesson1.jpg` |
| `{courseType}_{level}_lesson{lessonNo}.png` | `hsk2.0_hsk1_lesson1.png` |

### 对话图 `/media/dialogue/`

| 格式 | 示例 |
|------|------|
| `{courseType}_{level}_lesson{lessonNo}_{sceneId}.jpg` | `hsk2.0_hsk1_lesson1_0.jpg` |

## 三、如何给词汇添加图片

1. 将图片放入 `/media/vocab/` 目录
2. 文件名使用汉字，如 `你好.png`、`谢谢.jpg`
3. 若需使用英文/拼音文件名，在 `imageRegistry.js` 的 `IMAGE_ALIAS` 中添加映射：

```js
export const IMAGE_ALIAS = {
  你好: "hello",
  苹果: "apple",
};
```

则系统会尝试加载 `/media/vocab/hello.png` 等。

## 四、如何给课程添加封面图

1. 将图片放入 `/media/lesson/` 目录
2. 按规则命名：`hsk2.0_hsk1_lesson1.jpg`（HSK 2.0、1级、第1课）
3. 支持 `.jpg` 或 `.png`

## 五、未来如何扩展到 CDN / AI 生成图片

### CDN

在 `imageEngine.js` 中修改 `getWordImage` / `getLessonImage` / `getDialogueImage`：

```js
export function getWordImage(word, opts = {}) {
  const local = ImageResolver.resolveWordImage(word, opts);
  if (CDN_BASE) return CDN_BASE + local.replace(/^\//, "");
  return local;
}
```

### AI 生成

1. 使用 `imagePromptBuilder.js` 的 `buildWordImagePrompt` 等生成 prompt
2. 调用 AI 图片 API 获取 URL
3. 在 `imageEngine.js` 中优先返回 AI 结果，fallback 到本地：

```js
export async function getWordImage(word, opts = {}) {
  if (opts.useAI) {
    const url = await AIImageService.generate(buildWordImagePrompt(word, opts.lang));
    if (url) return url;
  }
  return ImageResolver.resolveWordImage(word, opts);
}
```

## 六、API 说明

| 方法 | 说明 |
|------|------|
| `IMAGE_ENGINE.getWordImage(word, opts)` | 词汇图 URL |
| `IMAGE_ENGINE.getLessonImage(lesson, opts)` | 课程封面 URL |
| `IMAGE_ENGINE.getDialogueImage(lesson, scene, opts)` | 对话场景图 URL |
| `getWordImageUrl(word)` (wordDisplay) | 词卡用，同步返回 |

找不到时返回空字符串，不报错。
