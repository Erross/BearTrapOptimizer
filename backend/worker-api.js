/* Bundled with the same allocation validator used by Optimize Me. No secrets in source. */
const ORIGIN='https://erross.github.io';
const SCHEMA=`CREATE TABLE IF NOT EXISTS player_profiles (
 governor_id TEXT PRIMARY KEY, edit_hash TEXT NOT NULL,
 profile_json TEXT, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT
)`;
class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new ApiError(status,message);};
async function digest(text){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function sameSecret(a,b){const x=await digest(a),y=await digest(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Send JSON data.');
 if(Number(request.headers.get('content-length'))>20000)fail(413,'Profile is too large.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Missing request body.');
 let size=0,chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20000){await reader.cancel();fail(413,'Profile is too large.');}chunks.push(value);}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(data));}catch(_){fail(400,'Invalid JSON.');}
}
function cleanProfile(input){
 const M=globalThis.BearPersonalModel;
 if(!input||typeof input!=='object'||typeof input.ownEnabled!=='boolean'||!Array.isArray(input.heroes))fail(400,'Invalid player setup.');
 for(const h of input.heroes)if(!h||typeof h.available!=='boolean')fail(400,'Invalid hero selection.');
 let stock;try{stock=M.matrix(input.stock);}catch(error){fail(400,error.message);}
 const clean={stock,joinMarches:input.joinMarches,presets:input.presets,capacity:input.capacity,
  heroFreeCapacity:input.heroFreeCapacity,joinCap:input.joinCap,ownEnabled:input.ownEnabled,ownTier:input.ownTier,
  ownCapacity:input.ownCapacity,lowerConfirmed:input.lowerConfirmed===true,
  ownTroops:Object.fromEntries(M.TYPES.map(k=>[k,input.ownTroops?.[k]??0])),
  leaders:Object.fromEntries(M.TYPES.map(k=>[k,String(input.leaders?.[k]??'')])),
  heroes:input.heroes.map(h=>({name:h.name,available:h.available,skill:h.skill}))};
 try{M.build(clean);}catch(error){fail(400,error.message);}
 return clean;
}
export default {async fetch(request,env){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(request.headers.get('Origin')===ORIGIN){headers['Access-Control-Allow-Origin']=ORIGIN;headers['Access-Control-Allow-Methods']='GET,POST,PUT,OPTIONS';headers['Access-Control-Allow-Headers']='Authorization,Content-Type';}
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 try{
  if(request.headers.has('Origin')&&request.headers.get('Origin')!==ORIGIN)fail(403,'Origin is not allowed.');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')return reply({service:'bear-player-profiles',version:1});
  if(!env.DB||typeof env.ADMIN_TOKEN!=='string'||env.ADMIN_TOKEN.length<32)fail(503,'Organizer must configure DB and an ADMIN_TOKEN of at least 32 characters.');
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,512})$/)?.[1];
  if(!token)fail(401,'Enter your access code.');
  if(path.startsWith('/api/admin/')){
   if(!await sameSecret(token,env.ADMIN_TOKEN))fail(401,'Organizer key is incorrect.');
   if(path==='/api/admin/init'&&request.method==='POST'){await env.DB.prepare(SCHEMA).run();return reply({ok:true});}
   const key=path.match(/^\/api\/admin\/players\/(\d+)\/key$/);
   if(key&&request.method==='POST'){
    const id=key[1];if(!ROSTER_IDS.includes(id))fail(404,'Player is not in the CNQ roster.');
    const code=hex(crypto.getRandomValues(new Uint8Array(24))),hash=hex(await digest(code));
    await env.DB.prepare('INSERT INTO player_profiles (governor_id,edit_hash) VALUES (?,?) ON CONFLICT(governor_id) DO UPDATE SET edit_hash=excluded.edit_hash').bind(id,hash).run();
    return reply({governorId:id,code});
   }
   if(path==='/api/admin/profiles'&&request.method==='GET'){
    const data=await env.DB.prepare('SELECT governor_id,profile_json,revision,updated_at FROM player_profiles WHERE profile_json IS NOT NULL ORDER BY governor_id').all();
    return reply({profiles:data.results.map(r=>({governorId:r.governor_id,input:JSON.parse(r.profile_json),revision:r.revision,updatedAt:r.updated_at}))});
   }
   fail(404,'Unknown organizer action.');
  }
  const match=path.match(/^\/api\/players\/(\d+)$/);
  if(!match||!['GET','PUT'].includes(request.method))fail(404,'Unknown profile action.');
  const id=match[1];if(!ROSTER_IDS.includes(id))fail(404,'Player is not in the CNQ roster.');
  const row=await env.DB.prepare('SELECT edit_hash,profile_json,revision,updated_at FROM player_profiles WHERE governor_id=?').bind(id).first();
  if(!row||!await sameSecret(hex(await digest(token)),row.edit_hash))fail(401,'Player code is incorrect for this name.');
  if(request.method==='GET')return reply({governorId:id,input:row.profile_json?JSON.parse(row.profile_json):null,revision:row.revision,updatedAt:row.updated_at});
  const data=await body(request);
  if(!Number.isSafeInteger(data.revision)||data.revision<0)fail(400,'Load the shared profile before saving.');
  const input=cleanProfile(data.input),at=new Date().toISOString();
  const changed=await env.DB.prepare('UPDATE player_profiles SET profile_json=?,revision=revision+1,updated_at=? WHERE governor_id=? AND revision=? AND edit_hash=?').bind(JSON.stringify(input),at,id,data.revision,row.edit_hash).run();
  if(changed.meta.changes!==1)fail(409,'Shared data or your code changed. Load again before saving; your local entries are preserved.');
  return reply({ok:true,revision:data.revision+1,updatedAt:at});
 }catch(error){return reply({error:error instanceof ApiError?error.message:'Backend unavailable. Check that the database is initialized and try again.'},error instanceof ApiError?error.status:503);}
}};
