// /ui/components/footer.js
export function mountFooter(rootEl) {
  if (!rootEl) return;
  const year = new Date().getFullYear();
  rootEl.innerHTML = `
    <div class="footer">
      <span>© ${year} Joy Chinese</span>
      <span data-i18n="footerNote">逐步完善中：先把结构搭好，再把内容一块块补齐。</span>
    </div>
  `;
}
