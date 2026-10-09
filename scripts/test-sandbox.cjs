/* Real navigation/layout with fake users only; no auth or database writes. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync('app.js','utf8').replace(/  start\(\);\s*\}\)\(\);/, '  window.__sandboxTest={state,render};\n})();');
assert(source.includes('window.__sandboxTest='));
const css=['styles.css','cinematic-theme.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||chromium.executablePath(),args:['--no-sandbox']});
 const errors=[];
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url()==='https://sandbox-test.invalid/' ? route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><main id="app"></main></body></html>'}) : route.abort());
  await page.goto('https://sandbox-test.invalid/');
  await page.addStyleTag({content:css});
  await page.evaluate(()=>{
   window.JacobBackend={configured:false};
   window.__exits={};
   function mount(root,options){root.innerHTML='<button type="button" class="test-exit">Tilbage fra modul</button>';root.querySelector('button').onclick=()=>options.onExit();return ()=>{};}
   window.MarleyMath={mount};window.JacobSkak={mount};
  });
  await page.addScriptTag({content:source});
  const user=async(id,role)=>page.evaluate(({id,role})=>{
   const t=window.__sandboxTest;t.state.user={id,role,name:'Test',username:'test',results:[],assignedLetters:[],assignedNumbers:[],assignedTables:[],assignedAddends:[],assignedAddendSeconds:[]};t.state.view=role==='teacher'?'teacher':'student';t.render();
  },{id,role});
  await user('c8b8e1c4-3264-40e9-a43d-0eb6214a0183','teacher');
  assert.equal(await page.locator('.topbar [data-action="marley"]').count(),0);
  assert.equal(await page.locator('.topbar [data-action="skak"]').count(),0);
  assert.equal(await page.locator('.topbar [data-action="plus-penalhus"]').count(),0);
  await page.locator('[data-action="sandbox"]').click();
  await page.locator('.sandbox-page').waitFor();
  for(const action of ['marley','skak']){
   await page.locator('.sandbox-page [data-action="'+action+'"]').click();
   await page.locator('.test-exit').click();
   await page.locator('.sandbox-page').waitFor();
  }
  await page.locator('.jacob-view-switch').click();
  assert.equal(await page.locator('.jacob-view-switch').getAttribute('aria-checked'),'true');
  assert.equal(await page.locator('.student-home-layout').count(),1);
  assert.equal(await page.locator('.student-home-layout [data-action="skak"]').count(),0);
  await page.locator('.jacob-view-switch').click();
  assert.equal(await page.locator('.jacob-view-switch').getAttribute('aria-checked'),'false');
  assert.equal(await page.locator('.teacher-page').count(),1);
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="sandbox"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'mobile page must fit without horizontal scrolling');
  fs.mkdirSync('test-results/sandbox',{recursive:true});
  await page.screenshot({path:'test-results/sandbox/mobile.png',fullPage:true});
  await user('3af639de-b0e0-496a-a5b7-b732e49d1fa7','student');
  await page.locator('[data-action="sandbox"]').click();
  assert.equal(await page.locator('.sandbox-page [data-action="skak"]').count(),1);
  assert.equal(await page.locator('.sandbox-page [data-action="marley"]').count(),0);
  await user('ordinary-student','student');
  assert.equal(await page.locator('[data-action="sandbox"]').count(),0);
  assert.equal(await page.locator('[data-action="skak"]').count(),0);
  await page.evaluate(()=>{window.__sandboxTest.state.view='sandbox';window.__sandboxTest.render();});
  assert.equal(await page.locator('.sandbox-page').count(),0,'forcing the view must not bypass the gate');
  assert.equal(await page.locator('.student-home-layout').count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: sandbox gates, return navigation, public exercises, view switch and mobile layout with fake users.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
