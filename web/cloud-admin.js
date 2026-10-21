(function(){
'use strict';
const $=id=>document.getElementById(id),A=BearAllianceModel,M=BearPersonalModel,PLAN='BearTrapOptimizer:CNQ:2399:plan:v1';
let snapshot=null,records=[],busy=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function key(){const v=$('adminkey').value.trim();if(v.length<32)throw Error('Organizer key must contain at least 32 characters. Enter the value stored in Cloudflare ADMIN_TOKEN.');return v;}
async function action(fn){if(busy)return;busy=true;for(const id of ['admininit','adminload','adminapply','adminkey','adminlock'])$(id).disabled=true;try{await fn();}catch(error){$('adminstatus').textContent=error.message;}finally{busy=false;for(const id of ['admininit','adminload','adminkey','adminlock'])$(id).disabled=false;$('adminapply').disabled=!records.length;}}
function clearReview(){records=[];$('adminprofiles').textContent='No submissions loaded.';$('adminapply').disabled=true;}
$('adminkey').addEventListener('input',clearReview);
$('adminlock').onclick=()=>{$('adminkey').value='';clearReview();$('adminstatus').textContent='Access key cleared.';};
$('admininit').onclick=()=>action(async()=>{await BearCloud.request('/api/admin/init',key(),'POST');$('adminstatus').textContent='Database initialized. Existing profiles were preserved. Players can now load and save their setups without a code.';});
$('adminload').onclick=()=>action(async()=>{
 const result=await BearCloud.request('/api/admin/profiles',key());
 const roster=A.mergeSnapshot(A.emptyPlan(),snapshot).players;
 const next=result.profiles.filter(r=>roster.some(p=>p.active&&p.governorId===r.governorId));
 for(const r of next)M.build(r.input);records=next;
 $('adminprofiles').innerHTML=records.length?'<table><thead><tr><th>Use</th><th>Player</th><th>Troops</th><th>Joins</th><th>Saved</th></tr></thead><tbody>'+records.map((r,i)=>{const p=roster.find(p=>p.governorId===r.governorId),n=M.total(M.matrix(r.input.stock))+(r.input.ownEnabled&&r.input.ownTier==='lower'?M.TYPES.reduce((n,k)=>n+Number(r.input.ownTroops[k]),0):0);return '<tr><td><input type="checkbox" data-shared-index="'+i+'" aria-label="Use '+esc(p.api.name)+' counts"></td><td>'+esc(p.api.name)+'</td><td>'+n.toLocaleString()+'</td><td>'+esc(r.input.joinMarches)+'</td><td>'+esc(new Date(r.updatedAt).toLocaleString())+'</td></tr>';}).join('')+'</tbody></table>':'No player setups have been saved online yet.';
 $('adminstatus').textContent=records.length+' submitted profiles loaded. Select the counts to apply.';
});
$('adminapply').onclick=()=>action(async()=>{
 const selected=Array.from(document.querySelectorAll('[data-shared-index]:checked')).map(el=>records[Number(el.dataset.sharedIndex)]);if(!selected.length)throw Error('Select at least one player to apply.');
 const local=JSON.parse(localStorage.getItem(PLAN)||'null'),plan=A.mergeSnapshot(local?A.validatePlan(local):A.emptyPlan(),snapshot);
 const result=BearCloud.applyProfiles(plan,selected);localStorage.setItem(PLAN,JSON.stringify(result.plan));localStorage.removeItem('BearTrapOptimizer:personal-context:v1');
 $('adminapplystatus').textContent=result.count+' player setups applied locally. Reopen the alliance optimizer, review tier/bonus assumptions and compare again.';
});
$('copyworker').onclick=async()=>{
 try{const response=await fetch('./cloudflare-worker.js',{cache:'no-store'});if(!response.ok)throw Error('Worker code unavailable.');const code=await response.text();
 try{await navigator.clipboard.writeText(code);$('workercopystatus').textContent='Worker code copied. Paste it into Cloudflare Edit code, replacing all placeholder code, then Deploy.';}
 catch(_){$('workercopytext').value=code;$('workercopytext').hidden=false;$('workercopytext').focus();$('workercopytext').select();$('workercopystatus').textContent='Select and copy the code below.';}
 }catch(error){$('workercopystatus').textContent=error.message;}
};
(async()=>{try{const response=await fetch('./data/alliance-api.json',{cache:'no-store'});if(!response.ok)throw Error('Cannot load CNQ roster.');snapshot=await response.json();}catch(error){$('adminstatus').textContent=error.message;}})();
})();
