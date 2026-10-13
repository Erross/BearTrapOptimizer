const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../web/alliance-model.js');
const E = require('../web/engine.js');
const bands = require('../web/alliance-profiles.json').bands;
const live = JSON.parse(fs.readFileSync(require.resolve('../web/data/alliance-api.json'), 'utf8'));
let actual = M.mergeSnapshot(M.emptyPlan(), live);
assert.equal(actual.players.length, live.members.length);
assert(actual.players.every(p => p.group === 'none'));
assert.equal(M.compile(actual, bands).estimated.length, actual.players.filter(p=>p.active).length);
for (const p of actual.players) {
 const row = live.members.find(m => String(m.governor_id ?? m.fid) === p.governorId);
 assert.equal(p.api.power, row.power);
 assert.equal(p.api.townLevel, row.town_center_level);
}
function snapshot(people) {
 return {schema:'mightpulse-alliance-snapshot',version:1,kingdom_id:2399,alliance_tag:'CNQ',generated_at:'2026-10-13T00:00:00Z',
  members:people.map(([id,x,y,name='Same name'])=>({governor_id:id,kid:2399,nick_name:name,town_center_level:27,power:55000000})),
  profiles:Object.fromEntries(people.map(([id,x,y])=>[id,{governor_id:id,player:{governor_id:id,kid:2399,x,y},fresh:true}])),
  profile_status:Object.fromEntries(people.map(([id])=>[id,'refreshed']))};
}
let plan = M.mergeSnapshot(M.emptyPlan(), snapshot([['1',0,0],['2',20,0],['3',10,0],['4',null,null]]));
plan.traps = {'1':{x:0,y:0},'2':{x:20,y:0}};
let nearest = M.assignNearest(plan);
assert.equal(nearest.assigned, 2);assert.equal(nearest.skipped, 2);
assert.deepEqual(nearest.plan.players.map(p=>p.group), ['1','2','none','none']);
plan = nearest.plan;
plan.players[0].group = '2';
assert.equal(M.assignNearest(plan).plan.players[0].group, '2', 'Automatic assignment preserves an existing manual group');
assert.equal(M.assignNearest(plan, new Set(['1'])).plan.players[0].group, '1');
const person = plan.players[0];
person.attending=false;person.canHost=false;person.ring=3;
person.stats={infantry:100000,cavalry:20000,archers:180000,march_capacity:120000,archers_lethality_bonus:177};
person.travel['2']={seconds:47,returnSeconds:53,position:M.fingerprint(plan,person,'2')};
assert.equal(M.travel(plan,person).seconds,47);
let fresh = M.mergeSnapshot(plan, snapshot([['1',0,0,'Renamed'],['2',20,0],['3',10,0],['4',null,null]]));
assert.equal(fresh.players[0].api.name,'Renamed');
for (const k of ['group','attending','canHost','ring','stats','travel'])assert.deepEqual(fresh.players[0][k], person[k]);
assert.equal(M.travel(fresh,fresh.players[0]).seconds,47);
fresh = M.mergeSnapshot(fresh,snapshot([['1',2,0,'Renamed'],['2',20,0],['3',10,0],['4',null,null]]));
assert(M.travel(fresh,fresh.players[0]).stale);
assert.equal(M.travel(fresh,fresh.players[0]).seconds,38);
const partial = M.mergeSnapshot(plan,snapshot([['1',2,0,'Changed'],['2',22,0],['3',10,0],['4',null,null]]),new Set(['2']));
assert.equal(partial.players[0].api.name,'Same name');assert.equal(partial.players[1].api.x,22);
const gone = M.mergeSnapshot(plan,snapshot([['2',20,0],['3',10,0],['4',null,null]]));
assert.equal(gone.players.find(p=>p.governorId==='1').active,false);
assert.equal(M.compile(gone,bands).roster.length,3);
const rejoined = M.mergeSnapshot(gone,snapshot([['1',0,0],['2',20,0],['3',10,0],['4',null,null]]));
assert.deepEqual(rejoined.players.find(p=>p.governorId==='1').stats,person.stats);
assert.equal(rejoined.players.find(p=>p.governorId==='1').group,'2');
assert.deepEqual(M.validatePlan(JSON.parse(JSON.stringify(plan))),plan);
const scrub = M.clone(plan);scrub.apiKey='never saved';scrub.players[0].api.secret='never saved';
assert(!JSON.stringify(M.validatePlan(scrub)).includes('never saved'));
for (const mutate of [p=>p.players.push(p.players[0]),p=>p.players[0].stats.join_slots=11,p=>p.players[0].stats.infantry=0.2,
 p=>p.players[0].stats.apiKey=123,p=>p.players[0].governorId=9007199254740993,p=>p.kingdomId=42]) {
 const bad=M.clone(plan);mutate(bad);assert.throws(()=>M.validatePlan(bad));
}
assert.throws(()=>M.mergeSnapshot(plan,{...live,kingdom_id:42}));
assert.throws(()=>M.mergeSnapshot(plan,{...live,members:[live.members[0],live.members[0]]}));
assert.throws(()=>M.mergeSnapshot(plan,{...snapshot([['1',0,0]]),profiles:{'1':{governor_id:'999',player:{}}}}));
plan.comparisonGroup='2';
const compiled=M.compile(plan,bands);
assert.equal(compiled.roster.length,2);assert.equal(compiled.absent.length,1);assert.equal(compiled.estimated.length,1);
assert.equal(compiled.roster[0].troops,300000);assert.equal(compiled.roster[0].archers_lethality_bonus,177);
assert.equal(new Set(M.compile({...plan,comparisonGroup:'all'},bands).roster.map(r=>r.name)).size,4,'Duplicate display names retain distinct IDs');
const times=M.joinTravelTimes(plan,compiled.roster);
assert.equal(times[compiled.roster[0].name][compiled.roster[1].name],42);
const totalOnly=M.clone(plan);totalOnly.players[0].stats={troops:345678};
assert.equal(M.compile(totalOnly,bands).roster[0].troops,345678);
assert.equal(M.compile(totalOnly,bands).estimated.length,2,'A measured total does not make an assumed troop mix measured');
const rows=[E.member({name:'Host',troops:100,march_capacity:100,join_slots:0,rally_capacity:300,outbound_s:0,return_s:0}),
 E.member({name:'Near',troops:100,march_capacity:100,join_slots:1,can_host:false,outbound_s:0,return_s:0}),
 E.member({name:'Far',troops:100,march_capacity:100,join_slots:1,can_host:false,outbound_s:0,return_s:0})];
