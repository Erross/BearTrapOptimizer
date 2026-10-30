/* Shared presentation-only localization. Models and saved data stay canonical. */
(function(root){
'use strict';
const LANGUAGES={en:['English','en-US'],tr:['Türkçe','tr-TR'],fr:['Français','fr-FR'],de:['Deutsch','de-DE'],da:['Dansk','da-DK'],es:['Español','es-ES'],pt:['Português','pt-BR']};
const VERSION='20261029-1',KEY='BearTrapOptimizer:language:v1';
const normalize=s=>String(s??'').replace(/\s+/g,' ').trim();
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function numeric(s,lang){
 if(lang==='en'||!/[\d]/.test(s))return s;
 return s.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+\.\d+\b/g,x=>{
  const digits=x.includes('.')?x.split('.')[1].length:0;
  return new Intl.NumberFormat(LANGUAGES[lang][1],{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(x.replaceAll(',','')));
 });
}
function translator(messages,lang='en'){
 const patterns=Object.keys(messages).filter(k=>/\{\d+\}/.test(k)&&k.replace(/\{\d+\}/g,'').replace(/[^A-Za-z]/g,'').length>=4).sort((a,b)=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(key=>{
  const ids=[];let last=0,source='^';for(const m of key.matchAll(/\{(\d+)\}/g)){source+=escapeRegex(key.slice(last,m.index))+'([\\s\\S]*?)';ids.push(m[1]);last=m.index+m[0].length;}source+=escapeRegex(key.slice(last))+'$';return {regex:new RegExp(source),ids,value:messages[key]};
 });
 function text(value,depth=0){
  const raw=String(value??''),s=normalize(raw);if(!s||lang==='en')return raw;
  let out;
  if(Object.hasOwn(messages,s))out=messages[s];
  else if(depth<3){for(const p of patterns){const m=s.match(p.regex);if(!m)continue;const params={};p.ids.forEach((id,i)=>{params[id]=text(m[i+1],depth+1);});out=p.value.replace(/\{(\d+)\}/g,(_,id)=>params[id]??'{'+id+'}');break;}}
  if(out===undefined&&depth<3){const pieces=raw.split(/(\n+| · | — |: (?=[A-Za-z]))/);if(pieces.length>1)out=pieces.map((x,i)=>i%2?x:text(x,depth+1)).join('');}
  if(out===undefined)out=s;
  // Keep whitespace at boundaries: adjacent inline elements rely on it.
  return (raw.match(/^\s*/)?.[0]||'')+(depth===0?numeric(out,lang):out)+(raw.match(/\s*$/)?.[0]||'');
 }
 return text;
}
if(typeof module!=='undefined'&&module.exports)module.exports={LANGUAGES,normalize,numeric,translator};
if(!root.document)return;
const document=root.document,cache=new Map(),texts=new WeakMap(),attributes=new WeakMap(),rich=new WeakMap();
const skip='script,style,code,pre,textarea,[translate="no"],[data-i18n-skip],.app-brand,.member-name';
let language='en',translate=String,request=0,observer,select,status,pending=new Set(),scheduled=false;
function excluded(el){return !el||!!el.closest(skip)||el.tagName==='OPTION'&&!!el.closest('select[id*="player"],select[id*="member"]');}
function renderText(node){
 if(excluded(node.parentElement))return;
 const current=node.nodeValue,old=texts.get(node);let source=old&&current===old.rendered?old.source:current;
 const rendered=translate(source);if(rendered!==current)node.nodeValue=rendered;texts.set(node,{source,rendered});
}
function renderAttributes(el){
 if(excluded(el))return;
 const saved=attributes.get(el)||{};
 if(el.tagName==='OPTION'&&!el.hasAttribute('value'))el.setAttribute('value',el.value);
 for(const name of ['title','aria-label','placeholder','alt','data-label']){
  if(!el.hasAttribute(name))continue;const current=el.getAttribute(name),old=saved[name],source=old&&current===old.rendered?old.source:current,rendered=translate(source);if(current!==rendered)el.setAttribute(name,rendered);saved[name]={source,rendered};
 }attributes.set(el,saved);
}
function renderRich(el){
 let item=rich.get(el);
 if(item&&el.innerHTML!==item.rendered){el.removeAttribute('data-i18n-rich');rich.delete(el);return false;}
 if(!item){const tags=[];const source=normalize(el.innerHTML.replace(/<[^>]*>/g,tag=>{tags.push(tag);return '{b'+(tags.length-1)+'}';}));const decoder=document.createElement('textarea');decoder.innerHTML=source;item={source:decoder.value,tags,rendered:el.innerHTML};rich.set(el,item);}
 const translated=translate(item.source);
 // Translations are plain text. Only original page tags can be restored.
 const rendered=translated.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\{b(\d+)\}/g,(_,i)=>item.tags[Number(i)]||'');
 if(el.innerHTML!==rendered)el.innerHTML=rendered;item.rendered=el.innerHTML;return true;
}
function render(node){
 if(node.nodeType===3){renderText(node);return;}
 if(node.nodeType!==1&&node.nodeType!==9)return;
 if(node.nodeType===1){if(excluded(node))return;renderAttributes(node);if(node.hasAttribute('data-i18n-rich')&&renderRich(node))return;}
 for(const child of [...node.childNodes])render(child);
}
function queue(node){
 const el=node.nodeType===1?node:node.parentElement;if(!el||excluded(el))return;
 pending.add(el.closest('[data-i18n-rich]')||node);
 if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;const nodes=[...pending];pending.clear();for(const n of nodes)if(n.isConnected)render(n);});
}
async function catalog(lang){
 if(cache.has(lang))return cache.get(lang);
 const response=await fetch('./locales/'+lang+'.json?v='+VERSION);if(!response.ok)throw Error('catalog');const data=await response.json();
 if(!data||Array.isArray(data)||typeof data!=='object'||Object.values(data).some(x=>typeof x!=='string'||!x.trim()))throw Error('catalog');cache.set(lang,data);return data;
}
async function setLanguage(next){
 if(!LANGUAGES[next])next='en';const sequence=++request;select.disabled=true;status.textContent='';
 try{
  const english=await catalog('en'),messages=next==='en'?english:await catalog(next);
  if(Object.keys(english).some(k=>!Object.hasOwn(messages,k)))throw Error('incomplete');if(sequence!==request)return;
  language=next;translate=translator(messages,next);document.documentElement.lang=next;select.value=next;
  try{localStorage.setItem(KEY,next);}catch(_){}
  render(document.documentElement);root.dispatchEvent(new CustomEvent('bear:languagechange',{detail:{language:next,locale:LANGUAGES[next][1]}}));
 }catch(_){if(sequence!==request)return;select.value=language;status.textContent='Language could not load. Please try again.';}
 finally{if(sequence===request)select.disabled=false;}
}
root.BearI18n={get language(){return language;},get locale(){return LANGUAGES[language][1];},text:s=>translate(s),
 instructions(s){return String(s).split('\n').map((line,i)=>{if(i===0&&line.includes(' — Bear setup')){const j=line.indexOf(' — Bear setup');return line.slice(0,j)+' — '+translate(line.slice(j+3));}return translate(line);}).join('\n');},
 number:(n,options)=>new Intl.NumberFormat(LANGUAGES[language][1],options).format(n),
 date:(value,options)=>new Intl.DateTimeFormat(LANGUAGES[language][1],options).format(new Date(value)),setLanguage};
