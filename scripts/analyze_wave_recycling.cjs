// Controlled throughput experiment, not a CNQ damage forecast.
const fs=require('node:fs');
const E=require('../web/engine.js');
const results=[];
for(const slots of [4,5])for(const capacity of [500000,600000]){
 const roster=Array.from({length:50},(_,i)=>E.member({name:'P'+String(i).padStart(2,'0'),
  infantry:Math.floor(slots*50000*.335),cavalry:Math.floor(slots*50000*.262),
  archers:slots*50000-Math.floor(slots*50000*.335)-Math.floor(slots*50000*.262)+1,
  infantry_tier:9,cavalry_tier:9,archers_tier:9,march_capacity:100000,
  join_slots:slots,rally_capacity:capacity,outbound_s:12,return_s:12,join_travel_s:12}));
 const strategy={host_count:50,cadence:'groups',opening_wave_count:4,wave_interval_s:60,
  host_allocation:'small',small_host_fraction:.00001,troop_split:'concentrated',
  reserve_lead_troops:true,first_wave_join:true,join_march_cap:50000,join_policy:'next'};
 const p={roster,mechanics:{damage_model:'sqrt',damage_scope:'march'},
  strategy,strategies:[{...strategy,name:'Four waves, 60s'},{...strategy,name:'Five waves, 65s',opening_wave_count:5,wave_interval_s:65}],
  host_count:50,normalization:{enabled:false},opening_limit_s:240};
 const before=E.compare(p),optimized=E.optimize_waves(p);
 const describe=r=>({strategy:r.strategy,damage:r.total_damage,opening_joiners:r.summary.first_wave_joiners,
  troop_hits:r.members.reduce((n,m)=>n+m.troop_hits,0),mean_fill:r.summary.mean_fill,
  inventory_turnovers:r.members.reduce((n,m)=>n+m.troop_hits,0)/roster.reduce((n,m)=>n+m.troops,0)});
 const record={slots,capacity,tested:optimized.tested.length,baseline:describe(before.runs[0]),five_waves:describe(before.runs[1]),best:describe(optimized.best)};
 results.push(record);
 process.stdout.write(JSON.stringify({slots,capacity,tested:record.tested,best:record.best.strategy,
  gainVsFour:record.best.damage/record.baseline.damage-1,gainVsFive:record.best.damage/record.five_waves.damage-1})+'\n');
}
fs.writeFileSync('/tmp/wave-recycling-results.json',JSON.stringify(results,null,2)+'\n');
