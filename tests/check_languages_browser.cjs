/* Optional Playwright checks for all languages, RTL, mobile width and saved preference isolation. Production API calls are mocked. */
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const languages=Object.keys(require(root+'/web/i18n.js').LANGUAGES);
const first=String(JSON.parse(fs.readFileSync(root+'/web/data/alliance-api.json')).members[0].governor_id);
const input={preferredLanguage:'ar',stock:{9:{infantry:50000,cavalry:50000,archers:150000}},joinMarches:5,presets:3,capacity:100000,heroFreeCapacity:90000,joinCap:0,ownEnabled:false,heroes:[],leaders:{},ownTroops:{}};
(async()=>{const server=spawn('python',['-m','http.server','8765','--directory',root+'/web'],{stdio:'ignore'});let browser;try{await new Promise(r=>setTimeout(r,500));browser=await chromium.launch({headless:true,...(process.env.BEAR_BROWSER_EXECUTABLE?{executablePath:process.env.BEAR_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US'});await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();if(u.hostname.endsWith('workers.dev')){if(u.pathname==='/health')return route.fulfill({json:{version:8,capabilities:['player-language-preference','bear-join-policy']}});return route.fulfill({json:{input:u.pathname.endsWith('/'+first)?input:null,revision:1,updatedAt:'2026-10-30T12:00:00Z'}});}return route.abort();});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const name of ['index','optimize-me','bear-guide','alliance-summary','kvk-planner','history','organizer']){
 await page.goto('http://127.0.0.1:8765/'+name+'.html');await page.waitForSelector('#app-language');await page.waitForFunction(()=>!document.querySelector('#app-language').disabled);await page.evaluate(()=>BearI18n.setLanguage('en'));await page.waitForTimeout(250);if(name==='index')await page.waitForFunction(()=>document.querySelector('#planselect').options.length>0&&!document.querySelector('#run').disabled);
 const values=await page.locator('input,select:not(#app-language),textarea').evaluateAll(els=>els.map(el=>[el.id,el.value,el.checked]));
 const baseline=await page.evaluate(()=>document.documentElement.scrollWidth);
 for(const lang of languages){await page.evaluate(l=>BearI18n.setLanguage(l),lang);await page.waitForTimeout(25);assert.equal(await page.locator('html').getAttribute('lang'),lang,name+': '+lang);assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');assert.deepEqual(await page.locator('input,select:not(#app-language),textarea').evaluateAll(els=>els.map(el=>[el.id,el.value,el.checked])),values,name+': form data '+lang);
 const width=await page.evaluate(()=>document.documentElement.scrollWidth);assert(width<=Math.max(baseline,390)+2,name+': horizontal overflow '+lang+' '+width+' baseline '+baseline);
 if(process.env.BEAR_QA_OUTPUT&&name==='bear-guide'&&['ar','zh-TW'].includes(lang))await page.screenshot({path:path.join(process.env.BEAR_QA_OUTPUT,'guide-'+lang+'.png'),fullPage:true});
 }
 console.log(name+': all '+languages.length+' languages preserve fields and mobile width');
}
assert.deepEqual(errors,[],'page exceptions');
// Explicit saved preference stays independent of the viewing language.
await page.goto('http://127.0.0.1:8765/optimize-me.html?player='+first);await page.waitForSelector('#personalpreferredlanguage');await page.waitForFunction(()=>document.querySelector('#personalpreferredlanguage').value==='ar');await page.evaluate(()=>BearI18n.setLanguage('ja'));assert.equal(await page.locator('#personalpreferredlanguage').inputValue(),'ar');console.log('Saved preference loads without changing the viewing language');
await context.close();
for(const [locale,expected]of [['zh-Hant-TW','zh-TW'],['zh-Hans-CN','zh-CN']]){const ctx=await browser.newContext({locale});const p=await ctx.newPage();await p.goto('http://127.0.0.1:8765/bear-guide.html');await p.waitForFunction(e=>document.documentElement.lang===e,expected);await ctx.close();console.log(locale+' chooses '+expected);}
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exit(1)});
