/* Presentation and interaction state. The simulation engines remain unchanged. */
'use strict';
let resultsDirty=false, stockDraft=false, memberDraft=false, running=false, dirtyReason='Inputs changed.';
let editingMember=null, editingTroops=null, activePage='comparetab';
const changeText=n=>!Number.isFinite(n)?'No baseline':(n>0?'+':'')+pct(n);
const exactNumber=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
const demoControlIds=new Set(['n','minscore','maxscore','minpower','maxpower','mintroops','maxtroops','minstrength','maxstrength','stockinf','stockcav','slots']);
const originalPlan=renderPlan, originalTroopEditor=renderPlayerEditor;

function activatePage(id){
 activePage=id;
 for(const button of document.querySelectorAll('[data-tab]')){
  const selected=button.dataset.tab===id;
  button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
 }
 for(const panel of document.querySelectorAll('.tab'))panel.classList.toggle('active',panel.id===id);
 $('resultcontext').hidden=!['comparetab','plantab'].includes(id);
 $('tab-'+id).scrollIntoView({block:'nearest',inline:'nearest'});
}
function markResultsDirty(reason='Settings changed.'){
 if(result){resultsDirty=true;dirtyReason=reason;$('stale').hidden=false;$('stalereason').textContent=reason+' The graphs and schedule still show the last comparison.';}
 updateActionAvailability();
}
function updateActionAvailability(){
 const draft=stockDraft||memberDraft;
 $('stale').hidden=!result||!(resultsDirty||draft);
 if(result&&(resultsDirty||draft))$('stalereason').textContent=draft?'Player edits are not saved. Save or discard the edits on Alliance setup or Troop mixes before comparing.':dirtyReason+' The graphs and schedule still show the last comparison.';
 for(const id of ['save','exportcsv','svgexport','planexport','assignmentexport']){
  $(id).disabled=running||!result||(id==='save'?draft:resultsDirty||draft);
 }
 $('preview').disabled=running||stockDraft||memberDraft;
 for(const id of ['spreadevenly','fullsize','viewbest','simplelines','alllines','samplereports'])$(id).disabled=running;
 $('stockdraft').hidden=!stockDraft;
 if(stockDraft)$('previewstatus').textContent='Troop edits are not saved. The preview uses the last saved stock; save or discard the edits first.';
 if($('stockdiscard'))$('stockdiscard').hidden=!stockDraft;
}
busy=function(on,text=''){
 running=on;
 const selectors='aside input, aside select, #modeltab input, #modeltab select, #rostertable input, #membereditor input, #stockeditor input, #typeeditor input, #typeeditor select, #troopplayer, #previewhost, #previewcount, #previewsize, #reports';
 for(const input of document.querySelectorAll(selectors))input.disabled=on;
 for(const id of ['run','generate','search','fit','applyfit','load','rosterimport','applystock','estimatepower'])$(id).disabled=on;
 if(!on){$('applyfit').disabled=!fitted;updateFormationHelp();}
 $('busybar').style.display=on?'block':'none';$('main').setAttribute('aria-busy',String(on));
 $('status').textContent=text;$('error').style.display='none';updateActionAvailability();
 for(const el of document.querySelectorAll('#membereditor button, #rostertable button'))el.disabled=on;
};
showError=function(error){
 $('error').style.display='block';$('error').textContent=error.message||String(error);
 $('status').textContent='Nothing new was applied. Check the message above.';
};
function ensureSavedDrafts(){
 if(stockDraft||memberDraft){showError(new Error('Save or discard the player edits first. Troop edits are on Troop mixes; player details are on Alliance setup.'));return false;}
 return true;
}
run=async function(){
 if(!ensureSavedDrafts())return;
 const previous=result?.runs[chosen]?.strategy.name;
 busy(true,'Comparing rally plans. You can browse the other pages while this runs.');
 try{
  const request=JSON.parse(JSON.stringify(payload()));
  result=await api('compare',request);searchData=null;$('searchpanel').hidden=true;
  const previousIndex=result.runs.findIndex(r=>r.strategy.name===previous);
  chosen=previousIndex>=0?previousIndex:result.runs.reduce((best,r,i)=>r.total_damage>result.runs[best].total_damage?i:best,0);
  visible=new Set([0,chosen]);resultsDirty=false;$('stale').hidden=true;renderResults();
  busy(false,'Compared '+result.runs.length+' plans. Select a plan to inspect its score and schedule.');
 }catch(e){busy(false);showError(e);}
};
search=async function(){
 if(!ensureSavedDrafts())return;
 busy(true,'Searching plan combinations. This can take a minute or longer; you can browse other pages.');
 try{
  const request=JSON.parse(JSON.stringify(payload()));searchData=await api('search',request);result=await api('compare',request);
  result.runs.push(searchData.best);chosen=result.runs.length-1;result.runs[chosen].strategy.name='Search winner (sampled)';
  visible=new Set([0,chosen]);resultsDirty=false;$('stale').hidden=true;renderResults();$('searchpanel').hidden=false;
  $('searchnote').textContent=searchData.note+' Tested '+searchData.tested.length+' settings. The first row below has the highest estimated score.';
  $('searchtable').innerHTML=table(['Regular starters','Troops in own rally','Joining troop amount','Troop mix','Estimated score','Capacity used','Longest time with no hits'],searchData.tested.slice(0,12).map(r=>[r.strategy.host_count,ownNames[r.strategy.host_allocation],splitNames[r.strategy.troop_split],formationNames[r.strategy.formation],fmt(r.total_damage),pct(r.mean_fill),time(r.max_gap_s)]));
  busy(false,'Search finished. Selected the highest-scoring tested plan. This is not a guaranteed optimum.');
 }catch(e){busy(false);showError(e);}
};
function selectPlan(index,openSchedule=false){
 chosen=Number(index);$('planselect').value=chosen;visible.add(chosen);
 renderSelectedSummary();renderLegend();renderCharts();renderPlan();renderComparison();
 if(openSchedule)activatePage('plantab');
}
function renderSelectedSummary(){
 if(!result)return;const selected=result.runs[chosen],baseline=result.runs[0];
 $('selectedname').textContent='Selected plan: '+strategyTitle(selected.strategy);
 $('selecteddescription').textContent='Summary cards, rally schedule and player outcomes all use this plan.';
 $('bestdamage').textContent=fmt(selected.total_damage);$('bestlabel').textContent=selected.members.length+' participating players';
 $('uplift').textContent=baseline.total_damage?changeText(selected.total_damage/baseline.total_damage-1):'No baseline';
 $('gap').textContent=time(selected.summary.max_gap_s);$('fill').textContent=pct(selected.summary.mean_fill);
 $('rallycount').textContent=selected.summary.rallies+' rallies hit in time';
 $('eventlabel').textContent=(result.mechanics.duration_s/60)+'-minute event';
 const stockEstimates=result.roster.filter(m=>estimatedStocks.has(m.name)||m.infantry==null).length;
 $('notice').innerHTML='<b>'+(synthetic?'Demo alliance: these players are examples.':'Alliance inputs: '+stockEstimates+' of '+result.roster.length+' troop stocks are estimated.')+'</b> '+
  (result.normalization.enabled?'The everyone-starts-together baseline is scaled to '+fmt(result.normalization.target)+'. Gains show differences between plans, not a verified forecast.':'Scores use the current scale. Validate damage estimates with comparable battle reports.')+
  ' <button class="text-button" id="noticehelp">How to use these estimates</button>';
 $('noticehelp').onclick=()=>activatePage('modeltab');
}
function renderLegend(){
 if(!result)return;
 const wasOpen=$('legend').querySelector('details')?.open;
 const chips=result.runs.map((r,i)=>({r,i})).filter(x=>visible.has(x.i)).map(({r,i})=>'<span class="plan-chip"><span class="dot" style="background:'+colors[i%colors.length]+'"></span> '+esc(strategyTitle(r.strategy))+'</span>').join('');
 const choices=result.runs.map((r,i)=>'<label><input type="checkbox" data-line="'+i+'" '+(visible.has(i)?'checked':'')+'><span class="dot" style="background:'+colors[i%colors.length]+'"></span>'+esc(strategyTitle(r.strategy))+'</label>').join('');
 $('legend').innerHTML=chips+'<details class="plan-picker" '+(wasOpen?'open':'')+'><summary>Choose which plans appear on the graphs</summary><div class="legend">'+choices+'</div></details>';
 for(const checkbox of $('legend').querySelectorAll('input'))checkbox.onchange=()=>{checkbox.checked?visible.add(Number(checkbox.dataset.line)):visible.delete(Number(checkbox.dataset.line));renderLegend();renderCharts();};
}
function renderComparison(){
 if(!result)return;const base=result.runs[0];
 $('comparisontable').innerHTML='<table><thead><tr>'+['Plan','Estimated score','Change from baseline','Hits','Capacity used','Longest quiet time','Troops away from home','Action'].map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+result.runs.map((r,i)=>{
  const delta=base.total_damage?r.total_damage/base.total_damage-1:null;
  return '<tr class="'+(i===chosen?'selected':'')+'"><td><b>'+esc(strategyTitle(r.strategy))+'</b>'+(i===chosen?'<span class="pill">Selected</span>':'')+'<div class="fine">'+strategyShort(r.strategy)+'</div></td><td>'+fmt(r.total_damage)+'</td><td class="'+(delta>=0?'positive':'negative')+'">'+(delta===null?'No baseline':changeText(delta))+'</td><td>'+r.summary.rallies+'</td><td>'+pct(r.summary.mean_fill)+'</td><td>'+time(r.summary.max_gap_s)+'</td><td>'+pct(r.summary.troop_utilization)+'</td><td class="comparison-actions"><button data-view-plan="'+i+'" aria-label="View plan: '+esc(strategyTitle(r.strategy))+'">View plan</button></td></tr>';
 }).join('')+'</tbody></table>';
 for(const button of $('comparisontable').querySelectorAll('[data-view-plan]'))button.onclick=()=>selectPlan(button.dataset.viewPlan,true);
}
renderResults=function(){
 if(!result)return;updateBadge();renderSelectedSummary();renderLegend();renderComparison();
 const old=$('individual').value;
 $('individual').innerHTML=result.roster.slice().sort((a,b)=>b.historical_score-a.historical_score).map(m=>'<option>'+esc(m.name)+'</option>').join('');
 if(result.roster.some(m=>m.name===old))$('individual').value=old;
 $('planselect').innerHTML=result.runs.map((r,i)=>'<option value="'+i+'">'+esc(strategyTitle(r.strategy))+'</option>').join('');$('planselect').value=chosen;
 renderCharts();renderPlan();renderTroopProfiles();renderInventoryDiagnostics();updateActionAvailability();
};

