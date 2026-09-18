/* Isolated real-browser regressions. Fake profile only; all network requests blocked.
   CHROME_PATH=/usr/bin/chromium node scripts/test-fraction-drag.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {completeFinish}=require('./fraction-finish-support.cjs');
const root=path.resolve(__dirname,'..');
const source=['fraction-simplify.js','fraction-lesson.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const css=['fraction-lesson.css','fraction-multiply.css','fraction-simplify.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const out=path.join(root,'test-results/fraction-drag');
fs.mkdirSync(out,{recursive:true});
const JACOB='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
const reports=[], errors=[];
function pass(text){reports.push(text);console.log('PASS',text);}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});
  async function mount(options={}) {
    const page=await browser.newPage({viewport:{width:1280,height:1000},...options});
    page.setDefaultTimeout(10000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',r=>r.abort());
    await page.setContent('<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f1e8"><main id="app"></main></body></html>');
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:source});
    await page.evaluate(id=>{
      window.remount=()=>{
        window.cleanup?.();
        window.cleanup=JacobFractionLesson.mount(document.querySelector('#app'),{user:{id,role:'teacher'},onExit:()=>{window.cleanup();document.querySelector('#app').innerHTML='Afsluttet';}});
      };
      window.remount();
    },JACOB);
    return page;
  }
  const phase=page=>page.locator('.fl-page').getAttribute('data-fl-phase');
  const count=page=>page.locator('.fl-count').innerText();
  async function arrange(page) {
    await page.locator('[data-fl-operation=":"]').click();
    await page.locator('[data-fl-rule="reciprocal"]').click();
    assert.equal(await page.locator('[data-fl-token]').count(),2);
    assert.equal(await page.locator('[data-fl-slot]').count(),2);
    assert.equal(await page.locator('[data-fl-next]').isDisabled(),true);
    assert.equal(await page.locator('.fl-flip-explanation').count(),0);
  }
  async function center(page,selector) {
    const box=await page.locator(selector).boundingBox();
    assert.ok(box,selector);
    return {x:box.x+box.width/2,y:box.y+box.height/2};
  }
  async function mouseDrop(page,token,slot) {
    const from=await center(page,`[data-fl-token="${token}"]`);
    const to=slot ? await center(page,`[data-fl-slot="${slot}"]`) : {x:20,y:200};
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();
    assert.equal(await page.locator('.fl-drag-ghost').count(),0);
    await page.waitForTimeout(370);
  }
  async function place(page,token,slot,touch=false) {
    const action=touch ? 'tap' : 'click';
    await page.locator(`[data-fl-token="${token}"]`)[action]();
    await page.locator(`[data-fl-slot="${slot}"]`)[action]();
  }
  async function finishMultiplication(page,review=false) {
    const before=await count(page);
    assert.equal(await phase(page),'multiplyRule');
    assert.equal(await page.locator('#fl-question').innerText(),'Hvordan ganger du en brøk med en brøk?');
    assert.equal(await page.locator('[data-fl-rule]').count(),3);
    assert.equal(await page.locator('[data-fl-answer]').count(),0);
    assert.equal(await page.locator('[data-fl-next]').isDisabled(),true);
    const a=Number(await page.locator('.fl-expression .fl-numerator').first().innerText());
    const b=Number(await page.locator('.fl-expression .fl-denominator').first().innerText());
    const d=Number(await page.locator('[data-fl-slot="numerator"]').innerText());
    const c=Number(await page.locator('[data-fl-slot="denominator"]').innerText());
    const n=a*d, den=b*c;
    if(review) {
      for(const rule of ['add','reciprocal']) {
        await page.locator(`[data-fl-rule="${rule}"]`).click();
        assert.equal(await phase(page),'multiplyRule');
        assert.match(await page.locator('.fl-feedback').innerText(),/Nej/);
        assert.equal(await count(page),before);
      }
      await page.screenshot({path:path.join(out,'desktop-multiply-rule.png'),fullPage:true});
    }
    await page.locator('[data-fl-rule="multiply"]').evaluate(el=>{for(let i=0;i<20;i++)el.click()});
    assert.equal(await phase(page),'multiplyAnswer');
    const top=page.locator('[data-fl-answer="numerator"]'), bottom=page.locator('[data-fl-answer="denominator"]');
    assert.equal(await top.inputValue(),'');assert.equal(await bottom.inputValue(),'');
    assert.equal(await top.getAttribute('inputmode'),'numeric');
    assert.equal(await top.evaluate(el=>el===document.activeElement),true);
    assert.equal(await count(page),before);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await page.locator('[data-fl-answer]').evaluateAll(els=>els.every(el=>{const a=el.getBoundingClientRect(),p=el.closest('.fl-solution-equation').getBoundingClientRect();return a.left>=p.left&&a.right<=p.right;})));
    if(review) {
      await page.screenshot({path:path.join(out,'desktop-answer-empty.png'),fullPage:true});
      const check=page.locator('[data-fl-check-answer]');
      for(const [x,y] of [['',''],[String(n),''],['-4',String(den)],['4e0',String(den)],['4.0',String(den)],['abc',String(den)],[String(n),'0'],[String(n+1),String(den)],[String(n),String(den+1)]]) {
        await top.fill(x);await bottom.fill(y);await check.click();
        assert.equal(await phase(page),'multiplyAnswer');assert.equal(await count(page),before);
        assert.equal(await top.inputValue(),x);assert.equal(await bottom.inputValue(),y);
      }
      assert.equal(await bottom.evaluate(el=>el===document.activeElement),true);
      await top.fill('2');await bottom.fill('3');await check.click();
      assert.match(await page.locator('.fl-feedback').innerText(),/rigtige værdi/);
      assert.equal(await page.locator('.fl-answer-input.incorrect').count(),0);
      await top.fill(String(n));await bottom.fill(String(den));
      await page.locator('[data-fl-notation]').click();
      assert.equal(await top.inputValue(),String(n));assert.equal(await bottom.inputValue(),String(den));
      await top.evaluate(el=>{el.value='"><img src=x onerror="window.injected=1">';el.dispatchEvent(new Event('input',{bubbles:true}))});
      await page.locator('[data-fl-notation]').click();
      assert.equal(await page.locator('.fl-page img').count(),0);
      assert.equal(await page.evaluate(()=>window.injected),undefined);
    }
    await top.fill(String(n));await top.press('Enter');
    assert.equal(await bottom.evaluate(el=>el===document.activeElement),true);
    await bottom.fill(String(den));
    await page.locator('[data-fl-check-answer]').evaluate(el=>{for(let i=0;i<30;i++)el.click()});
    assert.equal(await phase(page),'finish');
    assert.equal(await count(page),before);
    const final=await completeFinish(page);
    assert.equal(await phase(page),'done');
    assert.equal(await count(page),`${parseInt(before,10)+1} gennemført`);
    assert.equal(await page.locator('.ff-equation .fl-numerator').innerText(),String(final.n));
    assert.equal(await page.locator('.ff-equation .fl-denominator').innerText(),String(final.d));
    assert.equal(await page.locator('.fl-steps .complete').count(),6);
    await page.waitForFunction(()=>!document.querySelector('[data-fl-next]').disabled, null, {polling:50,timeout:5000});
  }
  try {
    const page=await mount();
    assert.deepEqual(await page.evaluate(id=>[JacobFractionLesson.isEnabled({id,role:'teacher'}),...[null,{}, {id,role:'student'},{id:'other',name:'Jacob',role:'teacher'}].map(u=>JacobFractionLesson.isEnabled(u))],JACOB),[true,false,false,false,false]);
    for(const operation of ['+','-','*']) {
      await page.locator(`[data-fl-operation="${operation}"]`).click();
      assert.equal(await page.locator('[data-fl-rule]').count(),0);
    }
    await arrange(page);
    assert.equal(await count(page),'0 gennemført');
    assert.deepEqual(await page.locator('[data-fl-slot]').allTextContents(),['\u00a0','\u00a0']);
    assert.equal(await page.locator('[data-fl-token]').evaluateAll(els=>els.some(el=>!!el.closest('[aria-hidden="true"]'))),false);
    await page.screenshot({path:path.join(out,'desktop-empty.png'),fullPage:true});
    pass('Jacob-only gating; wrong operations rejected; accessible draggable numbers and empty targets.');
    await mouseDrop(page,'c','numerator');assert.equal(await page.locator('.fl-slot.is-filled').count(),0);
    await mouseDrop(page,'d',null);assert.equal(await page.locator('.fl-slot.is-filled').count(),0);
    await mouseDrop(page,'d','numerator');
    assert.equal(await page.locator('[data-fl-slot="numerator"]').innerText(),'4');
    assert.equal(await page.locator('[data-fl-token="d"]').isDisabled(),true);
    assert.equal(await count(page),'0 gennemført');
    await page.locator('[data-fl-notation]').click();
    assert.equal(await page.locator('.fl-expression .fl-operator').innerText(),':');
    await mouseDrop(page,'c','numerator');assert.equal(await page.locator('.fl-slot.is-filled').count(),1);
    await mouseDrop(page,'c','denominator');
    assert.equal(await count(page),'0 gennemført');
    await finishMultiplication(page,true);
    await page.screenshot({path:path.join(out,'desktop-complete.png'),fullPage:true});
    await page.locator('[data-fl-next]').evaluate(el=>{for(let i=0;i<30;i++)el.click()});
    assert.equal(await count(page),'1 gennemført');assert.equal(await page.locator('[data-fl-slot]').count(),0);
    pass('Real mouse drag, both rule selections, invalid/empty/zero/partial/unsimplified answers, escaping, retained input and one-time final scoring.');
    await arrange(page);
    await page.locator('[data-fl-token="c"]').focus();await page.keyboard.press('Enter');
    await page.locator('[data-fl-slot="denominator"]').focus();await page.keyboard.press('Space');
    await page.locator('[data-fl-token="d"]').focus();await page.keyboard.press('Space');
    await page.locator('[data-fl-slot="numerator"]').focus();await page.keyboard.press('Enter');
    await finishMultiplication(page);
    assert.equal(await count(page),'2 gennemført');
    for(let i=0;i<2;i++) {
      await page.locator('[data-fl-next]').click();await arrange(page);
      await place(page,'d','numerator');await place(page,'c','denominator');
      await finishMultiplication(page);
    }
    pass('Keyboard placement in reverse order and 3 subsequent generated fraction products; each next problem starts with empty answers.');
    await page.evaluate(()=>window.remount());await arrange(page);
    let start=await center(page,'[data-fl-token="c"]');
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+50,start.y+20);
    assert.equal(await page.locator('.fl-drag-ghost').count(),1);
    await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.locator('.fl-drag-ghost').count(),0);
    start=await center(page,'[data-fl-token="d"]');
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+60,start.y+30);
    await page.evaluate(()=>window.cleanup());await page.mouse.up();assert.equal(await page.locator('.fl-drag-ghost').count(),0);
    await page.evaluate(()=>window.remount());await page.locator('[data-fl-operation=":"]').click();await page.locator('[data-fl-exit]').click();
    await page.waitForTimeout(1000);assert.equal(await page.locator('#app').innerText(),'Afsluttet');
    await page.evaluate(()=>window.remount());await arrange(page);await place(page,'c','denominator');await place(page,'d','numerator');
    await page.locator('[data-fl-rule="multiply"]').click();await page.locator('[data-fl-answer="numerator"]').fill('4');
    await page.locator('[data-fl-answer="denominator"]').fill('6');await page.locator('[data-fl-answer="denominator"]').press('Enter');
    assert.equal(await phase(page),'finish');
    await completeFinish(page);
    await page.locator('[data-fl-exit]').click();await page.waitForTimeout(700);assert.equal(await page.locator('#app').innerText(),'Afsluttet');
    pass('Enter submits denominator; Escape, mid-drag disposal and exit during both timers remove stale UI.');
    await page.close();
    for(const width of [320,390,768]) {
      const touch=await mount({viewport:{width,height:1000},hasTouch:true,isMobile:true});
      await arrange(touch);await place(touch,'c','denominator',true);await place(touch,'d','numerator',true);
      assert.equal(await count(touch),'0 gennemført');await finishMultiplication(touch);
      assert.ok(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await touch.screenshot({path:path.join(out,`touch-${width}.png`),fullPage:true});await touch.close();
    }
    pass('Touch taps and full flow through simplification at 320px, 390px and 768px; inputs stay inside the equation without overflow.');
    const touch=await mount({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await arrange(touch);
    const cdp=await touch.context().newCDPSession(touch);
    async function send(type,x,y){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:0}]});}
    async function touchDrop(token,slot) {
      await touch.locator(`[data-fl-token="${token}"]`).scrollIntoViewIfNeeded();
      const from=await center(touch,`[data-fl-token="${token}"]`);
      await send('touchStart',from.x,from.y);await send('touchMove',from.x+10,from.y+10);
      let to=await center(touch,`[data-fl-slot="${slot}"]`);
      if(to.y>800){await send('touchMove',from.x,825);for(let i=0;i<40&&to.y>760;i++){await touch.waitForTimeout(40);to=await center(touch,`[data-fl-slot="${slot}"]`);}}
      await send('touchMove',to.x,to.y);await send('touchEnd');await touch.waitForTimeout(370);
      assert.equal(await touch.locator('.fl-drag-ghost').count(),0);
    }
    await touchDrop('d','numerator');await touchDrop('c','denominator');
    assert.equal(await count(touch),'0 gennemført');await finishMultiplication(touch);
    await touch.evaluate(()=>window.remount());await arrange(touch);await touch.locator('[data-fl-token="c"]').scrollIntoViewIfNeeded();
    const from=await center(touch,'[data-fl-token="c"]');
    await send('touchStart',from.x,from.y);await send('touchMove',from.x+30,from.y+20);await send('touchCancel');
    assert.equal(await touch.locator('.fl-drag-ghost').count(),0);
    assert.equal(await touch.locator('.fl-slot.is-filled').count(),0);
    pass('Real touch drag, viewport auto-scroll and touch cancellation remain intact.');
    await touch.close();
    assert.deepEqual(errors,[]);pass('No uncaught browser errors.');
    fs.writeFileSync(path.join(out,'summary.txt'),reports.join('\n')+'\n');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
