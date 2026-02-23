// wordPanel.js
// 全局单词详情监听器

(function initWordPanel(){

  if (window.__WORD_PANEL_READY__) return;
  window.__WORD_PANEL_READY__ = true;

  window.addEventListener("word:open", (e)=>{
    const word = e.detail?.word;
    const lang = e.detail?.lang || "kr";
    if (!word) return;

    const han =
      word.hanzi ||
      word.word ||
      word.zh ||
      word.cn ||
      word.text ||
      "(?)";

    const py =
      word.pinyin ||
      word.py ||
      "";

    const kr =
      word.kr ||
      word.ko ||
      word.meaning ||
      "";

    const html = `
      <div style="padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:800">${han}</div>
        <div style="margin-top:6px;font-size:16px;opacity:.7">${py}</div>
        <div style="margin-top:12px;font-size:18px">${kr}</div>
      </div>
    `;

    window.dispatchEvent(new CustomEvent("modal:open",{
      detail:{
        title:"单词学习",
        html
      }
    }));

  });

})();
