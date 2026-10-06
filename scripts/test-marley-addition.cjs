/* Isolated fake users only: no live authentication or database writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {chromium}=require('playwright');
const source=fs.readFileSync('marley-addition.js','utf8'),app=fs.readFileSync('app.js','utf8');
const sandbox={window:{}};vm.runInNewContext(source,sandbox);
const game=sandbox.window.MarleyAddition;
assert.equal(game.makeDeck().length,100);
assert.equal(new Set(game.makeDeck().map(t=>`${t.a},${t.b}`)).size,100);
assert.deepEqual(JSON.parse(JSON.stringify(game.makeDeck()[0])),{a:2,b:8});
for(const task of game.makeDeck())assert.ok(task.a>=0&&task.a<=9&&task.b>=0&&task.b<=9);
for(const role of ['student','teacher','guest'])assert.equal(game.isEnabled({id:'test',role}),true);
for(const user of [null,{}, {id:'test',role:'admin'}, {role:'student'}])assert.equal(game.isEnabled(user),false);
const id='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
const css=['styles.css','cinematic-theme.css','pizza-friends.css','marley-addition.css'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
const out='test-results/marley-addition';fs.mkdirSync(out,{recursive:true});
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
  await page.addScriptTag({content:fs.readFileSync('pizza-friends.js','utf8')});await page.addScriptTag({content:source});await page.addScriptTag({content:app});
  await page.waitForSelector(kind==='out'?'.login-wrap':'.topbar');return page;
 }
 async function fill(page,a=2,b=8){
  for(let i=0;i<a;i++)await page.locator('[data-ma-add="bone"]').click();
  for(let i=0;i<b;i++)await page.locator('[data-ma-add="bite"]').click();
 }
 async function drag(page,source,target){
  const a=await page.locator(source).boundingBox(),b=await page.locator(target).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();
  await page.waitForTimeout(120);
 }
 async function answer(page,value){await page.keyboard.type(String(value));await page.keyboard.press('Enter');}
 try{
  const p=await mount('student');
  const rows=await p.locator('.topic-tower-row').evaluateAll(rows=>rows.map(r=>[...r.querySelectorAll('button')].map(b=>b.dataset.topic||b.dataset.action)));
  const at=rows.findIndex(r=>r.includes('marley-addition'));
  assert.deepEqual(rows[at-1],['addition','additionColumn']);assert.deepEqual(rows[at+1],['numbers']);
  await p.locator('.ma-addition-card').click();await p.waitForSelector('.ma-game');
  assert.equal(await p.locator('#ma-a').innerText(),'2');assert.equal(await p.locator('#ma-b').innerText(),'8');
  assert.equal(await p.locator('[data-ma-digit]').count(),10);
  assert.equal(await p.locator('[data-ma-submit]').isDisabled(),true);
  await p.keyboard.type('10');assert.equal(await p.locator('#ma-answer').innerText(),'?');
  await drag(p,'[data-ma-add="bone"]','.ma-bowl');assert.equal(await p.locator('.ma-treat').count(),1);
  await drag(p,'.ma-treat','[data-ma-add="bone"]');assert.equal(await p.locator('.ma-treat').count(),0);
  await fill(p);assert.equal(await p.locator('.ma-treat').count(),10);
  await p.locator('.ma-treat').first().click();assert.equal(await p.locator('.ma-counted').count(),1);
  await p.locator('[data-ma-add="bone"]').click();assert.equal(await p.locator('[data-ma-submit]').isDisabled(),true);
  await p.locator('[data-ma-undo]').click();assert.equal(await p.locator('[data-ma-digit="1"]').isDisabled(),false);
  // The actual whole-character frame changes, rather than a static image bob.
  const pos=await p.locator('.ma-dog').evaluate(el=>getComputedStyle(el).backgroundPosition);
  await p.waitForTimeout(240);assert.notEqual(await p.locator('.ma-dog').evaluate(el=>getComputedStyle(el).backgroundPosition),pos);
  await p.screenshot({path:`${out}/desktop-count.png`,fullPage:true});
  await answer(p,9);await p.waitForFunction(()=>document.querySelector('#ma-feedback').textContent.includes('Prøv igen'));
  assert.equal(await p.locator('.ma-treat').count(),10);assert.equal(await p.evaluate(()=>__writes.length),1);
  await p.evaluate(()=>__failSave=true);await answer(p,10);
  await p.waitForFunction(()=>document.querySelector('#ma-feedback').textContent.includes('kunne ikke gemmes'));
  assert.equal(await p.locator('.ma-feeding').count(),0);assert.equal(await p.evaluate(()=>__writes.length),1);
  await p.evaluate(()=>__failSave=false);
  await p.locator('[data-ma-submit]').evaluate(el=>{for(let i=0;i<20;i++)el.click()});
  await p.waitForSelector('.ma-feeding');assert.equal(await p.evaluate(()=>__writes.length),2);
  const results=await p.evaluate(()=>__writes.map(w=>w[1]));assert.equal(results[0].correct,false);assert.equal(results[1].correct,true);assert.equal(results[1].topic,'marleyAddition');assert.equal(results[1].answer,10);
  assert.match(await p.locator('.ma-dog').evaluate(el=>getComputedStyle(el).backgroundImage),/marley-eat-frames/);
  assert.equal(await p.locator('[data-ma-next]').isVisible(),false);
  await p.screenshot({path:`${out}/desktop-feeding.png`,fullPage:true});
  await p.waitForSelector('[data-ma-next]:visible');assert.match(await p.locator('#ma-feedback').innerText(),/2 \+ 8 = 10/);
  await p.locator('[data-ma-next]').click();assert.equal(await p.locator('.ma-treat').count(),0);
  await p.locator('[data-ma-exit]').click();await p.waitForSelector('.student-home-layout');
  await p.keyboard.type('10');assert.equal(await p.locator('.ma-game').count(),0);await p.close();
  for(const kind of ['local','guest','other','jacob','out']){
   const page=await mount(kind);
   if(kind==='out'){
    assert.equal(await page.locator('[data-action="marley-addition"]').count(),0);
    await page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='marley-addition';document.body.append(b);b.click();});
    assert.equal(await page.locator('.ma-game').count(),0);await page.close();continue;
   }
   await page.locator('[data-action="marley-addition"]').click();await fill(page);await answer(page,10);await page.waitForSelector('.ma-happy');
   assert.equal(await page.evaluate(()=>__writes.length),0);assert.equal(await page.evaluate(()=>__localWrites.length),kind==='local'?1:0);
   await page.locator('[data-ma-exit]').click();assert.equal(await page.locator('.ma-flight').count(),0);
   await page.waitForTimeout(2600);assert.equal(await page.locator('.ma-game').count(),0);
   if(kind==='other'||kind==='jacob')assert.equal(await page.evaluate(()=>__own.role),'teacher');
   await page.close();
  }
  // Boundary tasks: zero is a real answer; both operands remain single digits.
  const boundary=await mount('guest');
  await boundary.evaluate(()=>{
   document.getElementById('app').innerHTML='<div id="boundary"></div>';
   window.__results=[];window.__dispose=MarleyAddition.mount(document.getElementById('boundary'),{user:{id:'guest',role:'guest'},tasks:[{a:0,b:0},{a:9,b:9},{a:0,b:5}],onResult:async r=>__results.push(r)});
  });
  assert.equal(await boundary.locator('[data-ma-digit="0"]').isEnabled(),true);
  await boundary.locator('[data-ma-digit="0"]').click();await boundary.locator('[data-ma-submit]').click();
  await boundary.waitForSelector('[data-ma-next]:visible');assert.match(await boundary.locator('#ma-feedback').innerText(),/0 \+ 0 = 0/);
  assert.equal(await boundary.locator('.ma-feeding').count(),0);
  await boundary.locator('[data-ma-next]').click();await fill(boundary,9,9);assert.equal(await boundary.locator('.ma-treat').count(),18);
  await answer(boundary,18);await boundary.waitForSelector('[data-ma-next]:visible');
  await boundary.locator('[data-ma-next]').click();await fill(boundary,0,5);await answer(boundary,5);await boundary.waitForSelector('.ma-happy');
  assert.deepEqual(await boundary.evaluate(()=>__results.map(r=>r.answer)),[0,18,5]);
  await boundary.evaluate(()=>__dispose());assert.equal(await boundary.locator('.ma-flight').count(),0);await boundary.close();
  for(const width of [320,390,768]){
   const page=await mount('guest',width);await page.locator('.ma-addition-card').click();await fill(page);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}`);
   assert.ok(await page.locator('.ma-game').evaluate(el=>el.scrollWidth<=el.clientWidth),`game overflow at ${width}`);
   await page.locator('[data-ma-digit="1"]').click();await page.locator('[data-ma-digit="0"]').click();assert.equal(await page.locator('#ma-answer').innerText(),'10');
   await page.locator('[data-ma-delete]').click();assert.equal(await page.locator('#ma-answer').innerText(),'1');await page.locator('[data-ma-digit="0"]').click();
   await page.screenshot({path:`${out}/play-${width}.png`,fullPage:true});await page.locator('[data-ma-submit]').click();await page.waitForSelector('.ma-happy');
   await page.locator('[data-action="logout"]').click();await page.waitForSelector('.login-wrap');assert.equal(await page.locator('.ma-flight').count(),0);await page.close();
  }
  // Native touch input exercises pointer capture and the same drop target.
  const touch=await mount('guest',390);await touch.locator('.ma-addition-card').click();
  const cdp=await touch.context().newCDPSession(touch);
  const a=await touch.locator('[data-ma-add="bone"]').boundingBox(),b=await touch.locator('.ma-bowl').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(150);
  assert.equal(await touch.locator('.ma-treat').count(),1);assert.equal(await touch.locator('.ma-drag-ghost').count(),0);
  await touch.emulateMedia({reducedMotion:'reduce'});assert.equal(await touch.locator('.ma-dog').evaluate(el=>getComputedStyle(el).animationName),'none');await touch.close();
  assert.deepEqual(errors,[]);console.log('PASS: dragging and touch, counting, 0–9 operands, two-digit answers, whole-frame animations, retry, result privacy, cleanup and responsive layouts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
