// ui/components/bar.js
import { t, setLang, getLang } from "../i18n.js";

function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function initBar() {
  // 1) 确保容器存在（你也可以改成你现有的容器 id）
  let bar = document.getElementById("top-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "top-bar";
    document.body.prepend(bar);
  }

  // 2) 渲染
  render(bar);

  // 3) 绑定事件
  bind(bar);

  // 4) 监听语言变化自动刷新文本
  window.addEventListener("i18n:changed", () => render(bar));
}

function render(root) {
  const lang = getLang();

  root.innerHTML = `
    <div class="bar">
      <div class="bar-left">
        <strong>AI 한자 선생님</strong>
      </div>

      <div class="bar-right">
        <!-- ✅ 预留：你的 stroke 工具栏按钮（例如 跟写/따라쓰기 开关）可放这里 -->
        <button class="btnTrace" type="button">${t("trace_toggle")}</button>

        <!-- ✅ 语言切换 -->
        <select class="langSelect" aria-label="language">
          <option value="ko" ${lang === "ko" ? "selected" : ""}>${t("lang_ko")}</option>
          <option value="zh" ${lang === "zh" ? "selected" : ""}>${t("lang_zh")}</option>
        </select>
      </div>
    </div>
  `;
}

function bind(root) {
  const langSelect = qs(".langSelect", root);
  langSelect?.addEventListener("change", (e) => {
    setLang(e.target.value);
  });

  // ✅ trace按钮先给你占位：你之后接 traceApi / playDemoStroke 就接这里
  const traceBtn = qs(".btnTrace", root);
  traceBtn?.addEventListener("click", () => {
    // TODO: 你现有的 teachingMode / traceApi / playDemoStroke 接入这里
    console.log("trace toggle clicked");
  });
}
