/* Personal Bear presets. Inventory arithmetic, not a damage forecast. */
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
function apportioned(values,size){
 const sum=values.reduce((a,b)=>a+b,0);if(!sum||!size)return values.map(()=>0);
 const exact=values.map(v=>v/sum*size),out=exact.map(Math.floor);
 const order=exact.map((v,i)=>({i,rem:v-out[i]})).sort((a,b)=>b.rem-a.rem||a.i-b.i);
 for(let left=size-out.reduce((a,b)=>a+b,0),i=0;left>0;left--,i++)out[order[i].i]++;
 return out;
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
   const name=input.leaders?.[type];if(!name)throw Error('Choose an available '+type+' hero for your own rally, or choose Join only.');
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
 const packet=matrix(),quota=matrix();
 for(const t of TIERS)for(const k of TYPES)quota[t][k]=Math.floor(remaining[t][k]/joins);
 let room=limit;
 for(const t of TIERS){
  const values=TYPES.map(k=>quota[t][k]),sum=values.reduce((a,b)=>a+b,0);
  const valuesOut=sum<=room?values:apportioned(values,room);
  TYPES.forEach((k,i)=>packet[t][k]=valuesOut[i]);room-=valuesOut.reduce((a,b)=>a+b,0);
 }
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
 if(total(leftover))warnings.push('Some T8–T10 troops remain unallocated because of the march limit or identical-preset rounding. They are listed below.');
 return {joins,presets,setups,usedPresets:setups.filter(s=>s.slot).length+(own.slot?1:0),requiredPresets:setups.length+(ownEnabled?1:0),packet,perJoin:count,joinTotal:count*joins,leftover,leftoverTotal:total(leftover),own,marches,warnings,limit,manual,
  note:'The special own-rally march is separate: '+joins+' joining marches'+(ownEnabled?' + 1 own rally':'')+'. Counts are identical for every join. Highest tiers fill the shared limit first; this is not a claim of the best damage ratio.'};
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
const api={TYPES,TIERS,HEROES,matrix,total,build,suggestLeaders,fingerprint};
if(typeof module!=='undefined')module.exports=api;root.BearPersonalModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