function start(){
 const nav=document.querySelector('.app-nav');if(!nav)return;
 const control=document.createElement('div');control.className='language-control';control.setAttribute('data-i18n-skip','');
 const label=document.createElement('label');label.htmlFor='app-language';label.textContent='Language';label.lang='en';
 select=document.createElement('select');select.id='app-language';select.setAttribute('aria-label','Language / Dil / Langue / Sprache / Sprog / Idioma');
 for(const [code,[name]]of Object.entries(LANGUAGES)){const option=document.createElement('option');option.value=code;option.textContent=name;option.lang=code;select.append(option);}
 status=document.createElement('span');status.className='language-status';status.setAttribute('role','status');control.append(label,select,status);nav.append(control);
 observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')queue(record.target);else if(record.type==='attributes')queue(record.target);else {if(record.target.closest?.('[data-i18n-rich]'))queue(record.target);for(const node of record.addedNodes)queue(node);}}});
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt','data-label']});
 select.addEventListener('change',()=>setLanguage(select.value));
 let saved;try{saved=localStorage.getItem(KEY);}catch(_){}
 const preferred=Object.hasOwn(LANGUAGES,saved)?saved:(navigator.languages||[navigator.language]).map(x=>x.split('-')[0]).find(x=>Object.hasOwn(LANGUAGES,x))||'en';select.value=preferred;setLanguage(preferred);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof globalThis!=='undefined'?globalThis:this);
