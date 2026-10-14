// Exercise the CNQ import, grouping, persistence and graph handlers.
// This DOM stub checks state preservation; it does not validate visual layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const engine = require(path.join(root, 'web/engine.js'));
const nodes = {};
const requests = [];

class Element {
  constructor(id = '', tag = 'div') {
    Object.assign(this, {id, tag, value: '', textContent: '', type: '', checked: false,
      disabled: false, hidden: false, style: {}, dataset: {}, children: [], clientWidth: 960});
    this.classList = {add() {}, remove() {}, toggle() {return false;}, contains() {return false;}};
    this.parentElement = {append(element) {nodes[element.id] = element;}};
  }
  set innerHTML(html) {
    this._html = html;
    this.children = parseElements(html);
    if (this.tag === 'select') {
      const option = html.match(/<option(?: value="([^"]*)")?[^>]*>([^<]*)/);
      if (option) this.value = option[1] ?? option[2];
    }
  }
  get innerHTML() {return this._html || '';}
  querySelectorAll(selector) {
    const attribute = selector.match(/^\[data-([\w-]+)\]$/);
    if (attribute) {
      const key = camel(attribute[1]);
      return this.children.filter(element => key in element.dataset);
    }
    return ['input', 'button'].includes(selector)
      ? this.children.filter(element => element.tag === selector) : [];
  }
  querySelector() {return new Element();}
  setAttribute() {}
  addEventListener() {}
  scrollIntoView() {}
  focus() {}
  showModal() {this.open = true;}
  close() {this.open = false;}
}
const camel = text => text.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function parseElements(html) {
  const elements = [];
  for (const match of html.matchAll(/<(\w+)\b[^>]*>/g)) {
    const attributes = match[0];
    const id = attributes.match(/\bid="([^"]+)"/)?.[1] || '';
    const element = new Element(id, match[1]);
    element.type = attributes.match(/\btype="([^"]+)"/)?.[1] || '';
    element.value = attributes.match(/\bvalue="([^"]*)"/)?.[1] || '';
    element.checked = /\bchecked\b/.test(attributes);
    element.hidden = /\bhidden(?:\s|>|=)/.test(attributes);
    for (const data of attributes.matchAll(/\bdata-([\w-]+)="([^"]*)"/g)) {
      element.dataset[camel(data[1])] = data[2];
    }
    if (element.tag === 'select') {
      const options = html.slice(match.index).split('</select>')[0];
      element.value = options.match(/<option value="([^"]*)" selected/)?.[1]
        || options.match(/<option value="([^"]*)"/)?.[1] || '';
    }
    if (id) nodes[id] = element;
    elements.push(element);
  }
  return elements;
}
const staticElements = parseElements(fs.readFileSync(path.join(root, 'web/index.html'), 'utf8'));
const tabs = staticElements.filter(element => 'tab' in element.dataset);
const document = {
  body: new Element(),
  getElementById(id) {assert(nodes[id], 'Missing dashboard element: ' + id); return nodes[id];},
  querySelectorAll(selector) {return selector.includes('[data-tab]') ? tabs : [];},
  querySelector(selector) {return tabs.find(element => selector.includes(element.dataset.tab));},
  createElement() {return new Element();},
};
class WorkerStub {
  postMessage(message) {
    setTimeout(() => {
      requests.push(JSON.parse(JSON.stringify(message)));
      try {
        const result = message.path === 'roster'
          ? {roster: engine.synthetic(message.payload)} : message.path === 'alliance_roster'
          ? engine.profile_roster(message.payload) : engine[message.path](message.payload);
        this.onmessage({data: {id: message.id, result}});
      } catch (error) {
        this.onmessage({data: {id: message.id, error: error.message}});
      }
    }, 0);
  }
  terminate() {}
}
let published=JSON.parse(fs.readFileSync(path.join(root,'web/data/alliance-api.json'),'utf8'));
// Stable test geometry keeps the UI checks independent of cities moving in a
// later owner refresh. The pure model separately checks the real observations.
published.members.forEach((m,i)=>{
 const id=String(m.governor_id??m.fid);
 published.profiles[id]={governor_id:id,player:{kid:2399,x:650+(i%10)*20,y:700+Math.floor(i/10)*20},fresh:true};
 published.profile_status[id]='refreshed';
});
const storage=new Map();
const fetched=[];
const location={hash:'',pathname:'/',search:''};
const history={replaceState(a,b,path){location.hash=path.includes('#')?'#'+path.split('#')[1]:'';}};
const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const fetch=async url=>{fetched.push(url);assert(['./data/alliance-api.json','./alliance-profiles.json'].includes(url),'Unexpected network request: '+url);return {ok:true,json:async()=>JSON.parse(JSON.stringify(url.includes('alliance-api')?published:require('../web/alliance-profiles.json')))};};
const context = vm.createContext({document, window: {addEventListener() {}}, console,
  Blob, URL, setTimeout, clearTimeout, Worker: WorkerStub, fetch, localStorage, location, history, ...nodes});
