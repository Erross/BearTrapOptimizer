(function(){
'use strict';
const $=id=>document.getElementById(id),A=BearAllianceModel,S=BearAllianceSummary,M=BearPersonalModel;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString(),dateOptions={year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'};
const date=v=>v?new Date(v).toLocaleString(undefined,dateOptions):'Unknown',time=v=>v?'<time datetime="'+esc(v)+'">'+esc(date(v))+'</time>':'Unknown';
let plan,snapshot,records=new Map(),busy=false;
const names={infantry:'Infantry',cavalry:'Cavalry',archers:'Archers'},statuses={loading:'Checking…',missing:'No submission',unavailable:'Could not check',saved:'Submitted',stale:'7+ days old'};
function render(){
 const rows=S.rows(plan,snapshot,records),total=S.totals(rows),shown=S.view(rows,$('summarysearch').value,$('summaryfilter').value,$('summarysort').value);
 const cards=[['Roster members',fmt(total.members),'All current members in the published snapshot.'],['Troop submissions',total.saved+' / '+total.members,total.missing+' missing · '+total.stale+' older than 7 days · '+total.unavailable+' unavailable'+(total.checking?' · '+total.checking+' checking':'')],['Submitted troops',total.saved?fmt(total.total):'Not available','Counts from '+total.saved+' checked submissions. Missing players are excluded.'],['Average troops / submission',total.saved?fmt(Math.round(total.total/total.saved)):'Not available',total.saved?fmt(total.types.infantry)+' infantry · '+fmt(total.types.cavalry)+' cavalry · '+fmt(total.types.archers)+' archers':'Awaiting submitted troop counts.']];
 $('summarycards').innerHTML=cards.map(([label,value,note])=>'<div class="summary-card"><strong>'+esc(value)+'</strong><span>'+label+'</span><small>'+esc(note)+'</small></div>').join('');
 $('levelsummary').innerHTML=total.levels.map(x=>'<span class="level-chip"><b>TC '+x.level+'</b>'+x.count+' '+(x.count===1?'member':'members')+'</span>').join('')+(rows.some(p=>!p.level)?'<span class="level-chip">Unknown level: '+rows.filter(p=>!p.level).length+'</span>':'');
 $('summarycount').textContent=shown.length+' of '+total.members+' members shown. Select a name to open their update page.';
 $('summaryempty').hidden=shown.length!==0;
 $('summaryrows').innerHTML=shown.map(p=>{
  const d=p.data;
  const detail=d?'<details><summary>Troops by tier</summary><div class="tier-lines">'+M.TIERS.map(t=>'T'+t+': '+M.TYPES.map(k=>fmt(d.stock[t][k])+' '+names[k]).join(' · ')).join('<br>')+(M.TYPES.some(k=>d.lower[k])?'<br>Lower-tier own reserve: '+M.TYPES.map(k=>fmt(d.lower[k])+' '+names[k]).join(' · '):'')+'</div></details>':'';
  const cell=(label,value,cls='')=>'<td data-label="'+label+'" class="'+cls+'">'+value+'</td>';
  return '<tr>'+cell('Player','<div><a class="member-name" href="./optimize-me.html?player='+encodeURIComponent(p.id)+'">'+esc(p.name)+'</a><small>'+esc(p.rank)+' · Update setup →</small><small><a href="./history.html?player='+encodeURIComponent(p.id)+'">View history →</a></small><small><a href="./kvk-planner.html?player='+encodeURIComponent(p.id)+'">Plan KvK spends →</a></small><small>'+(p.x!=null&&p.y!=null?'X '+p.x+' · Y '+p.y:'Coordinates unavailable')+'</small>'+(p.x!=null&&p.y!=null?'<small>Position observed: '+esc(date(p.positionAt))+'</small>':'')+'</div>')+
   cell('Town Center',p.level?'TC '+p.level:'Unknown','numeric')+cell('Power',fmt(p.power),'numeric')+
   cell('Submitted troops','<div>'+(d?'<b>'+fmt(d.total)+'</b><small>'+d.joins+' joins · '+d.presets+' presets'+(d.own?' · own rally':' · joins only')+'</small>':'Unknown')+detail+'</div>','numeric')+
   M.TYPES.map(k=>cell(names[k],d?fmt(d.types[k]):'—','numeric')).join('')+
   cell('Setup updated','<div><span class="submission-badge '+p.status+'">'+statuses[p.status]+'</span>'+(d?time(d.updatedAt):'<small>'+(p.status==='missing'?'Not submitted yet':p.status==='unavailable'?'Refresh to retry.':'Waiting for online check.')+'</small>')+'</div>')+'</tr>';
 }).join('');
}
async function refresh(){
 if(busy||!plan)return;busy=true;$('summaryrefresh').disabled=true;$('summaryrefresh').textContent='Checking submissions…';$('summarystatus').dataset.error='false';
 // Start afresh so a failed refresh never presents an old cached count as current.
 records=new Map();render();let complete=0,stopped=false;
 const ids=plan.players.filter(p=>p.active).map(p=>p.governorId);
 $('summarychecked').textContent='Checking online submissions now. Roster observations above are a separate timestamp.';
 for(let offset=0;offset<ids.length;offset+=6){
  const batch=ids.slice(offset,offset+6);
  await Promise.all(batch.map(async id=>{
   try{const result=await BearCloud.request('/api/players/'+id,'');if(!Number.isSafeInteger(result.revision)||result.revision<0||!Object.prototype.hasOwnProperty.call(result,'input'))throw Error('Invalid online profile');records.set(id,{data:S.submitted(result)});}
   catch(error){records.set(id,{error:true});}
   complete++;$('summarystatus').textContent='Checked '+complete+' of '+ids.length+' player submissions…';
  }));
  render();
  // If the service is unavailable, avoid waiting through 100 individual timeouts.
  if(offset===0&&batch.every(id=>records.get(id)?.error)){stopped=true;for(const id of ids.slice(complete))records.set(id,{error:true});break;}
 }
 const all=S.totals(S.rows(plan,snapshot,records));render();
 $('summarystatus').dataset.error=String(all.unavailable>0);
 $('summarystatus').textContent=stopped?'Online submissions could not be checked. Roster details remain available; use Check online submissions to retry.':all.unavailable?'Checked '+ids.length+' members. '+all.unavailable+' submissions could not be read; their troop counts are excluded. Refresh to retry.':'Checked all '+ids.length+' members. '+all.saved+' have submitted troops; '+all.missing+' have not submitted yet.';
 $('summarychecked').textContent=(all.unavailable?'Check finished':'Submissions checked')+' '+date(new Date().toISOString())+'. Individual save times are shown beside each player.';
 busy=false;$('summaryrefresh').disabled=false;$('summaryrefresh').textContent='Check online submissions';
}
async function start(){
 $('summarytimezone').textContent='Times are shown in '+Intl.DateTimeFormat().resolvedOptions().timeZone+'. “7+ days old” refers to the troop submission, not the roster.';
 $('summarysearch').addEventListener('input',()=>{if(plan)render();});
 for(const id of ['summaryfilter','summarysort'])$(id).addEventListener('change',()=>{if(plan)render();});
 $('summaryrefresh').onclick=()=>plan?refresh():start();
 try{
  const response=await fetch('./data/alliance-api.json',{cache:'no-store'});if(!response.ok)throw Error('Roster unavailable');snapshot=await response.json();plan=A.mergeSnapshot(A.emptyPlan(),snapshot);
  const a=snapshot.alliance||{};
  $('alliancename').textContent=(a.name||'Conqueror’sWill')+' · '+(a.abbr||'CNQ');
  $('alliancedetails').textContent=plan.players.filter(p=>p.active).length+' members · Kingdom '+plan.kingdomId+' · Leader: '+(a.leader_name||'Unknown')+(a.power!=null?' · Alliance power: '+fmt(a.power):'')+(a.power_rank!=null?' · Power rank: #'+a.power_rank:'');
  $('rosterdate').textContent='Levels, power & ranks observed: '+date(S.timestamp(snapshot.roster_freshness?.cached_at)||S.timestamp(snapshot.generated_at))+'. Snapshot published: '+date(S.timestamp(snapshot.generated_at))+'.';
  render();await refresh();
 }catch(error){$('summarystatus').textContent='Cannot load the published alliance roster. Use Check online submissions to retry.';$('summarystatus').dataset.error='true';$('summaryrefresh').disabled=false;}
}
start();
if(document.getElementById('summaryreset'))$('summaryreset').onclick=()=>{$('summarysearch').value='';$('summaryfilter').value='all';render();$('summarysearch').focus();};
})();
