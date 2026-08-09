// Netlify Function — single source of truth for the /api/interview backend.
// (netlify.toml redirects /api/* -> /.netlify/functions/:splat)
//
// Responsibilities:
//   - Read GEMINI_API_KEY / GEMINI_MODEL from server-side env only.
//   - Call Gemini's generateContent endpoint with a timeout.
//   - Translate this app's { system, messages } request shape into Gemini's
//     request shape, and translate Gemini's response back into the
//     { content: [{ type: "text", text }] } shape the frontend expects.
//   - Return categorized, non-sensitive error JSON on every failure path,
//     so the frontend can tell the user what actually went wrong instead of
//     silently dropping into offline mode.
//
// Error response shape (all error paths):
//   { "error": "<short machine-ish category>", "message": "<human-readable, safe>", "details": "<optional safe extra info>" }

const GEMINI_TIMEOUT_MS = 30000;

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log('missing_api_key', {});
    return jsonResponse(500, {
      error: 'server_configuration_error',
      message: 'GEMINI_API_KEY is not configured'
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

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? '') }]
  }));

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let upstream;
  try {
    log('gemini_request_started', { model });
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
      })
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startedAt;
    if (err.name === 'AbortError') {
      log('gemini_timeout', { durationMs });
      return jsonResponse(504, {
        error: 'gemini_timeout',
        message: `The AI service did not respond within ${GEMINI_TIMEOUT_MS / 1000}s. Please retry.`
      });
    }
    log('gemini_network_error', { durationMs, error: String(err) });
    return jsonResponse(502, {
      error: 'network_error',
      message: 'Could not reach the Gemini API. Check your connection and retry.'
    });
  }
  clearTimeout(timeoutId);

  const durationMs = Date.now() - startedAt;
  log('gemini_response_received', { status: upstream.status, durationMs });

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    log('gemini_malformed_response', { durationMs });
    return jsonResponse(502, {
      error: 'malformed_upstream_response',
      message: 'The AI service returned an unreadable response. Please retry.'
    });
  }

  if (!upstream.ok) {
    const status = upstream.status;
    const apiMessage = data?.error?.message || 'Unknown upstream error.';
    let category = 'gemini_api_error';
    let message = 'The AI service returned an error.';

    if (status === 401 || status === 403) {
      category = 'invalid_api_key';
      message = 'The configured Gemini API key was rejected. It may be invalid, revoked, or missing required permissions.';
    } else if (status === 429) {
      category = 'rate_limited';
      message = 'The Gemini API quota or rate limit was exceeded. Please wait and retry.';
    } else if (status === 400) {
      category = 'gemini_bad_request';
      message = 'The request to the Gemini API was malformed.';
    } else if (status >= 500) {
      category = 'gemini_unavailable';
      message = 'The Gemini API is temporarily unavailable. Please retry.';
    }

    log('gemini_error_response', { status, category, durationMs });
    return jsonResponse(status, { error: category, message, details: apiMessage });
  }

  const candidate = (data.candidates || [])[0];
  const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

  if (!text) {
    log('gemini_empty_candidate', { durationMs });
    return jsonResponse(502, {
      error: 'empty_model_response',
      message: 'The AI service returned no usable content. Please retry.'
    });
  }

  // Sanity-check that the model's text is actually the JSON turn payload the
  // frontend expects. We still return the raw text either way — the
  // frontend does its own robust extraction — but this lets logs
  // distinguish "Gemini is fine but off-format" from real outages.
  try {
    extractJsonObject(text);
  } catch (e) {
    log('gemini_response_not_json', { durationMs });
  }

  log('request_succeeded', { durationMs });
  return jsonResponse(200, { content: [{ type: 'text', text }] });
};
