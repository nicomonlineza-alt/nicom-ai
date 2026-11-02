const photoSet = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=800&q=80"
];
let listings = [];
let conversation = [];

const grid = document.getElementById("propertyGrid");
const count = document.getElementById("propertyCount");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendMessage");
const aiStatus = document.getElementById("aiStatus");

function money(value) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

async function loadDemo() {
  try {
    const [propertyResponse, healthResponse] = await Promise.all([
      fetch("/api/property-listings"),
      fetch("/api/health")
    ]);
    if (!propertyResponse.ok) throw new Error("Could not load sample listings");
    const data = await propertyResponse.json();
    listings = Array.isArray(data.properties) ? data.properties : [];
    renderListings(listings);
    count.textContent = `${listings.length} sample properties`;

    if (healthResponse.ok) {
      const health = await healthResponse.json();
      aiStatus.textContent = health.mode === "live" ? "Live AI connected" : "Demo mode · AI key needed";
      aiStatus.previousElementSibling?.classList.toggle("live", health.mode === "live");
    } else {
      aiStatus.textContent = "Demo assistant";
    }
  } catch (error) {
    grid.innerHTML = '<div class="property-empty">The sample catalogue could not be loaded. Please refresh and try again.</div>';
    count.textContent = "Catalogue unavailable";
    aiStatus.textContent = "Connection not verified";
  }
}

function renderListings(items) {
  if (!items.length) {
    grid.innerHTML = '<div class="property-empty">No sample properties match those filters. Try increasing the budget or choosing another area.</div>';
    return;
  }
  grid.innerHTML = items.map((p) => {
    const index = Math.max(0, listings.findIndex((x) => x.id === p.id));
    return `<article class="property-card">
      <div class="property-photo" style="background-image:linear-gradient(0deg,#07111655,#07111600),url('${photoSet[index % photoSet.length]}')"></div>
      <div class="property-card-body"><h3>${p.bedrooms}-bedroom ${p.type}</h3>
      <div class="property-location">${p.suburb}, Cape Town · ${p.id}</div>
      <div class="property-price">${money(p.price)}</div>
      <div class="property-specs">${p.bathrooms} bathroom(s) · Sample property</div>
      <div class="property-features">${p.features.join(" · ")}</div>
      <button type="button" class="btn ghost" data-viewing="${p.id}">Simulate viewing request</button></div>
    </article>`;
  }).join("");
}

document.getElementById("propertySearch").addEventListener("submit", (event) => {
  event.preventDefault();
  const area = document.getElementById("areaFilter").value.toLowerCase();
  const budget = Number(document.getElementById("budgetFilter").value || 0);
  const beds = Number(document.getElementById("bedFilter").value || 0);
  const filtered = listings.filter((p) =>
    (!area || p.suburb.toLowerCase() === area) &&
    (!budget || p.price <= budget) &&
    (!beds || p.bedrooms === beds)
  );
  renderListings(filtered);
  count.textContent = `${filtered.length} matching sample(s)`;
  const description = `Please help me explore ${area ? `properties in ${area}` : "Cape Town properties"}${budget ? ` up to ${money(budget)}` : ""}${beds ? ` with ${beds} bedroom(s)` : ""}.`;
  sendMessage(description);
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-viewing]");
  if (!button) return;
  const property = listings.find((p) => p.id === button.dataset.viewing);
  if (property) sendMessage(`I'd like to simulate a viewing request for sample property ${property.id} in ${property.suburb}, listed at ${money(property.price)}. Please show me the next step.`);
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = chatInput.value.trim();
  if (value) sendMessage(value);
});

function addMessage(role, content) {
  const bubble = document.createElement("div");
  bubble.className = `chat-message ${role}`;
  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = role === "assistant" ? "Nicom Property AI" : "You";
  const paragraph = document.createElement("p");
  paragraph.textContent = content;
  bubble.append(name, paragraph);
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

async function sendMessage(message) {
  if (sendButton.disabled) return;
  chatInput.value = "";
  addMessage("user", message);
  conversation.push({ role: "user", content: message });
  conversation = conversation.slice(-10);
  sendButton.disabled = true;
  sendButton.textContent = "…";
  const waiting = addMessage("assistant", "One moment while I check the sample catalogue…");
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "property", messages: conversation })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Assistant request failed");
    waiting.querySelector("p").textContent = result.reply || "I couldn't prepare a reply just now.";
    conversation.push({ role: "assistant", content: result.reply || "" });
    conversation = conversation.slice(-10);
    if (result.mode === "live") {
      aiStatus.textContent = "Live AI connected";
      aiStatus.previousElementSibling?.classList.add("live");
    } else {
      aiStatus.textContent = result.mode === "fallback" ? "Temporary demo response" : "Demo mode · AI key needed";
    }
  } catch (error) {
    waiting.querySelector("p").textContent = "I couldn't reach the assistant just now. Please try again in a moment.";
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send ↗";
    chatInput.focus();
  }
}

loadDemo();
