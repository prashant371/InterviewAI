// Vercel serverless function.
// Calls Google's Gemini API server-side, using an API key stored only in
// Vercel's environment variables — never in this file, never in the browser.
//
// The frontend keeps sending the same shape it always has: { system, messages }
// where messages is [{ role: "user" | "assistant", content: "..." }].
// This function translates that into Gemini's request format, and translates
// Gemini's response back into the { content: [{ type: "text", text }] }
// shape the frontend already knows how to parse — so index.html needed no
// changes beyond pointing at /api/interview.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  const { system, messages } = req.body || {};
  if (!system || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Request must include "system" (string) and "messages" (array)' });
    return;
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    const candidate = (data.candidates || [])[0];
    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

    // Re-shape into the same envelope the frontend already expects.
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Gemini API', detail: String(err) });
  }
}
