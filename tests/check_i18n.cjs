const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {LANGUAGES,translator,numeric}=require('../web/i18n.js');
const directory=path.join(__dirname,'../web/locales'),english=JSON.parse(fs.readFileSync(path.join(directory,'en.json')));
const markers=s=>[...s.matchAll(/\{b?\d+\}/g)].map(m=>m[0]).sort();
const names=['Chenko','Yeonwoo','Amane','Amadeus','Howard','Jabel','Quinn','Helga','Zoe','Marlin','Saul','Gordon','Hilde','Diana','Forrest','Edwin','Seth','Kingshot','Truegold','Mithril','KvK'];
for(const lang of Object.keys(LANGUAGES)){
 const messages=JSON.parse(fs.readFileSync(path.join(directory,lang+'.json')));
 assert.deepEqual(Object.keys(messages).sort(),Object.keys(english).sort(),lang+' has the complete English key set');
 for(const [key,value]of Object.entries(messages)){
  assert.equal(typeof value,'string');assert(value.trim(),lang+': empty '+key);
  assert.deepEqual(markers(value),markers(key),lang+': changed placeholders: '+key);
  assert.deepEqual([...value.matchAll(/\{b\d+\}/g)].map(x=>x[0]),[...key.matchAll(/\{b\d+\}/g)].map(x=>x[0]),lang+': changed rich tag order: '+key);
  for(const name of names){const rx=new RegExp('\\b'+name+'\\b','g');assert.equal((value.match(rx)||[]).length,(key.match(rx)||[]).length,lang+': changed game name '+name+': '+key);}
  assert(!/ZXQ|__PLACEHOLDER|⁇|�/.test(value),lang+': leaked generator marker or unsupported glyph');
  if(key.startsWith('. '))assert(!/^- (?:Evet|Je ne sais pas|Ich weiß nicht|Jeg er ikke sikker|¿ Qué|Não)/.test(value),lang+': draft dialogue leaked into a sentence fragment');
 }
 const t=translator(messages,lang);
 assert.equal(t('Chenko'),'Chenko');assert.equal(t('Ridcully'), 'Ridcully');
 assert.equal(t('a-user-name-not-in-the-catalog'), 'a-user-name-not-in-the-catalog');
 if(lang!=='en')assert.notEqual(t('Save online'),'Save online');
 const preset=t('Preset 4 · No hero');assert(preset.includes('4'));if(lang!=='en')assert(!preset.includes('No hero'));
}
const t=translator({'Troops':'Truppen','infantry':'Infanterie','Join {0}':'Beitritt {0}','{0} troops':'{0} Truppen','Save as preset {0}.':'Als Vorlage {0} speichern.','Copied.':'Kopiert.'},'de');
assert.equal(t('Join 4'),'Beitritt 4');
assert.equal(t('10,408 troops'),'10.408 Truppen','format a parameter exactly once');
assert.equal(t('Save as preset 4. Copied.'),'Als Vorlage 4 speichern. Kopiert.');
assert.equal(t('  Troops '),'  Truppen ');
assert.equal(numeric('40,000 · 1.41× · 2.00×','de'),'40.000 · 1,41× · 2,00×');
assert.equal(numeric('0:00 · 25:00 · 29.10.2026 · T9 · 389853430','de'),'0:00 · 25:00 · 29.10.2026 · T9 · 389853430');
assert.equal(translator({},'en')('100,000 troops'),'100,000 troops');
assert.deepEqual(LANGUAGES.id,['Bahasa Indonesia','id-ID']);
const indonesian=translator(JSON.parse(fs.readFileSync(path.join(directory,'id.json'))),'id');
assert.equal(indonesian('Preset 4 · No hero'),'Preset 4 · Tanpa hero');
assert.equal(indonesian('Save online'),'Simpan online');
assert.equal(indonesian('70,000 infantry'),'70.000 infanteri');
assert.equal(numeric('40,000 · 1.41× · 0:00 · T9','id'),'40.000 · 1,41× · 0:00 · T9');
const withNames=translator({'Power':'Macht','Player {0}':'Spieler {0}'},'de',new Set(['Power']));
assert.equal(withNames('Power'),'Macht');
assert.equal(withNames('Player Power'),'Spieler Power','a captured player name must stay exact');
for(const page of ['index','optimize-me','bear-guide','alliance-summary','kvk-planner','history','organizer']){
 const source=fs.readFileSync(path.join(__dirname,'../web/'+page+'.html'),'utf8');assert(source.includes('./i18n.js?v='),page+' loads shared localization');assert(source.includes('./i18n.css?v='));
}
const code=fs.readFileSync(path.join(__dirname,'../web/i18n.js'),'utf8');
assert(!/\.value\s*=\s*(?:translate|text)\(/.test(code),'translation never rewrites entered values');
assert(code.includes("el.setAttribute('value',el.value)"),'implicit option values are preserved');
assert(code.includes('sequence!==request'),'stale language loads cannot win');
assert(code.includes('item.translation===translated'),'rich text updates stop after HTML entity normalization');
assert(code.includes('translate="no"'),'names and raw data can opt out');
console.log('All eight catalogs, placeholders, game names, dynamic instructions, number formatting and page wiring pass.');