// Every time chart has a labelled axis, an exact readout and a keyboard-operable time input.
chart=function(id,lines,{bar=false,unit='damage'}={}){
 const el=$(id),duration=result?.mechanics.duration_s||num('duration')*60;
 const names={alliancechart:'Alliance cumulative score',individualchart:'Player cumulative score',minutechart:'Score in each minute',usagechart:'Troops away from home'};
 const unitLabel=unit==='troops'?'Troops':'Estimated score';
 if(!lines.length){el.innerHTML='<div class="empty">No plans selected. Tick a plan above, or choose “Show baseline + selected plan”.</div>';return;}
 const W=960,H=320,L=78,R=22,T=35,B=60;
 const maxValue=Math.max(1,...lines.flatMap(l=>l.points.map(p=>p.y))),ymax=maxValue*1.08;
 const X=x=>L+x/duration*(W-L-R),Y=y=>H-B-y/ymax*(H-T-B);
 let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(names[id]||unitLabel)+'; time from event opening, zero to '+time(duration)+'"><title>'+esc(names[id]||unitLabel)+'</title><desc>'+esc(bar?'Each bar covers one minute.':unit==='troops'?'Troops currently waiting, travelling or returning.':'Score changes only when a rally hits; flat lines mean no new score.')+'</desc>';
 svg+='<text x="'+L+'" y="18" fill="#53665c" font-size="13">'+unitLabel+(unit==='troops'?'':' (k = thousand, M = million, B = billion)')+'</text>';
 for(let k=0;k<=4;k++){const y=ymax*k/4;svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(y)+'" y2="'+Y(y)+'" stroke="#dce5de"/><text x="'+(L-9)+'" y="'+(Y(y)+4)+'" text-anchor="end" fill="#53665c" font-size="12">'+fmt(y)+'</text>';}
 for(let k=0;k<=6;k++)svg+='<text x="'+X(duration*k/6)+'" y="'+(H-34)+'" text-anchor="middle" fill="#53665c" font-size="12">'+time(duration*k/6)+'</text>';
 svg+='<text x="'+(W/2)+'" y="'+(H-7)+'" text-anchor="middle" fill="#53665c" font-size="13">Time since event opened (minutes:seconds)</text>';
 lines.forEach((line,index)=>{
  if(bar){
   for(const point of line.points){const end=Math.min(point.x+60,duration);if(point.x>=duration)continue;svg+='<rect x="'+(X(point.x)+1)+'" y="'+Y(point.y)+'" width="'+Math.max(1,X(end)-X(point.x)-2)+'" height="'+(H-B-Y(point.y))+'" fill="'+line.color+'"><title>'+time(point.x)+' to '+time(end)+': '+exactNumber(point.y)+' '+unitLabel.toLowerCase()+'</title></rect>';}
  }else{
   let path='';for(const [i,point] of line.points.entries())path+=i?'H'+X(point.x)+'V'+Y(point.y):'M'+X(point.x)+','+Y(point.y);
   const end=line.points.at(-1);if(end&&end.x<duration)path+='H'+X(duration);
   svg+='<path d="'+path+'" fill="none" stroke="'+line.color+'" stroke-width="'+(index===0?'2.8':'3')+'" '+(index%3===1?'stroke-dasharray="8 3"':index%3===2?'stroke-dasharray="3 3"':'')+'><title>'+esc(line.name)+': final '+exactNumber(end?.y||0)+' '+unitLabel.toLowerCase()+'</title></path>';
  }
 });
 svg+='<line class="cross" x1="'+L+'" x2="'+L+'" y1="'+T+'" y2="'+(H-B)+'" stroke="#53665c" stroke-dasharray="4 4"/></svg>';
 const inputId=id+'-time',readId=id+'-readout';
 el.innerHTML=svg+'<div class="chart-inspect"><label for="'+inputId+'">Inspect '+(bar?'a minute':'an event time')+' <b id="'+id+'-clock">0:00</b><input id="'+inputId+'" type="range" min="0" max="'+(bar?Math.max(0,duration-60):duration)+'" step="'+(bar?60:1)+'" value="0"></label><div id="'+readId+'" class="chart-readout" aria-live="polite"></div></div>'+
  '<details class="summary-table"><summary>Read exact '+(bar?'minute totals':'final totals')+' as a table</summary>'+table(bar?['Minute','Estimated score']:['Plan',unitLabel+' at event end'],bar?lines[0].points.filter(p=>p.x<duration).map(p=>[time(p.x)+'–'+time(Math.min(p.x+60,duration)),exactNumber(p.y)]):lines.map(l=>[esc(l.name),exactNumber(l.points.at(-1)?.y||0)]))+'</details>';
 const cross=el.querySelector('.cross'),input=$(inputId),clock=$(id+'-clock'),readout=$(readId);
 function display(second){
  const eventTime=bar?Math.floor(second/60)*60:Math.floor(second);clock.textContent=time(eventTime)+(bar?'–'+time(Math.min(eventTime+60,duration)):'');
  input.value=eventTime;cross.setAttribute('x1',X(eventTime));cross.setAttribute('x2',X(eventTime));
  readout.innerHTML=lines.map(l=>{let value=0;for(const p of l.points){if(p.x>eventTime)break;value=p.y;}return '<span><b>'+esc(l.name)+':</b> '+exactNumber(value)+(unit==='troops'?' troops':' score')+'</span>';}).join('');
 }
 input.oninput=()=>display(Number(input.value));
 el.querySelector('svg').onpointermove=e=>{const bounds=e.currentTarget.getBoundingClientRect(),px=(e.clientX-bounds.left)/bounds.width*W;display(Math.max(0,Math.min(bar?duration-60:duration,(px-L)/(W-L-R)*duration)));};
 display(bar?0:duration);
};
renderCharts=function(){
 if(!result)return;const active=result.runs.map((r,i)=>({r,i})).filter(x=>visible.has(x.i));
 chart('alliancechart',active.map(({r,i})=>({name:strategyTitle(r.strategy),color:colors[i%colors.length],points:r.series.map(p=>({x:p.second,y:p.damage}))})));
 const name=$('individual').value;
 chart('individualchart',active.map(({r,i})=>({name:strategyTitle(r.strategy),color:colors[i%colors.length],points:(r.individual_series[name]||[]).map(p=>({x:p.second,y:p.damage}))})));
 const member=result.roster.find(m=>m.name===name);
 if(member)$('individualnote').textContent=exactNumber(member.troops)+' usable troops · '+member.join_slots+' joining marches + one separate own rally · Past event score '+fmt(member.historical_score)+' (reference only)';
 renderIndividualTypes(name);
};
renderPlan=function(){
 if(!result)return;originalPlan();const r=result.runs[chosen],duration=result.mechanics.duration_s;
 const baseline=result.runs[0];
 // Explicit selected-plan context prevents the headline/schedule mismatch in the old page.
 $('plantips').innerHTML='<h4>'+esc(strategyTitle(r.strategy))+'</h4>'+strategyExplanation(r.strategy,r.selected_hosts.length)+
  '<p><b>What to watch:</b> First scored hit '+time(r.summary.opening_wait_s)+'. '+r.members.filter(m=>m.damage<(baseline.members.find(b=>b.name===m.name)?.damage||0)).length+' players score less than in the baseline. Troop shortages and travel can delay starts.</p>';
 const eligible=result.roster.filter(m=>m.can_host),latest=eligible.length?Math.max(...eligible.map(m=>duration-result.mechanics.countdown_s-m.outbound_s-1)):null;
 $('cutoffhelp').innerHTML='<b>Only rallies that hit before '+time(duration)+' score.</b> '+(latest===null?'No player is currently allowed to start rallies.':latest<0?'No eligible player can hit in time with this countdown and travel.':'With these inputs, even the fastest eligible starter must begin by '+time(latest)+'. Each player’s exact latest safe start is shown below.')+' A 25:01 start is wasted in a 30-minute event with a five-minute countdown.';
 if(!r.hits.length)$('timelinechart').innerHTML='<div class="empty">No rallies hit before the event ended. Check countdown, travel, starter eligibility and troop stock.</div>';
 $('timelinecaption').textContent=r.hits.length+' scored hits, from '+(r.hits.length?time(r.hits[0].second):'—')+' to '+(r.hits.length?time(r.hits.at(-1).second):'—')+'. Read exact start times in the table below.';
 const hosts=[...new Set(r.rallies.map(x=>x.host))];
 $('scheduletable').innerHTML=table(['Rally starter','Rally troop capacity','Latest safe start','Actual start times (elapsed)','Hits','Whole-rally score'],hosts.map(name=>{
  const m=result.roster.find(x=>x.name===name),rr=r.rallies.filter(x=>x.host===name);
  const safe=duration-result.mechanics.countdown_s-m.outbound_s-1;
  return [esc(name),exactNumber(m.rally_capacity),safe<0?'Cannot hit in time':time(safe),rr.map(x=>time(x.start_s)).join(' / '),rr.filter(x=>x.hit_s<duration).length,fmt(rr.reduce((n,x)=>n+(x.damage||0),0))];
 }));
 $('memberresults').innerHTML=table(['Player','Personal estimated score','Change from baseline','Total attacks','Own rally hits','Joining hits','Troops away from home'],r.members.slice().sort((a,b)=>b.damage-a.damage).map(m=>{const b=baseline.members.find(x=>x.name===m.name);return [esc(m.name),fmt(m.damage),b.damage?changeText(m.damage/b.damage-1):'No baseline',m.attacks,m.rallies_led,m.joins,pct(m.troop_utilization)];}));
};

