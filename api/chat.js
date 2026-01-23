// api/chat.js 完整代码
export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  const { prompt } = req.body;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key Not Found" });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "당신은 한국인을 위한 중국어 선생님입니다. 모든 답변은 한국어로 해주세요. 질문: " + prompt }] }]
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "API Request Failed" });
  }
}
