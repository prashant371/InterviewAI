# InterviewAI

A live, role-calibrated technical interview simulator. Pick a candidate profile, answer questions across five domains in a real-time chat, and get a structured evaluation report at the end.

**Live demo:** https://aiinterviewr.netlify.app
**AI usage log:** [PROMPTS.md](./PROMPTS.md)

---

## What it does

- **8 candidate profiles** (CS intern → Distinguished Engineer, plus non-technical roles) — each one calibrates question depth and vocabulary automatically.
- **Live adaptive interviewer** — one question at a time, follow-ups on weak answers, five domains covered in order:
  1. Embeddings & Vector Databases
  2. RAG Architecture
  3. Prompt Engineering
  4. Agentic Workflows & MCP
  5. Deployment & Production Readiness
- **Structured report** at the end — strengths, gaps, and concrete next steps.
- **Offline fallback bank** — if the live model is ever unavailable, the interview continues on a deterministic question bank with lightweight keyword-based answer evaluation, instead of the whole app breaking.
- **Honest failure handling** — a real API error shows a specific message with **Retry live AI** / **Continue offline instead**, rather than silently and permanently switching modes.

## Architecture

```
Browser (index.html)
   │  POST /api/interview  { system, messages }
   ▼
Netlify redirect (netlify.toml: /api/* → /.netlify/functions/:splat)
   ▼
netlify/functions/interview.js
   │  reads GROQ_API_KEY / GROQ_MODEL from env (server-side only)
   ▼
Groq API (OpenAI-compatible chat completions)
```

- **Frontend**: single-file `index.html` — vanilla JS, no build step, no frameworks. Canvas particle background, mission progress bar, chat UI, report view.
- **Backend**: a Netlify Function (`netlify/functions/interview.js`) proxies to Groq's chat completions API. The API key never touches the browser.
- **Health check**: `netlify/functions/health.js`, reachable at `/api/health`, reports whether the key is configured (never the key itself).
- **Offline mode**: `fallbackQuestionBank()` / `runFallbackTurn()` inside `index.html` — a deterministic, role-calibrated question set with basic keyword-based answer evaluation, used automatically if the live API fails and the user chooses to continue offline.

## Running it yourself

This is a static site + one serverless function — no build step.

1. Clone the repo.
2. Get a free API key at [console.groq.com](https://console.groq.com) (no credit card required).
3. Set environment variables (see below).
4. Deploy to Netlify (connect the GitHub repo — it auto-deploys on push), or run locally with the [Netlify CLI](https://docs.netlify.com/cli/get-started/):
   ```bash
   npm install -g netlify-cli
   netlify dev
   ```

### Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GROQ_API_KEY` | Yes | — | From console.groq.com. Server-side only, never exposed to the browser. |
| `GROQ_MODEL` | No | `openai/gpt-oss-20b` | Any Groq-hosted chat model. |

Set these in **Netlify → Site settings → Environment variables**, then trigger a fresh deploy — Netlify Functions only pick up new/changed env vars on a new deploy, not retroactively.

### Verifying a deployment

Visit `/api/health` on your deployed URL. It should return:
```json
{ "ok": true, "groqConfigured": true, "model": "openai/gpt-oss-20b" }
```
If `groqConfigured` is `false`, the env var isn't reaching the function — double check the exact name and redeploy.

## Project structure

```
index.html                     # entire frontend — UI, state machine, live API calls, offline fallback
netlify.toml                   # redirects /api/* → Netlify Functions
netlify/functions/interview.js # backend: Groq proxy, error handling, timeouts, logging
netlify/functions/health.js    # /api/health — config status without exposing secrets
package.json                   # { "type": "module" } so the functions can use ESM export syntax
PROMPTS.md                     # AI-usage log for hackathon verification
```

## Error handling

Live API failures are categorized rather than treated as one generic "unavailable" state:

| Category | Meaning |
|---|---|
| `server_configuration_error` | `GROQ_API_KEY` missing on the server |
| `invalid_api_key` | Key rejected (401/403) |
| `rate_limited` | Quota/rate limit hit (429) |
| `groq_timeout` | No response within 30s |
| `network_error` | Couldn't reach Groq at all |
| `malformed_upstream_response` / `empty_model_response` | Groq responded, but not usably |

On any of these, the interview state (chat history, mission progress) is preserved and the user can retry the same turn or deliberately switch to offline mode — nothing is silently lost or hidden.

## Tech stack

Vanilla HTML/CSS/JS frontend, Netlify Functions (Node, ESM) backend, Groq's OpenAI-compatible API for the live interviewer. No frameworks, no build tooling, no database.
