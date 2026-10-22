/* Optional real-browser UX regression check. Never contacts the production backend.
 * Run with Playwright installed; BEAR_BROWSER_EXECUTABLE can select local Chromium.
 */
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const server=spawn('python',['-m','http.server','8766','--directory',path.join(__dirname,'../web')],{stdio:'ignore'});
 let browser;
 try{
  await new Promise(resolve=>setTimeout(resolve,500));
  browser=await chromium.launch({headless:true,...(process.env.BEAR_BROWSER_EXECUTABLE?{executablePath:process.env.BEAR_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote','--single-process']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const remote=new Map();let writes=0;
  await page.route('https://**/*',async route=>{
   const id=new URL(route.request().url()).pathname.split('/').at(-1);
   if(route.request().method()==='PUT'){writes++;const input=route.request().postDataJSON().input;remote.set(id,{revision:1,input,updatedAt:new Date().toISOString()});}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(remote.get(id)||{revision:0,input:null})});
  });
  const open=file=>page.goto('http://127.0.0.1:8766/'+file);
  const nav=['Optimize Me','Alliance summary','History','Alliance optimizer','Organizer'];
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:950});
   for(const file of ['index.html','optimize-me.html','alliance-summary.html','history.html','organizer.html']){
    await open(file);
    assert.deepEqual(await page.locator('.app-nav-links a').allTextContents(),nav);
    assert.equal(await page.locator('.app-nav [aria-current=page]').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,file+' overflows at '+width);
   }
  }
  await page.setViewportSize({width:1440,height:1000});
  await open('index.html');
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Compared'),{timeout:60000});
  assert.equal(await page.locator('[aria-invalid=true]').count(),0,'Default comparison must be valid.');
  await page.locator('#frontwaves').fill('');await page.locator('#recommend').click();
  assert.equal(await page.locator('#frontwaves').getAttribute('aria-invalid'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'frontwaves');
  await page.locator('#frontwaves').fill('4');await page.locator('#addstrategy').click();
  // The default fixed cap and own-rally percentage must pass native validation too.
  assert.deepEqual(await page.locator('#strategyeditor input:enabled:invalid').evaluateAll(fields=>fields.map(f=>f.id)),[]);
  await page.locator('#planformation').selectOption('strict');await page.locator('#planinf').fill('80');await page.locator('#plancav').fill('30');await page.locator('#strategycommit').click();
  assert.equal(await page.locator('#planinf').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('#plancav').getAttribute('aria-invalid'),'true');
  await page.locator('#strategycancel').click();
  await page.locator('#allianceopen').click();await page.locator('#trapx1').fill('400');await page.locator('#trapy1').fill('');await page.locator('#savetrappositions').click();
  assert.equal(await page.locator('#trapy1').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('#alliancedialog > .ui-feedback').isVisible(),true,'Trap errors must appear inside the open dialog.');
  await page.locator('#allianceclose').click();
  await open('optimize-me.html?player=389853430');
  await page.waitForFunction(()=>document.getElementById('personalplayer').value==='389853430');
  await page.locator('#personalown').uncheck();
  for(const checkbox of await page.locator('.personal-hero input[type=checkbox]').all())await checkbox.uncheck();
  await page.locator('#personalcapacity').fill('');await page.locator('#personalbare').fill('');await page.locator('#cloudsave').click();
  assert.equal(await page.locator('#personalcapacity').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('#personalbare').getAttribute('aria-invalid'),'true');
  assert.equal(writes,0,'Invalid entries must never be submitted.');
  await page.locator('#personalcapacity').fill('90000');
  assert.equal(await page.locator('#personalbare').getAttribute('aria-invalid'),'true','Fixing one entry must not clear another error.');
  await page.locator('#personalbare').fill('80000');
  await page.locator('#personalstock9archers').fill('250000');await page.locator('#personalpreview').click();
  assert.equal(await page.locator('#personalresult').isVisible(),true,'Fixing fields must build the preview.');
  assert.equal(writes,0,'Preview must not write online.');
  assert.equal(await page.locator('#personalpresettbl tbody tr').count(),1,'Hero-free joins share one preset.');
  await page.locator('#cloudsave').click();
  await page.waitForFunction(()=>document.getElementById('cloudbadge').textContent==='Saved online');assert.equal(writes,1);
  await page.locator('#personalstock9archers').fill('260000');
  await page.route('https://**/*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Service temporarily unavailable"}'}));
  await page.locator('#cloudsave').click();
  await page.waitForFunction(()=>document.getElementById('cloudbadge').textContent==='Not saved online');
  assert.equal(await page.locator('#personalstock9archers').inputValue(),'260000','Failed saving must preserve entries.');
  await open('alliance-summary.html');await page.locator('#summarysearch').fill('zzzzno-match');
  await page.locator('#summaryreset').click();assert.equal(await page.locator('#summarysearch').inputValue(),'');
  await open('history.html?player=389853430');await page.locator('#historyplot svg').waitFor();
  assert.match(await page.locator('#historyupdate').getAttribute('href'),/player=389853430/);
  await page.route('**/data/history/alliance.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.locator('#historyplayer').selectOption('alliance');await page.locator('#historyretry').waitFor();
  assert.equal(await page.locator('#historyplayer').inputValue(),'alliance','History errors preserve selection.');
  await open('organizer.html');await page.locator('#adminkey').fill('short');await page.locator('#adminload').click();
  assert.equal(await page.locator('#adminkey').getAttribute('aria-invalid'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'adminkey');
  assert.deepEqual(errors,[]);
  console.log('UX browser checks pass: five-page navigation at four widths, valid defaults, focused multi-field errors, dialog errors, reusable presets, preview/save/failure preservation, directory reset and history retry.');
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