for (const file of ['app.js', 'formations-ui.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'web', file), 'utf8'), context);
}
// A short event and small roster keep this state check quick; the complete
// 30-minute mechanics are checked separately in the reference and parity suites.
nodes.alliancedialog.children=staticElements;
nodes.alliancememberform.children=staticElements.filter(e=>['membertrap','memberring','membermeasuredtravel','membermeasuredreturn','memberattending','membercanhost'].includes(e.id));
nodes.n.value = '4';
nodes.duration.value = '2';
nodes.countdown.value = '30';

for(const file of ['ux.js','strategy-builder.js','alliance-model.js','alliance-export.js','alliance-ui.js','approaches.js'])vm.runInContext(fs.readFileSync(path.join(root,'web',file),'utf8'),context);
const state=expression=>vm.runInContext(expression,context);
const ui=context.window.BearAllianceUI;
const clone=value=>JSON.parse(JSON.stringify(value));
async function idle(){
 for(let i=0;i<500;i++){
  if(state('!running && waiting.size===0')&&ui.state.bands&&ui.state.compiled)return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert.fail('The CNQ dashboard did not initialize');
}
function noError(){assert.notEqual(nodes.error.style.display,'block',nodes.error.textContent);}
const file=data=>({size:1000,text:async()=>JSON.stringify(data)});
async function main(){
 await idle();noError();
 assert.equal(ui.state.plan.players.length,published.members.length);
 assert.equal(state('roster.length'),published.members.length);
 assert.equal(state('synthetic'),false);
 assert.equal(nodes.comparegroup.value,'all');
 assert.equal(nodes.allianceopen.textContent,'CNQ roster & traps · '+published.members.length);
 assert(ui.state.plan.players.every(p=>p.group==='none'));
 assert.equal(state('result.runs.length'),6);
 const downloads=[];context.collectDownload=(...args)=>downloads.push(args);
 vm.runInContext('download=collectDownload',context);
 const requestsBeforeDownload=fetched.length,planBeforeDownload=JSON.stringify(ui.state.plan);
 ui.state.selected.add(ui.state.plan.players[0].governorId);
 nodes.alliancedownloadcsv.onclick();nodes.alliancedownloadjson.onclick();
 assert.equal(downloads.length,2);assert(downloads[0][0].endsWith('.csv'));
 assert.equal(JSON.parse(downloads[1][1]).members.length,published.members.length,'API download exports the entire alliance despite selected members');
 assert.equal(fetched.length,requestsBeforeDownload,'Downloads must not fetch API data');
 assert.equal(JSON.stringify(ui.state.plan),planBeforeDownload,'Download must not alter assignments or estimates');
 ui.state.selected.clear();
 const player=state('result.roster[0]'),name=context.BearAllianceModel.engineName(ui.state.plan.players.find(p=>context.BearAllianceModel.engineName(p)===player.name));
 const option=nodes.individual.children.find(e=>e.tag==='option'&&e.value===name);
 assert(option,'The selector must retain the stable engine name as its value');
 assert(nodes.individual.innerHTML.includes(ui.playerName(player)+' – '));
 assert(!nodes.individual.innerHTML.includes('>'+player.name+'</option>'),'Governor ID must not be the visible player label');
 const secondPlayer=state('result.roster[1]');nodes.individual.value=secondPlayer.name;nodes.individual.onchange();
 assert(nodes.individualtitle.textContent.includes(ui.playerName(secondPlayer)+' – '),'Changing players must refresh the heading');
 nodes.individual.value=player.name;nodes.individual.onchange();
 assert(nodes.individuallegend.innerHTML.includes('Everyone together'));
 const playerToggle=nodes.individuallegend.querySelectorAll('[data-line]')[1];
 playerToggle.checked=false;playerToggle.onchange();
 assert(!state('visible.has(1)'));assert(!nodes.individualchart.innerHTML.includes('Strongest leaders only'));
 assert(!nodes.legend.querySelectorAll('[data-line]')[1].checked,'Both graph legends must stay synchronized');
 const mainToggle=nodes.legend.querySelectorAll('[data-line]')[1];mainToggle.checked=true;mainToggle.onchange();
 assert(nodes.individuallegend.querySelectorAll('[data-line]')[1].checked);
 assert(nodes.individualchart.innerHTML.includes('Strongest leaders only'));

 assert.equal(fetched.filter(u=>u.includes('alliance-api')).length,1);
 nodes.allianceopen.onclick();assert(nodes.alliancedialog.open);
 assert.equal(location.hash,'#roster');
 assert(nodes.alliancerows.innerHTML.includes(ui.state.plan.players[0].api.name));
 // Existing general group tests disable the new optional cutoff; it is tested below.
 ui.state.plan.distanceFilter.enabled=false;
 nodes.trapx1.value='650';nodes.trapy1.value='700';nodes.trapx2.value='850';nodes.trapy2.value='900';
 nodes.alliancetrapform.onsubmit({preventDefault(){}});
 nodes.cityseconds.value='.1';nodes.savecalibration.onclick();
 nodes.assignnearest.onclick();
 assert(ui.state.plan.players.some(p=>p.group==='1'));
 assert(ui.state.plan.players.some(p=>p.group==='2'));
 // Zoom and fitting preserve selection and the underlying planning data.
 const planBeforeZoom=JSON.stringify(ui.snapshot()),mapBefore=nodes.alliancemap.innerHTML;
 nodes.mapzoomin.onclick();assert.equal(nodes.mapzoomlevel.textContent,'160%');
 assert.notEqual(nodes.alliancemap.innerHTML,mapBefore);
 nodes.mapfitall.onclick();assert.equal(nodes.mapzoomlevel.textContent,'100%');
 assert.equal(JSON.stringify(ui.snapshot()),planBeforeZoom);
 // A distance boundary excludes only outliers without changing attendance or groups.
 nodes.distanceenabled.checked=true;nodes.distancemax.value='100';nodes.savedistance.onclick();
 const compiledWithCutoff=context.BearAllianceModel.compile(ui.state.plan,ui.state.bands);
 assert(compiledWithCutoff.excluded.length>0);
 const filteredIds=new Set(compiledWithCutoff.excluded.map(p=>p.governorId));
 assert(compiledWithCutoff.roster.every(r=>!filteredIds.has(compiledWithCutoff.bindings[r.name])));
 assert(compiledWithCutoff.excluded.every(p=>ui.state.plan.players.find(x=>x.governorId===p.governorId).attending));
 await ui.scope('all');noError();
 assert.equal(state('result.roster.length'),compiledWithCutoff.roster.length);
 const cutoffRequest=requests.filter(r=>r.path==='compare').at(-1).payload;
 assert(cutoffRequest.roster.every(r=>!filteredIds.has(compiledWithCutoff.bindings[r.name])));
 nodes.mapfitnearby.onclick();assert(ui.state.map.view);assert(nodes.distanceexcluded.innerHTML.includes('distant members'));
 const stateWithCutoff=clone(ui.snapshot());
 assert(stateWithCutoff.distanceFilter.enabled);assert.equal(stateWithCutoff.distanceFilter.maxUnits,100);
 nodes.distanceenabled.checked=false;nodes.savedistance.onclick();
 assert.equal(state('roster.length'),published.members.length);
 const first=ui.state.plan.players[0],id=first.governorId;
 nodes.alliancerows.onclick({target:{closest(){return {dataset:{editAlliance:id}};}}});
 nodes.membertrap.value='1';nodes.membertrap.onchange();
 nodes.membermeasuredtravel.value='19';nodes.membermeasuredreturn.value='21';
 nodes.membercanhost.checked=false;
 const stats=nodes.alliancestateditor.children.filter(e=>e.dataset.allianceStat);
 for(const [key,value]of Object.entries({infantry:100000,cavalry:50000,archers:150000,march_capacity:100000,archers_lethality_bonus:222}))stats.find(e=>e.dataset.allianceStat===key).value=String(value);
 nodes.alliancememberform.onsubmit({preventDefault(){}});
 assert.equal(ui.state.plan.players[0].stats.archers_lethality_bonus,222);
 assert.equal(ui.state.plan.players[0].travel['1'].seconds,19);
 assert.equal(ui.state.plan.players[0].canHost,false);
 await ui.scope('1');noError();
 const expected=ui.state.plan.players.filter(p=>p.group==='1'&&p.attending).length;
 assert.equal(state('result.roster.length'),expected);
 const request=requests.filter(r=>r.path==='compare').at(-1).payload;
 assert(request.travel_times,'Trap comparisons must send city-to-city times to the worker');
 const engineName=Object.keys(ui.state.compiled.bindings).find(name=>ui.state.compiled.bindings[name]===id);
 assert.equal(request.roster.find(r=>r.name===engineName).outbound_s,19);
 assert.equal(request.roster.find(r=>r.name===engineName).return_s,21);
 assert.equal(request.roster.find(r=>r.name===engineName).can_host,false);
 assert.equal(request.roster.find(r=>r.name===engineName).archers_lethality_bonus,222);
 // A renamed governor remains assigned; movement invalidates measured timing.
 const changed=published.members.find(m=>String(m.governor_id??m.fid)===id);changed.nick_name='Updated governor';
 published.profiles[id].player.x+=2;
 await nodes.alliancerefresh.onclick();noError();
 assert.equal(ui.state.plan.players[0].api.name,'Updated governor');
 assert.equal(ui.state.plan.players[0].group,'1');
 assert.equal(ui.state.plan.players[0].stats.archers_lethality_bonus,222);
 assert(context.BearAllianceModel.travel(ui.state.plan,ui.state.plan.players[0]).stale);
 nodes.alliancerows.onclick({target:{closest(){return {dataset:{editAlliance:id}};}}});
 assert.equal(nodes.membermeasuredtravel.value,'');
 nodes.alliancememberform.onsubmit({preventDefault(){}});
 assert(context.BearAllianceModel.travel(ui.state.plan,ui.state.plan.players[0]).stale,'Editing stats must not silently confirm an obsolete measured march');
 const saved=state('allianceProjectSnapshot()');
 assert.equal(saved.alliancePlan.players[0].group,'1');
 assert(storage.size===1);
 // Plan import restores assignment and measured stats, plus added comparisons.
 const imported=clone(saved);imported.alliancePlan.players[0].group='2';imported.alliancePlan.comparisonGroup='2';
 await nodes.alliancefile.onchange({target:{files:[file(imported)],value:'plan.json'}});noError();
 assert.equal(ui.state.plan.players[0].group,'2');
 assert.equal(state('result.roster.length'),ui.state.plan.players.filter(p=>p.group==='2'&&p.attending).length);
 const before=JSON.stringify(ui.snapshot());
 const invalid=clone(imported);invalid.controls.countdown=5;
 await nodes.alliancefile.onchange({target:{files:[file(invalid)],value:'bad.json'}});
 assert.equal(JSON.stringify(ui.snapshot()),before,'Failed imports must not replace the current plan');
 assert.equal(Number(nodes.countdown.value),30);
 const bad=clone(imported);bad.alliancePlan.players.push(bad.alliancePlan.players[0]);
 await nodes.alliancefile.onchange({target:{files:[file(bad)],value:'bad.json'}});
 assert.equal(JSON.stringify(ui.snapshot()),before);
 // Bulk attendance can exclude a whole group without leaving old graphs visible.
 nodes.bulkgroup.value='keep';nodes.bulkrole.value='keep';nodes.bulkattendance.value='no';
 for(const p of ui.state.plan.players.filter(p=>p.group==='2'))ui.state.selected.add(p.governorId);
 nodes.applyalliancebulk.onclick();
 assert.equal(state('result'),null);
 assert(nodes.alliancechart.innerHTML.includes('Assign attending members'));
 assert(nodes.recommend.disabled);
 nodes.allianceclose.onclick();assert(!nodes.alliancedialog.open);assert.equal(location.hash,'');
 // The complete plan remains exportable even when the current group is absent.
 assert.equal(ui.snapshot().players.length,published.members.length);
 assert(fetched.every(url=>!url.includes('mightpulse')));
 console.log('CNQ startup, bulk assignment, measured stats, trap graphs, refresh preservation and atomic imports pass.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
