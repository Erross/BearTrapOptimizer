const assert=require('node:assert/strict');
const M=require('../web/personal-model.js');
let cases=0;
function test(name,fn){fn();cases++;console.log('OK '+name);}
const base=()=>({stock:{9:{infantry:46522,cavalry:64463,archers:97660},8:{infantry:38970}},joinMarches:5,presets:6,capacity:90000,heroFreeCapacity:80000,joinCap:50000,
 ownEnabled:true,ownTier:'lower',lowerConfirmed:true,ownCapacity:90000,ownTroops:{infantry:1000},
 heroes:M.HEROES.map(h=>({name:h.name,available:true,skill:5})),leaders:{infantry:'Howard',cavalry:'Jabel',archers:'Quinn'}});
test('five normal joins PLUS one special leader march',()=>{const p=M.build(base());assert.equal(p.joins,5);assert.equal(p.marches.length,5);assert.equal(p.own.slot,6);assert.equal(p.perJoin,49522);assert.equal(p.joinTotal,247610);assert.equal(p.leftoverTotal,5);});
test('all hero-free joins reuse one preset and free the next slot for own rally',()=>{const x=base();x.heroes=x.heroes.filter(h=>['Howard','Jabel','Quinn'].includes(h.name));x.presets=2;const p=M.build(x);assert.deepEqual(p.marches.map(m=>m.slot),[1,1,1,1,1]);assert.equal(p.setups.length,1);assert.equal(p.own.slot,2);assert.equal(p.manual,0);assert.equal(p.usedPresets,2);assert.equal(p.requiredPresets,2);});
test('mixed hero and hero-free joins count distinct formations only',()=>{const x=base();x.joinMarches=10;x.presets=7;const p=M.build(x);assert.deepEqual(p.marches.map(m=>m.slot),[1,2,3,4,5,5,5,5,5,5]);assert.equal(p.own.slot,6);assert.equal(p.manual,0);assert.equal(p.setups.length,5);});
test('three approved joiners plus two hero-free joins use slots 1–4 and own rally uses 5',()=>{const x=base();x.heroes=x.heroes.filter(h=>h.name!=='Amadeus');x.presets=5;const p=M.build(x);assert.deepEqual(p.marches.map(m=>m.slot),[1,2,3,4,4]);assert.equal(p.own.slot,5);assert.equal(p.manual,0);});
test('one hero-free slot covers every join without an own rally',()=>{const x=base();x.ownEnabled=false;x.heroes=[];x.presets=1;x.joinMarches=10;const p=M.build(x);assert(p.marches.every(m=>m.slot===1));assert.equal(p.manual,0);assert.equal(p.usedPresets,1);});
test('unsaved hero-free formation counts once in manual setup warning',()=>{const x=base();x.ownEnabled=false;x.heroes=[];x.presets=0;const p=M.build(x);assert.equal(p.manual,1);assert(p.marches.every(m=>m.slot===null));});
test('own troops in inventory reserved exactly once',()=>{const x=base();x.ownTier=8;const p=M.build(x);assert.equal(p.joinTotal+p.leftoverTotal+p.own.total,M.total(M.matrix(x.stock)));assert.equal(p.perJoin,49322);});
test('a leader cannot also be a joiner',()=>{const x=base();x.leaders.infantry='Amadeus';const p=M.build(x);assert(!p.marches.some(m=>m.hero==='Amadeus'));assert.equal(new Set(p.marches.filter(m=>m.hero).map(m=>m.hero)).size,3);});
test('only supported first-slot joiners are recommended',()=>{const p=M.build(base());assert(p.marches.every(m=>m.hero===null||['Chenko','Yeonwoo','Amane','Amadeus'].includes(m.hero)));assert.deepEqual(M.HEROES.filter(h=>h.join).map(h=>h.name),['Chenko','Yeonwoo','Amane','Amadeus']);assert(!p.marches.some(m=>m.hero==='Howard'));});
test('Hilde is never assigned as a joiner even when she has the highest skill',()=>{const x=base();x.heroes.forEach(h=>h.skill=h.name==='Hilde'?5:1);const p=M.build(x);assert(!p.marches.some(m=>m.hero==='Hilde'));assert(p.marches.some(m=>m.hero===null));});
test('Hilde remains available to lead your own rally',()=>{const x=base();x.leaders.cavalry='Hilde';const p=M.build(x);assert(p.own.heroes.includes('Hilde'));assert(!p.marches.some(m=>m.hero==='Hilde'));});
test('skill level wins before tie order',()=>{const x=base();x.heroes.find(h=>h.name==='Chenko').skill=1;const p=M.build(x);assert.notEqual(p.marches[0].hero,'Chenko');});
test('unknown skill does not occupy a bonus slot',()=>{const x=base();x.heroes.find(h=>h.name==='Amane').skill=0;const p=M.build(x);assert.equal(p.marches[3].hero,null);assert.equal(p.limit,50000);});
test('hero-free capacity is required when needed',()=>{const x=base();x.heroes=x.heroes.filter(h=>h.name!=='Hilde');x.heroFreeCapacity='';assert.throws(()=>M.build(x),/capacity without heroes/);});
test('hero-free capacity limits every identical join',()=>{const x=base();x.joinMarches=6;x.joinCap=0;x.heroFreeCapacity=20000;const p=M.build(x);assert.equal(p.perJoin,20000);assert.equal(p.limit,20000);});
test('few presets produce manual rows instead of dropping marches',()=>{const x=base();x.presets=2;const p=M.build(x);assert.equal(p.marches.length,5);assert.equal(p.marches.filter(m=>!m.slot).length,3);assert.equal(p.own.slot,null);assert.equal(p.manual,4);});
test('zero preset slots supported',()=>{const x=base();x.presets=0;assert.equal(M.build(x).manual,6);});
test('join only frees leader heroes and reserves no own troops',()=>{const x=base();x.ownEnabled=false;const p=M.build(x);assert.equal(p.own.total,undefined);assert(p.marches.some(m=>m.hero==='Amadeus'));});
test('highest tiers retained when capped',()=>{const x=base();x.stock={10:{infantry:500000},9:{archers:500000}};x.joinCap=30000;const p=M.build(x);assert.equal(p.packet[10].infantry,30000);assert.equal(p.packet[9].archers,0);});
test('packet never uses more than the floor share of a cell',()=>{for(let n=1;n<=10;n++){const x=base();x.joinMarches=n;x.joinCap=12345;const p=M.build(x),s=M.matrix(x.stock);for(const t of M.TIERS)for(const k of M.TYPES)assert(p.packet[t][k]*n<=s[t][k]);}});
test('reject insufficient own stock',()=>{const x=base();x.ownTier=10;assert.throws(()=>M.build(x),/Not enough/);});
test('reject unconfirmed lower-tier reserve',()=>{const x=base();x.lowerConfirmed=false;assert.throws(()=>M.build(x),/Confirm/);});
test('reject leader over capacity',()=>{const x=base();x.ownCapacity=999;assert.throws(()=>M.build(x),/own-rally troops exceed/);});
test('reject fractional inventory',()=>{const x=base();x.stock[9].archers=1.5;assert.throws(()=>M.build(x),/whole number/);});
test('reject negative stock',()=>{const x=base();x.stock[9].archers=-1;assert.throws(()=>M.build(x),/whole number/);});
test('reject empty joining packet',()=>{const x=base();x.stock={9:{infantry:1}};assert.throws(()=>M.build(x),/too few troops/);});
test('invalid or missing leader rejected',()=>{const x=base();x.leaders.infantry='Jabel';assert.throws(()=>M.build(x),/available infantry leader/);});
test('saved geometry fingerprint invalidates changed coordinates and stats',()=>{const p={players:[{governorId:'1',api:{x:1,y:2},stats:{march_capacity:100}}]};const f=M.fingerprint(p);p.players[0].stats.march_capacity=200;assert.notEqual(f,M.fingerprint(p));});
test('suggest one distinct available hero per troop type',()=>{const x=base();const p=M.suggestLeaders(x.heroes,[{name:'Jabel',gear:[{enhancement_level:100}]}]);assert.equal(p.cavalry,'Jabel');assert.equal(new Set(Object.values(p)).size,3);});
console.log(cases+' personal model checks passed.');
