import { aiMode, send } from "./_lib/llm.js";

// GET /api/health -> tells the UI whether a live model is configured.
export default function handler(req, res) {
  send(res, 200, { ok: true, mode: aiMode(), model: aiMode() === "live" ? process.env.OPENAI_MODEL || "gpt-4o-mini" : null });
}
