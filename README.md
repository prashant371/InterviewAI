# InterviewAI

**A live, role-calibrated technical interview simulator powered by Groq + LLaMA.**

Pick a candidate profile, answer questions across five AI/ML domains in a real-time chat, and receive a structured evaluation report at the end — all in ~6 minutes, no sign-up required.

🔗 **Live Demo:** https://aiinterviewr.netlify.app  
💻 **GitHub:** https://github.com/prashant371/InterviewAI

---

## Overview

InterviewAI simulates a complete technical interview for modern AI/ML roles. A language model acts as the interviewer — asking one calibrated question at a time, following up on weak answers, and adapting its vocabulary and depth to the candidate's experience level and role. At the end, it produces a structured feedback report with strengths, gaps, and concrete next steps.

The project was built during an AI & Cloud Computing internship at Jain (Deemed-to-be University) (June 2026).

---

## Problem / Purpose

Technical interviews often feel arbitrary — candidates have no way to benchmark their readiness against role-calibrated AI/ML questions before the real thing. InterviewAI fills that gap: a realistic, adaptive simulator that covers the exact domains (RAG, embeddings, prompt engineering, agentic workflows, production deployment) increasingly asked in AI engineering roles, accessible to anyone with a browser.

---

## Key Features

- **8 role-calibrated candidate profiles** — from CS Intern to Distinguished Engineer, plus non-technical roles like Business Analyst and Marketing Manager. Each profile automatically calibrates question depth and vocabulary.
- **Live adaptive interviewing** — one question at a time, with follow-up questions on weak answers, conducted by a real LLM in real time.
- **5 structured interview domains** covered in sequence:
  1. Embeddings & Vector Databases
  2. RAG Architecture
  3. Prompt Engineering
  4. Agentic Workflows & MCP
  5. Deployment & Production Readiness
- **Mission progress bar** — visual indicator of which domain is active/complete.
- **Structured evaluation report** — summary, strengths, gaps, and concrete next steps. Exportable via copy button.
- **Offline fallback bank** — if the live LLM is unavailable, the interview continues on a deterministic, role-calibrated question bank with keyword-based answer evaluation. The app never silently breaks.
- **Honest error handling** — a real API error shows a specific message with **Retry live AI** / **Continue offline instead** buttons. No silent mode-switching.
- **API key never reaches the browser** — the Groq API key is read only on the server side inside a Netlify Function.
- **No build step, no framework, no sign-up required** — a single `index.html` with vanilla JS. Works as a pure static site + one serverless function.

---

## How It Works

```
Browser (index.html)
   │  POST /api/interview  { system, messages }
   ▼
Netlify redirect  (netlify.toml: /api/* → /.netlify/functions/:splat)
   ▼
netlify/functions/interview.js
   │  reads GROQ_API_KEY / GROQ_MODEL from env (server-side only)
   ▼
Groq API  (OpenAI-compatible /v1/chat/completions)
   ▼
Structured JSON response back to browser
```

1. User selects a candidate profile (sets role, experience, education).
2. The frontend builds a detailed system prompt — including calibration rules, domain order, exact output JSON schema — and sends it with the conversation history to `/api/interview`.
3. The Netlify Function proxies the request to Groq's chat completions API with a 30-second timeout.
4. The model returns strict JSON: `{ reply, currentMission, missionAdvance, done, feedback }`.
5. The frontend renders the reply, updates the mission bar, and — when `done: true` — renders the evaluation report.
6. If any API call fails, an error banner appears with retry and offline-continue options. No silent degradation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML + CSS + JavaScript (single `index.html`, no build step) |
| Backend | Netlify Functions (Node.js serverless, ESM) |
| AI / LLM | Groq API — OpenAI-compatible chat completions |
| Deployment | Netlify (static hosting + serverless functions) |
| Fonts | Space Grotesk · Inter · JetBrains Mono (Google Fonts) |
| Routing | Client-side view switching (no router library) |
| Canvas | HTML5 Canvas — animated particle graph background |

---

## AI Integration

### System Prompt Engineering
The system prompt is built dynamically per session and includes:
- The candidate's exact profile (name, role, years of experience, education)
- Ordered domain list with sub-topics for each
- Calibration rules: vocabulary depth per role, question pacing, follow-up logic
- Strict output schema enforcement: the model must respond with a specific JSON object on every turn

### Output Schema (enforced per turn)
```json
{
  "reply": "string — the interviewer's message",
  "currentMission": "integer 0–4 — active domain index",
  "missionAdvance": "boolean — true only when moving to a new domain",
  "done": "boolean — true when all domains are covered or candidate ends early",
  "feedback": null | {
    "summary": "string",
    "strengths": ["string", ...],
    "gaps": ["string", ...],
    "next": ["string", ...]
  }
}
```

The function includes JSON extraction with fallback (strips code fences and stray text the model occasionally adds despite instructions).

