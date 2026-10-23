/* Joint inventory/shop/day integer allocation. Runs identically in Node and a browser Worker. */
(function(root){'use strict';
const C=root.KvKCatalog,clone=x=>JSON.parse(JSON.stringify(x)),MAX=1e9;
function number(v,min=0,max=MAX,label='Value'){if(v===''||v===null||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(label+' must be between '+min+' and '+max+'.');return Number(v);}
function whole(v,min=0,max=MAX,label='Count'){const n=number(v,min,max,label);if(!Number.isSafeInteger(n))throw Error(label+' must be a whole number.');return n;}
function text(v,label='Name'){if(typeof v!=='string'||!v.trim()||v.length>100)throw Error(label+' needs 1–100 characters.');return v.trim();}
const days=(v,label)=>{if(!Array.isArray(v)||v.length!==5)throw Error(label+' needs five days.');return v.map(x=>whole(x,0,1e12,label));};
function empty(){return {version:1,event:'next-kvk',confirmed:false,targets:Array(5).fill(200000),actual:Array(5).fill(0),baseline:Array(5).fill(0),closed:Array(5).fill(false),
 resources:Object.fromEntries(C.resources.map(r=>[r.id,{stock:0,reserve:0,enabled:false,batch:1,cap:null}])),
 wallets:Object.fromEntries(C.wallets.map(w=>[w.id,{balance:0,reserve:0,income:Array(5).fill(0)}])),
 workloads:Object.fromEntries(['construction','research','training','master'].map(k=>[k,Array(5).fill(0)])),
 gear:root.KvKGear.empty(),offers:clone(C.offers),upgrades:[],rules:Object.fromEntries(C.resources.filter(r=>r.points).map(r=>[r.id,clone(r.points)]))};}
function clean(input){
 if(!input||input.version!==1)throw Error('Choose a supported KvK inventory file.');
 const out=empty();out.event=text(input.event,'Event');if(!/^(next-kvk|\d{4}-\d{2}-\d{2})$/.test(out.event))throw Error('Choose the prep start date or next-kvk.');
 out.confirmed=input.confirmed===true;out.gear=root.KvKGear.clean(input.gear);for(const k of ['targets','actual','baseline'])out[k]=days(input[k],k);
 if(!Array.isArray(input.closed)||input.closed.length!==5||input.closed.some(v=>typeof v!=='boolean'))throw Error('Choose whether each day is finished.');out.closed=clone(input.closed);
 for(const r of C.resources){const v=input.resources?.[r.id];if(!v)throw Error('Missing '+r.name+' inventory.');const x={stock:whole(v.stock,0,MAX,r.name),reserve:whole(v.reserve,0,MAX,r.name+' reserve'),enabled:v.enabled===true,batch:whole(v.batch,1,1e6,r.name+' batch size'),cap:v.cap==null?null:whole(v.cap,0,MAX,r.name+' usable limit')};if(x.reserve>x.stock)throw Error(r.name+' reserve exceeds owned stock.');out.resources[r.id]=x;if(r.points)out.rules[r.id]=days(input.rules?.[r.id]||r.points,r.name+' points');}
 for(const w of C.wallets){const v=input.wallets?.[w.id];if(!v)throw Error('Missing '+w.name+' balance.');const x={balance:whole(v.balance,0,MAX,w.name),reserve:whole(v.reserve,0,MAX,w.name+' reserve'),income:days(v.income,w.name+' expected income')};if(x.reserve>x.balance)throw Error(w.name+' reserve exceeds the balance.');x.income=x.income.map((n,i)=>out.closed[i]?0:n);out.wallets[w.id]=x;}
 for(const k of Object.keys(out.workloads))out.workloads[k]=days(input.workloads?.[k],k+' usable timer minutes');
 const ids=new Set();if(!Array.isArray(input.offers)||input.offers.length>80)throw Error('Use at most 80 shop offers.');
 out.offers=input.offers.map((v,i)=>{const id='offer_'+i;if(!C.wallets.some(w=>w.id===v.wallet)||!C.resources.some(r=>r.id===v.resource))throw Error('Choose a supported shop currency and material.');const x={id,name:text(v.name),wallet:v.wallet,resource:v.resource,cost:whole(v.cost,1,MAX,'Offer cost'),quantity:whole(v.quantity,1,1e6,'Pack quantity'),remaining:whole(v.remaining,0,100000,'Remaining purchases'),from:whole(v.from,1,5,'Offer first day'),to:whole(v.to,1,5,'Offer last day'),enabled:v.enabled===true};if(x.from>x.to)throw Error('An offer must be available before it expires.');return x;});
 if(!Array.isArray(input.upgrades)||input.upgrades.length>40)throw Error('Use at most 40 planned upgrades.');
 out.upgrades=input.upgrades.map(v=>{const id=text(v.id,'Upgrade ID');if(!/^[a-zA-Z0-9_-]+$/.test(id)||ids.has(id))throw Error('Upgrade IDs must be unique letters, numbers or underscores.');ids.add(id);const consumes={};if(!v.consumes||typeof v.consumes!=='object')throw Error('Enter the materials for each upgrade.');for(const [k,n]of Object.entries(v.consumes)){if(!C.resources.some(r=>r.id===k))throw Error('Unknown upgrade material.');if(Number(n)>0)consumes[k]=whole(n,1,MAX,'Upgrade material amount');}if(!Object.keys(consumes).length)throw Error('An upgrade must consume at least one material or timer.');const points=days(v.points,'Upgrade points');if(!points.some(x=>x>0))throw Error('An upgrade needs points on at least one day.');return {id,name:text(v.name),consumes,points,limit:whole(v.limit,1,100000,'Repeat limit'),dependsOn:v.dependsOn?text(v.dependsOn,'Previous upgrade ID'):null};});
 const byId=new Map(out.upgrades.map(u=>[u.id,u]));for(const u of out.upgrades){const seen=new Set([u.id]);let p=u.dependsOn;while(p){if(!byId.has(p)||seen.has(p))throw Error('Upgrade prerequisites must exist and cannot form a loop.');seen.add(p);p=byId.get(p).dependsOn;}}
 return out;
}
function compile(input,soft=false){
 const p=clean(input);p.upgrades=[...p.upgrades,...root.KvKGear.actions(p)];const m={optimize:'score',opType:'max',constraints:{},variables:{},ints:{}},meta={};
 const constraint=(id,bound)=>m.constraints[id]=bound;
 const variable=(id,data,info)=>{m.variables[id]={score:0,cost:0,deficit:0,...data};m.ints[id]=1;meta[id]=info;return m.variables[id];};
 function prefix(v,key,day,n){for(let d=day;d<5;d++)v[key+'_'+d]=(v[key+'_'+d]||0)+n;}
 for(const r of C.resources){const v=p.resources[r.id];for(let d=0;d<5;d++)constraint('resource_'+r.id+'_'+d,{max:v.stock-v.reserve});if(v.cap!=null)constraint('use_'+r.id,{max:v.cap});}
 for(const w of C.wallets){let budget=p.wallets[w.id].balance-p.wallets[w.id].reserve;for(let d=0;d<5;d++){budget+=p.wallets[w.id].income[d];constraint('wallet_'+w.id+'_'+d,{max:budget});}}
 for(let d=0;d<5;d++){
  if(p.closed[d])continue;
  constraint('target_'+d,{min:Math.max(0,p.targets[d]-p.actual[d]-p.baseline[d])/1000});
  if(soft){const remaining=Math.max(0,p.targets[d]-p.actual[d]-p.baseline[d])/1000;const v=variable('deficit_'+d,{['target_'+d]:1,deficit:1,['link_deficit_'+d]:1},{kind:'deficit',day:d});delete m.ints['deficit_'+d];constraint('deficit_cap_'+d,{max:remaining});v['deficit_cap_'+d]=1;constraint('link_deficit_'+d,{max:0});constraint('miss_cap_'+d,{max:1});variable('miss_'+d,{missed:1,['miss_cap_'+d]:1,['link_deficit_'+d]:-remaining},{kind:'miss',day:d});}
  for(const k of Object.keys(p.workloads))constraint('work_'+k+'_'+d,{max:p.workloads[k][d]});
 }
 function action(id,name,consumes,points,limit,requires,details={}){
  constraint('limit_'+id,{max:limit});
  for(let d=0;d<5;d++)if(!p.closed[d]&&points[d]>0){const v=variable('act_'+id+'_'+d,{score:points[d]/1000,['target_'+d]:points[d]/1000,['limit_'+id]:1},{kind:'action',id,name,day:d,consumes,points:points[d],...details});
   for(const [r,n]of Object.entries(consumes)){prefix(v,'resource_'+r,d,n);v['use_'+r]=n;if(p.workloads[r])v['work_'+r+'_'+d]=n;}
   // Cumulative dependencies allow a prerequisite earlier in the same day, never afterward.
   if(requires)prefix(v,'prereq_'+id,d,1);
   for(const child of p.upgrades.filter(u=>u.dependsOn===id))prefix(v,'prereq_'+child.id,d,-1);
  }
  if(requires)for(let d=0;d<5;d++)constraint('prereq_'+id+'_'+d,{max:0});
 }
 for(const r of C.resources){const v=p.resources[r.id];if(!r.points||!v.enabled||['hammer','mithril'].includes(r.id))continue;const general=p.workloads[r.id]?p.resources.general.stock-p.resources.general.reserve+p.offers.filter(o=>o.enabled&&o.resource==='general').reduce((n,o)=>n+o.quantity*o.remaining,0):0;const possible=v.stock-v.reserve+general+p.offers.filter(o=>o.enabled&&o.resource===r.id).reduce((n,o)=>n+o.quantity*o.remaining,0);const limit=Math.floor(Math.min(possible,v.cap??MAX)/v.batch);if(limit)action('direct_'+r.id,r.name,{[r.id]:v.batch},p.rules[r.id].map(n=>n*v.batch),limit);}
 for(const u of p.upgrades)action(u.id,u.name,u.consumes,u.points,u.limit,u.dependsOn,u.group?{group:u.group,pieces:u.pieces,step:u.step,displayTo:u.displayTo}:{});
 for(const o of p.offers){if(!o.enabled||!o.remaining)continue;constraint('offer_'+o.id,{max:o.remaining});const w=p.wallets[o.wallet],total=w.balance-w.reserve+w.income.reduce((a,b)=>a+b,0);for(let d=o.from-1;d<o.to;d++)if(!p.closed[d]){const v=variable('buy_'+o.id+'_'+d,{['offer_'+o.id]:1,cost:o.cost/Math.max(1,total)},{kind:'purchase',offer:o,day:d});prefix(v,'resource_'+o.resource,d,-o.quantity);prefix(v,'wallet_'+o.wallet,d,o.cost);}}
 // General minutes can replace a dedicated speedup once, while its activity workload still limits use.
 for(let d=0;d<5;d++)if(!p.closed[d])for(const k of Object.keys(p.workloads)){const v=variable('convert_'+k+'_'+d,{}, {kind:'convert',resource:k,day:d});prefix(v,'resource_general',d,1);prefix(v,'resource_'+k,d,-1);constraint('convert_cap_'+k+'_'+d,{max:p.workloads[k][d]});v['convert_cap_'+k+'_'+d]=1;v.use_general=1;v['use_'+k]=-1;constraint('convert_used_'+k+'_'+d,{max:0});v['convert_used_'+k+'_'+d]=1;for(const [id,row]of Object.entries(m.variables))if(meta[id]?.kind==='action'&&meta[id].day===d)row['convert_used_'+k+'_'+d]=-(meta[id].consumes[k]||0);}
 return {model:m,profile:p,meta};
}
function solution(model,solver){const r=solver.Solve(model);if(!r.feasible||r.bounded===false)return null;const result={};for(const [key]of Object.entries(model.variables)){const value=r[key]||0;if(model.ints[key]&&Math.abs(value-Math.round(value))>1e-4)throw Error('Solver returned an incomplete integer plan.');result[key]=model.ints[key]?Math.round(value):value;}
 for(const [key,bound]of Object.entries(model.constraints)){const v=Object.entries(model.variables).reduce((n,[id,row])=>n+(row[key]||0)*(result[id]||0),0);if(v<(bound.min??bound.equal??-Infinity)-1e-4||v>(bound.max??bound.equal??Infinity)+1e-4)throw Error('The computed plan did not pass resource checks. Reduce the problem or check inputs.');}return result;}
function total(model,values,key){return Object.entries(model.variables).reduce((n,[id,row])=>n+(row[key]||0)*(values[id]||0),0);}
function optimize(input,solver){
 const prepared=compile(input),{profile:p}=prepared;if(!p.confirmed)throw Error('Confirm your event rules, usable items and shop details before calculating.');let {model,meta}=prepared,values=solution(model,solver),allTargets=!!values;
 if(!values){({model,meta}=compile(p,true));model.optimize='missed';model.opType='min';values=solution(model,solver);if(!values)throw Error('Cannot construct a feasible inventory plan. Check reserves and inputs.');model.constraints.keep_missed={max:total(model,values,'missed')+1e-7};for(const row of Object.values(model.variables))row.keep_missed=row.missed||0;model.optimize='deficit';values=solution(model,solver);if(!values)throw Error('Could not complete the daily milestone optimization.');model.constraints.keep_deficit={max:total(model,values,'deficit')+1e-7};for(const row of Object.values(model.variables))row.keep_deficit=row.deficit||0;model.optimize='score';model.opType='max';values=solution(model,solver);if(!values)throw Error('Could not complete the shortfall optimization.');}
 const bestScore=total(model,values,'score');model.constraints.keep_score={min:bestScore-1e-7};for(const row of Object.values(model.variables))row.keep_score=row.score||0;model.optimize='cost';model.opType='min';values=solution(model,solver)||values;
 const days=p.targets.map((target,d)=>({day:d+1,target,actual:p.actual[d],expected:p.closed[d]?0:p.baseline[d],planned:0,actions:[],purchases:[],generalMinutes:{},closed:p.closed[d]})),spending=Object.fromEntries(C.wallets.map(w=>[w.id,0])),used=Object.fromEntries(C.resources.map(r=>[r.id,0])),bought={};
 for(const [id,info]of Object.entries(meta)){const count=values[id]||0;if(count<1e-6)continue;const day=days[info.day];if(info.kind==='action'){day.planned+=count*info.points;day.actions.push({...info,count});for(const [r,n]of Object.entries(info.consumes))used[r]+=n*count;}if(info.kind==='purchase'){day.purchases.push({...info,count});spending[info.offer.wallet]+=info.offer.cost*count;bought[info.offer.resource]=(bought[info.offer.resource]||0)+info.offer.quantity*count;}if(info.kind==='convert'){day.generalMinutes[info.resource]=count;used.general+=count;used[info.resource]-=count;}}
 const progress=new Map();for(const day of days){const resolved=[];day.actions.sort((a,b)=>(a.step||0)-(b.step||0));for(const a of day.actions){if(!a.group){resolved.push(a);continue;}for(let n=0;n<a.count;n++){const piece=a.pieces.find(name=>(progress.get(a.group+':'+name)||0)===a.step-1);if(!piece)throw Error('Gear prerequisite assignment failed verification.');progress.set(a.group+':'+piece,a.step);resolved.push({...a,name:piece+' → '+a.displayTo,count:1});}}day.actions=resolved;}
 for(const day of days){day.projected=day.actual+day.expected+day.planned;day.shortfall=Math.max(0,day.target-day.projected);}
 const remaining=Object.fromEntries(C.resources.map(r=>[r.id,p.resources[r.id].stock+(bought[r.id]||0)-used[r.id]]));
 return {version:1,days,allTargets:days.every(d=>d.shortfall<.01),futureTargetsFeasible:allTargets,total:days.reduce((n,d)=>n+d.projected,0),shortfall:days.reduce((n,d)=>n+d.shortfall,0),spending,remaining,used,bought,note:'Optimal for these entered integer actions, rules, budgets and limits when the solver completes. Unentered activities, future shop resets and unconfirmed rewards are excluded. Unreachable plans maximize the number of daily targets met, then minimize remaining target shortfall before maximizing total score. Currency spending is minimized among equally scoring plans, relative to each currency’s available budget.'};
}
root.KvKModel={empty,clean,compile,optimize,clone};
})(typeof globalThis!=='undefined'?globalThis:this);
