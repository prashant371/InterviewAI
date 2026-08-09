# PROMPTS.md

This is the real prompt log from building and shipping **InterviewAI**. It's not a cleaned-up story written after the fact — it's the actual back-and-forth, including the parts where things broke, because that's what vibe coding with an AI pair actually looks like.

The original interview-simulator concept, UI (cosmic dark theme, particle field, mission bar), and prompt-engineering for the interviewer persona were vibe-coded first in a separate session (Gemini/Antigravity). Everything below is the session where it went from "a single HTML file" to "a real deployed, working product" — debugging, infra, backend architecture, and hardening, entirely through prompting.

---

## 1. Kickoff — "make it better if you want"

> i have given you the web site check it and make the changes to make it better if you want, thier are more different file read them if you want help.

No spec, no ticket — just "here's what I have, go." This is the actual starting prompt. From here the AI read the full HTML/CSS/JS, found real bugs on its own initiative (a control string leaking into the visible chat, fragile JSON parsing that silently killed the live AI), and fixed them without being told what was wrong first.

## 2. Ship it

> nice working, push it on my github prashant-371

> did as you told but nothing change

One-line prompts driving a real deploy pipeline: repo creation, git push, and — after a token with the wrong permission scope — self-correcting to a working one.

## 3. "Deploy this" — three platforms, three sets of platform-specific bugs

> ok now i want to deploy this on versel

> it is not running after deplyed

> did it again got this *(pasted a live 429 quota error)*

> just deploy this on netlify

> i have deployed it but the same eroor is their

> do something

Each one-liner forced a different real diagnosis: Vercel serving `interviewai.html` instead of `index.html` at the root, Vercel's ESM/CommonJS ambiguity warning, a straight-up typo in an env var name (`GEMINI_API_KEY1`) found only by making the backend self-report its own visible env vars, and finally a hard Google Cloud free-tier quota wall that no amount of retrying fixes.

`do something` is maybe the most honest prompt in this whole log — the point where "walk me through more dashboard clicks" stopped being useful and the fix had to move into the code itself (a self-diagnosing error response) instead of another round of screenshots.

## 4. The actual engineering spec

This is the one worth reading in full — this is what separates "vibe coded" from "vibe coded well." A full technical requirements doc, written mid-project, once the surface-level fixes stopped being enough:

> I need you to completely debug and fix my InterviewAI project... IMPORTANT: Do not just explain the problem. Inspect the entire repository and directly modify the code to make the application work reliably... CRITICAL REQUIREMENTS: 1. DO NOT expose the Gemini API key in browser JavaScript... 13. Do not silently convert every API failure into offline mode... 14. Add a visible "Retry live AI" option when the live API fails... 16. Add timeout handling using AbortController... 27. Preserve the existing strict JSON interview response format... *(45 numbered requirements total — see full text in repo history / commit `2d06e47`)*

This single prompt drove: removing a duplicate/conflicting backend, categorized error handling (auth vs. rate-limit vs. timeout vs. malformed response), a `/api/health` endpoint that reports config status without ever leaking the key, `AbortController`-based timeouts, and a frontend that preserves interview state and offers **Retry live AI** instead of silently and permanently switching to offline mode on any hiccup.

## 5. Provider pivot, live

> anthropic is the paid one so we can do it with gemini api key... use it and make the error correct

> will i can use this google cloud after some time or not

> i have another API key given by BREETH which is organizing the hackathon should i use it

> first one *(choosing "get a free Groq key instead" from three options presented)*

The backend was swapped from Anthropic → Gemini → Groq over the course of this conversation, each time because real quota problems surfaced, not hypothetical ones. The Breeth key turned out to be a memory-layer API, not an LLM — caught before wasting a build cycle wiring it in wrong.

## 6. Ship, verify, done

> GROQ_API_KEY is not configured getting this error

> this time it works

> i checked it its working great

The last real bug: Netlify Functions don't pick up new env vars without a fresh deploy — a one-line fix once identified.

---

## What this log is actually evidence of

Not "typed a paragraph and got a finished app." Real iterative debugging across three deploy platforms, two LLM providers, a security review of the whole git history for leaked secrets, and a 45-point reliability spec that got fully implemented — commit by commit, driven by prompts, with the person in the loop testing on a real deployed URL after every change.

Full commit history: [`github.com/prashant371/InterviewAI/commits/main`](https://github.com/prashant371/InterviewAI/commits/main)
