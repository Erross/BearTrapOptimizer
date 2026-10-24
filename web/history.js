(function(){
'use strict';
const H=BearHistory,$=id=>document.getElementById(id),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>n.toLocaleString(),compact=n=>new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1}).format(n),utc=at=>new Date(at).toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC');
let index,history,sequence=0;
const selectedPerson=()=>$('historyplayer').value==='alliance'?{id:'alliance',name:'CNQ alliance',active:false}:index.players.find(p=>p.id===$('historyplayer').value);
async function read(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(path,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('unavailable');return await response.json();}finally{clearTimeout(timer);}}
function draw(){
 if(!history)return;
 const metric=$('historymetric').value,points=H.series(history,metric,Number($('historyperiod').value)),person=selectedPerson(),alliance=person.id==='alliance',label=alliance&&metric==='power'?'Total power':alliance&&metric==='total'?'Total submitted troops':H.metrics[metric],troop=!['power','townLevel'].includes(metric);
 $('historytitle').textContent=person.name+' · '+label;
 $('historyunit').textContent=troop?(alliance?'Current members · entered inventory':'Player-submitted inventory'):(alliance?'Reported total alliance power':'Published roster observations');
 $('historylatest').textContent=points.length?fmt(points.at(-1).value):'No observations';
 const delta=H.change(points),changedCoverage=points.length>1&&!H.comparable(points[0],points.at(-1));
 const coverage=p=>p.reported===undefined?(p.members===undefined?'—':p.members+' roster members'):p.reported+' / '+p.members+' members'+(p.carried?' · '+p.carried+' retained last-known':'');
 $('historycoverage').textContent=alliance&&troop&&points.length?'Latest total covers '+coverage(points.at(-1))+'. Missing members are excluded.'+(points.at(-1).oldestSubmission?' Oldest included submission: '+utc(points.at(-1).oldestSubmission)+'.':''):'';
 $('historychange').textContent=delta?(delta.amount>=0?'+':'')+fmt(delta.amount)+(delta.percent===null?'':' ('+(delta.percent>=0?'+':'')+delta.percent.toFixed(1)+'%)')+' over this period':changedCoverage?'Reporting members or roster changed · growth is not directly comparable':points.length?'One observation · more needed to show change':'';
 $('historyrows').innerHTML=points.map(p=>'<tr><td>'+esc(utc(p.at))+'</td><td>'+fmt(p.value)+'</td><td>'+(p.capturedAt?esc(utc(p.capturedAt)):(troop?'Capture time unavailable':'Recovered from GitHub'))+'</td><td>'+esc(coverage(p))+'</td></tr>').join('');
 $('historycaption').textContent=label+' · '+person.name+'. Dates are UTC.';
 $('historyrange').textContent=points.length?points.length+' observation'+(points.length===1?'':'s')+' · '+utc(points[0].at)+' to '+utc(points.at(-1).at)+(troop?(alliance?' · Capture dates · lines break when reporting coverage changes.':' · Dates reflect saved submissions.'):' · Lines connect recorded snapshots; changes between them are unknown.'):'No recorded data in this period. Try All history or choose another metric.';
 if(!points.length){$('historyplot').innerHTML='<p class="empty">'+(troop?(alliance?'No entered troops have been recorded for current members in this period.':'No troop submission has been archived in this period. Save your counts in Optimize Me; the next successful refresh will capture them.'):'No roster observations in this period.')+'</p>';return;}
 const left=85,right=780,top=22,bottom=260,max=Math.max(1,...points.map(p=>p.value))*1.12,start=points[0].time,end=points.at(-1).time;
 const x=p=>start===end?(left+right)/2:left+(p.time-start)/(end-start)*(right-left),y=p=>bottom-p.value/max*(bottom-top);
 let svg='<svg viewBox="0 0 820 310" role="img" aria-labelledby="chartTitle chartDesc"><title id="chartTitle">'+esc(person.name+' · '+label)+'</title><desc id="chartDesc">'+esc($('historyrange').textContent)+'. Exact values are available in the observations table.</desc>';
 for(let i=0;i<=4;i++){const value=max*i/4,cy=bottom-i*(bottom-top)/4;svg+='<line class="grid" x1="'+left+'" x2="'+right+'" y1="'+cy+'" y2="'+cy+'"/><text x="72" y="'+(cy+5)+'" text-anchor="end">'+esc(compact(value))+'</text>';}
 if(points.length>1)svg+='<path class="trace" d="'+points.map((p,i)=>(i&&H.comparable(points[i-1],p)?'L':'M')+x(p).toFixed(2)+' '+y(p).toFixed(2)).join(' ')+'"/>';
 svg+=points.map(p=>'<circle tabindex="0" cx="'+x(p)+'" cy="'+y(p)+'" r="5" aria-label="'+esc(utc(p.at)+': '+fmt(p.value)+(alliance&&troop?' · '+coverage(p):''))+'"><title>'+esc(utc(p.at)+' · '+fmt(p.value)+(alliance&&troop?' · '+coverage(p):''))+'</title></circle>').join('');
 const date=p=>new Date(p.at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
 svg+='<text x="'+left+'" y="295">'+esc(date(points[0]))+'</text>'+(points.length>1?'<text x="'+right+'" y="295" text-anchor="end">'+esc(date(points.at(-1)))+'</text>':'')+'</svg>';
 $('historyplot').innerHTML=svg;
}
async function select(){window.BearPlayerSearch?.sync('historyplayer');
 const ticket=++sequence,id=$('historyplayer').value;window.BearKvKHistoryUI?.select(id);
 if($('historyretry'))$('historyretry').hidden=true;
 history=null;$('historystatus').textContent='Loading history…';$('historyplot').innerHTML='';$('historyrows').innerHTML='';$('historylatest').textContent='';$('historychange').textContent='';$('historyrange').textContent='';$('historycoverage').textContent='';
 const person=selectedPerson();$('historytown').disabled=id==='alliance';if(id==='alliance'&&$('historymetric').value==='townLevel')$('historymetric').value='power';$('historyupdate').hidden=!person.active;$('historyupdate').href='./optimize-me.html?player='+encodeURIComponent(id);
 const url=new URL(location.href);url.searchParams.set('player',id);window.history.replaceState(null,'',url);
 if(window.BearUI)for(const a of document.querySelectorAll('.app-nav a'))if(/optimize-me\.html/.test(a.getAttribute('href')))a.href='./optimize-me.html'+(id==='alliance'?'':'?player='+encodeURIComponent(id));
 try{const result=await read('./data/history/'+encodeURIComponent(id)+'.json');if(ticket!==sequence)return;if(result.version!==1||result.id!==id)throw Error('invalid');history=result;$('historystatus').textContent='Archive updated '+utc(index.updatedAt)+(person.id==='alliance'||person.active?'':' · Former alliance member');draw();}catch(error){if(ticket===sequence){$('historystatus').textContent='Could not load this history. Your selection is preserved. Try again below.';if($('historyretry'))$('historyretry').hidden=false;}}
}
if($('historyretry'))$('historyretry').onclick=()=>index?select():location.reload();
$('historyplayer').addEventListener('change',select);$('historymetric').addEventListener('change',draw);$('historyperiod').addEventListener('change',draw);
(async()=>{try{
 index=await read('./data/history/index.json');if(index.version!==1||!index.players?.length)throw Error('invalid');
 $('historyplayer').innerHTML='<option value="alliance">CNQ alliance · totals</option>'+index.players.map(p=>'<option data-active="'+String(p.active!==false)+'" value="'+esc(p.id)+'">'+esc(p.name)+(p.active?'':' (former member)')+'</option>').join('');
 const requested=new URLSearchParams(location.search).get('player');$('historyplayer').value=requested==='alliance'||index.players.some(p=>p.id===requested)?requested:'alliance';
 $('historyplayer').disabled=false;const capture=index.profileCapture;
 $('historycapture').textContent=capture?'Last troop check: '+utc(capture.at)+' · '+capture.saved+' saved submissions · '+capture.checked+' profiles checked · '+capture.unavailable+' unavailable'+(capture.notChecked?' · '+capture.notChecked+' not checked':'')+'.':'Troop capture starts with the next successful alliance refresh.';
 await select();
 }catch(error){if($('historyretry'))$('historyretry').hidden=false;$('historystatus').textContent='Could not load the history archive. Reload the page to try again.';}})();
})();
