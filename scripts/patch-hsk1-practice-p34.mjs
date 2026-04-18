/**
 * One-off patch: lessons 4–22 practice p3/p4 — avoid 纯中文释义型 options.
 * Run: node scripts/patch-hsk1-practice-p34.mjs
 */
import fs from "fs";
import path from "path";

const dir = path.join("data", "courses", "hsk3.0", "hsk1");

const pin = (a, b, c, d) => [
  { key: "A", zh: a, cn: a, kr: a, en: a, jp: a },
  { key: "B", zh: b, cn: b, kr: b, en: b, jp: b },
  { key: "C", zh: c, cn: c, kr: c, en: c, jp: c },
  { key: "D", zh: d, cn: d, kr: d, en: d, jp: d },
];

const sent = (key, zh, kr, en, jp) => ({ key, zh, cn: zh, kr, en, jp });

const patches = {
  4: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "问句「你有弟弟吗？」若表示「没有弟弟」，应回答：",
        kr: "「你有弟弟吗？」에 「남동생 없음」으로 답할 때 맞는 말은?",
        en: "Choose the right reply to 你有弟弟吗? when you don’t have a younger brother:",
        jp: "「你有弟弟吗？」に「弟はいない」と答えるのに合うのは？",
      },
      options: [
        sent("A", "没有。", "없어요.", "No. / I don’t.", "いいえ、いません。"),
        sent("B", "有，我是学生。", "있어요, 학생이에요.", "Yes—I’m a student.", "はい、学生です。"),
        sent("C", "是，四口人。", "네, 네 명이에요.", "Yes—four people.", "ええ、四人です。"),
        sent("D", "会，我会写汉字。", "할 줄 알아요, 한자 써요.", "Yes—I can write characters.", "はい、漢字も書けます。"),
      ],
      answer: "A",
      explanation: {
        cn: "「有……吗？」的否定回答常用「没有。」",
        kr: "「有……吗？」에 대한 부정 답은 「没有。」가 흔합니다.",
        en: "A common negative answer to 有…吗？ is 没有.",
        jp: "「有……吗？」への否定の答えは「没有。」がよく使われます。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「四」的拼音是？",
        kr: "「四」의 병음은?",
        en: "What is the pinyin of 四?",
        jp: "「四」のピンインは？",
      },
      options: pin("sì", "shì", "sān", "shí"),
      answer: "A",
      explanation: {
        cn: "「四」读作 sì。",
        kr: "「四」는 sì입니다.",
        en: "四 is read sì.",
        jp: "「四」は sì と読みます。",
      },
    },
  },
  5: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "别人问「你几岁？」，你想回答「我今年五岁」，应说：",
        kr: "「你几岁?」에 「올해 다섯 살」이라고 답할 때 맞는 문장은?",
        en: "Pick the line that says you’re five this year:",
        jp: "「今年五歳です」と言うのに合う文は？",
      },
      options: [
        sent("A", "我今年五岁。", "올해 다섯 살이에요.", "I’m five this year.", "今年五歳です。"),
        sent("B", "现在八点。", "지금 여덟 시예요.", "It’s eight o’clock now.", "今八時です。"),
        sent("C", "今天星期一。", "오늘 월요일이에요.", "Today is Monday.", "今日は月曜日です。"),
        sent("D", "我家有四口人。", "집에 네 명이에요.", "There are four people in my family.", "家族は四人です。"),
      ],
      answer: "A",
      explanation: {
        cn: "用「我今年……岁」说明自己今年的年龄。",
        kr: "「我今年……岁」로 올해 나이를 말합니다.",
        en: "我今年…岁 states your age this year.",
        jp: "「我今年……岁」で今年の年齢を言います。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「真」的拼音是？",
        kr: "「真」의 병음은?",
        en: "What is the pinyin of 真?",
        jp: "「真」のピンインは？",
      },
      options: pin("zhēn", "zhèn", "zēn", "zhěng"),
      answer: "A",
      explanation: {
        cn: "「真」读作 zhēn。",
        kr: "「真」는 zhēn입니다.",
        en: "真 is read zhēn.",
        jp: "「真」は zhēn と読みます。",
      },
    },
  },
  6: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "你想说「下午两点到四点上课」，应说：",
        kr: "「오후 두 시부터 네 시까지 수업」이라고 말할 때 맞는 문장은?",
        en: "Which line says class is from 2 to 4 p.m.?",
        jp: "「午後2時から4時まで授業」を言うのはどれ？",
      },
      options: [
        sent("A", "下午两点到四点上课。", "오후 두 시부터 네 시까지 수업이에요.", "Class is from 2 to 4 in the afternoon.", "午後2時から4時まで授業です。"),
        sent("B", "现在八点零七分。", "지금 여덟 시 칠 분이에요.", "It’s 8:07 now.", "今は8時7分です。"),
        sent("C", "昨天五月一日。", "어제 오월 일 일이에요.", "Yesterday was May 1st.", "昨日は5月1日でした。"),
        sent("D", "我今年五岁。", "올해 다섯 살이에요.", "I’m five this year.", "今年五歳です。"),
      ],
      answer: "A",
      explanation: {
        cn: "用「下午」+ 时间 +「到」+ 时间 +「上课」说明下午上课时段。",
        kr: "「下午」＋시간＋「到」＋시간＋「上课」으로 오후 시간대를 말합니다.",
        en: "下午…到…上课 gives the afternoon time range.",
        jp: "「下午……到……上课」で午後の時間帯を言う。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「起床」的拼音是？",
        kr: "「起床」의 병음은?",
        en: "What is the pinyin of 起床?",
        jp: "「起床」のピンインは？",
      },
      options: pin("qǐchuáng", "qǐchuán", "qīchuáng", "qǐcháng"),
      answer: "A",
      explanation: {
        cn: "「起床」读作 qǐchuáng。",
        kr: "「起床」는 qǐchuáng입니다.",
        en: "起床 is read qǐchuáng.",
        jp: "「起床」は qǐchuáng と読みます。",
      },
    },
  },
  7: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "你想问「今天星期几？」，应说：",
        kr: "「오늘 무슨 요일?」이라고 묻는 말은?",
        en: "Which line asks what weekday it is today?",
        jp: "「今日は何曜日ですか」と尋ねるのはどれ？",
      },
      options: [
        sent("A", "今天星期几？", "오늘 무슨 요일이에요?", "What day of the week is it today?", "今日は何曜日ですか。"),
        sent("B", "今天几月几日？", "오늘 몇 월 며칠이에요?", "What’s the date today?", "今日は何月何日ですか。"),
        sent("C", "现在几点？", "지금 몇 시예요?", "What time is it now?", "今何時ですか。"),
        sent("D", "你家有几口人？", "가족이 몇 명이에요?", "How many people are in your family?", "ご家族は何人ですか。"),
      ],
      answer: "A",
      explanation: {
        cn: "「今天星期几？」用来询问今天是星期几。",
        kr: "「今天星期几？」는 오늘 요일을 묻습니다.",
        en: "今天星期几? asks the weekday.",
        jp: "「今天星期几？」は曜日を尋ねます。",
      },
    },
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在问「什么时候做某事」？",
        kr: "「언제 무엇을 하느냐」를 묻는 말은?",
        en: "Which line asks when something happens?",
        jp: "「いつそうするか」を尋ねているのはどれ？",
      },
      options: [
        sent("A", "你们什么时候休息？", "언제 쉬세요?", "When do you rest?", "いつ休みますか。"),
        sent("B", "今天星期几？", "오늘 무슨 요일?", "What weekday is it?", "何曜日ですか。"),
        sent("C", "现在几点？", "지금 몇 시?", "What time is it?", "今何時ですか。"),
        sent("D", "你是哪国人？", "어느 나라 사람?", "What country are you from?", "どこの国の人ですか。"),
      ],
      answer: "A",
      explanation: {
        cn: "「什么时候」用来提问在何时发生某事。",
        kr: "「什么时候」는 어떤 일이 언제 일어나는지 묻습니다.",
        en: "什么时候 asks when something happens.",
        jp: "「什么时候」はいつ起こるかを尋ねます。",
      },
    },
  },
  8: {
    p3: null,
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「下」在「桌子下」中读作？",
        kr: "「桌子下」의 「下」 병음은?",
        en: "In 桌子下, the pinyin of 下 is?",
        jp: "「桌子下」の「下」のピンインは？",
      },
      options: pin("xià", "shàng", "qiǎ", "xiā"),
      answer: "A",
      explanation: {
        cn: "「下」读 xià，表示下方。",
        kr: "「下」는 xià로 읽고 아래를 뜻합니다.",
        en: "下 is read xià (below).",
        jp: "「下」は xià と読み、下を表します。",
      },
    },
  },
  9: {
    p3: null,
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「什么」的拼音是？",
        kr: "「什么」의 병음은?",
        en: "What is the pinyin of 什么?",
        jp: "「什么」のピンインは？",
      },
      options: pin("shénme", "shénmē", "shéngme", "sénme"),
      answer: "A",
      explanation: {
        cn: "「什么」读作 shénme。",
        kr: "「什么」는 shénme입니다.",
        en: "什么 is read shénme.",
        jp: "「什么」は shénme と読みます。",
      },
    },
  },
  10: {
    p3: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「贵」的拼音是？",
        kr: "「贵」의 병음은?",
        en: "What is the pinyin of 贵?",
        jp: "「贵」のピンインは？",
      },
      options: pin("guì", "guī", "gùi", "guìi"),
      answer: "A",
      explanation: {
        cn: "「贵」读 guì。",
        kr: "「贵」는 guì입니다.",
        en: "贵 is read guì.",
        jp: "「贵」は guì と読みます。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「还」在「还要」中读作？",
        kr: "「还要」의 「还」 병음은?",
        en: "In 还要, the usual reading of 还 is?",
        jp: "「还要」の「还」の読みは？",
      },
      options: pin("hái", "huán", "hài", "hāi"),
      answer: "A",
      explanation: {
        cn: "此处「还」读 hái，表示 additionally。",
        kr: "여기서 「还」는 hái로 읽고 ‘또/추가로’입니다.",
        en: "Here 还 is hái (also / in addition).",
        jp: "ここでは「还」は hái と読み、「さらに」の意。",
      },
    },
  },
  11: {
    p3: null,
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「都」的拼音是？",
        kr: "「都」의 병음은?",
        en: "What is the pinyin of 都?",
        jp: "「都」のピンインは？",
      },
      options: pin("dōu", "dù", "dǒu", "dōuū"),
      answer: "A",
      explanation: {
        cn: "「都」读 dōu。",
        kr: "「都」는 dōu입니다.",
        en: "都 is read dōu.",
        jp: "「都」は dōu と読みます。",
      },
    },
  },
  12: {
    p3: null,
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句表示「书在电脑的前面那一侧」？",
        kr: "「책이 컴퓨터 앞쪽」을 말하는 문장은?",
        en: "Which line says the book is in front of the computer?",
        jp: "「本がパソコンの前の方」を言うのはどれ？",
      },
      options: [
        sent("A", "你的书在电脑前边。", "책이 컴퓨터 앞에 있어요.", "Your book is in front of the computer.", "本はパソコンの前にあります。"),
        sent("B", "你的书在电脑后边。", "책이 컴퓨터 뒤에 있어요.", "Your book is behind the computer.", "本はパソコンの後ろにあります。"),
        sent("C", "你的书在电脑里边。", "책이 컴퓨터 안에 있어요.", "Your book is inside the computer.", "本はパソコンの中にあります。"),
        sent("D", "你的书在桌子上。", "책이 책상 위에 있어요.", "Your book is on the desk.", "本は机の上にあります。"),
      ],
      answer: "A",
      explanation: {
        cn: "「前边」指面对方向的前方一侧。",
        kr: "「前边」는 앞쪽을 말합니다.",
        en: "前边 means the front side.",
        jp: "「前边」は前の方です。",
      },
    },
  },
  13: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "姐姐说「在书店后边」，应该说「在商店后边」才对。正确的句子是：",
        kr: "「서점 뒤」가 아니라 「가게 뒤」가 맞다고 할 때 맞는 문장은?",
        en: "Pick the sentence that gives the correct location (shop, not bookstore):",
        jp: "「本屋の後ろ」ではなく「店の後ろ」が正しいときの文は？",
      },
      options: [
        sent("A", "我家在商店后边。", "우리 집은 가게 뒤에 있어요.", "My home is behind the shop.", "うちは店の後ろにあります。"),
        sent("B", "我家在书店后边。", "우리 집은 서점 뒤에 있어요.", "My home is behind the bookstore.", "うちは本屋の後ろにあります。"),
        sent("C", "我家在学校后边。", "우리 집은 학교 뒤에 있어요.", "My home is behind the school.", "うちは学校の後ろにあります。"),
        sent("D", "我家在饭店后边。", "우리 집은 식당 뒤에 있어요.", "My home is behind the restaurant.", "うちはレストランの後ろにあります。"),
      ],
      answer: "A",
      explanation: {
        cn: "会话三纠正：应在「商店后边」而不是「书店后边」。",
        kr: "회화3에서는 「商店后边」가 맞습니다.",
        en: "Dialogue 3 fixes the place to behind the shop.",
        jp: "会話3では「商店后边」が正しい場所です。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「和」的拼音是？",
        kr: "「和」의 병음은?",
        en: "What is the pinyin of 和?",
        jp: "「和」のピンインは？",
      },
      options: pin("hé", "hè", "huó", "hē"),
      answer: "A",
      explanation: {
        cn: "「和」在此处读 hé。",
        kr: "여기서 「和」는 hé입니다.",
        en: "和 is read hé (with).",
        jp: "「和」は hé と読みます。",
      },
    },
  },
};

