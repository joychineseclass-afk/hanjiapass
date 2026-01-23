export default async function handler(req, res) {
  // 1. 安全检查：确保 Vercel 已读取到 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  const { prompt } = req.body;

  if (!apiKey) {
    return res.status(500).json({ 
      error: "API_KEY_MISSING", 
      message: "Vercel 환경 변수에 API Key가 설정되지 않았습니다." 
    });
  }

  try {
    // 2. 调用 Google Gemini 1.5 Flash 接口
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: "당신은 한국인 학생을 가르치는 친절한 중국어 선생님입니다. 모든 답변은 한국어로 친절하게 설명해 주세요. 질문: " + prompt 
          }] 
        }]
      })
    });

    const data = await response.json();

    // 3. 处理 Google API 的内部错误（如 Key 无效或区域受限）
    if (data.error) {
      console.error("Google API Error:", data.error);
      return res.status(data.error.code || 400).json({ 
        error: "GOOGLE_API_ERROR", 
        message: data.error.message 
      });
    }

    // 4. 返回正常结果
    res.status(200).json(data);
  } catch (error) {
    // 5. 处理系统级崩溃（如网络超时）
    console.error("Server Error:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "서버 연결 오류가 발생했습니다." 
    });
  }
}
