# Lumina 平台总架构统一升级 — 结果说明

## 一、修改的文件

| 文件 | 修改内容 |
|------|----------|
| `ui/app.js` | 新增 `#kids`、`#business` 路由注册 |
| `ui/components/navBar.js` | 新增 Kids、Business 导航项，调整顺序为 Home→HSK→Kids→Business→Travel→Culture→Speaking→Stroke→Hanja→Review→Resources→Teacher→My |
| `ui/pages/page.travel.js` | 重构为统一平台风格，全部文案走 i18n，支持语言切换 rerender |
| `ui/pages/page.culture.js` | 重构为统一平台风格，全部文案走 i18n，支持语言切换 rerender |
| `ui/pages/page.speaking.js` | 重构为统一平台风格，全部文案走 i18n，支持语言切换 rerender |
| `lang/kr.json` | 新增 nav.kids、nav.business；新增 kids、business、culture、speaking、travel 完整 key |
| `lang/en.json` | 同上 |
| `lang/cn.json` | 同上 |
| `lang/jp.json` | 同上 |

## 二、新增的文件

| 文件 | 说明 |
|------|------|
| `ui/pages/page.kids.js` | Kids 课程域主页，MVP 占位，课程入口卡片（基础中文、拼音启蒙、会话·儿歌、图片表达） |
| `ui/pages/page.business.js` | Business 课程域主页，MVP 占位，课程入口卡片（商务会话、邮件、会议、电话、接待、角色扮演） |
| `data/courses/business/.gitkeep` | 商务课程数据目录占位 |
| `UPGRADE_RESULT.md` | 本结果说明文件 |

## 三、新增的 i18n key

### nav
- `nav.kids`
- `nav.business`

### kids
- `kids.title`、`kids.subtitle`、`kids.start`、`kids.levels`、`kids.songs`、`kids.story`、`kids.comingSoon`
- `kids.basic`、`kids.pinyin`、`kids.conversation`、`kids.pictureTalk`

### business
- `business.title`、`business.subtitle`、`business.start`、`business.meeting`、`business.email`、`business.phone`、`business.roleplay`、`business.comingSoon`
- `business.conversation`、`business.reception`

### travel
- `travel.title`、`travel.subtitle`、`travel.comingSoon`、`travel.airport`、`travel.hotel`、`travel.restaurant`、`travel.transport`

### culture
- `culture.title`、`culture.subtitle`、`culture.comingSoon`

### speaking
- `speaking.title`、`speaking.subtitle`、`speaking.comingSoon`

## 四、已不再作为正式入口的旧页面

- 无。本次升级未移除任何路由，所有 `#xxx` 均指向 SPA 内页面模块。
- 若项目中存在 `pages/*.html`（如 `pages/hsk.html`、`pages/stroke.html` 等），**导航和正式访问流已不再跳转至这些旧 html**，全部通过 `index.html` + hash 路由进入。

## 五、逐页验收指南

### Home
- 访问 `#home` 或 `/index.html#home`
- 检查：标题、副标题、按钮、标签、更新列表、Footer 均显示正确
- 切换 KR/CN/EN/JP，页面文案应同步更新

### HSK
- 访问 `#hsk`
- 检查：课程列表、等级选择、课程详情、Tabs（words/dialogue/grammar/extension/practice/ai）正常
- 切换语言后，页面主体应 rerender

### Kids
- 访问 `#kids`
- 检查：标题「儿童中文 / Kids Chinese」、副标题、课程入口卡片（基础中文、拼音启蒙、会话·儿歌、图片表达）
- 占位显示「即将开放 / Coming soon」
- 切换语言后，页面应 rerender

### Business
- 访问 `#business`
- 检查：标题「商务中文 / Business Chinese」、副标题、课程入口卡片（商务会话、邮件、会议、电话、接待、角色扮演）
- 占位显示「即将开放 / Coming soon」
- 切换语言后，页面应 rerender

### Stroke
- 访问 `#stroke`
- 检查：笔顺输入、动画、跟写功能正常
- 切换语言后，页面应 rerender

### Hanja
- 访问 `#hanja`
- 检查：汉字列表、比较占位正常
- 切换语言后，页面应 rerender

### 语言切换
- 点击顶部 KR / CN / EN / JP 按钮
- 检查：导航文案、当前页面主体文案同步更新
- 无 `brand.name`、`nav.xxx` 等未翻译 key 裸露显示

### 导航跳转
- 依次点击：Home、HSK、Kids、Business、Travel、Culture、Speaking、Stroke、Hanja、Review、Resources、Teacher、My
- 检查：每次点击均通过 hash 路由切换，无整页刷新
- 当前页高亮正确

## 六、数据目录结构（当前）

```
data/courses/
├── hsk2.0/
├── hsk3.0/
├── kids/
├── business/   ← 新增
├── travel/
└── culture/
```

## 七、后续扩展建议

- Kids：在 `data/courses/kids/` 下按 `level-a/`、`level-b/`、`songs/`、`picture-talk/` 等组织课程
- Business：在 `data/courses/business/` 下按 `basic/`、`workplace/`、`meetings/`、`email/`、`negotiation/` 等组织课程
- 课程加载逻辑已支持 `courseType: "kids"`、`courseType: "business"`，后续只需接入课程数据即可
