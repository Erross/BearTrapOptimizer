// Exercise roster edits through the actual dashboard handlers and worker engine.
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
const context = vm.createContext({document, window: {addEventListener() {}}, console,
  Blob, URL, setTimeout, clearTimeout, Worker: WorkerStub, ...nodes});
for (const file of ['app.js', 'formations-ui.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'web', file), 'utf8'), context);
}
// A short event and small roster keep this state check quick; the complete
// 30-minute mechanics are checked separately in the reference and parity suites.
nodes.n.value = '4';
nodes.duration.value = '2';
nodes.countdown.value = '30';
vm.runInContext(fs.readFileSync(path.join(root, 'web/ux.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'web/strategy-builder.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'web/approaches.js'), 'utf8'), context);
context.generate();
const state = expression => vm.runInContext(expression, context);
const generatedCount = () => requests.filter(request => ['roster', 'alliance_roster'].includes(request.path)).length;
const searchRequest = () => requests.filter(request => request.path === 'compare').at(-1).payload;
function noError() {
  assert.notEqual(nodes.error.style.display, 'block', nodes.error.textContent);
}
async function main() {
  for (let attempt = 0; attempt < 500; attempt++) {
    noError();
    if (state('result !== null && !running && waiting.size === 0')) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert(state('result !== null'), 'Initial recommendation did not finish');
  assert.equal(state('result.runs.length'), 6, 'The basic comparison needs both capped and uncapped wave approaches');
  assert.equal(state('visible.size'), 6, 'All six approaches should be graphed initially');
  assert(nodes.strategyeditor.hidden, 'The optional strategy editor starts closed');
  assert(nodes.alliancechart.innerHTML.includes('Relative alliance damage'));
  assert(!nodes.setupdialog.open, 'Detailed setup should be closed initially');
  assert(state('result.runs[2].strategy.opening_wave_count'), 'Wave plans need an exact requested wave count');
  assert.equal(state('result.runs[3].strategy.join_march_cap'), 50000);
  assert.equal(state('result.runs[5].strategy.join_march_cap'), 50000);
  const pair = JSON.parse(state('JSON.stringify([result.runs[4].strategy, result.runs[5].strategy])'));
  for (const settings of pair) {delete settings.name; delete settings.join_march_cap;}
  assert.deepEqual(pair[0], pair[1], 'The everyone-wave pair must differ only in its joining limit');
  assert(nodes.legend.innerHTML.includes('Everyone in waves + troop limit'));
  assert(nodes.comparisontable.innerHTML.includes('Everyone in waves + troop limit'));
  context.selectPlan(5);
  assert.equal(nodes.selectedname.textContent, 'Everyone in waves + troop limit');
  assert(nodes.planbrief.innerHTML.includes('Every eligible attending player leads and joins.'));
  assert(nodes.planbrief.innerHTML.includes('Up to 50,000 per join'));
  context.activatePage('membertab');
  assert.equal(nodes.setupdialog.open, true, 'Setup needs to open when requested');
  context.closePlanSettings();
  assert.equal(nodes.setupdialog.open, false);

  async function waitForCap(cap) {
    for (let attempt = 0; attempt < 500; attempt++) {
      noError();
      if (state('!running && !resultsDirty && result.runs[5].strategy.join_march_cap') === cap) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Automatic comparison did not apply cap ' + cap);
  }
  state('visible = new Set([4, 5])');
  const beforeDial = generatedCount();
  nodes.frontcap.value = '75000';
  nodes.frontcap.oninput();
  await waitForCap(75000);
  assert.equal(nodes.joinmarchcap.value, '75000');
  assert.equal(state('result.runs[3].strategy.join_march_cap'), 75000);
  assert.equal(state('visible.size'), 2, 'Cap changes must keep the chosen graph lines');
  assert.equal(generatedCount(), beforeDial, 'The troop-cap dial must not replace the roster');
  // Change the cap while another worker comparison is outstanding. Its older
  // answer must stay marked stale until the queued latest cap has been applied.
  const inFlight = context.run();
  nodes.joinmarchcap.value = '65000';
  nodes.joinmarchcap.oninput();
  await inFlight;
  await waitForCap(65000);
  assert.equal(Number(nodes.frontcap.value), 65000);
  nodes.joinmarchcap.value = '50000';
  nodes.joinmarchcap.oninput();
  await waitForCap(50000);

  // Equivalent choices must remain equivalent through the real UI builder,
  // not just through two matching simulator implementations. Use the complete
  // default event to include later restarts and returning troop inventories.
  nodes.n.value = '40';
  nodes.hosts.value = '40';
  nodes.duration.value = '30';
  nodes.countdown.value = '300';
  nodes.frontwaves.value = '1';
  await context.generate();
  noError();
  let equivalent = state('JSON.stringify([result.runs[0], result.runs[2], result.runs[4]])');
  equivalent = JSON.parse(equivalent);
  for (const run of equivalent.slice(1)) {
    assert.deepEqual(run.series, equivalent[0].series,
      'Everyone in one wave must have the same complete damage curve as everyone together');
    assert.deepEqual(run.hits, equivalent[0].hits,
      'Equivalent approaches must hit with the same troops, timings and damage');
    assert.deepEqual(run.members, equivalent[0].members,
      'Equivalent approaches must give every player the same damage and troop use');
  }
  assert(state('JSON.stringify(result.runs[3].series) === JSON.stringify(result.runs[5].series)'),
    'Selecting everyone must also make the two capped approaches identical');
  assert(state('result.runs[5].contributions.filter(p => p.role === "join").every(p => p.troops <= 50000)'),
    'Everyone-wave joining marches must obey the voluntary limit');
  nodes.frontwaves.value = '7';
  nodes.frontgap.value = '0';
  await nodes.recommend.onclick();
  noError();
  assert(state('JSON.stringify(result.runs[0].series) === JSON.stringify(result.runs[4].series)'),
    'Zero spacing between opening waves must also match everyone together');
  assert(state('JSON.stringify(result.runs[2].series) === JSON.stringify(result.runs[4].series)'),
    'Selecting all starters must match the everyone approach');
  nodes.joinmarchcap.value = '2000000';
  await nodes.recommend.onclick();
  noError();
  assert(state('JSON.stringify(result.runs[2].series) === JSON.stringify(result.runs[3].series)'),
    'A joining limit above every march size must have no effect');
  assert(state('JSON.stringify(result.runs[4].series) === JSON.stringify(result.runs[5].series)'),
    'A joining limit above every march size must also have no effect on everyone in waves');
  nodes.joinmarchcap.value = '50000';
  nodes.n.value = '4';
  nodes.hosts.value = '4';
  nodes.duration.value = '2';
  nodes.countdown.value = '30';
  nodes.frontwaves.value = '4';
  nodes.frontgap.value = '60';
  await context.generate();
  noError();

  const excludedName = state('roster[0].name');
  const attendance = nodes.rostertable.querySelectorAll('[data-attend]')[0];
  attendance.checked = false;
  attendance.onchange();
  const beforeAttendance = generatedCount();
  await nodes.recommend.onclick();
  noError();
  assert.equal(generatedCount(), beforeAttendance, 'Recommendation rebuilt an edited attendance list');
  assert.equal(searchRequest().roster.length, 3);
  assert(!searchRequest().roster.some(member => member.name === excludedName));
  assert(nodes.advisorassumptions.textContent.includes('3 estimated troop stocks'), 'Estimated-stock count must use attendance');

  await context.generate();
  state('editingMember = roster[0].name');
  context.renderMemberEditor();
  nodes['member-name'].value = 'Captain';
  nodes['member-rally_capacity'].value = '740000';
  await context.saveMemberDetails();
  noError();
  const beforeDetails = generatedCount();
  await nodes.recommend.onclick();
  noError();
  assert.equal(generatedCount(), beforeDetails, 'Recommendation rebuilt saved player details');
  const captain = searchRequest().roster.find(member => member.name === 'Captain');
  assert(captain, 'Saved player name disappeared');
  assert.equal(captain.rally_capacity, 740000);
  assert(state('estimatedStocks.has("Captain")'), 'Editing details mislabeled estimated troops');

  await context.generate();
  const estimatedName = state('roster[0].name');
  nodes.troopplayer.value = estimatedName;
  context.renderPlayerEditor();
  nodes.mintroops.value = '90000';
  nodes.minpower.value = state('roster[0].power_m');
  context.estimatePlayerStock();
  noError();
  const beforeEstimate = generatedCount();
  await nodes.recommend.onclick();
  noError();
  assert.equal(generatedCount(), beforeEstimate, 'Recommendation replaced an individually estimated stock');
  assert.equal(searchRequest().roster.find(member => member.name === estimatedName).troops, 90000);
  assert(state('estimatedStocks.has(roster[0].name)'), 'Estimated stock lost its provenance');
  await context.run({custom: true});
  noError();
  const customBeforeCap = state('JSON.stringify(result.runs[6])');
  state('visible = new Set([4, 5, 6])');
  nodes.joinmarchcap.value = '60000';
  nodes.joinmarchcap.oninput();
  await waitForCap(60000);
  assert.equal(state('result.runs.length'), 7, 'Cap updates must retain a custom comparison');
  assert.equal(state('JSON.stringify(result.runs[6])'), customBeforeCap);
  assert.equal(state('chosen'), 6, 'Cap updates must keep the selected custom plan');
  assert.equal(state('visible.size'), 3);
  const rosterBeforeStrategies = state('JSON.stringify(roster)');
  context.openStrategyEditor();
  nodes.planname.value = 'Archers 80';
  nodes.planmix80.onclick();
  nodes.planhosts.value = '4';
  nodes.plancadence.value = 'groups';
  nodes.planwaves.value = '2';
  nodes.plangap.value = '10';
  nodes.plancapmode.value = 'fixed';
  nodes.plancap.value = '45000';
  await nodes.strategyeditor.onsubmit({preventDefault() {}});
  noError();
  assert(nodes.strategyeditor.hidden);
  assert.equal(state('result.runs.length'), 8);
  assert.equal(state('result.runs[7].strategy.name'), 'Archers 80');
  assert.equal(state('result.runs[7].strategy.infantry_pct'), 10);
  assert.equal(state('result.runs[7].strategy.formation'), 'adaptive');
  assert.equal(state('result.runs[7].strategy.join_march_cap'), 45000);
  assert(nodes.legend.innerHTML.includes('Archers 80'));
  assert(nodes.comparisontable.innerHTML.includes('10 / 10 / 80'));
  context.openStrategyEditor();
  nodes.planname.value = 'Archers 60';
  nodes.planmix60.onclick();
  await nodes.strategyeditor.onsubmit({preventDefault() {}});
  noError();
  assert.equal(state('result.runs.length'), 9);
  assert.equal(state('result.runs[8].strategy.infantry_pct'), 20);
  assert.notEqual(state('result.runs[7].total_damage'), state('result.runs[8].total_damage'),
    'Different troop mixes must be independently calculated');
  assert.equal(state('JSON.stringify(roster)'), rosterBeforeStrategies);
  assert(Math.abs(state('result.runs[0].total_damage') - 2e9) < .01, 'Added plans must share the same baseline');
  await context.duplicateAddedStrategy(1);
  noError();
  assert.equal(state('result.runs.length'), 10);
  assert.equal(state('JSON.stringify(result.runs[7].series)'), state('JSON.stringify(result.runs[9].series)'),
    'Duplicating settings must give the same complete curve');
  context.openStrategyEditor(3);
  nodes.plancapmode.value = 'dial';
  await nodes.strategyeditor.onsubmit({preventDefault() {}});
  noError();
  const fixedCurve = state('JSON.stringify(result.runs[7].series)');
  nodes.joinmarchcap.value = '70000';
  nodes.joinmarchcap.oninput();
  await waitForCap(70000);
  assert.equal(state('result.runs[9].strategy.join_march_cap'), 70000);
  assert.equal(state('result.runs[7].strategy.join_march_cap'), 45000);
  assert.equal(state('JSON.stringify(result.runs[7].series)'), fixedCurve);
  context.openStrategyEditor(1);
  nodes.planname.value = 'Archers 85';
  nodes.planinf.value = '5';
  await nodes.strategyeditor.onsubmit({preventDefault() {}});
  noError();
  assert.equal(state('result.runs[7].strategy.infantry_pct'), 5);
  assert.equal(state('result.runs[9].strategy.infantry_pct'), 10, 'Editing one plan must not edit its copy');
  await context.removeAddedStrategy(2);
  noError();
  assert.equal(state('result.runs.length'), 9);
  assert(!nodes.legend.innerHTML.includes('Archers 60'));
  assert.equal(state('result.runs[8].strategy.name'), 'Archers 80 copy');
  let savedProject;
  context.download = (name, text) => {savedProject = JSON.parse(text);};
  nodes.save.onclick();
  assert.equal(savedProject.addedStrategies.length, 3);
  const savedRows = JSON.stringify(savedProject.addedStrategies);
  state('addedStrategies = []');
  await context.run();
  const loadProject = async project => nodes.projectfile.onchange({target: {
    files: [{text: async () => JSON.stringify(project)}], value: 'fixture.json',
  }});
  await loadProject(savedProject);
  noError();
  assert.equal(state('result.runs.length'), 9);
  assert.equal(state('JSON.stringify(addedStrategies)'), savedRows);
  const invalid = JSON.parse(JSON.stringify(savedProject));
  invalid.addedStrategies[1].strategy.infantry_pct = 120;
  await loadProject(invalid);
  assert.equal(nodes.error.style.display, 'block');
  assert.equal(state('JSON.stringify(addedStrategies)'), savedRows, 'Bad strategy imports must restore the saved comparison');
  assert.equal(state('JSON.stringify(roster)'), rosterBeforeStrategies);
  nodes.error.style.display = 'none';
  context.openStrategyEditor();
  nodes.planname.value = 'Invalid mix';
  nodes.planformation.value = 'adaptive';
  nodes.planinf.value = '80';
  nodes.plancav.value = '80';
  await nodes.strategyeditor.onsubmit({preventDefault() {}});
  assert.equal(nodes.error.style.display, 'block');
  assert.equal(state('addedStrategies.length'), 3);
  nodes.strategycancel.onclick();
  nodes.error.style.display = 'none';
  console.log('Named mixes, edit/copy/remove, saved comparisons, cap dial and equivalent waves pass.');
  let currentSnapshot=JSON.parse(fs.readFileSync(path.join(root,'web/data/alliance-api.json'),'utf8'));
  const storage=new Map();
  context.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  context.fetch=async url=>({ok:true,json:async()=>url.includes('alliance-profiles')?
    JSON.parse(fs.readFileSync(path.join(root,'web/alliance-profiles.json'),'utf8')):currentSnapshot});
  vm.runInContext(fs.readFileSync(path.join(root,'web/alliance-model.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'web/alliance-ui.js'),'utf8'),context);
  for(let i=0;i<200&&(!state('allianceReady')||state('running')||state('roster.length')!==98);i++)await new Promise(resolve=>setTimeout(resolve,10));
  noError();assert.equal(state('roster.length'),98);assert.equal(state('synthetic'),false);
  assert(nodes.alliancetable.innerHTML.includes('Kiki'));
  assert.equal(nodes.n.disabled,true);
  for(const [id,value] of Object.entries({trap1x:750,trap1y:850,trap2x:800,trap2y:850,citywidth:100,widthseconds:1,traveloffset:0}))nodes[id].value=String(value);
  nodes.trapform.onsubmit({preventDefault(){}});noError();
  const ids=state('alliancePlan.players.slice(0,6).map(p=>p.governorId)');
  state('allianceSelected=new Set(alliancePlan.players.slice(0,6).map(p=>p.governorId))');
  nodes.bulkgroup.value='1';nodes.bulkassign.onclick();noError();
  assert.equal(state('alliancePlan.players.filter(p=>p.group==="1").length'),6);
  nodes.alliancegroup.value='1';await nodes.alliancegroup.onchange();noError();
  assert.equal(state('result.roster.length'),6);assert.equal(Object.keys(searchRequest().mechanics.join_travel_times).length,6);
  context.renderAllianceMember(ids[0]);nodes.measured1.value='5';nodes.measuredreturn1.value='7';nodes.savetravel.onclick();noError();
  await context.run();noError();assert.equal(state('result.roster[0].outbound_s'),5);assert.equal(state('result.roster[0].return_s'),7);
  const originalName=state('roster[0].name');state('editingMember=roster[0].name');context.renderMemberEditor();
  nodes['member-rally_capacity'].value='812345';await context.saveMemberDetails();noError();
  nodes.troopplayer.value=originalName;context.renderPlayerEditor();
  nodes.stock_infantry.value='20000';nodes.stock_cavalry.value='10000';nodes.stock_archers.value='40000';
  await context.savePlayer();noError();
  const savedCNQ=JSON.parse(storage.get('bear-cnq-plan-v1'));assert.equal(savedCNQ.players[0].stats.rally_capacity,812345);assert.equal(savedCNQ.players[0].stats.archers,40000);
  currentSnapshot=JSON.parse(JSON.stringify(currentSnapshot));currentSnapshot.members[0].nick_name='Renamed Captain';
  await nodes.reloadsnapshot.onclick();noError();
  assert.equal(state('roster[0].rally_capacity'),812345);assert.equal(state('roster[0].archers'),40000);assert(state('roster[0].name.startsWith("Renamed Captain")'));
  assert.equal(state('roster[0].outbound_s'),5);assert.equal(state('alliancePlan.players[0].group'),'1');
  await context.run();nodes.save.onclick();const cnqProject=savedProject;
  nodes.alliancegroup.value='all';await nodes.alliancegroup.onchange();noError();assert.equal(state('roster.length'),98);
  await loadProject(cnqProject);noError();assert.equal(state('roster.length'),6);assert.equal(state('roster[0].archers'),40000);
  const bad=JSON.parse(JSON.stringify(cnqProject));bad.alliancePlan.players[0].group='A';await loadProject(bad);
  assert.equal(nodes.error.style.display,'block');assert.equal(state('alliancePlan.comparisonGroup'),'1');nodes.error.style.display='none';
  nodes.alliancesource.value='demo';await nodes.alliancesource.onchange();noError();assert.equal(state('usingAlliance()'),false);
  nodes.alliancesource.value='cnq';await nodes.alliancesource.onchange();noError();assert.equal(state('roster[0].rally_capacity'),812345);
  console.log('CNQ dashboard loading, group comparison, measured travel, edits, renamed imports and plan round-trip pass.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
