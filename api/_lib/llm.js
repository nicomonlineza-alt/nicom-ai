// Shared AI layer for every Nicom API route.
// If OPENAI_API_KEY is set (in Vercel > Project > Settings > Environment Variables),
// requests go to any OpenAI-compatible Chat Completions endpoint.
// Without a key, routes fall back to a deterministic "demo mode" so the site never breaks.

export const BUSINESS_CONTEXT = `
You are Nova, the AI agent for Nicom Online, a digital agency in Cape Town, South Africa.
Tagline: "Where Your Digital Journey Begins".
Services: web design & eCommerce (sell 24/7 globally), social media marketing & management,
Google Ads, SEO, content creation, AI sales agents, AI support agents, AI voice agents,
AI workflow integration & automation, SMS and email marketing with autoresponders.
Contact: phone +27 62 661 6896, email info@nikomonline.co.za, website www.nicomonline.co.za,
address 10 Union Street, Gardens, Cape Town. Hours: Mon-Fri 08:00-18:00.
Rules: be warm, concise (under 120 words unless asked), practical, and South-Africa aware (ZAR, local SMEs).
Never invent fixed prices; say pricing depends on scope and offer a free consultation.
Always end sales conversations with a clear next step (book a call, WhatsApp, or the contact form).
`.trim();

export function aiMode() {
  return process.env.OPENAI_API_KEY ? "live" : "demo";
}

export async function complete({ system, messages, json = false, temperature = 0.6 }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null; // caller handles demo fallback

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature,
      messages: [{ role: "system", content: system }, ...messages],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { return {}; }
}

export function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export const clip = (s, n = 2000) => String(s ?? "").slice(0, n);
