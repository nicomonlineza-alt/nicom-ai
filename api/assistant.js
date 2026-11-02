import { complete, readBody, send, aiMode, clip } from "./_lib/llm.js";
import { ASSISTANT_PROFILES, DEMO_PROPERTIES, buildAssistantSystem } from "./_lib/assistants.js";

// POST /api/assistant { agent, messages }
// Shared conversation endpoint for Nicom-AI's role-based demonstration assistants.
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });

  const body = await readBody(req);
  const agent = clip(body.agent || "receptionist", 24).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(ASSISTANT_PROFILES, agent)) {
    return send(res, 400, { error: "Unknown assistant role" });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const history = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-10)
    .map((m) => ({ role: m.role, content: clip(m.content, 1200) }))
    .filter((m) => m.content.trim());

  if (!history.some((m) => m.role === "user")) {
    return send(res, 400, { error: "Please send a message" });
  }

  try {
    const reply = await complete({
      system: buildAssistantSystem(agent),
      messages: history,
      temperature: 0.4
    });
    if (reply !== null && String(reply).trim()) {
      return send(res, 200, {
        agent,
        assistant: ASSISTANT_PROFILES[agent].name,
        reply: String(reply).trim(),
        mode: "live",
        demo: agent === "property"
      });
    }
  } catch (err) {
    console.error("Nicom assistant request failed:", err?.message || "unknown error");
  }

  const last = history.filter((m) => m.role === "user").pop()?.content || "";
  return send(res, 200, {
    agent,
    assistant: ASSISTANT_PROFILES[agent].name,
    reply: demoReply(agent, last),
    mode: aiMode() === "live" ? "fallback" : "demo",
    demo: agent === "property"
  });
}

function demoReply(agent, message) {
  if (agent === "property") return propertyDemoReply(message);
  const prompts = {
    receptionist: "Thanks for getting in touch with Nicom-AI. I can help direct your enquiry. Are you looking for an AI receptionist, sales assistant, business automation or a custom web application?",
    sales: "I can help identify a useful Nicom-AI solution. What type of business do you run, and which repetitive task or customer problem would you most like to improve?",
    support: "I can help with general Nicom-AI product guidance. Tell me which service or feature you are working with and what you are trying to do."
  };
  return prompts[agent];
}

function propertyDemoReply(message) {
  const text = message.toLowerCase();
  const budgetMatch = message.replace(/,/g, "").match(/(?:r\s*)?(\d{6,8})/i);
  const budget = budgetMatch ? Number(budgetMatch[1]) : null;
  const bedroomMatch = text.match(/(\d+)\s*(?:bed|bedroom)/);
  const bedrooms = bedroomMatch ? Number(bedroomMatch[1]) : null;
  const suburbs = ["gardens", "observatory", "claremont", "sea point", "pinelands", "woodstock"];
  const suburb = suburbs.find((s) => text.includes(s));
  const matches = DEMO_PROPERTIES.filter((p) =>
    (!budget || p.price <= budget) &&
    (!bedrooms || p.bedrooms === bedrooms) &&
    (!suburb || p.suburb.toLowerCase() === suburb)
  );

  if (/view|visit|see the property|appointment/.test(text)) {
    return "Absolutely — I can demonstrate the viewing-request process. This is a sample request only and will not be sent to an estate agent. Which sample property would you like to request a viewing for, and what day would suit you?";
  }
  if (matches.length) {
    const shortlist = matches.slice(0, 3).map((p) =>
      `${p.id}: ${p.bedrooms}-bedroom ${p.type.toLowerCase()} in ${p.suburb} — R${p.price.toLocaleString("en-ZA")}. Features: ${p.features.join(", ")}.`
    ).join("\n");
    return `I found these matches in our fictional Cape Town demonstration catalogue:\n\n${shortlist}\n\nThese are sample listings, not real properties or live availability. Would you like to compare one of them or simulate a viewing request?`;
  }
  return "Welcome to Nicom Property AI. I can search our fictional Cape Town sample catalogue. What area are you interested in, what is your approximate budget in rand, and how many bedrooms would you prefer?";
}
