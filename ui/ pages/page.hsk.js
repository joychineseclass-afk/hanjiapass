// /ui/pages/page.hsk.js
// HSK 页面控制器（正式模块版）
// 负责：加载状态、刷新、等级切换、未来接数据接口

import { i18n } from "../i18n.js";

export function initPageHSK({
  levelSelect,
  reloadBtn,
  statusEl,
  vocabWrap,
}) {
  if (!levelSelect || !reloadBtn || !statusEl || !vocabWrap) {
    console.warn("HSK page init failed: missing elements");
    return;
  }

  function setStatus(key) {
    statusEl.textContent = i18n.t(key);
  }

  function clearStatus() {
    statusEl.textContent = "";
  }

  function showPlaceholder() {
    vocabWrap.innerHTML = `
      <div class="placeholder">
        ${i18n.t("hsk_empty")}
      </div>
    `;
  }

  function showError(msg) {
    vocabWrap.innerHTML = `
      <div class="err">${msg}</div>
    `;
  }

  // 🚀 未来这里替换为真实 HSK 数据加载
  async function loadHSKData(level) {
    try {
      setStatus("hsk_loading");

      // 模拟加载延迟（以后删掉）
      await new Promise((r) => setTimeout(r, 500));

      clearStatus();
      showPlaceholder();
    } catch (err) {
      console.error(err);
      showError("Load failed");
    }
  }

  function handleReload() {
    const level = levelSelect.value;
    loadHSKData(level);
  }

  // 绑定事件
  reloadBtn.addEventListener("click", handleReload);
  levelSelect.addEventListener("change", handleReload);

  // 语言切换时，重新渲染占位文案
  i18n.onChange(() => {
    showPlaceholder();
  });

  // 初始加载
  handleReload();
}
