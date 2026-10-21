const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
require('../web/personal-model.js');require('../web/alliance-model.js');require('../web/alliance-summary-model.js');
const S=globalThis.BearAllianceSummary,A=globalThis.BearAllianceModel,snapshot=require('../web/data/alliance-api.json'),plan=A.mergeSnapshot(A.emptyPlan(),snapshot);
const input={stock:{9:{infantry:50000,cavalry:50000,archers:150000}},joinMarches:5,presets:3,capacity:100000,heroFreeCapacity:90000,joinCap:0,ownEnabled:false,heroes:[],leaders:{},ownTroops:{}};
const record={input,revision:1,updatedAt:'2026-10-21T12:00:00Z'},saved=S.submitted(record);
const lower=S.submitted({...record,input:{...input,ownEnabled:true,ownTier:'lower',lowerConfirmed:true,ownCapacity:100000,ownTroops:{infantry:1000,cavalry:0,archers:0},leaders:{infantry:'Howard',cavalry:'Jabel',archers:'Quinn'},heroes:['Howard','Jabel','Quinn'].map(name=>({name,available:true,skill:5}))}});
assert.equal(lower.total,251000);assert.equal(lower.types.infantry,51000);assert.equal(lower.stock[9].infantry,50000);assert.equal(lower.lower.infantry,1000);
assert.equal(saved.total,250000);assert.equal(saved.types.archers,150000);
assert.equal(S.submitted({input:null}),null);assert.throws(()=>S.submitted({...record,updatedAt:null}));
assert.throws(()=>S.submitted({...record,input:{...input,stock:{9:{archers:-1}}}}));
assert.equal(S.timestamp(1792169238.6387005),'2026-10-16T16:47:18.638Z');assert.equal(S.timestamp(null),null);
const id=plan.players[0].governorId,id2=plan.players[1].governorId,id3=plan.players[2].governorId;
const records=new Map([[id,{data:saved}],[id2,{data:S.submitted({...record,updatedAt:'2026-10-01T12:00:00Z'})}],[id3,{error:true}],[plan.players[3].governorId,{data:null}]]);
const rows=S.rows(plan,snapshot,records,Date.parse('2026-10-21T15:00:00Z')),total=S.totals(rows);
assert.equal(total.members,100);assert.equal(total.saved,2);assert.equal(total.total,500000);assert.equal(total.unavailable,1);assert.equal(total.missing,1);assert.equal(total.stale,1);
assert.equal(total.levels.reduce((n,x)=>n+x.count,0),100);
assert.equal(S.view(rows,'','missing').length,1);assert.equal(S.view(rows,'','saved').length,2);
assert.equal(S.view(rows,'','all','oldest')[0].id,id2);assert.equal(S.view(rows,'','all','newest')[0].id,id);
assert.equal(S.view(rows,'','all','troops').at(-1).data,null);
assert(S.view(rows,rows[0].name.toUpperCase()).some(p=>p.id===id));
// Execute page handlers with asynchronous shared reads. No browser storage or write calls.
async function page(failAll=false){
 const html=fs.readFileSync(path.join(root,'web/alliance-summary.html'),'utf8'),nodes={};
 for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes[m[1]]={value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
 nodes.summaryfilter.value='all';nodes.summarysort.value='name';
 let requests=0,active=0,peak=0;
 const context=vm.createContext({console,document:{getElementById(id){assert(nodes[id],id);return nodes[id];}},fetch:async()=>({ok:true,json:async()=>snapshot}),BearCloud:{request:async(route,key,method)=>{
  assert(!method,'Summary must never write profiles');assert.equal(key,'');requests++;active++;peak=Math.max(peak,active);
  await new Promise(r=>setImmediate(r));active--;
  if(failAll||route.endsWith('/'+id3))throw Error('Offline');
  return route.endsWith('/'+id)?record:{input:null,revision:0,updatedAt:null};
 }}});
 for(const file of ['alliance-model.js','personal-model.js','alliance-summary-model.js','alliance-summary.js'])vm.runInContext(fs.readFileSync(path.join(root,'web',file),'utf8'),context);
 for(let n=0;n<200;n++){await new Promise(r=>setImmediate(r));if(nodes.summaryrefresh.disabled===false&&nodes.summarystatus.textContent.includes(failAll?'could not be checked':'Checked 100'))break;}
 assert.equal(nodes.summaryrefresh.disabled,false);assert(peak<=6);
 if(failAll){assert.equal(requests,6);assert(nodes.summarystatus.textContent.includes('could not be checked'));assert(!nodes.summaryrows.innerHTML.includes('Not submitted yet'));}
 else {
  assert.equal(requests,100);assert(nodes.summaryrows.innerHTML.includes('./optimize-me.html?player='+id));
  assert(nodes.summaryrows.innerHTML.includes('datetime="2026-10-21T12:00:00.000Z"'));assert(nodes.summaryrows.innerHTML.includes('250,000'));
  assert(nodes.summaryrows.innerHTML.includes('Could not check'));assert(nodes.summaryrows.innerHTML.includes('No submission'));
  nodes.summaryfilter.value='missing';nodes.summaryfilter.handlers.change();assert(nodes.summarycount.textContent.startsWith('98 of 100'));
  nodes.summarysearch.value='name that does not exist';nodes.summarysearch.handlers.input();assert.equal(nodes.summaryempty.hidden,false);
 }
}
(async()=>{await page();await page(true);console.log('Alliance summary totals, dates, missing/error distinctions, filtering, links and bounded read-only loading pass.');})().catch(e=>{console.error(e);process.exitCode=1;});
