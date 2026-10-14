const assert=require('node:assert/strict');
const E=require('../web/alliance-export.js');
const snapshot={schema:'mightpulse-alliance-snapshot',version:1,alliance_tag:'CNQ',kingdom_id:2399,
 generated_at:'2026-10-14T00:00:00Z',alliance:{power:1000},roster_freshness:{fresh:false},
 members:[{governor_id:101,uid:7,nick_name:'="formula",\n漢字',power:100},{governor_id:7,uid:8,nick_name:'Missing profile',power:0}],
 profiles:{101:{fresh:true,player:{x:0,y:900,power:120,kills:12},
  heroes:[{name:'Chenko',power:50,gear:[{enhancement_level:20}]}],
  ranks:{leaderboards:[{name:'Research Power',value:35,kingdom_rank:4}]},gov_gear:{hidden:true,items:[]}}},
 profile_status:{101:'refreshed',7:'unavailable'},
 troop_power_board:{boards:[{key:'troop_power',captured_at:123,rows:[
  {governor_id:101,uid:7,score:80,rank:3},{governor_id:999,uid:8,score:999,rank:1}]}]}};
const before=JSON.stringify(snapshot),rows=E.rows(snapshot);
assert.equal(rows.length,2);
assert.equal(rows[0].x,0);assert.equal(rows[0].power,120);
assert.equal(rows[0].troop_power,80);assert.equal(rows[0].troop_power_rank,3);
assert.equal(rows[0]['roster.power'],100);
assert.equal(rows[0]['leaderboards.research_power.value'],35);
assert.equal(JSON.parse(rows[0]['profile.heroes'])[0].gear[0].enhancement_level,20);
assert.equal(rows[0]['profile.gov_gear.hidden'],true);
assert.equal(rows[1].troop_power,null,'A UID collision must never borrow another governor’s power');
assert.equal(rows[1].x,undefined);assert.equal(rows[1].power,0);
const withRanking=JSON.parse(JSON.stringify(snapshot));
withRanking.profiles[7]={ranks:{leaderboards:[{name:'Troop Power',value:12,kingdom_rank:200}]}};
assert.equal(E.rows(withRanking)[1].troop_power,12,'A profile can supply power outside the captured top-100 board');
const output=E.csv(snapshot);
assert(output.startsWith('\ufeff"governor_id","name","x","y","power"'));
assert(output.includes('"\'=""formula"",\n漢字"'),'Formula-like names and multiline quotes must remain safe CSV cells');
assert(output.includes('"profile.heroes"'));assert(output.includes('"profile.gov_gear.hidden"'));
assert.deepEqual(JSON.parse(E.json(snapshot)),snapshot);
assert.equal(JSON.stringify(snapshot),before);
assert.equal(E.filename(snapshot,'csv'),'CNQ-2399-api-data-2026-10-14.csv');
const saved=require('../web/data/alliance-api.json');
assert.equal(E.rows(saved).length,saved.members.length);
console.log('Alliance API export: complete rows, IDs, missing values, nested data and CSV quoting passed.');
