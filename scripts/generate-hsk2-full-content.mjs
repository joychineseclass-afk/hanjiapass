#!/usr/bin/env node
/**
 * HSK2 完整内容生成脚本
 * 读取 blueprint.json 和 lesson1~22.json，为每课生成并合并：
 * dialogue, grammar, extension, practice, aiPrompts, review
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BLUEPRINT_PATH = join(ROOT, "data/courses/hsk2.0/hsk2/blueprint.json");
const LESSONS_DIR = join(ROOT, "data/courses/hsk2.0/hsk2");

// ========== 每课预设内容（符合主题、教学一致） ==========
const LESSON_CONTENT = {
  1: {
    dialogue: [
      { speaker: "A", cn: "你今天忙吗？", pinyin: "Nǐ jīntiān máng ma?", translations: { kr: "오늘 바빠요?", en: "Are you busy today?", jp: "今日は忙しいですか？" } },
      { speaker: "B", cn: "很忙，但是不累。", pinyin: "Hěn máng, dànshì bù lěi.", translations: { kr: "바빠요. 하지만 피곤하지 않아요.", en: "Very busy, but not tired.", jp: "忙しいですが、疲れていません。" } },
      { speaker: "A", cn: "我们休息一下吧。", pinyin: "Wǒmen xiūxi yīxià ba.", translations: { kr: "잠깐 쉬어요.", en: "Let's take a break.", jp: "少し休みましょう。" } },
    ],
    grammar: [
      { name: "吗疑问句", explanation: { cn: "用「吗」构成是非问句，S + Adj + 吗？", kr: "「吗」로 예/아니오 의문문을 만듭니다.", en: "Form yes/no questions with 吗: S + Adj + 吗？", jp: "「吗」で是非疑問文を作ります。" }, examples: [{ cn: "你今天忙吗？", pinyin: "Nǐ jīntiān máng ma?", translations: { kr: "오늘 바빠요?", en: "Are you busy today?", jp: "今日は忙しいですか？" } }, { cn: "他很累吗？", pinyin: "Tā hěn lěi ma?", translations: { kr: "그는 피곤해요?", en: "Is he tired?", jp: "彼は疲れていますか？" } }] },
      { name: "形容词谓语句", explanation: { cn: "S + 很 + Adj，形容词直接作谓语。", kr: "형용사가 직접 서술어가 됩니다.", en: "Adjectives as predicates: S + 很 + Adj.", jp: "形容詞が直接述語になります。" }, examples: [{ cn: "今天很忙。", pinyin: "Jīntiān hěn máng.", translations: { kr: "오늘 바빠요.", en: "Today is busy.", jp: "今日は忙しいです。" } }] },
      { name: "程度副词 很", explanation: { cn: "很 + Adj 表示程度。", kr: "很 + 형용사로 정도를 나타냅니다.", en: "很 + Adj indicates degree.", jp: "很 + 形容詞で程度を表します。" }, examples: [{ cn: "教室很大。", pinyin: "Jiàoshì hěn dà.", translations: { kr: "교실이 커요.", en: "The classroom is big.", jp: "教室は大きいです。" } }] },
    ],
    extension: [
      { cn: "每节课", pinyin: "měi jié kè", translations: { kr: "매 수업", en: "each class", jp: "毎授業" }, note: "每 + 量词 + 名词" },
      { cn: "女人和男人", pinyin: "nǚrén hé nánrén", translations: { kr: "여자와 남자", en: "women and men", jp: "女性と男性" }, note: "和连接名词" },
      { cn: "但是很累", pinyin: "dànshì hěn lěi", translations: { kr: "하지만 피곤해요", en: "but very tired", jp: "しかし疲れています" }, note: "但是表示转折" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「你今天忙吗？」的正确回答是？", kr: "「你今天忙吗？」의 올바른 답은?", en: "What is the correct answer to 'Are you busy today?'?", jp: "「你今天忙吗？」の正しい答えは？" }, options: ["很忙", "不忙", "很累", "休息"], answer: "很忙", explanation: { kr: "忙/不忙 回答忙不忙的问题。", en: "忙/不忙 answers the busy question.", jp: "忙/不忙 で忙しいかどうかに答えます。" } },
      { type: "choice", prompt: { cn: "S + 很 + Adj 中「很」的作用是？", kr: "S + 很 + Adj에서 「很」의 역할은?", en: "What does 很 do in S + 很 + Adj?", jp: "S + 很 + Adj で「很」の役割は？" }, options: ["否定", "程度", "疑问", "过去"], answer: "程度", explanation: { kr: "很表示程度，相当于「非常」。", en: "很 indicates degree, similar to 'very'.", jp: "很は程度を表し、「非常」に相当します。" } },
      { type: "choice", prompt: { cn: "「休息一下吧」的「吧」表示？", kr: "「休息一下吧」의 「吧」는?", en: "What does 吧 mean in '休息一下吧'?", jp: "「休息一下吧」の「吧」は？" }, options: ["疑问", "建议", "否定", "完成"], answer: "建议", explanation: { kr: "吧用于建议、提议。", en: "吧 is used for suggestions.", jp: "吧は提案に使います。" } },
      { type: "choice", prompt: { cn: "「但是」连接什么关系？", kr: "「但是」는 어떤 관계를 연결하나요?", en: "What does 但是 connect?", jp: "「但是」は何を結びますか？" }, options: ["因果", "转折", "并列", "条件"], answer: "转折", explanation: { kr: "但是表示转折，相当于「그러나」。", en: "但是 indicates contrast, like 'but'.", jp: "但是は逆接を表します。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读练习", kr: "따라 읽기", en: "Repeat after", jp: "リピート練習" }, prompt: { cn: "请跟读：你今天忙吗？", kr: "따라 읽으세요: 오늘 바빠요?", en: "Please repeat: Are you busy today?", jp: "繰り返してください：今日は忙しいですか？" }, sampleAnswer: "你今天忙吗？" },
      { type: "substitute", title: { cn: "替换练习", kr: "대체 연습", en: "Substitution drill", jp: "置き換え練習" }, prompt: { cn: "用「累」替换：你今天忙吗？", kr: "「累」로 바꿔 말하세요.", en: "Substitute with 累: Are you busy today?", jp: "「累」で置き換えて：今日は忙しいですか？" }, sampleAnswer: "你今天累吗？" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "用本课句型问对方今天忙不忙、累不累。", kr: "오늘 바쁜지, 피곤한지 물어보세요.", en: "Ask your partner if they are busy or tired today.", jp: "相手に今日忙しいか、疲れているか聞いてください。" } },
    ],
  },
  2: {
    dialogue: [
      { speaker: "A", cn: "这是我的家人。", pinyin: "Zhè shì wǒ de jiārén.", translations: { kr: "이것은 제 가족이에요.", en: "This is my family.", jp: "これは私の家族です。" } },
      { speaker: "B", cn: "这是谁？", pinyin: "Zhè shì shuí?", translations: { kr: "이분은 누구예요?", en: "Who is this?", jp: "これは誰ですか？" } },
      { speaker: "A", cn: "这是我哥哥，这是我弟弟。那是姐姐和妹妹。", pinyin: "Zhè shì wǒ gēge, zhè shì wǒ dìdi. Nà shì jiějie hé mèimei.", translations: { kr: "이건 제 형이에요, 이건 제 남동생이에요. 저건 누나와 여동생이에요.", en: "This is my older brother, this is my younger brother. That's my sister and younger sister.", jp: "これは兄、これは弟。あれは姉と妹です。" } },
      { speaker: "B", cn: "大家都很高兴！", pinyin: "Dàjiā dōu hěn gāoxìng!", translations: { kr: "다들 기뻐 보여요!", en: "Everyone looks happy!", jp: "みんな嬉しそうですね！" } },
    ],
    grammar: [
      { name: "的 字结构（所属）", explanation: { cn: "这/那 + 是 + N + 的，表示所属关系。", kr: "소유 관계를 나타냅니다.", en: "Indicates possession: 这/那 + 是 + N + 的.", jp: "所属関係を表します。" }, examples: [{ cn: "这是我的书。", pinyin: "Zhè shì wǒ de shū.", translations: { kr: "이건 제 책이에요.", en: "This is my book.", jp: "これは私の本です。" } }] },
      { name: "呢 疑问句", explanation: { cn: "...呢？用于追问或省略主语的问句。", kr: "추가 질문이나 주어 생략 질문에 씁니다.", en: "...呢？ for follow-up or subject-omitted questions.", jp: "追加質問や主語省略の疑問に使います。" }, examples: [{ cn: "你呢？", pinyin: "Nǐ ne?", translations: { kr: "당신은요?", en: "And you?", jp: "あなたは？" } }] },
    ],
    extension: [
      { cn: "介绍家人", pinyin: "jièshào jiārén", translations: { kr: "가족 소개하기", en: "introduce family", jp: "家族を紹介する" }, note: "介绍 + 名词" },
      { cn: "哥哥和弟弟", pinyin: "gēge hé dìdi", translations: { kr: "형과 남동생", en: "older and younger brother", jp: "兄と弟" }, note: "兄弟姐妹的称呼" },
      { cn: "大家一起来", pinyin: "dàjiā yīqǐ lái", translations: { kr: "다 같이 오세요", en: "everyone come together", jp: "みんなで一緒に来て" }, note: "大家 + 一起" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「这是我的家人」中「的」表示？", kr: "「这是我的家人」에서 「的」는?", en: "What does 的 indicate in 'This is my family'?", jp: "「这是我的家人」の「的」は？" }, options: ["疑问", "所属", "程度", "完成"], answer: "所属", explanation: { kr: "的表示所属关系。", en: "的 indicates possession.", jp: "のは所属を表します。" } },
      { type: "choice", prompt: { cn: "「你呢？」的「呢」用于？", kr: "「你呢？」의 「呢」는?", en: "What is 呢 used for in '你呢？'?", jp: "「你呢？」の「呢」は？" }, options: ["建议", "追问", "否定", "过去"], answer: "追问", explanation: { kr: "呢用于追问对方的情况。", en: "呢 asks about the other person.", jp: "呢は相手の状況を尋ねます。" } },
      { type: "choice", prompt: { cn: "「弟弟」的意思是？", kr: "「弟弟」의 뜻은?", en: "What does 弟弟 mean?", jp: "「弟弟」の意味は？" }, options: ["哥哥", "younger brother", "姐姐", "爸爸"], answer: "younger brother", explanation: { kr: "弟弟是 younger brother。", en: "弟弟 means younger brother.", jp: "弟弟は弟です。" } },
      { type: "choice", prompt: { cn: "「大家」的意思是？", kr: "「大家」의 뜻은?", en: "What does 大家 mean?", jp: "「大家」の意味は？" }, options: ["家庭", "everyone", "学校", "工作"], answer: "everyone", explanation: { kr: "大家表示所有人。", en: "大家 means everyone.", jp: "大家はみんなを表します。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读练习", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "请跟读：这是我的家人。", kr: "따라 읽으세요.", en: "Repeat: This is my family.", jp: "繰り返してください。" }, sampleAnswer: "这是我的家人。" },
      { type: "substitute", title: { cn: "替换练习", kr: "대체 연습", en: "Substitution", jp: "置き換え" }, prompt: { cn: "用「朋友」替换：这是我的家人。", kr: "「朋友」로 바꿔 말하세요.", en: "Substitute with 朋友.", jp: "「朋友」で置き換えて。" }, sampleAnswer: "这是我的朋友。" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "介绍你的家人，用「这是...」「那是...」。", kr: "가족을 소개하세요.", en: "Introduce your family using 这是/那是.", jp: "家族を紹介してください。" } },
    ],
  },
  3: {
    dialogue: [
      { speaker: "A", cn: "这是我的朋友。", pinyin: "Zhè shì wǒ de péngyou.", translations: { kr: "이건 제 친구예요.", en: "This is my friend.", jp: "これは私の友達です。" } },
      { speaker: "B", cn: "欢迎！你可以给我介绍一下吗？", pinyin: "Huānyíng! Nǐ kěyǐ gěi wǒ jièshào yīxià ma?", translations: { kr: "환영해요! 저에게 소개해 주실 수 있어요?", en: "Welcome! Can you introduce him to me?", jp: "歓迎！紹介してもらえますか？" } },
      { speaker: "A", cn: "可以。他懂中文，可以回答你的问题。", pinyin: "Kěyǐ. Tā dǒng Zhōngwén, kěyǐ huídá nǐ de wèntí.", translations: { kr: "네. 그는 중국어를 알아요. 질문에 답할 수 있어요.", en: "Sure. He understands Chinese and can answer your questions.", jp: "はい。彼は中国語が分かります。質問に答えられます。" } },
    ],
    grammar: [
      { name: "介绍他人", explanation: { cn: "这是 + N，介绍某人。", kr: "某人을 소개할 때 씁니다.", en: "Introduce someone: 这是 + N.", jp: "人を紹介する：这是 + N。" }, examples: [{ cn: "这是我的老师。", pinyin: "Zhè shì wǒ de lǎoshī.", translations: { kr: "이분은 제 선생님이에요.", en: "This is my teacher.", jp: "これは私の先生です。" } }] },
      { name: "给 + N + V", explanation: { cn: "给 + 人 + 动词，表示对某人做某事。", kr: "某人에게 动词를 합니다.", en: "给 + person + verb: do something for someone.", jp: "人に〜する：给 + 人 + 动词。" }, examples: [{ cn: "给我介绍一下。", pinyin: "Gěi wǒ jièshào yīxià.", translations: { kr: "저에게 소개해 주세요.", en: "Introduce (him) to me.", jp: "紹介してください。" } }] },
    ],
    extension: [
      { cn: "告诉朋友", pinyin: "gàosù péngyou", translations: { kr: "친구에게 알려주다", en: "tell a friend", jp: "友達に伝える" }, note: "告诉 + 人 + 事" },
      { cn: "懂中文", pinyin: "dǒng Zhōngwén", translations: { kr: "중국어를 이해하다", en: "understand Chinese", jp: "中国語が分かる" }, note: "懂 + 语言" },
      { cn: "可能可以", pinyin: "kěnéng kěyǐ", translations: { kr: "아마 할 수 있어요", en: "might be able to", jp: "多分できる" }, note: "可能 + 可以" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「给 + N + V」中「给」表示？", kr: "「给 + N + V」에서 「给」는?", en: "What does 给 mean in 给 + N + V?", jp: "「给 + N + V」の「给」は？" }, options: ["从", "对/向", "在", "到"], answer: "对/向", explanation: { kr: "给表示动作的对象。", en: "给 indicates the recipient.", jp: "给は動作の対象を表します。" } },
      { type: "choice", prompt: { cn: "「可以」的意思是？", kr: "「可以」의 뜻은?", en: "What does 可以 mean?", jp: "「可以」の意味は？" }, options: ["必须", "can/may", "可能", "应该"], answer: "can/may", explanation: { kr: "可以表示许可或能力。", en: "可以 means can or may.", jp: "可以は許可や能力を表します。" } },
      { type: "choice", prompt: { cn: "「欢迎」后面常接？", kr: "「欢迎」뒤에 자주 오는 것은?", en: "What often follows 欢迎?", jp: "「欢迎」の後に来るのは？" }, options: ["不", "来/你", "没", "了"], answer: "来/你", explanation: { kr: "欢迎你来、欢迎你。", en: "欢迎你来, welcome you.", jp: "欢迎你来、欢迎你。" } },
      { type: "choice", prompt: { cn: "「懂」的宾语通常是？", kr: "「懂」의 목적어는 보통?", en: "What does 懂 usually take as object?", jp: "「懂」の目的語は通常？" }, options: ["人", "语言/内容", "地方", "时间"], answer: "语言/内容", explanation: { kr: "懂中文、懂意思。", en: "懂 Chinese, 懂 meaning.", jp: "懂中文、懂意思。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：这是我的朋友。", kr: "따라 읽으세요.", en: "Repeat: This is my friend.", jp: "繰り返してください。" }, sampleAnswer: "这是我的朋友。" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「老师」替换：给介绍一下。", kr: "「老师」로 바꿔 말하세요.", en: "Substitute with 老师.", jp: "「老师」で置き換えて。" }, sampleAnswer: "给老师介绍一下。" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "介绍你的朋友，并说他/她会什么。", kr: "친구를 소개하고 그가 뭘 할 수 있는지 말하세요.", en: "Introduce your friend and what they can do.", jp: "友達を紹介し、何ができるか言ってください。" } },
    ],
  },
  4: {
    dialogue: [
      { speaker: "A", cn: "我们一起去吃饭吧！", pinyin: "Wǒmen yīqǐ qù chīfàn ba!", translations: { kr: "우리 함께 밥 먹으러 가요!", en: "Let's eat together!", jp: "一緒に食事に行きましょう！" } },
      { speaker: "B", cn: "好啊！这家餐厅的菜很好吃。", pinyin: "Hǎo a! Zhè jiā cāntīng de cài hěn hǎochī.", translations: { kr: "좋아요! 이 식당 음식 맛있어요.", en: "Great! The food at this restaurant is delicious.", jp: "いいですね！このレストランの料理は美味しいです。" } },
      { speaker: "A", cn: "服务员，我们要两杯咖啡和一杯牛奶。", pinyin: "Fúwùyuán, wǒmen yào liǎng bēi kāfēi hé yī bēi niúnǎi.", translations: { kr: "웨이터님, 커피 두 잔이랑 우유 한 잔 주세요.", en: "Waiter, we'd like two coffees and one milk.", jp: "店員さん、コーヒー2杯と牛乳1杯お願いします。" } },
    ],
    grammar: [
      { name: "吧 建议句", explanation: { cn: "...一起 + V + 吧，表示建议一起做某事。", kr: "함께 뭔가 하자고 제안합니다.", en: "Suggest doing together: ...一起 + V + 吧.", jp: "一緒に〜しましょうと提案します。" }, examples: [{ cn: "我们一起去看电影吧。", pinyin: "Wǒmen yīqǐ qù kàn diànyǐng ba.", translations: { kr: "우리 함께 영화 보러 가요.", en: "Let's go see a movie together.", jp: "一緒に映画を見に行きましょう。" } }] },
      { name: "一起", explanation: { cn: "一起 + V，表示共同做某事。", kr: "함께 动词를 합니다.", en: "一起 + V: do something together.", jp: "一緒に〜する。" }, examples: [{ cn: "我们一起学习。", pinyin: "Wǒmen yīqǐ xuéxí.", translations: { kr: "우리 함께 공부해요.", en: "We study together.", jp: "一緒に勉強します。" } }] },
    ],
    extension: [
      { cn: "好吃", pinyin: "hǎochī", translations: { kr: "맛있다", en: "delicious", jp: "美味しい" }, note: "好 + 动词" },
      { cn: "两杯", pinyin: "liǎng bēi", translations: { kr: "두 잔", en: "two cups", jp: "2杯" }, note: "两 + 量词" },
      { cn: "房间", pinyin: "fángjiān", translations: { kr: "방", en: "room", jp: "部屋" }, note: "房间可指餐厅包间" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「一起...吧」表示？", kr: "「一起...吧」는?", en: "What does 一起...吧 express?", jp: "「一起...吧」は？" }, options: ["疑问", "建议", "否定", "完成"], answer: "建议", explanation: { kr: "吧表示建议。", en: "吧 indicates suggestion.", jp: "吧は提案を表します。" } },
      { type: "choice", prompt: { cn: "「两」用于？", kr: "「两」는?", en: "When do we use 两?", jp: "「两」は？" }, options: ["序数", "基数两个", "百", "千"], answer: "基数两个", explanation: { kr: "两表示两个。", en: "两 means two.", jp: "两は2つを表します。" } },
      { type: "choice", prompt: { cn: "「好吃」的结构是？", kr: "「好吃」의 구조는?", en: "What is the structure of 好吃?", jp: "「好吃」の構造は？" }, options: ["Adj+Adj", "好+V", "V+好", "好+N"], answer: "好+V", explanation: { kr: "好+动词表示容易/令人满意。", en: "好+verb = easy to/pleasant to.", jp: "好+動詞で容易/満足を表す。" } },
      { type: "choice", prompt: { cn: "「服务员」是？", kr: "「服务员」은?", en: "What is 服务员?", jp: "「服务员」は？" }, options: ["老师", "waiter/server", "医生", "司机"], answer: "waiter/server", explanation: { kr: "餐厅、酒店的服务人员。", en: "Service staff at restaurants.", jp: "レストランなどのサービス担当。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：我们一起去吃饭吧。", kr: "따라 읽으세요.", en: "Repeat: Let's eat together.", jp: "繰り返してください。" }, sampleAnswer: "我们一起去吃饭吧。" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「喝咖啡」替换：一起去吃饭吧。", kr: "「喝咖啡」로 바꿔 말하세요.", en: "Substitute with 喝咖啡.", jp: "「喝咖啡」で置き換えて。" }, sampleAnswer: "一起去喝咖啡吧。" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "邀请朋友一起做某事，用「一起...吧」。", kr: "친구를 뭔가 하자고 초대하세요.", en: "Invite a friend to do something with 一起...吧.", jp: "友達を何かに誘ってください。" } },
    ],
  },
  5: {
    dialogue: [
      { speaker: "A", cn: "你想喝什么？", pinyin: "Nǐ xiǎng hē shénme?", translations: { kr: "뭐 마시고 싶어요?", en: "What do you want to drink?", jp: "何を飲みたいですか？" } },
      { speaker: "B", cn: "我想喝咖啡。你可以给我一杯吗？", pinyin: "Wǒ xiǎng hē kāfēi. Nǐ kěyǐ gěi wǒ yī bēi ma?", translations: { kr: "커피 마시고 싶어요. 한 잔 줄 수 있어요?", en: "I want coffee. Can you give me a cup?", jp: "コーヒーが飲みたいです。一杯くれますか？" } },
      { speaker: "A", cn: "可以。要牛奶吗？", pinyin: "Kěyǐ. Yào niúnǎi ma?", translations: { kr: "네. 우유 필요해요?", en: "Sure. Do you want milk?", jp: "はい。牛乳はいりますか？" } },
      { speaker: "B", cn: "要，谢谢！", pinyin: "Yào, xièxie!", translations: { kr: "네, 감사해요!", en: "Yes, thanks!", jp: "はい、ありがとう！" } },
    ],
    grammar: [
      { name: "想 + V", explanation: { cn: "想 + 动词，表示想要做某事。", kr: "~하고 싶다.", en: "想 + verb: want to do something.", jp: "〜したい：想 + 動詞。" }, examples: [{ cn: "我想去中国。", pinyin: "Wǒ xiǎng qù Zhōngguó.", translations: { kr: "중국에 가고 싶어요.", en: "I want to go to China.", jp: "中国に行きたいです。" } }] },
      { name: "什么 疑问", explanation: { cn: "V + 什么？询问动作的对象。", kr: "동작의 대상을 묻습니다.", en: "V + 什么？ asks what (object).", jp: "動詞の対象を尋ねる。" }, examples: [{ cn: "你想吃什么？", pinyin: "Nǐ xiǎng chī shénme?", translations: { kr: "뭐 먹고 싶어요?", en: "What do you want to eat?", jp: "何を食べたいですか？" } }] },
      { name: "可以", explanation: { cn: "可以 + V，表示许可或能力。", kr: "~할 수 있다.", en: "可以 + V: can, may.", jp: "〜できる、〜してもよい。" }, examples: [{ cn: "你可以进来。", pinyin: "Nǐ kěyǐ jìnlái.", translations: { kr: "들어와도 돼요.", en: "You can come in.", jp: "入ってきてよいです。" } }] },
    ],
    extension: [
      { cn: "喝咖啡", pinyin: "hē kāfēi", translations: { kr: "커피 마시다", en: "drink coffee", jp: "コーヒーを飲む" }, note: "喝 + 饮料" },
      { cn: "一杯牛奶", pinyin: "yī bēi niúnǎi", translations: { kr: "우유 한 잔", en: "a glass of milk", jp: "牛乳1杯" }, note: "数词+量词+名词" },
      { cn: "要咖啡", pinyin: "yào kāfēi", translations: { kr: "커피 주세요", en: "want coffee", jp: "コーヒーをください" }, note: "要 = 想要" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「想喝什么」中「想」表示？", kr: "「想喝什么」에서 「想」는?", en: "What does 想 mean in 想喝什么?", jp: "「想喝什么」の「想」は？" }, options: ["思考", "want to", "可能", "应该"], answer: "want to", explanation: { kr: "想+动词=想要做。", en: "想+verb = want to do.", jp: "想+動詞=〜したい。" } },
      { type: "choice", prompt: { cn: "「V+什么」询问？", kr: "「V+什么」는 무엇을 묻나요?", en: "What does V+什么 ask?", jp: "「V+什么」は何を尋ねる？" }, options: ["时间", "地点", "动作对象", "原因"], answer: "动作对象", explanation: { kr: "什么作动词的宾语。", en: "什么 is the object of the verb.", jp: "什么是動詞の目的語。" } },
      { type: "choice", prompt: { cn: "「可以」的否定是？", kr: "「可以」의 부정은?", en: "What is the negative of 可以?", jp: "「可以」の否定は？" }, options: ["不可以", "没可以", "不可以", "A和C"], answer: "A和C", explanation: { kr: "不可以=不能。", en: "不可以 = cannot.", jp: "不可以=できない。" } },
      { type: "choice", prompt: { cn: "点饮料时「要」表示？", kr: "음료 주문할 때 「要」는?", en: "What does 要 mean when ordering?", jp: "注文時の「要」は？" }, options: ["必须", "want/order", "可能", "建议"], answer: "want/order", explanation: { kr: "要=想要、点。", en: "要 = want, order.", jp: "要=欲しい、注文する。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：你想喝什么？", kr: "따라 읽으세요.", en: "Repeat: What do you want to drink?", jp: "繰り返してください。" }, sampleAnswer: "你想喝什么？" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「吃」替换：你想喝什么？", kr: "「吃」로 바꿔 말하세요.", en: "Substitute with 吃.", jp: "「吃」で置き換えて。" }, sampleAnswer: "你想吃什么？" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "在咖啡厅点饮料，用「想喝」「要」「可以」。", kr: "카페에서 음료 주문하세요.", en: "Order drinks at a café using 想喝, 要, 可以.", jp: "カフェで飲み物を注文してください。" } },
    ],
  },
  6: {
    dialogue: [
      { speaker: "A", cn: "现在几点了？", pinyin: "Xiànzài jǐ diǎn le?", translations: { kr: "지금 몇 시예요?", en: "What time is it now?", jp: "今何時ですか？" } },
      { speaker: "B", cn: "我的手表快，手机显示九点十分。", pinyin: "Wǒ de shǒubiǎo kuài, shǒujī xiǎnshì jiǔ diǎn shí fēn.", translations: { kr: "제 시계가 빨라요. 휴대폰은 9시 10분이에요.", en: "My watch is fast; my phone shows 9:10.", jp: "私の時計は進んでいます。携帯は9時10分です。" } },
      { speaker: "A", cn: "还有一个小时就上课了。", pinyin: "Hái yǒu yī gè xiǎoshí jiù shàngkè le.", translations: { kr: "한 시간 후면 수업이에요.", en: "Class starts in one hour.", jp: "あと1時間で授業です。" } },
    ],
    grammar: [
      { name: "时间表达", explanation: { cn: "现在 + 几 + 点 + 了？询问当前时间。", kr: "현재 시간을 묻습니다.", en: "Ask current time: 现在 + 几 + 点 + 了？", jp: "現在の時刻を尋ねる。" }, examples: [{ cn: "现在几点了？", pinyin: "Xiànzài jǐ diǎn le?", translations: { kr: "지금 몇 시예요?", en: "What time is it now?", jp: "今何時ですか？" } }] },
      { name: "点 / 分", explanation: { cn: "数字 + 点 + 数字 + 分，表示具体时刻。", kr: "시와 분을 나타냅니다.", en: "Number + 点 + number + 分 for time.", jp: "時と分を表す。" }, examples: [{ cn: "九点十分", pinyin: "jiǔ diǎn shí fēn", translations: { kr: "9시 10분", en: "9:10", jp: "9時10分" } }] },
    ],
    extension: [
      { cn: "手表", pinyin: "shǒubiǎo", translations: { kr: "손목시계", en: "wristwatch", jp: "腕時計" }, note: "手+表" },
      { cn: "快/慢", pinyin: "kuài/màn", translations: { kr: "빠르다/느리다", en: "fast/slow", jp: "速い/遅い" }, note: "形容钟表" },
      { cn: "一小时", pinyin: "yī xiǎoshí", translations: { kr: "한 시간", en: "one hour", jp: "1時間" }, note: "时间量词" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「现在几点了」询问？", kr: "「现在几点了」는?", en: "What does 现在几点了 ask?", jp: "「现在几点了」は？" }, options: ["日期", "时间", "地点", "原因"], answer: "时间", explanation: { kr: "询问当前时刻。", en: "Asks current time.", jp: "現在の時刻を尋ねる。" } },
      { type: "choice", prompt: { cn: "「九点十分」的结构？", kr: "「九点十分」의 구조?", en: "Structure of 九点十分?", jp: "「九点十分」の構造は？" }, options: ["点+分", "数字+点+数字+分", "时+分", "刻"], answer: "数字+点+数字+分", explanation: { kr: "点表小时，分表分钟。", en: "点=hour, 分=minute.", jp: "点=時、分=分。" } },
      { type: "choice", prompt: { cn: "「手表快」的意思是？", kr: "「手表快」의 뜻은?", en: "What does 手表快 mean?", jp: "「手表快」の意味は？" }, options: ["表坏了", "表走得快", "表很贵", "表丢了"], answer: "表走得快", explanation: { kr: "快=走得快，时间超前。", en: "快 = runs fast.", jp: "快=進んでいる。" } },
      { type: "choice", prompt: { cn: "「就」在「就上课了」中表示？", kr: "「就」在「就上课了」에서?", en: "What does 就 mean in 就上课了?", jp: "「就上课了」の「就」は？" }, options: ["强调", "即将", "已经", "才"], answer: "即将", explanation: { kr: "就表示即将发生。", en: "就 indicates imminent action.", jp: "就はまもなくを表す。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：现在几点了？", kr: "따라 읽으세요.", en: "Repeat: What time is it now?", jp: "繰り返してください。" }, sampleAnswer: "现在几点了？" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「八点」替换：九点十分。", kr: "「八点」로 바꿔 말하세요.", en: "Substitute with 八点.", jp: "「八点」で置き換えて。" }, sampleAnswer: "八点十分" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "问对方现在几点，并讨论时间。", kr: "지금 몇 시인지 물어보고 시간에 대해 이야기하세요.", en: "Ask the time and discuss schedules.", jp: "今何時か聞いて、時間について話してください。" } },
    ],
  },
  7: {
    dialogue: [
      { speaker: "A", cn: "今天很冷！", pinyin: "Jīntiān hěn lěng!", translations: { kr: "오늘 너무 추워요!", en: "It's very cold today!", jp: "今日はとても寒いです！" } },
      { speaker: "B", cn: "是的，你要多穿衣服。", pinyin: "Shì de, nǐ yào duō chuān yīfu.", translations: { kr: "맞아요. 옷 많이 입으세요.", en: "Yes, wear more clothes.", jp: "はい、服をたくさん着てください。" } },
      { speaker: "A", cn: "今天天气非常不好，阴天。", pinyin: "Jīntiān tiānqì fēicháng bù hǎo, yīntiān.", translations: { kr: "오늘 날씨가 매우 안 좋아요. 흐려요.", en: "The weather is very bad today, cloudy.", jp: "今日の天気はとても悪いです。曇りです。" } },
    ],
    grammar: [
      { name: "形容词谓语句", explanation: { cn: "今天 + 很 + Adj，描述天气或状态。", kr: "날씨나 상태를 묘사합니다.", en: "今天 + 很 + Adj describes weather/state.", jp: "天気や状態を描写する。" }, examples: [{ cn: "今天很冷。", pinyin: "Jīntiān hěn lěng.", translations: { kr: "오늘 추워요.", en: "It's cold today.", jp: "今日は寒いです。" } }] },
      { name: "程度副词 非常", explanation: { cn: "非常 + Adj，表示程度很高。", kr: "매우 높은 정도를 나타냅니다.", en: "非常 + Adj = very, extremely.", jp: "非常に高い程度を表す。" }, examples: [{ cn: "非常好吃", pinyin: "fēicháng hǎochī", translations: { kr: "매우 맛있어요", en: "very delicious", jp: "とても美味しい" } }] },
    ],
    extension: [
      { cn: "穿衣服", pinyin: "chuān yīfu", translations: { kr: "옷 입다", en: "wear clothes", jp: "服を着る" }, note: "穿+衣服" },
      { cn: "晴天/阴天", pinyin: "qíngtiān/yīntiān", translations: { kr: "맑음/흐림", en: "sunny/cloudy", jp: "晴れ/曇り" }, note: "天气词" },
      { cn: "非常", pinyin: "fēicháng", translations: { kr: "매우", en: "very", jp: "非常に" }, note: "程度副词" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「今天很冷」的结构？", kr: "「今天很冷」의 구조?", en: "Structure of 今天很冷?", jp: "「今天很冷」の構造は？" }, options: ["S+很+Adj", "S+V+O", "V+了", "不+Adj"], answer: "S+很+Adj", explanation: { kr: "形容词谓语句。", en: "Adjective as predicate.", jp: "形容詞述語文。" } },
      { type: "choice", prompt: { cn: "「非常」比「很」？", kr: "「非常」와 「很」?", en: "非常 vs 很?", jp: "「非常」と「很」は？" }, options: ["非常更强", "一样", "很更强", "不同用法"], answer: "非常更强", explanation: { kr: "非常程度更高。", en: "非常 is stronger.", jp: "非常の方が程度が高い。" } },
      { type: "choice", prompt: { cn: "「穿」的宾语？", kr: "「穿」의 목적어?", en: "Object of 穿?", jp: "「穿」の目的語は？" }, options: ["吃", "衣服/鞋", "喝", "看"], answer: "衣服/鞋", explanation: { kr: "穿衣服、穿鞋。", en: "穿 clothes, 穿 shoes.", jp: "服を着る、靴を履く。" } },
      { type: "choice", prompt: { cn: "「阴天」的意思是？", kr: "「阴天」의 뜻은?", en: "What does 阴天 mean?", jp: "「阴天」の意味は？" }, options: ["晴天", "cloudy", "下雨", "下雪"], answer: "cloudy", explanation: { kr: "阴=云多，不晴。", en: "阴 = cloudy.", jp: "阴=曇り。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：今天很冷。", kr: "따라 읽으세요.", en: "Repeat: It's cold today.", jp: "繰り返してください。" }, sampleAnswer: "今天很冷。" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「热」替换：今天很冷。", kr: "「热」로 바꿔 말하세요.", en: "Substitute with 热.", jp: "「热」で置き換えて。" }, sampleAnswer: "今天很热。" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "描述今天的天气，用「很」「非常」。", kr: "오늘 날씨를 묘사하세요.", en: "Describe today's weather with 很/非常.", jp: "今日の天気を描写してください。" } },
    ],
  },
  8: {
    dialogue: [
      { speaker: "A", cn: "周末你做什么？", pinyin: "Zhōumò nǐ zuò shénme?", translations: { kr: "주말에 뭐 해요?", en: "What do you do on weekends?", jp: "週末は何をしますか？" } },
      { speaker: "B", cn: "我在家休息，晚上去跑步。", pinyin: "Wǒ zài jiā xiūxi, wǎnshang qù pǎobù.", translations: { kr: "집에서 쉬고, 저녁에 달려요.", en: "I rest at home, run in the evening.", jp: "家で休んで、夜走ります。" } },
      { speaker: "A", cn: "你正在唱歌吗？", pinyin: "Nǐ zhèngzài chànggē ma?", translations: { kr: "지금 노래하고 있어요?", en: "Are you singing now?", jp: "今歌っていますか？" } },
      { speaker: "B", cn: "不，我在跳舞，很快乐！", pinyin: "Bù, wǒ zài tiàowǔ, hěn kuàilè!", translations: { kr: "아니요, 춤추고 있어요. 아주 즐거워요!", en: "No, I'm dancing, very happy!", jp: "いいえ、踊っています。とても楽しいです！" } },
    ],
    grammar: [
      { name: "时间词 + 做什么", explanation: { cn: "周末 + 你 + 做什么？询问某时做什么。", kr: "특정 시간에 뭘 하는지 묻습니다.", en: "Time + 你 + 做什么？ asks activities.", jp: "ある時に何をするか尋ねる。" }, examples: [{ cn: "周末你做什么？", pinyin: "Zhōumò nǐ zuò shénme?", translations: { kr: "주말에 뭐 해요?", en: "What do you do on weekends?", jp: "週末は何をしますか？" } }] },
      { name: "在/正在", explanation: { cn: "在 + V，表示动作正在进行。", kr: "동작이 진행 중임을 나타냅니다.", en: "在 + V: action in progress.", jp: "動作が進行中である。" }, examples: [{ cn: "我在学习。", pinyin: "Wǒ zài xuéxí.", translations: { kr: "저는 공부하고 있어요.", en: "I'm studying.", jp: "勉強しています。" } }] },
    ],
    extension: [
      { cn: "休息", pinyin: "xiūxi", translations: { kr: "쉬다", en: "rest", jp: "休む" }, note: "休息+一下" },
      { cn: "玩", pinyin: "wán", translations: { kr: "놀다", en: "play", jp: "遊ぶ" }, note: "玩+游戏" },
      { cn: "晚上", pinyin: "wǎnshang", translations: { kr: "저녁", en: "evening", jp: "夜" }, note: "时间词" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「周末你做什么」询问？", kr: "「周末你做什么」는?", en: "What does 周末你做什么 ask?", jp: "「周末你做什么」は？" }, options: ["时间", "活动", "地点", "人物"], answer: "活动", explanation: { kr: "询问周末活动。", en: "Asks weekend activities.", jp: "週末の活動を尋ねる。" } },
      { type: "choice", prompt: { cn: "「在+V」表示？", kr: "「在+V」는?", en: "What does 在+V express?", jp: "「在+V」は？" }, options: ["完成", "进行", "将来", "建议"], answer: "进行", explanation: { kr: "动作正在进行。", en: "Action in progress.", jp: "動作が進行中。" } },
      { type: "choice", prompt: { cn: "「快乐」的意思是？", kr: "「快乐」의 뜻은?", en: "What does 快乐 mean?", jp: "「快乐」の意味は？" }, options: ["快", "happy", "慢", "累"], answer: "happy", explanation: { kr: "快乐=高兴、开心。", en: "快乐 = happy.", jp: "快乐=嬉しい、楽しい。" } },
      { type: "choice", prompt: { cn: "「跑步」是？", kr: "「跑步」는?", en: "What is 跑步?", jp: "「跑步」は？" }, options: ["走", "run", "坐", "飞"], answer: "run", explanation: { kr: "跑步=달리기。", en: "跑步 = running.", jp: "跑步=走ること。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：周末你做什么？", kr: "따라 읽으세요.", en: "Repeat: What do you do on weekends?", jp: "繰り返してください。" }, sampleAnswer: "周末你做什么？" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「晚上」替换：周末你做什么。", kr: "「晚上」로 바꿔 말하세요.", en: "Substitute with 晚上.", jp: "「晚上」で置き換えて。" }, sampleAnswer: "晚上你做什么？" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "说说你周末做什么，用「在+V」。", kr: "주말에 뭘 하는지 말하세요.", en: "Talk about your weekend with 在+V.", jp: "週末に何をするか話してください。" } },
    ],
  },
  9: {
    dialogue: [
      { speaker: "A", cn: "我每天学习汉语。", pinyin: "Wǒ měi tiān xuéxí Hànyǔ.", translations: { kr: "저는 매일 중국어를 배워요.", en: "I study Chinese every day.", jp: "私は毎日中国語を勉強します。" } },
      { speaker: "B", cn: "你每节课都来吗？", pinyin: "Nǐ měi jié kè dōu lái ma?", translations: { kr: "매 수업마다 오세요?", en: "Do you come to every class?", jp: "毎授業来ますか？" } },
      { speaker: "A", cn: "是的，我可以开始考试了。", pinyin: "Shì de, wǒ kěyǐ kāishǐ kǎoshì le.", translations: { kr: "네. 이제 시험 볼 수 있어요.", en: "Yes, I can start the exam now.", jp: "はい、もう試験を受けられます。" } },
    ],
    grammar: [
      { name: "每 + 时间", explanation: { cn: "每 + 天/天 + V，表示频率。", kr: "빈도를 나타냅니다.", en: "每 + day/time + V: frequency.", jp: "頻度を表す。" }, examples: [{ cn: "每天学习", pinyin: "měi tiān xuéxí", translations: { kr: "매일 공부하다", en: "study every day", jp: "毎日勉強する" } }] },
      { name: "能愿动词 可以", explanation: { cn: "可以 + V，表示能力或许可。", kr: "능력이나 허가를 나타냅니다.", en: "可以 + V: ability or permission.", jp: "能力や許可を表す。" }, examples: [{ cn: "可以开始", pinyin: "kěyǐ kāishǐ", translations: { kr: "시작할 수 있다", en: "can start", jp: "始められる" } }] },
    ],
    extension: [
      { cn: "开始", pinyin: "kāishǐ", translations: { kr: "시작하다", en: "begin", jp: "始める" }, note: "开始+V" },
      { cn: "考试", pinyin: "kǎoshì", translations: { kr: "시험", en: "exam", jp: "試験" }, note: "考试/参加考试" },
      { cn: "课", pinyin: "kè", translations: { kr: "수업", en: "class", jp: "授業" }, note: "一节课" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「每天」表示？", kr: "「每天」는?", en: "What does 每天 mean?", jp: "「每天」は？" }, options: ["一次", "every day", "有时", "从不"], answer: "every day", explanation: { kr: "每+天=每天。", en: "每+天 = every day.", jp: "每+天=毎日。" } },
      { type: "choice", prompt: { cn: "「可以开始」中「可以」表示？", kr: "「可以开始」에서 「可以」는?", en: "What does 可以 mean in 可以开始?", jp: "「可以开始」の「可以」は？" }, options: ["必须", "ability", "可能", "建议"], answer: "ability", explanation: { kr: "可以=能够。", en: "可以 = be able to.", jp: "可以=できる。" } },
      { type: "choice", prompt: { cn: "「开始」的用法？", kr: "「开始」의 용법?", en: "Usage of 开始?", jp: "「开始」の用法は？" }, options: ["开始+V", "V+开始", "开始+N", "A和C"], answer: "A和C", explanation: { kr: "开始学习、开始上课。", en: "开始 study, 开始 class.", jp: "开始学习、开始上课。" } },
      { type: "choice", prompt: { cn: "「课」的量词？", kr: "「课」의 양사?", en: "Measure word for 课?", jp: "「课」の量詞は？" }, options: ["个", "节", "门", "B和C"], answer: "B和C", explanation: { kr: "一节课、一门课。", en: "一节 class, 一门 course.", jp: "一节课、一门课。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：我每天学习汉语。", kr: "따라 읽으세요.", en: "Repeat: I study Chinese every day.", jp: "繰り返してください。" }, sampleAnswer: "我每天学习汉语。" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「英语」替换：学习汉语。", kr: "「英语」로 바꿔 말하세요.", en: "Substitute with 英语.", jp: "「英语」で置き換えて。" }, sampleAnswer: "学习英语" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "说说你每天做什么，用「每+时间」。", kr: "매일 뭘 하는지 말하세요.", en: "Talk about your daily routine with 每+time.", jp: "毎日何をするか話してください。" } },
    ],
  },
  10: {
    dialogue: [
      { speaker: "A", cn: "我准备学习中文。", pinyin: "Wǒ zhǔnbèi xuéxí Zhōngwén.", translations: { kr: "저는 중국어 공부할 준비해요.", en: "I'm preparing to study Chinese.", jp: "私は中国語を勉強する準備をしています。" } },
      { speaker: "B", cn: "希望你能学好。你知道「新」的意思吗？", pinyin: "Xīwàng nǐ néng xué hǎo. Nǐ zhīdào 「xīn」 de yìsi ma?", translations: { kr: "잘 배우길 바라요. 「新」의 의미 알아요?", en: "I hope you learn well. Do you know the meaning of 新?", jp: "よく学べることを願います。「新」の意味を知っていますか？" } },
      { speaker: "A", cn: "知道，新是为新的开始。", pinyin: "Zhīdào, xīn shì wèi xīn de kāishǐ.", translations: { kr: "알아요. 新은 새로운 시작을 위한 거예요.", en: "Yes, 新 is for a new beginning.", jp: "知っています。新は新しい始まりのためです。" } },
    ],
    grammar: [
      { name: "准备 + V", explanation: { cn: "准备 + 动词，表示准备做某事。", kr: "~할 준비를 하다.", en: "准备 + verb: prepare to do.", jp: "〜する準備をする。" }, examples: [{ cn: "准备考试", pinyin: "zhǔnbèi kǎoshì", translations: { kr: "시험 준비하다", en: "prepare for exam", jp: "試験の準備をする" } }] },
      { name: "希望 + V", explanation: { cn: "希望 + 小句，表示愿望。", kr: "~하기를 바라다.", en: "希望 + clause: hope that.", jp: "〜することを願う。" }, examples: [{ cn: "希望你成功", pinyin: "xīwàng nǐ chénggōng", translations: { kr: "성공하길 바라요", en: "hope you succeed", jp: "成功することを願います" } }] },
    ],
    extension: [
      { cn: "知道", pinyin: "zhīdào", translations: { kr: "알다", en: "know", jp: "知る" }, note: "知道+事" },
      { cn: "意思", pinyin: "yìsi", translations: { kr: "의미", en: "meaning", jp: "意味" }, note: "的意思" },
      { cn: "为", pinyin: "wéi", translations: { kr: "~를 위해", en: "for", jp: "〜のために" }, note: "为+目的" },
    ],
    practice: [
      { type: "choice", prompt: { cn: "「准备+V」表示？", kr: "「准备+V」는?", en: "What does 准备+V mean?", jp: "「准备+V」は？" }, options: ["完成", "prepare to", "进行", "建议"], answer: "prepare to", explanation: { kr: "准备做某事。", en: "Prepare to do something.", jp: "〜する準備をする。" } },
      { type: "choice", prompt: { cn: "「希望」后面接？", kr: "「希望」뒤에?", en: "What follows 希望?", jp: "「希望」の後は？" }, options: ["名词", "小句/动词", "形容词", "量词"], answer: "小句/动词", explanation: { kr: "希望+小句。", en: "希望 + clause.", jp: "希望+小句。" } },
      { type: "choice", prompt: { cn: "「知道」的宾语？", kr: "「知道」의 목적어?", en: "Object of 知道?", jp: "「知道」の目的語は？" }, options: ["人", "事/内容", "地方", "时间"], answer: "事/内容", explanation: { kr: "知道这件事、知道意思。", en: "知道 this, 知道 meaning.", jp: "知道这件事、知道意思。" } },
      { type: "choice", prompt: { cn: "「为」表示？", kr: "「为」는?", en: "What does 为 indicate?", jp: "「为」は？" }, options: ["原因", "目的", "时间", "地点"], answer: "目的", explanation: { kr: "为=为了，表目的。", en: "为 = for, purpose.", jp: "为=为了、目的を表す。" } },
    ],
    aiPrompts: [
      { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读：我准备学习中文。", kr: "따라 읽으세요.", en: "Repeat: I'm preparing to study Chinese.", jp: "繰り返してください。" }, sampleAnswer: "我准备学习中文。" },
      { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "用「考试」替换：准备学习。", kr: "「考试」로 바꿔 말하세요.", en: "Substitute with 考试.", jp: "「考试」で置き換えて。" }, sampleAnswer: "准备考试" },
      { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "说说你准备做什么，用「准备」「希望」。", kr: "뭘 준비하는지 말하세요.", en: "Talk about what you're preparing with 准备/希望.", jp: "何を準備しているか話してください。" } },
    ],
  },
};

// 11-20 课内容（从 blueprint 动态生成 grammar，其余使用通用模板）
const BLUEPRINT_GRAMMAR_TEMPLATES = {
  11: { dialogue: [{ speaker: "A", cn: "他在学校工作。", pinyin: "Tā zài xuéxiào gōngzuò.", translations: { kr: "그는 학교에서 일해요.", en: "He works at school.", jp: "彼は学校で働いています。" } }, { speaker: "B", cn: "他得上班，但是今天生病了。", pinyin: "Tā déi shàngbān, dànshì jīntiān shēngbìng le.", translations: { kr: "출근해야 하는데 오늘 아팠어요.", en: "He has to work, but he's sick today.", jp: "出勤しなければならないが、今日は病気です。" } }], theme: "工作地点" },
  12: { dialogue: [{ speaker: "A", cn: "他工作很努力。", pinyin: "Tā gōngzuò hěn nǔlì.", translations: { kr: "그는 일을 열심히 해요.", en: "He works very hard.", jp: "彼は一生懸命働きます。" } }, { speaker: "B", cn: "但是很累，早上起床就送孩子。", pinyin: "Dànshì hěn lěi, zǎoshang qǐchuáng jiù sòng háizi.", translations: { kr: "하지만 피곤해요. 아침에 일어나자마자 아이를 보내요.", en: "But very tired, gets up and sends the child in the morning.", jp: "しかし疲れています。朝起きてすぐ子供を送ります。" } }], theme: "努力" },
  13: { dialogue: [{ speaker: "A", cn: "我坐地铁去公司。", pinyin: "Wǒ zuò dìtiě qù gōngsī.", translations: { kr: "저는 지하철 타고 회사에 가요.", en: "I take the subway to work.", jp: "私は地下鉄で会社に行きます。" } }, { speaker: "B", cn: "从家到公司要多久？", pinyin: "Cóng jiā dào gōngsī yào duōjiǔ?", translations: { kr: "집에서 회사까지 얼마나 걸려요?", en: "How long from home to company?", jp: "家から会社までどのくらいかかりますか？" } }], theme: "交通" },
  14: { dialogue: [{ speaker: "A", cn: "我们一起去旅行吧！", pinyin: "Wǒmen yīqǐ qù lǚxíng ba!", translations: { kr: "우리 함께 여행 가요!", en: "Let's travel together!", jp: "一緒に旅行に行きましょう！" } }, { speaker: "B", cn: "去年我去过机场，今年买票去。", pinyin: "Qùnián wǒ qùguò jīchǎng, jīnnián mǎi piào qù.", translations: { kr: "작년에 공항 갔어요. 올해 표 사서 가요.", en: "Last year I went to the airport, this year I'll buy tickets.", jp: "去年空港に行きました。今年は切符を買って行きます。" } }], theme: "旅行" },
  15: { dialogue: [{ speaker: "A", cn: "明年我想去中国。", pinyin: "Míngnián wǒ xiǎng qù Zhōngguó.", translations: { kr: "내년에 중국에 가고 싶어요.", en: "I want to go to China next year.", jp: "来年中国に行きたいです。" } }, { speaker: "B", cn: "可能我们一起去。", pinyin: "Kěnéng wǒmen yīqǐ qù.", translations: { kr: "아마 우리 함께 갈 수 있어요.", en: "Maybe we can go together.", jp: "多分一緒に行けるかもしれません。" } }], theme: "计划" },
  16: { dialogue: [{ speaker: "A", cn: "我喜欢运动。", pinyin: "Wǒ xǐhuan yùndòng.", translations: { kr: "저는 운동을 좋아해요.", en: "I like sports.", jp: "私は運動が好きです。" } }, { speaker: "B", cn: "你游泳还是打篮球？", pinyin: "Nǐ yóuyǒng háishì dǎ lánqiú?", translations: { kr: "수영해요? 농구해요?", en: "Do you swim or play basketball?", jp: "泳ぎますか？バスケをしますか？" } }], theme: "运动" },
  17: { dialogue: [{ speaker: "A", cn: "你觉得怎么样？", pinyin: "Nǐ juéde zěnmeyàng?", translations: { kr: "어때요?", en: "What do you think?", jp: "どう思いますか？" } }, { speaker: "B", cn: "我觉得非常好！", pinyin: "Wǒ juéde fēicháng hǎo!", translations: { kr: "정말 좋다고 생각해요!", en: "I think it's very good!", jp: "とても良いと思います！" } }], theme: "评价" },
  18: { dialogue: [{ speaker: "A", cn: "请你帮我一下。", pinyin: "Qǐng nǐ bāng wǒ yīxià.", translations: { kr: "잠깐 도와주세요.", en: "Please help me.", jp: "ちょっと手伝ってください。" } }, { speaker: "B", cn: "可以，你要问什么？", pinyin: "Kěyǐ, nǐ yào wèn shénme?", translations: { kr: "네, 뭘 물어보고 싶어요?", en: "Sure, what do you want to ask?", jp: "はい、何を聞きたいですか？" } }], theme: "请求" },
  19: { dialogue: [{ speaker: "A", cn: "这个比那个好。", pinyin: "Zhège bǐ nàge hǎo.", translations: { kr: "이게 그거보다 좋아요.", en: "This is better than that.", jp: "これはあれより良いです。" } }, { speaker: "B", cn: "这个便宜，那个贵。", pinyin: "Zhège piányi, nàge guì.", translations: { kr: "이건 싸고 저건 비싸요.", en: "This is cheap, that's expensive.", jp: "これは安く、あれは高いです。" } }], theme: "比较" },
  20: { dialogue: [{ speaker: "A", cn: "因为下雨所以没去。", pinyin: "Yīnwèi xiàyǔ suǒyǐ méi qù.", translations: { kr: "비가 와서 가지 않았어요.", en: "Because it rained, I didn't go.", jp: "雨が降ったので行きませんでした。" } }, { speaker: "B", cn: "昨天已经完了，今天再去。", pinyin: "Zuótiān yǐjīng wán le, jīntiān zài qù.", translations: { kr: "어제 이미 끝났어요. 오늘 다시 가요.", en: "Yesterday it was already over, go again today.", jp: "昨日はもう終わりました。今日また行きます。" } }], theme: "因果" },
};

function buildGrammarFromBlueprint(bp, lessonNo) {
  const grammars = [];
  if (bp.mainGrammar?.name) {
    grammars.push({
      name: bp.mainGrammar.name,
      explanation: {
        cn: `${bp.mainGrammar.name}：${bp.mainGrammar.focus}`,
        kr: `${bp.mainGrammar.name}：${bp.mainGrammar.focus}`,
        en: `${bp.mainGrammar.name}: ${bp.mainGrammar.focus}`,
        jp: `${bp.mainGrammar.name}：${bp.mainGrammar.focus}`,
      },
      examples: [{ cn: bp.mainGrammar.focus, pinyin: "", translations: { kr: bp.mainGrammar.focus, en: bp.mainGrammar.focus, jp: bp.mainGrammar.focus } }],
    });
  }
  for (const sg of bp.supportGrammar || []) {
    grammars.push({
      name: sg.name,
      explanation: { cn: sg.focus, kr: sg.focus, en: sg.focus, jp: sg.focus },
      examples: [{ cn: sg.focus, pinyin: "", translations: { kr: sg.focus, en: sg.focus, jp: sg.focus } }],
    });
  }
  return grammars;
}

function buildReviewForStudyLesson(lessonNo, blueprint, allLessons) {
  const bp = blueprint.find((b) => b.lesson === lessonNo);
  if (!bp || bp.type !== "study") return { lessonWords: [], relatedOldWords: [], grammarReview: [] };
  const lessonWords = (bp.newWords || []).map((w) => w.hanzi);
  const grammarReview = [];
  if (bp.mainGrammar?.name) grammarReview.push({ name: bp.mainGrammar.name, summary: bp.mainGrammar.focus });
  for (const sg of bp.supportGrammar || []) grammarReview.push({ name: sg.name, summary: sg.focus });
  const relatedOldWords = [];
  for (let i = 1; i < lessonNo; i++) {
    const prev = blueprint.find((b) => b.lesson === i);
    if (prev?.newWords) relatedOldWords.push(...prev.newWords.slice(0, 3).map((w) => w.hanzi));
  }
  return { lessonWords, relatedOldWords: [...new Set(relatedOldWords)].slice(0, 10), grammarReview };
}

function buildReviewLessonContent(lessonNo, blueprint, allLessons) {
  const bp = blueprint.find((b) => b.lesson === lessonNo);
  if (!bp || bp.type !== "review") return null;
  const range = bp.reviewRange || bp.reviewWordsFromLessons || [];
  const [start, end] = Array.isArray(range) && range.length >= 2 ? range : [range[0], range[0]];
  const lessonIds = bp.reviewWordsFromLessons || bp.review?.lessonIds || [];
  const actualIds = lessonIds.length ? lessonIds : Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const lessonWords = [];
  const relatedOldWords = [];
  const grammarReview = [];
  for (const id of actualIds) {
    const lb = blueprint.find((b) => b.lesson === id);
    if (lb?.newWords) lessonWords.push(...lb.newWords.map((w) => w.hanzi));
    if (lb?.mainGrammar?.name) grammarReview.push({ name: lb.mainGrammar.name, summary: lb.mainGrammar.focus });
    for (const sg of lb?.supportGrammar || []) grammarReview.push({ name: sg.name, summary: sg.focus });
  }
  return {
    lessonWords: [...new Set(lessonWords)],
    relatedOldWords: [...new Set(relatedOldWords)].slice(0, 20),
    grammarReview: grammarReview.filter((g, i, a) => a.findIndex((x) => x.name === g.name) === i),
    lessonRange: [Math.min(...actualIds), Math.max(...actualIds)],
    lessonIds: actualIds,
  };
}

function buildExtensionFromBlueprint(bp, count = 4) {
  if (!bp?.newWords?.length) return [];
  return bp.newWords.slice(0, count).map((w) => ({
    cn: w.hanzi,
    pinyin: w.pinyin,
    translations: w.translations || {},
    note: "",
  }));
}

function buildPracticeFromBlueprint(bp, count = 5) {
  if (!bp?.mainGrammar) return [];
  const items = [];
  const mg = bp.mainGrammar;
  items.push({
    type: "choice",
    prompt: { cn: `「${mg.name}」的句型是？`, kr: `「${mg.name}」의 문형은?`, en: `What is the pattern for ${mg.name}?`, jp: `「${mg.name}」の文型は？` },
    options: [mg.focus, "其他", "不确定", "以上都对"],
    answer: mg.focus,
    explanation: { kr: mg.focus, en: mg.focus, jp: mg.focus },
  });
  for (const sg of bp.supportGrammar || []) {
    if (items.length >= count) break;
    items.push({
      type: "choice",
      prompt: { cn: `「${sg.name}」表示？`, kr: `「${sg.name}」는?`, en: `What does ${sg.name} indicate?`, jp: `「${sg.name}」は？` },
      options: [sg.focus, "其他", "不确定", "以上都对"],
      answer: sg.focus,
      explanation: { kr: sg.focus, en: sg.focus, jp: sg.focus },
    });
  }
  return items;
}

function getContentForLesson(lessonNo, blueprint, content) {
  const c = content || LESSON_CONTENT[lessonNo];
  const bp = blueprint.find((b) => b.lesson === lessonNo);
  if (!c && !bp) return null;
  const dialogue = c?.dialogue?.length ? c.dialogue : (BLUEPRINT_GRAMMAR_TEMPLATES[lessonNo]?.dialogue || []);
  const grammar = c?.grammar?.length ? c.grammar : buildGrammarFromBlueprint(bp, lessonNo);
  const extension = c?.extension?.length ? c.extension : buildExtensionFromBlueprint(bp, 4);
  const practice = c?.practice?.length ? c.practice : buildPracticeFromBlueprint(bp, 5);
  const aiPrompts = c?.aiPrompts?.length ? c.aiPrompts : [
    { type: "repeat", title: { cn: "跟读", kr: "따라 읽기", en: "Repeat", jp: "リピート" }, prompt: { cn: "跟读本课对话。", kr: "따라 읽으세요.", en: "Repeat the dialogue.", jp: "繰り返してください。" }, sampleAnswer: "" },
    { type: "substitute", title: { cn: "替换", kr: "대체", en: "Substitute", jp: "置き換え" }, prompt: { cn: "替换练习。", kr: "대체 연습.", en: "Substitution drill.", jp: "置き換え練習。" }, sampleAnswer: "" },
    { type: "free_talk", title: { cn: "自由对话", kr: "자유 대화", en: "Free talk", jp: "自由会話" }, prompt: { cn: "用本课内容自由对话。", kr: "자유 대화하세요.", en: "Free talk with lesson content.", jp: "本課の内容で自由会話。" }, sampleAnswer: "" },
  ];
  return { dialogue, grammar, extension, practice, aiPrompts };
}

// ========== 主逻辑 ==========
const blueprint = JSON.parse(readFileSync(BLUEPRINT_PATH, "utf-8"));

for (let no = 1; no <= 22; no++) {
  const lessonPath = join(LESSONS_DIR, `lesson${no}.json`);
  let lesson;
  try {
    lesson = JSON.parse(readFileSync(lessonPath, "utf-8"));
  } catch {
    console.warn(`Skip lesson${no}.json (not found)`);
    continue;
  }

  const bp = blueprint.find((b) => b.lesson === no);
  const isReview = lesson.type === "review" || bp?.type === "review";

  if (isReview) {
    const reviewData = buildReviewLessonContent(no, blueprint, lesson);
    if (reviewData) {
      lesson.review = {
        ...lesson.review,
        ...reviewData,
      };
      if (bp?.reviewRange) lesson.reviewRange = bp.reviewRange;
      if (bp?.reviewWordsFromLessons) lesson.reviewWordsFromLessons = bp.reviewWordsFromLessons;
      if (bp?.reviewGrammar) lesson.reviewGrammar = bp.reviewGrammar;
    }
  } else {
    const content = getContentForLesson(no, blueprint, LESSON_CONTENT[no]);
    if (content) {
      lesson.dialogue = content.dialogue;
      lesson.grammar = content.grammar;
      lesson.extension = content.extension;
      lesson.practice = content.practice;
      lesson.aiPrompts = content.aiPrompts;
      lesson.review = buildReviewForStudyLesson(no, blueprint, lesson);
    }
  }

  writeFileSync(lessonPath, JSON.stringify(lesson, null, 2), "utf-8");
  console.log(`Wrote lesson${no}.json`);
}

console.log("Done. Generated full content for lesson1~22.json");

// 课程自动检查：dialogueWords ⊆ wordCard，未收录词自动加入
console.log("\nRunning word pool check...");
const check = spawnSync("node", [join(ROOT, "scripts/check-lesson-word-pool.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
if (check.status !== 0) {
  console.warn("Word pool check had issues (check output above)");
}
