import { readBody, send, clip } from "./_lib/llm.js";

const API = "https://api.hubapi.com";
const headersFor = token => ({ "Authorization": "Bearer " + token, "Content-Type": "application/json" });

async function upsertCompany(headers, lead) {
  const domain = clip(lead.domain, 160).toLowerCase();
  const name = clip(lead.company, 120).trim();
  if (!name) return null;
  const filter = domain
    ? { propertyName: "domain", operator: "EQ", value: domain }
    : { propertyName: "name", operator: "EQ", value: name };
  const search = await fetch(API + "/crm/v3/objects/companies/search", {
    method: "POST", headers,
    body: JSON.stringify({ filterGroups: [{ filters: [filter] }], properties: ["name", "domain"], limit: 1 })
  });
  const found = await search.json();
  if (!search.ok) throw new Error("HubSpot company lookup failed.");
  const properties = { name };
  if (domain) properties.domain = domain;
  if (lead.phone) properties.phone = clip(lead.phone, 40);
  if (lead.address) properties.address = clip(lead.address, 200);
  if (lead.category) properties.industry = clip(lead.category, 100);
  const existing = found.results?.[0];
  const response = await fetch(API + (existing ? "/crm/v3/objects/companies/" + encodeURIComponent(existing.id) : "/crm/v3/objects/companies"), {
    method: existing ? "PATCH" : "POST", headers,
    body: JSON.stringify(existing ? { properties } : { properties })
  });
  const saved = await response.json();
  if (!response.ok) throw new Error("HubSpot could not save the company.");
  return { id: saved.id, action: existing ? "updated" : "created" };
}

async function upsertContact(headers, lead) {
  const email = clip(lead.email, 120).trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  const name = clip(lead.name, 80).trim().split(/\s+/);
  const properties = { email, firstname: name[0] || "", lastname: name.slice(1).join(" "), company: clip(lead.company, 120), phone: clip(lead.phone, 40), lifecyclestage: "lead" };
  for (const key of Object.keys(properties)) if (!properties[key]) delete properties[key];
  const search = await fetch(API + "/crm/v3/objects/contacts/search", {
    method: "POST", headers,
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], properties: ["email", "firstname", "lastname", "company", "phone"], limit: 1 })
  });
  const found = await search.json();
  if (!search.ok) throw new Error("HubSpot contact lookup failed.");
  const existing = found.results?.[0];
  const response = await fetch(API + (existing ? "/crm/v3/objects/contacts/" + encodeURIComponent(existing.id) : "/crm/v3/objects/contacts"), {
    method: existing ? "PATCH" : "POST", headers,
    body: JSON.stringify({ properties })
  });
  const saved = await response.json();
  if (!response.ok) throw new Error("HubSpot could not save the contact.");
  return { id: saved.id, action: existing ? "updated" : "created" };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    return send(res, 200, { connected: Boolean(token), message: token ? "HubSpot token is configured." : "Add HUBSPOT_ACCESS_TOKEN in Vercel environment variables, then redeploy." });
  }
  if (req.method !== "POST") return send(res, 405, { error: "Use GET or POST" });
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return send(res, 503, { error: "HubSpot is not configured. Add HUBSPOT_ACCESS_TOKEN in Vercel and redeploy." });
  const body = await readBody(req);
  const lead = body.lead || {};
  if (!clip(lead.company, 120).trim() && !clip(lead.email, 120).trim()) return send(res, 400, { error: "A company name or business email is required." });
  const headers = headersFor(token);
  try {
    const company = await upsertCompany(headers, lead);
    const contact = await upsertContact(headers, lead);
    if (company && contact) {
      const association = await fetch(API + "/crm/v4/objects/contacts/" + encodeURIComponent(contact.id) + "/associations/default/companies/" + encodeURIComponent(company.id), {
        method: "PUT", headers
      });
      if (!association.ok) console.error("HubSpot contact-company association failed", association.status);
    }
    return send(res, 200, { ok: true, company, contact, message: contact ? "Company and contact synced." : "Company synced. No verified business email was supplied, so no contact was created." });
  } catch (error) {
    console.error("HubSpot sync failed", error);
    return send(res, 502, { error: error.message || "Unable to sync with HubSpot. Check company and contact read/write scopes." });
  }
}
