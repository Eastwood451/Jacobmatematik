/* Exercise public access and progress using fake users; no live database writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {chromium}=require('playwright');
const source=fs.readFileSync('pizza-friends.js','utf8');
const sandbox={window:{}};vm.runInNewContext(source,sandbox);
const id='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
assert.equal(sandbox.window.LuigiTenFriends.isEnabled({id,role:'teacher'}),true);
for(const user of [{id,role:'student'}, {id:'other',role:'teacher'}, {id:'guest',role:'guest'}])assert.equal(sandbox.window.LuigiTenFriends.isEnabled(user),true);
for(const user of [null,{}, {role:'student'}, {id,role:'admin'}])assert.equal(sandbox.window.LuigiTenFriends.isEnabled(user),false);
for(let n=1;n<=9;n++){assert.equal((sandbox.window.LuigiTenFriends.pizza(n).match(/<path /g)||[]).length,10);assert.equal((sandbox.window.LuigiTenFriends.heldPizza(n).match(/fill="#ffd05b"/g)||[]).length,n);}
const app=fs.readFileSync('app.js','utf8');
const css=['styles.css','cinematic-theme.css','pizza-friends.css'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const out='test-results/pizza-friends';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-gpu']});
 const errors=[];
 async function mount(kind='jacob',width=1280){
  const page=await browser.newPage({viewport:{width,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='pilot.local'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'});
   if(url.hostname==='pilot.local'&&url.pathname.startsWith('/assets/')){
    const p=path.join(process.cwd(),url.pathname); if(fs.existsSync(p))return route.fulfill({path:p});
   }
   return route.abort();
  });
  await page.goto('http://pilot.local').catch(()=>{});
  await page.setContent(`<html lang="da"><head><base href="http://pilot.local/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="app" class="app-shell"></main></body></html>`);
  await page.addScriptTag({content:`(()=>{
    const teacher={id:${JSON.stringify(id)},role:'teacher',username:'Jacob',name:'Jacob',results:[]};
    const student={id:'s1',role:'student',username:'test',name:'Testelev',classId:'c1',results:[]};
    const other={id:'other',role:'teacher',username:'other',name:'Anden lærer',results:[]};
    const local={id:'local',role:'student',resultStorage:'local',username:'local',name:'Lokal elev',results:[]};
    const guest={id:'guest',role:'guest',username:'guest',name:'Gæst',results:[]};
    const own=({jacob:teacher,student,other,local,guest})[${JSON.stringify(kind)}]||null;
    const db={classes:[{id:'c1',name:'Testklasse'}],users:[teacher,student,other]};
    db.users.push(local,guest);
    window.__writes=[];window.__localWrites=[];window.__own=own;window.__failSave=false;
    window.JacobBackend={configured:true,hasLocalConsent(){return true},async loadDatabase(){if(!own)throw Error('signed out');return {database:JSON.parse(JSON.stringify(db)),currentUserId:own.id}},async loadSchoolState(){return JSON.parse(JSON.stringify(db))},async loadResults(){return []},async saveSchoolState(){},async appendResult(...args){if(window.__failSave)throw Error('offline');(own.resultStorage==='local'?window.__localWrites:window.__writes).push(args);return own.resultStorage==='local'?null:'result-'+window.__writes.length},async signOut(){window.__own=null}};
  })();`});
  await page.addScriptTag({content:source});await page.addScriptTag({content:app});
  await page.waitForSelector(kind==='out'?'.login-wrap':'.topbar');return page;
 }
 try{
  const page=await mount();
  assert.equal(await page.locator('[data-action="ten-friends"]').count(),1);
  await page.locator('[data-action="ten-friends"]').click();await page.waitForSelector('.pf-roster');
  assert.equal(await page.locator('.pf-roster-card').count(),9);
  await page.waitForFunction(()=>[...document.querySelectorAll('.pf-character img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:`${out}/desktop-intro.png`,fullPage:true});
  await page.locator('[data-pf-start]').click();
  const seen=[];
  for(let i=0;i<9;i++){
   const n=await page.locator('.pf-equation>span').first().innerText().then(Number);seen.push(n);
   assert.equal(await page.locator("#pf-question").innerText(),`Hvem er ${n}'s gode ven?`);
   assert.equal(await page.locator('.pf-pizza path').count(),10);
   const wrong=(10-n)%9+1;
   await page.locator(`[data-pf-answer="${wrong}"]`).click();
   assert.equal(await page.locator('[data-pf-next]').count(),0);
   assert.match(await page.locator('#pf-feedback').innerText(),/Prøv/);
   if(i===0){await page.locator('[data-pf-hint]').click();assert.match(await page.locator('#pf-feedback').innerText(),new RegExp(`Find buddet med ${10-n}`));}
   if(i===1)await page.keyboard.press(String(10-n));
   else await page.locator(`[data-pf-answer="${10-n}"]`).evaluate(el=>{for(let k=0;k<30;k++)el.click();});
   assert.equal(await page.locator('.pf-found').innerText(),String(10-n));
   assert.equal(await page.locator('[data-pf-answer]:disabled').count(),9);
   assert.equal(await page.locator('.pf-pair .pf-shared-tray').count(),1);
   assert.equal(await page.locator('.pf-pair .pf-shared-tray path[fill="#ffb64f"],.pf-pair .pf-shared-tray path[fill="#b6a0ed"]').count(),10);
   assert.equal(await page.locator('.pf-pair .pf-character').count(),0);
   assert.match(await page.locator('.pf-progress').innerText(),new RegExp(`Pizza ${i+1} af 9`));
   if(i===0)await page.screenshot({path:`${out}/desktop-correct.png`,fullPage:true});
   await page.locator('[data-pf-next]').evaluate(el=>{for(let k=0;k<30;k++)el.click();});
   assert.equal(await page.locator('.pf-delivery-team .pf-shared-tray').count(),1);
   assert.equal(await page.locator('[data-pf-continue]').count(),0);
   await page.waitForSelector('[data-pf-continue]');
   assert.match(await page.locator('.pf-delivery h2').innerText(),/Pizzaen er leveret/);
   assert.equal(await page.locator('.pf-delivered-tray:visible').count(),1);
   const recipients=['Øbbe Øvdig','Kaptajn Kvadratrod','Matematikhunden Marley','Divisions-Dennis'];
   assert.equal(await page.locator('.pf-customer strong').innerText(),recipients[i%4]);
   if(i===0)await page.screenshot({path:`${out}/desktop-delivered.png`,fullPage:true});
   await page.locator('[data-pf-continue]').evaluate(el=>{for(let k=0;k<30;k++)el.click();});
  }
  assert.deepEqual(seen.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9]);
  assert.equal(await page.locator('.pf-pairs>div').count(),5);
  assert.match(await page.locator('.pf-finish').innerText(),/0 af 9/);
  assert.equal(await page.evaluate(()=>window.__writes.length),0);
  await page.screenshot({path:`${out}/desktop-finish.png`,fullPage:true});
  await page.locator('[data-pf-start]').click();await page.locator('[data-pf-exit]').click();await page.waitForSelector('.teacher-layout');
  assert.equal(await page.evaluate(()=>window.__own.role),'teacher');
  await page.locator('[data-action="toggle-jacob-view"]').click();
  await page.waitForSelector('.student-home-layout');assert.equal(await page.locator('.pf-friends-card').count(),1);
  await page.locator('.pf-friends-card').click();await page.locator('[data-pf-start]').click();
  await page.locator('[data-action="toggle-jacob-view"]').click();await page.waitForSelector('.teacher-layout');
  assert.equal(await page.locator('.pf-page').count(),0);
  await page.locator('[data-action="ten-friends"]').click();await page.locator('[data-action="logout"]').click();await page.waitForSelector('.login-wrap');
  await page.keyboard.press('5');assert.equal(await page.locator('.pf-page').count(),0);
  await page.close();
  for(const kind of ['student','local','guest','other','out']){
   const p=await mount(kind);
   if(kind==='out'){
    assert.equal(await p.locator('[data-action="ten-friends"]').count(),0);
    await p.evaluate(()=>{const b=document.createElement('button');b.dataset.action='ten-friends';document.body.append(b);b.click();});
    assert.equal(await p.locator('.pf-page').count(),0);await p.close();continue;
   }
   if(kind==='other')await p.locator('[data-action="ten-friends"]').click();
   else{
    assert.equal(await p.locator('[data-action="ten-friends"]').count(),2);
    const rows=await p.locator('.topic-tower-row').evaluateAll(rows=>rows.map(r=>[...r.querySelectorAll('button')].map(b=>b.dataset.topic||b.dataset.action)));
    const at=rows.findIndex(row=>row.includes('ten-friends'));
    assert.deepEqual(rows[at-1],['subtractionDrill','subtractionBorrowing']);
    assert.deepEqual(rows[at+1],['addition','additionColumn']);
    const floors=await p.locator('.math-tower-level').evaluateAll(buttons=>buttons.map(b=>b.dataset.topic||b.dataset.action));
    const floor=floors.indexOf('ten-friends');
    assert.equal(floors[floor-1],'subtractionDrill');assert.equal(floors[floor+1],'addition');
    assert.equal(await p.locator('.pf-home-card').count(),0);
    await p.locator('.math-tower-level[data-action="ten-friends"]').click();
   }
   assert.equal(await p.locator('.pf-page').count(),1);
   assert.doesNotMatch(await p.locator('.pf-pilot').innerText(),/Testversion|Jacob/);
   await p.locator('[data-pf-start]').click();
   const n=Number(await p.locator('.pf-equation>span').first().innerText());
   if(kind==='student'){
    await p.evaluate(()=>window.__failSave=true);
    await p.locator(`[data-pf-answer="${10-n}"]`).click();
    await p.waitForFunction(()=>document.querySelector('#pf-feedback').textContent.includes('kunne ikke gemmes'));
    assert.equal(await p.locator('[data-pf-next]').count(),0);
    assert.equal(await p.evaluate(()=>window.__writes.length),0);
    await p.evaluate(()=>window.__failSave=false);
   }
   await p.locator(`[data-pf-answer="${10-n}"]`).evaluate(el=>{for(let k=0;k<30;k++)el.click()});
   await p.waitForSelector('.pf-found');
   const writes=await p.evaluate(()=>({remote:window.__writes,local:window.__localWrites}));
   assert.equal(writes.remote.length,kind==='student'?1:0);
   assert.equal(writes.local.length,kind==='local'?1:0);
   if(kind==='student'||kind==='local'){
    const [userId,result]=(kind==='student'?writes.remote:writes.local)[0];
    assert.equal(userId,kind==='student'?'s1':'local');assert.equal(result.topic,'tenFriends');assert.equal(result.correct,true);
   }
   await p.locator('[data-pf-exit]').click();
   await p.waitForSelector(kind==='other'?'.teacher-layout':'.student-home-layout');
   if(kind!=='other'){
    assert.equal(await p.locator('.math-tower-level[data-action="ten-friends"] .math-tower-score').innerText(),'100\n%');
    assert.equal(await p.locator('.math-tower-level[data-action="ten-friends"]').getAttribute('class'),'math-tower-level tower-granite');
    await p.locator('.pf-friends-card').click();await p.waitForSelector('.pf-roster');
   }
   await p.close();
  }
  for(const width of [320,390,768]){
   const p=await mount('jacob',width);await p.locator('[data-action="ten-friends"]').click();
   await p.locator('[data-pf-start]').click();
   assert.ok(await p.evaluate(()=>document.querySelector('.pf-page').scrollWidth<=document.querySelector('.pf-page').clientWidth));
   assert.equal(await p.locator('[data-pf-answer]').count(),9);
   await p.waitForFunction(()=>[...document.querySelectorAll('.pf-character img')].every(i=>i.complete&&i.naturalWidth>0));
   await p.screenshot({path:`${out}/play-${width}.png`,fullPage:true});
   const n=Number(await p.locator('.pf-equation>span').first().innerText());
   await p.locator(`[data-pf-answer="${10-n}"]`).click();
   assert.ok(await p.evaluate(()=>document.querySelector('.pf-page').scrollWidth<=document.querySelector('.pf-page').clientWidth));
   await p.screenshot({path:`${out}/carrying-${width}.png`,fullPage:true});
   await p.locator('[data-pf-next]').click();
   await p.waitForSelector('[data-pf-continue]');
   await p.waitForFunction(()=>[...document.querySelectorAll('.pf-customer img')].every(i=>i.complete&&i.naturalWidth>0));
   assert.ok(await p.evaluate(()=>document.querySelector('.pf-page').scrollWidth<=document.querySelector('.pf-page').clientWidth));
   await p.screenshot({path:`${out}/delivered-${width}.png`,fullPage:true});
   await p.locator('[data-pf-continue]').click();
   const next=Number(await p.locator('.pf-equation>span').first().innerText());
   await p.locator(`[data-pf-answer="${10-next}"]`).click();
   await p.locator('[data-pf-next]').click();
   await p.locator('[data-pf-exit]').click();
   await p.waitForSelector('.teacher-layout');
   await p.waitForTimeout(1900);
   assert.equal(await p.locator('.pf-page').count(),0);
   await p.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: all user roles, signed-out guard, placement between plus and minus in both stacks, progress and storage routing, save retry, all complements including 5+5, shared tray and delivery, repeat clicks, round, replay, navigation and responsive layouts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
