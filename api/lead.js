import { BUSINESS_CONTEXT, complete, readBody, send, aiMode, clip } from "./_lib/llm.js";

// POST /api/lead  { name, email, company, message }
// AI reads the enquiry, scores it, tags the services and drafts a reply.
// In production this is where you would push to a CRM, email or WhatsApp.
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const b = await readBody(req);
  const lead = {
    name: clip(b.name, 80),
    email: clip(b.email, 120),
    company: clip(b.company, 120),
    message: clip(b.message, 1500),
  };
  if (!lead.message) return send(res, 400, { error: "Please include a message" });

  const system = `${BUSINESS_CONTEXT}
You are Nicom's lead qualification agent. Analyse the enquiry and return ONLY JSON:
{"score": integer 0-100, "temperature": "hot"|"warm"|"cold", "services": [string],
 "summary": string (one sentence), "urgency": "high"|"medium"|"low",
 "nextAction": string, "draftReply": string (friendly email reply, under 90 words, signed "The Nicom Online team")}`;

  try {
    const raw = await complete({
      system,
      json: true,
      temperature: 0.3,
      messages: [{ role: "user", content: JSON.stringify(lead) }],
    });
    if (raw !== null) return send(res, 200, { analysis: JSON.parse(raw), mode: "live" });
  } catch (err) {
    console.error(err);
  }
  return send(res, 200, { analysis: demoLead(lead), mode: aiMode() === "live" ? "fallback" : "demo" });
}

const SERVICE_MAP = {
  "Web design": ["website", "site", "redesign", "landing"],
  eCommerce: ["shop", "store", "ecommerce", "e-commerce", "sell", "products"],
  SEO: ["seo", "google", "rank", "search"],
  "Google Ads": ["ads", "adwords", "ppc", "campaign"],
  "Social media": ["social", "instagram", "facebook", "tiktok", "linkedin"],
  "AI agents": ["ai", "chatbot", "agent", "voice", "bot", "assistant"],
  Automation: ["automate", "automation", "workflow", "crm", "integrate"],
  "SMS & email": ["sms", "email", "newsletter", "autoresponder"],
};

function demoLead({ name, company, message }) {
  const t = message.toLowerCase();
  const services = Object.entries(SERVICE_MAP)
    .filter(([, keys]) => keys.some((k) => t.includes(k)))
    .map(([s]) => s);
  let score = 30 + services.length * 10;
  const urgentWords = ["asap", "urgent", "this week", "next week", "deadline", "launch", "soon"];
  const urgent = urgentWords.some((w) => t.includes(w));
  if (urgent) score += 20;
  if (/budget|r\s?\d|\d+k|rand/.test(t)) score += 15;
  if (company) score += 5;
  if (message.length > 140) score += 5;
  score = Math.min(97, score);
  const temperature = score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";
  const first = (name || "there").split(" ")[0];
  const svc = services.length ? services : ["Web design"];
  return {
    score,
    temperature,
    services: svc,
    summary: `${company || name || "Prospect"} is asking about ${svc.join(", ")}${urgent ? " with a near-term deadline" : ""}.`,
    urgency: urgent ? "high" : services.length > 1 ? "medium" : "low",
    nextAction: temperature === "hot" ? "Call within 1 hour and send a proposal outline" : temperature === "warm" ? "Send a booking link for a discovery call today" : "Add to nurture email sequence",
    draftReply: `Hi ${first}, thanks for reaching out to Nicom Online. We would love to help with ${svc.join(" and ")}. Could we set up a free 20-minute call this week to understand your goals? You can also WhatsApp us on +27 62 661 6896. The Nicom Online team`,
  };
}
