// /ui/pages/hsk/utils.js
export function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function pickTextAny(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return v.ko || v.kr || v.zh || v.cn || v.en || "";
  return String(v);
}

export function normalizeTabKey(key, label) {
  const k = String(key || "").toLowerCase();
  const L = String(label || "").trim();

  if (k === "words" || L === "단어" || L === "词" || L === "单词") return "words";
  if (k === "dialogue" || L === "회화" || L === "会话" || L === "對話" || L === "对话") return "dialogue";
  if (k === "grammar" || L === "문법" || L === "语法") return "grammar";
  if (k === "practice" || L === "연습" || L === "练习") return "practice";
  if (k === "ai" || L === "AI" || L.toLowerCase() === "ai") return "ai";
  return "";
}

export function renderListBlock(subtitle, data, emptyText) {
  const list = Array.isArray(data) ? data : (data ? [data] : []);
  const items = list
    .map((x) => {
      if (typeof x === "string") return `<li class="py-2 border-b last:border-b-0">${escapeHTML(x)}</li>`;
      if (typeof x === "object") return `<li class="py-2 border-b last:border-b-0"><pre class="text-xs whitespace-pre-wrap">${escapeHTML(JSON.stringify(x, null, 2))}</pre></li>`;
      return "";
    })
    .filter(Boolean)
    .join("");

  return `
    <div class="p-4">
      ${subtitle ? `<div class="text-sm text-gray-500 mb-3">${escapeHTML(subtitle)}</div>` : ""}
      ${
        items
          ? `<ul class="rounded-2xl border px-4">${items}</ul>`
          : `<div class="rounded-2xl border p-6 text-sm text-gray-500">${escapeHTML(emptyText)}</div>`
      }
    </div>
  `;
}
