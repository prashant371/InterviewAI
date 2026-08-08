// Vercel serverless function.
// Keeps the real Anthropic API key on the server — never sent to the browser.
// The frontend calls POST /api/interview with { system, messages } and gets
// back the same shape as Anthropic's /v1/messages response.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
    return;
  }

  const { system, messages } = req.body || {};
  if (!system || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Request must include "system" (string) and "messages" (array)' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system,
        messages
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Anthropic API', detail: String(err) });
  }
}
