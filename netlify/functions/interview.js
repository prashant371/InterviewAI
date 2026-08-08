// Netlify Function. Different runtime/export convention than Vercel's api/*.js
// — Netlify Functions export a "handler" that receives an event object
// instead of Express-style (req, res).
//
// Reached via /api/interview thanks to the redirect rule in netlify.toml,
// which forwards that path to /.netlify/functions/interview.

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server' })
    };
  }

  let system, messages;
  try {
    const parsedBody = JSON.parse(event.body || '{}');
    system = parsedBody.system;
    messages = parsedBody.messages;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!system || !Array.isArray(messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Request must include "system" (string) and "messages" (array)' })
    };
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
      return { statusCode: upstream.status, body: JSON.stringify(data) };
    }

    const candidate = (data.candidates || [])[0];
    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

    return {
      statusCode: 200,
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Failed to reach Gemini API', detail: String(err) })
    };
  }
};
