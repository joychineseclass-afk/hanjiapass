/* =========================================
   📘 HSK UI CONTROLLER
   页面交互层（连接 Loader / Renderer / History）
========================================= */

import { loadHSKLevel } from "./hskLoader.js";
import { renderHSKGrid } from "./hskRenderer.js";
import { saveHistory } from "./hskHistory.js";

let currentLevel = 1;
let allWords = [];

/* ===============================
   页面入口（由 page.hsk.js 调用）
================================== */
export function initHSKUI() {
  cacheDOM();
  bindEvents();
  loadLevel(currentLevel);
}

/* ===============================
   DOM 缓存
================================== */
let dom = {};

function cacheDOM() {
  dom.levelSelect = document.getElementById("hskLevel");
  dom.searchInput = document.getElementById("hskSearch");
  dom.grid = document.getElementById("hskGrid");
  dom.status = document.getElementById("hskStatus");
  dom.error = document.getElementById("hskError");
}

/* ===============================
   事件绑定
================================== */
function bindEvents() {
  dom.levelSelect?.addEventListener("change", (e) => {
    currentLevel = Number(e.target.value);
    loadLevel(currentLevel);
  });

  dom.searchInput?.addEventListener("input", (e) => {
    filterWords(e.target.value.trim());
  });
}

/* ===============================
   加载某个等级
================================== */
async function loadLevel(level) {
  setStatus(`HSK ${level} 로딩 중…`);
  hideError();

  try {
    allWords = await loadHSKLevel(level);
    renderHSKGrid(dom.grid, allWords, handleWordClick);
    setStatus(`HSK ${level} 준비 완료`);
  } catch (err) {
    showError("단어 데이터를 불러오지 못했습니다.");
    console.error(err);
  }
}

/* ===============================
   搜索过滤
================================== */
function filterWords(keyword) {
  if (!keyword) {
    renderHSKGrid(dom.grid, allWords, handleWordClick);
    return;
  }

  const lower = keyword.toLowerCase();
  const filtered = allWords.filter(w =>
    w.simplified?.includes(keyword) ||
    w.traditional?.includes(keyword) ||
    w.pinyin?.toLowerCase().includes(lower) ||
    w.meaning?.toLowerCase().includes(lower)
  );

  renderHSKGrid(dom.grid, filtered, handleWordClick);
}

/* ===============================
   单词卡点击事件
================================== */
function handleWordClick(word) {
  saveHistory(word);
  window.dispatchEvent(new CustomEvent("openLearnPanel", { detail: word }));
}

/* ===============================
   UI 辅助函数
================================== */
function setStatus(msg) {
  if (dom.status) dom.status.textContent = msg;
}

function showError(msg) {
  if (!dom.error) return;
  dom.error.classList.remove("hidden");
  dom.error.textContent = msg;
}

function hideError() {
  if (!dom.error) return;
  dom.error.classList.add("hidden");
  dom.error.textContent = "";
}
