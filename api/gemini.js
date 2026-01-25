export default async function handler(req, res) {
  // ========= 1) CORS =========
  const allowOrigins = [
    "https://hanjipass.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ];

  const origin = req.headers.origin;
  if (origin && allowOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET은 상태 확인용 (브라우저에서 열면 Method Not Allowed 대신 안내 JSON)
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Gemini API endpoint is alive. Use POST with JSON { prompt: '...' }",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  // ========= 2) ENV =========
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel env." });
  }

  // ========= 3) Parse body =========
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch {
    body = {};
  }

  const userPrompt = String(body.prompt || body.message || "").trim();
  if (!userPrompt) {
    return res.status(400).json({ error: "Empty prompt." });
  }

  // ========= 4) 固定老师人设 =========
  const SYSTEM_PROMPT = `
너는 “AI 한자 선생님”이다. (한국인 중국어 학습자 대상)
규칙:
1) 말투: 친절하고 전문적인 선생님 톤, 격려 중심.
2) 언어: 설명은 한국어 중심. 예문은 중국어. 필요하면 병음 추가.
3) 목표: 이해 + 암기 + 활용. 단계별로 정리하고 예문을 반드시 제시.
4) 교정: 사용자의 문장이 어색하면 문제점 → 자연스러운 문장 → 이유(한국어) 순서로 교정.
5) 출력 형식(가능하면 유지):
- ✅ 핵심(요점):
- 📌 뜻(의미/한자 구성):
- 🧠 기억법(암기 팁):
- ✍️ 예문(중문 + 병음 + 해석):
- ⚠️ 자주 하는 실수/교정(있으면):
6) 난이도: 기본 HSK3~4. 사용자가 초급/아이용이면 쉽게, 고급이면 더 깊게.
7) 너무 길게 늘어지지 말고, 핵심 위주로 명확하게.
  `.trim();

  const finalPrompt = `${SYSTEM_PROMPT}\n\n[학생 질문]\n${userPrompt}`;

  // ========= 5) Gemini API call =========
  // ✅ 가장 안정적으로 동작하는 v1 endpoint + :generateContent
  // 모델명은 프로젝트/키에 따라 다를 수 있어, 1차는 gemini-1.5-flash 로 둡니다.
  // 만약 "not found"가 뜨면 -> gemini-1.5-pro 또는 gemini-2.0-flash 로 바꾸면 됩니다.
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // 에러를 그대로 프론트에서 볼 수 있게 JSON으로 반환
      return res.status(resp.status).json({
        error: data?.error?.message || "Gemini API error",
        raw: data,
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "";

    return res.status(200).json({ text: text || "(응답 없음)" });

  } catch (e) {
    return res.status(500).json({
      error: "Server error: " + (e?.message || String(e)),
    });
  }
}
