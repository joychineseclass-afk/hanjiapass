/**
 * HSK 3.0 HSK1：aiLearning 收口
 * - 全部课：lessonExplain 中移除 focusMinimal、scenarioSummary、scenarioSummaryLines
 * - 第14–22课：扩写 learningGoals，重写 confusionPoints
 */
import fs from "fs";
import path from "path";

const dir = path.join("data", "courses", "hsk3.0", "hsk1");

const L14_22_PATCH = {
  14: {
    learningGoals: [
      {
        zh: "本课核心句型：用「你怎么去学校？」询问对方上学或出行的方式；用「我坐出租车去学校。」「我坐火车去北京。」等「坐 + 交通工具」回答；用「我开车送你吧。」提出开车相送的建议。",
        pinyin: "zěnme · zuò · kāichē · ba",
        kr: "핵심 문형으로 「你怎么去学校？」로 통학·출행 방식을 묻고, 「我坐出租车去学校。」「我坐火车去北京。」처럼 「坐」 뒤에 교통수단을 붙여 답하며, 「我开车送你吧。」처럼 「开车」와 문말 「吧」로 부드럽게 태워 주겠다는 제안을 합니다.",
        en: "Core patterns: ask how someone gets to school with 「你怎么去学校？」; answer with 坐 + vehicle (e.g. 「我坐出租车去学校。」「我坐火车去北京。」); offer a ride with 「我开车送你吧。」using 开车 and sentence-final 吧.",
        jp: "核心文型：「你怎么去学校？」で通学の行き方を尋ね、「我坐出租车去学校。」のように「坐＋乗り物」で答え、「我开车送你吧。」で送る提案を「吧」で柔らかく言います。",
      },
      {
        zh: "本课核心词法：「怎么」问方式（与问时间的「什么时候」不同）；「白天」「晚上」对比一天中的时段；「有点儿晚了」里「有点儿」表轻微程度，「快走吧！」表催促。",
        pinyin: "zěnme · báitiān · wǎnshang · yǒudiǎnr",
        kr: "어휘·표현：「怎么」는 ‘어떻게/무슨 방법으로’를 묻는 말이고 「什么时候」와 헷갈리지 않습니다. 「白天」「晚上」로 시간대를 대비해 말하고, 「有点儿晚了」는 정도가 약함을, 「快走吧！」는 재촉을 나타냅니다.",
        en: "Key wording: 怎么 asks how/method (contrast 什么时候 for when); 白天 vs 晚上 for time of day; 有点儿 in 有点儿晚了 marks a mild degree; 快走吧 urges someone to hurry.",
        jp: "語法・語彙：「怎么」は方法、「什么时候」と区別。「白天／晚上」で時間帯。「有点儿」は程度が軽いこと、「快走吧」は促し。",
      },
      {
        zh: "本课表达任务：能完成「问路式」交通问答（怎么去—坐什么—要不要开车送）；能在对话里自然使用「吧」软化提议或催促，并听懂「我送你」类相送表达。",
        pinyin: "jiāotōng · ba",
        kr: "의사소통 과제：‘어떻게 가나요—무엇을 타나요—차로 데려다 줄까요’ 흐름의 짧은 대화를 마치고, 제안·재촉에서 「吧」를 적절히 쓰며 「我送你」류의 상대 배려 표현을 알아듣습니다.",
        en: "Tasks: run short exchanges on how to get somewhere—how, which vehicle, whether to drive; use 吧 naturally in offers or urging; understand phrases like 我送你.",
        jp: "タスク：行き方のやり取り（どう行く／何に乗る／送るか）、提案の「吧」、「我送你」などの配慮表現の理解。",
      },
    ],
    confusionPoints: [
      {
        zh: "「怎么」问的是方式（怎么去），「什么时候」问的是时间（什么时候走）——问句与答句要配对，别把方式和时间混在同一问答里。",
        pinyin: "zěnme · shénme shíhou",
        kr: "「怎么」는 방법, 「什么时候」는 시각·일정입니다. 「你怎么去学校？」에는 교통수단·경로로 답하고, 출발 시각을 묻는 문장과 섞어 쓰지 않도록 질문을 고릅니다.",
        en: "怎么 asks how (method); 什么时候 asks when. Pair questions with matching answers—don’t answer a how-question with only a clock time, or vice versa.",
        jp: "「怎么」は方法、「什么时候」はいつ。質問と答えの種類をそろえ、方式と時刻を取り違えない。",
      },
      {
        zh: "「坐出租车」表示乘坐某种交通工具；「开车」表示自己驾驶——「我坐你的车」和「我开你的车」主客关系不同，别混用。",
        pinyin: "zuò · kāichē",
        kr: "「坐」는 타는 쪽, 「开车」는 운전하는 쪽입니다. 누가 운전대를 잡는지 문맥으로 구분하고, 탑승 표현에 「开车」를 끼워 넣어 버리지 않도록 합니다.",
        en: "坐 + vehicle means you ride along; 开车 means you drive. Who holds the wheel changes the phrase—don’t use 开车 inside a 坐-pattern by mistake.",
        jp: "「坐」は乗る、「开车」は運転する。主体が運転者か乗客かで言い方が変わる。",
      },
      {
        zh: "句末「吧」常用于提议、商量或缓和语气（「我开车送你吧」）；疑问句句末若用「吗」则是确认能否，与「吧」的语气不同——别用错句尾助词。",
        pinyin: "ba · ma",
        kr: "문말 「吧」는 제안·부드러운 권유에 쓰이고, 「……吗？」는 가능 여부를 묻는 확인형에 가깝습니다. 태워 주겠다는 뉘앙스에는 「吧」가 자연스러운 경우가 많습니다.",
        en: "Sentence-final 吧 softens offers (我开车送你吧). 吗 checks yes/no ability. Pick 吧 vs 吗 by whether you are offering or asking for confirmation.",
        jp: "文末「吧」は提案の柔らかさ、「吗」は可否の確認。役割を取り違えない。",
      },
    ],
  },
  15: {
    learningGoals: [
      {
        zh: "本课核心句型：接电话用「喂，你好！」；询问对方在做什么用「你在做什么呢？」；说明给谁打电话用「你给谁打电话？」「我给同学打电话。」；请对方稍等查号码用「我看一下。」",
        pinyin: "wéi · gěi · dǎ diànhuà · kàn yíxià",
        kr: "핵심 문형：전화를 받을 때 「喂，你好！」로 시작하고, 「你在做什么呢？」로 상대가 무엇을 하는지 묻습니다. 「你给谁打电话？」에는 「给……打电话」틀로 상대를 밝히고, 번호를 찾을 때 「我看一下。」로 잠시 시간을 달라고 합니다.",
        en: "Core patterns: answer the phone with 「喂，你好！」; ask what someone is doing with 「你在做什么呢？」; state who is being called with 「你给谁打电话？」/「我给同学打电话。」; ask for a moment to look up a number with 「我看一下。」",
        jp: "核心：「喂，你好！」で電話に出る。「你在做什么呢？」「你给谁打电话？」「给……打电话」「我看一下。」で番号確認の待ち時間を言う。",
      },
      {
        zh: "本课核心词法：「手机号码」与口语「手机号」同指移动电话号；对师长可说「您」并配合「王老师，您的手机号码是多少？」一类完整问句；「给」引出动作对象（给谁打）。",
        pinyin: "shǒujī hào · nín · gěi",
        kr: "어휘：「手机号码」와 짧은 「手机号」는 같은 대상을 가리킵니다. 선생님께는 「您」를 쓰고 번호를 공손히 묻는 문장을 완성합니다. 「给」는 ‘누구에게’의 목적어를 이끕니다.",
        en: "Key wording: 手机号码 and spoken 手机号 both mean mobile number; 您 fits teachers in questions like 王老师，您的手机号码是多少？; 给 marks the person you call (给…打电话).",
        jp: "語彙：「手机号码／手机号」、目上には「您」、相手を示す「给」。",
      },
      {
        zh: "本课表达任务：能完成「打电话」场景：问候—说明在做什么—解释打给谁—询问或朗读号码—用「我看一下」处理需要查找的信息。",
        pinyin: "diànhuà chǎngjǐng",
        kr: "의사소통 과제：전화 통화에서 인사—지금 하는 일—통화 상대—번호 문의·읽기—찾아보겠다는 「我看一下」까지 이어지는 짧은 대화를 마칩니다.",
        en: "Tasks: handle a short phone call flow—greeting, what you’re doing, who you’re calling, asking for or reading a number, using 我看一下 when you need to check.",
        jp: "タスク：電話の流れ（あいさつ、何をしているか、誰にかけるか、番号、ちょっと見る）を完結できる。",
      },
    ],
    confusionPoints: [
      {
        zh: "「喂」多用于接电话开口，不是日常见面问候；见面仍用「你好」，电话里先说「喂」再进入正题。",
        pinyin: "wéi · nǐ hǎo",
        kr: "「喂」는 전화를 받을 때 쓰는 첫말에 가깝고, 얼굴을 맞대고 인사할 때의 「你好」와 용도가 다릅니다. 상황에 맞게 고릅니다.",
        en: "喂 opens a phone call; face-to-face hellos use 你好. Don’t treat 喂 as a general street greeting.",
        jp: "「喂」は電話の取り合い、「你好」は対面。混同しない。",
      },
      {
        zh: "「您」与「你」在电话里同样要看来电对象：对老师、长辈用「您」更得体；同学之间多用「你」。",
        pinyin: "nín · nǐ",
        kr: "전화라고 해서 높임이 사라지지 않습니다. 선생님·어른과 통화할 때는 「您」, 또래는 「你」가 자연스럽습니다.",
        en: "On the phone, 您 vs 你 still follows respect: teachers/elders get 您; classmates get 你.",
        jp: "電話でも「您／你」は相手関係で選ぶ。",
      },
      {
        zh: "「给……打电话」强调「打给某人」；不要漏掉「给」把语序说成韩语式直译。与「跟……打电话」口语里有时接近，但本课规范操练以「给」为主。",
        pinyin: "gěi · gēn",
        kr: "「给同学打电话」처럼 「给」로 상대를 먼저 잡는 어순을 익힙니다. 한국어식으로 동사만 앞세우지 않도록 「给」를 빠뜨리지 않습니다.",
        en: "The textbook frame is 给 + person + 打电话. Don’t drop 给 or scramble the order like a literal translation from Korean.",
        jp: "「给……打电话」の型を崩さない。「给」を落とさない。",
      },
      {
        zh: "「我看一下」表示「让我查一下、稍等」，不是「只看一眼」的字面窄义；对方听到后应等待，不宜催促同一句话重复问。",
        pinyin: "kàn yíxià",
        kr: "「我看一下」는 번호·정보를 확인하겠다는 뜻으로, 짧은 대기를 요청하는 표현입니다. 글자 그대로 ‘한번 본다’에만 묶어 이해하지 않습니다.",
        en: "我看一下 means “let me check”—a short hold, not literally “glance once.”",
        jp: "「我看一下」は「確認します・少し待って」のニュアンス。",
      },
    ],
  },
  16: {
    learningGoals: [
      {
        zh: "本课核心句型：用「今天天气怎么样？」「今天天气很好。」谈论天气；用「今天冷不冷？」「今天很热。」等说冷暖；用「你看，外边下雨了。」「我们去看电影吧。」谈论雨雪与改期活动。",
        pinyin: "tiānqì · lěng · rè · xià yǔ",
        kr: "핵심 문형：「今天天气怎么样？」「今天天气很好。」로 날씨를 묻고 답하며, 「今天冷不冷？」「今天很热。」로 체감 온도를 말합니다. 「你看，外边下雨了。」처럼 비·눈 상황을 알리고, 약속은 「我们去看电影吧。」류로 바꿉니다.",
        en: "Core patterns: 今天天气怎么样？/今天天气很好。; 今天冷不冷？/今天很热。; report rain with 你看，外边下雨了。; suggest new plans with 我们去看电影吧。",
        jp: "核心：天気の問答、寒暖、「下雨了」、予定を変える提案。",
      },
      {
        zh: "本课核心词法：程度副词「真、太、非常、有点儿」修饰形容词时的语气强弱不同；「觉得」引出自己的感受（「我觉得今天很冷。」）；「下雨、下雪」作动词表示自然现象。",
        pinyin: "zhēn · tài · fēicháng · yǒudiǎnr · juéde",
        kr: "어휘·표현：「真·太·非常·有点儿」는 형용사와 어울릴 때 강조의 세기가 다릅니다. 「觉得」로 주관적 느낌을 말하고, 「下雨」「下雪」는 자연 현상을 동사로 씁니다.",
        en: "Degree words 真/太/非常/有点儿 differ in strength before adjectives; 觉得 introduces personal judgment; 下雨 and 下雪 are verbs for weather events.",
        jp: "程度「真／太／非常／有点儿」、「觉得」、気象動詞「下雨／下雪」。",
      },
      {
        zh: "本课表达任务：能完成「聊天气—谈冷暖—因雨雪改计划—说喜不喜欢下雪」等日常闲聊，并正确使用正反疑问（冷不冷）与陈述（很冷）两种句式。",
        pinyin: "lǎotiān · zhèngfǎn",
        kr: "의사소통 과제：날씨 화제를 열고 추위·더위를 말하며, 비·눈 때문에 일정을 조정하는 대화를 이어 갑니다. 「冷不冷」 같은 정반의문과 「很冷」 같은 평서를 상황에 맞게 바꿉니다.",
        en: "Tasks: small talk on weather and temperature; adjust plans for rain/snow; use A-not-A questions (冷不冷) vs simple statements (很冷) appropriately.",
        jp: "タスク：天気の雑談、雨雪で予定変更、「冷不冷」と述語の使い分け。",
      },
    ],
    confusionPoints: [
      {
        zh: "问天气用「天气怎么样」，问日期用「几月几号」—别把「怎么样」套到日期问答里。",
        pinyin: "tiānqì · rìqī",
        kr: "날씨는 「天气怎么样」, 날짜는 「几月几号」 등 서로 다른 물음말을 씁니다. 템플릿을 섞지 않습니다.",
        en: "天气怎么样 asks about weather; dates use 几月几号 etc.—don’t mix the two question types.",
        jp: "天気と日付で疑問文の型が違う。混ぜない。",
      },
      {
        zh: "「真冷」「太冷了」「非常冷」「有点儿冷」语气由强到弱有层次；「太」常带「了」表变化或感叹，别与「真」随意互换语感。",
        pinyin: "zhēn · tài · yǒudiǎnr",
        kr: "「真·太·非常·有点儿」는 뉘앙스가 다릅니다. 특히 「太冷了」는 감탄·과함이 느껴질 수 있어, 「有点儿冷」의 약한 정도와 구별합니다.",
        en: "真/太/非常/有点儿 scale intensity differently; 太冷了 often sounds like “too cold” or an exclamation—don’t swap blindly with 有点儿冷.",
        jp: "程度副詞の強弱。「太…了」と「有点儿」のニュアンス差。",
      },
      {
        zh: "「我觉得」是个人看法，后面接形容词或小句；不要与表示意愿的「我想吃」类「想」混在同一结构里省字。",
        pinyin: "juéde · xiǎng",
        kr: "「我觉得」는 평가·느낌, 「我想……」는 의지·희망에 가깝습니다. 뒤에 오는 말의 성격이 다릅니다.",
        en: "觉得 states how something seems to you; 想 in 我想… is volition—different frames.",
        jp: "「觉得」（感じる）と「想」（～したい）を混同しない。",
      },
      {
        zh: "说「下雨了」时「下」是动词用法；与名词「雨」单用不同—初学阶段按课文固定搭配记忆，别说成韩语直译语序。",
        pinyin: "xià yǔ",
        kr: "「下雨了」는 비가 오기 시작했음을 말하는 관용 표현입니다. 단어 순서를 한국어처럼 바꾸지 않고 과문을 따릅니다.",
        en: "下雨了 is a fixed predicate meaning “it’s started raining”; keep the 下 + 雨 verb pattern as in the textbook.",
        jp: "「下雨」は動詞句として固定搭配で覚える。",
      },
    ],
  },
  17: {
    learningGoals: [
      {
        zh: "本课核心句型：用「你在学什么呢？」「我正在学习汉语呢。」描述正在进行的动作；用「你学习什么？」问学习内容；用「我学中文，也学习汉字。」扩展并列；用「一天学习几个小时？」问时长。",
        pinyin: "zhèngzài · ne · xué · xuéxí",
        kr: "핵심 문형：「你在学什么呢？」「我正在学习汉语呢。」로 진행 중인 공부를 말하고, 「你学习什么？」로 과목·내용을 묻습니다. 「我学中文，也学习汉字。」처럼 「也」로 병렬을 늘리고, 「一天学习几个小时？」로 시간을 묻습니다.",
        en: "Core patterns: 你在学什么呢？/我正在学习汉语呢。for ongoing study; 你学习什么？for what you study; 我学中文，也学习汉字。with 也; 一天学习几个小时？for duration.",
        jp: "核心：「正在…呢」、学習内容、「也」、一日の勉強時間の尋ね方。",
      },
      {
        zh: "本课核心词法：「学」与「学习」都可表学习，但音节长短与搭配习惯不同，课文中已示范常见搭配；「都」总括前面提到的人或物（如「我们都是小学生。」）。",
        pinyin: "xué · xuéxí · dōu",
        kr: "어휘：「学」와 「学习」는 둘 다 ‘배우다’지만 길이·콜로케이션이 달라 과문 표현을 우선 익힙니다. 「都」는 앞에서 말한 대상 전체를 아우릅니다.",
        en: "学 vs 学习: both mean study; follow textbook collocations; 都 sums up “all of the above” people/things.",
        jp: "「学／学习」の使い分けは本文に合わせる。「都」の総括。",
      },
      {
        zh: "本课表达任务：能介绍自己学什么、每天学多久，并区分「小学生、中学生、大学生」等身份说法，完成校园里的课业闲聊。",
        pinyin: "xiǎoxuéshēng · zhōngxuéshēng · dàxuéshēng",
        kr: "의사소통 과제：무엇을 배우는지·하루에 몇 시간인지·「小学生／中学生／大学生」 신분을 말해 교내 대화를 완성합니다.",
        en: "Tasks: say what you study, how many hours a day, and school level (小学生/中学生/大学生) in campus chat.",
        jp: "タスク：学習内容、時間、学生の段階の自己紹介。",
      },
    ],
    confusionPoints: [
      {
        zh: "「正在……呢」强调进行当中；若只问习惯或能力，句型会不同—别把所有「在学吗」都硬套成「正在」。",
        pinyin: "zhèngzài · ne",
        kr: "「正在……呢」는 지금 진행 중임을 분명히 합니다. 습관·능력을 묻는 다른 문형과 바꿔 쓰지 않습니다.",
        en: "正在…呢 marks progressive aspect “right now”; don’t force it into every question about studying.",
        jp: "「正在…呢」は進行中。すべての「学ぶ」に当てはめない。",
      },
      {
        zh: "「学」较口语、音节短；「学习」较正式或双音节节奏更稳—课文里怎么写就怎么练，避免自己乱缩略成双音节以外的怪形。",
        pinyin: "xué · xuéxí",
        kr: "「学汉语」처럼 짧은 동사와 「学习汉字」처럼 두 음절 동사가 과문에 같이 나옵니다. 마음대로 줄이거나 늘리지 않습니다.",
        en: "Follow the lesson’s mix of 学 and 学习; don’t invent odd shortenings.",
        jp: "本文の「学／学习」表記に合わせる。",
      },
      {
        zh: "「什么」问内容（学什么），「谁」问人—答句主语与疑问词要一致。",
        pinyin: "shénme · shéi",
        kr: "「什么」는 내용, 「谁」는 사람입니다. 질문과 답의 초점을 맞춥니다.",
        en: "什么 asks what (content); 谁 asks who—align answers with the question word.",
        jp: "「什么」と「谁」を取り違えない。",
      },
      {
        zh: "「都」读 dōu 表「全部」；不要与「对」或其他同形字混淆；总括对象要在前文出现，别空降「都」。",
        pinyin: "dōu",
        kr: "「都」(dōu)는 ‘모두’입니다. 앞에서 대상을 제시한 뒤 총괄할 때 씁니다.",
        en: "都 (dōu) means “all”; it needs a clear plural/total referent in context.",
        jp: "「都」は全体をまとめる。先行する対象が必要。",
      },
    ],
  },
  18: {
    learningGoals: [
      {
        zh: "本课核心句型：用「下课后你做什么？」开启话题；用「我听歌。」「我喜欢打游戏。」说爱好；用「我只喜欢听音乐。」「这首歌很好听。」表范围与评价；用「你听见了吗？」「我听见妹妹在唱歌呢。」说听到的内容。",
        pinyin: "xià kè · tīng gē · hǎowánr · hǎotīng",
        kr: "핵심 문형：「下课后你做什么？」로 방과 후를 묻고, 「我听歌。」「我喜欢打游戏。」로 취미를 말합니다. 「我只喜欢听音乐。」로 범위를 한정하고, 「这首歌很好听。」로 평가합니다. 「听见」로 들린 소리를 전합니다.",
        en: "Core patterns: 下课后你做什么？; 我听歌。/我喜欢打游戏。; 我只喜欢听音乐。; 这首歌很好听。; 听见 for something you hear.",
        jp: "核心：放課後の過ごし方、趣味、「只」、評価「好听」、「听见」。",
      },
      {
        zh: "本课核心词法：「听」表主动听；「听见」强调声音传入耳中；「好玩儿」多形容活动有趣，「好听」多形容声音、歌曲悦耳。",
        pinyin: "tīng · tīngjiàn · hǎowánr · hǎotīng",
        kr: "어휘：「听」는 의도적으로 듣기, 「听见」는 귀에 들림을 강조합니다. 「好玩儿」는 활동·게임, 「好听」는 노래·소리에 쓰는 경향이 있습니다.",
        en: "听 vs 听见 vs 好听 vs 好玩儿: listening on purpose vs perceiving sound; 好听 for sounds/music; 好玩儿 for fun activities.",
        jp: "「听／听见／好听／好玩儿」の使い分け。",
      },
      {
        zh: "本课表达任务：能聊课余做什么、喜欢听还是只喜欢听、评价游戏好不好玩、歌曲好不好听，并复述「听见谁在做什么」的句子。",
        pinyin: "ài hào · tīngjiàn",
        kr: "의사소통 과제：취미·음악·게임 이야기를 하고, 누가 노래하는 소리가 들렸는지까지 짧게 전달합니다.",
        en: "Tasks: talk hobbies, music vs games, 好听/好玩儿 judgments, and report what you 听见.",
        jp: "タスク：趣味の会話、感覚表現、「听见」の報告。",
      },
    ],
    confusionPoints: [
      {
        zh: "「听」是你去听；「听见」是声音传到你耳朵里—「我在听歌」≠「我听见歌」在语义重点上不同。",
        pinyin: "tīng · tīngjiàn",
        kr: "「听」는 주체가 듣기 행위를 택한 경우, 「听见」는 소리가 인지된 결과에 가깝습니다. 문장 초점이 다릅니다.",
        en: "听 focuses on the act of listening; 听见 on perceiving a sound—don’t swap if the lesson contrasts them.",
        jp: "聞く行為「听」と知覚「听见」の焦点の差。",
      },
      {
        zh: "「好听」评声音、歌曲；「好玩儿」评活动、游戏—别把「这个游戏很好听」说成自然中文。",
        pinyin: "hǎotīng · hǎowánr",
        kr: "「好听」는 소리·음악, 「好玩儿」는 놀이·행사에 어울립니다. 대상과 형용사를 짝지어야 합니다.",
        en: "Pair 好听 with sounds/music and 好玩儿 with games/activities.",
        jp: "「好听」と「好玩儿」の修飾対象を混ぜない。",
      },
      {
        zh: "「只」限制范围（只听不看／只喜欢……），位置要紧贴所限制的成分；别把它当成「只」韩语里「仅仅」的任意直放。",
        pinyin: "zhǐ",
        kr: "「只」는 범위를 좁히는 부사로, 무엇을 제외하는지 바로 앞뒤와 짝을 이루어야 합니다.",
        en: "只 scopes what is included/excluded—place it next to the phrase it limits.",
        jp: "「只」のスコープ（直前の成分を限定）。",
      },
      {
        zh: "口语「玩儿」带儿化；书写与发音按教材规范，别随意省略儿化导致与「玩」书面体混读混乱。",
        pinyin: "wánr",
        kr: "「玩儿」는 구어체·아화 표기입니다. 과문과 녹음에 맞춰 읽고 씁니다.",
        en: "玩儿 is the colloquial form with r-coloring; follow the textbook’s spelling and audio.",
        jp: "「玩儿」の児化に注意。",
      },
    ],
  },
  19: {
    learningGoals: [
      {
        zh: "本课核心句型：用「你想吃什么？」「我想吃包子。」表达想吃的食物；用「早饭想喝茶。」「午饭我吃米饭和菜。」说三餐搭配；用「晚上我们吃面条吧。」「少做一些吧。」商量分量与菜式。",
        pinyin: "xiǎng · yào · zǎofàn · wǔfàn · wǎnfàn",
        kr: "핵심 문형：「你想吃什么？」「我想吃包子。」로 먹고 싶은 것을 말하고, 「早饭想喝茶。」등으로 끼니별 메뉴를 말합니다. 「晚上我们吃面条吧。」「少做一些吧。」로 양·메뉴를 상의합니다.",
        en: "Core patterns: 你想吃什么？/我想吃包子。; meal words 早饭/午饭/晚饭 with what you want; 晚上我们吃面条吧。and 少做一些吧。for amount and suggestions.",
        jp: "核心：「想／要」、三餐、提案「吧」、分量「少一些」。",
      },
      {
        zh: "本课核心词法：「想」与「要」都可表意愿，语气上「要」有时更干脆；「做饭」指下厨做饭；「一些」表不定少量（「吃一些」「做一些」）。",
        pinyin: "xiǎng · yào · zuò fàn · yīxiē",
        kr: "어휘：「想」와 「要」는 의지·희망을 나타내며 뉘앙스가 약간 다릅니다. 「做饭」는 요리하다, 「一些」는 양이 많지 않음을 두루 말합니다.",
        en: "想 vs 要 for wants; 做饭 = cook; 一些 = some/a bit in 吃一些/做一些.",
        jp: "「想／要」、「做饭」、「一些」。",
      },
      {
        zh: "本课表达任务：能在早饭店或家里讨论「想喝什么、想吃什么」，并礼貌地用「吧」建议晚饭吃面条、请对方少做一点。",
        pinyin: "diǎncān · jiātíng",
        kr: "의사소통 과제：아침 식당·집 식사 자리에서 음료·메뉴를 고르고, 저녁 메뉴와 양을 「吧」로 부드럽게 조율합니다.",
        en: "Tasks: order or choose breakfast items; discuss lunch/dinner; use 吧 to suggest noodles or ask someone to cook a bit less.",
        jp: "タスク：食事の希望、分量の相談、提案の「吧」。",
      },
    ],
    confusionPoints: [
      {
        zh: "「想」偏「心里想、想要」，「要」在点餐里有时更直接—本课对话已示范搭配，别把所有句子都改成「要」或都改成「想」。",
        pinyin: "xiǎng · yào",
        kr: "「想吃什么」와 「要喝茶」처럼 과문에 나온 짝을 우선 따릅니다. 한쪽으로만 통일하지 않습니다.",
        en: "Follow the lesson’s mix of 想 and 要; don’t replace every 想 with 要 or vice versa blindly.",
        jp: "「想／要」は本文の使い分けを優先。",
      },
      {
        zh: "「早饭、午饭、晚饭」指三餐时段；与「昨天、今天」类时间词搭配时语序按汉语习惯，别按韩语语序硬套。",
        pinyin: "zǎofàn · wǔfàn",
        kr: "끼니 명사는 문장 안 위치가 한국어와 다를 수 있어 과문 어순을 익힙니다.",
        en: "Meal-time words slot into Chinese word order—mirror the textbook, not Korean SOV habits.",
        jp: "三餐名の文中位置は中国語の語順に合わせる。",
      },
      {
        zh: "「做饭」是动宾「做菜做饭」；不要说成「作饭」或其他别字；「妈妈做饭」主语是做饭的人。",
        pinyin: "zuò fàn",
        kr: "「做饭」는 고정 표기입니다. 비슷한 음의 한자를 바꿔 쓰지 않습니다.",
        en: "做饭 is the fixed spelling for cooking meals; keep the 做 + 饭 pattern.",
        jp: "「做饭」の書き言葉を固定で覚える。",
      },
      {
        zh: "「少一些」是请对方减少分量；对象是「做的量」不是「少一些钱」—别与购物课「便宜点」混用场景。",
        pinyin: "shǎo zuò yīxiē",
        kr: "「少做一些」는 요리 양을 줄여 달라는 뜻입니다. 가격 흥정 표현과 상황이 다릅니다.",
        en: "少一些 here asks for less cooking—don’t confuse with bargaining 便宜点儿 from shopping.",
        jp: "「少一些」は料理の量。値切り表現と混同しない。",
      },
    ],
  },
  20: {
    learningGoals: [
      {
        zh: "本课核心句型：用「这件衣服多少钱？」「五十元。」「一百块。」问价与还价；用「我想买两件衣服。」「那件好看。」「这件不要。」挑选衣物；用「你穿这件衣服很好看。」「一共一百元。」「给你九十，找你十块。」完成付款与找零。",
        pinyin: "duōshao qián · yuán · kuài · jiàn",
        kr: "핵심 문형：「这件衣服多少钱？」「五十元。」「一百块。」로 가격을 묻고 답하며, 「我想买两件衣服。」「那件好看。」「这件不要。」로 고릅니다. 「你穿这件衣服很好看。」「一共一百元。」「给你九十，找你十块。」로 결제와 거스름을 말합니다.",
        en: "Core patterns: 这件衣服多少钱？; 五十元/一百块; 我想买两件衣服。; 那件好看。/这件不要。; 你穿这件衣服很好看。; 一共一百元。; 给你九十，找你十块。",
        jp: "核心：値段の尋ね方、「件」、選ぶ、「穿／好看」、会計とおつり。",
      },
      {
        zh: "本课核心词法：衣物量词「件」；口语「块」与「元」同指货币单位；「穿」表穿着效果；「便宜、贵」表价格高低；「不要」在此表拒绝某件货。",
        pinyin: "jiàn · kuài · yuán · chuān",
        kr: "어휘：옷은 「件」, 돈 단위는 「元」와 구어 「块」, 착용은 「穿」, 가격 대비는 「便宜／贵」, 마음에 들지 않을 때 「这件不要」.",
        en: "件 for clothes; 块 = 元 in speech; 穿 for wearing; 便宜/贵; 这件不要 refuses an item.",
        jp: "量詞「件」、「块／元」、「穿」、形容詞「便宜／贵」、拒否の「不要」。",
      },
      {
        zh: "本课表达任务：能在服装店完成「问价—试穿评价—表示要或不要—听总价—付钱找零」的完整购物链。",
        pinyin: "gòuwù liàn",
        kr: "의사소통 과제：옷가게에서 가격 문의—어울림 말하기—취소·선택—총액 확인—현금 거스름까지 이어 말합니다.",
        en: "Tasks: full clothing-shopping chain—ask price, comment on fit/looks, reject or keep items, hear 一共, pay and get 找钱.",
        jp: "タスク：服選びの一連（値段、似合い、不要、合計、おつり）。",
      },
    ],
    confusionPoints: [
      {
        zh: "「块」是「元」的口语说法，书面价签常写「元」—听懂「五十块」=「五十元」，别当成重量「块」。",
        pinyin: "kuài · yuán",
        kr: "「块」는 돈 단위의 구어 표현입니다. 덩어리를 세는 조각과 동음이어도 쇼핑 맥락에서 돈으로 이해합니다.",
        en: "块 colloquially equals 元 for money; in a shop it’s not “a chunk of something.”",
        jp: "「块」は口語の通貨単位（＝元）。",
      },
      {
        zh: "「这件」「那件」指近指远指衣服；问价时中心语是「这件衣服」，别把「多少钱」放到韩语式语序中间拆散。",
        pinyin: "zhè jiàn · nà jiàn",
        kr: "「这件衣服多少钱？」에서 지시어·「件」·「衣服」·가격 질문의 순서를 지킵니다.",
        en: "Keep 这件/那件 + 衣服 + 多少钱 in Chinese order; don’t break the noun phrase.",
        jp: "「这件衣服多少钱」の語順を保つ。",
      },
      {
        zh: "「穿」表穿在身上；帽子鞋类有时用「戴」等—本课聚焦「穿衣服好看」，别把所有穿戴都统称成「穿」超纲混用。",
        pinyin: "chuān · dài",
        kr: "본과는 「穿衣服」의 착용·핏을 말합니다. 다른 두께의 ‘쓰다·신다’까지 한 단어로 합치지 않습니다.",
        en: "本课 uses 穿 for wearing clothes; don’t overgeneralize to hats/shoes without the lesson’s words.",
        jp: "本課は「穿」中心。未習の「戴」などに勝手に拡張しない。",
      },
      {
        zh: "「便宜」说价格低；「贵」说价格高—与「好不好看」是不同评价维度，别用「很便宜」回答好看不好看。",
        pinyin: "piányi · guì · hǎokàn",
        kr: "외모·핏은 「好看」, 가격은 「便宜／贵」로 평가합니다. 질문 유형을 맞춥니다.",
        en: "好看 judges appearance; 便宜/贵 judges price—answer the dimension you were asked.",
        jp: "見た目と値段の評価軸を取り違えない。",
      },
      {
        zh: "「一共」是总价；后面跟总金额；「找你十块」是找零—别把「一共」与「多少钱」问句功能搞反。",
        pinyin: "yīgòng · zhǎo qián",
        kr: "「一共一百元」는 합계를 알려 줄 때, 「找你十块」는 거스름돈입니다. 역할을 구별합니다.",
        en: "一共 states the total; 找钱 is your change—don’t swap their roles.",
        jp: "「一共」は合計、「找」はおつり。",
      },
    ],
  },
  21: {
    learningGoals: [
      {
        zh: "本课核心句型：用「你怎么了？」「我生病了。」关心与自述病情；用「我要去医院。」「医生说要休息。」说就医与医嘱；用「你好多了吗？」「我没事了。」「你睡一会儿吧。」安慰与嘱咐休息。",
        pinyin: "zěnme le · shēngbìng · kànbìng",
        kr: "핵심 문형：「你怎么了？」「我生病了。」로 안부와 증상을 말하고, 「我要去医院。」「医生说要休息。」로 병원·의사 말을 전합니다. 「你好多了吗？」「我没事了。」「你睡一会儿吧。」로 위로와 휴식을 권합니다.",
        en: "Core patterns: 你怎么了？/我生病了。; 我要去医院。; 医生说要休息。; 你好多了吗？/我没事了。; 你睡一会儿吧。",
        jp: "核心：「怎么了／生病／看病／休息／没事／睡一会儿」。",
      },
      {
        zh: "本课核心词法：「舒服／不舒服」描述身体感受；「看病」指就医行为；「要」表需要（要休息）；「再」表下一次（明天再来）；「见」用于道别「再见」。",
        pinyin: "shūfu · kànbìng · yào · zài · jiàn",
        kr: "어휘：몸 상태는 「舒服／不舒服」, 진료는 「看病」, 필요는 「要休息」, 다음 방문은 「明天再来」, 작별은 「再见」.",
        en: "舒服/不舒服; 看病; 要 for need (要休息); 再来 for “come again”; 再见 for goodbye.",
        jp: "語彙：体調、「看病」、「要」「再」「再见」。",
      },
      {
        zh: "本课表达任务：能表达「身体不舒服—决定去医院—转述医生说法—亲友探望时安慰—约定明天再来」的完整关怀对话。",
        pinyin: "ān wèi",
        kr: "의사소통 과제：아픔을 말하고 병원 가기로 하며, 의사의 말을 전하고, 병문안에서 위로·휴식을 권하는 대화를 완성합니다.",
        en: "Tasks: report illness, go to hospital, relay the doctor’s advice, comfort a sick friend, plan 明天再来.",
        jp: "タスク：体調不良から受診、伝言、見舞い、再訪の約束まで。",
      },
    ],
    confusionPoints: [
      {
        zh: "「怎么了」问出了什么事／身体怎么了；不是「为什么」的辩解问句—答「我头疼」比答「因为……」更贴切。",
        pinyin: "zěnme le · wèishénme",
        kr: "「怎么了」는 상태·사건을 묻습니다. 원인만 길게 「因为」로 답해야 하는 「为什么」와 다릅니다.",
        en: "怎么了 asks what’s wrong (often health); 为什么 asks why—don’t answer one with the other’s pattern only.",
        jp: "「怎么了」（どうした）と「为什么」（なぜ）を混ぜない。",
      },
      {
        zh: "「生病」是动词性表述「得病」；「病」多作名词—说「我生病了」自然，别硬说成韩语直译的怪序。",
        pinyin: "shēngbìng · bìng",
        kr: "「我生病了」는 관용적으로 몸이 아픔을 말합니다. 명사 「病」만 덩그러니 쓰지 않도록 과문을 따릅니다.",
        en: "我生病了 is the natural “I’ve fallen ill”; follow textbook predicates.",
        jp: "「生病」は述語としての定型。",
      },
      {
        zh: "「看病」是「去看医生／就诊」；别拆开理解成「看了书」那种「看+名」—搭配固定。",
        pinyin: "kànbìng",
        kr: "「看病」는 진료를 보러 가다라는 한 덩어리 표현입니다.",
        en: "看病 is a set verb-object “see a doctor”; don’t parse 看 like 看书.",
        jp: "「看病」は离合不可の慣用。",
      },
      {
        zh: "「没事」在此表示「没有大碍、不要紧」；与道歉应答的「没关系」场景不同—别在看病语境乱换。",
        pinyin: "méishì · méi guānxi",
        kr: "몸이 괜찮아졌다는 「我没事了」와 사과 응답 「没关系」는 장면이 다릅니다.",
        en: "没事 here means “I’m fine (health-wise)”; 没关系 answers apologies—different situations.",
        jp: "「没事」（大丈夫）と「没关系」（謝罪の返答）の場面差。",
      },
      {
        zh: "「要休息」里「要」是需要；与「我要吃饺子」的「要」同属意愿／需要类，但宾语不同—别省略「休息」只说「我要」。",
        pinyin: "yào xiūxi",
        kr: "「要休息」에서 목적어 「休息」를 빼면 뜻이 불완전해집니다.",
        en: "要休息 needs both 要 and 休息—don’t drop the complement.",
        jp: "「要休息」の目的語を落とさない。",
      },
    ],
  },
  22: {
    learningGoals: [
      {
        zh: "本课核心句型：用「你去年就来中国了吗？」「我来中国一年多了。」「明年我父母来看我。」谈来华时间与探亲计划；用「你在哪儿工作？」「我很忙。」说工作地点与忙闲；用「李先生，您好！」「这位女士是谁？」使用职场与礼貌称呼。",
        pinyin: "qùnián · míngnián · gōngzuò",
        kr: "핵심 문형：「你去年就来中国了吗？」「我来中国一年多了。」「明年我父母来看我。」로 체류·계획을 말하고, 「你在哪儿工作？」「我很忙。」로 직장과 바쁨을 말합니다. 「李先生，您好！」「这位女士是谁？」로 호칭을 씁니다.",
        en: "Core patterns: last/next year and length of stay in China; 明年我父母来看我。; 你在哪儿工作？/我很忙。; 李先生/女士 in polite address.",
        jp: "核心：去年・明年・滞在、「工作／忙」、敬称「先生／女士」。",
      },
      {
        zh: "本课核心词法：「第」与序数、年份表达配合（本课「一年多」等时长）；「工作」可作动词「在哪儿工作」；「公司」指工作单位；「大家」可指在场众人。",
        pinyin: "dì · gōngzuò · gōngsī · dàjiā",
        kr: "어휘：「第」는 서수, 「工作」는 일하다·직무, 「公司」는 직장 조직, 「大家」는 ‘여러분·모두’ 맥락에서 씁니다.",
        en: "第 with ordinals; 工作 as verb (在哪儿工作); 公司; 大家 for “everyone” in context.",
        jp: "「第」、動詞用法の「工作」、「公司」、「大家」。",
      },
      {
        zh: "本课表达任务：能介绍自己何时来中国、是否想家、父母何时来访，并能在公司场景问候同事、简单谈论忙不忙、澄清「是不是男朋友」类身份问题。",
        pinyin: "shēnfèn · tóngshì",
        kr: "의사소통 과제：중국 체류 기간·향수·가족 방문 계획을 말하고, 직장에서 인사·바쁨·동료 관계를 짧게 설명합니다.",
        en: "Tasks: talk stay in China, homesickness, family visits; greet at work; say how busy you are; clarify relationships (同事 vs 男朋友).",
        jp: "タスク：滞在・家族訪問、職場の挨拶、忙しさ、人間関係の説明。",
      },
    ],
    confusionPoints: [
      {
        zh: "「去年、明年」表时间推移；与「上午、下午」表一天内时段不同—别把时间词混进同一模板。",
        pinyin: "qùnián · míngnián",
        kr: "연도·시기는 「去年／明年」, 하루 안의 구간은 「上午／下午」입니다. 질문에 맞는 시간 단위를 고릅니다.",
        en: "去年/明年 are year-scale; 上午/下午 are within a day—pick the right time scale.",
        jp: "年単位と日内の時間帯を混同しない。",
      },
      {
        zh: "「第几年」问顺序／第几个年头；与单纯「几年」问时长时回答方式可能不同—听清问句再答「一年多了」或「第二年」。",
        pinyin: "dì jǐ nián · jǐ nián",
        kr: "서수 질문과 기간 질문은 답이 달라질 수 있어, 의문사를 먼저 확인합니다.",
        en: "Ordinal “which year (in sequence)” vs “how many years” duration—match the question type.",
        jp: "「第」と単純な「几」の質問に合わせて答える。",
      },
      {
        zh: "「工作」作动词时问「在哪儿工作」；与名词「工作很忙」里「工作」作主语不同—注意词性带来的句式。",
        pinyin: "gōngzuò",
        kr: "「工作」는 ‘일하다’로도, ‘일(직무)’ 명사로도 쓰입니다. 문장 틀이 달라집니다.",
        en: "工作 can be verb (在哪儿工作) or noun subject (工作很忙)—watch the pattern.",
        jp: "「工作」の動詞用法と名詞用法。",
      },
      {
        zh: "「先生」在商务场合可称「李先生」；与学校里「老师」不同—别对同事乱叫「老师」除非对方是教师。",
        pinyin: "xiānsheng · lǎoshī",
        kr: "직장·대외 자리에서는 「李先生」 같은 성+先生이 쓰일 수 있고, 교실의 「老师」와 상황이 다릅니다.",
        en: "李先生 is a business-style address; 老师 fits teachers—don’t mix contexts.",
        jp: "「李先生」と「老师」の場面の違い。",
      },
      {
        zh: "「男朋友」是恋爱关系；「男同事」是工作关系—听清「是不是男朋友」类问句，别用错身份词回答。",
        pinyin: "nán péngyou · tóngshì",
        kr: "연인인지 직장 동료인지에 따라 「男朋友」와 「同事」를 구별합니다.",
        en: "男朋友 vs 男同事—clarify relationship words in answers.",
        jp: "「男朋友」と「同事」の区別。",
      },
    ],
  },
};

function stripLessonExplainNoise(le) {
  if (!le || typeof le !== "object") return;
  delete le.focusMinimal;
  delete le.scenarioSummary;
  delete le.scenarioSummaryLines;
}

function main() {
  for (let n = 1; n <= 22; n++) {
    const fp = path.join(dir, `lesson${n}.json`);
    const raw = fs.readFileSync(fp, "utf8");
    const data = JSON.parse(raw);
    const le = data.aiLearning?.lessonExplain;
    stripLessonExplainNoise(le);

    const patch = L14_22_PATCH[n];
    if (patch) {
      le.learningGoals = patch.learningGoals;
      le.confusionPoints = patch.confusionPoints;
    }

    fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log("ok", fp);
  }
}

main();