### Offline Fallback
A role-calibrated deterministic question bank (`fallbackQuestionBank`) provides questions for each domain. Per-domain keyword sets (`DOMAIN_KEYWORDS`) provide lightweight answer evaluation — checking whether answers engage with core vocabulary. The fallback report explicitly notes it is heuristic, not a substitute for the live adaptive interview.

### API Key Security
- `GROQ_API_KEY` is stored as a Netlify environment variable
- It is read only inside `netlify/functions/interview.js` via `process.env`
- The key is never returned in responses, never logged, never sent to the browser
- A `/api/health` endpoint reports whether the key is configured, never its value

---

## Architecture

```
prashant371/InterviewAI
├── index.html                    # Entire frontend — UI, state, AI calls, offline fallback
├── netlify.toml                  # Build config + /api/* redirect to Netlify Functions
├── netlify/
│   └── functions/
│       ├── interview.js          # POST /api/interview — proxies to Groq API
│       └── health.js             # GET /api/health — key-configured check
├── PROMPTS.md                    # Development log of AI prompts used to build the project
└── README.md
```

---

## Screenshots

![InterviewAI — Landing Page](https://opengraph.githubassets.com/307586994e39866e7d165321c6b45c9d7e073c9023267ccd48cccdde564e8fdc/prashant371/InterviewAI)

*Landing page with live chat preview · Candidate profile selector · Evaluation report*

---

## Live Demo

🔗 **https://aiinterviewr.netlify.app**

No sign-up required. Works in any modern browser. Takes approximately 6 minutes.

---

## Installation & Running Locally

This is a static site + one serverless function — **no build step required**.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/): `npm install -g netlify-cli`
- A [Groq API key](https://console.groq.com/) (free tier available)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/prashant371/InterviewAI.git
cd InterviewAI

# 2. Create a local environment file
cp .env.example .env.local
# Then edit .env.local and add your GROQ_API_KEY

# 3. Start the local dev server (serves static files + Netlify Functions)
netlify dev
```

The app will be available at `http://localhost:8888`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Your Groq API key — never committed to git |
| `GROQ_MODEL` | Optional | Model name (defaults to a Groq-hosted LLaMA model if unset) |

**Set in production:** Netlify Dashboard → Site Settings → Environment Variables

**Never commit API keys.** The `.env.local` file should be in `.gitignore`.

---

## Project Structure

```
index.html
│
├── <style>          CSS design system — tokens, layout, components, responsive
├── <canvas>         Animated particle graph background (HTML5 Canvas)
├── DATA             MISSIONS[], CANDIDATES[] — 8 role-calibrated profiles
├── STATE            Session state object — candidate, missionIndex, apiHistory, fallback flags
│
├── PARTICLE FIELD   Node drift animation + nearest-neighbor edge drawing
├── TYPEWRITER       Rotating domain phrases with cursor blink
├── VIEW ROUTING     goTo() — client-side view switching (landing/select/interview/report)
├── HERO PREVIEW     Static sample exchange rendered on landing page
├── CANDIDATE GRID   renderCandidateGrid() — dynamic card grid from CANDIDATES[]
│
├── INTERVIEW ENGINE (LIVE)
│   ├── buildSystemPrompt()   Constructs the role-calibrated system prompt per session
│   ├── callModel()           POST /api/interview, handles JSON extraction + error types
│   ├── beginInterview()      Sends START_INTERVIEW sentinel to open the session
│   ├── submitTurn()          Sends candidate answer, routes live vs. fallback
│   ├── applyModelTurn()      Applies model JSON: renders reply, updates mission bar
│   ├── showLiveErrorBanner() Shows retry/offline-continue options on API failure
│   └── requestEnd()          Sends END_INTERVIEW_NOW to trigger early report
│
├── OFFLINE FALLBACK BANK
│   ├── fallbackQuestionBank()    Role-calibrated deterministic questions (deep/plain/intern)
│   ├── DOMAIN_KEYWORDS{}         Per-domain keyword sets for answer evaluation
│   ├── evaluateFallbackAnswer()  Keyword hit check + brevity check
│   ├── runFallbackTurn()         Drives the fallback interview session
│   └── fallbackFeedback()        Generates the offline evaluation report
│
└── REPORT
    ├── showReport()          Renders feedback JSON into the report view
    └── copyReport()          Clipboard export of the full report as plain text
```

---

## Future Improvements

- [ ] Voice input / text-to-speech mode for a more realistic interview feel
- [ ] Session persistence — save and resume incomplete interviews
- [ ] Expanded domain coverage (System Design, DSA, Behavioral)
- [ ] Scoring metrics and historical progress tracking
- [ ] Shareable report links
- [ ] Additional candidate profiles (ML Engineer, Product Manager, Security Engineer)

---

## License

MIT
