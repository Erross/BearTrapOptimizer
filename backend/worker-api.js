/* Bundled with the same allocation validator used by Optimize Me. No secrets in source. */
const ORIGIN='https://erross.github.io';
const SCHEMA=`CREATE TABLE IF NOT EXISTS player_profiles (
 governor_id TEXT PRIMARY KEY, edit_hash TEXT NOT NULL,
 profile_json TEXT, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT
)`;
const KVK_SCHEMA=`CREATE TABLE IF NOT EXISTS kvk_profiles (governor_id TEXT NOT NULL, event_key TEXT NOT NULL, profile_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY(governor_id,event_key))`;
// Triggers archive the previous baseline and every committed revision atomically.
const KVK_HISTORY_SCHEMA=`CREATE TABLE IF NOT EXISTS kvk_inventory_history (governor_id TEXT NOT NULL,event_key TEXT NOT NULL,revision INTEGER NOT NULL,profile_json TEXT NOT NULL,updated_at TEXT NOT NULL,captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),source TEXT NOT NULL,PRIMARY KEY(governor_id,event_key,revision))`;
const historyReady=new WeakMap();
async function ensureKvKHistory(db){
 if(historyReady.has(db))return historyReady.get(db);
 const ready=(async()=>{await db.prepare(KVK_HISTORY_SCHEMA).run();
 await db.prepare(`CREATE TRIGGER IF NOT EXISTS kvk_inventory_on_insert AFTER INSERT ON kvk_profiles BEGIN INSERT INTO kvk_inventory_history(governor_id,event_key,revision,profile_json,updated_at,source) SELECT NEW.governor_id,NEW.event_key,NEW.revision,NEW.profile_json,NEW.updated_at,'save' WHERE NOT EXISTS(SELECT 1 FROM kvk_inventory_history WHERE governor_id=NEW.governor_id AND event_key=NEW.event_key AND revision=NEW.revision); END`).run();
 await db.prepare(`CREATE TRIGGER IF NOT EXISTS kvk_inventory_on_update AFTER UPDATE ON kvk_profiles WHEN NEW.revision>OLD.revision BEGIN INSERT INTO kvk_inventory_history(governor_id,event_key,revision,profile_json,updated_at,source) SELECT OLD.governor_id,OLD.event_key,OLD.revision,OLD.profile_json,OLD.updated_at,'baseline' WHERE NOT EXISTS(SELECT 1 FROM kvk_inventory_history WHERE governor_id=OLD.governor_id AND event_key=OLD.event_key AND revision=OLD.revision); INSERT INTO kvk_inventory_history(governor_id,event_key,revision,profile_json,updated_at,source) SELECT NEW.governor_id,NEW.event_key,NEW.revision,NEW.profile_json,NEW.updated_at,'save' WHERE NOT EXISTS(SELECT 1 FROM kvk_inventory_history WHERE governor_id=NEW.governor_id AND event_key=NEW.event_key AND revision=NEW.revision); END`).run();})();
 historyReady.set(db,ready);try{await ready;}catch(error){historyReady.delete(db);throw error;}
}
class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new ApiError(status,message);};
async function digest(text){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function sameSecret(a,b){const x=await digest(a),y=await digest(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
async function body(request,limit=20000){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Send JSON data.');
 if(Number(request.headers.get('content-length'))>limit)fail(413,'Profile is too large.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Missing request body.');
 let size=0,chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(413,'Profile is too large.');}chunks.push(value);}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(data));}catch(_){fail(400,'Invalid JSON.');}
}
function cleanProfile(input){
 const M=globalThis.BearPersonalModel;
 try{
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.ownEnabled!=='boolean'||!Array.isArray(input.heroes)||input.heroes.length>M.HEROES.length)fail(400,'Invalid player setup.');
  const n=(v,min,max,label)=>number(v,min,max,label);
  function number(v,min,max,label){if((typeof v!=='number'&&typeof v!=='string')||v===''||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)fail(400,label+' is invalid.');return Number(v);}
  const optional=(v,max,label)=>v===''||v==null?0:n(v,0,max,label);
  const seen=new Set();
  const heroes=input.heroes.map(h=>{
   if(!h||typeof h.available!=='boolean'||!M.HEROES.some(x=>x.name===h.name)||seen.has(h.name))fail(400,'Choose each supported hero only once.');
   seen.add(h.name);return {name:h.name,available:h.available,skill:n(h.skill??0,0,5,'Hero skill')};
  });
  const leaders=Object.fromEntries(M.TYPES.map(k=>{const name=input.leaders?.[k]??'';if(typeof name!=='string'||name&&!M.HEROES.some(h=>h.name===name&&h.type===k))fail(400,'Invalid leader selection.');return [k,name];}));
  const clean={stock:M.matrix(input.stock),joinMarches:n(input.joinMarches,1,10,'Joining marches'),presets:n(input.presets,0,12,'Presets'),capacity:n(input.capacity,1,2000000,'March capacity'),
   heroFreeCapacity:optional(input.heroFreeCapacity,2000000,'Hero-free capacity'),joinCap:optional(input.joinCap,2000000,'Joining limit'),ownEnabled:input.ownEnabled,
   ownTier:input.ownTier==='lower'?'lower':n(input.ownTier??8,8,10,'Own rally tier'),ownCapacity:optional(input.ownCapacity,2000000,'Own capacity'),lowerConfirmed:input.lowerConfirmed===true,
   ownTroops:Object.fromEntries(M.TYPES.map(k=>[k,n(input.ownTroops?.[k]??0,0,2000000,'Own troops')])),leaders,heroes};
  const total=M.total(clean.stock)+(clean.ownEnabled&&clean.ownTier==='lower'?M.TYPES.reduce((n,k)=>n+clean.ownTroops[k],0):0);
  if(total>5000000)fail(400,'Total troops must not exceed 5,000,000.');
  M.build(clean);return clean;
 }catch(error){if(error instanceof ApiError)throw error;fail(400,error.message);}
}
export default {async fetch(request,env){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(request.headers.get('Origin')===ORIGIN){headers['Access-Control-Allow-Origin']=ORIGIN;headers['Access-Control-Allow-Methods']='GET,POST,PUT,OPTIONS';headers['Access-Control-Allow-Headers']='Authorization,Content-Type';}
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 try{
  if(request.headers.has('Origin')&&request.headers.get('Origin')!==ORIGIN)fail(403,'Origin is not allowed.');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')return reply({service:'bear-player-profiles',version:5,mode:'open-profiles',capabilities:['kvk-profiles','kvk-exclusive-widgets','kvk-inventory-history']});
  if(!env.DB||typeof env.ADMIN_TOKEN!=='string'||env.ADMIN_TOKEN.length<32)fail(503,'Organizer must configure DB and an ADMIN_TOKEN of at least 32 characters.');
  const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,512})$/)?.[1];
  if(path.startsWith('/api/admin/')){
   if(!token||!await sameSecret(token,env.ADMIN_TOKEN))fail(401,'Organizer key is incorrect.');
   if(path==='/api/admin/init'&&request.method==='POST'){await env.DB.prepare(SCHEMA).run();await env.DB.prepare(KVK_SCHEMA).run();await ensureKvKHistory(env.DB);return reply({ok:true});}
   if(path==='/api/admin/kvk/profiles'&&request.method==='GET'){
    const data=await env.DB.prepare('SELECT governor_id,event_key,profile_json,revision,updated_at FROM kvk_profiles ORDER BY updated_at DESC').all();
    return reply({profiles:data.results.map(r=>({governorId:r.governor_id,event:r.event_key,input:JSON.parse(r.profile_json),revision:r.revision,updatedAt:r.updated_at}))});
   }
   if(path==='/api/admin/profiles'&&request.method==='GET'){
    const data=await env.DB.prepare('SELECT governor_id,profile_json,revision,updated_at FROM player_profiles WHERE profile_json IS NOT NULL ORDER BY governor_id').all();
    return reply({profiles:data.results.map(r=>({governorId:r.governor_id,input:JSON.parse(r.profile_json),revision:r.revision,updatedAt:r.updated_at}))});
   }
   fail(404,'Unknown organizer action.');
  }
  const historyMatch=path.match(/^\/api\/kvk\/players\/(\d+)\/history$/);
  if(historyMatch&&request.method==='GET'){
   const id=historyMatch[1],url=new URL(request.url),event=url.searchParams.get('event')||'next-kvk',rawBefore=url.searchParams.get('before'),rawLimit=url.searchParams.get('limit');
   if(!/^(next-kvk|\d{4}-\d{2}-\d{2})$/.test(event))fail(400,'Invalid KvK event key.');
   if(rawBefore!==null&&!/^[1-9]\d{0,14}$/.test(rawBefore)||rawLimit!==null&&!/^\d{1,2}$/.test(rawLimit))fail(400,'Invalid history page.');
   const before=rawBefore===null?Number.MAX_SAFE_INTEGER:Number(rawBefore),limit=rawLimit===null?10:Number(rawLimit);if(!Number.isSafeInteger(before)||before<1||limit<1||limit>25)fail(400,'Invalid history page.');
   await ensureKvKHistory(env.DB);
   const known=await env.DB.prepare('SELECT governor_id FROM kvk_profiles WHERE governor_id=? UNION SELECT governor_id FROM kvk_inventory_history WHERE governor_id=? LIMIT 1').bind(id,id).first();if(!ROSTER_IDS.includes(id)&&!known)fail(404,'Player has no recorded KvK inventory.');
   await env.DB.prepare("INSERT OR IGNORE INTO kvk_inventory_history(governor_id,event_key,revision,profile_json,updated_at,source) SELECT governor_id,event_key,revision,profile_json,updated_at,'baseline' FROM kvk_profiles WHERE governor_id=? AND updated_at IS NOT NULL").bind(id).run();
   const events=await env.DB.prepare('SELECT DISTINCT event_key FROM kvk_inventory_history WHERE governor_id=? ORDER BY event_key DESC').bind(id).all();
   const rows=await env.DB.prepare('SELECT revision,profile_json,updated_at,captured_at,source FROM kvk_inventory_history WHERE governor_id=? AND event_key=? AND revision<? ORDER BY revision DESC LIMIT ?').bind(id,event,before,limit+1).all();
   const more=rows.results.length>limit,records=rows.results.slice(0,limit);return reply({governorId:id,event,events:events.results.map(r=>r.event_key),snapshots:records.map(r=>({revision:r.revision,input:JSON.parse(r.profile_json),updatedAt:r.updated_at,capturedAt:r.captured_at,source:r.source})),nextBefore:more?records.at(-1).revision:null});
  }
  const kvkMatch=path.match(/^\/api\/kvk\/players\/(\d+)$/);
  if(kvkMatch&&['GET','PUT'].includes(request.method)){
   const id=kvkMatch[1];if(!ROSTER_IDS.includes(id))fail(404,'Player is not in the CNQ roster.');
   const event=new URL(request.url).searchParams.get('event')||'next-kvk';if(!/^(next-kvk|\d{4}-\d{2}-\d{2})$/.test(event))fail(400,'Invalid KvK event key.');
   const row=await env.DB.prepare('SELECT profile_json,revision,updated_at FROM kvk_profiles WHERE governor_id=? AND event_key=?').bind(id,event).first();
   if(request.method==='GET')return reply({governorId:id,event,input:row?JSON.parse(row.profile_json):null,revision:row?.revision??0,updatedAt:row?.updated_at??null});
   const data=await body(request,150000);if(!data||!Number.isSafeInteger(data.revision)||data.revision<0)fail(400,'Load the online KvK inventory before saving.');
   let input;try{input=globalThis.KvKModel.clean(data.input);}catch(error){fail(400,error.message);}
   if(input.event!==event)fail(400,'The inventory event must match the selected event.');
   const at=new Date().toISOString(),before=new Date(Date.now()-10000).toISOString();
   if(data.revision!==(row?.revision??0))fail(409,'Shared KvK data changed. Load again before saving; your local entries are preserved.');
   if(row?.updated_at&&row.updated_at>before)fail(429,'Please wait 10 seconds between KvK saves for the same player and event.');
   await ensureKvKHistory(env.DB);
   const changed=await env.DB.prepare('INSERT INTO kvk_profiles (governor_id,event_key,profile_json,revision,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(governor_id,event_key) DO UPDATE SET profile_json=excluded.profile_json,revision=kvk_profiles.revision+1,updated_at=excluded.updated_at WHERE kvk_profiles.revision=? AND (kvk_profiles.updated_at IS NULL OR kvk_profiles.updated_at<=?)').bind(id,event,JSON.stringify(input),data.revision+1,at,data.revision,before).run();
   if(changed.meta.changes!==1)fail(409,'Shared KvK data changed. Load again before saving; your local entries are preserved.');return reply({ok:true,revision:data.revision+1,updatedAt:at,historyRecorded:true});
  }
  const match=path.match(/^\/api\/players\/(\d+)$/);
  if(!match||!['GET','PUT'].includes(request.method))fail(404,'Unknown profile action.');
  const id=match[1];if(!ROSTER_IDS.includes(id))fail(404,'Player is not in the CNQ roster.');
  const row=await env.DB.prepare('SELECT profile_json,revision,updated_at FROM player_profiles WHERE governor_id=?').bind(id).first();
  if(request.method==='GET')return reply({governorId:id,input:row?.profile_json?JSON.parse(row.profile_json):null,revision:row?.revision??0,updatedAt:row?.updated_at??null,mode:'open-profiles'});
  const data=await body(request);
  if(!data||!Number.isSafeInteger(data.revision)||data.revision<0)fail(400,'Load the shared profile before saving.');
  const input=cleanProfile(data.input),at=new Date().toISOString(),before=new Date(Date.now()-10000).toISOString();
  if(data.revision!==(row?.revision??0))fail(409,'Shared data changed. Load again before saving; your local entries are preserved.');
  if(row?.updated_at&&row.updated_at>before)fail(429,'Please wait 10 seconds between saves for the same player.');
  const changed=await env.DB.prepare("INSERT INTO player_profiles (governor_id,edit_hash,profile_json,revision,updated_at) VALUES (?,'public',?,?,?) ON CONFLICT(governor_id) DO UPDATE SET profile_json=excluded.profile_json,revision=player_profiles.revision+1,updated_at=excluded.updated_at WHERE player_profiles.revision=? AND (player_profiles.updated_at IS NULL OR player_profiles.updated_at<=?)").bind(id,JSON.stringify(input),data.revision+1,at,data.revision,before).run();
  if(changed.meta.changes!==1)fail(409,'Shared data changed. Load again before saving; your local entries are preserved.');
  return reply({ok:true,revision:data.revision+1,updatedAt:at});
 }catch(error){return reply({error:error instanceof ApiError?error.message:'Backend unavailable. Check that the database is initialized and try again.'},error instanceof ApiError?error.status:503);}
}};
