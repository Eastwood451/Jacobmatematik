/* Mixed lessons use the real engines and coach, with fake profiles and local assets. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {completeFinish}=require('./fraction-finish-support.cjs');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name));
const gcd=(a,b)=>b?gcd(b,a%b):a;
module.exports=async function testMixed(browser) {
 const errors=[];
 const page=await browser.newPage({viewport:{width:390,height:1000}});
 page.setDefaultTimeout(10000);
 page.on('pageerror',error=>errors.push(error.message));
 try {
  await page.route('**/*',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(['assets/figurer/obbe-ovdig.png','assets/figurer/obbe-techno.webp'].includes(name)) return route.fulfill({body:read(name),contentType:name.endsWith('.png')?'image/png':'image/webp'});
   return route.abort();
  });
  await page.setContent('<!doctype html><html lang="da"><head><base href="https://lesson.test/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app" class="app-shell"></main></body></html>');
  await page.addStyleTag({content:['styles.css','fraction-lesson.css','fraction-multiply.css','fraction-simplify.css','fraction-add-subtract.css','fraction-obbe.css'].map(name=>read(name).toString()).join('\n')});
  for(const name of ['fraction-simplify.js','fraction-lesson.js','fraction-add-subtract.js','fraction-obbe.js']) await page.addScriptTag({content:read(name).toString()});
  await page.clock.install();
  await page.evaluate(()=>{
   // Deterministic shuffle also exercises the boundary-repeat protection.
   Math.random=()=>0.5;
   window.cleanup=JacobFractionLesson.mount(document.querySelector('#app'),{user:{id:'c8b8e1c4-3264-40e9-a43d-0eb6214a0183',role:'teacher'},onExit:()=>{window.cleanup();document.querySelector('#app').textContent='Afsluttet';}});
  });
  await page.getByRole('button',{name:'Blandede opgaver',exact:true}).click();
  const seen=[];
  for(let i=0;i<8;i++) {
   assert.equal(await page.locator('[data-fa-mode][aria-pressed="true"]').getAttribute('data-fa-mode'),'mixed');
   assert.match(await page.locator('#fl-title').innerText(),/blandede opgaver/);
   assert.equal(await page.locator('.fl-count').innerText(),`${i} gennemført`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
   const label=await page.locator('.fl-problem-panel>.fl-expression').getAttribute('aria-label');
   const [a,b,c,d]=label.match(/\d+/g).map(Number);
   const coreMode=await page.locator('.fl-page').getAttribute('data-fl-mode');
   const mode=coreMode || (label.includes('plus')?'plus':'minus');
   if(i)assert.notEqual(mode,seen[i-1],'same operation twice in a row');
   seen.push(mode);
   await page.locator('[data-fa-mode="mixed"]').click();
   assert.equal(await page.locator('.fl-problem-panel>.fl-expression').getAttribute('aria-label'),label,'active button should preserve work');
   if(coreMode) {
    assert.ok(Math.max(a*c,b*d,a*d,b*c)<=12,'beginner products');
    await page.locator(`[data-fl-operation="${mode==='multiply'?'*':':'}"]`).click();
    if(mode==='division') {
     await page.locator('[data-fl-rule="reciprocal"]').click();
     for(const [token,slot] of [['d','numerator'],['c','denominator']]) {
      await page.locator(`[data-fl-token="${token}"]`).click();
      await page.locator(`[data-fl-slot="${slot}"]`).click();
     }
    }
    await page.locator('[data-fl-rule="multiply"]').click();
    await page.locator('[data-fl-answer="numerator"]').fill(String(mode==='multiply'?a*c:a*d));
    await page.locator('[data-fl-answer="denominator"]').fill(String(mode==='multiply'?b*d:b*c));
    await page.locator('[data-fl-check-answer]').click();
   } else {
    const common=b/gcd(b,d)*d;
    assert.ok(common<=12 && common/b<=3 && common/d<=3,'beginner common denominator');
    await page.locator(`[data-fa-operation="${mode==='plus'?'+':'-'}"]`).click();
    await page.locator('[data-fa-rule="common"]').click();
    for(const [n,den] of [[a,b],[c,d]]) {
     if(common===den)continue;
     await page.locator('[data-fa-method="extend"]').click();
     await page.locator(`[data-fa-factor="${common/den}"]`).click();
     await page.locator('[data-fa-extension-rule="multiplyBoth"]').click();
     await page.locator('[data-fa-answer="numerator"]').fill(String(n*common/den));
     await page.locator('[data-fa-answer="denominator"]').fill(String(common));
     await page.locator('[data-fa-check]').click();
    }
    await page.locator('[data-fa-answer="numerator"]').fill(String(a*common/b+(mode==='plus'?1:-1)*c*common/d));
    await page.locator('[data-fa-check]').click();
   }
   await completeFinish(page);
   await page.waitForSelector('.fo-celebrating');
   assert.equal(await page.locator('.fl-count').innerText(),`${i+1} gennemført`);
   assert.equal(await page.locator('[data-fl-next],[data-fa-next]').isDisabled(),true);
   await page.locator('[data-fl-next],[data-fa-next]').dispatchEvent('click');
   assert.equal(await page.locator('[data-ff-stage="done"]').count(),1,'early next cannot skip celebration');
   await page.clock.fastForward(4500);
   await page.locator('[data-fl-next],[data-fa-next]').click();
  }
  for(let i=0;i<8;i+=4)assert.deepEqual(seen.slice(i,i+4).sort(),['division','minus','multiply','plus']);
  for(const width of [320,768,1280]) {
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
  }
  const out=path.join(root,'test-results/fraction-multiply');
  fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'mixed-1280.png'),fullPage:true});
  await page.locator('[data-fa-mode="plus"]').click();
  assert.match(await page.locator('#fl-title').innerText(),/plus/);
  assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
  await page.locator('[data-fa-mode="mixed"]').click();
  assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
  await page.locator('[data-fl-exit],[data-fa-exit]').click();
  await page.clock.fastForward(5000);
  assert.equal(await page.locator('#app').innerText(),'Afsluttet');
  assert.deepEqual(errors,[]);
  console.log('PASS mixed: eight completed beginner lessons, balanced shuffle, cumulative count, coach celebration, mode switching, exit and responsive layout');
 } finally {await page.close();}
};
