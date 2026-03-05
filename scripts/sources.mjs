/**
 * HSK 词表数据来源配置
 *
 * 主来源（采用）:
 * - HSK 2.0: https://github.com/drkameleon/complete-hsk-vocabulary
 *   wordlists/inclusive/old/{1-6}.json (MIT)
 * - HSK 3.0: https://github.com/koynoyno/hsk3.0-json
 *   hsk1.json ~ hsk6.json, hsk7-9.json
 *
 * 备选来源:
 * - https://github.com/elkmovie/hsk30 (HSK 3.0 CSV)
 * - https://github.com/andycburke/HSK-3.0-Word-List (官方 PDF 提取)
 */

const BASE = {
  drkameleon: "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main",
  koynoyno: "https://raw.githubusercontent.com/koynoyno/hsk3.0-json/main",
};

export const SOURCES = {
  "hsk2.0": {
    hsk1: {
      url: `${BASE.drkameleon}/wordlists/inclusive/old/1.json`,
      format: "json",
      parse: "drkameleon",
    },
    hsk2: {
      url: `${BASE.drkameleon}/wordlists/inclusive/old/2.json`,
      format: "json",
      parse: "drkameleon",
    },
    hsk3: {
      url: `${BASE.drkameleon}/wordlists/inclusive/old/3.json`,
      format: "json",
      parse: "drkameleon",
    },
    hsk4: {
      url: `${BASE.drkameleon}/wordlists/inclusive/old/4.json`,
      format: "json",
      parse: "drkameleon",
    },
    hsk5: {
      url: `${BASE.drkameleon}/wordlists/inclusive/old/5.json`,
      format: "json",
      parse: "drkameleon",
    },
    hsk6: {
      url: `${BASE.drkameleon}/wordlists/inclusive/old/6.json`,
      format: "json",
      parse: "drkameleon",
    },
  },
  "hsk3.0": {
    hsk1: {
      url: `${BASE.koynoyno}/hsk1.json`,
      format: "json",
      parse: "koynoyno",
    },
    hsk2: {
      url: `${BASE.koynoyno}/hsk2.json`,
      format: "json",
      parse: "koynoyno",
    },
    hsk3: {
      url: `${BASE.koynoyno}/hsk3.json`,
      format: "json",
      parse: "koynoyno",
    },
    hsk4: {
      url: `${BASE.koynoyno}/hsk4.json`,
      format: "json",
      parse: "koynoyno",
    },
    hsk5: {
      url: `${BASE.koynoyno}/hsk5.json`,
      format: "json",
      parse: "koynoyno",
    },
    hsk6: {
      url: `${BASE.koynoyno}/hsk6.json`,
      format: "json",
      parse: "koynoyno",
    },
    "hsk7-9": {
      url: `${BASE.koynoyno}/hsk7-9.json`,
      format: "json",
      parse: "koynoyno",
    },
  },
};

/** 解析 drkameleon 格式: { simplified, forms: [{ transcriptions: { pinyin }, meanings: [] }] } */
export function parseDrkameleon(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const hanzi = String(item?.simplified ?? "").trim();
      if (!hanzi) return null;
      const form = item?.forms?.[0];
      const pinyin = form?.transcriptions?.pinyin
        ? String(form.transcriptions.pinyin).replace(/\s+/g, "").trim()
        : "";
      const meanings = form?.meanings ?? [];
      const en = Array.isArray(meanings) ? meanings.join("; ") : String(meanings ?? "");
      return { hanzi, pinyin, meaning: { zh: hanzi, en, ko: "" } };
    })
    .filter(Boolean);
}

/** 解析 koynoyno 格式: { words: [{ simplified, pinyin, english }] } 或 根级 words 数组 */
export function parseKoynoyno(raw) {
  let arr = raw?.words ?? (Array.isArray(raw) ? raw : []);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      const hanzi = String(item?.simplified ?? item?.hanzi ?? item?.word ?? "").trim();
      if (!hanzi) return null;
      const pinyin = String(item?.pinyin ?? "").trim();
      const en = String(item?.english ?? item?.en ?? "").trim();
      return { hanzi, pinyin, meaning: { zh: hanzi, en, ko: "" } };
    })
    .filter(Boolean);
}

export function parseRaw(data, strategy) {
  if (strategy === "drkameleon") return parseDrkameleon(data);
  if (strategy === "koynoyno") return parseKoynoyno(data);
  return [];
}
