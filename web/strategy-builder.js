/* Named strategy snapshots share one alliance and one damage reference. */
'use strict';
let addedStrategies=[],editingStrategy=null,strategyEditorBase=null;
const maxAddedStrategies=6;
const cloneStrategyData=value=>JSON.parse(JSON.stringify(value));

function nextStrategyName(prefix='My strategy'){
 const used=new Set([...approachNames,...addedStrategies.map(p=>p.strategy.name)].map(n=>n.toLowerCase()));
 const base=prefix.trim().slice(0,58);let name=base,index=2;
 while(used.has(name.toLowerCase()))name=base+' '+index++;
 return name;
}
function validateStrategySnapshots(rows){
 if(!Array.isArray(rows)||rows.length>maxAddedStrategies)throw Error('Compare up to six added strategies. Remove one before adding another.');
 const used=new Set(approachNames.map(n=>n.toLowerCase()));
 return rows.map(row=>{
  if(!row||!row.strategy||typeof row.strategy!=='object'||Array.isArray(row.strategy))throw Error('Each saved strategy needs its own settings.');
  const name=row.strategy.name;
  if(typeof name!=='string'||!name.trim()||name.trim().length>64)throw Error('Give each strategy a name of 1–64 characters.');
  if(used.has(name.trim().toLowerCase()))throw Error('Each strategy needs a different name.');
  used.add(name.trim().toLowerCase());
  const capMode=row.capMode||(row.strategy.join_march_cap?'fixed':'none');
  if(!['none','fixed','dial'].includes(capMode))throw Error('Choose no troop cap, a fixed cap, or the front-page dial.');
  return {strategy:{...cloneStrategyData(row.strategy),name:name.trim()},capMode};
 });
}
function resolvedAddedStrategies(){
 return validateStrategySnapshots(addedStrategies).map(({strategy:s,capMode})=>({...s,
  join_march_cap:capMode==='dial'?num('joinmarchcap'):capMode==='none'?0:s.join_march_cap}));
}
function syncAddedStrategyResults(runs){
 addedStrategies=addedStrategies.map(p=>({...p,strategy:cloneStrategyData(runs.find(r=>r.strategy.name===p.strategy.name).strategy)}));
}
function addStrategySnapshot(strategy,capMode='fixed'){
 addedStrategies=validateStrategySnapshots([...addedStrategies,{strategy,capMode}]);
 markResultsDirty('Added strategy settings changed.');renderAddedStrategies();
}
function strategyMixLabel(s){
 if(s.formation==='inventory')return 'Available troop mix';
 if(s.formation==='optimized')return 'Mix chosen by damage model';
 return s.infantry_pct+' / '+s.cavalry_pct+' / '+Number((100-s.infantry_pct-s.cavalry_pct).toFixed(2))+' · '+(s.formation==='strict'?'strict ratio':'target + fill');
}
function renderAddedStrategies(){
 $('strategycount').textContent=addedStrategies.length?'('+addedStrategies.length+' / '+maxAddedStrategies+' added)':'';
 $('strategylist').hidden=!addedStrategies.length;
 $('strategylist').innerHTML=addedStrategies.map((p,i)=>{
  const s=p.strategy,cap=p.capMode==='dial'?'front-page dial ('+Math.round(num('joinmarchcap')).toLocaleString()+')':p.capMode==='none'||!s.join_march_cap?'none':Math.round(s.join_march_cap).toLocaleString()+' fixed';
  return '<div class="saved-strategy"><div><strong>'+esc(s.name)+'</strong><p>'+esc(strategyMixLabel(s))+' · '+s.host_count+' starters · '+esc(patternText(s))+' · join cap: '+esc(cap)+'</p></div><div class="saved-actions"><button type="button" data-edit-strategy="'+i+'" aria-label="Edit '+esc(s.name)+'">Edit</button><button type="button" data-copy-strategy="'+i+'" aria-label="Duplicate '+esc(s.name)+'">Duplicate</button><button type="button" data-remove-strategy="'+i+'" aria-label="Remove '+esc(s.name)+'">Remove</button></div></div>';
 }).join('');
 for(const b of $('strategylist').querySelectorAll('[data-edit-strategy]'))b.onclick=()=>openStrategyEditor(Number(b.dataset.editStrategy));
 for(const b of $('strategylist').querySelectorAll('[data-copy-strategy]'))b.onclick=()=>duplicateAddedStrategy(Number(b.dataset.copyStrategy));
 for(const b of $('strategylist').querySelectorAll('[data-remove-strategy]'))b.onclick=()=>removeAddedStrategy(Number(b.dataset.removeStrategy));
 setStrategyBuilderBusy(running);
}
function setStrategyBuilderBusy(on){
 $('addstrategy').disabled=on||addedStrategies.length>=maxAddedStrategies;
 for(const el of $('strategyeditor').querySelectorAll('input, select, button'))el.disabled=on;
 for(const el of $('strategylist').querySelectorAll('button'))el.disabled=on;
 if(!on)updateStrategyEditorFields();
}
function fillStrategyEditor(s,capMode){
 strategyEditorBase=cloneStrategyData(s);
 const values={planname:s.name,planhosts:s.host_count,plancadence:s.cadence,planwaves:s.opening_wave_count||Math.max(1,Math.ceil(s.host_count/(s.group_size||10))),plangap:s.wave_interval_s??60,planformation:s.formation,planinf:s.infantry_pct,plancav:s.cavalry_pct,plancapmode:capMode,plancap:s.join_march_cap||num('joinmarchcap'),planown:s.host_allocation,planownpct:100*(s.small_host_fraction??.05),plansplit:s.troop_split,planjoin:s.join_policy,planspacing:s.spacing_s??25,planrepeat:s.group_repeat||'ready',plancycle:s.wave_cycle_s||0};
 values.planjoinwindow=s.join_window_s??0;for(const [id,value]of Object.entries(values))$(id).value=value;$('planfirstwave').checked=!!s.first_wave_join;
 updateStrategyEditorFields();
}
function openStrategyEditor(index=null){
 if(running)return;
 if(index===null&&addedStrategies.length>=maxAddedStrategies){showError(Error('Remove a strategy before adding another.'));return;}
 editingStrategy=index;
 const source=index===null?result.runs[chosen].strategy:addedStrategies[index].strategy;
 const settings={...source,name:index===null?nextStrategyName('My strategy'):source.name};
 $('strategyeditortitle').textContent=index===null?'Add a strategy':'Edit strategy';
 $('strategycommit').textContent=index===null?'Add & compare':'Save & compare';
 $('plantemplate').innerHTML=result.runs.map((r,i)=>'<option value="'+i+'">'+esc(strategyTitle(r.strategy))+'</option>').join('');
 $('plantemplate').value=String(index===null?chosen:6+index);
 $('plantemplate').disabled=index!==null;
 fillStrategyEditor(settings,index===null?(settings.join_march_cap?'fixed':'none'):addedStrategies[index].capMode);
 $('strategyeditor').hidden=false;$('planname').focus();
}
function updateStrategyEditorFields(){
 const targeted=['strict','adaptive'].includes($('planformation').value);
 $('planinf').disabled=running||!targeted;$('plancav').disabled=running||!targeted;
 const archers=100-num('planinf')-num('plancav');
 $('planarchers').textContent=Number.isFinite(archers)&&archers>=0?Number(archers.toFixed(2))+'%':'Check percentages';
 $('planmixnote').textContent=$('planformation').value==='inventory'?'Uses troop types available at each dispatch.':$('planformation').value==='optimized'?'The chosen damage model selects the next march’s mix.':$('planformation').value==='strict'?'Keeps the target ratio; sends fewer troops if a type runs out.':'Aims for the target ratio, then fills spare space with available troops.';
 $('plancap').disabled=running||$('plancapmode').value!=='fixed';
 $('planownpct').disabled=running||$('planown').value!=='small';
 $('planwaves').disabled=running||$('plancadence').value!=='groups';
 $('plangap').disabled=running||$('plancadence').value!=='groups';
 $('planspacing').disabled=running||$('plancadence').value!=='custom';
 $('plancycle').disabled=running||$('plancadence').value!=='groups'||$('planrepeat').value!=='fixed';
 $('plantemplate').disabled=running||editingStrategy!==null;
}
function readStrategyEditor(){
 const invalid=(message,fields)=>{const error=Error(message);error.fields=fields;throw error;};
 const s={...strategyEditorBase,first_wave_join:$('planfirstwave').checked,join_window_s:num('planjoinwindow'),name:$('planname').value.trim(),host_names:[],host_count:num('planhosts'),cadence:$('plancadence').value,
  opening_wave_count:num('planwaves'),wave_interval_s:num('plangap'),formation:$('planformation').value,infantry_pct:num('planinf'),cavalry_pct:num('plancav'),
  join_march_cap:$('plancapmode').value==='none'?0:$('plancapmode').value==='dial'?num('joinmarchcap'):num('plancap'),
  host_allocation:$('planown').value,small_host_fraction:num('planownpct')/100,troop_split:$('plansplit').value,join_policy:$('planjoin').value,
  spacing_s:num('planspacing'),group_repeat:$('planrepeat').value,wave_cycle_s:num('plancycle')};
 if(!Number.isInteger(s.join_window_s)||s.join_window_s<0||s.join_window_s>600)throw Error('Joining window must be 0–600 seconds.');
 const whole=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(!whole(s.host_count,1,100)||!whole(s.opening_wave_count,1,100)||!whole(s.wave_interval_s,0,600))throw Error('Use 1–100 starters and waves, and a 0–600s wave interval.');
 if(['strict','adaptive'].includes(s.formation)&&(![s.infantry_pct,s.cavalry_pct].every(v=>Number.isFinite(v)&&v>=0&&v<=100)||s.infantry_pct+s.cavalry_pct>100))invalid('Infantry and cavalry must total at most 100%. Archers use the remainder.',['planinf','plancav']);
 if(!whole(s.join_march_cap,0,2000000)||($('plancapmode').value==='fixed'&&!s.join_march_cap))throw Error('Use a positive fixed troop cap, or choose no cap.');
 if(!Number.isFinite(s.small_host_fraction)||s.small_host_fraction<.00001||s.small_host_fraction>1)throw Error('Own-rally troops must be greater than 0% and at most 100% of a march.');
 return {strategy:s,capMode:$('plancapmode').value};
}
async function applyStrategySnapshots(next,selectedName){
 const previous=cloneStrategyData(addedStrategies),previousDirty=resultsDirty,previousReason=dirtyReason;
 addedStrategies=validateStrategySnapshots(next);markResultsDirty('Strategy comparison changed.');renderAddedStrategies();
 if(await run({selectedName,preserveLines:true}))return true;
 addedStrategies=previous;resultsDirty=previousDirty;dirtyReason=previousReason;renderAddedStrategies();updateActionAvailability();return false;
}
async function commitStrategyEditor(event){
 event?.preventDefault();if(running)return;
 try{
  const next=cloneStrategyData(addedStrategies),row=readStrategyEditor();
  if(editingStrategy===null)next.push(row);else next[editingStrategy]=row;
  if(await applyStrategySnapshots(next,row.strategy.name)){$('strategyeditor').hidden=true;editingStrategy=null;}
 }catch(error){showError(error);}
}
async function duplicateAddedStrategy(index){
 if(running)return;
 try{const row=cloneStrategyData(addedStrategies[index]);row.strategy.name=nextStrategyName(row.strategy.name+' copy');await applyStrategySnapshots([...addedStrategies,row],row.strategy.name);}
 catch(error){showError(error);}
}
async function removeAddedStrategy(index){
 if(running)return;
 try{if(await applyStrategySnapshots(addedStrategies.filter((_,i)=>i!==index))){$('strategyeditor').hidden=true;editingStrategy=null;}}
 catch(error){showError(error);}
}
function allianceProjectSnapshot(){
 return {version:2,roster,estimatedStocks:[...estimatedStocks],absent:[...absent],synthetic,
  controls:Object.fromEntries(controls.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),reports:$('reports').value,addedStrategies:cloneStrategyData(addedStrategies),
  ...(window.BearAllianceUI?{alliancePlan:window.BearAllianceUI.snapshot()}:{})};
}
function initializeStrategyBuilder(){
 $('addstrategy').onclick=()=>openStrategyEditor();$('strategyeditor').onsubmit=commitStrategyEditor;
 $('strategycancel').onclick=()=>{$('strategyeditor').hidden=true;editingStrategy=null;};
 $('plantemplate').onchange=()=>{const name=$('planname').value,s=result.runs[Number($('plantemplate').value)].strategy;fillStrategyEditor({...s,name},s.join_march_cap?'fixed':'none');};
 for(const id of ['planformation','plancapmode','planown','plancadence','planrepeat'])$(id).onchange=updateStrategyEditorFields;
 for(const id of ['planinf','plancav'])$(id).oninput=updateStrategyEditorFields;
 for(const [id,inf,cav]of [['planmix80',10,10],['planmix60',20,20]])$(id).onclick=()=>{if(!['strict','adaptive'].includes($('planformation').value))$('planformation').value='adaptive';$('planinf').value=inf;$('plancav').value=cav;updateStrategyEditorFields();};
 $('save').onclick=()=>{try{download('bear-trap-project.json',JSON.stringify(allianceProjectSnapshot(),null,2),'application/json');}catch(error){showError(error);}};
 const importProject=$('projectfile').onchange;
 $('projectfile').onchange=async event=>{
  if(!event.target.files?.length)return;
  const previous=cloneStrategyData(addedStrategies);
  try{
   const project=JSON.parse(await event.target.files[0].text());
   addedStrategies=validateStrategySnapshots('addedStrategies' in project?project.addedStrategies:[]);
   await importProject(event);
   if($('error').style.display==='block')addedStrategies=previous;
   else{$('strategyeditor').hidden=true;editingStrategy=null;}
  }catch(error){addedStrategies=previous;showError(error);event.target.value='';}
  renderAddedStrategies();if(result)renderResults();
 };
 renderAddedStrategies();
}