function renderMemberEditor(){
 const m=roster.find(x=>x.name===editingMember)||roster[0];if(!m)return;
 if(memberDraft&&editingMember===m.name)return;editingMember=m.name;
 const fieldDefinitions=[['name','Player name','text'],['march_capacity','Maximum troops per march','number'],['join_slots','Simultaneous joining marches','number'],['rally_capacity','Total rally troop capacity','number'],['outbound_s','Travel from city to Bear (seconds)','number'],['return_s','Return from Bear (seconds)','number'],['join_travel_s','Travel to another rally (seconds)','number'],['power_m','Account power (millions, reference only)','number'],['town_level','Town Center level (reference only)','number'],['historical_score','Past whole-event score (reference only)','number']];
 const input=([key,label,type])=>'<label class="control"><span>'+label+'</span><input id="member-'+key+'" data-member-field="'+key+'" type="'+type+'" '+(type==='number'?'min="0" step="'+(['power_m','host_strength','troop_quality'].includes(key)?'.01':'1')+'"':'')+' value="'+esc(m[key])+'"></label>';
 $('membereditor').innerHTML='<h4>Edit '+esc(m.name)+'</h4><div class="two">'+fieldDefinitions.map(input).join('')+'</div><label class="check"><input id="member-can_host" type="checkbox" '+(m.can_host?'checked':'')+'> This player may start rallies</label><p class="fine">Starting permission makes the player eligible. Each tested plan chooses how many eligible starters to use. The leader slot is separate from joining marches; they share troop stock.</p><details><summary>Advanced multipliers (optional)</summary><div class="two">'+[['host_strength','Leader multiplier','number'],['troop_quality','Whole-stock quality multiplier','number']].map(input).join('')+'</div><p class="fine">Keep multipliers at 1 unless you have evidence. Leader multiplier holds fixed hero and other effects not already entered as Attack/Lethality. Do not use account power as this multiplier. Whole-stock quality affects all troop types; avoid adding a tier improvement twice.</p></details><div class="toolbar"><button id="savemember" class="primary">Save player details</button><button id="memberdiscard">Discard detail edits</button><button id="membertroops">Enter this player’s troops</button></div><div id="memberdraftnote" class="fine" role="status">Details are saved only when you choose Save player details.</div>';
 for(const field of $('membereditor').querySelectorAll('input'))field.addEventListener('input',()=>{memberDraft=true;$('memberdraftnote').textContent='Unsaved player details. Save or discard before comparing.';updateActionAvailability();});
 $('savemember').onclick=saveMemberDetails;
 $('memberdiscard').onclick=()=>{memberDraft=false;renderMemberEditor();updateActionAvailability();};
 $('membertroops').onclick=()=>{if(!ensureSavedDrafts())return;$('troopplayer').value=m.name;renderPlayerEditor();activatePage('trooptab');};
}
async function saveMemberDetails(){
 const member=roster.find(x=>x.name===editingMember);if(!member)return;
 const draft={...member};for(const field of $('membereditor').querySelectorAll('[data-member-field]'))draft[field.dataset.memberField]=field.type==='text'?field.value.trim():Number(field.value);
 draft.can_host=$('member-can_host').checked;
 if(!draft.name||roster.some(x=>x!==member&&x.name===draft.name)){showError(new Error('Use a non-empty, unique player name.'));return;}
 $('savemember').disabled=true;
 try{
  await api('formation_plan',{member:draft,mechanics:payload().mechanics,strategy:strategy(),marches:1,march_size:Math.max(1,Math.min(draft.march_capacity,draft.troops))});
  const oldName=member.name,wasAbsent=absent.delete(oldName),wasEstimated=estimatedStocks.delete(oldName);
  Object.assign(member,draft);if(wasAbsent)absent.add(draft.name);if(wasEstimated)estimatedStocks.add(draft.name);
  editingMember=draft.name;memberDraft=false;renderRoster();updateBadge();markResultsDirty('Player details changed.');
  $('status').textContent='Saved '+draft.name+'. Compare rally plans to update the results.';
 }catch(e){showError(e);if($('savemember'))$('savemember').disabled=false;}
}
renderRoster=function(refreshProfiles=true){
 const query=$('memberfilter').value.trim().toLowerCase();
 const players=roster.map((m,index)=>({m,index})).filter(({m})=>m.name.toLowerCase().includes(query));
 $('rostertable').innerHTML=players.length?'<table><thead><tr>'+['Attending','Player (select to edit)','Usable troop stock','Maximum march','Joining marches','May start rallies'].map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+players.map(({m,index})=>'<tr class="'+(m.name===editingMember?'selected':'')+'"><td><input type="checkbox" aria-label="'+esc(m.name)+' attending" data-attend="'+index+'" '+(!absent.has(m.name)?'checked':'')+'></td><td><button class="text-button" data-edit-member="'+index+'">'+esc(m.name)+'</button></td><td>'+exactNumber(m.troops)+'<div class="fine">'+(estimatedStocks.has(m.name)||m.infantry==null?'Estimated stock':'Entered stock')+'</div></td><td>'+exactNumber(m.march_capacity)+'</td><td>'+m.join_slots+'</td><td>'+(m.can_host?'Yes':'No')+'</td></tr>').join('')+'</tbody></table>':'<p>No players match that name.</p>';
 for(const input of $('rostertable').querySelectorAll('[data-attend]'))input.onchange=()=>{const name=roster[Number(input.dataset.attend)].name;input.checked?absent.delete(name):absent.add(name);updateBadge();markResultsDirty('Attendance changed.');};
 for(const button of $('rostertable').querySelectorAll('[data-edit-member]'))button.onclick=()=>{
  if(memberDraft){showError(new Error('Save or discard the current player’s detail edits before choosing another player.'));return;}
  editingMember=roster[Number(button.dataset.editMember)].name;renderRoster(false);
  $('membereditor').scrollIntoView({block:'nearest'});
 };
 renderMemberEditor();if(refreshProfiles)renderTroopProfiles();renderInventoryDiagnostics();
};
renderPlayerEditor=function(){
 const selected=$('troopplayer').value;
 if(stockDraft){$('troopplayer').value=editingTroops;if(selected!==editingTroops)showError(new Error('Save or discard this player’s troop edits before choosing another player.'));return;}
 const same=selected===editingTroops,previousCount=num('previewcount'),previousSize=num('previewsize');
 originalTroopEditor();editingTroops=selected;
 const m=roster.find(x=>x.name===selected);if(!m)return;
 if(same){$('previewcount').value=previousCount;$('previewsize').value=Math.min(m.march_capacity,previousSize);}
 else $('previewsize').value=Math.max(1,Math.min(m.march_capacity,Math.ceil(m.troops/Math.max(1,m.join_slots))));
 // Round descriptive power instead of displaying long interpolation decimals.
 const info=$('stockeditor').querySelector('.fine');
 if(info)info.textContent=exactNumber(m.troops)+' usable troops · '+exactNumber(m.march_capacity)+' maximum march · '+m.join_slots+' joining marches + one own rally · '+exactNumber(m.power_m)+'M account power';
 for(const input of document.querySelectorAll('#stockeditor input, #typeeditor input, #typeeditor select'))input.addEventListener('input',()=>{stockDraft=true;updateActionAvailability();});
 if(!same)previewChosen='inventory';updateActionAvailability();
};
// The profile refresh after a saved troop edit must not silently replace the wave size.
const originalSaveTroops=savePlayer;
savePlayer=async function(){
 const name=$('troopplayer').value;
 stockDraft=false;$('error').style.display='none';$('applystock').disabled=true;
 await originalSaveTroops();$('applystock').disabled=false;
 if($('error').style.display==='block'){stockDraft=true;updateActionAvailability();return;}
 markResultsDirty('Troop counts or troop bonuses changed.');
 $('status').textContent='Saved '+name+' and refreshed the troop comparison. Compare rally plans to update the event results.';
 updateActionAvailability();
};
const applyFitCore=$('applyfit').onclick;
$('applyfit').onclick=()=>{applyFitCore();markResultsDirty('Leader multipliers changed.');};
const originalEstimate=estimatePlayerStock;
estimatePlayerStock=function(){
 if(stockDraft){showError(new Error('Save or discard entered troop edits before replacing them with an estimate.'));return;}
 $('error').style.display='none';originalEstimate();if($('error').style.display!=='block')markResultsDirty('A player’s troop stock was estimated.');
};

