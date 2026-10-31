import { BUSINESS_CONTEXT, complete, readBody, send, aiMode, clip } from "./_lib/llm.js";

// POST /api/chat  { messages: [{role, content}], channel?: "text" | "voice" }
// Powers the AI sales & support agent and the voice agent demo.
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const { messages = [], channel = "text" } = await readBody(req);
  const history = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-12)
    .map((m) => ({ role: m.role, content: clip(m.content, 1500) }));

  if (!history.length) return send(res, 400, { error: "No message supplied" });

  const system =
    BUSINESS_CONTEXT +
    (channel === "voice"
      ? "\nYou are speaking out loud on a call. Reply in 1-3 short, natural spoken sentences. No lists, no markdown."
      : "\nYou may use short bullet lists when helpful. Plain text only, no markdown headings.");

  try {
    const reply = await complete({ system, messages: history });
    if (reply !== null) return send(res, 200, { reply, mode: "live" });
  } catch (err) {
    console.error(err);
  }
  const last = history.filter((m) => m.role === "user").pop()?.content || "";
  return send(res, 200, { reply: demoReply(last, channel), mode: aiMode() === "live" ? "fallback" : "demo" });
}

const KB = [
  { k: ["price", "cost", "how much", "quote", "budget", "rand", "zar"],
    a: "Pricing depends on scope, so we quote per project after a free 20-minute consultation. A simple business site, an eCommerce store and an AI agent build are all priced differently. Want me to book that call? You can also WhatsApp us on +27 62 661 6896." },
  { k: ["ecommerce", "e-commerce", "shop", "store", "sell online"],
    a: "We build eCommerce stores that sell 24/7, locally and globally: product catalogue, secure payments (PayFast, Yoco, Stripe), stock alerts and abandoned-cart emails. We can also add an AI shopping assistant that answers product questions. Shall I note your product count so we can scope it?" },
  { k: ["voice", "call", "phone agent", "receptionist"],
    a: "Our AI voice agents answer calls, qualify leads, book appointments and log everything to your CRM, after hours too. They sound natural and hand over to a human when needed. Try the Voice Agent tab here to hear one." },
  { k: ["support", "helpdesk", "customer service", "faq"],
    a: "An AI support agent learns your FAQs, policies and product info, then answers customers instantly on your website, WhatsApp or email. Tricky cases are escalated to your team with a summary. Most clients see big drops in repetitive tickets." },
  { k: ["automation", "workflow", "integrate", "integration", "zapier", "make"],
    a: "AI workflow integration connects your tools: website forms to CRM, AI-written follow-up emails, invoice reminders, lead scoring and reporting. We map your current process first, then automate the repetitive steps." },
  { k: ["seo", "google", "rank", "ads", "adwords"],
    a: "We run SEO (technical fixes, local SEO, content) and Google Ads campaigns with clear monthly reporting. We use AI to research keywords and draft content, and humans to check quality. What area and industry are you in?" },
  { k: ["social", "instagram", "facebook", "tiktok", "linkedin", "content"],
    a: "We plan, create and manage social content across Facebook, Instagram, LinkedIn and TikTok. AI helps us produce drafts and captions quickly; our team keeps it on-brand. Would you like a sample content calendar?" },
  { k: ["sms", "email", "newsletter", "autoresponder"],
    a: "We set up SMS and email marketing with autoresponders: welcome sequences, promotions and reminders that run automatically. AI can personalise each message by customer segment." },
  { k: ["website", "web design", "site", "redesign"],
    a: "We design fast, mobile-first websites that convert. Every build can include AI features like a chat agent, smart lead forms and auto-generated content. What does your business do? I can suggest a page structure." },
  { k: ["contact", "address", "where", "hours", "email", "phone", "whatsapp"],
    a: "You can reach Nicom Online on +27 62 661 6896 or info@nikomonline.co.za. We are at 10 Union Street, Gardens, Cape Town, Mon-Fri 08:00-18:00." },
  { k: ["hello", "hi", "hey", "good morning", "good afternoon"],
    a: "Hi, I am Nova, Nicom Online's AI agent. I can explain our services, suggest how AI could help your business, or book a free consultation. What are you working on?" },
];

function demoReply(text, channel) {
  const t = text.toLowerCase();
  const hit = KB.find((e) => e.k.some((k) => t.includes(k)));
  let a = hit
    ? hit.a
    : "Good question. Nicom Online builds websites, runs digital marketing and adds AI agents and automation to small businesses. Tell me a bit about your business and goal, and I will suggest where AI could save you time or win more customers.";
  if (channel === "voice") a = a.split(/(?<=[.?!])\s/).slice(0, 2).join(" ");
  return a;
}
