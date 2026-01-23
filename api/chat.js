export default async function handler(req, res) {
  // 1. 获取 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  
  // 2. 检查 Key 是否配置（商务总监视角：避免无效请求）
  if (!apiKey) {
    return res.status(500).json({ 
      error: "API_KEY_MISSING", 
      message: "Vercel 환경 변수에 API Key가 설정되지 않았습니다." 
    });
  }

  const { prompt } = req.body;

  try {
    // 3. 向 Google 发起请求
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: "당신은 한국인 학생을 가르치는 친절한 중국어 선생님입니다. 질문에 대해 한국어로 명확하게 설명해 주세요. 질문: " + prompt }] 
        }]
      })
    });

    const data = await response.json();

    // 4. 处理 Google 返回的错误（比如频率超限等）
    if (data.error) {
      console.error("Google API Error:", data.error);
      return res.status(400).json(data);
    }

    // 5. 成功返回数据
    res.status(200).json(data);
  } catch (error) {
    // 6. 捕获系统级错误（研发专家视角：防止后端白屏）
    console.error("Server Error:", error);
    res.status(500).json({ error: "SERVER_ERROR", details: error.message });
  }
}
