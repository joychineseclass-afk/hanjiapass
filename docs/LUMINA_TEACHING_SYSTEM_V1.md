# Lumina 教学系统三件神器 v1

## 一、神器 1：自动拼音系统（Pinyin System v2）

### 实现说明

- **优先级**：manualPinyin > cache > generatedDictionary (pinyinMap) > localFallback (pinyinFallback)
- **pinyinMap.mjs**：扫描 `data/courses/**`、`data/vocab/**`，生成短语级 + 单字级映射
- **pinyinFallback.mjs**：本地常用字兜底
- **check-pinyin-needed.mjs**：检测未覆盖内容，提醒运行 `npm run build:pinyin`

### 新增/修改文件

- `ui/vendor/pinyinFallback.mjs`（新增）
- `ui/utils/pinyinEngine.js`（修改：使用 pinyinFallback，支持短语级查表）
- `scripts/build-pinyin-map.mjs`（修改：扫描 courses + vocab，输出短语+单字）
- `scripts/check-pinyin-needed.mjs`（新增）

### 接入点

- `ui/modules/hsk/hskRenderer.js`：resolvePinyin, shouldShowPinyin
- `ui/pages/page.hsk.js`：buildDialogueHTML, buildGrammarHTML
- `ui/core/wordsStep.js`：拼音显示
- `ui/platform/renderers/stepRenderers.js`：resolvePinyin

---

## 二、神器 2：智能单词解释系统（Glossary / Meaning Layer v2）

### 实现说明

- **词义优先级**：KR: meaning.kr → meaning.ko → glossary → word.kr → word.ko → zh
- **词性优先级**：KR: pos.kr → pos.ko → glossary → zh 映射为 ko
- **POS 映射表**：POS_ZH_TO_KR, POS_ZH_TO_EN, POS_EN_TO_ZH, POS_KR_TO_ZH

### 新增/修改文件

- `ui/utils/wordDisplay.js`（修改：增加 POS_KR_TO_ZH，CN 模式支持 pos.ko 反推）
- `ui/platform/renderers/stepRenderers.js`（修改：使用 getMeaningByLang, getPosByLang）

### 接入点

- `ui/modules/hsk/hskRenderer.js`
- `ui/core/wordsStep.js`
- `ui/platform/renderers/stepRenderers.js`

---

## 三、神器 3：AI 对话训练入口（AI Speaking Entry v1）

### 实现说明

- **aiLessonContext.js**：从 lesson 提取 vocab、dialogue、grammar、level、version
- **aiPromptBuilder.js**：4 种模式（跟读、替换、角色扮演、自由问答）
- **aiPanel.js**：本课摘要、4 个模式按钮、prompt 预览、复制、开始练习（mock）

### 新增文件

- `ui/platform/capabilities/ai/aiLessonContext.js`
- `ui/platform/capabilities/ai/aiPromptBuilder.js`
- `ui/platform/capabilities/ai/aiPanel.js`
- `ui/platform/capabilities/ai/index.js`

### 接入点

- `ui/pages/page.hsk.js`：openLesson 时 mountAIPanel，joy:langchanged 时重挂载

---

## 四、新增 npm scripts

```json
{
  "build:pinyin": "node scripts/build-pinyin-map.mjs",
  "check:pinyin": "node scripts/check-pinyin-needed.mjs",
  "sync:lesson-glossary": "node scripts/sync-lesson-glossary.mjs"
}
```

---

## 五、验证结果

| 项目 | 状态 |
|------|------|
| HSK1 lesson1 拼音 | ✓ |
| HSK1 lesson2 拼音 | ✓ |
| dialogue/grammar 拼音 | ✓ |
| npm run check:pinyin | ✓ |
| npm run build:pinyin | ✓ |
| KR 模式释义/词性 | ✓ |
| CN 模式释义/词性 | ✓ |
| EN 模式释义/词性 | ✓ |
| AI 面板 4 模式 | ✓ |
| AI mock 开始练习 | ✓ |
