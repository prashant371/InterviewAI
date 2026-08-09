// Netlify Function — single source of truth for the /api/interview backend.
// (netlify.toml redirects /api/* -> /.netlify/functions/:splat)
//
// Uses Groq's OpenAI-compatible chat completions API. Groq's free developer
// tier has genuinely usable rate limits (unlike the Gemini free tier, which
// returned a hard 0-quota error for this project's keys).
//
// Responsibilities:
//   - Read GROQ_API_KEY / GROQ_MODEL from server-side env only.
//   - Call Groq's chat completions endpoint with a timeout.
//   - Translate this app's { system, messages } request shape into OpenAI's
//     chat message array, and translate the response back into the
//     { content: [{ type: "text", text }] } shape the frontend expects.
//   - Return categorized, non-sensitive error JSON on every failure path.
//
// Error response shape (all error paths):
//   { "error": "<short machine-ish category>", "message": "<human-readable, safe>", "details": "<optional safe extra info>" }

const GROQ_TIMEOUT_MS = 30000;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function log(event, extra) {
  // Structured, secret-free logging. Never log the API key, auth headers,
  // or full request/response bodies (which may contain candidate answers).
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...extra }));
  } catch (_) {
    console.log(event);
  }
}

// Extract the first {...} JSON object from a string, tolerating code fences
// or stray text the model sometimes adds despite instructions.
function extractJsonObject(text) {
  const cleaned = String(text || '').trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw e;
    return JSON.parse(match[0]);
  }
}

export const handler = async (event) => {
  const startedAt = Date.now();
  log('request_received', { method: event.httpMethod });

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed', message: 'Only POST is supported on this endpoint.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    log('missing_api_key', {});
    return jsonResponse(500, {
      error: 'server_configuration_error',
      message: 'GROQ_API_KEY is not configured'
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'invalid_request_json', message: 'Request body must be valid JSON.' });
  }

  const { system, messages } = payload;
  if (!system || typeof system !== 'string' || !Array.isArray(messages)) {
    return jsonResponse(400, {
      error: 'invalid_request_shape',
      message: 'Request must include "system" (string) and "messages" (array).'
    });
  }

  // OpenAI-compatible chat format: system prompt is just another message
  // with role "system", and "assistant"/"user" roles pass through unchanged
  // (no role translation needed, unlike Gemini's "model" role).
  const chatMessages = [
    { role: 'system', content: system },
    ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') }))
  ];

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  let upstream;
  try {
    log('groq_request_started', { model });
    upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: chatMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startedAt;
    if (err.name === 'AbortError') {
      log('groq_timeout', { durationMs });
      return jsonResponse(504, {
        error: 'groq_timeout',
        message: `The AI service did not respond within ${GROQ_TIMEOUT_MS / 1000}s. Please retry.`
      });
    }
    log('groq_network_error', { durationMs, error: String(err) });
    return jsonResponse(502, {
      error: 'network_error',
      message: 'Could not reach the Groq API. Check your connection and retry.'
    });
  }
  clearTimeout(timeoutId);

  const durationMs = Date.now() - startedAt;
  log('groq_response_received', { status: upstream.status, durationMs });

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    log('groq_malformed_response', { durationMs });
    return jsonResponse(502, {
      error: 'malformed_upstream_response',
      message: 'The AI service returned an unreadable response. Please retry.'
    });
  }

  if (!upstream.ok) {
    const status = upstream.status;
    const apiMessage = data?.error?.message || 'Unknown upstream error.';
    let category = 'groq_api_error';
    let message = 'The AI service returned an error.';

    if (status === 401 || status === 403) {
      category = 'invalid_api_key';
      message = 'The configured Groq API key was rejected. It may be invalid, revoked, or missing required permissions.';
    } else if (status === 429) {
      category = 'rate_limited';
      message = 'The Groq API quota or rate limit was exceeded. Please wait and retry.';
    } else if (status === 400) {
      category = 'groq_bad_request';
      message = 'The request to the Groq API was malformed.';
    } else if (status >= 500) {
      category = 'groq_unavailable';
      message = 'The Groq API is temporarily unavailable. Please retry.';
    }

    log('groq_error_response', { status, category, durationMs });
    return jsonResponse(status, { error: category, message, details: apiMessage });
  }

  const choice = (data.choices || [])[0];
  const text = choice?.message?.content || '';

  if (!text) {
    log('groq_empty_choice', { durationMs });
    return jsonResponse(502, {
      error: 'empty_model_response',
      message: 'The AI service returned no usable content. Please retry.'
    });
  }

  // Sanity-check that the model's text is actually the JSON turn payload the
  // frontend expects. We still return the raw text either way — the
  // frontend does its own robust extraction — but this lets logs
  // distinguish "Groq is fine but off-format" from real outages.
  try {
    extractJsonObject(text);
  } catch (e) {
    log('groq_response_not_json', { durationMs });
  }

  log('request_succeeded', { durationMs });
  return jsonResponse(200, { content: [{ type: 'text', text }] });
};
