// Netlify Function — reachable at /api/health.
// Confirms server configuration presence without ever exposing secret values.

export const handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    })
  };
};
