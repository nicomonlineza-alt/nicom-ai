document.documentElement.classList.add("js");
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
$("#year").textContent = new Date().getFullYear();

async function api(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const modeLabel = (m) => (m === "live" ? "Generated live by the AI model" : "Demo mode: add OPENAI_API_KEY in Vercel for live AI");

/* AI status chip */
fetch("/api/health").then((r) => r.json()).then((d) => {
  const chip = $("#modeChip");
  chip.classList.add(d.mode);
  chip.querySelector("b").textContent = d.mode === "live" ? `AI live · ${d.model}` : "AI demo mode";
}).catch(() => { $("#modeChip b").textContent = "AI offline"; });

/* Scroll reveal */
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* Tabs */
const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((t, i) => {
  t.addEventListener("click", () => select(t));
  t.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const n = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      select(n); n.focus();
    }
  });
});
function select(tab) {
  tabs.forEach((t) => { const on = t === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; $("#" + t.getAttribute("aria-controls")).hidden = !on; });
}

/* 1. Chat agent */
const chatLog = $("#chatLog");
const history = [];
function addMsg(log, role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role === "user" ? "user" : "bot"}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}
function typing(log) {
  const el = document.createElement("div");
  el.className = "msg bot typing";
  el.innerHTML = "<span></span><span></span><span></span>";
  log.appendChild(el); log.scrollTop = log.scrollHeight;
  return el;
}
async function typeOut(el, text, log) {
  el.textContent = "";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { el.textContent = text; return; }
  for (let i = 0; i < text.length; i += 3) { el.textContent = text.slice(0, i + 3); log.scrollTop = log.scrollHeight; await new Promise((r) => setTimeout(r, 12)); }
}
addMsg(chatLog, "assistant", "Hi, I am Nova, Nicom Online's AI agent. Ask me about websites, AI agents, marketing or pricing.");

async function sendChat(text) {
  text = text.trim(); if (!text) return;
  addMsg(chatLog, "user", text);
  history.push({ role: "user", content: text });
  const t = typing(chatLog);
  const btn = $("#chatForm button"); btn.disabled = true;
  try {
    const { reply } = await api("/api/chat", { messages: history });
    t.classList.remove("typing");
    await typeOut(t, reply, chatLog);
    history.push({ role: "assistant", content: reply });
  } catch (e) {
    t.classList.remove("typing"); t.textContent = "Sorry, I could not connect just now. Please try again or WhatsApp +27 62 661 6896.";
  } finally { btn.disabled = false; }
}
$("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#chatText"); sendChat(i.value); i.value = ""; });
$("#chatChips").addEventListener("click", (e) => { if (e.target.matches("button")) sendChat(e.target.textContent); });

/* 2. Website planner */
const loading = (el) => (el.innerHTML = '<div class="skeleton" style="width:70%;height:22px"></div><div class="skeleton" style="width:90%"></div><div class="skeleton" style="width:60%"></div><div class="skeleton" style="width:80%"></div><div class="skeleton" style="width:50%"></div>');
$("#briefForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("#briefOut"), btn = e.submitter || e.target.querySelector("button");
  btn.disabled = true; loading(out);
  try {
    const { brief: b, mode } = await api("/api/brief", Object.fromEntries(new FormData(e.target)));
    out.innerHTML = `
      <p class="big">${esc(b.headline)}</p><p class="sub">${esc(b.subheadline)}</p>
      <h4>Pages</h4><ul>${(b.pages || []).map((p) => `<li><b>${esc(p.name)}</b> · ${esc(p.purpose)}</li>`).join("")}</ul>
      <h4>AI features to build in</h4><ul>${(b.aiFeatures || []).map((f) => `<li><b>${esc(f.name)}</b> · ${esc(f.benefit)}</li>`).join("")}</ul>
      <h4>SEO keywords</h4><div class="tags">${(b.seoKeywords || []).map((k) => `<span class="tag">${esc(k)}</span>`).join("")}</div>
      <h4>Primary call to action</h4><p>${esc(b.cta)}</p>
      <span class="badge">${modeLabel(mode)}</span>`;
  } catch (err) { out.innerHTML = `<p class="empty">Could not generate the plan: ${esc(err.message)}</p>`; }
  finally { btn.disabled = false; }
});

