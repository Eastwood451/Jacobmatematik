/* Local browser tests: fake profile only, no network, Supabase, or passwords.
   npm install --no-save playwright
   CHROME_PATH=/usr/bin/chromium node scripts/test-fraction-drag.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'fraction-lesson.js'),'utf8');
const css=fs.readFileSync(path.join(root,'fraction-lesson.css'),'utf8');
const out=path.join(root,'test-results/fraction-drag');
fs.mkdirSync(out,{recursive:true});
const JACOB='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
const reports=[], errors=[];
function pass(text){reports.push(text);console.log('PASS',text);}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});
  async function mount(options={}) {
    const page=await browser.newPage({viewport:{width:1280,height:1000},...options});
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
  async function tapPlace(page,token,slot) {
    await page.locator(`[data-fl-token="${token}"]`).tap();
    await page.locator(`[data-fl-slot="${slot}"]`).tap();
  }
  try {
    const page=await mount();
    const enabled=await page.evaluate(id=>[
      JacobFractionLesson.isEnabled({id,role:'teacher'}),
      ...[null,{}, {id,role:'student'},{id:'other',name:'Jacob',role:'teacher'}].map(u=>JacobFractionLesson.isEnabled(u))
    ],JACOB);
    assert.deepEqual(enabled,[true,false,false,false,false]);
    for(const operation of ['+','-','*']) {
      await page.locator(`[data-fl-operation="${operation}"]`).click();
      assert.equal(await page.locator('[data-fl-rule]').count(),0);
    }
    await arrange(page);
    assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
    assert.deepEqual(await page.locator('[data-fl-slot]').allTextContents(),['\u00a0','\u00a0']);
    assert.equal(await page.locator('[data-fl-token="c"]').innerText(),'3');
    assert.equal(await page.locator('[data-fl-token="d"]').innerText(),'4');
    assert.equal(await page.locator('[data-fl-token]').evaluateAll(els=>els.some(el=>!!el.closest('[aria-hidden="true"]'))),false);
    await page.screenshot({path:path.join(out,'desktop-empty.png'),fullPage:true});
    pass('Jacob-only gating, wrong operations rejected, two accessible source numbers, empty targets and no revealed reciprocal.');
    await mouseDrop(page,'c','numerator');
    assert.equal(await page.locator('.fl-slot.is-filled').count(),0);
    assert.match(await page.locator('.fl-feedback').innerText(),/Prøv igen/);
    await mouseDrop(page,'d',null);
    assert.equal(await page.locator('.fl-slot.is-filled').count(),0);
    await mouseDrop(page,'d','numerator');
    assert.equal(await page.locator('[data-fl-slot="numerator"]').innerText(),'4');
    assert.equal(await page.locator('[data-fl-token="d"]').isDisabled(),true);
    assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
    assert.equal(await page.locator('[data-fl-next]').isDisabled(),true);
    await page.locator('[data-fl-notation]').click();
    assert.equal(await page.locator('.fl-expression .fl-operator').innerText(),':');
    assert.equal(await page.locator('[data-fl-slot="numerator"]').innerText(),'4');
    await mouseDrop(page,'c','numerator');
    assert.equal(await page.locator('.fl-slot.is-filled').count(),1);
    await mouseDrop(page,'c','denominator');
    assert.equal(await page.locator('.fl-count').innerText(),'1 gennemført');
    assert.equal(await page.locator('[data-fl-slot="denominator"]').innerText(),'3');
    await page.waitForTimeout(650);
    await page.screenshot({path:path.join(out,'desktop-complete.png'),fullPage:true});
    await page.locator('[data-fl-next]').evaluate(el=>{for(let i=0;i<30;i++)el.click()});
    assert.equal(await page.locator('.fl-count').innerText(),'1 gennemført');
    assert.equal(await page.locator('[data-fl-slot]').count(),0);
    pass('Real mouse drag rejects wrong/outside/occupied drops; notation keeps placement; only two correct placements unlock Next and count once.');
    await arrange(page);
    const values=await page.locator('[data-fl-token]').allTextContents();
    await page.locator('[data-fl-token="c"]').focus();await page.keyboard.press('Enter');
    await page.locator('[data-fl-slot="denominator"]').focus();await page.keyboard.press('Space');
    await page.locator('[data-fl-token="d"]').focus();await page.keyboard.press('Space');
    await page.locator('[data-fl-slot="numerator"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-fl-slot="numerator"]').innerText(),values[1]);
    assert.equal(await page.locator('[data-fl-slot="denominator"]').innerText(),values[0]);
    assert.equal(await page.locator('.fl-count').innerText(),'2 gennemført');
    pass('Keyboard-only placement works, including bottom-first order and freshly generated numbers.');
    await page.evaluate(()=>window.remount());await arrange(page);
    const start=await center(page,'[data-fl-token="c"]');
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+50,start.y+20);
    assert.equal(await page.locator('.fl-drag-ghost').count(),1);
    await page.keyboard.press('Escape');await page.mouse.up();
    assert.equal(await page.locator('.fl-drag-ghost').count(),0);
    assert.equal(await page.locator('.fl-slot.is-filled').count(),0);
    const sourceBox=await center(page,'[data-fl-token="d"]');
    await page.mouse.move(sourceBox.x,sourceBox.y);await page.mouse.down();await page.mouse.move(sourceBox.x+60,sourceBox.y+30);
    await page.evaluate(()=>window.cleanup());await page.mouse.up();
    assert.equal(await page.locator('.fl-drag-ghost').count(),0);
    await page.evaluate(()=>window.remount());
    await page.locator('[data-fl-operation=":"]').click();await page.locator('[data-fl-exit]').click();
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#app').innerText(),'Afsluttet');
    pass('Escape, disposal during drag and exit during delayed transition clean up ghosts, listeners and timers.');
    await page.close();
    for(const width of [320,390,768]) {
      const touch=await mount({viewport:{width,height:1000},hasTouch:true,isMobile:true});
      await arrange(touch);
      assert.ok(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await tapPlace(touch,'c','denominator');await tapPlace(touch,'d','numerator');
      assert.equal(await touch.locator('.fl-count').innerText(),'1 gennemført');
      assert.ok(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await touch.screenshot({path:path.join(out,`touch-${width}.png`),fullPage:true});
      await touch.close();
    }
    pass('Real touchscreen taps at 320px, 390px and 768px complete the reciprocal without horizontal overflow.');
    const touch=await mount({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await arrange(touch);
    const cdp=await touch.context().newCDPSession(touch);
    async function send(type,x,y){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:0}]});}
    async function touchDrop(token,slot) {
      await touch.locator(`[data-fl-token="${token}"]`).scrollIntoViewIfNeeded();
      const from=await center(touch,`[data-fl-token="${token}"]`);
      await send('touchStart',from.x,from.y);
      await send('touchMove',from.x+10,from.y+10);
      let to=await center(touch,`[data-fl-slot="${slot}"]`);
      if(to.y>800){
        await send('touchMove',from.x,825);
        for(let i=0;i<40 && to.y>760;i++){await touch.waitForTimeout(40);to=await center(touch,`[data-fl-slot="${slot}"]`);}
      }
      await send('touchMove',to.x,to.y);
      await send('touchEnd');
      await touch.waitForTimeout(370);
      assert.equal(await touch.locator('.fl-drag-ghost').count(),0);
    }
    await touchDrop('d','numerator');
    assert.equal(await touch.locator('[data-fl-slot="numerator"]').innerText(),'4');
    await touchDrop('c','denominator');
    assert.equal(await touch.locator('.fl-count').innerText(),'1 gennemført');
    await touch.evaluate(()=>window.remount());await arrange(touch);
    await touch.locator('[data-fl-token="c"]').scrollIntoViewIfNeeded();
    const from=await center(touch,'[data-fl-token="c"]');
    await send('touchStart',from.x,from.y);await send('touchMove',from.x+30,from.y+20);await send('touchCancel');
    assert.equal(await touch.locator('.fl-drag-ghost').count(),0);
    assert.equal(await touch.locator('.fl-slot.is-filled').count(),0);
    pass('Real touch drag works on a 390px phone with viewport auto-scroll; interrupted touch cancels safely.');
    await touch.close();
    assert.deepEqual(errors,[]);pass('No uncaught browser errors.');
    fs.writeFileSync(path.join(out,'summary.txt'),reports.join('\n')+'\n');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
