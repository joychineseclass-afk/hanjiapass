// /ui/modules/hsk/ui/hskDom.js
// ✅ DOM + UI helper (no business logic)

export function getHSKDom() {
  const $ = (id) => document.getElementById(id);
  return {
    $,
    hskLevel: $("hskLevel"),
    hskSearch: $("hskSearch"),
    hskGrid: $("hskGrid"),
    hskError: $("hskError"),
    hskStatus: $("hskStatus"),
    hskVersion: $("hskVersion"),
  };
}

export function safeText(x) {
  return String(x ?? "").trim();
}

export function normalizeWord(s) {
  return safeText(s).replace(/\s+/g, " ").trim();
}

export function setStatus(dom, s) {
  if (dom?.hskStatus) dom.hskStatus.textContent = s || "";
}

export function showError(dom, msg) {
  if (!dom?.hskError) return;
  dom.hskError.classList.remove("hidden");
  dom.hskError.textContent = msg;
}

export function clearError(dom) {
  if (!dom?.hskError) return;
  dom.hskError.classList.add("hidden");
  dom.hskError.textContent = "";
}

export function scrollToTop() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }
}

export function renderFallback(dom, title, desc) {
  if (!dom?.hskGrid) return;
  dom.hskGrid.innerHTML = "";
  const box = document.createElement("div");
  box.className = "bg-white rounded-2xl shadow p-4";
  box.innerHTML = `
    <div class="text-lg font-semibold">${title}</div>
    <div class="text-sm text-gray-600 mt-2 whitespace-pre-wrap">${desc || ""}</div>
  `;
  dom.hskGrid.appendChild(box);
}

export function renderEmptyHint(container, title, desc) {
  if (!container) return;
  const card = document.createElement("div");
  card.className = "bg-white rounded-2xl shadow p-4 text-sm text-gray-600";
  card.innerHTML = `
    <div class="font-semibold text-gray-800">${title}</div>
    <div class="mt-1 whitespace-pre-wrap">${desc || ""}</div>
  `;
  container.appendChild(card);
}

export function renderTopBar({ title, subtitle, leftBtn, rightBtns = [] }) {
  const top = document.createElement("div");
  top.className =
    "bg-white rounded-2xl shadow p-4 mb-3 flex items-center justify-between gap-2";

  const rightHtml = rightBtns
    .map(
      (b) =>
        `<button data-key="${b.key}" class="px-3 py-2 rounded-lg ${
          b.className || "bg-slate-100"
        } text-sm">${b.text}</button>`
    )
    .join("");

  top.innerHTML = `
    <div>
      <div class="text-lg font-semibold">${title || ""}</div>
      <div class="text-sm text-gray-600 mt-1">${subtitle || ""}</div>
    </div>
    <div class="flex gap-2 items-center">
      ${
        leftBtn
          ? `<button data-key="${leftBtn.key}" class="px-3 py-2 rounded-lg ${
              leftBtn.className || "bg-slate-100"
            } text-sm">${leftBtn.text}</button>`
          : ""
      }
      ${rightHtml}
    </div>
  `;
  return top;
}
