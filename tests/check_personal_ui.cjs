// Actual personal-page handlers with a minimal DOM. Visual layout is not tested.
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const root=path.resolve(__dirname,'..'), nodes={};
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
  addEventListener(type, fn) {this.handlers ??= {}; this.handlers[type]=fn;}
  scrollIntoView() {}
  focus() {}
  select() {this.selectedText = true;}
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

parseElements(fs.readFileSync(path.join(root,'web/optimize-me.html'),'utf8'));
const document={getElementById(id){assert(nodes[id], 'Missing personal element: '+id);return nodes[id];},createElement(){return new Element();}};
const storage=new Map(),localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const published=require('../web/data/alliance-api.json');
const context=vm.createContext({window:{},document,localStorage,console,URL,URLSearchParams,Blob,setTimeout,location:{search:''},navigator:{clipboard:{writeText:async text=>{context.copied=text;}}},fetch:async()=>({ok:true,json:async()=>published})});
for(const file of ['alliance-model.js','personal-model.js','personal-ui.js'])vm.runInContext(fs.readFileSync(path.join(root,'web',file),'utf8'),context);
const PROFILES='BearTrapOptimizer:personal-profiles:v1',PLAN='BearTrapOptimizer:CNQ:2399:plan:v1';
const submit=()=>nodes.personalform.handlers.submit({preventDefault(){}});
async function main(){
 await new Promise(resolve=>setTimeout(resolve,0));
 const roster=context.BearAllianceModel.mergeSnapshot(context.BearAllianceModel.emptyPlan(),published).players;
 const first=roster[0].governorId,second=roster[1].governorId;
 assert(nodes.personalplayer.innerHTML.includes(first));
 nodes.personalplayer.value=first;nodes.personalplayer.handlers.change({});
 nodes.personalown.checked=false;nodes.personaljoins.value='5';nodes.personalpresets.value='2';nodes.personalcapacity.value='100000';nodes.personalbare.value='90000';nodes.personalcap.value='0';
 nodes.personalstock10archers.value='200000';
 nodes.personalform.handlers.input();submit();
 assert.equal(nodes.personalerror.hidden,true,nodes.personalerror.textContent);
 assert.equal(nodes.personalresult.hidden,false);
 assert(nodes.personalnumbers.innerHTML.includes('40,000'));
 assert(nodes.personalpresettbl.innerHTML.includes('Manual setup'));
 assert(nodes.personaltiming.innerHTML.includes('No current selected alliance comparison'));
 await nodes.personalcopy.onclick();assert(context.copied.includes('40,000 archers'));
 nodes.personalapply.onclick();
 assert.equal(JSON.parse(storage.get(PLAN)).players.find(p=>p.governorId===first).stats.archers,200000);
 nodes.personalplayer.value=second;nodes.personalplayer.handlers.change({});
 nodes.personalstock10archers.value='12345';nodes.personalform.handlers.input();
 nodes.personalplayer.value=first;nodes.personalplayer.handlers.change({});
 assert.equal(nodes.personalstock10archers.value,'200000');
 // Importing the same player must replace the old draft, not overwrite the import.
 const input=JSON.parse(storage.get(PROFILES)).players[first].input;input.stock[10].archers=300000;
 const event={target:{files:[{size:1000,text:async()=>JSON.stringify({schema:'bear-personal-profile',version:1,governorId:first,input})}],value:'test.json'}};
 await nodes.personalimport.onchange(event);
 assert.equal(nodes.personalstock10archers.value,300000);
 assert.equal(nodes.personalerror.hidden,true,nodes.personalerror.textContent);
 assert(nodes.personalnumbers.innerHTML.includes('60,000'));
 const before=nodes.personalstock10archers.value;
 await nodes.personalimport.onchange({target:{files:[{size:1000,text:async()=>JSON.stringify({schema:'wrong'})}],value:'bad.json'}});
 assert.equal(nodes.personalstock10archers.value,before);
 assert.equal(nodes.personalerror.hidden,false);
 // Exercise cloud controls through the actual personal-page bridge.
 for(const file of ['cloud-client.js','cloud-personal.js'])vm.runInContext(fs.readFileSync(path.join(root,'web',file),'utf8'),context);
 const calls=[];context.BearCloud.request=async(route,key,method,data)=>{calls.push({route,key,method,data});return method==='PUT'?{revision:3,updatedAt:'2026-10-21T20:00:00Z'}:{input,revision:2,updatedAt:'2026-10-21T19:00:00Z'};};
 await nodes.cloudload.onclick();
 assert.equal(nodes.cloudsave.disabled,false);
 await nodes.cloudsave.onclick();assert.equal(calls.at(-1).data.revision,2);assert.equal(calls.at(-1).key,'');
 nodes.personalplayer.value=second;nodes.personalplayer.handlers.change({});assert.equal(nodes.cloudsave.disabled,true);
 console.log('Personal roster selection, presets, local/cloud saves, model apply, copy and import checks pass.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
