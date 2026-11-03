const STORE_KEY = "nicom-ai-sales-leads-v1";
const $ = (id) => document.getElementById(id);
let leads = readLeads();
function readLeads(){try{const x=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(leads));render()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){const q=($("searchLeads")?.value||"").toLowerCase();const shown=leads.filter(x=>[x.name,x.company,x.email,(x.analysis?.services||[]).join(" ")].join(" ").toLowerCase().includes(q));$("statTotal").textContent=leads.length;$("statHot").textContent=leads.filter(x=>x.analysis?.temperature==="hot").length;$("statFollow").textContent=leads.filter(x=>x.status!=="Won"&&x.status!=="Lost"&&x.followUp).length;$("statWon").textContent=leads.filter(x=>x.status==="Won").length;$("emptyState").hidden=shown.length>0;$("leadList").innerHTML=shown.map(x=>'<article class="glass" style="padding:16px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><strong>'+esc(x.name)+'</strong><div class="muted">'+esc(x.company||"Business not supplied")+' · '+esc(x.email||"No email")+'</div></div><span class="tagline">'+esc((x.analysis?.temperature||"unscored").toUpperCase())+' · '+esc(x.analysis?.score??"—")+'</span></div><p>'+esc(x.analysis?.summary||x.message)+'</p><p class="muted">Services: '+esc((x.analysis?.services||[]).join(", ")||"To be determined")+'</p><label class="muted" for="status-'+esc(x.id)+'">Pipeline stage</label><select id="status-'+esc(x.id)+'" data-status="'+esc(x.id)+'"><option '+(x.status==="New"?"selected":"")+' value="New">New lead</option><option '+(x.status==="Contacted"?"selected":"")+' value="Contacted">Contacted</option><option '+(x.status==="Qualified"?"selected":"")+' value="Qualified">Qualified</option><option '+(x.status==="Proposal"?"selected":"")+' value="Proposal">Proposal</option><option '+(x.status==="Won"?"selected":"")+' value="Won">Won</option><option '+(x.status==="Lost"?"selected":"")+' value="Lost">Lost</option></select><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"><button class="btn ghost" data-draft="'+esc(x.id)+'" type="button">Prepare outreach</button><button class="btn ghost" data-sync="'+esc(x.id)+'" type="button">Sync HubSpot</button><button class="btn ghost" data-delete="'+esc(x.id)+'" type="button">Delete</button></div><div id="draft-'+esc(x.id)+'" style="white-space:pre-wrap;margin-top:10px"></div></article>').join("")}
$("leadForm").addEventListener("submit",async e=>{e.preventDefault();const b=$("qualifyBtn");b.disabled=true;b.textContent="Analysing…";$("formStatus").textContent="Scoring the opportunity and identifying relevant Nicom-AI services…";const payload={name:$("leadName").value.trim(),email:$("leadEmail").value.trim(),company:$("leadCompany").value.trim(),phone:$("leadPhone").value.trim(),message:$("leadMessage").value.trim()};try{const r=await fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error||"Could not qualify this lead");const x={...payload,id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),createdAt:new Date().toISOString(),analysis:data.analysis,status:"New",followUp:""};leads.unshift(x);save();$("analysisResult").hidden=false;$("analysisResult").innerHTML='<h3>'+esc(x.analysis.temperature.toUpperCase())+' prospect · '+esc(x.analysis.score)+'/100</h3><p>'+esc(x.analysis.summary)+'</p><p><strong>Recommended next step:</strong> '+esc(x.analysis.nextAction)+'</p><p><strong>Suggested reply:</strong><br>'+esc(x.analysis.draftReply)+'</p><p class="muted">Analysis mode: '+esc(data.mode||"available")+'</p>';$("formStatus").textContent="Lead qualified and saved in this browser. Sync it to HubSpot when connected.";e.target.reset()}catch(err){$("formStatus").textContent=err.message+" — check the deployment and try again."}finally{b.disabled=false;b.textContent="Analyse prospect ↗"}});
$("searchLeads").addEventListener("input",render);
$("leadList").addEventListener("change",e=>{const id=e.target.dataset.status;if(id){const x=leads.find(l=>l.id===id);if(x){x.status=e.target.value;save()}}});
$("leadList").addEventListener("click",async e=>{const btn=e.target.closest("button");if(!btn)return;const x=leads.find(l=>l.id===(btn.dataset.delete||btn.dataset.draft||btn.dataset.sync));if(!x)return;if(btn.dataset.delete){if(confirm("Delete this locally saved prospect?")){leads=leads.filter(l=>l.id!==x.id);save()}return}if(btn.dataset.draft){const node=$("draft-"+x.id);node.textContent=x.analysis?.draftReply||("Hi "+x.name+", I’m reaching out from Nicom-AI. We help businesses improve productivity with practical AI tools and automation. Would a short discovery call be useful? Reply to let us know if you'd prefer no further messages.");return}if(btn.dataset.sync){btn.disabled=true;try{const r=await fetch("/api/hubspot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:x})});const d=await r.json();if(!r.ok)throw Error(d.error||"Sync failed");btn.textContent="Synced ✓";$("crmStatus").textContent="Connected · last sync successful";alert("HubSpot contact synced successfully.")}catch(err){alert(err.message)}finally{btn.disabled=false}}});
$("exportBtn").addEventListener("click",()=>{const cols=["name","email","company","phone","message","score","temperature","services","status","createdAt"];const rows=[cols.join(","),...leads.map(x=>[x.name,x.email,x.company,x.phone,x.message,x.analysis?.score,x.analysis?.temperature,(x.analysis?.services||[]).join("; "),x.status,x.createdAt].map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(","))];const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"}));a.download="nicom-ai-sales-leads.csv";a.click();URL.revokeObjectURL(a.href)});
$("checkCrm").addEventListener("click",async()=>{const s=$("crmStatus");s.textContent="Checking…";try{const r=await fetch("/api/hubspot",{method:"GET"});const d=await r.json();s.textContent=d.connected?"Connected":"Not configured";if(!d.connected)alert(d.message||"Add HUBSPOT_ACCESS_TOKEN in Vercel environment variables, then redeploy.")}catch{s.textContent="Could not check"}});
render();

const prospectForm = $("prospectForm");
if (prospectForm) {
  prospectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("prospectBtn");
    const status = $("prospectStatus");
    const results = $("prospectResults");
    button.disabled = true;
    button.textContent = "Searching Google Maps and Apollo…";
    status.textContent = "Discovering businesses and checking for matching decision-makers…";
    results.innerHTML = "";
    const titles = Array.from($("prospectTitles").selectedOptions).map(option => option.value);
    try {
      const response = await fetch("/api/prospect-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: $("prospectArea").value.trim(),
          industry: $("prospectIndustry").value,
          titles,
          limit: Number($("prospectLimit").value),
          companySize: $("prospectSize")?.value || "any"
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      status.textContent = data.note + " Found " + data.count + " businesses.";
      results.innerHTML = data.businesses.map((business, index) => {
        const people = business.decisionMakers.length
          ? business.decisionMakers.map(person => '<div class="muted">• ' + esc(person.name || "Name unavailable") + (person.title ? " — " + esc(person.title) : "") + (person.email ? " · " + esc(person.email) : "") + (person.emailStatus ? " (" + esc(person.emailStatus) + ")" : "") + '</div>').join("")
          : '<div class="muted">' + (business.enrichment === "not_configured" ? "Apollo not configured" : "No matching decision-maker returned") + '</div>';
        return '<article class="glass" style="padding:16px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong>' + esc(business.company) + '</strong><span class="tagline">' + esc(business.enrichment.replaceAll("_", " ").toUpperCase()) + '</span></div><p class="muted">' + esc(business.category) + ' · ' + esc(business.address) + '</p>' + (business.website ? '<p><a href="' + esc(business.website) + '" target="_blank" rel="noopener">Business website ↗</a></p>' : '') + (business.phone ? '<p class="muted">' + esc(business.phone) + '</p>' : '') + '<div><strong>Decision-makers</strong>' + people + '</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">' + (business.mapsUrl ? '<a class="btn ghost" href="' + esc(business.mapsUrl) + '" target="_blank" rel="noopener">View on Maps</a>' : '') + '<button class="btn ghost" type="button" data-prospect-add="' + index + '">Add to review list</button></div></article>';
      }).join("");
      window.nicomProspectResults = data.businesses;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Find and enrich leads ↗";
    }
  });

  $("prospectResults").addEventListener("click", event => {
    const button = event.target.closest("[data-prospect-add]");
    if (!button) return;
    const business = window.nicomProspectResults?.[Number(button.dataset.prospectAdd)];
    if (!business) return;
    const person = business.decisionMakers?.[0] || {};
    const email = person.email || "";
    if (leads.some(lead => lead.company.toLowerCase() === business.company.toLowerCase())) {
      button.textContent = "Already in review list";
      return;
    }
    leads.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: person.name || business.company,
      email,
      company: business.company,
      phone: business.phone,
      message: "Found via Google Maps in " + business.address + ". Website: " + business.website + ". Decision-maker: " + (person.title || "Not identified") + ".",
      analysis: { score: 0, temperature: "unscored", summary: "Prospect discovered by Google Maps. Review and qualify before outreach.", services: [], nextAction: "Verify business fit and contact details." },
      status: "New",
      followUp: "",
      source: "Google Maps + Apollo",
      domain: business.domain,
      website: business.website,
      address: business.address,
      category: business.category,
      decisionMakers: business.decisionMakers,
      createdAt: new Date().toISOString()
    });
    save();
    button.textContent = "Added ✓";
    button.disabled = true;
  });
}
