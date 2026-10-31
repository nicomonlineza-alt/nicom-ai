# Nicom Online · AI Web App

A working showcase of how **Nicom Online** (Cape Town) builds AI into client web apps.
Dark, neon-green, glassmorphism UI with four live AI features, each backed by a Vercel serverless function.

| Feature | Route | What the AI does |
| --- | --- | --- |
| Sales & support agent "Nova" | `POST /api/chat` | Answers questions using Nicom's business context, keeps 12-turn memory |
| Website planner | `POST /api/brief` | Returns a structured JSON site plan: headline, pages, AI features, SEO keywords |
| Lead qualifier | `POST /api/lead` | Scores enquiries 0–100, tags services, sets urgency, drafts a reply |
| Voice agent | `POST /api/chat` (voice mode) | Browser speech recognition → AI → speech synthesis |
| Status | `GET /api/health` | Reports whether a live model is configured |

## How AI is integrated

```
Browser UI  →  /api/* serverless route  →  LLM (+ Nicom business context)  →  actions (CRM, email, WhatsApp)
```

- API keys live only on the server (Vercel env vars), never in the browser.
- `api/_lib/llm.js` is a single shared AI layer that talks to any OpenAI-compatible endpoint.
- If no key is set, or the model fails, every route falls back to a built-in demo response, so the site never breaks.

## Turn on live AI

In Vercel → Project → Settings → Environment Variables add:

- `OPENAI_API_KEY` (required for live mode)
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `OPENAI_BASE_URL` (optional, for OpenRouter, Groq, Vercel AI Gateway, etc.)

Redeploy, and the header chip switches from "AI demo mode" to "AI live".

## Run locally

```bash
npm run dev          # http://localhost:3000
OPENAI_API_KEY=sk-... npm run dev   # with live AI
```

## Contact

Nicom Online · +27 62 661 6896 · info@nikomonline.co.za · 10 Union Street, Gardens, Cape Town
