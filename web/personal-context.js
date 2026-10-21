/* Share the selected, current comparison with the separate personal planner. */
(function(){
'use strict';
function capturePersonalContext(){
 try{
  const ui=window.BearAllianceUI;
  if(!ui?.active()||!result||resultsDirty){localStorage.removeItem('BearTrapOptimizer:personal-context:v1');return;}
  const plan=ui.snapshot(),run=result.runs[chosen],byName=new Map(plan.players.map(p=>[BearAllianceModel.engineName(p),p]));
  const times=[...new Set(Object.values(run.planned_initial_starts).filter(Number.isFinite))].sort((a,b)=>a-b);
  const players={};
  for(const row of result.roster){
   const p=byName.get(row.name);if(!p)continue;
   players[p.governorId]={name:p.api.name,selectedHost:run.selected_hosts.includes(row.name),start:run.initial_starts[row.name]??null,
    plannedStart:run.planned_initial_starts[row.name]??null,group:times.indexOf(run.planned_initial_starts[row.name])+1,
    travel:row.outbound_s,returnSeconds:row.return_s,capacity:row.march_capacity,joinMarches:row.join_slots};
  }
  localStorage.setItem('BearTrapOptimizer:personal-context:v1',JSON.stringify({version:1,at:new Date().toISOString(),fingerprint:BearPersonalModel.fingerprint(plan),
   name:run.strategy.name,comparisonGroup:plan.comparisonGroup,geo:['1','2'].includes(plan.comparisonGroup),strategy:run.strategy,
   mechanics:result.mechanics,cycle:run.group_cycle_s||0,players}));
 }catch(_){/* Planning remains usable without browser storage. */}
}
const previous=renderAdvisor;
renderAdvisor=function(){previous();capturePersonalContext();};
const link=document.getElementById('optimizemelink');if(link)link.addEventListener('click',capturePersonalContext);
})();
