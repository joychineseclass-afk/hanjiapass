/**
 * Lumina 教师模块 Stage 0 — 最小骨架页（验证枚举、状态机、entitlement、order 占位）。
 * 未接支付；数据存 localStorage（lumina_commerce_stage0_store_v1）。
 */

import {
  DEFAULT_SETTLEMENT_CURRENCY,
  DELIVERY_TYPE,
  ENTITLEMENT_SOURCE_TYPE,
  ENTITLEMENT_STATUS,
  ENTITLEMENT_TYPE,
  LISTING_STATUS,
  LISTING_TYPE,
  REFUND_POLICY_TYPE,
  REVIEW_REASON_CODE,
  SELLER_TYPE,
  USER_ROLE,
  VISIBILITY,
  LISTING_REVIEW_ACTION,
} from "../lumina-commerce/enums.js";
import { hasListingAccess } from "../lumina-commerce/entitlementService.js";
import { canTransitionListingStatus } from "../lumina-commerce/listingStateMachine.js";
import { assertCanSubmitListingForReview } from "../lumina-commerce/teacherRules.js";
import {
  initCommerceStore,
  mutateCommerceStore,
  resetCommerceStoreToSeed,
  userHasRole,
} from "../lumina-commerce/store.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function optEnum(values, selected) {
  return values
    .map((v) => `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(v)}</option>`)
    .join("");
}

