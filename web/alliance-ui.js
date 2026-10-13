/* UI bridge for the published CNQ snapshot. API credentials never enter this app. */
(function(){
 'use strict';
 const M=globalThis.BearAllianceModel,KEY='BearTrapOptimizer:CNQ:2399:plan:v1';
 const state={plan:M.emptyPlan(),bands:null,mode:'cnq',filter:'all',page:0,selected:new Set(),compiled:null,editorId:null,pending:false,started:false};
 const active=()=>state.mode==='cnq',members=()=>state.plan.players.filter(p=>p.active);
 const date=value=>value?new Date(typeof value==='number'?value*1000:value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not imported';
 const notice=(message,error=false)=>{$('alliancestatus').textContent=message;$('alliancestatus').classList.toggle('problem',error);};
 function persist(){
  state.plan.useAlliance=active();
  try{localStorage.setItem(KEY,JSON.stringify(M.validatePlan(state.plan)));}
  catch(error){$('alliancesavenote').textContent='Browser saving is unavailable. Export the alliance plan to keep your changes.';}
 }
 function capture(){
  if(!active()||!state.compiled)return;
  const next=M.clone(state.plan),people=new Map(next.players.map(p=>[p.governorId,p]));
  const previous=new Map(state.compiled.roster.map(r=>[r.name,r]));
  for(const row of roster){
   const person=people.get(state.compiled.bindings[row.name]),before=previous.get(row.name);
   if(!person||!before)continue;
   person.attending=!absent.has(row.name);person.canHost=!!row.can_host;
   for(const key of Object.keys(M.statBounds)){
    if(row[key]===before[key])continue;
    if(['outbound_s','return_s'].includes(key)&&['1','2'].includes(next.comparisonGroup)){
     const group=next.comparisonGroup,t=M.travel(next,person,group);
     person.travel[group]={seconds:key==='outbound_s'?row[key]:t.seconds??before.outbound_s,
      returnSeconds:key==='return_s'?row[key]:t.returnSeconds??before.return_s,position:M.fingerprint(next,person,group)};
    }else person.stats[key]=row[key];
   }
   if(!estimatedStocks.has(row.name)&&M.TYPES.every(t=>row[t]!=null)){
    for(const type of M.TYPES)person.stats[type]=row[type];
    if(M.own(person.stats,'troops'))person.stats.troops=M.TYPES.reduce((n,t)=>n+row[t],0);
   }
  }
  state.plan=M.validatePlan(next);persist();
 }
 function rebuild(reason){
  const compiled=M.compile(state.plan,state.bands);
  state.compiled=M.clone(compiled);roster=compiled.roster;absent=new Set(compiled.absent);
  estimatedStocks=new Set(compiled.estimated);synthetic=false;profileMeta=null;profileNeedsRebuild=false;
  fitted=null;editingMember=null;editingTroops=null;$('memberfilter').value='';
  $('simpleprofile').value='cnq';renderRoster();updateBadge();profileTable();
  if(reason)markResultsDirty(reason);
  if(!roster.some(r=>!absent.has(r.name)))clearComparison();
 }
 function clearComparison(){
  result=null;searchData=null;resultsDirty=false;chosen=0;
  $('alliancechart').innerHTML='<div class="empty">Assign attending members to '+esc(M.groupLabel(state.plan.comparisonGroup))+' in Roster &amp; traps to compare this group.</div>';
  $('legend').innerHTML='';$('comparisontable').innerHTML='';$('planbrief').innerHTML='';
  $('openinggroups').innerHTML='';$('leaderroles').innerHTML='';$('selectedname').textContent='Choose attending members';
  $('selecteddescription').textContent='Each comparison uses one group of players.';
  $('status').textContent='This group has no attending players.';updateActionAvailability();availability();
 }
 function context(){
  const count=roster.filter(r=>!absent.has(r.name)).length,total=members().length;
  $('rostersource').value=state.mode;$('comparegroupwrap').hidden=!active();
  $('comparegroup').value=state.plan.comparisonGroup;
  $('alliancecontextlabel').textContent=active()?'CNQ · Kingdom 2399':'Illustrative alliance';
  $('alliancesummary').textContent=active()?count+' attending · '+M.groupLabel(state.plan.comparisonGroup)+
   (['all','none'].includes(state.plan.comparisonGroup)?' · travel assumed until comparing a trap':' · assigned members only')+
   ' · snapshot '+date(state.plan.snapshotAt):'Example or manually entered players. Your CNQ assignments are saved separately.';
  $('allianceopen').textContent='CNQ roster & traps · '+total;
  if(active()){
   $('simpleprofile').value='cnq';$('n').value=count;$('n').disabled=true;$('simpleprofile').disabled=true;
   $('advisorassumptions').textContent='CNQ: observed TC & power · '+estimatedStocks.size+
    ' troop stocks estimated · capacities and Attack/Lethality are starting estimates unless entered.';
  }
  $('alliancedatainfo').textContent=total+' members · snapshot '+date(state.plan.snapshotAt)+' · assignments saved on this device';
 }
 function availability(){
  const locked=running||state.pending;
  for(const id of ['rostersource','comparegroup','alliancerefresh','allianceimport','applyalliancebulk','assignnearest',
   'savetrappositions','savecalibration','savealliancemember','allianceexport'])$(id).disabled=locked;
  for(const input of $('alliancetrapform').querySelectorAll('input'))input.disabled=locked;
  for(const input of $('alliancememberform').querySelectorAll('input,select'))input.disabled=locked;
  for(const id of ['membermeasuredtravel','membermeasuredreturn'])$(id).disabled=locked||!['1','2'].includes($('membertrap').value);
  for(const id of ['citywidth','cityseconds','traveloffset'])$(id).disabled=locked;
  $('applyalliancebulk').disabled=locked||!state.selected.size;
  $('assignnearest').disabled=locked||!state.plan.traps['1']||!state.plan.traps['2'];
  for(const group of ['1','2'])$('comparetrap'+group).disabled=locked||!members().some(p=>p.group===group&&p.attending);
  if(active()&&!roster.some(r=>!absent.has(r.name)))$('recommend').disabled=true;
 }
 function matches(){
  const query=$('alliancemembersearch').value.trim().toLowerCase();
  return members().filter(p=>(state.filter==='all'||p.group===state.filter)&&
   (!query||p.api.name.toLowerCase().includes(query)||p.governorId.includes(query)))
   .sort((a,b)=>b.api.power-a.api.power||a.governorId.localeCompare(b.governorId));
 }
 function renderMap(){
  const people=members().filter(p=>M.hasPosition(p.api)),traps=['1','2'].filter(g=>state.plan.traps[g]);
  const points=[...people.map(p=>p.api),...traps.map(g=>state.plan.traps[g])];
  if(!points.length){$('alliancemap').innerHTML='<p class="fine">No saved positions available.</p>';return;}
  const xmin=Math.min(...points.map(p=>p.x)),xmax=Math.max(...points.map(p=>p.x));
  const ymin=Math.min(...points.map(p=>p.y)),ymax=Math.max(...points.map(p=>p.y));
  const range=Math.max(20,xmax-xmin,ymax-ymin),cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  const X=x=>36+((x-cx)/range+.5)*328,Y=y=>364-((y-cy)/range+.5)*328;
  let svg='<svg viewBox="0 0 400 400" role="img" aria-label="CNQ city and Bear trap coordinates">';
  for(let i=0;i<=4;i++){
   const x=cx-range/2+range*i/4,y=cy-range/2+range*i/4;
   svg+='<path d="M'+X(x)+' 36V364 M36 '+Y(y)+'H364" fill="none" stroke="#dce6d5"/>'+
    '<text x="'+X(x)+'" y="384" text-anchor="middle" fill="#68776d" font-size="10">'+Math.round(x)+'</text>'+
    '<text x="30" y="'+(Y(y)+3)+'" text-anchor="end" fill="#68776d" font-size="10">'+Math.round(y)+'</text>';
  }
  for(const p of people){
   const color=p.group==='1'?'#357052':p.group==='2'?'#785798':'#8b968c',selected=state.selected.has(p.governorId);
   svg+='<circle data-map-member="'+p.governorId+'" tabindex="0" role="button" aria-label="Select '+esc(p.api.name)+'" cx="'+X(p.api.x)+'" cy="'+Y(p.api.y)+'" r="'+(selected?7:5)+'" fill="'+color+'" stroke="'+(selected?'#c18730':'white')+'" stroke-width="'+(selected?3:1)+'"><title>'+esc(p.api.name)+' · '+p.api.x+', '+p.api.y+' · '+M.groupLabel(p.group)+'</title></circle>';
  }
  for(const g of traps){
   const t=state.plan.traps[g],x=X(t.x),y=Y(t.y);
   svg+='<path d="M'+x+' '+(y-10)+'l10 10 -10 10 -10 -10Z" fill="'+(g==='1'?'#245d43':'#785798')+'" stroke="white" stroke-width="2"/><text x="'+(x+12)+'" y="'+(y+4)+'" fill="#173c35" font-size="11" font-weight="bold">Trap '+g+'</text>';
  }
  $('alliancemap').innerHTML=svg+'</svg>';$('alliancepositioncount').textContent=people.length+' positions';
 }
 function render(){
  const filtered=matches();state.page=Math.min(state.page,Math.max(0,Math.ceil(filtered.length/15)-1));
  const rows=filtered.slice(state.page*15,state.page*15+15);
  $('alliancerows').innerHTML=rows.map(p=>{
   const t=M.travel(state.plan,p),position=M.hasPosition(p.api)?p.api.x+', '+p.api.y:'Position missing';
   return '<tr class="'+(state.selected.has(p.governorId)?'picked':'')+'"><td><input type="checkbox" data-pick-member="'+p.governorId+'" aria-label="Select '+esc(p.api.name)+'" '+(state.selected.has(p.governorId)?'checked':'')+'></td><td><button type="button" class="member-name" data-edit-alliance="'+p.governorId+'">'+esc(p.api.name)+'</button><div class="fine">TC'+p.api.townLevel+' · '+fmt(p.api.power)+' power<br>ID '+p.governorId+' · '+position+'</div></td><td>'+M.groupLabel(p.group)+'<div class="fine">'+(p.canHost?'May start rallies':'Join only')+'</div></td><td>'+(t.ring===null?'—':'Ring '+t.ring)+(t.seconds===null?'':' · '+t.seconds+'s')+'<div class="fine">'+esc(t.source)+(t.stale?' · old measurement':'')+'</div></td><td><input type="checkbox" data-alliance-attend="'+p.governorId+'" aria-label="'+esc(p.api.name)+' attending" '+(p.attending?'checked':'')+' '+(running?'disabled':'')+'></td></tr>';
  }).join('')||'<tr><td colspan="5">No matching members.</td></tr>';
  $('alliancepicked').textContent=state.selected.size+' selected';
  $('selectedgovernorids').value=[...state.selected].join(',');
  $('selectallmembers').textContent='Select all '+filtered.length;
  $('selectmemberpage').checked=!!rows.length&&rows.every(p=>state.selected.has(p.governorId));
  $('selectmemberpage').indeterminate=rows.some(p=>state.selected.has(p.governorId))&&!$('selectmemberpage').checked;
  $('allianceprev').disabled=state.page===0;$('alliancenext').disabled=(state.page+1)*15>=filtered.length;
  $('alliancememberpage').textContent=filtered.length?(state.page*15+1)+'–'+(state.page*15+rows.length)+' of '+filtered.length:'0 members';
  $('assignnearest').textContent=state.selected.size?'Assign selected members to nearest trap':'Assign unassigned members to nearest trap';
  for(const button of $('alliancedialog').querySelectorAll('[data-alliance-group]')){
   const g=button.dataset.allianceGroup,n=members().filter(p=>g==='all'||p.group===g).length;
   button.textContent=M.groupLabel(g)+' · '+n;button.setAttribute('aria-pressed',String(g===state.filter));
  }
  for(const g of ['1','2']){
   const assigned=members().filter(p=>p.group===g);
   $('trapcount'+g).textContent=assigned.length+' members assigned · '+assigned.filter(p=>p.attending).length+' attending';
  }
  const departed=state.plan.players.filter(p=>!p.active).length;
  $('alliancedeparted').textContent=departed?departed+' departed members retained in the plan. They are excluded from comparisons.':'';
  context();renderMap();availability();
 }
 function settings(){
  for(const g of ['1','2'])for(const axis of ['x','y'])$('trap'+axis+g).value=state.plan.traps[g]?.[axis]??'';
  $('citywidth').value=state.plan.calibration.cityWidthUnits;$('cityseconds').value=state.plan.calibration.secondsPerCityWidth;
  $('traveloffset').value=state.plan.calibration.offsetSeconds;$('comparegroup').value=state.plan.comparisonGroup;
 }
 function change(next,message){
  if(running||state.pending||!ensureSavedDrafts())return false;
  const validated=M.validatePlan(next);
  if(active())M.compile(validated,state.bands);
  state.plan=validated;persist();
  if(active())rebuild(message);
  render();notice(message);return true;
 }
 function closeEditor(){$('alliancemembereditor').hidden=true;state.editorId=null;}
 function openEditor(id){
  const person=state.plan.players.find(p=>p.governorId===id);if(!person)return;
  state.editorId=id;$('allianceeditorname').textContent=person.api.name+' · Governor '+id;
  $('allianceeditorobserved').textContent='API: TC'+person.api.townLevel+' · '+fmt(person.api.power)+' account power · city '+
   (M.hasPosition(person.api)?person.api.x+', '+person.api.y:'unavailable')+(person.api.troopPower!==null?' · '+fmt(person.api.troopPower)+' troop power':'');
  $('membertrap').value=person.group;$('memberring').value=person.ring??'';$('memberattending').checked=person.attending;$('membercanhost').checked=person.canHost;
  syncMeasurement(person);
  const estimate=M.estimate(person,state.bands);
  const definitions=[['troops','Usable total stock'],['infantry','Infantry count'],['cavalry','Cavalry count'],['archers','Archer count'],
   ['march_capacity','Maximum march'],['rally_capacity','Rally capacity'],['join_slots','Joining marches'],
   ['join_travel_s','Override joining travel (seconds)'],
   ...M.TYPES.flatMap(t=>[[t+'_tier',t+' tier'],[t+'_attack_bonus',t+' Attack (%)'],[t+'_lethality_bonus',t+' Lethality (%)']])];
  $('alliancestateditor').innerHTML=definitions.map(([key,label])=>{
   const [min,max,whole]=M.statBounds[key];
   return '<label>'+esc(label)+'<input data-alliance-stat="'+key+'" type="number" min="'+min+'" max="'+max+'" step="'+(whole?'1':'.1')+'" value="'+(person.stats[key]??'')+'" placeholder="Estimate: '+Number(estimate[key].toFixed(1))+'"></label>';
  }).join('');
  $('alliancemembereditor').hidden=false;availability();$('alliancemembereditor').scrollIntoView({block:'nearest'});
 }
 function syncMeasurement(person){
  const g=$('membertrap').value,measured=person.travel[g];
  const stale=M.travel(state.plan,person,g).stale;
  $('membermeasuredtravel').value=stale?'':measured?.seconds??'';$('membermeasuredreturn').value=stale?'':measured?.returnSeconds??'';
  $('membermeasuredtravel').placeholder=stale?'Position changed; remeasure (was '+measured.seconds+'s)':'Use estimate';
  $('membermeasuredreturn').placeholder=stale?'Position changed; remeasure':'Same as outbound';
  state.measurementOriginal={seconds:$('membermeasuredtravel').value,back:$('membermeasuredreturn').value};
  $('membermeasuredtravel').disabled=!['1','2'].includes(g);$('membermeasuredreturn').disabled=!['1','2'].includes(g);
 }
 function open(){
  if(!ensureSavedDrafts())return;
  capture();if($('setupdialog').open)closePlanSettings();render();settings();
  if(!$('alliancedialog').open)$('alliancedialog').showModal();
  history.replaceState(null,'','#roster');
 }
 function close(){
  $('alliancedialog').close();history.replaceState(null,'',location.pathname+location.search);
 }
 async function scope(group){
  if(running||state.pending||!ensureSavedDrafts())return;
  capture();state.plan.comparisonGroup=group;state.mode='cnq';persist();rebuild('Comparison group changed.');render();
  if(roster.some(m=>!absent.has(m.name)))await run();
 }
 async function source(mode){
  if(running||state.pending||!ensureSavedDrafts())return;
  capture();state.mode=mode;persist();
  if(mode==='cnq'){rebuild('CNQ roster selected.');render();if(roster.some(m=>!absent.has(m.name)))await run();}
  else{$('simpleprofile').value='top_four';synthetic=true;$('n').value=Math.min(100,Math.max(2,num('n')||40));await generate();render();}
 }
 async function refresh(){
  if(running||state.pending||!ensureSavedDrafts())return;
  capture();state.pending=true;availability();notice('Reading the published snapshot. No MightPulse requests are made.');
  try{
   const response=await fetch('./data/alliance-api.json',{cache:'no-store'});
   if(!response.ok)throw Error('Saved CNQ data is unavailable. Run the owner import, then try again.');
   const incoming=await response.json(),next=M.mergeSnapshot(state.plan,incoming,state.selected.size?state.selected:null);
   state.pending=false;change(next,'Updated saved observations; assignments and measured values retained.');settings();closeEditor();
   if(active()&&roster.some(m=>!absent.has(m.name)))await run();
  }catch(error){state.pending=false;notice(error.message,true);availability();}
 }
 function snapshot(){capture();return M.validatePlan(state.plan);}
 function exportPlan(){
  if(!ensureSavedDrafts())return;
  try{
   const file=allianceProjectSnapshot();file.alliancePlan=snapshot();file.alliancePlan.useAlliance=true;
   download('CNQ-bear-alliance-plan.json',JSON.stringify(file,null,2),'application/json');
   notice('Exported assignments, trap positions, measured values and added strategies.');
  }catch(error){notice(error.message,true);}
 }
 async function importPlan(file){
  if(running||!ensureSavedDrafts())return;
  if(file.size>2e6)throw Error('Choose a plan smaller than 2 MB.');
  const raw=JSON.parse(await file.text()),plan=M.validatePlan(raw.alliancePlan||raw);
  const strategies=raw.addedStrategies===undefined?M.clone(addedStrategies):validateStrategySnapshots(raw.addedStrategies);
  const backup={plan:state.plan,mode:state.mode,compiled:state.compiled,roster:M.clone(roster),absent:[...absent],
   estimated:[...estimatedStocks],synthetic,result,searchData,chosen,visible:[...visible],added:M.clone(addedStrategies),
   resultsDirty,dirtyReason,profileMeta,profileNeedsRebuild,fitted,editingMember,editingTroops,selected:[...state.selected],
   error:$('error').textContent,errorDisplay:$('error').style.display,status:$('status').textContent,
   controls:Object.fromEntries(controls.map(k=>[k,$(k).type==='checkbox'?$(k).checked:$(k).value])),reports:$('reports').value};
  try{
   state.plan=plan;state.mode=plan.useAlliance?'cnq':'demo';state.selected.clear();addedStrategies=strategies;
   for(const [key,value]of Object.entries(raw.controls||{}))if(controls.includes(key))$(key).type==='checkbox'?$(key).checked=!!value:$(key).value=value;
   if(raw.reports!==undefined)$('reports').value=String(raw.reports);
   if(active())rebuild('Alliance plan imported.');
   else{if(!Array.isArray(raw.roster)||!raw.roster.length)throw Error('The saved demo roster is missing.');roster=M.clone(raw.roster);absent=new Set(raw.absent||[]);estimatedStocks=new Set(raw.estimatedStocks||[]);synthetic=!!raw.synthetic;}
   if(roster.some(m=>!absent.has(m.name))&&!await run())throw Error($('error').textContent||'Cannot compare the imported plan.');
   persist();settings();render();renderAddedStrategies();closeEditor();notice('Imported the alliance plan. Assignments and measured values restored.');
  }catch(error){
   state.plan=backup.plan;state.mode=backup.mode;state.compiled=backup.compiled;roster=backup.roster;
   absent=new Set(backup.absent);estimatedStocks=new Set(backup.estimated);synthetic=backup.synthetic;
   result=backup.result;searchData=backup.searchData;chosen=backup.chosen;visible=new Set(backup.visible);addedStrategies=backup.added;
   resultsDirty=backup.resultsDirty;dirtyReason=backup.dirtyReason;profileMeta=backup.profileMeta;profileNeedsRebuild=backup.profileNeedsRebuild;
   fitted=backup.fitted;editingMember=backup.editingMember;editingTroops=backup.editingTroops;state.selected=new Set(backup.selected);
   for(const [k,v]of Object.entries(backup.controls))$(k).type==='checkbox'?$(k).checked=v:$(k).value=v;
   $('reports').value=backup.reports;renderRoster();if(result)renderResults();renderAddedStrategies();render();settings();persist();
   $('error').textContent=backup.error;$('error').style.display=backup.errorDisplay;$('status').textContent=backup.status;
   throw error;
  }
 }
 function install(){
  const badge=updateBadge;updateBadge=function(){badge();context();availability();};
  const priorBusy=busy;busy=function(on,text){priorBusy(on,text);availability();};
  const request=payload;payload=function(){
   capture();const p=request();
   if(active()){const times=M.joinTravelTimes(state.plan,p.roster);if(times)p.travel_times=times;}
   return p;
  };
  const memberEditor=renderMemberEditor;renderMemberEditor=function(){memberEditor();if(active())for(const k of ['name','town_level','power_m'])if($('member-'+k))$('member-'+k).readOnly=true;};
  const demo=generate;generate=async function(){if(active()){capture();state.mode='demo';if($('simpleprofile').value==='cnq')$('simpleprofile').value='top_four';persist();}return demo();};
  const legacyFile=$('projectfile').onchange;
  $('projectfile').onchange=async event=>{
   const file=event.target.files?.[0];if(!file)return;
   try{
    if(file.size>2e6)throw Error('Choose a plan smaller than 2 MB.');
    const j=JSON.parse(await file.text());
    if(j.alliancePlan||j.schema===M.SCHEMA){await importPlan(file);event.target.value='';return;}
   }catch(error){showError(error);event.target.value='';return;}
   const previous=state.mode;state.mode='demo';await legacyFile(event);
   if($('error').style.display==='block')state.mode=previous;persist();render();
  };
  const csvFile=$('rosterfile').onchange;$('rosterfile').onchange=async event=>{
   const previous=state.mode;state.mode='demo';await csvFile(event);
   if($('error').style.display==='block')state.mode=previous;persist();render();
  };
  $('allianceopen').onclick=open;$('allianceclose').onclick=close;
  $('alliancedialog').addEventListener('close',()=>{if(location.hash==='#roster')history.replaceState(null,'',location.pathname+location.search);});
  $('rostersource').onchange=()=>source($('rostersource').value).catch(error=>notice(error.message,true));
  $('comparegroup').onchange=()=>scope($('comparegroup').value).catch(error=>notice(error.message,true));
  for(const g of ['1','2'])$('comparetrap'+g).onclick=async()=>{await scope(g);if($('error').style.display!=='block'&&roster.length)close();};
  $('alliancerefresh').onclick=refresh;$('allianceexport').onclick=exportPlan;
  $('allianceimport').onclick=()=>{$('alliancefile').click();};
  $('alliancefile').onchange=async e=>{try{if(e.target.files?.[0])await importPlan(e.target.files[0]);}catch(error){notice('Plan not loaded. '+error.message,true);}e.target.value='';};
  for(const b of $('alliancedialog').querySelectorAll('[data-alliance-group]'))b.onclick=()=>{state.filter=b.dataset.allianceGroup;state.page=0;render();};
  $('alliancemembersearch').oninput=()=>{state.page=0;render();};
  $('selectallmembers').onclick=()=>{for(const p of matches())state.selected.add(p.governorId);render();};
  $('clearmemberselection').onclick=()=>{state.selected.clear();render();};
  $('selectmemberpage').onchange=()=>{for(const p of matches().slice(state.page*15,state.page*15+15))$('selectmemberpage').checked?state.selected.add(p.governorId):state.selected.delete(p.governorId);render();};
  $('allianceprev').onclick=()=>{state.page--;render();};$('alliancenext').onclick=()=>{state.page++;render();};
  $('alliancerows').onchange=e=>{
   const pick=e.target.dataset.pickMember,attendance=e.target.dataset.allianceAttend;
   if(pick){e.target.checked?state.selected.add(pick):state.selected.delete(pick);render();}
   if(attendance){capture();const next=M.clone(state.plan);next.players.find(p=>p.governorId===attendance).attending=e.target.checked;change(next,'Attendance changed.');}
  };
  $('alliancerows').onclick=e=>{const button=e.target.closest('[data-edit-alliance]');if(button)openEditor(button.dataset.editAlliance);};
  function selectMap(e){
   const city=e.target.closest('[data-map-member]');if(!city)return;
   const id=city.dataset.mapMember;state.selected.has(id)?state.selected.delete(id):state.selected.add(id);render();
  }
  $('alliancemap').onclick=selectMap;$('alliancemap').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectMap(e);}};
  $('applyalliancebulk').onclick=()=>{
   try{
    capture();const next=M.clone(state.plan),group=$('bulkgroup').value,attendance=$('bulkattendance').value,role=$('bulkrole').value;
    if([group,attendance,role].every(v=>v==='keep')){notice('Choose a trap, attendance or role to apply.');return;}
    for(const p of next.players)if(state.selected.has(p.governorId)){
     if(group!=='keep')p.group=group;if(attendance!=='keep')p.attending=attendance==='yes';if(role!=='keep')p.canHost=role==='yes';
    }
    if(change(next,'Updated '+state.selected.size+' selected members.')){state.selected.clear();render();}
   }catch(error){notice(error.message,true);}
  };
  $('assignnearest').onclick=()=>{
   try{capture();const result=M.assignNearest(state.plan,state.selected.size?state.selected:null);change(result.plan,'Assigned '+result.assigned+' members.'+(result.skipped?' '+result.skipped+' need a position or a choice between equally near traps.':''));}
   catch(error){notice(error.message,true);}
  };
  $('alliancetrapform').onsubmit=e=>{
   e.preventDefault();
   try{
    capture();const next=M.clone(state.plan);
    for(const g of ['1','2']){const x=$('trapx'+g).value,y=$('trapy'+g).value;if((x==='')!==(y===''))throw Error('Enter both X and Y for '+M.groupLabel(g)+'.');next.traps[g]=x===''?null:{x:Number(x),y:Number(y)};}
    change(next,'Trap coordinates saved. Assignments retained; distances recalculated.');settings();
   }catch(error){notice(error.message,true);}
  };
  $('savecalibration').onclick=()=>{
   try{capture();const next=M.clone(state.plan);next.calibration={cityWidthUnits:num('citywidth'),secondsPerCityWidth:num('cityseconds'),offsetSeconds:num('traveloffset')};change(next,'Timing calibration saved. Measured travel remains separate.');}
   catch(error){notice(error.message,true);}
  };
  $('membertrap').onchange=()=>{const p=state.plan.players.find(p=>p.governorId===state.editorId);if(p)syncMeasurement(p);};
  $('closealliancemember').onclick=closeEditor;
  $('alliancememberform').onsubmit=e=>{
   e.preventDefault();
   try{
    capture();const next=M.clone(state.plan),p=next.players.find(p=>p.governorId===state.editorId);if(!p)return;
    p.group=$('membertrap').value;p.ring=$('memberring').value===''?null:num('memberring');
    p.attending=$('memberattending').checked;p.canHost=$('membercanhost').checked;
    for(const input of $('alliancestateditor').querySelectorAll('[data-alliance-stat]')){
     if(input.value==='')delete p.stats[input.dataset.allianceStat];else p.stats[input.dataset.allianceStat]=Number(input.value);
    }
    if(['1','2'].includes(p.group)){
     const seconds=$('membermeasuredtravel').value,back=$('membermeasuredreturn').value;
     if(seconds===''&&back!=='')throw Error('Enter outbound travel before a measured return.');
     if(seconds!==state.measurementOriginal?.seconds||back!==state.measurementOriginal?.back)
      p.travel[p.group]=seconds===''?null:{seconds:Number(seconds),...(back===''?{}:{returnSeconds:Number(back)}),position:M.fingerprint(next,p,p.group)};
    }
    if(change(next,'Saved measured values for '+p.api.name+'.'))closeEditor();
   }catch(error){notice(error.message,true);}
  };
 }
 async function start(){
  if(state.started)return;state.started=true;install();busy(true,'Loading CNQ’s saved roster…');
  let restored=false;
  try{const saved=localStorage.getItem(KEY);if(saved){state.plan=M.validatePlan(JSON.parse(saved));state.mode=state.plan.useAlliance?'cnq':'demo';restored=true;}}
  catch(error){notice('The saved local plan could not be read. Import an exported copy to restore it.',true);}
  try{
   const [data,profiles]=await Promise.all([
    fetch('./data/alliance-api.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('The saved roster is not available yet.');return r.json();}),
    fetch('./alliance-profiles.json').then(r=>{if(!r.ok)throw Error('Cannot load initial stat estimates.');return r.json();}).then(profiles=>{state.bands=profiles.bands;return profiles;})
   ]);
   state.bands=profiles.bands;state.plan=M.mergeSnapshot(state.plan,data);persist();settings();
   busy(false);
   if(active()){rebuild();render();await run();}else await generate();
   notice(restored?'Restored your local plan and updated the saved observations.':'Loaded '+members().length+' CNQ members. Enter trap coordinates and assign groups when ready.');
  }catch(error){
   busy(false);
   if(state.bands&&members().length&&active()){rebuild();render();await run();notice('Using your saved local plan. '+error.message,true);}
   else{state.mode='demo';$('simpleprofile').value='top_four';await generate();render();notice(error.message+' You can use illustrative players or import an alliance plan.',true);}
  }
  render();if(location.hash==='#roster')open();
 }
 window.BearAllianceUI={start,snapshot,active,open,scope,state};
})();
