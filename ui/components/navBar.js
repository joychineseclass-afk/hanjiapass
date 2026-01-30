// ui/components/bar.js
function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function initBar() {
  // 确保容器存在
  let bar = document.getElementById("top-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "top-bar";
    document.body.prepend(bar);
  }

  render(bar);
  bind(bar);
}

function render(root) {
  root.innerHTML = `
    <div class="bar">
      <div class="bar-left">
        <strong>AI 한자 선생님</strong>
      </div>

      <div class="bar-right">
        <!-- ✅ 预留：以后你要放 “따라쓰기” 开关就放这里 -->
        <button class="btnTrace" type="button">따라쓰기</button>

        <!-- ✅ 预留：语言切换入口（先禁用） -->
        <button class="btnLang" type="button" disabled title="나중에 다국어 지원 예정">
          KO
        </button>
      </div>
    </div>
  `;
}

function bind(root) {
  const traceBtn = qs(".btnTrace", root);
  traceBtn?.addEventListener("click", () => {
    // TODO：以后接你的 teachingMode / playDemoStroke / traceApi
    console.log("따라쓰기 클릭");
  });

  const langBtn = qs(".btnLang", root);
  langBtn?.addEventListener("click", () => {
    // 预留：以后接语言选择弹窗
  });
}
