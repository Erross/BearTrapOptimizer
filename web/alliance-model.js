/* Cached observations and local planning data. This module never calls a game API. */
(function(root){
 'use strict';
 const SCHEMA='bear-alliance-plan',KINGDOM=2399,TAG='CNQ',TYPES=['infantry','cavalry','archers'];
 const clone=value=>JSON.parse(JSON.stringify(value)),own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const statBounds={
  troops:[1,5e6,true],infantry:[0,5e6,true],cavalry:[0,5e6,true],archers:[0,5e6,true],
  march_capacity:[1,2e6,true],rally_capacity:[1,2e7,true],join_slots:[0,10,true],
  host_strength:[.000001,100],troop_quality:[.000001,20],historical_score:[0,1e13],
  outbound_s:[0,3600,true],return_s:[0,3600,true],join_travel_s:[0,3600,true]
 };
 for(const type of TYPES)Object.assign(statBounds,{
  [type+'_tier']:[1,10,true],[type+'_quality']:[.000001,20],
  [type+'_attack_bonus']:[0,1e5],[type+'_lethality_bonus']:[0,1e5]
 });
 function id(value){
  if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('Governor IDs must be exact integers.');
  const result=String(value);
  if(!/^[1-9]\d{0,19}$/.test(result))throw Error('Invalid governor ID.');
  return result;
 }
 function bounded(value,low,high,whole=false,label='Value'){
  if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high||whole&&!Number.isInteger(value))
   throw Error(label+' must be '+low+'–'+high+(whole?' as a whole number.':'.'));
  return value;
 }
 function position(value){
  if(value==null)return null;
  return {x:bounded(value.x,0,1e6,true,'X coordinate'),y:bounded(value.y,0,1e6,true,'Y coordinate')};
 }
 function hasPosition(value){return value&&Number.isFinite(value.x)&&Number.isFinite(value.y);}
 function distance(a,b){return hasPosition(a)&&hasPosition(b)?Math.hypot(a.x-b.x,a.y-b.y):null;}
 function groupLabel(group){return group==='1'?'Bear trap 1':group==='2'?'Bear trap 2':group==='none'?'Unassigned':'All members';}
 function boolean(value,fallback,label){if(value===undefined)return fallback;if(typeof value!=='boolean')throw Error('Invalid '+label+'.');return value;}
 function overrides(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid measured stats.');
  const result={};
  for(const [key,v]of Object.entries(value)){
   if(!own(statBounds,key))throw Error('Unknown measured stat: '+key);
   const [low,high,whole=false]=statBounds[key];
   result[key]=bounded(v,low,high,whole,key);
  }
  const supplied=TYPES.filter(type=>own(result,type));
  if(supplied.length&&supplied.length!==3)throw Error('Enter all three troop counts, or a total stock only.');
  if(supplied.length){
   const total=TYPES.reduce((n,t)=>n+result[t],0);
   bounded(total,1,5e6,true,'Total troops');
   if(own(result,'troops')&&result.troops!==total)throw Error('The three troop counts must match the entered total.');
  }
  return result;
 }
 function fingerprint(plan,player,group){
  return {cityX:player.api.x,cityY:player.api.y,trapX:plan.traps[group]?.x??null,trapY:plan.traps[group]?.y??null};
 }
 function measurement(value){
  if(value==null)return null;
  const result={seconds:bounded(value.seconds,0,3600,true,'Measured travel'),position:{}};
  if(value.returnSeconds!=null)result.returnSeconds=bounded(value.returnSeconds,0,3600,true,'Measured return');
  for(const key of ['cityX','cityY','trapX','trapY']){
   const number=value.position?.[key];
   result.position[key]=number===null?null:bounded(number,0,1e6,true,'Measurement position');
  }
  return result;
 }
 function observation(value){
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>200)throw Error('Invalid member name.');
  const result={name:value.name,townLevel:bounded(value.townLevel,0,100,true,'Town Center'),
   power:bounded(value.power,0,1e15,false,'Account power'),x:null,y:null,
   fresh:typeof value.fresh==='boolean'?value.fresh:null,
   cachedAt:typeof value.cachedAt==='string'?value.cachedAt.slice(0,60):Number.isFinite(value.cachedAt)?value.cachedAt:null,
   status:typeof value.status==='string'?value.status.slice(0,40):'not_refreshed'};
  if(value.x!=null&&value.y!=null)Object.assign(result,position(value));
  result.troopPower=value.troopPower==null?null:bounded(value.troopPower,0,1e15,false,'Troop power');
  return result;
 }
 function emptyPlan(){
  return {schema:SCHEMA,version:1,kingdomId:KINGDOM,allianceTag:TAG,snapshotAt:null,
   traps:{'1':null,'2':null},calibration:{cityWidthUnits:2,secondsPerCityWidth:4,offsetSeconds:2},
   comparisonGroup:'all',useAlliance:true,players:[]};
 }
 function validatePlan(value){
  if(!value||value.schema!==SCHEMA||value.version!==1||value.kingdomId!==KINGDOM||value.allianceTag!==TAG
    ||!Array.isArray(value.players)||value.players.length>500)throw Error('Choose a CNQ alliance plan exported by this app.');
  const result=emptyPlan(),seen=new Set();
  result.snapshotAt=typeof value.snapshotAt==='string'?value.snapshotAt.slice(0,60):null;
  result.useAlliance=boolean(value.useAlliance,true,'roster source');
  if(!['all','1','2','none'].includes(value.comparisonGroup))throw Error('Invalid comparison group.');
  result.comparisonGroup=value.comparisonGroup;
  result.traps={'1':position(value.traps?.['1']),'2':position(value.traps?.['2'])};
  if(result.traps['1']&&result.traps['2']&&distance(result.traps['1'],result.traps['2'])===0)throw Error('The two Bear traps need different coordinates.');
  const c=value.calibration;
  result.calibration={cityWidthUnits:bounded(c?.cityWidthUnits,.1,100,false,'City width'),
   secondsPerCityWidth:bounded(c?.secondsPerCityWidth,.01,100,false,'Travel calibration'),
   offsetSeconds:bounded(c?.offsetSeconds,0,60,false,'Travel offset')};
  result.players=value.players.map(p=>{
   const governorId=id(p.governorId);
   if(seen.has(governorId))throw Error('Duplicate governor ID in plan.');seen.add(governorId);
   if(!['none','1','2'].includes(p.group))throw Error('Invalid Bear trap assignment.');
   return {governorId,api:observation(p.api),active:boolean(p.active,true,'membership'),
    attending:boolean(p.attending,true,'attendance'),canHost:boolean(p.canHost,true,'rally role'),
    group:p.group,ring:p.ring==null?null:bounded(p.ring,1,10000,true,'Fallback ring'),
    stats:overrides(p.stats),travel:{'1':measurement(p.travel?.['1']),'2':measurement(p.travel?.['2'])}};
  });
  if(result.players.filter(p=>p.active).length>100)throw Error('An active roster can contain at most 100 members.');
  return result;
 }
 function mergeSnapshot(current,snapshot,selected=null){
  if(snapshot?.schema!=='mightpulse-alliance-snapshot'||snapshot.version!==1
    ||snapshot.kingdom_id!==KINGDOM||snapshot.alliance_tag!==TAG
    ||!Array.isArray(snapshot.members)||!snapshot.members.length||snapshot.members.length>100)
   throw Error('The saved snapshot must be CNQ in Kingdom 2399.');
  const plan=validatePlan(current||emptyPlan()),old=new Map(plan.players.map(p=>[p.governorId,p])),seen=new Set();
  const targets=selected?new Set([...selected].map(id)):null;
  const boardRows=(snapshot.troop_power_board?.boards||[]).flatMap(b=>b.key==='troop_power'?b.rows||[]:[]);
  const troopPower=new Map(boardRows.filter(r=>r.governor_id!=null).map(r=>[id(r.governor_id),r.score]));
  const players=snapshot.members.map(m=>{
   const governorId=id(m.governor_id??m.fid);
   if(seen.has(governorId)||m.kid!=null&&m.kid!==KINGDOM)throw Error('Duplicate or foreign roster member.');seen.add(governorId);
   const profile=snapshot.profiles?.[governorId],base=profile?.player||{};
   if(profile?.governor_id!=null&&id(profile.governor_id)!==governorId)throw Error('Mismatched governor profile.');
   const status=snapshot.profile_status?.[governorId]||'not_refreshed';
   const usable=status!=='membership_changed'&&(base.kid==null||base.kid===KINGDOM);
   const api=observation({name:m.nick_name||base.nick_name||('Governor '+governorId),
    townLevel:m.town_center_level??base.town_center_level??0,power:m.power??base.power??0,
    x:usable?base.x:null,y:usable?base.y:null,fresh:profile?.fresh??snapshot.roster_freshness?.fresh,
    cachedAt:profile?.cached_at??snapshot.roster_freshness?.cached_at,status,
    troopPower:troopPower.get(governorId)??null});
   const prior=old.get(governorId);
   return prior?{...prior,active:usable,api:!targets||targets.has(governorId)?api:prior.api}:
    {governorId,api,active:usable,attending:true,canHost:true,group:'none',ring:null,stats:{},travel:{'1':null,'2':null}};
  });
  players.push(...plan.players.filter(p=>!seen.has(p.governorId)).map(p=>({...p,active:false})));
  return validatePlan({...plan,players,snapshotAt:snapshot.generated_at??null});
 }
 function nearestTrap(plan,player){
  if(!plan.traps['1']||!plan.traps['2'])return null;
  const first=distance(player.api,plan.traps['1']),second=distance(player.api,plan.traps['2']);
  return first===null||second===null||Math.abs(first-second)<1e-9?null:first<second?'1':'2';
 }
 function assignNearest(current,selected=null){
  const plan=validatePlan(current);let assigned=0,skipped=0;
  if(!plan.traps['1']||!plan.traps['2'])throw Error('Save coordinates for both Bear traps first.');
  for(const player of plan.players){
   if(!player.active||(selected?!selected.has(player.governorId):player.group!=='none'))continue;
   const group=nearestTrap(plan,player);if(group){player.group=group;assigned++;}else skipped++;
  }
  return {plan,assigned,skipped};
 }
 function travel(plan,player,group=player.group){
  if(!['1','2'].includes(group))return {seconds:null,returnSeconds:null,ring:null,source:'Unassigned',stale:false};
  const measured=player.travel[group],reference=fingerprint(plan,player,group);
  const valid=measured&&Object.keys(reference).every(k=>measured.position[k]===reference[k]);
  const d=distance(player.api,plan.traps[group]),c=plan.calibration;
  const ring=d===null?player.ring:Math.max(1,Math.ceil(d/c.cityWidthUnits));
  const estimate=d!==null?c.offsetSeconds+d/c.cityWidthUnits*c.secondsPerCityWidth:
   ring!==null?c.offsetSeconds+ring*c.secondsPerCityWidth:null;
  const seconds=valid?measured.seconds:estimate===null?null:Math.round(estimate);
  return {seconds,returnSeconds:valid?measured.returnSeconds??seconds:seconds,ring,
   source:valid?'Measured':d!==null?'Coordinate estimate':ring!==null?'Fallback ring':'Trap position needed',stale:!!measured&&!valid};
 }
 function engineName(player){
  const suffix=' · '+player.governorId;
  return player.api.name.slice(0,80-suffix.length)+suffix;
 }
 function estimate(player,bands){
  if(!Array.isArray(bands)||!bands.length)throw Error('Cannot load starting stat assumptions.');
  const band=[...bands].reverse().find(b=>player.api.townLevel>=b.town_level[0])||bands[0];
  const q=Math.max(0,Math.min(1,(player.api.power/1e6-band.power_m[0])/(band.power_m[1]-band.power_m[0]||1)));
  const value=key=>band[key][0]+q*(band[key][1]-band[key][0]),total=Math.round(value('troops'));
  const row={name:engineName(player),troops:total,infantry:Math.floor(total*.4),cavalry:Math.floor(total*.25),
   archers:total-Math.floor(total*.4)-Math.floor(total*.25),march_capacity:Math.round(value('march_capacity')),
   rally_capacity:Math.round(value('rally_capacity')),join_slots:5,host_strength:1,troop_quality:1,
   historical_score:0,power_m:player.api.power/1e6,town_level:player.api.townLevel,can_host:player.canHost,
   outbound_s:Math.round(value('travel_s')),return_s:Math.round(value('travel_s')),join_travel_s:Math.round(value('travel_s'))};
  for(const type of TYPES)Object.assign(row,{[type+'_tier']:band.tier,[type+'_quality']:1,
   [type+'_attack_bonus']:value('attack'),[type+'_lethality_bonus']:value('lethality')});
  Object.assign(row,player.stats);
  if(own(player.stats,'troops')&&!TYPES.every(t=>own(player.stats,t))){
   row.infantry=Math.floor(row.troops*.4);row.cavalry=Math.floor(row.troops*.25);row.archers=row.troops-row.infantry-row.cavalry;
  }
  row.troops=TYPES.reduce((n,t)=>n+row[t],0);
  return row;
 }
 function groupPlayers(plan,group=plan.comparisonGroup){
  return plan.players.filter(p=>p.active&&(group==='all'||p.group===group));
 }
 function compile(plan,bands){
  const players=groupPlayers(plan),rows=[],bindings={},estimated=[];
  for(const player of players){
   const row=estimate(player,bands);
   if(['1','2'].includes(plan.comparisonGroup)){
    const t=travel(plan,player,plan.comparisonGroup);
    if(t.seconds!==null){row.outbound_s=t.seconds;row.return_s=t.returnSeconds;}
   }
   if(Math.max(row.outbound_s,row.return_s,row.join_travel_s)>3600)throw Error(player.api.name+' has an estimated march over one hour. Adjust calibration or attendance.');
   rows.push(row);bindings[row.name]=player.governorId;
   if(!TYPES.every(t=>own(player.stats,t)))estimated.push(row.name);
  }
  return {roster:rows,bindings,estimated,absent:players.filter(p=>!p.attending).map(engineName)};
 }
 function joinTravelTimes(plan,rows){
  if(!['1','2'].includes(plan.comparisonGroup))return null;
  const people=new Map(plan.players.map(p=>[engineName(p),p])),matrix={};
  for(const row of rows){
   const person=people.get(row.name),values={};
   for(const host of rows){
    if(row.name===host.name)continue;
    const d=distance(person.api,people.get(host.name)?.api),c=plan.calibration;
    const seconds=own(person.stats,'join_travel_s')?person.stats.join_travel_s:d===null?row.join_travel_s:
     Math.round(c.offsetSeconds+d/c.cityWidthUnits*c.secondsPerCityWidth);
    values[host.name]=bounded(seconds,0,3600,true,'City-to-city travel');
   }
   matrix[row.name]=values;
  }
  return matrix;
 }
 const model={SCHEMA,KINGDOM,TAG,TYPES,statBounds,clone,own,id,position,hasPosition,distance,groupLabel,
  emptyPlan,validatePlan,mergeSnapshot,nearestTrap,assignNearest,fingerprint,travel,engineName,estimate,compile,groupPlayers,joinTravelTimes};
 if(typeof module!=='undefined')module.exports=model;root.BearAllianceModel=model;
})(typeof self!=='undefined'?self:globalThis);
