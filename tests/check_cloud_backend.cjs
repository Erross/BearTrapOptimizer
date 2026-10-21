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
 const issued=await call('/api/admin/players/'+id+'/key',{method:'POST'});assert.equal(issued.status,200);const code=issued.data.code;assert.equal(code.length,48);
 assert.notEqual(sqlite.prepare('SELECT edit_hash FROM player_profiles').get().edit_hash,code);
 const path='/api/players/'+id;
 assert.equal((await call(path,{key:ADMIN_TOKEN})).status,401);
 assert.equal((await call('/api/players/'+id2,{key:code})).status,401);
 const blank=await call(path,{key:code});assert.equal(blank.status,200);assert.equal(blank.data.input,null);assert.equal(blank.data.revision,0);
 const M=globalThis.BearPersonalModel;
 const input={stock:{9:{infantry:50000,cavalry:50000,archers:150000}},joinMarches:5,presets:3,capacity:100000,heroFreeCapacity:90000,joinCap:0,ownEnabled:false,heroes:[],leaders:{},ownTroops:{}};
 const saved=await call(path,{method:'PUT',key:code,data:{input,revision:0}});assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
 const read=await call(path,{key:code});assert.equal(read.data.input.stock[9].archers,150000);assert(!('edit_hash' in read.data));assert(!('code' in read.data));assert.equal(read.headers.get('Cache-Control'),'no-store');assert.equal(read.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal((await call(path,{method:'PUT',key:code,data:{input,revision:0}})).status,409);
 const bad=structuredClone(input);bad.stock[9].archers=-1;
 assert.equal((await call(path,{method:'PUT',key:code,data:{input:bad,revision:1}})).status,400);
 assert.equal((await call(path,{method:'PUT',key:code,data:{input:{},revision:1}})).status,400);
 assert.equal((await call(path,{method:'PUT',key:code,raw:'{broken'})).status,400);
 assert.equal((await call(path,{method:'PUT',key:code,raw:'x'.repeat(20001)})).status,413);
 assert.equal((await call('/api/admin/profiles',{key:code})).status,401);
 const all=await call('/api/admin/profiles');assert.equal(all.data.profiles.length,1);assert(!JSON.stringify(all.data).includes('edit_hash'));assert(!JSON.stringify(all.data).includes(code));
 const rotated=await call('/api/admin/players/'+id+'/key',{method:'POST'});assert.equal((await call(path,{key:code})).status,401);
 const after=await call(path,{key:rotated.data.code});assert.equal(after.data.revision,1);assert.equal(after.data.input.stock[9].archers,150000);
 assert.equal((await call('/api/admin/players/999999999999999999/key',{method:'POST'})).status,404);
 const preflight=await call(path,{method:'OPTIONS',key:''});assert.equal(preflight.status,204);
 // Bulk imports are validated atomically and preserve geometry/bonuses.
 require('../web/alliance-model.js');require('../web/cloud-client.js');
 const A=globalThis.BearAllianceModel,plan=A.mergeSnapshot(A.emptyPlan(),require('../web/data/alliance-api.json'));plan.players[0].group='1';plan.players[0].stats.archers_attack_bonus=123;
 const result=globalThis.BearCloud.applyProfiles(plan,[{governorId:id,input}]);assert.equal(result.count,1);assert.equal(result.plan.players[0].stats.troops,250000);assert.equal(result.plan.players[0].group,'1');assert.equal(result.plan.players[0].stats.archers_attack_bonus,123);assert.notEqual(plan.players[0].stats.troops,250000);
 assert.throws(()=>globalThis.BearCloud.applyProfiles(plan,[{governorId:id,input:bad}]));
 console.log('Cloudflare auth, scoped keys, SQLite saves, stale-write protection, rotation, validation, CORS and atomic model import pass.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>sqlite.close());
