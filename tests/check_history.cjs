const assert=require('node:assert/strict'),H=require('../web/history-model.js');
const history={power:[{at:'2026-10-21T00:00:00Z',power:120,townLevel:26},{at:'2026-10-16T00:00:00Z',power:100,townLevel:25},{at:'bad',power:999}],troops:[{at:'2026-10-21T01:00:00Z',total:650,types:{infantry:150,cavalry:200,archers:300},stock:{9:{infantry:100,cavalry:200,archers:300}},lower:{infantry:50}},{at:'2026-10-22T01:00:00Z',total:0,types:{infantry:0,cavalry:0,archers:0},stock:{}}]};
assert.deepEqual(H.series(history,'power').map(p=>p.value),[100,120]);
assert.deepEqual(H.change(H.series(history,'power')),{amount:20,percent:20});
assert.equal(H.series(history,'total')[0].value,650);
assert.equal(H.series(history,'infantry')[0].value,150);
assert.equal(H.series(history,'t9')[0].value,600);
assert.equal(H.series(history,'total')[1].value,0);
assert.equal(H.series(history,'power',1,Date.parse('2026-10-21T12:00:00Z')).length,1);
assert.equal(H.change(H.series({troops:[]},'total')),null);
assert.equal(H.change([{value:0},{value:1}]).percent,null);
assert.deepEqual(H.series(history,'townLevel').map(p=>p.value),[25,26]);
assert.throws(()=>H.series(history,'madeUp'));
console.log('History: source sorting, dates, growth, zero, coverage and troop units verified.');
// Run real page handlers: selection, missing data, escaped names and read failures.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const alliance={version:1,id:'alliance',power:[{at:'2026-10-16T00:00:00Z',power:4000000000},{at:'2026-10-21T00:00:00Z',power:4100000000}],troops:[{...history.troops[0],members:100,reported:1,memberIds:['123'],rosterIds:['123','456'],carried:0},{...history.troops[1],total:700,members:100,reported:2,memberIds:['123','456'],rosterIds:['123','456'],carried:1}]};
assert.equal(H.change(H.series(alliance,'total')),null);
assert.equal(H.series(alliance,'total')[1].reported,2);
assert.equal(H.series({...alliance,troops:[{...alliance.troops[0],total:null,reported:0}]},'infantry').length,0);
assert.equal(H.change(H.series(alliance,'power')).percent,2.5);
async function page(fail=false,wholeAlliance=false){
 const nodes={},html=fs.readFileSync(path.join(__dirname,'../web/history.html'),'utf8');
 for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes[m[1]]={value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,handlers:{},addEventListener(event,fn){this.handlers[event]=fn;}};
 const requested=wholeAlliance?'alliance':'123';
 nodes.historymetric.value='power';nodes.historyperiod.value='0';
 const requests=[],index={version:1,updatedAt:'2026-10-21T12:00:00Z',players:[{id:'123',name:'<Alice & Bob>',active:true}],profileCapture:{at:'2026-10-21T12:00:00Z',saved:1,checked:1,unavailable:0}};
 const context=vm.createContext({console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,BearHistory:H,Date:class extends Date{static now(){return Date.parse('2026-11-01T00:00:00Z');}},location:{href:'https://example.test/history.html?player='+requested,search:'?player='+requested},window:{history:{replaceState(){}}},document:{getElementById(id){assert(nodes[id],id);return nodes[id];}},fetch:async(url,options)=>{assert(!options.method,'Read-only history');requests.push(url);if(fail)throw Error('Offline');return {ok:true,json:async()=>url.endsWith('index.json')?index:wholeAlliance?alliance:{version:1,id:'123',...history}};}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/history-model.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/history.js'),'utf8'),context);
 for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));
 if(fail){assert.match(nodes.historystatus.textContent,/Could not load the history archive/);return;}
 assert.equal(requests.length,2);assert.match(nodes.historyplayer.innerHTML,/&lt;Alice &amp; Bob&gt;/);
 assert.match(nodes.historyplot.innerHTML,/<svg/);assert(!nodes.historyplot.innerHTML.includes('<Alice'));
 if(wholeAlliance){
  assert.equal(nodes.historytown.disabled,true);assert.equal(nodes.historyupdate.hidden,true);
  assert.match(nodes.historytitle.textContent,/CNQ alliance · Total power/);
  nodes.historymetric.value='total';nodes.historymetric.handlers.change();
  assert.match(nodes.historycoverage.textContent,/2 \/ 100 members/);assert.match(nodes.historycoverage.textContent,/1 retained last-known/);
  assert.match(nodes.historychange.textContent,/not directly comparable/);
  assert(!nodes.historyplot.innerHTML.match(/class="trace" d="[^"]*L/),'Do not connect changed reporting cohorts');
  assert.match(nodes.historyrows.innerHTML,/2 \/ 100 members/);return;
 }
 assert.match(nodes.historychange.textContent,/\+20/);assert.equal(nodes.historyupdate.href,'./optimize-me.html?player=123');
 nodes.historymetric.value='total';nodes.historymetric.handlers.change();assert.match(nodes.historyrows.innerHTML,/650/);assert.match(nodes.historyrows.innerHTML,/>0</);
 nodes.historyperiod.value='7';nodes.historyperiod.handlers.change();assert.match(nodes.historyplot.innerHTML,/No troop submission/);assert.equal(nodes.historyrows.innerHTML,'');
}
(async()=>{await page();await page(true);await page(false,true);console.log('History page selection, empty states, source units, escaping and read failures pass.');})().catch(error=>{console.error(error);process.exitCode=1;});
