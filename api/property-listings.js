import { DEMO_PROPERTIES } from "./_lib/assistants.js";
import { send } from "./_lib/llm.js";

// GET /api/property-listings -> fictional sample catalogue for the public demo.
export default function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Use GET" });
  send(res, 200, { demo: true, currency: "ZAR", properties: DEMO_PROPERTIES });
}
