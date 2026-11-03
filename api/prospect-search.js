import { readBody, send, clip } from "./_lib/llm.js";

const PLACES = "https://places.googleapis.com/v1/places:searchText";
const APOLLO = "https://api.apollo.io/api/v1/mixed_people/api_search";

function cleanDomain(value) {
  try {
    const host = new URL(value.startsWith("http") ? value : "https://" + value).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch { return ""; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const body = await readBody(req);
  const area = clip(body.area, 100).trim();
  const industry = clip(body.industry, 100).trim();
  const titles = Array.isArray(body.titles) ? body.titles.slice(0, 8).map(x => clip(x, 60)) : [];
  const limit = Math.min(20, Math.max(5, Number(body.limit) || 20));
  const companySize = ["any", "1-10", "11-50", "51-200", "201-500", "501+"].includes(body.companySize) ? body.companySize : "any";
  if (!area || !industry) return send(res, 400, { error: "Choose an area and industry." });

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!googleKey) return send(res, 503, {
    error: "Google Maps is not configured. Add GOOGLE_MAPS_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy.",
    setup: { googleMaps: false, apollo: Boolean(apolloKey) }
  });

  try {
    const placesResponse = await fetch(PLACES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.primaryTypeDisplayName,places.googleMapsUri"
      },
      body: JSON.stringify({ textQuery: industry + " businesses in " + area, pageSize: limit })
    });
    const placesData = await placesResponse.json();
    if (!placesResponse.ok) {
      console.error("Google Places search failed", placesResponse.status);
      return send(res, 502, { error: "Google Places could not complete the search. Check that Places API (New) is enabled and the key is valid." });
    }

    const businesses = (placesData.places || []).map(p => ({
      placeId: p.id || "",
      company: p.displayName?.text || "Business",
      address: p.formattedAddress || "",
      website: p.websiteUri || "",
      domain: cleanDomain(p.websiteUri || ""),
      phone: p.nationalPhoneNumber || "",
      category: p.primaryTypeDisplayName?.text || industry,
      mapsUrl: p.googleMapsUri || "",
      decisionMakers: [],
      enrichment: apolloKey ? "pending" : "not_configured"
    }));

    if (apolloKey) {
      const candidates = businesses.filter(b => b.domain).slice(0, 10);
      await Promise.all(candidates.map(async business => {
        try {
          const response = await fetch(APOLLO, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": apolloKey },
            body: JSON.stringify({
              q_organization_domains_list: [business.domain],
              person_titles: titles.length ? titles : ["Owner", "Chief Executive Officer", "Managing Director", "Director", "General Manager"],
              page: 1,
              per_page: 5
            })
          });
          const data = await response.json();
          if (!response.ok) {
            business.enrichment = "unavailable";
            return;
          }
          business.decisionMakers = (data.people || []).slice(0, 5).map(person => ({
            name: [person.first_name, person.last_name].filter(Boolean).join(" "),
            title: person.title || "",
            email: person.email || "",
            emailStatus: person.email_status || "",
            linkedinUrl: person.linkedin_url || ""
          }));
          business.enrichment = "complete";
        } catch {
          business.enrichment = "unavailable";
        }
      }));
    }

    return send(res, 200, {
      ok: true,
      count: businesses.length,
      businesses,
      setup: { googleMaps: true, apollo: Boolean(apolloKey) },
      companySizePreference: companySize,
      companySizeNote: companySize === "any" ? "No company-size preference applied." : "Company-size preference recorded for review. Google Places does not reliably return employee counts, so verify size before qualification.",
      note: apolloKey
        ? "Review all matches before adding them to HubSpot. Apollo availability and email verification depend on your Apollo plan."
        : "Businesses were found through Google Maps. Add APOLLO_API_KEY in Vercel to enrich them with decision-makers."
    });
  } catch (error) {
    console.error("Prospect search error", error);
    return send(res, 500, { error: "The prospect search could not be completed. Please try again." });
  }
}
