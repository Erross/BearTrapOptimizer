/* Six complete approaches; detailed setup stays behind the comparison. */
'use strict';
const approachNames=['Everyone together','Strongest leaders only','Selected leaders in waves','Selected waves + troop limit','Everyone in waves','Everyone in waves + troop limit'];
let profileMeta=null,profileNeedsRebuild=false;
let capRefreshTimer=null,capRefreshRequested=false;
controls.push('simpleprofile','frontwaves','frontgap','joinmarchcap','firstwavejoin');
$('resultcontext').hidden=true;

function coherentApproaches(request){
 const count=request.roster.length,starters=num('hosts'),waves=num('frontwaves'),gap=num('frontgap'),cap=num('joinmarchcap');
 if(!Number.isInteger(starters)||starters<1||starters>100||!Number.isInteger(waves)||waves<1||waves>20||!Number.isInteger(gap)||gap<0||gap>300||!Number.isInteger(cap)||cap<1||cap>2000000)throw Error('Use 1–100 starters, 1–20 opening waves, a 0–300s interval, and a positive joining-march limit.');
 const common={...request.strategy,host_names:[],host_allocation:'small',small_host_fraction:.05,
  troop_split:'concentrated',join_policy:'next',reserve_lead_troops:true,final_push:false,
  group_repeat:'ready',wave_cycle_s:0,join_march_cap:0,opening_wave_count:0};
 const selected=Math.min(count,starters),strong=Math.min(selected,Math.max(1,Math.ceil(request.roster.filter(m=>m.can_host).length/4)));
 const grouped={cadence:'groups',opening_wave_count:waves,group_size:Math.max(1,Math.ceil(selected/waves)),wave_interval_s:gap};
 return [
  {...common,name:approachNames[0],host_count:count,cadence:'synchronized'},
  {...common,name:approachNames[1],host_count:strong,cadence:'synchronized',join_policy:'strength'},
  {...common,...grouped,name:approachNames[2],host_count:selected},
  {...common,...grouped,name:approachNames[3],host_count:selected,join_march_cap:cap},
  {...common,...grouped,name:approachNames[4],host_count:count},
  {...common,...grouped,name:approachNames[5],host_count:count,join_march_cap:cap}
 ];
}
const originalPayload=payload;
payload=function(){const request=originalPayload();request.strategies=[...coherentApproaches(request),...resolvedAddedStrategies()];return request;};
const detailedTitle=strategyTitle;
strategyTitle=function(s){return approachNames.includes(s.name)||addedStrategies.some(p=>p.strategy.name===s.name)||s.name==='Your custom approach'?s.name:s.name==='Recommended plan'?'Advanced search result':detailedTitle(s);};
const detailedPattern=patternText;
patternText=function(s){return s.cadence==='groups'&&s.opening_wave_count?s.opening_wave_count+' opening waves, '+s.wave_interval_s+'s apart':detailedPattern(s);};