function renderPage(root, ctx) {
  const snap = ctx.snap;
  const demoUserId = ctx.demoUserId;

  const teacherRows = snap.teacher_profiles
    .map(
      (t) => `<tr>
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.user_id)}</td>
      <td>${escapeHtml(t.display_name)}</td>
      <td>${escapeHtml(t.teacher_level)}</td>
      <td>${escapeHtml(t.verification_status)}</td>
      <td>${escapeHtml(t.seller_eligibility)}</td>
      <td>${t.payout_ready ? "yes" : "no"}</td>
    </tr>`
    )
    .join("");

  const listingRows = snap.listings
    .map((L) => {
      const tp =
        L.seller_type === SELLER_TYPE.teacher
          ? snap.teacher_profiles.find((x) => x.id === L.teacher_id) || null
          : null;
      const canSubmit =
        L.status === LISTING_STATUS.draft &&
        assertCanSubmitListingForReview(tp, L).ok;
      const submitDisabled = canSubmit ? "" : "disabled";
      return `<tr data-listing-id="${escapeHtml(L.id)}">
        <td>${escapeHtml(L.id)}</td>
        <td>${escapeHtml(L.seller_type)}</td>
        <td>${escapeHtml(L.teacher_id || "—")}</td>
        <td>${escapeHtml(L.listing_type)}</td>
        <td>${escapeHtml(L.status)}</td>
        <td>${escapeHtml(L.visibility)}</td>
        <td>${escapeHtml(String(L.price_amount))} ${escapeHtml(L.price_currency)}</td>
        <td>
          <button type="button" class="lts0-submit-review" data-id="${escapeHtml(L.id)}" ${submitDisabled}>提交审核</button>
        </td>
      </tr>`;
    })
    .join("");

  const logRows = snap.listing_review_logs
    .slice()
    .reverse()
    .map(
      (r) => `<tr>
      <td>${escapeHtml(r.created_at)}</td>
      <td>${escapeHtml(r.listing_id)}</td>
      <td>${escapeHtml(r.action)}</td>
      <td>${escapeHtml(r.reason_code || "—")}</td>
      <td>${escapeHtml(r.reason_text || "—")}</td>
    </tr>`
    )
    .join("");

  const entRows = snap.entitlements
    .map(
      (e) => `<tr>
      <td>${escapeHtml(e.id)}</td>
      <td>${escapeHtml(e.user_id)}</td>
      <td>${escapeHtml(e.entitlement_type)}</td>
      <td>${escapeHtml(e.listing_id || "—")}</td>
      <td>${escapeHtml(e.status)}</td>
      <td>${escapeHtml(e.source_type)}</td>
    </tr>`
    )
    .join("");

  const orderRows = snap.orders
    .map(
      (o) => `<tr>
      <td>${escapeHtml(o.id)}</td>
      <td>${escapeHtml(o.buyer_id)}</td>
      <td>${escapeHtml(o.listing_id)}</td>
      <td>${escapeHtml(o.seller_type)}</td>
      <td>${escapeHtml(o.status)}</td>
      <td>${escapeHtml(String(o.amount))} ${escapeHtml(o.currency)}</td>
      <td>${escapeHtml(o.provider || "—")}</td>
    </tr>`
    )
    .join("");

  const isReviewer =
    userHasRole(snap, demoUserId, USER_ROLE.reviewer) || userHasRole(snap, demoUserId, USER_ROLE.admin);

  const reviewPanel = isReviewer
    ? `<section class="card" style="margin-top:14px;">
        <h3>审核骨架（reviewer / admin）</h3>
        <p class="desc" style="font-size:13px;color:#64748b;">演示：变更 listing 状态并写入 review_reason_code / review_reason_text；状态转移受状态机约束。</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;">
          <label>listing_id<br/><select id="lts0ReviewListing">${snap.listings.map((L) => `<option value="${escapeHtml(L.id)}">${escapeHtml(L.title)} (${escapeHtml(L.id)})</option>`).join("")}</select></label>
          <label>新状态<br/><select id="lts0ReviewNext">${optEnum(
            [
              LISTING_STATUS.pending_review,
              LISTING_STATUS.approved,
              LISTING_STATUS.rejected,
              LISTING_STATUS.delisted,
              LISTING_STATUS.archived,
            ],
            LISTING_STATUS.approved
          )}</select></label>
          <label>reason_code<br/><select id="lts0ReasonCode">${optEnum(Object.values(REVIEW_REASON_CODE), REVIEW_REASON_CODE.other)}</select></label>
          <label style="min-width:220px;">reason_text<br/><input id="lts0ReasonText" type="text" placeholder="驳回/下架说明" style="width:100%;"/></label>
          <button type="button" id="lts0ApplyReview">应用状态</button>
        </div>
      </section>`
    : `<p style="font-size:13px;color:#94a3b8;">当前演示用户非 reviewer/admin，已隐藏审核面板。切换为 u_reviewer_demo_001 或 u_admin_demo_001。</p>`;

  const accessUser = demoUserId;
  const accessListingId = snap.listings[0]?.id || "";
  const hasAccess = hasListingAccess(snap.entitlements, accessUser, accessListingId);

  root.innerHTML = `
    <div class="wrap" style="padding-bottom:48px;">
      <section class="card">
        <h2 class="title">Lumina 教师模块 · Stage 0 骨架</h2>
        <p class="desc">商业规则与数据占位；<b>未接任何支付 API</b>。数据持久化在本地 localStorage，可「重置为种子数据」。</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:10px;">
          <label>演示用户（user_id）
            <select id="lts0DemoUser">
              ${snap.users.map((u) => `<option value="${escapeHtml(u.id)}" ${u.id === demoUserId ? "selected" : ""}>${escapeHtml(u.display_name || u.id)}</option>`).join("")}
            </select>
          </label>
          <button type="button" id="lts0ResetSeed">重置为种子数据</button>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>学习权益探测（优先 entitlement）</h3>
        <p style="font-size:13px;">用户 <code>${escapeHtml(accessUser)}</code> 对 listing <code>${escapeHtml(accessListingId)}</code>：
          <strong>${hasAccess ? "有访问权" : "无访问权"}</strong>（仅演示默认首条 listing）。</p>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>老师档案（TeacherSellerProfile）</h3>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr><th>id</th><th>user_id</th><th>display_name</th><th>teacher_level</th><th>verification_status</th><th>seller_eligibility</th><th>payout_ready</th></tr></thead>
            <tbody>${teacherRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>上架 Listing</h3>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr><th>id</th><th>seller_type</th><th>teacher_id</th><th>listing_type</th><th>status</th><th>visibility</th><th>price</th><th>操作</th></tr></thead>
            <tbody>${listingRows}</tbody>
          </table>
        </div>
        <h4 style="margin-top:16px;">新建草稿</h4>
        <form id="lts0NewListing" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end;">
          <label>title<input name="title" required value="草稿 · 示例"/></label>
          <label>seller_type<select name="seller_type">${optEnum(Object.values(SELLER_TYPE), SELLER_TYPE.teacher)}</select></label>
          <label>teacher_profile_id<input name="teacher_id" placeholder="platform 可空" value="tp_demo_seller_001"/></label>
          <label>listing_type<select name="listing_type">${optEnum(Object.values(LISTING_TYPE), LISTING_TYPE.course)}</select></label>
          <label>delivery_type<select name="delivery_type">${optEnum(Object.values(DELIVERY_TYPE), DELIVERY_TYPE.recorded)}</select></label>
          <label>visibility<select name="visibility">${optEnum(Object.values(VISIBILITY), VISIBILITY.private)}</select></label>
          <label>price_amount<input name="price_amount" value="10000"/></label>
          <label>price_currency<input name="price_currency" value="${DEFAULT_SETTLEMENT_CURRENCY}"/></label>
          <label>refund_policy<select name="refund_policy_type">${optEnum(
            Object.values(REFUND_POLICY_TYPE),
            REFUND_POLICY_TYPE.within_7_days
          )}</select></label>
          <button type="submit" style="grid-column:1/-1;justify-self:start;">创建 draft</button>
        </form>
      </section>

      ${reviewPanel}

      <section class="card" style="margin-top:14px;">
        <h3>Listing 审核日志（占位）</h3>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr><th>时间</th><th>listing_id</th><th>action</th><th>reason_code</th><th>reason_text</th></tr></thead>
            <tbody>${logRows || `<tr><td colspan="5">暂无</td></tr>`}</tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>Entitlement · 手动发放（manual_grant）</h3>
        <form id="lts0Grant" style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;">
          <label>user_id<input name="user_id" value="u_student_demo_001"/></label>
          <label>listing_id<select name="listing_id">${snap.listings.map((L) => `<option value="${escapeHtml(L.id)}">${escapeHtml(L.id)}</option>`).join("")}</select></label>
          <button type="submit">发放</button>
        </form>
        <div style="overflow:auto;margin-top:10px;">
          <table class="lts0-table">
            <thead><tr><th>id</th><th>user_id</th><th>type</th><th>listing_id</th><th>status</th><th>source</th></tr></thead>
            <tbody>${entRows}</tbody>
          </table>
        </div>
      </section>

      <section class="card" style="margin-top:14px;">
        <h3>Order 占位</h3>
        <p class="desc" style="font-size:13px;">commission_* / seller_net_amount 为成交快照字段；provider_* 预留给支付接入。</p>
        <div style="overflow:auto;">
          <table class="lts0-table">
            <thead><tr><th>id</th><th>buyer</th><th>listing</th><th>seller_type</th><th>status</th><th>金额</th><th>provider</th></tr></thead>
            <tbody>${orderRows}</tbody>
          </table>
        </div>
      </section>

      <style>
        .lts0-table { width:100%; border-collapse:collapse; font-size:13px; }
        .lts0-table th, .lts0-table td { border:1px solid #e2e8f0; padding:6px 8px; text-align:left; }
        .lts0-table th { background:#f8fafc; }
      </style>
    </div>
  `;

  const demoSel = root.querySelector("#lts0DemoUser");
  demoSel?.addEventListener("change", () => {
    ctx.demoUserId = String(demoSel.value || "");
    try {
      sessionStorage.setItem("lumina_stage0_demo_user", ctx.demoUserId);
    } catch {}
    renderPage(root, ctx);
  });

  root.querySelector("#lts0ResetSeed")?.addEventListener("click", async () => {
    ctx.snap = await resetCommerceStoreToSeed();
    renderPage(root, ctx);
  });

  root.querySelector("#lts0NewListing")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(/** @type {HTMLFormElement} */ (ev.target));
    const seller_type = String(fd.get("seller_type") || SELLER_TYPE.teacher);
    const teacher_id_raw = String(fd.get("teacher_id") || "").trim();
    const teacher_id = seller_type === SELLER_TYPE.platform ? null : teacher_id_raw || null;
    mutateCommerceStore((draft) => {
      const now = new Date().toISOString();
      draft.listings.push({
        id: uid("lst"),
        seller_type,
        teacher_id,
        listing_type: String(fd.get("listing_type")),
        delivery_type: String(fd.get("delivery_type")),
        title: String(fd.get("title") || "未命名"),
        summary: "",
        description: "",
        status: LISTING_STATUS.draft,
        visibility: String(fd.get("visibility")),
        price_amount: String(fd.get("price_amount") || "0"),
        price_currency: String(fd.get("price_currency") || DEFAULT_SETTLEMENT_CURRENCY),
        list_price_amount: null,
        sale_price_amount: null,
        refund_policy_type: String(fd.get("refund_policy_type")),
        review_reason_code: null,
        review_reason_text: null,
        ownership_declaration_accepted: null,
        created_at: now,
        updated_at: now,
        published_at: null,
        delisted_at: null,
      });
    });
    renderPage(root, ctx);
  });

  root.querySelectorAll(".lts0-submit-review").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (!id) return;
      mutateCommerceStore((draft) => {
        const L = draft.listings.find((x) => x.id === id);
        if (!L || L.status !== LISTING_STATUS.draft) return;
        const tp =
          L.seller_type === SELLER_TYPE.teacher
            ? draft.teacher_profiles.find((x) => x.id === L.teacher_id) || null
            : null;
        const gate = assertCanSubmitListingForReview(tp, L);
        if (!gate.ok) {
          alert(gate.message || gate.code);
          return;
        }
        if (!canTransitionListingStatus(L.status, LISTING_STATUS.pending_review)) return;
        L.status = LISTING_STATUS.pending_review;
        L.updated_at = new Date().toISOString();
        draft.listing_review_logs.push({
          id: uid("lrl"),
          listing_id: L.id,
          reviewer_user_id: demoUserId,
          action: LISTING_REVIEW_ACTION.submitted,
          reason_code: null,
          reason_text: null,
          created_at: new Date().toISOString(),
        });
      });
      renderPage(root, ctx);
    });
  });

  root.querySelector("#lts0ApplyReview")?.addEventListener("click", () => {
    const listingId = String(root.querySelector("#lts0ReviewListing")?.value || "");
    const next = String(root.querySelector("#lts0ReviewNext")?.value || "");
    const reason_code = String(root.querySelector("#lts0ReasonCode")?.value || "");
    const reason_text = String(root.querySelector("#lts0ReasonText")?.value || "");
    if (!listingId || !next) return;
    mutateCommerceStore((draft) => {
      const L = draft.listings.find((x) => x.id === listingId);
      if (!L) return;
      if (!canTransitionListingStatus(L.status, next)) {
        alert(`不允许转移: ${L.status} -> ${next}`);
        return;
      }
      const now = new Date().toISOString();
      L.status = next;
      L.updated_at = now;
      if (next === LISTING_STATUS.rejected || next === LISTING_STATUS.delisted) {
        L.review_reason_code = reason_code;
        L.review_reason_text = reason_text;
      } else {
        L.review_reason_code = null;
        L.review_reason_text = null;
      }
      if (next === LISTING_STATUS.approved) L.published_at = L.published_at || now;
      if (next === LISTING_STATUS.delisted) L.delisted_at = now;
      const action =
        next === LISTING_STATUS.approved
          ? LISTING_REVIEW_ACTION.approved
          : next === LISTING_STATUS.rejected
            ? LISTING_REVIEW_ACTION.rejected
            : next === LISTING_STATUS.delisted
              ? LISTING_REVIEW_ACTION.delisted
              : next === LISTING_STATUS.archived
                ? LISTING_REVIEW_ACTION.appeal_resolved
                : LISTING_REVIEW_ACTION.approved;
      draft.listing_review_logs.push({
        id: uid("lrl"),
        listing_id: L.id,
        reviewer_user_id: demoUserId,
        action,
        reason_code: reason_code || null,
        reason_text: reason_text || null,
        created_at: now,
      });
    });
    renderPage(root, ctx);
  });

  root.querySelector("#lts0Grant")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(/** @type {HTMLFormElement} */ (ev.target));
    const user_id = String(fd.get("user_id") || "").trim();
    const listing_id = String(fd.get("listing_id") || "").trim();
    if (!user_id || !listing_id) return;
    mutateCommerceStore((draft) => {
      const now = new Date().toISOString();
      const L = draft.listings.find((l) => l.id === listing_id);
      draft.entitlements.push({
        id: uid("ent"),
        user_id,
        entitlement_type: ENTITLEMENT_TYPE.manual_grant,
        listing_id,
        teacher_id: L?.seller_type === SELLER_TYPE.teacher ? L.teacher_id : null,
        source_type: ENTITLEMENT_SOURCE_TYPE.admin,
        source_id: uid("grant"),
        status: ENTITLEMENT_STATUS.active,
        starts_at: now,
        ends_at: null,
        created_at: now,
        updated_at: now,
      });
    });
    renderPage(root, ctx);
  });
}

export default async function pageLuminaTeacherStage0(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");
  if (!root) return;

  const snap = await initCommerceStore();

  let demoUserId = "u_student_demo_001";
  try {
    demoUserId = sessionStorage.getItem("lumina_stage0_demo_user") || demoUserId;
  } catch {}

  const ctx = { snap, demoUserId };
  renderPage(root, ctx);
}

export function mount(ctxOrRoot) {
  return pageLuminaTeacherStage0(ctxOrRoot);
}

export function render(ctxOrRoot) {
  return pageLuminaTeacherStage0(ctxOrRoot);
}
