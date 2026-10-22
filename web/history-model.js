/* Historical observations retain their source dates and units. */
(function(root){
'use strict';
const metrics={power:'Power',townLevel:'Town Center level',total:'Submitted troops',infantry:'Infantry',cavalry:'Cavalry',archers:'Archers',t10:'T10 troops',t9:'T9 troops',t8:'T8 troops'};
function series(history,metric,days=0,now=Date.now()){
 if(!Object.hasOwn(metrics,metric))throw Error('Unknown history metric.');
 const troop=!['power','townLevel'].includes(metric),source=history[troop?'troops':'power']||[];
 return source.map(p=>{
  let value=metric==='power'||metric==='townLevel'?p[metric]:metric==='total'?p.total:metric.startsWith('t')?Object.values(p.stock?.[metric.slice(1)]||{}).reduce((n,v)=>n+v,0):p.types?.[metric];
  if(troop&&history.id==='alliance'&&!p.reported)value=null;
  const cohort=troop&&history.id==='alliance'?JSON.stringify([p.memberIds,p.rosterIds]):undefined;
  return {at:p.at,time:Date.parse(p.at),value,capturedAt:p.capturedAt,revision:p.revision,cohort,reported:p.reported,members:p.members,carried:p.carried,oldestSubmission:p.oldestSubmission};
 }).filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.value)&&p.value>=0&&(!days||p.time>=now-days*86400000)).sort((a,b)=>a.time-b.time);
}
function comparable(a,b){return a?.cohort===b?.cohort;}
function change(points){
 if(points.length<2||!comparable(points[0],points.at(-1)))return null;
 const first=points[0].value,last=points.at(-1).value;
 return {amount:last-first,percent:first?(last-first)/first*100:null};
}
root.BearHistory={metrics,series,change,comparable};
if(typeof module!=='undefined')module.exports=root.BearHistory;
})(typeof globalThis!=='undefined'?globalThis:this);
