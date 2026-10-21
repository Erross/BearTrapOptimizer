(function(){
'use strict';
const M=BearPersonalModel,A=BearAllianceModel,$=id=>document.getElementById(id);
const PLAN='BearTrapOptimizer:CNQ:2399:plan:v1',PROFILES='BearTrapOptimizer:personal-profiles:v1',CONTEXT='BearTrapOptimizer:personal-context:v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString(),clock=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
const labels={infantry:'Infantry',cavalry:'Cavalry',archers:'Archers'};
const state={plan:null,snapshot:null,profiles:{},current:null,output:null,input:null,text:'',loading:false,edits:0};
function stored(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){$('personalsavenote').textContent='Browser saving is unavailable. Export your player file to keep your entries.';return false;}}
function person(){return state.plan?.players.find(p=>p.active&&p.governorId===state.current);}
function observed(){return state.snapshot?.profiles?.[state.current]?.heroes||[];}
function context(){
 const c=stored(CONTEXT);if(c?.version!==1||!state.plan||c.fingerprint!==M.fingerprint(state.plan))return null;
 return c;
}
function read(){
 const value=id=>$(id).value;
 return {stock:Object.fromEntries(M.TIERS.map(t=>[t,Object.fromEntries(M.TYPES.map(k=>[k,value('personalstock'+t+k)||0]))])),
  joinMarches:value('personaljoins'),presets:value('personalpresets'),capacity:value('personalcapacity'),heroFreeCapacity:value('personalbare'),joinCap:value('personalcap'),
  heroes:M.HEROES.map(h=>({name:h.name,available:$('personalhas'+h.id).checked,skill:value('personalskill'+h.id)})),
  ownEnabled:$('personalown').checked,ownTier:value('personalowntier'),ownCapacity:value('personalowncapacity'),lowerConfirmed:$('personallowerconfirmed').checked,
  ownTroops:Object.fromEntries(M.TYPES.map(k=>[k,value('personalown'+k)||0])),leaders:Object.fromEntries(M.TYPES.map(k=>[k,value('personallead'+k)]))};
}
function save(){
 if(!person()||state.loading)return;
 state.profiles[state.current]={...state.profiles[state.current],input:read(),updatedAt:new Date().toISOString()};
 write(PROFILES,{version:1,players:state.profiles,last:state.current});
}
function stockTotal(){
 const sum=M.TIERS.reduce((s,t)=>s+M.TYPES.reduce((n,k)=>n+(Number($('personalstock'+t+k).value)||0),0),0);
 $('personalstocktotal').textContent=fmt(sum)+' T8–T10 troops entered. Your own-rally packet is reserved before splitting joins.';
}
const errorFields=['personalplayer','personaljoins','personalpresets','personalcapacity','personalbare','personalcap','personalowncapacity','personalstock10infantry'];
function clearErrors(){for(const id of [...errorFields,...M.TYPES.map(k=>'personallead'+k)]){const field=$(id),hint=document.getElementById(id+'error');field.setAttribute('aria-invalid','false');if(hint)hint.hidden=true;}}
function reportError(error){
 const message=error.message||String(error);$('personalerror').textContent=message;$('personalerror').hidden=false;
 const mappings=[[/Choose your name|Choose a player/i,'personalplayer'],[/Joining marches must/i,'personaljoins'],[/Saved preset/i,'personalpresets'],[/capacity without heroes/i,'personalbare'],[/Joining march capacity/i,'personalcapacity'],[/Alliance joining limit/i,'personalcap'],[/Own-rally march capacity|own-rally troops exceed/i,'personalowncapacity'],[/available infantry hero|available infantry leader/i,'personalleadinfantry'],[/available cavalry hero|available cavalry leader/i,'personalleadcavalry'],[/available archers hero|available archers leader/i,'personalleadarchers'],[/too few troops|at least one tier/i,'personalstock10infantry']];
 const id=mappings.find(([pattern])=>pattern.test(message))?.[1];
 if(id){const field=$(id),hint=document.getElementById(id+'error');field.setAttribute('aria-invalid','true');if(hint){hint.textContent=message;hint.hidden=false;}field.scrollIntoView({behavior:'smooth',block:'center'});field.focus({preventScroll:true});}
 else $('personalerror').scrollIntoView({behavior:'smooth',block:'center'});
}
function dirty(event){
 if(state.loading||event?.target?.id==='personalplayer')return;state.edits++;if(person())state.profiles[state.current]={...state.profiles[state.current],edited:true};clearErrors();state.output=null;$('personalresult').hidden=true;$('personalerror').hidden=true;
 $('personalownsettings').hidden=!$('personalown').checked;stockTotal();save();if(window.BearCloudDraftChanged)window.BearCloudDraftChanged();
}
function leaderOptions(selected={}){
 for(const type of M.TYPES){
  const node=$('personallead'+type),previous=selected[type]??node.value;
  const options=M.HEROES.filter(h=>h.type===type&&$('personalhas'+h.id).checked);
  node.innerHTML='<option value="">Choose '+type+' hero</option>'+options.map(h=>'<option value="'+esc(h.name)+'">'+esc(h.name)+'</option>').join('');
  node.value=options.some(h=>h.name===previous)?previous:'';
 }
}
function suggest(){
 const selected=M.suggestLeaders(read().heroes,observed());leaderOptions(selected);dirty();
}
function selectPlayer(skipSave=false){
 if(skipSave!==true)save();state.loading=true;const previousPlayer=state.current;state.current=$('personalplayer').value;
 state.output=null;$('personalresult').hidden=true;$('personalerror').hidden=true;
 const p=person();if(!p){state.loading=false;if(window.BearCloudSelectionChanged)window.BearCloudSelectionChanged();return;}
 const saved=state.profiles[state.current]?.input,c=context(),pc=c?.players?.[state.current];
 const heroData=observed();
 for(const t of M.TIERS)for(const k of M.TYPES)$('personalstock'+t+k).value=saved?.stock?.[t]?.[k]??0;
 $('personaljoins').value=saved?.joinMarches??pc?.joinMarches??p.stats.join_slots??5;
 $('personalpresets').value=saved?.presets??5;
 $('personalcapacity').value=saved?.capacity??p.stats.march_capacity??pc?.capacity??'';
 $('personalbare').value=saved?.heroFreeCapacity??'';
 $('personalcap').value=saved?.joinCap??c?.strategy?.join_march_cap??0;
 $('personalown').checked=saved?.ownEnabled??pc?.selectedHost??p.canHost;
 $('personalowntier').value=saved?.ownTier??'8';
 $('personallowerconfirmed').checked=saved?.lowerConfirmed??false;
 const capacity=Number($('personalcapacity').value),s=c?.strategy;
 const ownDefault=s?.host_allocation==='full'?capacity:s?.host_allocation==='small'?Math.max(1,Math.floor(capacity*s.small_host_fraction)):1000;
 for(const k of M.TYPES)$('personalown'+k).value=saved?.ownTroops?.[k]??(k==='infantry'?(ownDefault||1000):0);
 $('personalowncapacity').value=saved?.ownCapacity??p.stats.march_capacity??'';
 for(const h of M.HEROES){
  const entry=saved?.heroes?.find(x=>x.name===h.name),api=heroData.find(x=>x.name===h.name);
  $('personalhas'+h.id).checked=entry?.available??!!api;
  $('personalskill'+h.id).value=entry?.skill??api?.skill_levels?.[0]?.level??0;
 }
 leaderOptions(saved?.leaders||M.suggestLeaders(read().heroes,heroData));
 $('personalownsettings').hidden=!$('personalown').checked;
 $('personalcapacitynote').textContent=saved?'Loaded your saved personal entries. Update counts for this event.':p.stats.march_capacity?'March capacity comes from your entered alliance stats. Confirm it with your current heroes.':pc?.capacity?'Joining capacity is an alliance-model estimate. Verify it in game. Own-rally and hero-free capacities must also be checked.':'Enter your actual march capacities from the deployment screen.';
 $('personalactionstatus').textContent='';$('personalstatus').textContent=p.api.name+' · '+A.groupLabel(p.group)+' · saved roster '+(state.plan.snapshotAt?new Date(state.plan.snapshotAt).toLocaleDateString():'date unknown');
 state.loading=false;stockTotal();save();clearErrors();
 if(previousPlayer!==state.current&&window.BearCloudSelectionChanged)window.BearCloudSelectionChanged();
}
function troopTable(packet){return '<table><thead><tr><th>Tier</th>'+M.TYPES.map(k=>'<th>'+labels[k]+'</th>').join('')+'<th>Total</th></tr></thead><tbody>'+M.TIERS.map(t=>'<tr><th scope="row">T'+t+' / '+({10:'X',9:'IX',8:'VIII'}[t])+'</th>'+M.TYPES.map(k=>'<td>'+fmt(packet[t][k])+'</td>').join('')+'<td>'+fmt(M.TYPES.reduce((n,k)=>n+packet[t][k],0))+'</td></tr>').join('')+'</tbody></table>';}
function timing(p,input){
 const c=context(),pc=c?.players?.[p.governorId];
 if(!c||!pc)return {html:'<p>No current selected alliance comparison is available for this player. <a href="./index.html#roster">Choose a Bear trap and run a comparison</a>, select the intended approach, then reopen Optimize Me for your start group. No start time has been invented.</p>',text:'Start time: choose a Bear trap and run/select the alliance comparison first.'};
 const text=['Alliance approach: '+c.name+' · '+A.groupLabel(c.comparisonGroup)+'.'];
 if(!c.geo)text.push('These times use assumed travel. Select Bear trap 1 or Bear trap 2 and compare again for coordinate-based groups.');
 if(!input.ownEnabled)text.push('You selected Join only. Do not start your own rally.');
 else if(!pc.selectedHost)text.push('The selected alliance plan assigns you to join only. You selected an own rally: confirm a start group with the organizer before starting.');
 else if(pc.start==null)text.push('The selected comparison could not start your own rally. Ask the organizer to resolve its troops/timing before using a start instruction.');
 else{
  text.push('Start your own rally in group '+pc.group+' at '+clock(pc.start)+' elapsed after Bear activation.');
  if(c.cycle)text.push('Repeat on the alliance clock every '+clock(c.cycle)+' from that opening time. If your march is not ready, follow the next assigned cycle.');
  else text.push('Restart your own rally when its special march returns, allowing '+(c.mechanics.reaction_s||0)+' seconds to select and send.');
  const last=c.mechanics.duration_s-c.mechanics.countdown_s-pc.travel;
  text.push('Estimated last safe start: '+(last>=0?clock(last)+' elapsed':'none in this event')+' so the rally hits before '+clock(c.mechanics.duration_s)+'. Allow extra time for delays.');
 }
 if(c.strategy.first_wave_join)text.push('Opening rule: give everyone their first joining march before taking extra opening joins. Extra marches may initially wait for space.');
 if(c.strategy.join_window_s)text.push('The selected alliance plan uses delayed joining ('+c.strategy.join_window_s+' seconds before departure). The simple immediate-joining routine below differs: follow the organizer\'s chosen timing.');
 return {html:text.map(t=>'<p>'+esc(t)+'</p>').join(''),text:text.join('\n')};
}
function build(options={}){
 clearErrors();
 try{
  const p=person();if(!p)throw Error('Choose your name first.');
  const input=read();if(!M.total(M.matrix(input.stock)))throw Error('Enter available troops in at least one tier before building your setup.');const out=M.build(input);state.output=out;state.input=input;save();
  $('personalerror').hidden=true;$('personalresult').hidden=false;
  $('personalresultname').textContent=p.api.name+' · '+out.joins+' joining marches'+(out.own.enabled?' + special own rally':'');
  $('personalresultnote').textContent=out.note;
  $('personalnumbers').innerHTML=[[fmt(out.perJoin),'troops in each join'],[String(out.joins),'normal joining marches'],[String(out.presets),'saved preset slots']].map(([v,l])=>'<div class="personal-number"><strong>'+v+'</strong><span>'+l+'</span></div>').join('');
  $('personalwarnings').innerHTML=out.warnings.map(t=>'<p class="notice">'+esc(t)+'</p>').join('');
  $('personalpacket').innerHTML=troopTable(out.packet);$('personalleftover').innerHTML=troopTable(out.leftover);
  $('personalallocation').textContent=fmt(out.joinTotal)+' troops across joins; '+fmt(out.own.total||0)+' reserved for your own rally'+(out.own.tier==='lower'?' outside the T8–T10 stock':'')+'; '+fmt(out.leftoverTotal)+' listed troops unallocated. Lower tiers outside the table are not automatically included.';
  const rows=out.marches.map(m=>['Join '+m.number,m.hero||'No hero',m.slot?'Preset '+m.slot:'Manual setup',fmt(out.perJoin)]);
  if(out.own.enabled)rows.push(['Own rally · special',out.own.heroes.join(' / '),out.own.slot?'Preset '+out.own.slot:'Manual setup',fmt(out.own.total)]);
  $('personalpresettbl').innerHTML='<table><thead><tr><th>March</th><th>First hero / leader team</th><th>Save to</th><th>Troops</th></tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const steps=[];
  for(const m of out.marches){
   steps.push((m.number===1?'Select ': 'Keep the same troop counts; change the first hero to ')+(m.hero?m.hero+' in the first hero slot.':'no hero: remove all heroes.')+(m.number===1?' Enter the counts in the joining table above.':'')+' Recheck the troop numbers and capacity. '+(m.slot?'Save as preset '+m.slot+'.':'No saved slot remains: set up this march manually when sending.'));
  }
  if(out.own.enabled)steps.push('Own rally: select '+out.own.heroes.join(', ')+'. Enter '+M.TYPES.map(k=>fmt(out.own.troops[k])+' '+k).join(', ')+' at '+(out.own.tier==='lower'?'your confirmed lower tier':'T'+out.own.tier)+'. '+(out.own.slot?'Save as preset '+out.own.slot+'.':'Use manual setup; your saved slots are assigned to joins.'));
  steps.push('Do not reuse a hero already away in another march. For a hero-free join, remove all heroes and recheck the capacity. Saved presets may load ratios or adjust counts: verify the exact counts on deployment.');
  $('personalsetupsteps').innerHTML=steps.map(s=>'<li>'+esc(s)+'</li>').join('');
  const instructions=timing(p,input);$('personaltiming').innerHTML=instructions.html;
  const joins=['For each ready joining march, select the first available eligible rally in the game list that has room and enough countdown left for you to arrive. If several qualify, prefer the one departing soonest.',
   'Send your joining presets as soon as space and the opening-participation rule allow. You cannot join your own rally or send two marches into the same rally.',
   'As each joining march gets home, immediately repeat with the next eligible rally. You do not need to wait for your other marches.',
   'Keep the own-rally troop packet and leader heroes available until your scheduled special rally starts. Your own rally does not consume any normal joining-march queues.'];
  if(!out.own.enabled)joins.pop();
  $('personaljoinsteps').innerHTML=joins.map(s=>'<li>'+esc(s)+'</li>').join('');
  state.text=p.api.name+' — Bear setup\n'+out.note+'\n\nEACH JOIN:\n'+M.TIERS.map(t=>'T'+t+': '+M.TYPES.map(k=>fmt(out.packet[t][k])+' '+k).join(', ')).join('\n')+'\n\n'+rows.map(row=>row.join(' · ')).join('\n')+'\n\nSETUP:\n'+steps.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\nTIMING:\n'+instructions.text+'\n\nJOINING:\n'+joins.join('\n');
  $('personalactionstatus').textContent='Setup ready. Counts and heroes are saved on this device.';
  if(options.scroll!==false)$('personalresult').scrollIntoView({behavior:'smooth',block:'start'});return out;
 }catch(error){$('personalresult').hidden=true;reportError(error);return null;}
}
function download(name,content){const u=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function start(){
 $('personalinventory').innerHTML=M.TIERS.map(t=>'<tr><th scope="row">T'+t+' / '+({10:'X',9:'IX',8:'VIII'}[t])+'</th>'+M.TYPES.map(k=>'<td><input id="personalstock'+t+k+'" type="number" inputmode="numeric" min="0" max="5000000" step="1" value="0" aria-label="T'+t+' '+k+' available"></td>').join('')+'</tr>').join('');
 $('personalheroes').innerHTML=M.HEROES.map(h=>'<div class="personal-hero"><label><input id="personalhas'+h.id+'" type="checkbox"> '+esc(h.name)+'<small>'+labels[h.type]+(h.join?' · offensive joiner':' · own-rally option')+'</small></label><select id="personalskill'+h.id+'" aria-label="'+esc(h.name)+' first Expedition skill level">'+Array.from({length:6},(_,i)=>'<option value="'+i+'">'+(i?'Lv '+i:'Unknown')+'</option>').join('')+'</select></div>').join('');
 $('personalleaders').innerHTML=M.TYPES.map(k=>'<label>'+labels[k]+' leader<select id="personallead'+k+'" aria-describedby="personallead'+k+'error"><option value="">Choose '+k+' hero</option></select><small id="personallead'+k+'error" class="field-error" hidden></small></label>').join('');
 $('personalform').addEventListener('input',dirty);
 $('personalform').addEventListener('change',e=>{if(e.target.id==='personalplayer')return;if(e.target.id.startsWith('personalhas'))leaderOptions();dirty();});
 $('personalplayer').addEventListener('change',selectPlayer);
 $('personalform').addEventListener('submit',e=>{e.preventDefault();if(window.BearCloudSave)return window.BearCloudSave();return build();});
 $('personalpreview').onclick=()=>{if(build())$('personalresultsave').textContent='Setup preview. Your draft is on this device; use Save online & show setup to share your changes.';};
 $('personalsuggest').addEventListener('click',suggest);
 $('personalcopy').onclick=async()=>{try{await navigator.clipboard.writeText(state.text);$('personalactionstatus').textContent='Instructions copied.';}catch(_){$('personalcopytext').value=state.text;$('personalcopytext').hidden=false;$('personalcopytext').focus();$('personalcopytext').select();$('personalactionstatus').textContent='Select and copy the instructions below.';}};
 $('personalexport').onclick=()=>{if(!state.output)return;download('bear-player-'+state.current+'.json',JSON.stringify({schema:'bear-personal-profile',version:1,governorId:state.current,name:person().api.name,updatedAt:new Date().toISOString(),input:read()},null,2));};
 $('personalapply').onclick=()=>{
  try{
   const input=read();M.build(input);const next=A.validatePlan(stored(PLAN)||state.plan),p=next.players.find(p=>p.governorId===state.current&&p.active);
   if(!p)throw Error('This member is not in the current alliance plan.');
   const stock=M.matrix(input.stock);
   for(const k of M.TYPES)p.stats[k]=M.TIERS.reduce((n,t)=>n+stock[t][k],0)+(input.ownEnabled&&input.ownTier==='lower'?Number(input.ownTroops[k]):0);
   p.stats.troops=M.TYPES.reduce((n,k)=>n+p.stats[k],0);p.stats.join_slots=Number(input.joinMarches);p.stats.march_capacity=Number(input.capacity);p.canHost=input.ownEnabled;
   const validated=A.validatePlan(next);if(!write(PLAN,validated))throw Error('Cannot save the alliance model in this browser. Export your player file instead.');
   state.plan=validated;localStorage.removeItem(CONTEXT);
   $('personalactionstatus').textContent='Counted troop totals and joining slots saved to the alliance model on this device. Reopen the alliance optimizer and compare again. Exact tier breakdown stays in this profile; review the model’s tiers and bonuses.';
   $('personaltiming').innerHTML='<p>Model inputs changed. Reopen the alliance optimizer and compare again to refresh your start instructions.</p>';
  }catch(error){$('personalactionstatus').textContent=error.message;}
 };
 $('personalimport').onchange=async e=>{
  try{
   const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('Choose a player export smaller than 100 KB.');
   const data=JSON.parse(await file.text());
   if(data.schema!=='bear-personal-profile'||data.version!==1||typeof data.governorId!=='string'||!state.plan.players.some(p=>p.active&&p.governorId===data.governorId))throw Error('Choose an Optimize Me export for a current alliance member.');
   M.build(data.input);save();state.profiles[data.governorId]={input:data.input,updatedAt:new Date().toISOString()};
   $('personalplayer').value=data.governorId;selectPlayer(true);build();$('personalactionstatus').textContent='Player data imported. Use the model button to apply these counts to the alliance comparison.';
  }catch(error){$('personalerror').textContent=error.message;$('personalerror').hidden=false;}
  e.target.value='';
 };
 try{
  const local=stored(PROFILES);if(local?.version===1&&local.players&&typeof local.players==='object')state.profiles=local.players;
  const saved=stored(PLAN);state.plan=saved?A.validatePlan(saved):A.emptyPlan();
  try{const response=await fetch('./data/alliance-api.json',{cache:'no-store'});if(!response.ok)throw Error('Saved roster could not be loaded.');state.snapshot=await response.json();state.plan=A.mergeSnapshot(state.plan,state.snapshot);}
  catch(error){if(!state.plan.players.length)throw error;$('personalstatus').textContent='Using locally saved alliance members; the published snapshot is unavailable.';}
  const people=state.plan.players.filter(p=>p.active).sort((a,b)=>a.api.name.localeCompare(b.api.name));
  $('personalplayer').innerHTML='<option value="">Choose your player</option>'+people.map(p=>'<option value="'+p.governorId+'">'+esc(p.api.name)+'</option>').join('');
  const chosen=new URLSearchParams(location.search).get('player')||local?.last;
  if(people.some(p=>p.governorId===chosen)){$('personalplayer').value=chosen;selectPlayer();}
  else $('personalstatus').textContent='Choose your player. Counts, heroes and presets are saved separately for each person on this device.';
 }catch(error){$('personalstatus').textContent=error.message;$('personalerror').textContent='Cannot load the alliance roster. Open the alliance optimizer to restore your saved plan, then retry.';$('personalerror').hidden=false;}
}
window.BearPersonalProfiles={current:()=>person(),read,build,reportError,stamp:()=>state.edits,
 hasDraft(){const p=state.profiles[state.current];return !!p?.edited||(!p?.syncedInput&&M.total(M.matrix(read().stock))>0);},
 markSaved(input){if(!person())return;state.profiles[state.current]={...state.profiles[state.current],edited:JSON.stringify(read())!==JSON.stringify(input),syncedInput:JSON.stringify(input)};save();},
 load(input){
  M.build(input);if(!person())throw Error('Choose a player first.');
  state.profiles[state.current]={input,edited:false,syncedInput:JSON.stringify(input),updatedAt:new Date().toISOString()};selectPlayer(true);
 }};
start();
})();