function openingFacts(run){
 const starts=[...new Set(Object.values(run.planned_initial_starts))].sort((a,b)=>a-b);
 return {waves:starts.length,gap:starts.length>1?starts[1]-starts[0]:0};
}
function capLabel(s){return s.join_march_cap?'Up to '+Math.round(s.join_march_cap).toLocaleString()+' per join':'No alliance troop limit';}
function syncCapDial(){
 const cap=num('joinmarchcap');
 $('frontcap').max=Math.min(2000000,Math.max(150000,cap||0,Number($('frontcap').max)||0,...roster.map(m=>m.march_capacity)));
 if(Number.isFinite(cap)&&cap>0)$('frontcap').value=cap;
}
async function flushCapRefresh(){
 if(running||!capRefreshRequested)return;
 capRefreshRequested=false;await run({capOnly:true});
 if(capRefreshRequested&&!running)flushCapRefresh();
}
function queueCapRefresh(){
 syncCapDial();markResultsDirty('Joining-march troop cap changed.');
 clearTimeout(capRefreshTimer);
 capRefreshTimer=setTimeout(()=>{capRefreshTimer=null;capRefreshRequested=true;flushCapRefresh();},350);
}
const previousBadge=updateBadge;
updateBadge=function(){
 previousBadge();
 syncCapDial();
 const present=roster.filter(m=>!absent.has(m.name));
 $('simpleprofile').disabled=running||!synthetic;
 if(!synthetic)$('n').value=present.length;
 $('hosts').max=Math.max(1,present.length);
 if(!running&&present.length&&num('hosts')>present.length)$('hosts').value=present.length;
 $('frontwaves').disabled=running;$('frontgap').disabled=running;
 if(!present.length){$('advisorassumptions').textContent='Choose attending players in Setup to compare approaches.';return;}
 const towns=present.map(m=>m.town_level),powers=present.map(m=>m.power_m);
 const estimated=present.filter(m=>estimatedStocks.has(m.name)||m.infantry==null).length;
 $('advisorassumptions').textContent=(synthetic?(profileMeta?.label||'Illustrative alliance'):'Your edited players')+' · TC'+Math.min(...towns)+'–'+Math.max(...towns)+' · '+Math.round(Math.min(...powers))+'–'+Math.round(Math.max(...powers))+'M power'+(synthetic?' · assumed mix; refine in Setup.':' · '+estimated+' estimated troop stocks; refine in Setup.');
};
const previousBusy=busy;
busy=function(on,message=''){previousBusy(on,message);$('simpleprofile').disabled=on||!synthetic;$('frontwaves').disabled=on;$('frontgap').disabled=on;$('firstwavejoin').disabled=on;$('optimizewaves').disabled=on||!roster.some(m=>!absent.has(m.name));$('joinmarchcap').disabled=false;$('frontcap').disabled=false;setStrategyBuilderBusy(on);if(!on&&capRefreshRequested)setTimeout(flushCapRefresh,0);};

