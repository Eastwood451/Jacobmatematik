/* Exercise the pilot using fake users; no live authentication or database writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {chromium}=require('playwright');
const source=fs.readFileSync('pizza-friends.js','utf8');
const sandbox={window:{}};vm.runInNewContext(source,sandbox);
const id='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
assert.equal(sandbox.window.LuigiTenFriends.isEnabled({id,role:'teacher'}),true);
for(const user of [null,{}, {id,role:'student'}, {id:'other',role:'teacher'}])assert.equal(sandbox.window.LuigiTenFriends.isEnabled(user),false);
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
    const own=${JSON.stringify(kind)}==='jacob'?teacher:${JSON.stringify(kind)}==='student'?student:${JSON.stringify(kind)}==='other'?other:null;
    const db={classes:[{id:'c1',name:'Testklasse'}],users:[teacher,student,other]};
    window.__writes=[];window.__own=own;
    window.JacobBackend={configured:true,async loadDatabase(){if(!own)throw Error('signed out');return {database:JSON.parse(JSON.stringify(db)),currentUserId:own.id}},async loadSchoolState(){return JSON.parse(JSON.stringify(db))},async loadResults(){return []},async saveSchoolState(){},async appendResult(...args){window.__writes.push(args)},async signOut(){window.__own=null}};
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
   assert.match(await page.locator('.pf-progress').innerText(),new RegExp(`Pizza ${i+1} af 9`));
   if(i===0)await page.screenshot({path:`${out}/desktop-correct.png`,fullPage:true});
   await page.locator('[data-pf-next]').evaluate(el=>{for(let k=0;k<30;k++)el.click();});
  }
  assert.deepEqual(seen.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9]);
  assert.equal(await page.locator('.pf-pairs>div').count(),5);
  assert.match(await page.locator('.pf-finish').innerText(),/0 af 9/);
  assert.equal(await page.evaluate(()=>window.__writes.length),0);
  await page.screenshot({path:`${out}/desktop-finish.png`,fullPage:true});
  await page.locator('[data-pf-start]').click();await page.locator('[data-pf-exit]').click();await page.waitForSelector('.teacher-layout');
  assert.equal(await page.evaluate(()=>window.__own.role),'teacher');
  await page.locator('[data-action="toggle-jacob-view"]').click();
  await page.waitForSelector('.student-home-layout');assert.equal(await page.locator('.pf-home-card').count(),1);
  await page.locator('.pf-home-card').click();await page.locator('[data-pf-start]').click();
  await page.locator('[data-action="toggle-jacob-view"]').click();await page.waitForSelector('.teacher-layout');
  assert.equal(await page.locator('.pf-page').count(),0);
  await page.locator('[data-action="ten-friends"]').click();await page.locator('[data-action="logout"]').click();await page.waitForSelector('.login-wrap');
  await page.keyboard.press('5');assert.equal(await page.locator('.pf-page').count(),0);
  await page.close();
  for(const kind of ['student','other','out']){
   const p=await mount(kind);assert.equal(await p.locator('[data-action="ten-friends"]').count(),0);
   await p.evaluate(()=>{const b=document.createElement('button');b.dataset.action='ten-friends';document.body.append(b);b.click();});
   assert.equal(await p.locator('.pf-page').count(),0);await p.close();
  }
  for(const width of [320,390,768]){
   const p=await mount('jacob',width);await p.locator('[data-action="ten-friends"]').click();
   await p.locator('[data-pf-start]').click();
   assert.ok(await p.evaluate(()=>document.querySelector('.pf-page').scrollWidth<=document.querySelector('.pf-page').clientWidth));
   assert.equal(await p.locator('[data-pf-answer]').count(),9);
   await p.waitForFunction(()=>[...document.querySelectorAll('.pf-character img')].every(i=>i.complete&&i.naturalWidth>0));
   await p.screenshot({path:`${out}/play-${width}.png`,fullPage:true});await p.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: Jacob-only access, all nine complements including 5+5, wrong answers, hint, keyboard, repeated-click protection, complete round, replay, exit, toggle, logout, no result writes, mobile/tablet layout and assets.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
