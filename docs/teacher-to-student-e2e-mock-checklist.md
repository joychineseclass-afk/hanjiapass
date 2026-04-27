# Lumina Mock：老师 → 学生 端到端回归清单

本页描述 **一条固定 fixture** 的完整 mock 链，用于可重复验证。不涉及真支付、真审核后端。

## 固定 Fixture 摘要

| 项 | 值 |
|----|-----|
| 课堂课件 asset（`lesson_slide_draft`） | `tasset_e2e_demo_001` |
| 上架 listing | `lst_e2e_courseware_001`（`classroom_asset` → 该 asset；`approved` + `public` + 免费） |
| 学生 entitlement | `ent_e2e_courseware_classroom_001` → 用户 `u_student_demo_001`（`free_access`） |
| 老师 profile / 用户 | `tp_demo_seller_001` / `u_teacher_demo_001`（与种子一致） |

首次 `initCommerceStore` 后会 **自动合并** listing + entitlement；`ensureE2EClassroomFixtureAsset()` 会在需要时写入 **同一 ID** 的课件资产（localStorage `lumina_teacher_assets_v1`）。

---

## A. 老师创建与发布（可选走完全手操，或使用已合并的 fixture）

### 账号

- 浏览器侧 **当前用户** 需为种子老师：在「我的发布 / 沙盒」用 demo 身份切换为 **`u_teacher_demo_001`**，或用 `lumina_current_user_v1` 已同步为 active 老师（`tp_demo_seller_001`）。
- 登录态：若走正式登录，需保证 auth 与 commerce teacher profile 对齐（与现有 `#teacher` active 流程一致）。

### 页面与操作（全路径）

1. **`#teacher-assets`**  
   - 进入后应能看到 fixture 行 **E2E fixture — lesson slide (demo)**（若已执行 `ensureE2EClassroomFixtureAsset`）。  
   - 亦可从空态「快速创建」新建 `lesson_slide_draft`，编辑至可发布（与现有 Step4 一致）。

2. **`#teacher-asset-editor?assetId=tasset_e2e_demo_001`**（或你新建的 asset id）  
   - 补齐标题/大纲等最小字段；保存。

3. **`#teacher-publishing`**  
   - 在「我的售卖」列表中应出现对应 **classroom_asset** listing；fixture 若已合并，则行为为 **已批准 + 公开**（回归可只读验证状态列）。

4. **`#teacher-review`**（审核员）  
   - 将 demo 用户切为 **`u_reviewer_demo_001`**（或沙盒内带 reviewer 角色的用户）。  
   - 若 listing 仍为 `pending_review`，在审核台批准为 `approved`，再将 visibility 设为 `public`（fixture 已预置时可跳过）。

### 预期状态

- Listing：`status=approved`，`visibility=public`（或至少 `unlisted` → 人工改 public，视你手操到哪一步）。  
- 资产：`lesson_slide_draft`，`ready`（或你流程中的等价可讲状态）。

---

## B. Reviewer 审核

1. **切换 reviewer**：「我的发布」页底部 **「高级/沙盒」** 折叠中的 **演示用户** 下拉框，选 **示例审核员**（`u_reviewer_demo_001`）。或 session 内与 commerce reviewer 角色一致的用户。  
2. 打开 **`#teacher-review`**。  
3. 对 **待审** 的 classroom 上架项执行 **批准**（若在 fixture 中已批准，则核对日志与列表状态即可）。

### 预期

- Listing 状态变为 `approved`；若有 profile 审核区，与 listing 审核分离，按现有 UI 展示。

---

## C. 学生获取与进入课堂

### 学生身份

- Mock 权益绑定 **用户 id**：`u_student_demo_001`（种子「示例学生 A」）。  
- **推荐**：打开 **`#my-content`**，若列表为空，点击 **「切换为 mock 学生…」** 按钮（会写入 `lumina_current_user_v1` 并 `location.hash = #my-content`）。  
- 无需改 LocalStorage 里 commerce 的其它键；entitlement 已在 store 中。

### 在哪里看到

- **`#my-content`**：至少一行 **E2E — Classroom deck (fixture)**（或与 listing 标题一致）。  
- 「如何获得」列应对 **免费** 展示（`free_access` + 价格为 0）。

### 如何进课堂

- 在「课堂/详情」列点击 **进入课堂**；链接为  
  **`#classroom?assetId=tasset_e2e_demo_001`**。  
- 应能进入课堂并加载 `lesson_slide_draft` 结构（与现有 `#classroom` 一致），**学生** 不再因「非老师本人」被 `forbidden`（由 entitlement 校验放行）。

### 从详情页

- 亦可 **`#teacher-listing?id=lst_e2e_courseware_001`** 查看上架详情；进入课堂仍推荐带 `assetId` 的 URL。

---

## D. 重置后再次跑通

1. **Commerce 种子重置**（教师发布沙盒内 **「重置演示种子」**，或 `resetCommerceStoreToSeed()` 对应 UI）：会重建内存 + localStorage；**下一次 `initCommerceStore` 会再次 `ensureE2eCommerceFixture`** 合并 e2e listing + entitlement。  
2. **老师课件存储**：`lumina_teacher_assets_v1` 不随 commerce 重置而清空。若需 **完全从 0** 的课件资产，在开发者工具中删除 `lumina_teacher_assets_v1` 或只删其中 `tasset_e2e_demo_001` 项；**下次**打开 `#teacher-assets` / `#my-content` / `#classroom?assetId=...` 会再次 **自动插入** E2E 课件。  
3. **当前学习用户**（`lumina_current_user_v1`）按需手动切回 `u_student_demo_001`（或用 `#my-content` 的按钮）。

---

## 仍依赖的 mock / 沙盒操作

- **演示用户身份切换**（commerce 沙盒里「演示用户」选择）：老师 / 审核员 / 学生 之间切换。  
- **`#my-content` 一键切 mock 学生**：为降低门槛；熟练测试可直接把 `lumina_current_user_v1` 设为学生 id。  
- **Entitlement 发放**：E2E 使用种子里的 **`free_access` + `system`**，**非** 真实购买；不验证支付网关。

---

## 回归场景与本文对应关系

| 场景 | 说明 |
|------|------|
| 老师端创建到发布 | A；fixture 可缩短为「打开 publishing 看 listing 行」 |
| Reviewer 审核 | B；fixture 可缩短为只读 |
| 学生端获得 | C；`#my-content` 可见 + 免费来源 |
| 学生进课堂 | C；`#classroom?assetId=tasset_e2e_demo_001` |
| 可重复 + 文档 + reset | D；本文 + 沙盒 reset |
| 不破坏主链 | 未改 HSK/「开始学习」/ `#teacher` 四态 路由结构；仅接 entitlement → classroom 门禁与 fixture 合并 |

---

## 相关源码（便于维护）

- `ui/lumina-commerce/e2eClassroomFixture.js` — listing / entitlement 常量与 `ensureE2eCommerceFixture`  
- `ui/lumina-commerce/teacherAssetsStore.js` — `ensureE2EClassroomFixtureAsset`  
- `ui/lumina-commerce/store.js` — 初始化时合并 e2e commerce  
- `ui/lumina-commerce/teacherAssetsSelectors.js` — `selectClassroomContextFromAssetId` 学员凭 entitlement 进入  
- `ui/pages/page.myLearningContent.js` — mock 学生按钮 + 调 `ensureE2EClassroomFixtureAsset`  

维护者更新 ID 时，请 **三处同步**：`e2eClassroomFixture.js`、本清单、（若有）沙盒/文档中提及的 deep link。
