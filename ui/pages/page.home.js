import { i18n } from "../i18n.js";

function renderHomeInto(root) {
  root.innerHTML = `
    <section style="padding:18px 0;">
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:18px; padding:18px;">
        <div style="display:inline-flex; font-weight:800; font-size:12px; color:#2563eb; background:rgba(37,99,235,.08); padding:8px 10px; border-radius:999px;">
          ✨ 오늘도 한 걸음
        </div>

        <h1 style="margin:12px 0 6px; font-size:26px; letter-spacing:-.4px;">
          오늘은 3분만, 중국어 해볼까요?
        </h1>

        <p style="margin:0; color:#475569; line-height:1.6;">
          아이는 즐겁게 배우고, 부모님/선생님은 커리큘럼을 쉽게 찾을 수 있도록 구성했어요.
        </p>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
  <a href="#hsk"
     style="background:#2563eb;color:#fff;padding:10px 14px;border-radius:14px;text-decoration:none;font-weight:700;">
     시작 학습
  </a>

  <a href="#catalog"
     style="border:1px solid #e2e8f0;background:#fff;color:#0f172a;padding:10px 14px;border-radius:14px;text-decoration:none;font-weight:700;">
     커리큘럼 보기
  </a>
</div>
      </div>
    </section>
  `;

  // i18n apply (如果你有 data-i18n 的话这里会生效)
  try { i18n.apply(root); } catch {}
}

/** ✅ 兼容1：router 调用 module.default(...) */
export default function pageHome(ctxOrRoot) {
  const root =
    ctxOrRoot?.root ||
    ctxOrRoot?.app ||
    (ctxOrRoot instanceof HTMLElement ? ctxOrRoot : null) ||
    document.getElementById("app");

  if (!root) {
    console.warn("[page.home] #app not found");
    return;
  }
  renderHomeInto(root);
}

/** ✅ 兼容2：router 调用 module.mount(...) */
export function mount(ctxOrRoot) {
  return pageHome(ctxOrRoot);
}

/** ✅ 兼容3：router 调用 module.render(...) */
export function render(ctxOrRoot) {
  return pageHome(ctxOrRoot);
}
