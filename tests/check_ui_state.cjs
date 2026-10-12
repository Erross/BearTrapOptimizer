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
vm.runInContext(fs.readFileSync(path.join(root, 'web/approaches.js'), 'utf8'), context);
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
  assert.equal(state('result.runs.length'), 5, 'The basic comparison needs exactly five coherent approaches');
  assert.equal(state('visible.size'), 5, 'All five approaches should be graphed initially');
  assert(nodes.alliancechart.innerHTML.includes('Relative alliance damage'));
  assert(!nodes.setupdialog.open, 'Detailed setup should be closed initially');
  assert(state('result.runs[2].strategy.opening_wave_count'), 'Wave plans need an exact requested wave count');
  assert.equal(state('result.runs[3].strategy.join_march_cap'), 50000);
  context.activatePage('membertab');
  assert.equal(nodes.setupdialog.open, true, 'Setup needs to open when requested');
  context.closePlanSettings();
  assert.equal(nodes.setupdialog.open, false);

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
  console.log('Dashboard attendance, saved player details and stock estimates survive recommendations.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
