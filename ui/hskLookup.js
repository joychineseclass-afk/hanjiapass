// ui/hskLookup.js
// 在 HSK1~9 词库里查：支持“按词精确匹配” + “按字符包含匹配”

function guessLangKey(item) {
  // 兼容不同字段命名
  return (
    item.kr || item.ko || item.korean || item.meaning_kr || item.translation_kr || ""
  );
}

function guessWordKey(item) {
  return item.word || item.hanzi || item.cn || item.zh || item.term || "";
}

function guessPinyinKey(item) {
  return item.pinyin || item.py || item.pinyin_num || "";
}

function guessExample(item) {
  // 兼容多种例句字段
  const cn = item.example_cn || item.ex_cn || item.sentence_cn || item.sentence || "";
  const py = item.example_py || item.ex_py || item.sentence_py || item.pinyin_sentence || "";
  const kr = item.example_kr || item.ex_kr || item.sentence_kr || item.translation || "";
  return { cn, py, kr };
}

async function loadLevel(level) {
  // 这里你按自己的真实路径改一下即可
  const url = `./data/hsk/hsk${level}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HSK_LOAD_FAIL_" + level);
  return await res.json();
}

let CACHE = null;

// 预加载：一次性把 HSK1~9 拉到内存（小规模很快，静态站也OK）
export async function preloadHSK() {
  if (CACHE) return CACHE;
  CACHE = [];
  for (let lvl = 1; lvl <= 9; lvl++) {
    try {
      const data = await loadLevel(lvl);
      CACHE.push({ level: lvl, data });
    } catch (e) {
      // 某级不存在也不阻断
      // console.warn(e);
    }
  }
  return CACHE;
}

function iterItems(levelData) {
  // 兼容数组 / {list:[]} / {data:[]}
  if (Array.isArray(levelData)) return levelData;
  if (Array.isArray(levelData.list)) return levelData.list;
  if (Array.isArray(levelData.data)) return levelData.data;
  return [];
}

export async function findInHSK(queryCharOrWord, { max = 20 } = {}) {
  const q = String(queryCharOrWord || "").trim();
  if (!q) return [];

  const packs = await preloadHSK();
  const hits = [];

  for (const pack of packs) {
    const items = iterItems(pack.data);

    for (const item of items) {
      const w = String(guessWordKey(item) || "");
      if (!w) continue;

      // 命中规则：精确匹配优先；否则包含（用于输入单个字）
      const isExact = w === q;
      const isContain = !isExact && w.includes(q);

      if (!isExact && !isContain) continue;

      const kr = guessLangKey(item);
      const py = guessPinyinKey(item);
      const ex = guessExample(item);

      hits.push({
        level: pack.level,
        word: w,
        pinyin: py,
        kr,
        example: ex,
        exact: isExact
      });

      if (hits.length >= max) break;
    }
    if (hits.length >= max) break;
  }

  // 排序：精确 > HSK等级低的优先（更常用）
  hits.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return a.level - b.level;
  });

  return hits;
}
