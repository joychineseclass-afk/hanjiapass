export default async function handler(req, res) {
  // 1. 获取环境变量中的 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  const { prompt } = req.body;

  // 2. 检查 Key 是否已注入
  if (!apiKey) {
    return res.status(500).json({ 
      error: "API_KEY_MISSING", 
      message: "Vercel 환경 변수에 API Key가 설정되지 않았습니다. 다시 배포(Redeploy)해 주세요." 
    });
  }

  try {
    // 3. 请求 Google Gemini 1.5 Flash 接口
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: "당신은 한국인을 위한 친절한 중국어 선생님입니다. 모든 답변은 한국어로 명확하고 친절하게 설명해 주세요. 질문: " + prompt 
          }] 
        }]
      })
    });

    const data = await response.json();

    // 4. 处理 API 内部错误（如 Key 错误或区域限制）
    if (data.error) {
      console.error("Google Error Details:", data.error);
      return res.status(data.error.code || 400).json({ 
        error: "GOOGLE_API_ERROR", 
        message: data.error.message 
      });
    }

    // 5. 成功返回数据
    res.status(200).json(data);
  } catch (error) {
    // 6. 系统故障保护
    console.error("Server Runtime Error:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "서버 연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." 
    });
  }
}
