# PROMPTS.md

The actual prompts used to build, debug, and ship InterviewAI, in order.

---

### Initial build

> i have given you the web site check it and make the changes to make it better if you want, thier are more different file read them if you want help.

### GitHub

> nice working, push it on my github prashant-371

### Deployment — Vercel

> ok now i want to deploy this on versel

> it is not running after deplyed

> did as you told but nothing change

### Live AI backend

> anthropic is the paid one so we can do it with gemini api key [REDACTED] this is the api key use it and make the error correct

### Deployment — Netlify

> just deploy this on netlify

> i have deployed it but the same eroor is their

> do something

> [pasted the exact JSON error response from the deployed API]

### Quota troubleshooting

> will i can use this google cloud after some time or not

> i have another API key given by BREETH which is organizing the hackathon should i use it

> first one

### Full reliability rework

> I need you to completely debug and fix my InterviewAI project.
>
> This is a hackathon project, so reliability is more important than adding unnecessary features.
>
> IMPORTANT: Do not just explain the problem. Inspect the entire repository and directly modify the code to make the application work reliably.
>
> CRITICAL REQUIREMENTS
>
> 1. DO NOT expose the Gemini API key in browser JavaScript.
> 2. DO NOT store the Gemini API key in localStorage, sessionStorage, cookies, HTML, or frontend JavaScript.
> 3. The production Gemini API key must ONLY be read server-side using process.env.GEMINI_API_KEY.
> 4. The frontend should NEVER directly call Google's Gemini API.
> 5. Keep the API endpoint POST /api/interview.
> 6. Keep the existing frontend request format { system, messages }.
> 7. Keep the existing response format expected by the frontend { content: [{ type: "text", text }] }.
> 8. Make the Netlify implementation the single source of truth.
> 9. Remove or clearly disable the duplicate Vercel implementation if it creates confusion.
> 10. Add robust error handling — return useful JSON errors without exposing the actual API key.
> 11. Validate that GEMINI_API_KEY exists; return a clear configuration error if not.
> 12. Do not return environment variable names to the browser — remove the debug_visible_env_var_names field completely.
> 13. Do not silently convert every API failure into offline mode. Distinguish network failure, missing key, invalid key, quota/rate limit, model/API errors, malformed response, and JSON parsing errors.
> 14. Add a visible "Retry live AI" option when the live API fails.
> 15. If live AI fails, do not destroy the current interview state — allow retry without restarting.
> 16. Add timeout handling using AbortController (~30 seconds).
> 17. Handle Gemini responses safely — validate before assuming candidates[0].content.parts[0].text exists.
> 18. Preserve/return the correct status code for Gemini errors (400, 401, 403, 429, 500).
> 19–21. CORS only if needed; keep existing UI/design intact; keep the offline question bank.
> 22. Fix the offline fallback state machine if necessary — check that state.lastFeedback is properly initialized/managed.
> 23. Make the model configurable via GEMINI_MODEL env var with a sensible default.
> 24–28. Construct the API URL safely; convert message roles correctly (assistant → model, user → user); pass the system instruction separately; preserve the strict JSON response schema; make JSON parsing robust against fenced/stray text.
> 29. Do not put a real API key into the repository — check history for accidentally committed secrets.
> 30–31. Verify netlify.toml routing and Netlify runtime compatibility.
> 32. Check package.json — no unnecessary dependencies.
> 33. Add a /api/health endpoint that never exposes secrets.
> 34. Add clear server logs (request received, request started, response status, duration, error category) without ever logging the key or full sensitive data.
> 35–36. Fix any other obvious bugs found while inspecting the repo; review all core files.
> 37. Test: valid key, missing key, invalid key, rate limit, timeout, malformed JSON, provider unavailable, retry-after-failure.
> 38. Do not implement a frontend API-key input — production uses Netlify env vars only.
> 39–45. After fixing everything: list of files changed, exact reason for each change, exact env vars to configure, exact deployment steps, exact test procedure, remaining risks.
>
> Do not stop at identifying the issue. Make the code changes.

### Provider switch

> [screenshot of a 429 rate-limit error in DevTools]

> GROQ_API_KEY is not configured getting this error

> this time it works

### Verification

> check it for me https://aiinterviewr.netlify.app/ go a head

> i checked it its working great

### Documentation

> A PROMPTS.md in the repo, or exported chat transcripts. This is how we verify the build was genuinely vibe-coded.

> and add a read me file in interview repo
