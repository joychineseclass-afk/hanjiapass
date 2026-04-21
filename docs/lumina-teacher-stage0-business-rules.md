# Lumina 教师模块 Stage 0｜业务规则定稿（内部）

本文档与 `ui/lumina-commerce/enums.js`、`ui/lumina-commerce/schema.js`、`data/lumina/stage0-mock-examples.json` 对齐，作为后续审核台、商品页、购买流、支付接入的契约基线。

## 阶段边界

- **本阶段**：规则与数据占位、本地骨架演示；**不接**任何真实支付 API，无扣款、Webhook、自动分账、提现、财务后台。
- **下一阶段**：Marketplace / Connect 类接入时，支付成功应**更新 order** 并**写入 entitlement**；业务鉴权以 **entitlement** 为准，而非直接由订单推断。

## seller_type（售卖归属）

- `platform`：官方内容，收入归平台。
- `teacher`：老师内容，须可关联 `teacher_id`（与老师档案主键一致），后续抽成 / 分账 / 结算。

## 老师权限分层（teacher_level）

- `basic_teacher`：可用教学空间；可建草稿、自用；**不可**公开售卖。
- `verified_teacher`：身份/资料审核通过；可展示主页等；**是否可售卖**由下一层决定。
- `seller_teacher`：售卖资质通过；可公开上架；后续可绑定 payout / Connect。

与资质相关的字段建议：

- `verification_status`：`not_submitted` | `pending` | `approved` | `rejected`
- `seller_eligibility`：`none` | `internal_use_only` | `eligible_to_sell`

**自用授课**与**公开售卖**门槛分离；代码层见 `ui/lumina-commerce/teacherRules.js`。

## listing_type / delivery_type

- 所有可上架对象共用 **listing** 体系，字段 `listing_type`（如 `course`、`ppt`、`live_class`、`subscription_plan` 等）。
- `delivery_type` 区分录播、下载、直播、服务、会员、人工发放等，避免「卖课」与「卖文件」混建模型。

## Listing 生命周期（独立状态字段）

状态机枚举 `status`：

`draft` → `pending_review` → `approved`；另支持 `rejected`、`delisted`、`archived`；预留 `appeal_pending`。

合法转移见 `ui/lumina-commerce/listingStateMachine.js`。

审核/下架须保留 **reason_code**（如 `copyright_risk`）与 **reason_text**；日志表占位：`listing_review_logs`。

## visibility（与审核解耦）

- `private` | `unlisted` | `public`
- `approved` **不**自动等于 `public`；老师自用内容可为 `private` / `unlisted`。

## 价格与币种

- `price_amount` + `price_currency`（主市场默认 **KRW**）；可扩展 `list_price_amount` / `sale_price_amount`。
- 阶段 0 不做多币种换算。

## entitlement（学习权益）

- 支付成功 / 邀请 / 手动发放 / 免费领取等均应**写入 entitlement**。
- 类型示例：`platform_subscription`、`listing_access`、`teacher_course_access`、`manual_grant`、`invite`、`free_access`。
- 来源示例：`order`、`admin`、`campaign`、`teacher_invite`、`system`。
- 状态：`active` | `expired` | `revoked` | `scheduled`。
- 页面/内容门禁应优先读 **entitlement**（`ui/lumina-commerce/entitlementService.js`）。

## order（占位）

订单须含：`buyer_id`、`listing_id`、`seller_type`、`teacher_id`（platform 为空）、金额币种、`status`、**佣金快照**（`commission_type`、`commission_rate`、`commission_amount`、`seller_net_amount`）、`provider` / `provider_checkout_id` / `provider_payment_id`（可空）。

订单状态：`pending_payment`、`paid`、`failed`、`cancelled`、`refunded`、`partially_refunded`。

历史订单佣金以订单字段为准，**不**随全局配置回算。

## 退款策略（占位）

`listing.refund_policy_type`：`no_refund` | `within_7_days` | `before_class_start` | `prorated` | `case_review`。阶段 0 不实现具体退款逻辑。

## 用户角色（多角色）

角色：`student` | `teacher` | `reviewer` | `admin`。建议使用 `user_roles` 多行结构，避免 `users.role` 单值锁死。

## 后续支付接入（注释摘要）

完整说明见 `ui/lumina-commerce/schema.js` 文件头：domain 层禁止写死 PSP；支付成功后更新 order 并写入 entitlement；payout 字段仅在老师档案上预留扩展。
