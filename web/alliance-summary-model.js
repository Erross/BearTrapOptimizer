/* Shared summaries use submitted inventory, never inferred troop counts. */
(function(root){
'use strict';
const M=root.BearPersonalModel,TYPES=M.TYPES,STALE_MS=7*86400000;
function timestamp(value){
 if(value===null||value===undefined||value==='')return null;
 const ms=typeof value==='number'?value*1000:Date.parse(value);
 return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
function submitted(record){
 if(!record.input)return null;
 M.build(record.input);
 const stock=M.matrix(record.input.stock),lower=Object.fromEntries(TYPES.map(k=>[k,record.input.ownEnabled&&record.input.ownTier==='lower'?Number(record.input.ownTroops[k]||0):0]));
 const types=Object.fromEntries(TYPES.map(k=>[k,M.TIERS.reduce((n,t)=>n+stock[t][k],0)+lower[k]]));
 const updatedAt=timestamp(record.updatedAt);if(!updatedAt)throw Error('Submission timestamp is missing.');
 return {stock,lower,types,total:TYPES.reduce((n,k)=>n+types[k],0),joins:Number(record.input.joinMarches),presets:Number(record.input.presets),own:record.input.ownEnabled,updatedAt};
}
function rows(plan,snapshot,records,now=Date.now()){
 const members=new Map(snapshot.members.map(m=>[String(m.governor_id??m.fid),m]));
 return plan.players.filter(p=>p.active).map(p=>{
  const member=members.get(p.governorId)||{},record=records.get(p.governorId),data=record?.data||null;
  return {id:p.governorId,name:p.api.name,level:p.api.townLevel||null,power:p.api.power,rank:member.alliance_rank_label||'Member',x:p.api.x,y:p.api.y,positionAt:timestamp(p.api.cachedAt),data,
   status:record?.error?'unavailable':!record?'loading':!data?'missing':now-Date.parse(data.updatedAt)>=STALE_MS?'stale':'saved'};
 });
}
function totals(people){
 const saved=people.filter(p=>p.data),types=Object.fromEntries(TYPES.map(k=>[k,saved.reduce((n,p)=>n+p.data.types[k],0)]));
 return {checking:people.filter(p=>p.status==='loading').length,members:people.length,saved:saved.length,missing:people.filter(p=>p.status==='missing').length,unavailable:people.filter(p=>p.status==='unavailable').length,stale:people.filter(p=>p.status==='stale').length,total:TYPES.reduce((n,k)=>n+types[k],0),types,
 levels:[...new Set(people.map(p=>p.level).filter(Boolean))].sort((a,b)=>b-a).map(level=>({level,count:people.filter(p=>p.level===level).length}))};
}
function view(people,search='',filter='all',sort='name'){
 const needle=search.trim().toLocaleLowerCase();
 const selected=people.filter(p=>p.name.toLocaleLowerCase().includes(needle)&&(filter==='all'||filter==='saved'&&p.data||p.status===filter));
 const val=p=>sort==='power'?p.power:sort==='level'?p.level:sort==='troops'?p.data?.total:sort==='oldest'||sort==='newest'?p.data?Date.parse(p.data.updatedAt):null:p.name;
 return selected.sort((a,b)=>{const av=val(a),bv=val(b);if(av==null||bv==null)return av==null?(bv==null?a.name.localeCompare(b.name):1):-1;return (sort==='name'?av.localeCompare(bv):(av-bv)*(sort==='oldest'?1:-1))||a.name.localeCompare(b.name);});
}
root.BearAllianceSummary={timestamp,submitted,rows,totals,view};
})(typeof globalThis!=='undefined'?globalThis:this);