const config={duration_s:60,countdown_s:50,reaction_s:1,score_per_effective_troop:1};
const setting={host_count:1,cadence:'synchronized',host_allocation:'full',troop_split:'concentrated'};
const matrix={Near:{Host:49},Far:{Host:50}};
const run=E.simulate(rows,config,setting,matrix);
assert.equal(run.total_damage,200);assert.equal(run.members.find(m=>m.name==='Far').joins,0);
assert.equal(E.compare({roster:rows,mechanics:config,strategies:[setting],travel_times:matrix,normalization:{enabled:false}}).runs[0].total_damage,200);
assert.deepEqual(E.simulate(rows,config,{...setting,cadence:'groups',opening_wave_count:1,wave_interval_s:90},matrix).series,run.series);
for(const bad of [{Stranger:{Host:1}},{Near:[]},{Near:{Host:1.5}},{Near:{Host:-1}},{Near:{Host:3601}},{Near:{Host:true}}])assert.throws(()=>E.simulate(rows,config,setting,bad));
assert.equal(E.member({name:'Long',outbound_s:600}).outbound_s,600);
console.log('CNQ identity, nearest assignment, preserved edits, archives, plan round trips and city-to-city timing pass.');

// A distant governor remains assigned/attending but never enters any strategy roster.
const cutoff=M.mergeSnapshot(M.emptyPlan(),snapshot([['21',0,0],['22',100,0],['23',101,0],['24',null,null]]));
cutoff.traps={'1':{x:0,y:0},'2':{x:300,y:0}};
cutoff.comparisonGroup='1';cutoff.players.forEach(p=>p.group='1');
const near=M.compile(cutoff,bands);
assert.equal(near.roster.length,3);assert.equal(near.excluded.length,1);
assert.equal(near.excluded[0].governorId,'23');assert(cutoff.players[2].attending);assert.equal(cutoff.players[2].group,'1');
assert(!Object.keys(M.joinTravelTimes(cutoff,near.roster)).some(name=>name===M.engineName(cutoff.players[2])));
cutoff.distanceFilter.enabled=false;assert.equal(M.compile(cutoff,bands).roster.length,4);
cutoff.distanceFilter.enabled=true;cutoff.comparisonGroup='all';cutoff.traps['2']={x:101,y:0};
assert.equal(M.compile(cutoff,bands).roster.length,4,'All members uses nearest saved trap');
const legacy=M.clone(cutoff);delete legacy.distanceFilter;assert.deepEqual(M.validatePlan(legacy).distanceFilter,{enabled:true,maxUnits:100});
assert.deepEqual(M.validatePlan(JSON.parse(JSON.stringify(cutoff))).distanceFilter,cutoff.distanceFilter);
const invalidFilter=M.clone(cutoff);invalidFilter.distanceFilter.maxUnits=0;assert.throws(()=>M.validatePlan(invalidFilter));
console.log('Distance boundaries, nearest-trap filtering, missing positions, preserved attendance and saved cutoffs pass.');