function profileTable(){
 if(!profileMeta){$('profiletable').innerHTML='<p>Using the current saved or edited roster. Player details and troop inventories are available in the other Setup pages.</p>';return;}
 $('profiletable').innerHTML=table(['Group','Players','TC','Power (millions)','Usable troops','March size','Rally capacity','Tier'],profileMeta.bands.map(b=>[esc(b.label),b.players,b.town_level.join('–'),b.power_m.join('–'),b.troops.map(fmt).join('–'),b.march_capacity.map(fmt).join('–'),b.rally_capacity.map(fmt).join('–'),'T'+b.tier]));
}
function syncAssumedRanges(){
 if(!profileMeta)return;
 for(const [field,ids]of Object.entries({town_level:['mintown','maxtown'],power_m:['minpower','maxpower'],troops:['mintroops','maxtroops'],march_capacity:['minmarch','maxmarch'],rally_capacity:['minrally','maxrally'],attack:['minattack','maxattack'],lethality:['minlethality','maxlethality']})){
  $(ids[0]).value=Math.min(...profileMeta.bands.map(b=>b[field][0]));$(ids[1]).value=Math.max(...profileMeta.bands.map(b=>b[field][1]));
 }
 $('mintier').value=Math.min(...profileMeta.bands.map(b=>b.tier));$('maxtier').value=Math.max(...profileMeta.bands.map(b=>b.tier));
}
function customRosterInputs(){return {n:num('n'),minimum_m:num('minscore'),maximum_m:num('maxscore'),power_min_m:num('minpower'),power_max_m:num('maxpower'),troops_min:num('mintroops'),troops_max:num('maxtroops'),strength_min:num('minstrength'),strength_max:num('maxstrength'),join_slots:num('slots'),target_total:num('target')*1e9,inventory_infantry_pct:num('stockinf'),inventory_cavalry_pct:num('stockcav'),town_level_min:num('mintown'),town_level_max:num('maxtown'),rally_capacity_min:num('minrally'),rally_capacity_max:num('maxrally'),march_capacity_min:num('minmarch'),march_capacity_max:num('maxmarch'),tier_min:num('mintier'),tier_max:num('maxtier'),attack_min:num('minattack'),attack_max:num('maxattack'),lethality_min:num('minlethality'),lethality_max:num('maxlethality')};}
generate=async function(){
 if(running||!ensureSavedDrafts())return false;
 busy(true,'Preparing the assumed alliance…');
 try{
  const generated=$('simpleprofile').value==='custom'?await api('roster',customRosterInputs()):await api('alliance_roster',{n:num('n'),profile:$('simpleprofile').value,join_slots:num('slots')});
  roster=generated.roster;profileMeta=generated.profile||null;profileNeedsRebuild=false;
  absent.clear();estimatedStocks=new Set(roster.map(m=>m.name));synthetic=true;fitted=null;editingMember=null;editingTroops=null;
  $('memberfilter').value='';syncAssumedRanges();renderRoster();profileTable();markResultsDirty('Illustrative players changed.');
  busy(false);await run();return $('error').style.display!=='block';
 }catch(error){busy(false);showError(error);return false;}
};
run=async function(options={}){
 if(running||!ensureSavedDrafts())return false;
 if(synthetic&&profileNeedsRebuild){if(!await generate())return false;if(!options.selectedName)return true;}
 if(options.custom){
  try{const custom=originalPayload().strategy;custom.name=nextStrategyName('Your custom approach');addStrategySnapshot(custom,custom.join_march_cap?'fixed':'none');options={...options,selectedName:custom.name};}
  catch(error){showError(error);return false;}
 }
 const previous=result?.runs[chosen]?.strategy.name;
 busy(true,'Calculating your strategy comparison…');
 try{
  const request=JSON.parse(JSON.stringify(payload()));
  const next=await api('compare',request);
  const shownNames=result?[...visible].map(i=>result.runs[i]?.strategy.name):[];
  result=next;syncAddedStrategyResults(result.runs);searchData=null;$('searchpanel').hidden=true;
  const previousIndex=result.runs.findIndex(r=>r.strategy.name===(options.selectedName||previous));
  const eligible=result.runs.map((r,i)=>({r,i})).filter(({r})=>!r.strategy.first_wave_join||!r.summary.first_wave_missing_count);chosen=previousIndex>=0?previousIndex:eligible.length?eligible.reduce((a,b)=>b.r.total_damage>a.r.total_damage?b:a).i:0;
  const changedCap=num('joinmarchcap')!==request.strategies[3].join_march_cap;
  visible=options.capOnly||options.preserveLines?new Set(result.runs.map((r,i)=>shownNames.includes(r.strategy.name)||r.strategy.name===options.selectedName?i:-1).filter(i=>i>=0)):new Set(result.runs.map((_,i)=>i));resultsDirty=changedCap;renderResults();profileTable();renderAddedStrategies();
  busy(false,'Compared '+result.runs.length+' approaches. Choose a card to inspect its leaders and waves.');
  if(changedCap){markResultsDirty('Updating to the latest troop cap.');capRefreshRequested=true;setTimeout(flushCapRefresh,0);}
  else{clearTimeout(capRefreshTimer);capRefreshTimer=null;capRefreshRequested=false;}
  return true;
 }catch(error){busy(false);showError(error);return false;}
};