updateFormationHelp=function(){
 const s=strategy(),sqrt=$('damagemodel').value==='sqrt';
 $('formationhelp').textContent=formationExplanation(s);
 $('ratioreadout').innerHTML='<b>'+esc(ratioText(s))+'</b>Ratios always mean infantry / cavalry / archers.';
 $('exponent').disabled=running||sqrt;$('damagescope').disabled=running||!sqrt;
 $('spacing').disabled=running||s.cadence!=='custom';$('small').disabled=running||s.host_allocation!=='small';
 $('scale').disabled=running||$('normalize').checked;$('target').disabled=running||!$('normalize').checked;
 $('customhelp').textContent=s.cadence==='staggered'?'Initial starts are spread across one countdown + travel + return cycle. Each starter then repeats independently.':s.cadence==='waves'?'First starts are grouped at 0:00, 1:30 and 3:00. Each starter then repeats independently.':s.cadence==='custom'?'Each initial starter begins '+s.spacing_s+' seconds after the previous one. Later cycles repeat independently.':'All eligible selected starters begin at 0:00. Each restarts after its own troops return.';
 renderInventoryDiagnostics();
};

// Shorter names remain accompanied by specific explanations in the plan and preview.
formationNames.inventory='Use available troop types';formationNames.strict='Keep ratio; send fewer troops';formationNames.adaptive='Aim for ratio; fill the march';formationNames.optimized='Choose mix with damage model';
const oldTitle=strategyTitle;
strategyTitle=function(s){
 const names={'All hosts · synchronized baseline':'Everyone starts together (baseline)','All hosts · evenly staggered':'Everyone spreads rally starts','Selected hosts · next impact':'Selected starters; join the first hit','Selected hosts · efficient joins':'Selected starters; score per time away','Selected hosts · small host marches':'Selected starters; small own marches','Selected hosts · concentrated troops':'Selected starters; fill joining marches','Three waves · efficient joins':'Selected starters; three start groups','Your custom strategy':'Your plan settings','Search winner (sampled)':'Best plan found in the search'};
 return names[s.name]||(s.name.startsWith('Formation test')?'Your settings + '+formationNames[s.formation].toLowerCase():oldTitle(s));
};

