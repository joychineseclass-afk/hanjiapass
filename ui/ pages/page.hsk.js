// /ui/pages/page.hsk.js
// HSK 页面控制器（标准样板）

import { i18n } from "../i18n.js";

export function initPageHSK({ levelSelect, reloadBtn, statusEl, vocabWrap }) {
  if (!levelSelect || !reloadBtn || !statusEl || !vocabWrap) {
    console.warn("HSKPage: missing elements");
    return;
  }

  function setStatus(key) {
    statusEl.textContent = i18n.t(key);
  }

  function renderEmpty() {
    vocabWrap.innerHTML = `
      <div class="placeholder">${i18n.t("hsk_empty")}</div>
    `;
  }

  function renderList(words) {
    vocabWrap.innerHTML = words.map(w => `
      <div class="item">
        <div class="w">${w.word}</div>
        <div class="s">${w.meaning}</div>
      </div>
    `).join("");
  }

  async function loadHSK(level) {
    setStatus("hsk_loading");
    await new Promise(r => setTimeout(r, 500));
    setStatus("");

    const demo = [
      { word: "你好", meaning: "안녕하세요 / 你好" },
      { word: "谢谢", meaning: "감사합니다 / 谢谢" },
      { word: "中国", meaning: "중국 / 中国" },
    ];

    renderList(demo);
  }

  function reload() {
    const level = levelSelect.value;
    loadHSK(level).catch(err => {
      console.error(err);
      renderEmpty();
    });
  }

  reloadBtn.addEventListener("click", reload);
  levelSelect.addEventListener("change", reload);

  reload(); // 首次加载
}