const previousSummary=renderSelectedSummary;
renderSelectedSummary=function(){
 previousSummary();
 const r=result.runs[chosen],facts=openingFacts(r);
 $('selectedname').textContent=strategyTitle(r.strategy);
 $('selecteddescription').textContent=r.selected_hosts.length+' rally starters · '+facts.waves+' opening '+(facts.waves===1?'wave':'waves')+(facts.waves>1?' · '+facts.gap+'s between waves':'')+' · '+capLabel(r.strategy);
};
renderLegend=function(){
 if(!result)return;
 const order=result.runs.map((_,i)=>i).filter(i=>visible.has(i));
 const legend=result.runs.map((r,i)=>{
  const position=visible.has(i)?order.indexOf(i):i,dash=position%3===1?'8 3':position%3===2?'3 3':'';
  return '<label class="approach-key" style="--approach-color:'+colors[i%colors.length]+'"><input type="checkbox" data-line="'+i+'" '+(visible.has(i)?'checked':'')+'><svg class="legend-swatch" viewBox="0 0 34 12" aria-hidden="true"><line x1="0" y1="6" x2="34" y2="6" stroke="'+colors[i%colors.length]+'" stroke-width="3"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/></svg>'+esc(strategyTitle(r.strategy))+'</label>';
 }).join('');
 for(const id of ['legend','individuallegend']){
  $(id).innerHTML=legend;
  for(const input of $(id).querySelectorAll('[data-line]'))input.onchange=()=>{
   input.checked?visible.add(Number(input.dataset.line)):visible.delete(Number(input.dataset.line));
   renderLegend();renderCharts();
  };
 }
};
const previousCharts=renderCharts;
renderCharts=function(){
 if(!result)return;previousCharts();
 const reference=result.runs[0].total_damage;
 chart('alliancechart',result.runs.map((r,i)=>({r,i})).filter(({i})=>visible.has(i)).map(({r,i})=>({name:strategyTitle(r.strategy),color:colors[i%colors.length],points:r.series.map(p=>({x:p.second,y:reference?p.damage/reference*100:0}))})),{unit:'index'});
 $('eventlabel').textContent=(result.mechanics.duration_s/60)+'-minute hunt';
 $('damageheading').textContent='Alliance damage over '+(result.mechanics.duration_s/60)+' minutes';
 $('timingnote').textContent='All rallies must hit before '+time(result.mechanics.duration_s)+'. Results compare assumed troops and bonuses; validate with battle reports.';
};
renderComparison=function(){
 if(!result)return;const baseline=result.runs[0].total_damage,best=Math.max(...result.runs.filter(r=>!r.strategy.first_wave_join||!r.summary.first_wave_missing_count).map(r=>r.total_damage));
 $('comparisontable').innerHTML=result.runs.map((r,i)=>{
  const facts=openingFacts(r),delta=baseline?r.total_damage/baseline-1:null;
  return '<article class="approach-card '+(i===chosen?'selected':'')+'" style="--approach-color:'+colors[i%colors.length]+'"><div class="card-top"><span class="line-swatch"></span>'+(r.total_damage===best?'<span class="best-tag">Highest damage</span>':i===0?'<span class="baseline-tag">Baseline</span>':'')+'</div><h3>'+esc(strategyTitle(r.strategy))+'</h3><p class="card-mix">'+esc(strategyMixLabel(r.strategy))+'</p><div class="approach-score '+(delta<0?'negative':'positive')+'">'+(delta===null?'—':i===0?'Reference':changeText(delta))+'<small>'+(i===0?'Everyone starts at the opening':'damage vs everyone together')+'</small></div><dl><div><dt>Starters</dt><dd>'+r.selected_hosts.length+' of '+result.roster.length+'</dd></div><div><dt>Opening</dt><dd>'+facts.waves+' '+(facts.waves===1?'wave':'waves')+(facts.waves>1?' · '+facts.gap+'s apart':'')+'</dd></div><div><dt>Join troop limit</dt><dd>'+(r.strategy.join_march_cap?Math.round(r.strategy.join_march_cap).toLocaleString():'None')+'</dd></div><div><dt>Join only</dt><dd>'+(result.roster.length-r.selected_hosts.length)+' players</dd></div><div><dt>Opening joins</dt><dd>'+r.summary.first_wave_joiners+' / '+result.roster.length+'</dd></div></dl><button data-choose-approach="'+i+'" aria-label="View plan: '+esc(strategyTitle(r.strategy))+'">'+(i===chosen?'Selected approach':'View this approach')+'</button></article>';
 }).join('');
 for(const button of $('comparisontable').querySelectorAll('[data-choose-approach]'))button.onclick=()=>selectPlan(button.dataset.chooseApproach);
};
async function copyLaunchGroups(text,button){
 try{
  await navigator.clipboard.writeText(text);
  button.textContent='Copied';$('launchcopystatus').textContent='Copied. Paste into alliance chat.';
  $('launchcopytext').hidden=true;
 }catch(error){
  const field=$('launchcopytext');field.value=text;field.hidden=false;field.focus();field.select();
  $('launchcopystatus').textContent='Select and copy the text below, then paste into alliance chat.';
 }
}
renderAdvisor=function(){
 if(!result)return;
 const r=result.runs[chosen],s=r.strategy,regular=new Set(r.selected_hosts),joining=result.roster.filter(m=>!regular.has(m.name));
 const byTime=new Map();for(const name of r.selected_hosts){const t=r.initial_starts[name];if(!byTime.has(t))byTime.set(t,[]);byTime.get(t).push(name);}
 const groups=[...byTime].sort((a,b)=>(a[0]??Infinity)-(b[0]??Infinity));
 const own=s.host_allocation==='full'?'Use a full march in your own rally':s.host_allocation==='small'?'Keep '+(s.small_host_fraction*100)+'% of your maximum march for your own rally':'Split troops between your own rally and joins';
 const rule=[approachNames[0],approachNames[4],approachNames[5]].includes(s.name)?'Every eligible attending player leads and joins.':'The highest-rated eligible leaders start; the other players join. Ratings use the entered leader bonuses, with rally capacity breaking ties.';
 $('planbrief').innerHTML='<p><b>Who leads:</b> '+esc(rule)+'</p><p><b>Troops:</b> '+esc(own)+'. '+(s.troop_split==='equal'?'Share remaining troops across joining marches.':'Fill each joining march before sending the next.')+' '+esc(capLabel(s))+'. '+esc(joinNames[s.join_policy])+'.</p><p><b>Troop mix:</b> '+esc(formationExplanation(s))+'</p><p><b>After the opening:</b> '+(r.group_cycle_s?'Repeat groups every '+time(r.group_cycle_s)+' on the shared clock.':'Restart your own rally when its troops return, allowing '+result.mechanics.reaction_s+'s to send again.')+' All rallies must hit before '+time(result.mechanics.duration_s)+'.</p><div class="plan-metrics"><span><b>'+pct(r.summary.ready_wait_fraction)+'</b> ready-troop waiting</span><span><b>'+r.summary.rallies+'</b> rallies hit in time</span><span><b>'+pct(r.summary.mean_fill)+'</b> average rally fill</span></div>'+(r.summary.starters_without_first_rally?'<p class="stale">'+r.summary.starters_without_first_rally+' selected starters could not start with this stock, troop mix and event timing. Refine them in Setup.</p>':'');
 $('planbrief').innerHTML+='<p><b>Opening joins:</b> '+r.summary.first_wave_joiners+' of '+result.roster.length+' players joined a first-wave rally.'+(s.first_wave_join&&r.summary.first_wave_missing_count?' <strong>This plan fails the opening requirement.</strong> Missing: '+r.first_wave_missing.map(name=>esc(playerDisplayName({name}))).join(', '):'')+'</p><p><b>Joining time:</b> '+(s.join_window_s?'Aim to arrive within '+s.join_window_s+' seconds before departure. Troops can wait at home for that window.':'Send to an eligible gathering rally as soon as troops are available.')+'</p>';
 const launchGroups=groups.map(([t,names],i)=>({label:t===null?'Could not start':'Group '+(i+1)+' · '+time(t),names:names.map(name=>playerDisplayName({name}))}));
 const copyText=group=>group.label+'\n'+group.names.join(', ');
 const hasWaves=['groups','waves'].includes(s.cadence)&&Object.values(r.planned_initial_starts).some(t=>t>0);
 const travelNote=hasWaves?(window.BearAllianceUI?.active()&&['1','2'].includes(window.BearAllianceUI.state.plan.comparisonGroup)?'Earlier groups use the shortest travel to '+BearAllianceModel.groupLabel(window.BearAllianceUI.state.plan.comparisonGroup)+'.':'Earlier groups use the shortest configured travel to the bear. Select a Bear trap to use city positions.'):new Set(Object.values(r.planned_initial_starts)).size===1?'All starters share the same opening time.':'Groups reflect the simulated opening launch times.';
 $('openinggroups').innerHTML='<div class="launch-heading"><h3>Opening launch groups</h3><button type="button" id="copyalllaunchgroups">Copy all groups</button></div><p class="fine">'+esc(travelNote)+'</p><div class="launch-groups">'+launchGroups.map((g,i)=>'<div><span>'+esc(g.label)+'</span><strong>'+g.names.length+' '+(g.names.length===1?'starter':'starters')+'</strong><button type="button" data-copy-launch-group="'+i+'">Copy '+(groups[i][0]===null?'players':'group '+(i+1))+'</button><details><summary>Show players</summary><p>'+g.names.map(esc).join(', ')+'</p></details></div>').join('')+'</div><p id="launchcopystatus" class="fine" role="status"></p><textarea id="launchcopytext" class="launch-copy-text" aria-label="Launch groups to copy" readonly hidden></textarea>';
 $('copyalllaunchgroups').onclick=()=>copyLaunchGroups(launchGroups.map(copyText).join('\n\n'),$('copyalllaunchgroups'));
 for(const button of $('openinggroups').querySelectorAll('[data-copy-launch-group]'))button.onclick=()=>copyLaunchGroups(copyText(launchGroups[Number(button.dataset.copyLaunchGroup)]),button);
 const playerRows=list=>list.map(m=>[esc(playerDisplayName(m)),'TC'+m.town_level,Number(m.power_m).toFixed(1)+'M',exactNumber(m.rally_capacity)]);
 $('leaderroles').innerHTML='<div class="role-lists"><details><summary>Who sends rallies? ('+regular.size+')</summary>'+table(['Player','Town Center','Power','Rally capacity'],playerRows(result.roster.filter(m=>regular.has(m.name))))+'</details><details><summary>Who should only join? ('+joining.length+')</summary>'+(joining.length?table(['Player','Town Center','Power','Rally capacity'],playerRows(joining)):'<p>Everyone eligible starts in this approach.</p>')+'</details></div>';
 $('advisorSchedule').onclick=()=>activatePage('plantab');
};

