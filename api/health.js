import { aiMode, send } from "./_lib/llm.js";
import { ASSISTANT_PROFILES } from "./_lib/assistants.js";

// GET /api/health -> safe status check; never returns secrets.
export default function handler(req, res) {
  send(res, 200, {
    ok: true,
    mode: aiMode(),
    model: aiMode() === "live" ? process.env.OPENAI_MODEL || "gpt-4o-mini" : null,
    sharedAssistantEngine: true,
    assistants: Object.keys(ASSISTANT_PROFILES)
  });
}
