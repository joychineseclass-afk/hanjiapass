#!/usr/bin/env node
/**
 * Expand data/vocab/hsk3.0/hsk1.json to 300 entries.
 * Run: node scripts/expand-hsk3-vocab.js
 */
const fs = require("fs");
const path = require("path");

const hsk20Path = path.join(__dirname, "../data/vocab/hsk2.0/hsk1.json");
const hsk30Path = path.join(__dirname, "../data/vocab/hsk3.0/hsk1.json");
const outPath = path.join(__dirname, "../data/vocab/hsk3.0/hsk1.json");

const hsk20 = JSON.parse(fs.readFileSync(hsk20Path, "utf8"));
const hsk30 = JSON.parse(fs.readFileSync(hsk30Path, "utf8"));

const seen = new Set();
const result = [];

function toEntry(raw, generated = false) {
  const word = raw.word || raw.hanzi || "";
  const m = raw.meaning || {};
  const meaning = {
    ko: m.ko || m.kr || "",
    en: m.en || "",
    zh: m.zh || m.cn || word,
  };
  const ex = raw.example || {};
  const example =
    ex.zh || ex.ko || ex.en
      ? { zh: ex.zh || ex.cn || "", ko: ex.ko || ex.kr || "", en: ex.en || "" }
      : undefined;
  const tags = {};
  if (raw.lesson != null) tags.lesson = Number(raw.lesson);
  if (raw.lesson_title) tags.lesson_title = String(raw.lesson_title);
  if (generated) tags.generated = true;
  return {
    word,
    pinyin: raw.pinyin || raw.py || "",
    meaning,
    ...(example && Object.values(example).some(Boolean) ? { example } : {}),
    ...(Object.keys(tags).length ? { tags } : {}),
  };
}

for (const r of hsk30) {
  const w = (r.word || r.hanzi || "").trim();
  if (!w || seen.has(w)) continue;
  seen.add(w);
  result.push(toEntry(r, false));
}

for (const r of hsk20) {
  const w = (r.word || r.hanzi || "").trim();
  if (!w || seen.has(w)) continue;
  seen.add(w);
  const m = r.meaning || {};
  const entry = {
    word: w,
    pinyin: r.pinyin || "",
    meaning: {
      ko: m.kr || m.ko || "",
      en: m.en || "",
      zh: m.zh || m.cn || w,
    },
  };
  result.push(toEntry(entry, true));
}