/* 3. Lead qualifier */
function renderLead(a, mode) {
  return `
    <div class="score"><div class="ring" style="--p:${Number(a.score) || 0}"><b>${esc(a.score)}</b></div>
      <div><p class="temp ${esc(a.temperature)}">${esc(a.temperature)} lead · ${esc(a.urgency)} urgency</p><p class="sub">${esc(a.summary)}</p></div></div>
    <h4>Services detected</h4><div class="tags">${(a.services || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>
    <h4>Recommended next action</h4><p>${esc(a.nextAction)}</p>
    <h4>AI-drafted reply</h4><div class="draft">${esc(a.draftReply)}</div>
    <span class="badge">${modeLabel(mode)}</span>`;
}
$("#leadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("#leadOut"), btn = e.target.querySelector("button");
  btn.disabled = true; loading(out);
  try { const { analysis, mode } = await api("/api/lead", Object.fromEntries(new FormData(e.target))); out.innerHTML = renderLead(analysis, mode); }
  catch (err) { out.innerHTML = `<p class="empty">Could not analyse the lead: ${esc(err.message)}</p>`; }
  finally { btn.disabled = false; }
});

/* Contact form uses the same AI lead route */
$("#contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = $("#contactNote"), btn = e.target.querySelector("button");
  btn.disabled = true; note.textContent = "Sending…";
  try {
    const { analysis } = await api("/api/lead", Object.fromEntries(new FormData(e.target)));
    note.textContent = `Thanks. Our AI tagged your enquiry as ${analysis.services.join(", ")} and the team will reply within one business day.`;
    e.target.reset();
  } catch (err) { note.textContent = "Something went wrong. Please email info@nikomonline.co.za."; }
  finally { btn.disabled = false; }
});

/* 4. Voice agent */
const orb = $("#voiceBtn"), vStatus = $("#voiceStatus"), vLog = $("#voiceLog");
const vHistory = [];
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function speak(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find((v) => /en-ZA/i.test(v.lang)) || voices.find((v) => /en-GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
    u.rate = 1.02;
    orb.classList.add("speaking"); vStatus.textContent = "Nova is speaking…";
    u.onend = u.onerror = () => { orb.classList.remove("speaking"); vStatus.textContent = "Tap the orb to reply."; resolve(); };
    speechSynthesis.speak(u);
  });
}
async function voiceTurn(text) {
  text = text.trim(); if (!text) return;
  addMsg(vLog, "user", text); vHistory.push({ role: "user", content: text });
  vStatus.textContent = "Thinking…";
  try {
    const { reply } = await api("/api/chat", { messages: vHistory, channel: "voice" });
    vHistory.push({ role: "assistant", content: reply });
    addMsg(vLog, "assistant", reply);
    await speak(reply);
  } catch { vStatus.textContent = "Could not reach the agent. Try again."; }
}
orb.addEventListener("click", () => {
  if (!SR) { vStatus.textContent = "Speech recognition is not supported in this browser. Type below instead."; $("#voiceText").focus(); return; }
  if (rec) { rec.stop(); return; }
  speechSynthesis?.cancel();
  rec = new SR(); rec.lang = "en-ZA"; rec.interimResults = false; rec.maxAlternatives = 1;
  orb.classList.add("listening"); vStatus.textContent = "Listening…";
  rec.onresult = (e) => voiceTurn(e.results[0][0].transcript);
  rec.onerror = (e) => { vStatus.textContent = e.error === "not-allowed" ? "Microphone blocked. Allow access or type below." : "Did not catch that. Tap to try again."; };
  rec.onend = () => { orb.classList.remove("listening"); rec = null; };
  rec.start();
});
$("#voiceForm").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#voiceText"); voiceTurn(i.value); i.value = ""; });