closePlanSettings=function(){
 if($('setupdialog').open)$('setupdialog').close();document.body.classList.remove('settings-open');
 $('toggleSettings').setAttribute('aria-expanded','false');activePage='comparetab';$('comparetab').classList.add('active');
 renderCharts();
};
activatePage=function(id){
 if(id==='comparetab'){closePlanSettings();return;}
 activePage=id;document.body.classList.add('settings-open');$('toggleSettings').setAttribute('aria-expanded','true');
 if(!$('setupdialog').open)$('setupdialog').showModal();
 for(const button of document.querySelectorAll('[data-tab]')){const on=button.dataset.tab===id;button.classList.toggle('active',on);button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;}
 for(const panel of document.querySelectorAll('.tab'))panel.classList.toggle('active',panel.id===id||panel.id==='comparetab');
 $('setupcontrols').hidden=id!=='modeltab';$('setupdialog').classList.toggle('has-controls',id==='modeltab');
 if(result&&id==='plantab')renderPlan();if(id==='trooptab')previewFormations();if(id==='modeltab')profileTable();
};
$('toggleSettings').onclick=()=>activatePage('membertab');$('closeSettings').onclick=closePlanSettings;
$('setupdialog').addEventListener('close',()=>{document.body.classList.remove('settings-open');$('toggleSettings').setAttribute('aria-expanded','false');activePage='comparetab';});
$('playerchartpanel').addEventListener('toggle',()=>{if($('playerchartpanel').open)renderCharts();});
$('reviewassumptions').onclick=()=>activatePage('modeltab');
$('recommend').onclick=()=>run();$('refreshresults').onclick=()=>run();$('refreshresults').textContent='Update comparison';
$('run').onclick=async()=>{await run({custom:true});if($('error').style.display!=='block')closePlanSettings();};
$('generate').onclick=async()=>{
 const backup={roster:JSON.parse(JSON.stringify(roster)),absent:[...absent],estimated:[...estimatedStocks],synthetic,profileMeta};
 if(!await generate())return;
 $('status').innerHTML='Illustrative players rebuilt. <button id="undodemo" class="text-button">Undo replacement</button>';
 $('undodemo').onclick=async()=>{roster=backup.roster;absent=new Set(backup.absent);estimatedStocks=new Set(backup.estimated);synthetic=backup.synthetic;profileMeta=backup.profileMeta;profileNeedsRebuild=false;editingMember=null;editingTroops=null;renderRoster();await run();};
};
for(const id of ['n','simpleprofile'])$(id).addEventListener('input',()=>{if(synthetic)profileNeedsRebuild=true;markResultsDirty('Alliance profile changed.');});
for(const id of ['frontwaves','frontgap','firstwavejoin'])$(id).addEventListener('input',()=>markResultsDirty('Approach timing changed.'));
$('frontcap').oninput=()=>{$('joinmarchcap').value=$('frontcap').value;queueCapRefresh();};
$('joinmarchcap').oninput=queueCapRefresh;
for(const id of demoControlIds)if(id!=='n')$(id).addEventListener('input',()=>{$('simpleprofile').value='custom';if(synthetic){profileNeedsRebuild=true;markResultsDirty('Custom player assumptions changed.');}});
for(const id of ['projectfile','rosterfile']){
 const importPrevious=$(id).onchange;
 $(id).onchange=async event=>{const previousMeta=profileMeta,previousDirty=profileNeedsRebuild;profileMeta=null;profileNeedsRebuild=false;await importPrevious(event);if($('error').style.display==='block'){profileMeta=previousMeta;profileNeedsRebuild=previousDirty;}profileTable();updateBadge();};
}
$('individual').onchange=()=>renderCharts();
$('optimizewaves').onclick=async()=>{
 if(running||!ensureSavedDrafts())return;
 if(addedStrategies.length>=maxAddedStrategies){showError(Error('Remove an added strategy to make room for the optimized plan.'));return;}
 busy(true,'Testing wave recycling, joining times and opening participation…');
 try{
  const request=JSON.parse(JSON.stringify(payload())),search=await api('optimize_waves',request);
  const candidate={...search.best.strategy,name:nextStrategyName('Optimized waves')};
  busy(false);
  if(!await applyStrategySnapshots([...addedStrategies,{strategy:candidate,capMode:candidate.join_march_cap?'fixed':'none'}],candidate.name))return;
  $('waveoptimization').hidden=false;
  $('waveoptimizationnote').textContent=search.note+' Tested '+search.tested.length+' plans.';
  $('waveoptimizationtable').innerHTML=table(['Starters','Waves','Gap','Join cap','Join window','Opening joins','Damage vs winner'],search.tested.slice(0,8).map(r=>[r.selected_hosts.length,r.strategy.opening_wave_count,r.strategy.wave_interval_s+'s',r.strategy.join_march_cap?exactNumber(r.strategy.join_march_cap):'None',r.strategy.join_window_s+'s',r.first_wave_joiners+' / '+request.roster.length+(r.opening_feasible?'':' · fails'),pct(r.total_damage/search.best.total_damage)]));
  $('status').textContent='Best tested wave plan added. Everyone has an opening join; later waiting is allowed.';
 }catch(error){busy(false);showError(error);}
};
initializeStrategyBuilder();
if(window.BearAllianceUI)window.BearAllianceUI.start();else generate();
