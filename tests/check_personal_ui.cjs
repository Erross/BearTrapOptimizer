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
  setAttribute(name,value) {this.attributes ??= {};this.attributes[name]=value;}
  addEventListener(type, fn) {this.handlers ??= {}; this.handlers[type]=fn;}
  scrollIntoView() {}
  focus() {this.focused=true;}
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
 for(const h of context.BearPersonalModel.HEROES)nodes['personalhas'+h.id].checked=false;
 nodes.personalform.handlers.input();submit();
 assert.equal(nodes.personalerror.hidden,true,nodes.personalerror.textContent);
 assert.equal(nodes.personalresult.hidden,false);
 assert(nodes.personalnumbers.innerHTML.includes('40,000'));
 assert(!nodes.personalpresettbl.innerHTML.includes('Manual setup'));
 assert(nodes.personalpresettbl.innerHTML.includes('Joins 1–5'));
 assert(nodes.personalpresettbl.innerHTML.includes('Preset 1 · reusable'));
 assert.equal((nodes.personalsetupsteps.innerHTML.match(/Save as preset/g)||[]).length,1);
 assert(nodes.personalsetupsteps.innerHTML.includes('Reuse this one preset'));
 assert(nodes.personalnumbers.innerHTML.includes('1 / 2'));
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
 // Exercise direct save, validation and asynchronous cloud behavior through real handlers.
 vm.runInContext(fs.readFileSync(path.join(root,'web/cloud-client.js'),'utf8'),context);
 const calls=[];
 const response={input,revision:2,updatedAt:'2026-10-21T19:00:00Z'};
 context.BearCloud.request=async(route,key,method,data)=>{calls.push({route,key,method,data});return method==='PUT'?{revision:3,updatedAt:'2026-10-21T20:00:00Z'}:response;};
 vm.runInContext(fs.readFileSync(path.join(root,'web/cloud-personal.js'),'utf8'),context);
 await submit();
 assert.equal(calls.at(-1).method,'PUT');assert.equal(calls.at(-1).data.revision,2);assert.equal(calls.at(-1).key,'');
 assert.equal(nodes.cloudbadge.textContent,'Saved online');assert.equal(nodes.cloudsave.disabled,false);
 // Validation focuses a specific field and never submits invalid entries.
 const beforeInvalid=calls.length;nodes.personalcapacity.value='';
 await submit();assert.equal(calls.length,beforeInvalid);
 assert.equal(nodes.personalcapacity.attributes['aria-invalid'],'true');assert.equal(nodes.personalcapacity.focused,true);
 assert.equal(nodes.personalcapacityerror.hidden,false);
 nodes.personalcapacity.value='100000';nodes.personalform.handlers.input();
 const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
 // Late automatic prefill must preserve edits typed during the request.
 const late=deferred();context.BearCloud.request=()=>late.promise;
 const checking=context.window.BearCloudSelectionChanged();
 nodes.personalstock10archers.value='333333';nodes.personalform.handlers.input();
 late.resolve(response);await checking;
 assert.equal(nodes.personalstock10archers.value,'333333');assert.equal(nodes.cloudload.hidden,false);
 // Explicitly choosing an online copy replaces the old local draft.
 context.BearCloud.request=async()=>response;await nodes.cloudload.onclick();
 assert.equal(nodes.personalstock10archers.value,300000);assert.equal(nodes.cloudload.hidden,true);
 // A failed check leaves the draft usable and offers an explicit retry.
 context.BearCloud.request=async()=>{throw Error('Service unavailable');};
 await context.window.BearCloudSelectionChanged();
 assert.equal(nodes.cloudretry.hidden,false);assert.equal(nodes.cloudsave.disabled,false);
 assert.equal(nodes.personalstock10archers.value,300000);
 // A response for the previous player cannot change the newly selected player.
 const stale=deferred();context.BearCloud.request=()=>stale.promise;
 const oldCheck=context.window.BearCloudSelectionChanged();
 nodes.personalplayer.value=second;nodes.personalplayer.handlers.change({});
 stale.resolve(response);await oldCheck;await new Promise(r=>setTimeout(r,0));
 assert.equal(context.window.BearPersonalProfiles.current().governorId,second);
 assert.equal(String(nodes.personalstock10archers.value),'12345');
 // Return to the complete profile and exercise a stale-write conflict.
 context.BearCloud.request=async()=>response;
 nodes.personalplayer.value=first;nodes.personalplayer.handlers.change({});await new Promise(r=>setTimeout(r,0));
 nodes.personalstock10archers.value='444444';nodes.personalform.handlers.input();
 let writes=0;context.BearCloud.request=async(route,key,method)=>{if(method==='PUT'){writes++;throw Error('Profile changed. Load again.');}return response;};
 await submit();assert.equal(writes,1);assert.equal(nodes.cloudreplace.hidden,false);
 await submit();assert.equal(writes,1,'A retry must not silently overwrite a newer online copy');
 await nodes.cloudload.onclick();assert.equal(nodes.personalstock10archers.value,300000);
 assert.equal(nodes.cloudreplace.hidden,true);
 // Edits made while a PUT is pending stay marked as a draft.
 const saving=deferred();context.BearCloud.request=async(route,key,method)=>method==='PUT'?saving.promise:response;
 const saveTask=submit();assert.equal(nodes.cloudsave.disabled,true);
 nodes.personalstock10archers.value='555555';nodes.personalform.handlers.input();
 saving.resolve({revision:4,updatedAt:'2026-10-21T20:10:00Z'});await saveTask;
 assert.equal(nodes.cloudbadge.textContent,'Earlier entries saved');
 assert.equal(nodes.personalstock10archers.value,'555555');assert.equal(context.window.BearPersonalProfiles.hasDraft(),true);
 assert.equal(nodes.cloudsave.disabled,false);
 console.log('Personal roster selection, presets, local/cloud saves, model apply, copy and import checks pass.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
