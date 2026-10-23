// Exercise the deployed single-file Worker contract against real in-memory SQLite.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
globalThis.crypto??=require('node:crypto').webcrypto;
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'web/cloudflare-worker.js'),'utf8');
assert(source.includes(fs.readFileSync(path.join(root,'web/personal-model.js'),'utf8')),'Rebuild Worker after changing validator');
assert(source.endsWith(fs.readFileSync(path.join(root,'backend/worker-api.js'),'utf8')),'Rebuild Worker after changing backend');
const sqlite=new DatabaseSync(':memory:');let reads=0;
const DB={prepare(sql){return {bind(...args){const statement=sqlite.prepare(sql);return {async first(){reads++;return statement.get(...args)||null;},async all(){reads++;return {results:statement.all(...args)};},async run(){return {meta:{changes:Number(statement.run(...args).changes)}};}};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run().changes)}};},async all(){return {results:sqlite.prepare(sql).all()};}};}};
const ADMIN_TOKEN='organizer-test-only-12345678901234567890',env={DB,ADMIN_TOKEN},origin='https://erross.github.io';
const id=String(require('../web/data/alliance-api.json').members[0].governor_id??require('../web/data/alliance-api.json').members[0].fid);
const id2=String(require('../web/data/alliance-api.json').members[1].governor_id??require('../web/data/alliance-api.json').members[1].fid);
let worker;
async function call(route,{key=ADMIN_TOKEN,method='GET',data,from=origin,raw}={}){
 const response=await worker.fetch(new Request('https://test.workers.dev'+route,{method,headers:{...(from?{Origin:from}:{}),...(key?{Authorization:'Bearer '+key}:{}),...(data||raw?{'Content-Type':'application/json'}:{})},...(data||raw?{body:raw||JSON.stringify(data)}:{})}),env);
 return {status:response.status,headers:response.headers,data:response.status===204?null:await response.json()};
}
async function main(){
 worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
 assert.equal((await call('/api/admin/init',{method:'POST',key:''})).status,401);
 assert.equal((await call('/api/admin/init',{method:'POST',key:'wrong'})).status,401);
 assert.equal((await call('/api/admin/init',{method:'POST',from:'https://other.example'})).status,403);
 assert.equal(reads,0);
 assert.equal((await call('/api/admin/init',{method:'POST'})).status,200);
 assert.equal((await call('/api/admin/init',{method:'POST'})).status,200);
 const path='/api/players/'+id;
 const blank=await call(path,{key:''});assert.equal(blank.status,200);assert.equal(blank.data.input,null);assert.equal(blank.data.revision,0);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM player_profiles').get().n,0,'Loading a new name must not create data');
 const M=globalThis.BearPersonalModel;
 const input={stock:{9:{infantry:50000,cavalry:50000,archers:'150000'}},joinMarches:'5',presets:3,capacity:100000,heroFreeCapacity:90000,joinCap:0,ownEnabled:false,heroes:[],leaders:{},ownTroops:{},untrusted:'<script>alert(1)</script>'};
 const saved=await call(path,{method:'PUT',key:'',data:{input,revision:0}});assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
 const read=await call(path,{key:''});assert.equal(read.data.input.stock[9].archers,150000);assert.equal(read.data.input.joinMarches,5);assert(!('untrusted' in read.data.input));assert(!('edit_hash' in read.data));assert(!('code' in read.data));assert.equal(read.headers.get('Cache-Control'),'no-store');assert.equal(read.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal((await call(path,{method:'PUT',key:'',data:{input,revision:0}})).status,409);
 assert.equal((await call(path,{method:'PUT',key:'',data:{input,revision:1}})).status,429);
 sqlite.prepare("UPDATE player_profiles SET updated_at='2000-01-01T00:00:00.000Z'").run();
 assert.equal((await call(path,{method:'PUT',key:'',data:{input,revision:1}})).status,200);
 assert.equal((await call(path,{key:''})).data.revision,2);
 const bad=structuredClone(input);bad.stock[9].archers=-1;
 const invalids=[bad,{...input,joinMarches:2.5},{...input,capacity:'<img onerror=alert(1)>'},{...input,heroes:[{name:'<script>',available:false,skill:0}]},{...input,heroes:[{name:'Chenko',available:true,skill:6}]},{...input,heroes:[{name:'Chenko',available:true,skill:1},{name:'Chenko',available:true,skill:2}]},{...input,stock:{9:{archers:5000001}}},{...input,stock:{9:{infantry:3000000,cavalry:3000000}}},{...input,leaders:{infantry:'<script>'}},{}];
 for(const invalid of invalids)assert.equal((await call(path,{method:'PUT',key:'',data:{input:invalid,revision:2}})).status,400);
 assert.equal((await call(path,{method:'PUT',key:'',raw:'{broken'})).status,400);
 assert.equal((await call(path,{method:'PUT',key:'',raw:'x'.repeat(20001)})).status,413);
 assert.equal((await call('/api/admin/profiles',{key:''})).status,401);
 const all=await call('/api/admin/profiles');assert.equal(all.data.profiles.length,1);assert(!JSON.stringify(all.data).includes('edit_hash'));
 assert.equal((await call('/api/players/999999999999999999',{key:''})).status,404);
 assert.equal((await call('/api/players/999999999999999999',{key:'',method:'PUT',data:{input,revision:0}})).status,404);
 // Existing code-protected rows survive in-place migration to open profiles.
 sqlite.prepare('INSERT INTO player_profiles (governor_id,edit_hash,profile_json,revision,updated_at) VALUES (?,?,?,?,?)').run(id2,'legacy-hash',JSON.stringify(input),7,'2000-01-01T00:00:00.000Z');
 assert.equal((await call('/api/players/'+id2,{key:''})).data.revision,7);
 assert.equal((await call('/api/players/'+id2,{method:'PUT',key:'',data:{input,revision:7}})).status,200);
 assert.equal(sqlite.prepare('SELECT edit_hash FROM player_profiles WHERE governor_id=?').get(id2).edit_hash,'legacy-hash');
 assert.equal((await call('/api/admin/players/'+id+'/key',{method:'POST'})).status,404);
 sqlite.prepare("UPDATE player_profiles SET updated_at='2000-01-01T00:00:00.000Z' WHERE governor_id=?").run(id);
 const racing=await Promise.all([call(path,{method:'PUT',key:'',data:{input,revision:2}}),call(path,{method:'PUT',key:'',data:{input,revision:2}})]);
 assert.equal(racing.filter(r=>r.status===200).length,1,'Only one concurrent revision may win');
 assert.equal((await call(path,{key:''})).data.revision,3);
 const preflight=await call(path,{method:'OPTIONS',key:''});assert.equal(preflight.status,204);
 // Bulk imports are validated atomically and preserve geometry/bonuses.
 require('../web/alliance-model.js');require('../web/cloud-client.js');
 const A=globalThis.BearAllianceModel,plan=A.mergeSnapshot(A.emptyPlan(),require('../web/data/alliance-api.json'));plan.players[0].group='1';plan.players[0].stats.archers_attack_bonus=123;
 const result=globalThis.BearCloud.applyProfiles(plan,[{governorId:id,input}]);assert.equal(result.count,1);assert.equal(result.plan.players[0].stats.troops,250000);assert.equal(result.plan.players[0].group,'1');assert.equal(result.plan.players[0].stats.archers_attack_bonus,123);assert.notEqual(plan.players[0].stats.troops,250000);
 assert.throws(()=>globalThis.BearCloud.applyProfiles(plan,[{governorId:id,input:bad}]));
 // KvK inventories use their own table and event key, preserving Bear profiles.
 const K=globalThis.KvKModel,kvk=K.empty(),kvkPath='/api/kvk/players/'+id+'?event=next-kvk';
 kvk.gear.exclusive=[{id:'jabel',hero:'Jabel',level:2,widgets:14}];kvk.gear.governor[0].level=3;kvk.gear.charms[0].level=2;kvk.resources.guides.stock=40;kvk.wallets.swordland.balance=5000;
 assert.equal((await call(kvkPath,{key:''})).data.revision,0);
 const kvkSave=await call(kvkPath,{key:'',method:'PUT',data:{input:{...kvk,untrusted:'ignored'},revision:0}});assert.equal(kvkSave.status,200);
 const kvkRead=await call(kvkPath,{key:''});assert.equal(kvkRead.data.input.gear.governor[0].level,3);assert.equal(kvkRead.data.input.gear.charms[0].level,2);assert.deepEqual(kvkRead.data.input.gear.exclusive,kvk.gear.exclusive);assert.equal(kvkRead.data.input.resources.widget.stock,14);assert(!('untrusted' in kvkRead.data.input));
 assert.equal((await call(path,{key:''})).data.revision,3,'KvK save must not overwrite Bear inventory');
 assert.equal((await call(kvkPath,{key:'',method:'PUT',data:{input:kvk,revision:0}})).status,409);
 assert.equal((await call(kvkPath,{key:'',method:'PUT',data:{input:kvk,revision:1}})).status,429);
 const dated={...kvk,event:'2026-11-02'};assert.equal((await call('/api/kvk/players/'+id+'?event=2026-11-02',{key:'',method:'PUT',data:{input:dated,revision:0}})).status,200);
 assert.equal((await call(kvkPath,{key:''})).data.revision,1,'Dated events remain separate');
 assert.equal((await call('/api/admin/kvk/profiles',{key:''})).status,401);assert.equal((await call('/api/admin/kvk/profiles')).data.profiles.length,2);
 assert.equal((await call('/api/kvk/players/999999999',{key:''})).status,404);
 assert.equal((await call('/api/kvk/players/'+id+'?event=invalid',{key:''})).status,400);
 for(const badKvK of [{...kvk,targets:[-1,0,0,0,0]},{...kvk,gear:{...kvk.gear,governor:[{level:999}]}},{...kvk,offers:Array(81).fill(kvk.offers[0])}])assert.equal((await call(kvkPath,{key:'',method:'PUT',data:{input:badKvK,revision:1}})).status,400);
 sqlite.prepare("UPDATE kvk_profiles SET updated_at='2000-01-01T00:00:00.000Z' WHERE governor_id=? AND event_key='next-kvk'").run(id);
 const kvkRace=await Promise.all([call(kvkPath,{key:'',method:'PUT',data:{input:kvk,revision:1}}),call(kvkPath,{key:'',method:'PUT',data:{input:kvk,revision:1}})]);assert.equal(kvkRace.filter(r=>r.status===200).length,1);
 assert.equal((await call('/api/admin/init',{method:'POST'})).status,200);assert.equal((await call(kvkPath,{key:''})).data.revision,2);
 assert((await call('/health',{key:''})).data.capabilities.includes('kvk-profiles'));assert((await call('/health',{key:''})).data.capabilities.includes('kvk-exclusive-widgets'));
 const actualFetch=globalThis.fetch,network=[];globalThis.fetch=async(url,options)=>{network.push({url,options});return {ok:true,status:200,json:async()=>({ok:true})};};
 try{
  await globalThis.BearCloud.request('/api/players/'+id,'');assert(!('Authorization' in network.at(-1).options.headers));
  await globalThis.BearCloud.request('/api/admin/profiles',ADMIN_TOKEN);assert.equal(network.at(-1).options.headers.Authorization,'Bearer '+ADMIN_TOKEN);assert(!network.at(-1).url.includes(ADMIN_TOKEN));
 }finally{globalThis.fetch=actualFetch;}
 console.log('Open profile saves, legacy migration, organizer auth, throttling, strict sanitization, revision checks, CORS and atomic model imports pass.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>sqlite.close());
