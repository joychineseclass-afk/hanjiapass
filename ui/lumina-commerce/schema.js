/**
 * Lumina 教师 / 商业化 Stage 0 — JSDoc 数据形状（与 DB/JSON 对齐的契约）。
 *
 * ---------------------------------------------------------------------------
 * 输出物 E：后续支付接入说明（本文件顶部约定，业务核心层禁止写死 PSP）
 * ---------------------------------------------------------------------------
 * - 当前阶段：未接 Stripe / PayPal / Adyen / Toss 等任何真实支付 API。
 * - 无真实扣款、无 Webhook、无自动分账、无老师提现。
 * - 下一阶段 Marketplace / Connect 类接入时建议流程：
 *   1) 客户端或服务端创建 Checkout，得到 provider / provider_checkout_id；
 *   2) 支付成功后：更新 order.status → paid，写入 provider_payment_id；
 *   3) 同一事务内写入 entitlement（source_type=order, source_id=order.id），页面鉴权只读 entitlement；
 *   4) teacher 侧 payout：仅用 teacher profile 上 payout_provider / provider_account_id / kyc_status 等预留字段扩展。
 * - 禁止：在 domain 层写 if (stripe) 等硬编码；provider 字段可空，由接入层填充。
 * ---------------------------------------------------------------------------
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} [display_name]
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} UserRoleRow
 * @property {string} id
 * @property {string} user_id
 * @property {import('./enums.js').UserRole} role
 * @property {string} created_at
 */

/**
 * @typedef {Object} TeacherSellerProfile
 * @property {string} id
 * @property {string} user_id
 * @property {string} display_name
 * @property {string} [bio]
 * @property {import('./enums.js').TeacherLevel} teacher_level
 * @property {import('./enums.js').VerificationStatus} verification_status
 * @property {import('./enums.js').SellerEligibility} seller_eligibility
 * @property {boolean} payout_ready
 * @property {string|null} [payout_provider]
 * @property {string|null} [provider_account_id]
 * @property {string|null} [kyc_status]
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Listing
 * @property {string} id
 * @property {import('./enums.js').SellerType} seller_type
 * @property {string|null} teacher_id platform 时为空
 * @property {import('./enums.js').ListingType} listing_type
 * @property {import('./enums.js').DeliveryType} delivery_type
 * @property {string} title
 * @property {string} [summary]
 * @property {string} [description]
 * @property {import('./enums.js').ListingStatus} status
 * @property {import('./enums.js').Visibility} visibility
 * @property {string} price_amount 十进制字符串或数字，Stage 0 不强制
 * @property {string} price_currency ISO 4217，默认 KRW
 * @property {string|null} [list_price_amount]
 * @property {string|null} [sale_price_amount]
 * @property {import('./enums.js').RefundPolicyType} refund_policy_type
 * @property {import('./enums.js').ReviewReasonCode|null} [review_reason_code]
 * @property {string|null} [review_reason_text]
 * @property {boolean|null} [ownership_declaration_accepted]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string|null} [published_at]
 * @property {string|null} [delisted_at]
 */

/**
 * @typedef {Object} ListingReviewLog
 * @property {string} id
 * @property {string} listing_id
 * @property {string} reviewer_user_id
 * @property {import('./enums.js').ListingReviewAction} action
 * @property {import('./enums.js').ReviewReasonCode|null} [reason_code]
 * @property {string|null} [reason_text]
 * @property {string} created_at
 */

/**
 * @typedef {Object} Entitlement
 * @property {string} id
 * @property {string} user_id
 * @property {import('./enums.js').EntitlementType} entitlement_type
 * @property {string|null} [listing_id]
 * @property {string|null} [teacher_id]
 * @property {import('./enums.js').EntitlementSourceType} source_type
 * @property {string} source_id 关联 order / campaign / 人工单等
 * @property {import('./enums.js').EntitlementStatus} status
 * @property {string|null} [starts_at]
 * @property {string|null} [ends_at]
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} buyer_id
 * @property {string} listing_id
 * @property {import('./enums.js').SellerType} seller_type
 * @property {string|null} teacher_id platform 时为空
 * @property {string} amount
 * @property {string} currency
 * @property {import('./enums.js').OrderStatus} status
 * @property {string|null} [provider] 支付渠道占位
 * @property {string|null} [provider_checkout_id]
 * @property {string|null} [provider_payment_id]
 * @property {import('./enums.js').CommissionType} commission_type
 * @property {string|null} [commission_rate] 如 "0.15"
 * @property {string|null} [commission_amount]
 * @property {string|null} [seller_net_amount]
 * @property {string} created_at
 * @property {string} updated_at
 */

export const SCHEMA_VERSION_STAGE0 = "lumina_commerce_stage0_v1";
