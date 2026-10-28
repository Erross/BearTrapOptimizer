/* Personal Bear presets: archer-first joins and explicit own-rally tradeoffs. */
(function(root){
'use strict';
const TYPES=['infantry','cavalry','archers'],TIERS=[10,9,8];
const HEROES=[
 {id:'50007',name:'Chenko',type:'cavalry',join:true,priority:1},
 {id:'50028',name:'Yeonwoo',type:'archers',join:true,priority:2},
 {id:'50027',name:'Amane',type:'archers',join:true,priority:3},
 {id:'50011',name:'Amadeus',type:'infantry',join:true,priority:4},
 {id:'50004',name:'Howard',type:'infantry'},
 {id:'50012',name:'Jabel',type:'cavalry'},
 {id:'50006',name:'Quinn',type:'archers'},
 {id:'50009',name:'Helga',type:'infantry'},
 {id:'50021',name:'Zoe',type:'infantry'},
 {id:'50018',name:'Marlin',type:'archers'},
 {id:'50017',name:'Saul',type:'archers'},
 {id:'50005',name:'Gordon',type:'cavalry'},
 {id:'50013',name:'Hilde',type:'cavalry'},
 {id:'50008',name:'Diana',type:'archers'},
 {id:'50000',name:'Forrest',type:'infantry'},
 {id:'50002',name:'Edwin',type:'cavalry'},
 {id:'50001',name:'Seth',type:'infantry'}
];
function whole(v,min,max,label){if(v===''||v==null||typeof v==='boolean'||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)throw Error(label+' must be a whole number from '+min+' to '+max+'.');return Number(v);}
function matrix(value={}){return Object.fromEntries(TIERS.map(t=>[t,Object.fromEntries(TYPES.map(k=>[k,whole(value[t]?.[k]??0,0,5000000,'T'+t+' '+k)]))]));}
function total(m){return TIERS.reduce((n,t)=>n+TYPES.reduce((s,k)=>s+m[t][k],0),0);}
// Community per-type square-root reference: attack, archer counter and average
// Volley. Mixed tiers use attack-weighted effective counts (an approximation).
const ATTACK={10:{infantry:472,cavalry:1416,archers:1888},9:{infantry:400,cavalry:1200,archers:1600},8:{infantry:339,cavalry:1017,archers:1356}};
const attackWeight=(t,k,stats)=>ATTACK[t][k]/472*(k==='archers'?1.1*1.1:1)*(1+(stats?.[k]?.attack||0)/100)*(1+(stats?.[k]?.lethality||0)/100);
function referenceScore(packet,stats){return TYPES.reduce((score,k)=>score+Math.sqrt(TIERS.reduce((n,t)=>n+packet[t][k]*attackWeight(t,k,stats)**2,0)),0);}
function joinPolicy(value){if(value==null)return {mode:'optimized'};if(!value||typeof value!=='object'||!['optimized','archer-first','ratio'].includes(value.mode))throw Error('Choose a joining formation.');const out={mode:value.mode};if(value.mode==='ratio'){out.infantryPct=whole(value.infantryPct,0,100,'Joining infantry percentage');out.cavalryPct=whole(value.cavalryPct,0,100,'Joining cavalry percentage');if(out.infantryPct+out.cavalryPct>100)throw Error('Joining infantry and cavalry percentages cannot exceed 100 together.');}if(value.stats!==undefined){out.stats={};for(const k of TYPES){out.stats[k]={};for(const key of ['attack','lethality']){const v=value.stats?.[k]?.[key];if(v==null||v===''||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>10000)throw Error('Enter all six rally-leader Attack and Lethality bonuses (0–10000%).');out.stats[k][key]=Number(v);}}}return out;}
function optimizedPacket(quota,limit,policy=joinPolicy()){if(policy.mode==='optimized')return damagePacket(quota,limit,policy.stats);
 const packet=matrix();let room=Math.min(limit,total(quota));
 if(policy.mode==='ratio'){const amount=room,shares=[policy.infantryPct,policy.cavalryPct,100-policy.infantryPct-policy.cavalryPct],targets=shares.map(n=>Math.floor(amount*n/100));const order=shares.map((n,i)=>({i,f:amount*n/100-targets[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let n=amount-targets.reduce((a,b)=>a+b,0),i=0;n>0;n--,i++)targets[order[i].i]++;for(const [i,k]of TYPES.entries()){let goal=targets[i];for(const t of TIERS){const take=Math.min(goal,quota[t][k]);packet[t][k]=take;goal-=take;room-=take;}}}
 for(const k of ['archers','cavalry','infantry'])for(const t of TIERS){const take=Math.min(room,quota[t][k]-packet[t][k]);packet[t][k]+=take;room-=take;}
 return packet;
}
// Exact integer selection from three decreasing marginal-gain chains.
function damagePacket(quota,limit,stats){const amount=Math.min(limit,total(quota));if(!amount)return matrix();if(amount===total(quota))return matrix(quota);const chains=TYPES.map(k=>TIERS.filter(t=>quota[t][k]).map(t=>({t,k,cap:quota[t][k],a:attackWeight(t,k,stats)**2}))),gain=(s,a)=>a/(Math.sqrt(s+a)+Math.sqrt(s));
 function above(cutoff){const packet=matrix();let count=0;for(const chain of chains){let s=0;for(const c of chain){let take=0;if(cutoff===0)take=c.cap;else if(cutoff<=Math.sqrt(c.a)){const boundary=((c.a-cutoff*cutoff)/(2*cutoff))**2;take=Math.max(0,Math.min(c.cap,Math.floor((boundary-s)/c.a)+1));while(take&&gain(s+(take-1)*c.a,c.a)<cutoff)take--;while(take<c.cap&&gain(s+take*c.a,c.a)>=cutoff)take++;}packet[c.t][c.k]=take;count+=take;s+=take*c.a;if(take<c.cap)break;}}return {packet,count};}
 let low=0,high=Math.max(...chains.flat().map(c=>Math.sqrt(c.a)))+1,best=above(high);for(let i=0;i<80;i++){const mid=(low+high)/2,c=above(mid);if(c.count>amount)low=mid;else{high=mid;best=c;}}
 const packet=best.packet,sums=Object.fromEntries(TYPES.map(k=>[k,TIERS.reduce((n,t)=>n+packet[t][k]*attackWeight(t,k,stats)**2,0)]));while(best.count<amount){let chosen=null,score=-Infinity;for(const k of TYPES){const t=TIERS.find(t=>packet[t][k]<quota[t][k]);if(t===undefined)continue;const g=gain(sums[k],attackWeight(t,k,stats)**2);if(g>score){score=g;chosen={t,k};}}if(!chosen)throw Error('Could not complete damage allocation.');packet[chosen.t][chosen.k]++;sums[chosen.k]+=attackWeight(chosen.t,chosen.k,stats)**2;best.count++;}return packet;
}
function impactScore(packet,stats){return referenceScore(packet,stats)*Math.sqrt(Math.min(total(packet),5000));}
function ownAlternatives(input){
 const stock=matrix(input.stock),capacity=whole(input.ownCapacity,1,2000000,'Own-rally march capacity');
 const copy=()=>JSON.parse(JSON.stringify({...input,ownEnabled:true}));
 let small=copy(),full=null;
 if(input.ownTier==='lower'&&input.lowerConfirmed){small.ownTier='lower';small.ownTroops=Object.fromEntries(TYPES.map(k=>[k,Number(input.ownTroops?.[k])>0?1:0]));if(!TYPES.some(k=>small.ownTroops[k]))throw Error('Enter the T1–T7 troops you will send before applying a minimum own march.');}
 else{const tier=[8,9,10].find(t=>TYPES.some(k=>stock[t][k]>0));if(tier===undefined)throw Error('Enter troops before comparing own-rally options.');small.ownTier=tier;let left=capacity;small.ownTroops=Object.fromEntries(TYPES.map(k=>[k,stock[tier][k]&&left-->0?1:0]));}
 function fromStock(pool){let result=null,best=-1;for(const tier of TIERS){const quota=matrix();quota[tier]={...pool[tier]};const packet=optimizedPacket(quota,capacity,joinPolicy(input.joinPolicy)),score=impactScore(packet,joinPolicy(input.joinPolicy).stats);if(total(packet)&&score>best){best=score;result={...copy(),ownTier:tier,ownTroops:{...packet[tier]}};}}return result;}

 full=fromStock(stock);
 const joins=whole(input.joinMarches,1,10,'Joining marches'),march=whole(input.capacity,1,2000000,'Joining march capacity'),cap=whole(input.joinCap??0,0,2000000,'Alliance joining limit'),available=heroOptions(input.heroes),leaders=TYPES.map(k=>input.leaders?.[k]),eligible=available.filter(h=>h.join&&h.skill>0&&!leaders.includes(h.name)).length,bare=eligible<joins?whole(input.heroFreeCapacity,1,2000000,'March capacity without heroes'):march,limit=Math.min(march,bare,cap||march),quota=matrix();
 for(const t of TIERS)for(const k of TYPES)quota[t][k]=Math.floor(stock[t][k]/joins);
 const packet=optimizedPacket(quota,limit,joinPolicy(input.joinPolicy)),surplus=matrix(stock);for(const t of TIERS)for(const k of TYPES)surplus[t][k]-=packet[t][k]*joins;
 const joinFirst=fromStock(surplus)||(small.ownTier==='lower'?small:null);
 function scenario(candidate){if(!candidate)return {error:'No entered T8–T10 stock is available for a full own march.'};try{const plan=build(candidate),ownPacket=matrix();if(candidate.ownTier!=='lower')ownPacket[candidate.ownTier]={...candidate.ownTroops};return {input:candidate,plan,ownImpact:candidate.ownTier==='lower'?0:impactScore(ownPacket,joinPolicy(input.joinPolicy).stats),joinImpact:plan.joins*impactScore(plan.packet,joinPolicy(input.joinPolicy).stats)};}catch(error){return {error:error.message};}}
 return {joinFirst:scenario(joinFirst),small:scenario(small),full:scenario(full),current:scenario(copy())};
}
// Joint numerical search over the own packet. Every candidate re-optimizes all
// identical joins against the remaining stock; it is not a choice between just
// the three fixed scenarios. Integer floors/mixed tiers prevent a global proof.
function jointOwn(input,measurements={},options=ownAlternatives(input)){
 const policy=joinPolicy(input.joinPolicy);
 if(policy.mode!=='optimized')return {error:'Select Calculated mix under Joining formation to use the balanced plan.'};
 if(!input.ownEnabled)return {error:'Enable your own rally to compare a combined plan.'};
 const blank=['ownHits','joinHits','relative'].every(k=>measurements[k]==null||measurements[k]==='');
 const weights=blank?{ownHits:1,joinHits:1,relative:100}:measurements;
 if(!compareOwn(options,weights))return {error:'Enter all three comparison measurements, or clear all three to use equal strength and hit counts.'};
 const ownFactor=Number(weights.ownHits)*Number(weights.relative)/100,joinFactor=Number(weights.joinHits),stock=matrix(input.stock),capacity=whole(input.ownCapacity,1,2000000,'Own-rally march capacity');
 const valid=Object.values(options).filter(c=>!c.error);if(!valid.length)return {error:'Complete a valid own-rally setup first.'};
 const joins=valid[0].plan.joins,limit=valid[0].plan.limit,score=c=>c.ownImpact*ownFactor+c.joinImpact*joinFactor;
 let best=valid.reduce((a,c)=>score(c)>score(a)?c:a),bestScore=score(best),evaluations=0;
 for(const tier of TIERS){
  if(!TYPES.some(k=>stock[tier][k]))continue;
  const cache=new Map();
  function evaluate(counts){const key=counts.join(',');if(cache.has(key))return cache.get(key);const amount=counts.reduce((a,b)=>a+b,0);if(amount<1||amount>capacity||counts.some((n,i)=>n<0||n>stock[tier][TYPES[i]]))return null;
   const pool=matrix(stock),ownPacket=matrix();TYPES.forEach((k,i)=>{pool[tier][k]-=counts[i];ownPacket[tier][k]=counts[i];});for(const t of TIERS)for(const k of TYPES)pool[t][k]=Math.floor(pool[t][k]/joins);
   const packet=damagePacket(pool,limit,policy.stats);if(!total(packet))return null;
   const ownImpact=impactScore(ownPacket,policy.stats),joinImpact=joins*impactScore(packet,policy.stats),result={counts,ownImpact,joinImpact,score:ownImpact*ownFactor+joinImpact*joinFactor};cache.set(key,result);evaluations++;return result;
  }
  const q=matrix();q[tier]={...stock[tier]};const full=damagePacket(q,capacity,policy.stats)[tier];
  const seeds=[TYPES.map(k=>full[k]),...valid.filter(c=>Number(c.input.ownTier)===tier).map(c=>TYPES.map(k=>Number(c.input.ownTroops[k]||0)))];
  for(let i=0;i<3;i++){const a=[0,0,0];a[i]=Math.min(capacity,stock[tier][TYPES[i]]);seeds.push(a);}
  let current=seeds.map(evaluate).filter(Boolean).sort((a,b)=>b.score-a.score)[0];if(!current)continue;
  // Small cases are exhaustively solved, providing an independent regression
  // anchor for the bounded numerical search used with real inventories.
  if(capacity<=30){for(let i=0;i<=Math.min(capacity,stock[tier].infantry);i++)for(let c=0;c<=Math.min(capacity-i,stock[tier].cavalry);c++)for(let a=0;a<=Math.min(capacity-i-c,stock[tier].archers);a++){const next=evaluate([i,c,a]);if(next&&next.score>current.score)current=next;}}
  else{
   const directions=[];for(let i=0;i<3;i++){for(const sign of [-1,1]){const d=[0,0,0];d[i]=sign;directions.push(d);}for(let j=0;j<3;j++)if(j!==i){const d=[0,0,0];d[i]=-1;d[j]=1;directions.push(d);}}
   const steps=[];for(let step=2**Math.floor(Math.log2(capacity));step>=1;step/=2)steps.push(step);steps.push(joins,1);
   for(const step of steps)for(let pass=0;pass<100;pass++){let next=current;for(const d of directions){const candidate=evaluate(current.counts.map((n,i)=>n+d[i]*step));if(candidate&&candidate.score>next.score+1e-9)next=candidate;}if(next===current)break;current=next;}
  }
  if(current.score>bestScore+1e-9){const candidate=JSON.parse(JSON.stringify(input));candidate.ownTier=tier;candidate.ownTroops=Object.fromEntries(TYPES.map((k,i)=>[k,current.counts[i]]));const plan=build(candidate);best={input:candidate,plan,ownImpact:current.ownImpact,joinImpact:current.joinImpact};bestScore=current.score;}
 }
 return {...best,search:{assumedEqual:blank,weights:{ownHits:Number(weights.ownHits),joinHits:Number(weights.joinHits),relative:Number(weights.relative)},evaluations,score:bestScore,method:'Integer numerical search; best plan found, not a proven in-game maximum.'}};
}
function compareOwn(options,measurements){
 const ownHits=Number(measurements.ownHits),joinHits=Number(measurements.joinHits),relative=Number(measurements.relative)/100;
 if(!Number.isInteger(ownHits)||!Number.isInteger(joinHits)||![ownHits,joinHits,relative].every(n=>Number.isFinite(n)&&n>0)||ownHits>100||joinHits>100||relative>100)return null;
 const scores=Object.fromEntries(Object.entries(options).filter(([,c])=>!c.error).map(([key,c])=>[key,c.ownImpact*ownHits*relative+c.joinImpact*joinHits]));if(Object.keys(scores).length<2)return null;
 const order=Object.entries(scores).sort((a,b)=>b[1]-a[1]),winner=order[0][0],baseline=options.joinFirst.error?options.small:options.joinFirst,ownGain=options.full.error?0:options.full.ownImpact-baseline.ownImpact;
 return {...scores,winner,breakEven:ownGain>0?(baseline.joinImpact-options.full.joinImpact)*joinHits/(ownGain*ownHits)*100:null};
}
function heroOptions(entries=[]){
 if(!Array.isArray(entries))throw Error('Invalid hero selection.');
 const seen=new Set();
 return entries.filter(h=>h.available).map(h=>{
  const base=HEROES.find(x=>x.name===h.name);if(!base||seen.has(h.name))throw Error('Invalid or repeated hero: '+h.name);seen.add(h.name);
  return {...base,skill:whole(h.skill??0,0,5,h.name+' first Expedition skill')};
 });
}
function build(input){
 const stock=matrix(input.stock),remaining=matrix(stock),joins=whole(input.joinMarches,1,10,'Joining marches');
 const presets=whole(input.presets,0,12,'Saved preset slots'),capacity=whole(input.capacity,1,2000000,'Joining march capacity');
 const cap=whole(input.joinCap??0,0,2000000,'Alliance joining limit');
 const available=heroOptions(input.heroes),lead=[],warnings=[];
 const ownEnabled=!!input.ownEnabled,own={enabled:ownEnabled,tier:input.ownTier??8,troops:{},heroes:[],slot:null};
 if(ownEnabled){
  for(const k of TYPES)own.troops[k]=whole(input.ownTroops?.[k]??0,0,2000000,'Own-rally '+k);
  own.total=TYPES.reduce((n,k)=>n+own.troops[k],0);
  if(own.total<1)throw Error('Reserve at least one troop for your special own-rally march.');
  const ownCapacity=whole(input.ownCapacity??capacity,1,2000000,'Own-rally march capacity');
  if(own.total>ownCapacity)throw Error('Your own-rally troops exceed its march capacity.');
  if(String(own.tier)==='lower'){
   if(!input.lowerConfirmed)throw Error('Confirm that the lower-tier troops reserved for your own rally are available outside the T8–T10 table.');
  }else{
   own.tier=whole(own.tier,8,10,'Own-rally tier');
   for(const k of TYPES){if(own.troops[k]>remaining[own.tier][k])throw Error('Not enough T'+own.tier+' '+k+' for your own rally.');remaining[own.tier][k]-=own.troops[k];}
  }
  for(const type of TYPES){
   const name=input.leaders?.[type];if(!name)throw Error('Choose an available '+type+' hero for your own rally, or untick I start my own Bear rally.');
   const h=available.find(h=>h.name===name&&h.type===type);if(!h)throw Error('Choose an available '+type+' leader.');
   if(lead.includes(name))throw Error('A hero cannot be used twice.');lead.push(name);
  }
  own.heroes=lead;
 }
 const eligible=available.filter(h=>h.join&&h.skill>0&&!lead.includes(h.name)).sort((a,b)=>b.skill-a.skill||a.priority-b.priority);
 const assigned=Array.from({length:joins},(_,i)=>eligible[i]?.name??null),noHero=assigned.some(h=>!h);
 let effectiveCapacity=capacity;
 if(noHero){
  const bare=whole(input.heroFreeCapacity,1,2000000,'March capacity without heroes');
  effectiveCapacity=Math.min(capacity,bare);
  warnings.push('Some joins use no hero. Every joining preset uses the smaller confirmed capacity so all troop counts remain identical.');
 }
 const limit=Math.min(effectiveCapacity,cap||effectiveCapacity);
 const quota=matrix();
 for(const t of TIERS)for(const k of TYPES)quota[t][k]=Math.floor(remaining[t][k]/joins);
 const policy=joinPolicy(input.joinPolicy),packet=optimizedPacket(quota,limit,policy);
 const allocation={method:policy.mode,policy,minimums:policy.mode==='optimized'?Object.fromEntries(['infantry','cavalry'].map(k=>[k,TIERS.reduce((n,t)=>n+packet[t][k],0)])):null,byType:Object.fromEntries(TYPES.map(k=>[k,TIERS.reduce((n,t)=>n+packet[t][k],0)]))};
 const count=total(packet);if(!count)throw Error('There are too few troops for identical non-empty joining presets. Enter more troops or reduce the joining-march count.');
 const leftover=matrix(remaining);
 for(const t of TIERS)for(const k of TYPES)leftover[t][k]-=packet[t][k]*joins;
 const setups=[],byHero=new Map();
 const marches=assigned.map((hero,i)=>{
  let setup=byHero.get(hero);
  if(!setup){setup={hero,slot:setups.length<presets?setups.length+1:null,numbers:[]};setups.push(setup);byHero.set(hero,setup);}
  setup.numbers.push(i+1);
  return {number:i+1,hero,slot:setup.slot};
 });
 if(ownEnabled&&presets>setups.length)own.slot=setups.length+1;
 const manual=setups.filter(s=>!s.slot).length+(ownEnabled&&!own.slot?1:0);
 if(manual)warnings.push(manual+' march setup'+(manual===1?' needs':'s need')+' manual selection because you have fewer saved presets than different march setups.');
 if(total(leftover))warnings.push('Some T8–T10 troops remain at home because of the joining cap, available march slots, or identical-preset rounding. See Troops left at home below.');
 return {allocation,joins,presets,setups,usedPresets:setups.filter(s=>s.slot).length+(own.slot?1:0),requiredPresets:setups.length+(ownEnabled?1:0),packet,perJoin:count,joinTotal:count*joins,leftover,leftoverTotal:total(leftover),own,marches,warnings,limit,manual,
  note:(policy.mode==='optimized'?'Calculated mix estimates damage within your stock and limits; unentered leader bonuses are assumed equal. ':policy.mode==='ratio'?'Target join ratio: '+policy.infantryPct+'% infantry / '+policy.cavalryPct+'% cavalry / '+(100-policy.infantryPct-policy.cavalryPct)+'% archers. Shortages fill from archers, cavalry, then infantry. ':'Archers first, then cavalry, then infantry. ')+(ownEnabled?'Your own-rally troops are set aside first. ':'')+'The chosen joining formation builds '+joins+' identical joins, using the highest available tiers within each troop type.'};
}
function suggestLeaders(entries,observed=[]){
 const available=heroOptions(entries),result={};
 for(const type of TYPES){
  const candidates=available.filter(h=>h.type===type).map(h=>{
   const api=observed.find(x=>x.name===h.name);
   const gear=(api?.gear||[]).reduce((s,g)=>s+(g.enhancement_level||0)+10*(g.refine_level||0),0);
   return {...h,score:gear+(api?.exclusive_gear_level||0)*10+(api?.stars||0)};
  }).sort((a,b)=>b.score-a.score||Number(b.name==='Amadeus')-Number(a.name==='Amadeus'));
  result[type]=candidates[0]?.name||'';
 }return result;
}
function fingerprint(plan){return JSON.stringify({snapshotAt:plan?.snapshotAt,traps:plan?.traps,calibration:plan?.calibration,comparisonGroup:plan?.comparisonGroup,players:plan?.players?.map(p=>[p.governorId,p.active,p.attending,p.canHost,p.group,p.api?.x,p.api?.y,p.travel,p.stats])});}
const api={TYPES,TIERS,HEROES,matrix,total,joinPolicy,referenceScore,optimizedPacket,ownAlternatives,jointOwn,compareOwn,build,suggestLeaders,fingerprint};
if(typeof module!=='undefined')module.exports=api;root.BearPersonalModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
