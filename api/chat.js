export default async function handler(req, res) {
  // 这段代码会去 Vercel 的保险柜里取那把叫 GEMINI_API_KEY 的钥匙
  const apiKey = process.env.GEMINI_API_KEY;
  const { prompt } = req.body;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "당신은 친절한 중국어 선생님입니다. 학생의 질문에 한국어로 친절하게 답변해주세요. 배경은 HSK 1급 초보자 수준입니다. 답변은 한국어로 하세요. 질문: " + prompt }]
        }]
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "AI Brain logic failed" });
  }
}
