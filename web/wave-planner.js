/* Bounded search of recycling schedules; score first, opening participation required. */
(function(root){
'use strict';
function optimize(p,E){
 const base=E.compare(p),ms=base.roster,c=base.mechanics,count=ms.filter(m=>m.can_host).length;
 if(count<2)throw Error('Opening joins for everyone need at least two rally starters.');
 const source=E.strategy(p.strategies?p.strategies[0]:p.strategy||{});
 const common={...source,host_count:count,host_names:[],cadence:'groups',first_wave_join:true,
  reserve_lead_troops:true,final_push:false,host_allocation:'small',troop_split:'concentrated',
  group_repeat:'ready',wave_cycle_s:0,join_policy:'next',join_window_s:0};
 const limit=p.opening_limit_s??240;
 if(!Number.isInteger(limit)||limit<0||limit>3600)throw Error('First-start window must be 0–3600 seconds.');
 const tested=[],seen=new Set();
 function trial(setting){
  const s=E.strategy(setting),key=JSON.stringify(Object.keys(s).filter(k=>k!=='name').sort().map(k=>[k,s[k]]));
  if(seen.has(key)||tested.length>=144)return;seen.add(key);
  if(limit&&(Math.min(s.host_count,s.opening_wave_count)-1)*s.wave_interval_s>limit)return;
  const run=E.simulate(ms,c,s,p.travel_times),a=run.summary;
  tested.push({strategy:run.strategy,total_damage:run.total_damage,...a,opening_feasible:!a.first_wave_missing_count&&!a.starters_without_first_rally&&(!limit||a.opening_last_start_s<=limit),selected_hosts:run.selected_hosts});
  if(tested.length%5===0&&E.progress)E.progress(tested.length);
 }
 const rank=(a,b)=>b.total_damage-a.total_damage||a.ready_wait_fraction-b.ready_wait_fraction;
 const finalists=()=>tested.filter(r=>r.opening_feasible).slice().sort(rank).slice(0,2);
 for(const waves of [1,2,3,4,5])for(const gap of waves===1?[0]:[30,45,60,75,90])for(const cap of [50000,100000,0])trial({...common,opening_wave_count:waves,wave_interval_s:gap,join_march_cap:cap});
 let seeds=finalists().map(r=>r.strategy);
 for(const s of seeds)for(const hosts of new Set([count,Math.max(2,Math.ceil(count*.75)),Math.max(2,Math.min(count,p.host_count??count))]))for(const own of [.00001,.05])for(const window of [0,15])for(const policy of ['next','rate'])trial({...s,host_count:hosts,small_host_fraction:own,join_window_s:window,join_policy:policy});
 seeds=finalists().map(r=>r.strategy);
 for(const s of seeds)for(const delta of [-10,10])for(const window of [s.join_window_s,30])trial({...s,wave_interval_s:Math.max(1,s.wave_interval_s+delta),join_window_s:window});
 const best=finalists();
 if(!best.length)throw Error('No tested wave plan gives everyone an opening join. Check travel, troop stocks, starter permissions and opening capacity.');
 const winner=E.simulate(ms,c,best[0].strategy,p.travel_times);winner.strategy.name='Optimized waves';
 tested.sort((a,b)=>Number(!a.opening_feasible)-Number(!b.opening_feasible)||rank(a,b));
 return {best:winner,tested,mechanics:c,note:'Best tested total alliance damage, requiring everyone to join the opening wave. Tested 1–5 waves, gaps, starter counts, 50k/100k/uncapped joins, tiny/5% leader packets, immediate/late joining and next-hit/rate selection. Troops remain unavailable through gathering, travel and return. Not a proof of a global optimum; damage and player inputs remain estimates.'};
}
if(typeof module!=='undefined')module.exports=optimize;root.BearWavePlanner=optimize;
})(typeof self!=='undefined'?self:globalThis);
