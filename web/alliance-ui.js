/* Cached CNQ observations stay separate from browser-local planning choices. */
'use strict';
const allianceModel=BearAllianceModel,allianceStorageKey='bear-cnq-plan-v1';
let alliancePlan=allianceModel.emptyPlan(),allianceBands=null,allianceReady=false,allianceSelected=new Set(),allianceEditing=null;
function usingAlliance(){return allianceReady&&alliancePlan.useAlliance;}
function persistAlliance(){
 try{localStorage.setItem(allianceStorageKey,JSON.stringify(alliancePlan));$('alliancesave').textContent='Saved in this browser. Download the CNQ plan to back up assignments and entered stats.';}
 catch(error){$('alliancesave').textContent='Browser saving is unavailable. Download the CNQ plan to retain your changes.';}
}
function syncAllianceRoster(){
 if(!usingAlliance())return;
 const compiled=allianceModel.compile(alliancePlan,allianceBands);
 roster=compiled.roster;absent=new Set(compiled.absent);estimatedStocks=new Set(compiled.estimated);
 synthetic=false;profileMeta=null;profileNeedsRebuild=false;fitted=null;
 editingMember=null;editingTroops=null;
 $('n').value=roster.length-absent.size;$('n').disabled=true;
 if(roster.length){renderRoster();profileTable();}
 else{$('rostertable').innerHTML='<p>No members assigned to this group. Assign members on CNQ &amp; Bear traps.</p>';$('membereditor').innerHTML='';}
 updateBadge();
}
function allianceVisiblePlayers(){
 const query=$('alliancefilter').value.trim().toLowerCase(),group=$('alliancefiltergroup').value;
 return alliancePlan.players.filter(p=>p.active&&(group==='all'||p.group===group)&&
  (p.api.name.toLowerCase().includes(query)||p.governorId.includes(query)));
}
function renderAllianceStatus(){
 const active=alliancePlan.players.filter(p=>p.active),count=group=>active.filter(p=>p.group===group).length;
 $('alliancesource').value=usingAlliance()?'cnq':'demo';$('alliancegroup').value=alliancePlan.comparisonGroup;
 $('alliancegroup').disabled=!usingAlliance()||running;
 $('alliancestatus').textContent=allianceReady?'Saved CNQ roster: '+active.length+' members · Bear trap 1: '+count('1')+' · Bear trap 2: '+count('2')+' · Unassigned: '+count('none'):'Saved CNQ roster unavailable. You can use illustrative players or load a CNQ plan.';
 $('alliancesnapshot').textContent='Kingdom 2399 · CNQ · Snapshot: '+(alliancePlan.snapshotAt?new Date(alliancePlan.snapshotAt).toLocaleString():'unavailable')+'. Positions reflect this import time; they do not update live.';
 if(usingAlliance()){
  const group=alliancePlan.comparisonGroup;
  $('advisorassumptions').textContent='CNQ · '+allianceModel.groupLabel(group)+' · '+roster.filter(m=>!absent.has(m.name)).length+' attending · troop stocks and bonuses remain estimates until entered.';
  $('alliancetravelnote').textContent=['1','2'].includes(group)?'Host travel uses the assigned trap. Joining travel uses member-to-host city distance. Estimates use the saved calibration; measured travel takes priority.':'All members / unassigned is a hypothetical single-trap scenario using each player’s starting travel assumptions. Choose Bear trap 1 or Bear trap 2 for coordinate travel.';
 }
 $('allianceselection').textContent=allianceSelected.size+' selected. '+alliancePlan.players.filter(p=>!p.active).length+' former/unavailable members retained in the saved plan.';
}
function renderAllianceMap(){
 const points=alliancePlan.players.filter(p=>p.active&&allianceModel.hasPosition(p.api)),traps=Object.entries(alliancePlan.traps).filter(([,p])=>p);
 const all=[...points.map(p=>p.api),...traps.map(([,p])=>p)];if(!all.length){$('alliancemap').innerHTML='';return;}
 const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
 const span=Math.max(20,maxX-minX,maxY-minY),X=x=>30+(x-minX)/span*540,Y=y=>330-(y-minY)/span*280;
 const color=g=>g==='1'?'#287652':g==='2'?'#8c59aa':'#97a294';
 $('alliancemap').innerHTML='<svg viewBox="0 0 620 360" role="img" aria-label="City positions; green Bear trap 1, purple Bear trap 2, gray unassigned">'+points.map(p=>'<circle cx="'+X(p.api.x)+'" cy="'+Y(p.api.y)+'" r="4" fill="'+color(p.group)+'"><title>'+esc(p.api.name+' · '+p.api.x+', '+p.api.y+' · '+allianceModel.groupLabel(p.group))+'</title></circle>').join('')+traps.map(([g,p])=>'<rect x="'+(X(p.x)-6)+'" y="'+(Y(p.y)-6)+'" width="12" height="12" fill="'+color(g)+'"/><text x="'+Math.min(480,X(p.x)+10)+'" y="'+Math.max(18,Y(p.y)-10)+'" font-size="14">'+allianceModel.groupLabel(g)+'</text>').join('')+'</svg><p class="fine">Green: Bear trap 1 · Purple: Bear trap 2 · Gray: unassigned. Hover over a city for its name and coordinates.</p>';
}
function travelCell(player,group){
 const value=allianceModel.travel(alliancePlan,player,group);
 const d=allianceModel.distance(player.api,alliancePlan.traps[group]);
 return (value.seconds===null?'—':value.seconds+'s')+'<div class="fine">'+esc(value.source)+(d===null?'':' · '+d.toFixed(1)+' units')+(value.stale?' · previous measurement expired':'')+'</div>';
}
function renderAlliance(){
 for(const group of ['1','2'])for(const axis of ['x','y'])$('trap'+group+axis).value=alliancePlan.traps[group]?.[axis]??'';
 $('citywidth').value=alliancePlan.calibration.cityWidthUnits;$('widthseconds').value=alliancePlan.calibration.secondsPerCityWidth;$('traveloffset').value=alliancePlan.calibration.offsetSeconds;
 const people=allianceVisiblePlayers();
 $('alliancetable').innerHTML=people.length?table(['Select','Attending','Member','Town Center / power','City (X, Y)','Assignment','Bear trap 1 travel','Bear trap 2 travel','Details'],people.map(p=>[
  '<input type="checkbox" data-select-governor="'+p.governorId+'" aria-label="Select '+esc(p.api.name)+'" '+(allianceSelected.has(p.governorId)?'checked':'')+'>',
  '<input type="checkbox" data-attend-governor="'+p.governorId+'" aria-label="'+esc(p.api.name)+' attending" '+(p.attending?'checked':'')+'>',
  '<b>'+esc(p.api.name)+'</b><div class="fine">Governor '+p.governorId+'</div>',
  'TC'+p.api.townLevel+' · '+(p.api.power/1e6).toFixed(1)+'M',allianceModel.hasPosition(p.api)?p.api.x+', '+p.api.y:'Unavailable',
  '<select data-group-governor="'+p.governorId+'" aria-label="'+esc(p.api.name)+' Bear trap">'+['none','1','2'].map(g=>'<option value="'+g+'" '+(p.group===g?'selected':'')+'>'+allianceModel.groupLabel(g)+'</option>').join('')+'</select>',
  travelCell(p,'1'),travelCell(p,'2'),'<button data-details-governor="'+p.governorId+'">Edit / measured travel</button>'
 ])):'<p>No members match this filter.</p>';
 for(const input of $('alliancetable').querySelectorAll('[data-select-governor]'))input.onchange=()=>{input.checked?allianceSelected.add(input.dataset.selectGovernor):allianceSelected.delete(input.dataset.selectGovernor);renderAllianceStatus();};
 for(const input of $('alliancetable').querySelectorAll('[data-attend-governor]'))input.onchange=()=>commitAlliance(plan=>{plan.players.find(p=>p.governorId===input.dataset.attendGovernor).attending=input.checked;},'Attendance changed.');
 for(const input of $('alliancetable').querySelectorAll('[data-group-governor]'))input.onchange=()=>commitAlliance(plan=>{plan.players.find(p=>p.governorId===input.dataset.groupGovernor).group=input.value;},'Bear trap assignment changed.');
 for(const button of $('alliancetable').querySelectorAll('[data-details-governor]'))button.onclick=()=>renderAllianceMember(button.dataset.detailsGovernor);
 renderAllianceStatus();renderAllianceMap();if(allianceEditing)renderAllianceMember(allianceEditing);
}
function commitAlliance(change,reason){
 if(running||!ensureSavedDrafts())return false;
 try{const next=allianceModel.clone(alliancePlan);change(next);const validated=allianceModel.validatePlan(next);if(usingAlliance())allianceModel.compile(validated,allianceBands);
  alliancePlan=validated;persistAlliance();syncAllianceRoster();renderAlliance();markResultsDirty(reason);return true;}
 catch(error){showError(error);renderAlliance();return false;}
}
function renderAllianceMember(governorId){
 const p=alliancePlan.players.find(p=>p.governorId===governorId);if(!p)return;allianceEditing=governorId;
 $('alliancemember').innerHTML='<h4>'+esc(p.api.name)+' · measured travel</h4><p class="fine">Measured times are specific to this city and trap position. Moving either makes the measurement expire.</p><div class="two">'+['1','2'].map(g=>'<fieldset><legend>'+allianceModel.groupLabel(g)+'</legend><label>Outbound seconds<input id="measured'+g+'" type="number" min="0" max="3600" step="1" value="'+(allianceModel.travel(alliancePlan,p,g).source==='Measured'?p.travel[g].seconds:'')+'"></label><label>Return seconds (optional)<input id="measuredreturn'+g+'" type="number" min="0" max="3600" step="1" value="'+(allianceModel.travel(alliancePlan,p,g).source==='Measured'?p.travel[g].returnSeconds??'':'')+'"></label></fieldset>').join('')+'</div><label>Fallback city-width ring (when city/trap coordinates are missing)<input id="fallbackring" type="number" min="1" step="1" value="'+(p.ring??'')+'"></label><div class="toolbar"><button id="savetravel">Save measured travel</button><button id="editalliancestats">Edit troops, limits &amp; bonuses</button><button id="closealliancemember">Close</button></div>';
 $('savetravel').onclick=()=>commitAlliance(plan=>{
  const player=plan.players.find(p=>p.governorId===governorId);player.ring=$('fallbackring').value===''?null:num('fallbackring');
  for(const g of ['1','2']){
   if($('measured'+g).value!==''&&!plan.traps[g])throw Error('Save '+allianceModel.groupLabel(g)+' coordinates before measuring travel.');
   player.travel[g]=$('measured'+g).value===''?null:{seconds:num('measured'+g),position:allianceModel.fingerprint(plan,player,g),...($('measuredreturn'+g).value===''?{}:{returnSeconds:num('measuredreturn'+g)})};
  }
 },'Measured travel changed.');
 $('editalliancestats').onclick=()=>{
  if(!ensureSavedDrafts())return;
  if(!roster.some(m=>m.name===allianceModel.engineName(p))){alliancePlan.useAlliance=true;alliancePlan.comparisonGroup='all';persistAlliance();syncAllianceRoster();renderAllianceStatus();}
  editingMember=allianceModel.engineName(p);renderRoster();activatePage('membertab');
 };
 $('closealliancemember').onclick=()=>{allianceEditing=null;$('alliancemember').innerHTML='';};
}
const alliancePayloadBase=payload;
payload=function(){
 const request=alliancePayloadBase();
 if(usingAlliance()){
  if(['1','2'].includes(alliancePlan.comparisonGroup)&&!alliancePlan.traps[alliancePlan.comparisonGroup])throw Error('Enter '+allianceModel.groupLabel(alliancePlan.comparisonGroup)+' coordinates on CNQ & Bear traps before comparing.');
  const matrix=allianceModel.joinTravelTimes(alliancePlan,request.roster);if(matrix)request.mechanics.join_travel_times=matrix;
 }
 return request;
};
const allianceBadgeBase=updateBadge;
updateBadge=function(){allianceBadgeBase();if(usingAlliance())$('n').disabled=true;renderAllianceStatus();};
const allianceBusyBase=busy;
busy=function(on,message=''){
 allianceBusyBase(on,message);
 for(const el of document.querySelectorAll('#alliancetab input, #alliancetab select, #alliancetab button, #alliancesource, #alliancegroup'))el.disabled=on;
 $('alliancegroup').disabled=on||!usingAlliance();if(usingAlliance()){
  $('n').disabled=true;for(const key of ['name','power_m','town_level']){const input=document.getElementById('member-'+key);if(input)input.disabled=true;}
 }
};
function recordAllianceRow(name,before=null,includeTroops=false){
 if(!usingAlliance())return;
 const player=alliancePlan.players.find(p=>allianceModel.engineName(p)===name),row=roster.find(m=>m.name===name);if(!player||!row)return;
 const next=allianceModel.clone(alliancePlan),target=next.players.find(p=>p.governorId===player.governorId);
 for(const key of Object.keys(allianceModel.statBounds)){
  if(includeTroops&&(allianceModel.TYPES.includes(key)||key==='troops'||allianceModel.TYPES.some(t=>key.startsWith(t+'_'))))target.stats[key]=row[key];
  else if(before&&row[key]!==before[key]&&!['outbound_s','return_s'].includes(key))target.stats[key]=row[key];
 }
 target.attending=!absent.has(name);target.canHost=row.can_host;
 if(before&&(row.outbound_s!==before.outbound_s||row.return_s!==before.return_s)){
  const group=next.comparisonGroup;
  if(['1','2'].includes(group)&&next.traps[group])target.travel[group]={seconds:row.outbound_s,returnSeconds:row.return_s,position:allianceModel.fingerprint(next,target,group)};
  else{target.stats.outbound_s=row.outbound_s;target.stats.return_s=row.return_s;}
 }
 alliancePlan=allianceModel.validatePlan(next);persistAlliance();renderAlliance();
}
const allianceRenderRosterBase=renderRoster;
renderRoster=function(...args){
 allianceRenderRosterBase(...args);if(!usingAlliance())return;
 for(const input of $('rostertable').querySelectorAll('[data-attend]')){const previous=input.onchange;input.onchange=()=>{previous();recordAllianceRow(roster[Number(input.dataset.attend)].name);};}
};
const allianceMemberEditorBase=renderMemberEditor;
renderMemberEditor=function(){
 allianceMemberEditorBase();if(!usingAlliance()||!roster.length)return;
 for(const key of ['name','power_m','town_level'])if($('member-'+key))$('member-'+key).disabled=true;
};
const allianceSaveMemberBase=saveMemberDetails;
saveMemberDetails=async function(){const name=editingMember,before=allianceModel.clone(roster.find(m=>m.name===name));await allianceSaveMemberBase();if($('error').style.display!=='block')recordAllianceRow(name,before);};
const allianceSaveTroopsBase=savePlayer;
savePlayer=async function(){const name=$('troopplayer').value;await allianceSaveTroopsBase();if($('error').style.display!=='block')recordAllianceRow(name,null,true);};
$('applystock').onclick=savePlayer;
const allianceEstimateBase=estimatePlayerStock;
estimatePlayerStock=function(){
 const name=$('troopplayer').value;allianceEstimateBase();
 if(usingAlliance()&&$('error').style.display!=='block'){const row=roster.find(m=>m.name===name),p=alliancePlan.players.find(p=>allianceModel.engineName(p)===name);
  if(p&&row){for(const type of allianceModel.TYPES)delete p.stats[type];p.stats.troops=row.troops;persistAlliance();renderAlliance();}
 }
};
$('estimatepower').onclick=estimatePlayerStock;
const allianceFitBase=$('applyfit').onclick;
$('applyfit').onclick=()=>{const before=allianceModel.clone(roster);allianceFitBase();if(usingAlliance()&&$('error').style.display!=='block')for(const row of before)recordAllianceRow(row.name,row);};
const allianceProjectBase=allianceProjectSnapshot;
allianceProjectSnapshot=function(){return {...allianceProjectBase(),alliancePlan:allianceModel.validatePlan(alliancePlan)};};
const allianceGenerateBase=generate;
generate=async function(){
 if(running||!ensureSavedDrafts())return false;
 const previousSource=alliancePlan.useAlliance;alliancePlan.useAlliance=false;
 const success=await allianceGenerateBase();
 if(!success)alliancePlan.useAlliance=previousSource;
 if(success){alliancePlan.useAlliance=false;persistAlliance();$('n').disabled=false;renderAllianceStatus();}
 return success;
};
const allianceDemoButtonBase=$('generate').onclick;
$('generate').onclick=async()=>{
 const restoreSource=usingAlliance();await allianceDemoButtonBase();
 const undo=document.getElementById('undodemo');
 if(restoreSource&&undo){const previous=undo.onclick;undo.onclick=async()=>{alliancePlan.useAlliance=true;persistAlliance();await previous();renderAllianceStatus();};}
};
// A normal JSON/CSV load switches to its own roster; a saved CNQ project restores stable IDs.
for(const id of ['projectfile','rosterfile']){
 const previous=$(id).onchange;
 $(id).onchange=async event=>{
  if(running||!ensureSavedDrafts()||!event.target.files?.length)return;
  const oldPlan=allianceModel.clone(alliancePlan);
  try{
   const project=id==='projectfile'?JSON.parse(await event.target.files[0].text()):null;
   if(project?.alliancePlan){alliancePlan=allianceModel.validatePlan(project.alliancePlan);allianceReady=!!allianceBands;}
   else alliancePlan.useAlliance=false;
   // The existing loader runs comparisons; supply the freshly compiled group roster first.
   if(project?.alliancePlan&&alliancePlan.useAlliance){
    const c=allianceModel.compile(alliancePlan,allianceBands);project.roster=c.roster;project.absent=c.absent;project.estimatedStocks=c.estimated;project.synthetic=false;
    await previous({target:{files:[{text:async()=>JSON.stringify(project)}],value:''}});
   }else await previous(event);
   if($('error').style.display==='block')alliancePlan=oldPlan;
   else{persistAlliance();if(usingAlliance())syncAllianceRoster();}
  }catch(error){alliancePlan=oldPlan;showError(error);}
  event.target.value='';renderAlliance();
 };
}
async function loadCachedAlliance(){
 const response=await fetch('./data/alliance-api.json',{cache:'no-store'});if(!response.ok)throw Error('Cannot read the saved CNQ import.');
 alliancePlan=allianceModel.mergeSnapshot(alliancePlan,await response.json());allianceReady=true;persistAlliance();
}
async function initializeAlliance(){
 try{const response=await fetch('./alliance-profiles.json');if(!response.ok)throw Error('Cannot load starting assumptions.');allianceBands=(await response.json()).bands;
  const saved=localStorage.getItem(allianceStorageKey);if(saved)alliancePlan=allianceModel.validatePlan(JSON.parse(saved));
 }catch(error){$('alliancesave').textContent='Could not restore browser data: '+error.message+'. You can load a downloaded CNQ plan.';}
 try{if(!allianceBands)throw Error('Starting assumptions unavailable.');await loadCachedAlliance();renderAlliance();
  if(usingAlliance()){syncAllianceRoster();await run();}else await generate();
 }catch(error){allianceReady=!!allianceBands&&alliancePlan.players.some(p=>p.active);renderAlliance();
  if(usingAlliance()){syncAllianceRoster();await run();}else await generate();
 }
}
$('openalliance').onclick=()=>activatePage('alliancetab');
$('alliancesource').onchange=async()=>{
 if(running||!ensureSavedDrafts())return;
 if($('alliancesource').value==='cnq'){
  if(!allianceReady){showError(Error('The CNQ import is unavailable. Reload the saved import or load a CNQ plan.'));renderAllianceStatus();return;}
  alliancePlan.useAlliance=true;persistAlliance();syncAllianceRoster();renderAlliance();markResultsDirty('CNQ roster selected.');await run();
 }else await generate();
};
$('alliancegroup').onchange=async()=>{if(commitAlliance(p=>{p.comparisonGroup=$('alliancegroup').value;},'Comparison group changed.'))await run();};
$('trapform').onsubmit=event=>{event.preventDefault();commitAlliance(plan=>{
 for(const g of ['1','2']){
  const x=$('trap'+g+'x').value,y=$('trap'+g+'y').value;
  if((x==='')!==(y===''))throw Error('Enter both X and Y for '+allianceModel.groupLabel(g)+'.');
  plan.traps[g]=x===''?null:{x:Number(x),y:Number(y)};
 }
 plan.calibration={cityWidthUnits:num('citywidth'),secondsPerCityWidth:num('widthseconds'),offsetSeconds:num('traveloffset')};
},'Trap coordinates or travel calibration changed.');};
$('alliancefilter').oninput=renderAlliance;$('alliancefiltergroup').onchange=renderAlliance;
$('allselect').onclick=()=>{for(const p of allianceVisiblePlayers())allianceSelected.add(p.governorId);renderAlliance();};
$('allclear').onclick=()=>{allianceSelected.clear();renderAlliance();};
$('bulkassign').onclick=()=>commitAlliance(plan=>{for(const p of plan.players)if(p.active&&allianceSelected.has(p.governorId))p.group=$('bulkgroup').value;},'Bulk assignments changed.');
function assignAllianceNearest(selected){
 if(running||!ensureSavedDrafts())return;
 try{const next=allianceModel.assignNearest(alliancePlan,selected);alliancePlan=next.plan;persistAlliance();syncAllianceRoster();renderAlliance();markResultsDirty('Nearest trap assignments changed.');$('allianceselection').textContent=next.assigned+' assigned; '+next.skipped+' skipped (missing coordinates or equal distances). Existing assignments are kept unless selected.';}
 catch(error){showError(error);}
}
$('nearestassign').onclick=()=>assignAllianceNearest(null);$('selectednearest').onclick=()=>assignAllianceNearest(allianceSelected);
$('exportalliance').onclick=()=>download('CNQ-bear-trap-plan.json',JSON.stringify(allianceModel.validatePlan(alliancePlan),null,2),'application/json');
$('importalliance').onclick=()=>$('alliancefile').click();
$('alliancefile').onchange=async event=>{
 if(running||!ensureSavedDrafts()||!event.target.files?.length)return;
 try{const next=allianceModel.validatePlan(JSON.parse(await event.target.files[0].text()));if(!allianceBands)throw Error('Reload the page to load starting assumptions.');
  alliancePlan=next;allianceReady=true;allianceSelected.clear();persistAlliance();syncAllianceRoster();renderAlliance();markResultsDirty('CNQ plan loaded.');if(usingAlliance())await run();
 }catch(error){showError(error);}event.target.value='';
};
$('reloadsnapshot').onclick=async()=>{
 if(running||!ensureSavedDrafts())return;
 try{await loadCachedAlliance();syncAllianceRoster();renderAlliance();markResultsDirty('Saved import reloaded.');$('alliancesnapshot').textContent+=' Assignments, entered stats and measured travel were preserved by governor ID.';}
 catch(error){showError(error);}
};
initializeAlliance();
