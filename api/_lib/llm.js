// Shared AI layer for every Nicom-AI API route.
// Configure OPENAI_API_KEY in Vercel > Project > Settings > Environment Variables.
// Without a key, supported routes use clearly labelled deterministic demo fallbacks.

export const BUSINESS_CONTEXT = `
You are an AI assistant representing Nicom-AI, a Cape Town-based digital and AI solutions business in South Africa.
Positioning: "Your business. Your AI team. Your next level."
Nicom-AI helps businesses capture enquiries, respond faster and reduce repetitive admin with practical AI employees,
AI sales and support assistants, workflow automation and intelligent web applications.
Supporting services may include website development, e-commerce, hosting, domains and digital marketing.
Public contact details: +27 62 661 6896 (phone/WhatsApp), nicomonlineza@gmail.com,
Union Street, Gardens, Cape Town, South Africa.
Rules: be warm, concise, practical and South-Africa aware (ZAR and local business context).
Never invent fixed prices, guarantees, integrations, customer results or completed actions.
Explain that pricing depends on scope and offer a free AI assessment when appropriate.
Important decisions remain under human control.
`.trim();

export function aiMode() {
  return process.env.OPENAI_API_KEY ? "live" : "demo";
}

export async function complete({ system, messages, json = false, temperature = 0.6 }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature,
      messages: [{ role: "system", content: system }, ...messages],
      ...(json ? { response_format: { type: "json_object" } } : {})
    })
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
