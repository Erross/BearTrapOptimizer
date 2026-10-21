/* Requests carry keys in headers, never URLs or persistent browser storage. */
(function(root){
'use strict';
const API='https://bear-optimizer-api.ewanrross.workers.dev';
async function request(path,key,method='GET',data){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(API+path,{method,signal:controller.signal,cache:'no-store',credentials:'omit',headers:{...(key?{Authorization:'Bearer '+key}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
  let value;try{value=await response.json();}catch(_){throw Error('The Cloudflare Worker is not ready. Its placeholder code must be replaced.');}
  if(response.status===401&&!key)throw Error('The backend still requires player codes. The organizer must deploy the updated Worker code.');
  if(!response.ok)throw Error(value.error||'Shared saving failed.');return value;
 }catch(error){if(error.name==='AbortError')throw Error('Shared saving timed out. Your local entries are preserved.');if(error instanceof TypeError)throw Error('Cannot reach shared saving. Check the Worker deployment and connection. Your local entries are preserved.');throw error;}
 finally{clearTimeout(timer);}
}
function applyProfiles(plan,records){
 const A=root.BearAllianceModel,M=root.BearPersonalModel,next=A.validatePlan(plan);let count=0;
 for(const record of records){
  const p=next.players.find(p=>p.active&&p.governorId===record.governorId);if(!p)continue;
  const input=record.input;M.build(input);const stock=M.matrix(input.stock);
  for(const k of M.TYPES)p.stats[k]=M.TIERS.reduce((n,t)=>n+stock[t][k],0)+(input.ownEnabled&&input.ownTier==='lower'?Number(input.ownTroops[k]):0);
  p.stats.troops=M.TYPES.reduce((n,k)=>n+p.stats[k],0);p.stats.join_slots=Number(input.joinMarches);p.stats.march_capacity=Number(input.capacity);p.canHost=input.ownEnabled;count++;
 }
 return {plan:A.validatePlan(next),count};
}
root.BearCloud={request,applyProfiles};
})(typeof globalThis!=='undefined'?globalThis:this);
