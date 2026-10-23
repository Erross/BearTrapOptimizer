const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../web/kvk-catalog.js');require('../web/kvk-gear.js');require('../web/kvk-model.js');
require('../web/kvk-solver.js');
(async()=>{const highs=await require('../web/vendor/kvk-highs.js')({locateFile:()=>require.resolve('../web/vendor/highs.wasm')});const solver=KvKSolver.adapter(highs),M=KvKModel,G=KvKGear;
function profile(){const p=M.empty();p.confirmed=true;return p;}
let p=profile();assert.equal(M.optimize(p,solver).shortfall,1e6);
// A Guide by itself never scores; a completed charm consumes both materials.
p.resources.guides.stock=5;p.gear.charms[0].level=0;assert.equal(M.optimize(p,solver).total,0);p.resources.designs.stock=5;let r=M.optimize(p,solver);assert.equal(r.total,43750);assert.equal(r.remaining.guides,0);assert.equal(r.remaining.designs,0);
// Score is the increase, not the cumulative level score or account power.
p=profile();p.gear.charms[0].level=1;p.resources.guides.stock=40;p.resources.designs.stock=15;assert.equal(M.optimize(p,solver).total,87500);
p=profile();p.gear.governor[0].level=0;p.resources.satin.stock=1500;p.resources.threads.stock=15;r=M.optimize(p,solver);assert.equal(r.total,40500);assert.equal(r.days[4].planned,40500);
p.gear.governor[0].level=null;assert.equal(M.optimize(p,solver).total,0,'Unknown gear must not become uncrafed gear.');
// The player needs just Designs: spend only enough currency to complete that upgrade.
p=profile();p.gear.charms[0].level=0;p.resources.guides.stock=5;p.wallets.swordland.balance=3000;p.offers=[{id:'designs',name:'Design',wallet:'swordland',resource:'designs',cost:500,quantity:1,remaining:10,from:1,to:5,enabled:true}];r=M.optimize(p,solver);assert.equal(r.total,43750);assert.equal(r.spending.swordland,2500);assert.equal(r.bought.designs,5);
p.offers[0].from=5;assert.equal(M.optimize(p,solver).total,0,'Day 5 materials cannot fund a Day 1/3/4 charm upgrade.');
// Default offers allocate multiple wallets jointly; splitting materials unlocks a full upgrade.
p=profile();assert(p.offers.every(o=>o.enabled));assert(p.resources.mythic.enabled);p.gear.charms[0].level=0;p.wallets.swordland.balance=2500;p.wallets.trial.balance=1250;p.resources.mythic.enabled=false;p.offers=p.offers.filter(o=>o.wallet==='swordland'&&o.resource==='guides'||o.wallet==='trial'&&o.resource==='designs');r=M.optimize(p,solver);assert.equal(r.total,43750);assert.equal(r.spending.swordland,2500);assert.equal(r.spending.trial,1250);assert(r.days.flatMap(d=>d.purchases).some(b=>b.offer.wallet==='swordland'));assert(r.days.flatMap(d=>d.purchases).some(b=>b.offer.wallet==='trial'));
p.offers.find(o=>o.wallet==='trial').enabled=false;assert.equal(M.optimize(p,solver).total,0,'Optional exclusions still constrain purchases');
// Every displayed wallet has scoring offers and can fund the joint plan without opt-ins.
p=profile();p.targets=Array(5).fill(0);for(const w of KvKCatalog.wallets){assert(p.offers.some(o=>o.wallet===w.id&&o.enabled));p.wallets[w.id].balance=20000;}for(const k of Object.keys(p.workloads))p.workloads[k]=Array(5).fill(10000);r=M.optimize(p,solver);for(const w of KvKCatalog.wallets)assert(r.spending[w.id]>0&&r.spending[w.id]<=20000,w.id+' participates within its budget');
// No fractional bundles and no double-spending coins.
p=profile();p.resources.advanced.enabled=true;p.wallets.arena.balance=9;p.offers=[{id:'mark',name:'Mark',wallet:'arena',resource:'advanced',cost:5,quantity:1,remaining:10,from:1,to:5,enabled:true}];r=M.optimize(p,solver);assert.equal(r.total,15000);assert.equal(r.spending.arena,5);
p.wallets.arena.reserve=5;assert.equal(M.optimize(p,solver).total,0);
// Full-day targets take precedence over an otherwise tempting larger score.
p=profile();p.targets=[100,100,0,0,0];p.rules.mythic=[100,100,0,0,0];p.rules.epic=[1000,0,0,0,0];p.resources.mythic.enabled=true;p.resources.epic.enabled=true;p.wallets.arena.balance=10;p.offers=[{id:'flex',name:'Flexible',wallet:'arena',resource:'mythic',cost:5,quantity:1,remaining:2,from:1,to:2,enabled:true},{id:'tempt',name:'Big day1',wallet:'arena',resource:'epic',cost:6,quantity:1,remaining:1,from:1,to:1,enabled:true}];r=M.optimize(p,solver);assert(r.allTargets);assert.equal(r.total,200);
// Universal speedups are used once and need real timer capacity.
p=profile();p.resources.general.stock=100;p.resources.construction.enabled=true;assert.equal(M.optimize(p,solver).total,0);p.workloads.construction[0]=60;r=M.optimize(p,solver);assert.equal(r.total,1800);assert.equal(r.remaining.general,40);assert.equal(r.remaining.construction,0);p.resources.general.cap=10;assert.equal(M.optimize(p,solver).total,300);
p=profile();p.targets=[100,100,0,0,0];p.resources.mythic={stock:150,reserve:0,enabled:true,batch:1,cap:null};p.rules.mythic=[1,1,0,0,0];r=M.optimize(p,solver);assert.equal(r.days.filter(d=>d.day<=2&&d.shortfall===0).length,1,'If both targets are impossible, cover one whole target.');
// No cash or random chest value enters the model.
assert(!KvKCatalog.resources.some(x=>/random|cash/i.test(x.name)));
// Mastery costs depend on current gear and require whole levels and spare Mythic gear.
p=profile();p.resources.hammer.stock=20;assert.equal(M.optimize(p,solver).total,0);p.gear.heroes[0]={rarity:'mythic',enhancement:20,mastery:1};r=M.optimize(p,solver);assert.equal(r.total,80000);assert.equal(r.remaining.hammer,0);
p.gear.heroes[0]={rarity:'mythic',enhancement:100,mastery:10};p.resources.hammer.stock=110;assert.equal(M.optimize(p,solver).total,0);p.resources.spares.stock=1;assert.equal(M.optimize(p,solver).total,440000);
// Current unpaid Mithril checkpoint, not every possible future checkpoint.
p=profile();p.gear.heroes[0]={rarity:'red',enhancement:120,mastery:10,imbueReady:true};p.resources.mithril.stock=10;p.resources.spares.stock=3;assert.equal(M.optimize(p,solver).total,400000);p.gear.heroes[0].imbueReady=false;assert.equal(M.optimize(p,solver).total,0);
// Prerequisites and stage costs are conserved across days.
p=profile();p.gear.stages=true;p.gear.charms[0]={level:5,stage:4};p.resources.guides.stock=24;p.resources.designs.stock=60;r=M.optimize(p,solver);assert.equal(r.total,175000);assert.equal(r.days.flatMap(d=>d.actions)[0].name,'Head / Cap charm 1 → Lv 6 · step 5/5');
// Closed days cannot gain future points or repeat already-received currency income.
p=profile();p.closed[0]=true;p.actual[0]=100000;p.baseline[0]=999999;p.wallets.arena.income[0]=100000;p.resources.truegold={stock:50,reserve:0,enabled:true,batch:1,cap:null};r=M.optimize(p,solver);assert.equal(r.days[0].projected,100000);assert.equal(r.days[0].shortfall,100000);assert.equal(M.clean(p).wallets.arena.income[0],0);
// Malformed inputs do not enter optimization or storage.
assert.throws(()=>M.clean({...profile(),targets:[-1,0,0,0,0]}));p=profile();p.resources.guides.reserve=1;assert.throws(()=>M.clean(p));p=profile();p.gear.charms[0]={level:1,stage:2};assert.throws(()=>M.clean(p));assert.throws(()=>M.optimize(M.empty(),solver));
console.log('KvK: gear-derived costs/score deltas, missing materials, shop budgets/windows, integer bundles, daily-target priority, speedup capacity, mastery/Mithril gates, partial stages, unknown gear and closed days pass.');

})().catch(error=>{console.error(error);process.exitCode=1;});
