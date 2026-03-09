#!/usr/bin/env node
/**
 * Generate HSK2 course blueprint.json
 * HSK2 new words = 147 (from hsk2.json - hsk1.json)
 * Distribution: L1-10: 7 each, L11-19: 8 each, L20: 7 = 147
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const hsk1 = JSON.parse(readFileSync(join(root, 'data/vocab/hsk2.0/hsk1.json'), 'utf8'));
const hsk2 = JSON.parse(readFileSync(join(root, 'data/vocab/hsk2.0/hsk2.json'), 'utf8'));
const hsk1Hanzi = new Set(hsk1.map(w => w.hanzi));
const hsk2NewRaw = hsk2.filter(w => !hsk1Hanzi.has(w.hanzi));

// POS mapping (simplified)
const posMap = {
  n: 'n', v: 'v', vn: 'v', adj: 'adj', adv: 'adv', m: 'm', t: 't',
  y: 'particle', b: 'aux', p: 'prep', c: 'conj', r: 'pron', q: 'pron'
};

// KR/JP translations for HSK2 new words (manual mapping for common words)
const trans = {
  '吧': { kr: '~자 (제안)', jp: '〜しましょう（提案）', pos: 'particle', en: 'suggestion particle' },
  '白': { kr: '흰색', jp: '白い', pos: 'adj' },
  '百': { kr: '백', jp: '百', pos: 'num' },
  '帮助': { kr: '돕다', jp: '助ける', pos: 'v' },
  '报纸': { kr: '신문', jp: '新聞', pos: 'n' },
  '比': { kr: '~보다', jp: '〜より', pos: 'prep' },
  '便宜': { kr: '싸다', jp: '安い', pos: 'adj' },
  '别': { kr: '~하지 마', jp: '〜するな', pos: 'adv' },
  '唱歌': { kr: '노래하다', jp: '歌う', pos: 'v' },
  '出': { kr: '나가다', jp: '出る', pos: 'v' },
  '穿': { kr: '입다', jp: '着る', pos: 'v' },
  '船': { kr: '배', jp: '船', pos: 'n' },
  '次': { kr: '번', jp: '回', pos: 'm' },
  '从': { kr: '~에서', jp: '〜から', pos: 'prep' },
  '错': { kr: '틀리다', jp: '間違う', pos: 'adj' },
  '打篮球': { kr: '농구하다', jp: 'バスケをする', pos: 'v' },
  '大家': { kr: '모두', jp: 'みんな', pos: 'pron' },
  '但是': { kr: '그러나', jp: 'しかし', pos: 'conj' },
  '到': { kr: '~까지', jp: '〜まで', pos: 'prep' },
  '得': { kr: '~해야 하다', jp: '〜しなければならない', pos: 'aux' },
  '弟弟': { kr: '남동생', jp: '弟', pos: 'n' },
  '第一': { kr: '첫 번째', jp: '第一', pos: 'num' },
  '懂': { kr: '이해하다', jp: '分かる', pos: 'v' },
  '房间': { kr: '방', jp: '部屋', pos: 'n' },
  '非常': { kr: '매우', jp: '非常に', pos: 'adv' },
  '服务员': { kr: '웨이터', jp: '店員', pos: 'n' },
  '高': { kr: '높다', jp: '高い', pos: 'adj' },
  '告诉': { kr: '알려주다', jp: '教える', pos: 'v' },
  '哥哥': { kr: '형/오빠', jp: '兄', pos: 'n' },
  '给': { kr: '~에게', jp: '〜に', pos: 'prep' },
  '公共汽车': { kr: '버스', jp: 'バス', pos: 'n' },
  '公斤': { kr: '킬로', jp: 'キロ', pos: 'm' },
  '公司': { kr: '회사', jp: '会社', pos: 'n' },
  '贵': { kr: '비싸다', jp: '高い', pos: 'adj' },
  '还': { kr: '아직', jp: 'まだ', pos: 'adv' },
  '孩子': { kr: '아이', jp: '子供', pos: 'n' },
  '好吃': { kr: '맛있다', jp: '美味しい', pos: 'adj' },
  '号': { kr: '호/번', jp: '号', pos: 'n' },
  '黑': { kr: '검은색', jp: '黒い', pos: 'adj' },
  '红': { kr: '빨간색', jp: '赤い', pos: 'adj' },
  '欢迎': { kr: '환영하다', jp: '歓迎する', pos: 'v' },
  '回答': { kr: '답하다', jp: '答える', pos: 'v' },
  '机场': { kr: '공항', jp: '空港', pos: 'n' },
  '鸡蛋': { kr: '계란', jp: '卵', pos: 'n' },
  '件': { kr: '건', jp: '件', pos: 'm' },
  '教室': { kr: '교실', jp: '教室', pos: 'n' },
  '介绍': { kr: '소개하다', jp: '紹介する', pos: 'v' },
  '姐姐': { kr: '누나/언니', jp: '姉', pos: 'n' },
  '近': { kr: '가깝다', jp: '近い', pos: 'adj' },
  '进': { kr: '들어가다', jp: '入る', pos: 'v' },
  '就': { kr: '바로', jp: 'すぐに', pos: 'adv' },
  '觉得': { kr: '~라고 생각하다', jp: '〜と思う', pos: 'v' },
  '咖啡': { kr: '커피', jp: 'コーヒー', pos: 'n' },
  '开始': { kr: '시작하다', jp: '始める', pos: 'v' },
  '考试': { kr: '시험', jp: '試験', pos: 'n' },
  '可能': { kr: '아마', jp: 'かもしれない', pos: 'adv' },
  '可以': { kr: '~할 수 있다', jp: '〜できる', pos: 'aux' },
  '课': { kr: '수업', jp: '授業', pos: 'n' },
  '快': { kr: '빠르다', jp: '速い', pos: 'adj' },
  '快乐': { kr: '즐겁다', jp: '楽しい', pos: 'adj' },
  '累': { kr: '피곤하다', jp: '疲れる', pos: 'adj', en: 'tired' },
  '离': { kr: '~에서 떨어지다', jp: '〜から離れる', pos: 'prep' },
  '两': { kr: '두', jp: '二つ', pos: 'num' },
  '路': { kr: '길', jp: '道', pos: 'n' },
  '旅游': { kr: '여행', jp: '旅行', pos: 'n' },
  '卖': { kr: '팔다', jp: '売る', pos: 'v' },
  '慢': { kr: '느리다', jp: '遅い', pos: 'adj' },
  '忙': { kr: '바쁘다', jp: '忙しい', pos: 'adj' },
  '每': { kr: '매', jp: '毎', pos: 'adv' },
  '妹妹': { kr: '여동생', jp: '妹', pos: 'n' },
  '门': { kr: '문', jp: 'ドア', pos: 'n' },
  '男人': { kr: '남자', jp: '男性', pos: 'n' },
  '您': { kr: '당신 (존칭)', jp: 'あなた（敬称）', pos: 'pron' },
  '牛奶': { kr: '우유', jp: '牛乳', pos: 'n' },
  '女人': { kr: '여자', jp: '女性', pos: 'n' },
  '旁边': { kr: '옆', jp: '隣', pos: 'n' },
  '跑步': { kr: '달리다', jp: '走る', pos: 'v' },
  '票': { kr: '표', jp: '切符', pos: 'n' },
  '妻子': { kr: '아내', jp: '妻', pos: 'n' },
  '起床': { kr: '일어나다', jp: '起きる', pos: 'v' },
  '千': { kr: '천', jp: '千', pos: 'num' },
  '晴': { kr: '맑다', jp: '晴れる', pos: 'adj' },
  '去年': { kr: '작년', jp: '去年', pos: 'n' },
  '让': { kr: '~하게 하다', jp: '〜させる', pos: 'v' },
  '上班': { kr: '출근하다', jp: '出勤する', pos: 'v' },
  '身体': { kr: '몸', jp: '体', pos: 'n' },
  '生病': { kr: '병나다', jp: '病気になる', pos: 'v' },
  '生日': { kr: '생일', jp: '誕生日', pos: 'n' },
  '时间': { kr: '시간', jp: '時間', pos: 'n' },
  '事情': { kr: '일', jp: 'こと', pos: 'n' },
  '手表': { kr: '손목시계', jp: '腕時計', pos: 'n' },
  '手机': { kr: '휴대폰', jp: '携帯', pos: 'n' },
  '送': { kr: '보내다', jp: '送る', pos: 'v' },
  '所以': { kr: '그래서', jp: 'だから', pos: 'conj' },
  '它': { kr: '그것', jp: 'それ', pos: 'pron' },
  '踢': { kr: '차다', jp: '蹴る', pos: 'v' },
  '题': { kr: '문제', jp: '問題', pos: 'n' },
  '跳舞': { kr: '춤추다', jp: '踊る', pos: 'v' },
  '外': { kr: '밖', jp: '外', pos: 'n' },
  '完': { kr: '끝나다', jp: '終わる', pos: 'v' },
  '玩': { kr: '놀다', jp: '遊ぶ', pos: 'v' },
  '晚上': { kr: '저녁', jp: '夜', pos: 'n' },
  '为': { kr: '~를 위해', jp: '〜のために', pos: 'prep' },
  '问': { kr: '묻다', jp: '聞く', pos: 'v' },
  '问题': { kr: '문제', jp: '問題', pos: 'n' },
  '希望': { kr: '희망하다', jp: '希望する', pos: 'v' },
  '洗': { kr: '씻다', jp: '洗う', pos: 'v' },
  '西瓜': { kr: '수박', jp: 'スイカ', pos: 'n' },
  '向': { kr: '~쪽으로', jp: '〜へ', pos: 'prep' },
  '小时': { kr: '시간', jp: '時間', pos: 'n' },
  '笑': { kr: '웃다', jp: '笑う', pos: 'v' },
  '新': { kr: '새로운', jp: '新しい', pos: 'adj' },
  '姓': { kr: '성', jp: '姓', pos: 'n' },
  '休息': { kr: '쉬다', jp: '休む', pos: 'v' },
  '雪': { kr: '눈', jp: '雪', pos: 'n' },
  '颜色': { kr: '색', jp: '色', pos: 'n' },
  '眼睛': { kr: '눈', jp: '目', pos: 'n' },
  '羊肉': { kr: '양고기', jp: '羊肉', pos: 'n' },
  '药': { kr: '약', jp: '薬', pos: 'n' },
  '要': { kr: '~해야 하다', jp: '〜しなければならない', pos: 'aux' },
  '也': { kr: '~도', jp: '〜も', pos: 'adv' },
  '一起': { kr: '함께', jp: '一緒に', pos: 'adv' },
  '已经': { kr: '이미', jp: 'もう', pos: 'adv' },
  '意思': { kr: '의미', jp: '意味', pos: 'n' },
  '因为': { kr: '~때문에', jp: '〜だから', pos: 'conj' },
  '阴': { kr: '흐리다', jp: '曇り', pos: 'adj' },
  '游泳': { kr: '수영하다', jp: '泳ぐ', pos: 'v' },
  '右边': { kr: '오른쪽', jp: '右', pos: 'n' },
  '鱼': { kr: '물고기', jp: '魚', pos: 'n' },
  '元': { kr: '위안', jp: '元', pos: 'm' },
  '远': { kr: '멀다', jp: '遠い', pos: 'adj' },
  '运动': { kr: '운동', jp: '運動', pos: 'n' },
  '再': { kr: '다시', jp: 'もう一度', pos: 'adv' },
  '早上': { kr: '아침', jp: '朝', pos: 'n' },
  '张': { kr: '장', jp: '枚', pos: 'm' },
  '长': { kr: '길다', jp: '長い', pos: 'adj' },
  '丈夫': { kr: '남편', jp: '夫', pos: 'n' },
  '找': { kr: '찾다', jp: '探す', pos: 'v' },
  '着': { kr: '~하고 있다', jp: '〜している', pos: 'particle' },
  '真': { kr: '정말', jp: '本当に', pos: 'adv' },
  '正在': { kr: '~하고 있다', jp: '〜している', pos: 'adv' },
  '知道': { kr: '알다', jp: '知る', pos: 'v' },
  '准备': { kr: '준비하다', jp: '準備する', pos: 'v' },
  '自行车': { kr: '자전거', jp: '自転車', pos: 'n' },
  '走': { kr: '걷다', jp: '歩く', pos: 'v' },
  '最': { kr: '가장', jp: '最も', pos: 'adv' },
  '左边': { kr: '왼쪽', jp: '左', pos: 'n' }
};

// Theme-based vocab distribution (HSK2 new words only, 147 total)
// L1-10: 7 each = 70, L11-19: 8 each = 72, L20: 5 = 147
const VOCAB_BY_LESSON = [
  ['忙', '累', '吧', '但是', '得', '每', '已经'],  // 1 你今天忙吗
  ['哥哥', '弟弟', '姐姐', '妹妹', '孩子', '大家', '介绍'],  // 2 这是我的家人
  ['给', '告诉', '懂', '欢迎', '回答', '可能', '可以'],  // 3 这是我的朋友
  ['一起', '好吃', '服务员', '咖啡', '牛奶', '房间', '两'],  // 4 我们一起去吃饭吧
  ['号', '件', '鸡蛋', '元', '张', '要', '百'],  // 5 你想喝什么
  ['手表', '手机', '小时', '快', '慢', '就', '时间'],  // 6 现在几点了
  ['穿', '雪', '晴', '阴', '非常', '黑', '红'],  // 7 今天很冷
  ['休息', '玩', '唱歌', '跳舞', '跑步', '晚上', '快乐'],  // 8 周末你做什么
  ['开始', '考试', '课', '懂', '时间', '第一', '报纸'],  // 9 我每天学习汉语 (懂重复-换) 每已在L1
  ['准备', '希望', '新', '姓', '意思', '告诉', '给'],  // 10 我准备学习中文 (给告诉重复-换)
  ['公司', '上班', '事情', '让', '完', '得', '但是', '累'],  // 11 他在学校工作
  ['可能', '完', '让', '找', '就', '已经', '再', '事情'],  // 12 他工作很努力 (完让事情重复-换)
  ['公共汽车', '自行车', '从', '到', '进', '出', '路', '走'],  // 13 我坐地铁去公司
  ['旅游', '票', '去年', '机场', '船', '送', '旁边', '外'],  // 14 我们一起去旅行吧
  ['千', '希望', '要', '也', '外', '元', '向', '最'],  // 15 明年我想去中国
  ['运动', '游泳', '打篮球', '踢', '身体', '快乐', '白', '次'],  // 16 我喜欢运动
  ['觉得', '真', '非常', '意思', '回答', '问题', '题', '懂'],  // 17 你觉得怎么样
  ['帮助', '让', '找', '问', '问题', '别', '您', '给'],  // 18 请你帮我一下
  ['比', '便宜', '贵', '远', '近', '最', '错', '长'],  // 19 这个比那个好
  ['因为', '所以', '完', '已经', '再']  // 20 因为下雨所以没去 (5 words)
];

// No duplicates - each of 147 words used exactly once
const VOCAB_BY_LESSON_FIXED = [
  ['忙', '累', '吧', '但是', '女人', '每', '教室'],  // 1 你今天忙吗
  ['哥哥', '弟弟', '姐姐', '妹妹', '孩子', '大家', '介绍'],  // 2 家人
  ['给', '告诉', '懂', '欢迎', '回答', '可能', '可以'],  // 3 朋友
  ['一起', '好吃', '服务员', '咖啡', '牛奶', '房间', '两'],  // 4 一起吃饭
  ['号', '件', '鸡蛋', '元', '张', '要', '百'],  // 5 喝什么
  ['手表', '手机', '小时', '快', '慢', '就', '时间'],  // 6 几点了
  ['穿', '雪', '晴', '阴', '非常', '黑', '红'],  // 7 今天很冷
  ['休息', '玩', '唱歌', '跳舞', '跑步', '晚上', '快乐'],  // 8 周末
  ['开始', '考试', '课', '离', '第一', '报纸', '门'],  // 9 每天学习
  ['准备', '希望', '新', '姓', '意思', '为', '知道'],  // 10 准备学习
  ['公司', '上班', '事情', '让', '男人', '得', '生病', '生日'],  // 11 (教室→得 for grammar)
  ['找', '着', '正在', '它', '鱼', '起床', '早上', '送'],  // 12 工作努力
  ['公共汽车', '自行车', '从', '到', '进', '出', '路', '走'],  // 13 坐地铁
  ['旅游', '票', '去年', '机场', '船', '旁边', '外', '卖'],  // 14 旅行
  ['千', '公斤', '也', '右边', '向', '最', '丈夫', '高'],  // 15 明年中国
  ['运动', '游泳', '打篮球', '踢', '身体', '次', '颜色', '白'],  // 16 运动
  ['觉得', '真', '问题', '题', '左边', '眼睛', '笑', '妻子'],  // 17 觉得
  ['帮助', '问', '别', '您', '洗', '药', '西瓜', '羊肉'],  // 18 请帮我
  ['比', '便宜', '贵', '远', '近', '错', '长', '还'],  // 19 比
  ['因为', '所以', '完', '已经', '再']  // 20 因为所以
];

const hsk2NewMap = new Map(hsk2NewRaw.map(w => [w.hanzi, w]));

function getLessonWords(hanziList) {
  return hanziList.map(hanzi => {
    const w = hsk2NewMap.get(hanzi);
    if (!w) throw new Error('Missing word: ' + hanzi);
    const t = trans[hanzi] || {};
    return {
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      en: (w.meaning && w.meaning.en) ? w.meaning.en.split(';')[0].split(',')[0].trim() : '',
      ...t
    };
  });
}

const lessonWords = VOCAB_BY_LESSON_FIXED.map(getLessonWords);

// Build newWords format for blueprint
function toNewWord(w) {
  const t = trans[w.hanzi] || {};
  return {
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    pos: t.pos || 'n',
    translations: {
      kr: t.kr || '',
      en: w.en || (hsk2NewRaw.find(x => x.hanzi === w.hanzi)?.meaning?.en?.split(';')[0] || ''),
      jp: t.jp || ''
    }
  };
}

const lessons = [];
let cumul = 0;

const titles = [
  { cn: '你今天忙吗', kr: '오늘 바빠요?', en: 'Are you busy today?', jp: '今日は忙しいですか？' },
  { cn: '这是我的家人', kr: '이것은 제 가족이에요', en: 'This is my family', jp: 'これは私の家族です' },
  { cn: '这是我的朋友', kr: '이것은 제 친구예요', en: 'This is my friend', jp: 'これは私の友達です' },
  { cn: '我们一起去吃饭吧', kr: '우리 함께 밥 먹으러 가요', en: "Let's eat together", jp: '一緒に食事に行きましょう' },
  { cn: '你想喝什么', kr: '뭐 마시고 싶어요?', en: 'What do you want to drink?', jp: '何を飲みたいですか？' },
  { cn: '现在几点了', kr: '지금 몇 시예요?', en: "What time is it now?", jp: '今何時ですか？' },
  { cn: '今天很冷', kr: '오늘 너무 추워요', en: "It's very cold today", jp: '今日はとても寒いです' },
  { cn: '周末你做什么', kr: '주말에 뭐 해요?', en: 'What do you do on weekends?', jp: '週末は何をしますか？' },
  { cn: '我每天学习汉语', kr: '저는 매일 중국어를 배워요', en: 'I study Chinese every day', jp: '私は毎日中国語を勉強します' },
  { cn: '我准备学习中文', kr: '저는 중국어 공부할 준비해요', en: "I'm preparing to study Chinese", jp: '私は中国語を勉強する準備をしています' },
  { cn: '他在学校工作', kr: '그는 학교에서 일해요', en: 'He works at school', jp: '彼は学校で働いています' },
  { cn: '他工作很努力', kr: '그는 일을 열심히 해요', en: 'He works very hard', jp: '彼は一生懸命働きます' },
  { cn: '我坐地铁去公司', kr: '저는 지하철 타고 회사에 가요', en: 'I take the subway to work', jp: '私は地下鉄で会社に行きます' },
  { cn: '我们一起去旅行吧', kr: '우리 함께 여행 가요', en: "Let's travel together", jp: '一緒に旅行に行きましょう' },
  { cn: '明年我想去中国', kr: '내년에 중국에 가고 싶어요', en: 'I want to go to China next year', jp: '来年中国に行きたいです' },
  { cn: '我喜欢运动', kr: '저는 운동을 좋아해요', en: 'I like sports', jp: '私は運動が好きです' },
  { cn: '你觉得怎么样', kr: '어때요?', en: 'What do you think?', jp: 'どう思いますか？' },
  { cn: '请你帮我一下', kr: '잠깐 도와주세요', en: 'Please help me', jp: 'ちょっと手伝ってください' },
  { cn: '这个比那个好', kr: '이게 그거보다 좋아요', en: 'This is better than that', jp: 'これはあれより良いです' },
  { cn: '因为下雨所以没去', kr: '비가 와서 가지 않았어요', en: "Because it rained, I didn't go", jp: '雨が降ったので行きませんでした' }
];

const grammarPlan = [
  { main: { name: '吗疑问句', focus: 'S + Adj + 吗？' }, support: [{ name: '形容词谓语句', focus: 'S + 很 + Adj' }, { name: '程度副词 很', focus: '很 + Adj' }] },
  { main: { name: '的 字结构（所属）', focus: '这/那 + 是 + N + 的' }, support: [{ name: '呢 疑问句', focus: '...呢？' }] },
  { main: { name: '介绍他人', focus: '这是 + N' }, support: [{ name: '给 + N + V', focus: '给 + 人 + 动词' }] },
  { main: { name: '吧 建议句', focus: '...一起 + V + 吧' }, support: [{ name: '一起', focus: '一起 + V' }] },
  { main: { name: '想 + V', focus: '想 + 动词' }, support: [{ name: '什么 疑问', focus: 'V + 什么？' }, { name: '可以', focus: '可以 + V' }] },
  { main: { name: '时间表达', focus: '现在 + 几 + 点 + 了？' }, support: [{ name: '点 / 分', focus: '数字 + 点 + 数字 + 分' }] },
  { main: { name: '形容词谓语句', focus: '今天 + 很 + Adj' }, support: [{ name: '程度副词 非常', focus: '非常 + Adj' }] },
  { main: { name: '时间词 + 做什么', focus: '周末 + 你 + 做什么？' }, support: [{ name: '在/正在', focus: '在 + V' }] },
  { main: { name: '每 + 时间', focus: '每 + 天/天 + V' }, support: [{ name: '能愿动词 可以', focus: '可以 + V' }] },
  { main: { name: '准备 + V', focus: '准备 + 动词' }, support: [{ name: '希望 + V', focus: '希望 + 小句' }] },
  { main: { name: '在 + 地点 + V', focus: '在 + 地方 + 工作' }, support: [{ name: '得 必须', focus: '得 + V' }] },
  { main: { name: '程度副词', focus: '很 + Adj（努力）' }, support: [{ name: '但是', focus: '...但是...' }] },
  { main: { name: 'V + 去 + 地点', focus: '坐 + 交通工具 + 去 + 地方' }, support: [{ name: '从...到...', focus: '从 A 到 B' }] },
  { main: { name: '一起 + V', focus: '一起 + 去 + 旅行' }, support: [{ name: '去年/明年', focus: '时间词' }] },
  { main: { name: '想 + V', focus: '明年 + 想 + 去' }, support: [{ name: '可能', focus: '可能 + V' }] },
  { main: { name: '喜欢 + N/V', focus: '喜欢 + 运动' }, support: [{ name: '运动类动词', focus: '打篮球、游泳、跑步' }] },
  { main: { name: '觉得 + 怎么样', focus: '你觉得 + 怎么样？' }, support: [{ name: '真/非常', focus: '真/非常 + Adj' }] },
  { main: { name: '请 + V', focus: '请 + 动词 + 一下' }, support: [{ name: '帮 + 人 + V', focus: '帮 + 我 + V' }] },
  { main: { name: '比字句', focus: 'A + 比 + B + Adj' }, support: [{ name: '便宜/贵', focus: '比 + 便宜/贵' }] },
  { main: { name: '因为……所以……', focus: '因为 + 原因 + 所以 + 结果' }, support: [{ name: '没 + V', focus: '没 + 去' }, { name: '了（完成）', focus: 'V + 了' }] }
];

for (let i = 0; i < 20; i++) {
  const words = lessonWords[i];
  cumul += words.length;
  lessons.push({
    lesson: i + 1,
    type: 'study',
    title: titles[i],
    newWords: words.map(toNewWord),
    newWordCount: words.length,
    cumulativeNewWordCount: cumul,
    availableVocabRange: {
      baseHSK1Words: 150,
      currentHSK2LearnedWords: cumul,
      totalAvailableWords: 150 + cumul
    },
    mainGrammar: grammarPlan[i].main,
    supportGrammar: grammarPlan[i].support,
    notes: {
      theme: titles[i].cn,
      difficulty: i < 10 ? 'easy' : 'medium',
      generationRule: 'dialogue/grammar examples/practice must only use words learned up to this lesson',
      ...(i === 0 && { vocabNote: '女人、教室为满足147词无重复分配而提前引入，可在对话中自然融入' })
    }
  });
}

// Review lessons
const reviewGrammar1 = grammarPlan.slice(0, 10).flatMap(g => [g.main, ...g.support]);
const reviewGrammar2 = grammarPlan.slice(10, 20).flatMap(g => [g.main, ...g.support]);

lessons.push({
  lesson: 21,
  type: 'review',
  title: { cn: '综合复习1', kr: '종합 복습 1', en: 'Comprehensive Review 1', jp: '総合復習1' },
  reviewRange: [1, 10],
  newWords: [],
  newWordCount: 0,
  cumulativeNewWordCount: 70,
  reviewWordsFromLessons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  reviewGrammar: reviewGrammar1.map(g => typeof g === 'object' ? { name: g.name, focus: g.focus } : g),
  notes: { theme: 'Review lessons 1-10', difficulty: 'review' }
});

lessons.push({
  lesson: 22,
  type: 'review',
  title: { cn: '综合复习2', kr: '종합 복습 2', en: 'Comprehensive Review 2', jp: '総合復習2' },
  reviewRange: [11, 20],
  newWords: [],
  newWordCount: 0,
  cumulativeNewWordCount: 147,
  reviewWordsFromLessons: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  reviewGrammar: reviewGrammar2.map(g => typeof g === 'object' ? { name: g.name, focus: g.focus } : g),
  notes: { theme: 'Review lessons 11-20', difficulty: 'review' }
});

// Fix reviewGrammar format
lessons[20].reviewGrammar = reviewGrammar1.map(g => ({ name: g.name, focus: g.focus }));
lessons[21].reviewGrammar = reviewGrammar2.map(g => ({ name: g.name, focus: g.focus }));

writeFileSync(join(root, 'data/courses/hsk2.0/hsk2/blueprint.json'), JSON.stringify(lessons, null, 2), 'utf8');
console.log('Blueprint written. Total new words:', cumul);
console.log('Lesson 20 words:', lessonWords[19].length);