// Lessons 14–22: replace p3/p4 with zh_to_pinyin or sentence pick (no long 释义)
const patches1422 = {
  14: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "爸爸提议送你时，哪一句最合适？",
        kr: "아빠가 데려다 주겠다고 할 때 맞는 말은?",
        en: "Which line is Dad offering you a ride?",
        jp: "パパが送ると言っているのはどれ？",
      },
      options: [
        sent("A", "我开车送你吧。", "차로 데려다 줄게.", "Let me drive you.", "車で送るよ。"),
        sent("B", "你怎么去学校？", "학교 어떻게 가?", "How do you get to school?", "学校へどう行く？"),
        sent("C", "我有时间。", "시간 있어.", "I have time.", "時間がある。"),
        sent("D", "今天白天休息。", "오늘 낮엔 쉬어.", "I’m off this daytime.", "今日の昼は休み。"),
      ],
      answer: "A",
      explanation: {
        cn: "「我开车送你吧。」是提议开车送你。",
        kr: "「我开车送你吧。」는 차로 데려다 주자는 제안입니다.",
        en: "我开车送你吧 offers a ride.",
        jp: "「我开车送你吧」は送るという提案です。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「坐」在「坐火车」中读作？",
        kr: "「坐火车」의 「坐」 병음은?",
        en: "In 坐火车, the pinyin of 坐 is?",
        jp: "「坐火车」の「坐」のピンインは？",
      },
      options: pin("zuò", "zhuò", "zuō", "zuó"),
      answer: "A",
      explanation: {
        cn: "「坐」读 zuò。",
        kr: "「坐」는 zuò입니다.",
        en: "坐 is read zuò.",
        jp: "「坐」は zuò と読みます。",
      },
    },
  },
  15: {
    p3: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「看一下」的「看」读作？",
        kr: "「看一下」의 「看」 병음은?",
        en: "In 看一下, the pinyin of 看 is?",
        jp: "「看一下」の「看」は？",
      },
      options: pin("kàn", "kān", "kǎn", "kàng"),
      answer: "A",
      explanation: {
        cn: "「看」读 kàn。",
        kr: "「看」는 kàn입니다.",
        en: "看 is read kàn.",
        jp: "「看」は kàn と読みます。",
      },
    },
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在问「电话打给谁」？",
        kr: "「누구에게 전화하니」를 묻는 말은?",
        en: "Which line asks who you’re calling?",
        jp: "「だれに電話するか」を聞いているのは？",
      },
      options: [
        sent("A", "你给谁打电话？", "누구한테 전화해?", "Who are you calling?", "だれに電話してる？"),
        sent("B", "你有时间吗？", "시간 있어?", "Do you have time?", "時間ある？"),
        sent("C", "你看一下。", "한번 봐.", "Take a look.", "ちょっと見て。"),
        sent("D", "你有什么事？", "무슨 일 있어?", "What’s up?", "どうした？"),
      ],
      answer: "A",
      explanation: {
        cn: "「给谁」引出通话对象。",
        kr: "「给谁」로 상대를 묻습니다.",
        en: "给谁 asks who you’re calling.",
        jp: "「给谁」は相手を尋ねます。",
      },
    },
  },
  16: {
    p3: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「觉得」的拼音是？",
        kr: "「觉得」의 병음은?",
        en: "What is the pinyin of 觉得?",
        jp: "「觉得」のピンインは？",
      },
      options: pin("juéde", "juédé", "jüéde", "juède"),
      answer: "A",
      explanation: {
        cn: "「觉得」读 juéde。",
        kr: "「觉得」는 juéde입니다.",
        en: "觉得 is read juéde.",
        jp: "「觉得」は juéde と読みます。",
      },
    },
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在说「雨很大」？",
        kr: "「비가 많이 온다」를 말하는 문장은?",
        en: "Which line says the rain is heavy?",
        jp: "「雨が強い」を言っているのはどれ？",
      },
      options: [
        sent("A", "外边雨非常大。", "밖에 비가 엄청 세요.", "The rain outside is very heavy.", "外は雨がとても強い。"),
        sent("B", "今天天气很好。", "날씨가 아주 좋아요.", "The weather is nice.", "今日はいい天気です。"),
        sent("C", "我不想去。", "가기 싫어요.", "I don’t want to go.", "行きたくない。"),
        sent("D", "现在时间还早。", "아직 이르다.", "It’s still early.", "まだ早い。"),
      ],
      answer: "A",
      explanation: {
        cn: "「雨非常大」表示雨势大。",
        kr: "「雨非常大」는 비가 세다는 뜻입니다.",
        en: "雨非常大 means heavy rain.",
        jp: "「雨非常大」は雨が強いことです。",
      },
    },
  },
  17: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句表示「你们两个人都会说汉语」？",
        kr: "「둘 다 중국어 할 수 있다」를 말하는 문장은?",
        en: "Which line says you both can speak Chinese?",
        jp: "「二人とも中国語が話せる」を言うのはどれ？",
      },
      options: [
        sent("A", "你们都会说汉语吗？", "둘 다 중국어 할 수 있어요?", "Can you both speak Chinese?", "二人とも中国語が話せますか。"),
        sent("B", "你是大学生吗？", "대학생이에요?", "Are you a college student?", "大学生ですか。"),
        sent("C", "我是小学生。", "초등학생이에요.", "I’m a primary student.", "小学生です。"),
        sent("D", "我正在读书呢。", "책 읽고 있어요.", "I’m reading.", "読書してます。"),
      ],
      answer: "A",
      explanation: {
        cn: "「都」总括「你们」全体。",
        kr: "「都」는 전원을 말합니다.",
        en: "都 covers everyone mentioned.",
        jp: "「都」はみんなを指します。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「学习」的拼音是？",
        kr: "「学习」의 병음은?",
        en: "What is the pinyin of 学习?",
        jp: "「学习」のピンインは？",
      },
      options: pin("xuéxí", "xuéxī", "xüéxí", "xuéxi"),
      answer: "A",
      explanation: {
        cn: "「学习」读 xuéxí。",
        kr: "「学习」는 xuéxí입니다.",
        en: "学习 is read xuéxí.",
        jp: "「学习」は xuéxí と読みます。",
      },
    },
  },
  18: {
    p3: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「只」的拼音是？",
        kr: "「只」의 병음은?",
        en: "What is the pinyin of 只?",
        jp: "「只」のピンインは？",
      },
      options: pin("zhǐ", "zhī", "zǐ", "zhì"),
      answer: "A",
      explanation: {
        cn: "「只」读 zhǐ。",
        kr: "「只」는 zhǐ입니다.",
        en: "只 is read zhǐ.",
        jp: "「只」は zhǐ と読みます。",
      },
    },
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在问「有没有听到歌声」？",
        kr: "「노래 소리 들리니」를 묻는 말은?",
        en: "Which line asks if you hear someone singing?",
        jp: "「歌が聞こえるか」を聞いているのは？",
      },
      options: [
        sent("A", "你听见有人在唱歌吗？", "누가 노래하는 소리 들려요?", "Do you hear someone singing?", "歌ってるの聞こえる？"),
        sent("B", "你喜欢唱歌吗？", "노래 부르는 거 좋아해?", "Do you like singing?", "歌うの好き？"),
        sent("C", "这首歌很好听。", "이 노래 좋다.", "This song sounds great.", "この歌はいい。"),
        sent("D", "我妹妹在唱歌呢。", "여동생이 노래해요.", "My sister is singing.", "妹が歌ってます。"),
      ],
      answer: "A",
      explanation: {
        cn: "「听见」问是否听到声音。",
        kr: "「听见」는 들었는지 묻습니다.",
        en: "听见 asks whether you hear it.",
        jp: "「听见」は聞こえるかを尋ねます。",
      },
    },
  },
  19: {
    p3: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「少」的拼音是？",
        kr: "「少」의 병음은?",
        en: "What is the pinyin of 少?",
        jp: "「少」のピンインは？",
      },
      options: pin("shǎo", "shào", "sǎo", "shāo"),
      answer: "A",
      explanation: {
        cn: "「少」读 shǎo。",
        kr: "「少」는 shǎo입니다.",
        en: "少 is read shǎo.",
        jp: "「少」は shǎo と読みます。",
      },
    },
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在问「午饭想吃什么」？",
        kr: "「점심에 뭐 먹고 싶니」를 묻는 말은?",
        en: "Which line asks what you want for lunch?",
        jp: "「昼ごはんに何が食べたいか」を聞いているのは？",
      },
      options: [
        sent("A", "你午饭想吃什么？", "점심에 뭐 먹고 싶어?", "What do you want for lunch?", "昼ごはんは何が食べたい？"),
        sent("B", "晚饭呢？", "저녁은?", "What about dinner?", "夕食は？"),
        sent("C", "有菜单吗？", "메뉴 있어?", "Is there a menu?", "メニューはある？"),
        sent("D", "给我三个包子吧。", "만두 세 개 주세요.", "Three buns, please.", "包子を三つください。"),
      ],
      answer: "A",
      explanation: {
        cn: "「午饭想吃什么」问午餐想吃的食物。",
        kr: "「午饭想吃什么」는 점심 메뉴를 묻습니다.",
        en: "午饭想吃什么 asks about lunch.",
        jp: "「午饭想吃什么」は昼食を尋ねます。",
      },
    },
  },
  20: {
    p3: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句在说「穿起来好看」？",
        kr: "「입으면 잘 어울린다」를 말하는 문장은?",
        en: "Which line says it looks good on you when worn?",
        jp: "「着ると似合う」を言うのはどれ？",
      },
      options: [
        sent("A", "那件你穿很好看。", "저건 입으면 잘 어울려요.", "That one looks great on you.", "あれはよく似合います。"),
        sent("B", "这件衣服多少钱？", "이 옷 얼마예요?", "How much is this?", "いくらですか。"),
        sent("C", "我想买那件。", "저거 살래요.", "I want to buy that one.", "あれを買いたい。"),
        sent("D", "不要，我觉得有一点儿大。", "안 살래요, 좀 커요.", "No—it’s a bit big.", "いいえ、少し大きいです。"),
      ],
      answer: "A",
      explanation: {
        cn: "「穿很好看」评价穿着效果。",
        kr: "「穿很好看」는 입었을 때 모습을 말합니다.",
        en: "穿很好看 comments on how it looks on you.",
        jp: "「穿很好看」は着たときの見え方です。",
      },
    },
    p4: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「找」（找你十元）中读作？",
        kr: "「找你十元」의 「找」 병음은?",
        en: "In 找你十元, the pinyin of 找 is?",
        jp: "「找你十元」の「找」は？",
      },
      options: pin("zhǎo", "zhào", "zǎo", "zhāo"),
      answer: "A",
      explanation: {
        cn: "此处「找」读 zhǎo，表示找零。",
        kr: "여기서 「找」는 zhǎo로 거스름 돈을 뜻합니다.",
        en: "Here 找 is zhǎo (give change).",
        jp: "ここで「找」は zhǎo、おつりの意味です。",
      },
    },
  },
  21: {
    p3: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「要」在「要多休息」中读作？",
        kr: "「要多休息」의 「要」 병음은?",
        en: "In 要多休息, the pinyin of 要 is?",
        jp: "「要多休息」の「要」は？",
      },
      options: pin("yào", "yāo", "yǎo", "yáo"),
      answer: "A",
      explanation: {
        cn: "「要」读 yào。",
        kr: "「要」는 yào입니다.",
        en: "要 is read yào.",
        jp: "「要」は yào と読みます。",
      },
    },
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句表示「明天再来探望」？",
        kr: "「내일 또 보러 온다」를 말하는 문장은?",
        en: "Which line says “I’ll come again tomorrow”?",
        jp: "「明日また来る」を言うのはどれ？",
      },
      options: [
        sent("A", "我明天再来看你。", "내일 또 보러 올게.", "I’ll come see you again tomorrow.", "明日また来るね。"),
        sent("B", "你睡一会吧。", "좀 자.", "Get some sleep.", "ちょっと寝て。"),
        sent("C", "我和你去医院吧。", "병원 같이 가자.", "Let’s go to the hospital.", "一緒に病院に行こう。"),
        sent("D", "医生说要多休息。", "의사가 쉬래요.", "The doctor said to rest.", "医者は休めと言いました。"),
      ],
      answer: "A",
      explanation: {
        cn: "「明天再来」表示改日再来。",
        kr: "「明天再来」는 다음에 또 온다는 뜻입니다.",
        en: "明天再来 means coming again another time.",
        jp: "「明天再来」はまた来ることです。",
      },
    },
  },
  22: {
    p3: {
      subtype: "zh_to_pinyin_choice",
      prompt: {
        cn: "「第」的拼音是？",
        kr: "「第」의 병음은?",
        en: "What is the pinyin of 第?",
        jp: "「第」のピンインは？",
      },
      options: pin("dì", "dí", "dī", "de"),
      answer: "A",
      explanation: {
        cn: "「第」读 dì。",
        kr: "「第」는 dì입니다.",
        en: "第 is read dì.",
        jp: "「第」は dì と読みます。",
      },
    },
    p4: {
      subtype: "dialogue_response",
      prompt: {
        cn: "哪一句是礼貌称呼女性听者？",
        kr: "여성에게 공손하게 부를 때 맞는 말은?",
        en: "Which line is a polite way to address a woman?",
        jp: "女性に丁寧に呼びかけるのはどれ？",
      },
      options: [
        sent("A", "女士，你好。", "아가씨, 안녕하세요.", "Hello, ma’am.", "女士、こんにちは。"),
        sent("B", "先生，你好。", "선생님, 안녕하세요.", "Hello, sir.", "先生、こんにちは。"),
        sent("C", "你是新来的吗？", "신입이에요?", "Are you new?", "新しい方ですか。"),
        sent("D", "你在哪儿工作？", "어디서 일해요?", "Where do you work?", "どこで働いてますか。"),
      ],
      answer: "A",
      explanation: {
        cn: "「女士」用于礼貌称呼女性。",
        kr: "「女士」는 여성에게 공손히 부를 때 씁니다.",
        en: "女士 politely addresses a woman.",
        jp: "「女士」は女性への敬称です。",
      },
    },
  },
};

function mergeQuestion(base, patch) {
  if (!patch) return base;
  const { id, type } = base;
  return { ...base, ...patch, id, type: "choice" };
}

for (let n = 4; n <= 22; n++) {
  const fp = path.join(dir, `lesson${n}.json`);
  const lesson = JSON.parse(fs.readFileSync(fp, "utf8"));
  const pr = lesson.practice || [];
  const p34 = n <= 13 ? patches[n] : patches1422[n];
  if (!p34) continue;
  lesson.practice = pr.map((q) => {
    if (q.id?.endsWith("_p3") && p34.p3) return mergeQuestion(q, p34.p3);
    if (q.id?.endsWith("_p4") && p34.p4) return mergeQuestion(q, p34.p4);
    return q;
  });
  fs.writeFileSync(fp, JSON.stringify(lesson, null, 2) + "\n", "utf8");
  console.log("patched lesson", n);
}

console.log("done");