for(const button of document.querySelectorAll('[data-tab]')){
 button.onclick=()=>activatePage(button.dataset.tab);
 button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],i=tabs.indexOf(button);const target=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];activatePage(target.dataset.tab);target.focus();};
}
for(const button of document.querySelectorAll('[data-go]'))button.onclick=()=>activatePage(button.dataset.go);
$('toggleSettings').onclick=()=>{const open=document.body.classList.toggle('settings-open');$('toggleSettings').setAttribute('aria-expanded',String(open));$('toggleSettings').textContent=open?'Hide plan settings':'Show plan settings';if(open)document.querySelector('aside').scrollIntoView({block:'start'});};
$('simplelines').onclick=()=>{visible=new Set([0,chosen]);renderLegend();renderCharts();};
$('alllines').onclick=()=>{visible=new Set(result.runs.map((r,i)=>i));renderLegend();renderCharts();};
$('viewbest').onclick=()=>selectPlan(result.runs.reduce((b,r,i)=>r.total_damage>result.runs[b].total_damage?i:b,0));
$('planselect').onchange=()=>selectPlan($('planselect').value);
$('save').textContent='Save alliance file';
$('load').onclick=()=>{if(ensureSavedDrafts())$('projectfile').click();};
$('rosterimport').onclick=()=>{if(ensureSavedDrafts())$('rosterfile').click();};
$('run').onclick=run;$('refreshresults').onclick=run;$('search').onclick=search;
$('troopplayer').onchange=renderPlayerEditor;$('applystock').onclick=savePlayer;$('estimatepower').onclick=estimatePlayerStock;
$('memberfilter').oninput=()=>renderRoster(false);
$('samplereports').onclick=()=>{$('reports').value='host,troops,damage,infantry,cavalry,archers,infantry_tier,cavalry_tier,archers_tier\n'+(roster.at(-1)?.name||'Leader name')+',50000,9000000,5000,5000,40000,8,8,8';};
$('fullsize').onclick=()=>{if(!ensureSavedDrafts())return;const m=roster.find(x=>x.name===$('troopplayer').value);$('previewsize').value=m.march_capacity;previewFormations();};
const discardButton=document.createElement('button');discardButton.id='stockdiscard';discardButton.textContent='Discard troop edits';discardButton.hidden=true;$('applystock').parentElement.append(discardButton);
discardButton.onclick=()=>{stockDraft=false;renderPlayerEditor();updateActionAvailability();};
function invalidatePreview(){
 if(!fleetPreview)return;
 fleetPreview=null;$('formationcomparison').innerHTML='';$('marchdetails').innerHTML='';
 $('previewstatus').textContent='Troop-mix or damage settings changed. Choose Compare troop mixes to update the preview.';
 $('stockcheck').textContent='Compare troop mixes to check the current target and damage settings.';
}
for(const id of controls)$(id).addEventListener('change',()=>{updateFormationHelp();if(!demoControlIds.has(id))markResultsDirty('Rally-plan or model settings changed.');if(['formation','ratioinf','ratiocav','damagemodel','damagescope','counter','volley','bearbonus'].includes(id))invalidatePreview();});
for(const id of ['previewcount','previewsize','previewhost'])$(id).addEventListener('change',()=>{$('previewstatus').textContent='Wave settings changed. Choose Compare troop mixes to update this preview.';$('formationcomparison').innerHTML='';$('marchdetails').innerHTML='';fleetPreview=null;$('stockcheck').textContent='Compare troop mixes to check these wave settings.';});
const generateDemo=generate;
generate=async function(){
 if(!ensureSavedDrafts())return;
 editingMember=null;editingTroops=null;$('memberfilter').value='';await generateDemo();
 if(!result)return;
 await previewFormations();
};
$('generate').onclick=async()=>{
 if(!ensureSavedDrafts())return;
 // Reversible in-session replacement with undo, rather than an unexpected loss of entered players.
 const backup={roster:JSON.parse(JSON.stringify(roster)),absent:[...absent],estimated:[...estimatedStocks],synthetic};
 await generate();
 if($('error').style.display==='block')return;
 $('status').innerHTML='Created demo players. <button id="undodemo" class="text-button">Undo demo replacement</button>';
 $('undodemo').onclick=async()=>{roster=backup.roster;absent=new Set(backup.absent);estimatedStocks=new Set(backup.estimated);synthetic=backup.synthetic;editingMember=null;editingTroops=null;renderRoster();await run();};
};
// Bad imports must leave the current alliance usable. Keep a transaction snapshot
// around the existing parsers and worker validation, including control settings.
for(const id of ['projectfile','rosterfile']){
 const importCore=$(id).onchange;
 $(id).onchange=async event=>{
  if(!event.target.files?.length)return;
  const backup={roster:JSON.parse(JSON.stringify(roster)),absent:[...absent],estimated:[...estimatedStocks],synthetic,result,searchData,chosen,visible:[...visible],dirty:resultsDirty,reason:dirtyReason,editingMember,editingTroops,controls:Object.fromEntries(controls.map(key=>[key,$(key).type==='checkbox'?$(key).checked:$(key).value])),reports:$('reports').value};
  $('error').style.display='none';await importCore(event);
  if($('error').style.display==='block'){
   const error=$('error').textContent;roster=backup.roster;absent=new Set(backup.absent);estimatedStocks=new Set(backup.estimated);synthetic=backup.synthetic;result=backup.result;searchData=backup.searchData;chosen=backup.chosen;visible=new Set(backup.visible);resultsDirty=backup.dirty;dirtyReason=backup.reason;editingMember=backup.editingMember;editingTroops=backup.editingTroops;
   for(const [key,value]of Object.entries(backup.controls))$(key).type==='checkbox'?$(key).checked=value:$(key).value=value;
   $('reports').value=backup.reports;renderRoster();if(result)renderResults();busy(false);showError(new Error('Could not load the file. Your previous alliance was restored. '+error));
  }else{$('memberfilter').value='';editingMember=null;renderRoster();$('status').textContent='Alliance file loaded. Results have been recomputed from its inputs.';}
 };
}
activatePage('comparetab');updateFormationHelp();generate();