const EXTRA = [
  ["爱好", "ài hào", "취미", "hobby"],
  ["吧", "ba", "문미 조사", "particle"],
  ["白", "bái", "흰색", "white"],
  ["白天", "bái tiān", "낮", "daytime"],
  ["百", "bǎi", "100", "hundred"],
  ["班", "bān", "반", "class"],
  ["半", "bàn", "절반", "half"],
  ["帮", "bāng", "돕다", "help"],
  ["帮忙", "bāng máng", "도움을 주다", "help"],
  ["包", "bāo", "가방", "bag"],
  ["北", "běi", "북쪽", "north"],
  ["本子", "běn zi", "노트", "notebook"],
  ["比", "bǐ", "~보다", "than"],
  ["别", "bié", "~하지 마", "don't"],
  ["别人", "bié ren", "다른 사람", "others"],
  ["病", "bìng", "병", "illness"],
  ["不对", "bù duì", "틀리다", "wrong"],
  ["不用", "bù yòng", "필요 없다", "need not"],
  ["唱", "chàng", "노래하다", "sing"],
  ["车", "chē", "차", "vehicle"],
  ["出", "chū", "나오다", "go out"],
  ["穿", "chuān", "입다", "wear"],
  ["床", "chuáng", "침대", "bed"],
  ["次", "cì", "번", "time"],
  ["从", "cóng", "~에서", "from"],
  ["错", "cuò", "틀리다", "wrong"],
  ["打", "dǎ", "치다", "hit"],
  ["到", "dào", "도착하다", "arrive"],
  ["等", "děng", "기다리다", "wait"],
  ["弟弟", "dì di", "남동생", "younger brother"],
  ["第", "dì", "서수", "ordinal"],
  ["电话", "diàn huà", "전화", "phone"],
  ["东", "dōng", "동쪽", "east"],
  ["对", "duì", "맞다", "correct"],
  ["饿", "è", "배고프다", "hungry"],
  ["饭", "fàn", "밥", "meal"],
  ["房间", "fáng jiān", "방", "room"],
  ["房子", "fáng zi", "집", "house"],
  ["飞", "fēi", "날다", "fly"],
  ["高", "gāo", "높다", "tall"],
  ["告诉", "gào su", "알려주다", "tell"],
  ["哥", "gē", "형", "older brother"],
  ["跟", "gēn", "~와", "with"],
  ["关", "guān", "닫다", "close"],
  ["贵", "guì", "비싸다", "expensive"],
  ["国", "guó", "나라", "country"],
  ["过", "guò", "지나다", "pass"],
  ["还", "hái", "아직", "still"],
  ["喊", "hǎn", "부르다", "shout"],
  ["黑", "hēi", "검정", "black"],
  ["红", "hóng", "빨강", "red"],
  ["后", "hòu", "뒤", "behind"],
  ["黄", "huáng", "노랑", "yellow"],
  ["回", "huí", "돌아가다", "return"],
  ["会", "huì", "할 줄 알다", "can"],
  ["件", "jiàn", "건", "piece"],
  ["教", "jiào", "가르치다", "teach"],
  ["接", "jiē", "받다", "receive"],
  ["进", "jìn", "들어가다", "enter"],
  ["近", "jìn", "가깝다", "near"],
  ["就", "jiù", "곧", "right away"],
  ["觉得", "jué de", "~라고 생각하다", "feel"],
  ["口", "kǒu", "입", "mouth"],
  ["快", "kuài", "빠르다", "fast"],
  ["蓝", "lán", "파랑", "blue"],
  ["老", "lǎo", "늙다", "old"],
  ["累", "lèi", "피곤하다", "tired"],
  ["两", "liǎng", "둘", "two"],
  ["绿", "lǜ", "초록", "green"],
  ["慢", "màn", "느리다", "slow"],
  ["忙", "máng", "바쁘다", "busy"],
  ["门", "mén", "문", "door"],
  ["拿", "ná", "들다", "take"],
  ["您", "nín", "당신 (경어)", "you (formal)"],
  ["女", "nǚ", "여성", "female"],
  ["跑", "pǎo", "뛰다", "run"],
  ["票", "piào", "표", "ticket"],
  ["破", "pò", "깨지다", "broken"],
  ["骑", "qí", "타다", "ride"],
  ["起", "qǐ", "일어나다", "get up"],
  ["请", "qǐng", "청하다", "please"],
  ["让", "ràng", "~하게 하다", "let"],
  ["日", "rì", "날", "day"],
  ["容易", "róng yì", "쉽다", "easy"],
  ["色", "sè", "색", "color"],
  ["山", "shān", "산", "mountain"],
  ["身体", "shēn tǐ", "몸", "body"],
  ["生", "shēng", "생기다", "grow"],
  ["声", "shēng", "소리", "sound"],
  ["时间", "shí jiān", "시간", "time"],
  ["事", "shì", "일", "matter"],
  ["试", "shì", "시도하다", "try"],
  ["送", "sòng", "보내다", "send"],
  ["它", "tā", "그(사물)", "it"],
  ["踢", "tī", "차다", "kick"],
  ["题", "tí", "문제", "question"],
  ["跳", "tiào", "뛰다", "jump"],
  ["听", "tīng", "듣다", "listen"],
  ["停", "tíng", "멈추다", "stop"],
  ["通", "tōng", "통하다", "through"],
  ["头", "tóu", "머리", "head"],
  ["往", "wǎng", "~로", "toward"],
  ["为", "wèi", "~을 위해", "for"],
  ["问", "wèn", "묻다", "ask"],
  ["西", "xī", "서쪽", "west"],
  ["希望", "xī wàng", "희망하다", "hope"],
  ["洗", "xǐ", "씻다", "wash"],
  ["新", "xīn", "새롭다", "new"],
  ["信", "xìn", "편지", "letter"],
  ["需要", "xū yào", "필요하다", "need"],
  ["一边", "yī biān", "한편", "while"],
  ["一定", "yī dìng", "반드시", "certainly"],
  ["一起", "yī qǐ", "함께", "together"],
  ["已经", "yǐ jīng", "이미", "already"],
  ["以为", "yǐ wéi", "~라고 생각하다", "think"],
  ["因为", "yīn wèi", "~때문에", "because"],
  ["用", "yòng", "사용하다", "use"],
  ["远", "yuǎn", "멀다", "far"],
  ["再", "zài", "다시", "again"],
  ["早", "zǎo", "이르다", "early"],
  ["站", "zhàn", "서다", "stand"],
  ["张", "zhāng", "장", "sheet"],
  ["找", "zhǎo", "찾다", "find"],
  ["着", "zhe", "~하고 있다", "aspect"],
  ["真", "zhēn", "정말", "really"],
  ["只", "zhǐ", "단지", "only"],
  ["中", "zhōng", "중", "middle"],
  ["重", "zhòng", "무겁다", "heavy"],
  ["走", "zǒu", "걷다", "walk"],
  ["最", "zuì", "가장", "most"],
  ["昨天", "zuó tiān", "어제", "yesterday"],
  ["你好", "nǐ hǎo", "안녕하세요", "hello"],
  ["您好", "nín hǎo", "안녕하세요 (경어)", "hello (formal)"],
];

for (const [word, py, ko, en] of EXTRA) {
  if (seen.has(word)) continue;
  seen.add(word);
  result.push(
    toEntry(
      {
        word,
        pinyin: py,
        meaning: { ko, en, zh: word },
      },
      true
    )
  );
}

while (result.length < 300) {
  const more = [
    ["刚", "gāng", "방금", "just now"],
    ["光", "guāng", "빛", "light"],
    ["河", "hé", "강", "river"],
    ["画", "huà", "그림", "painting"],
    ["火", "huǒ", "불", "fire"],
    ["极", "jí", "극도로", "extremely"],
    ["间", "jiān", "사이", "between"],
    ["角", "jiǎo", "모서리", "corner"],
    ["脚", "jiǎo", "발", "foot"],
    ["姐", "jiě", "누나", "older sister"],
    ["经", "jīng", "경험하다", "experience"],
    ["刻", "kè", "15분", "quarter"],
    ["刻", "kè", "새기다", "carve"],
  ];
  for (const [word, py, ko, en] of more) {
    if (result.length >= 300) break;
    const key = word + py;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(
      toEntry(
        {
          word,
          pinyin: py,
          meaning: { ko, en, zh: word },
        },
        true
      )
    );
  }
  if (result.length < 300) break;
}

fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
console.log(`Wrote ${result.length} entries to ${outPath}`);
