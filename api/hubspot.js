import { readBody, send, clip } from "./_lib/llm.js";

const API = "https://api.hubapi.com";
export default async function handler(req,res){
  if(req.method==="GET"){
    const token=process.env.HUBSPOT_ACCESS_TOKEN;
    return send(res,200,{connected:Boolean(token),message:token?"HubSpot token is configured.":"HubSpot is not connected yet. Add HUBSPOT_ACCESS_TOKEN in Vercel → Project Settings → Environment Variables, then redeploy."});
  }
  if(req.method!=="POST")return send(res,405,{error:"Use GET or POST"});
  const token=process.env.HUBSPOT_ACCESS_TOKEN;
  if(!token)return send(res,503,{error:"HubSpot is not configured yet. Add HUBSPOT_ACCESS_TOKEN in Vercel environment variables and redeploy. Do not paste the token into chat or website code."});
  const body=await readBody(req);const l=body.lead||{};
  const email=clip(l.email,120).trim().toLowerCase();
  if(!email||!email.includes("@"))return send(res,400,{error:"A valid business email is required to safely match or create a HubSpot contact."});
  const props={email,firstname:clip(l.name,80).split(" ")[0],lastname:clip(l.name,80).split(" ").slice(1).join(" "),company:clip(l.company,120),phone:clip(l.phone,40),lifecyclestage:"lead"};
  for(const k of Object.keys(props))if(!props[k])delete props[k];
  try{
    const headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"};
    const search=await fetch(API+"/crm/v3/objects/contacts/search",{method:"POST",headers,body:JSON.stringify({filterGroups:[{filters:[{propertyName:"email",operator:"EQ",value:email}]}],properties:["email","firstname","lastname","company","phone"],limit:1})});
    const searchData=await search.json();
    if(!search.ok)return send(res,502,{error:"HubSpot contact lookup failed. Check the token and its CRM contacts read/write scopes."});
    const existing=searchData.results?.[0];let response;
    if(existing){response=await fetch(API+"/crm/v3/objects/contacts/"+encodeURIComponent(existing.id),{method:"PATCH",headers,body:JSON.stringify({properties:props})})}
    else{response=await fetch(API+"/crm/v3/objects/contacts",{method:"POST",headers,body:JSON.stringify({properties:props})})}
    const result=await response.json();
    if(!response.ok){console.error("HubSpot sync error",response.status);return send(res,502,{error:"HubSpot could not save this contact. Verify the CRM contacts read/write scopes in your HubSpot app."})}
    return send(res,200,{ok:true,action:existing?"updated":"created",contactId:result.id});
  }catch(err){console.error("HubSpot request failed",err);return send(res,502,{error:"Unable to reach HubSpot right now. Please try again."})}
}