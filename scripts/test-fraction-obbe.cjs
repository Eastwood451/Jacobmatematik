/* Real lesson engines with fake profiles and intercepted local assets; no student-data writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {completeFinish} = require('./fraction-finish-support.cjs');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));
const JACOB = 'c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
const scripts = ['fraction-simplify.js','fraction-lesson.js','fraction-add-subtract.js','fraction-obbe.js'];
const styles = ['styles.css','fraction-lesson.css','fraction-multiply.css','fraction-simplify.css','fraction-add-subtract.css','fraction-obbe.css'];
const asset = read('assets/figurer/obbe-techno.webp');
assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${asset.length}\0`),asset])).digest('hex'),'54a25e450560ad784089edf3ba5f93db55f3c1ed');
const out = path.join(root,'test-results/fraction-obbe'); fs.mkdirSync(out,{recursive:true});
const errors = [];
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || undefined, args:['--no-sandbox']});
  async function open(width=1440, full=false, reduced=false) {
    const page = await browser.newPage({viewport:{width,height:1080},hasTouch:width<1000,isMobile:width<600,reducedMotion:reduced?'reduce':'no-preference'});
    page.setDefaultTimeout(12000); page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const name = new URL(route.request().url()).pathname.slice(1);
      if (['assets/figurer/obbe-ovdig.png','assets/figurer/obbe-techno.webp'].includes(name)) return route.fulfill({body:read(name),contentType:name.endsWith('.png')?'image/png':'image/webp'});
      return route.abort();
    });
    await page.setContent('<!doctype html><html lang="da"><head><base href="https://lesson.test/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app" class="app-shell"></main></body></html>');
    await page.addStyleTag({content:styles.map(name=>read(name).toString()).join('\n')});
    await page.evaluate(()=>{
      window.__sounds=[];
      window.Audio=class { constructor(src){this.src=src;} play(){window.__sounds.push(this.src);return Promise.resolve();} pause(){} removeAttribute(){} };
      try { localStorage.setItem('jacobmatematik-obbe-muted','true'); } catch {}
    });
    for(const name of scripts) await page.addScriptTag({content:read(name).toString()});
    if (full) {
      await page.evaluate(id=>{
        const teacher={id,role:'teacher',name:'Jacob',username:'Jacob',results:[]};
        const db={classes:[{id:'c1',name:'Testklasse'}],users:[teacher]};
        window.__profile=teacher;window.__writes=[];
        window.JacobBackend={configured:true,
          async loadDatabase(){return{database:JSON.parse(JSON.stringify(db)),currentUserId:id}},
          async loadSchoolState(){return JSON.parse(JSON.stringify(db))},async loadResults(){return[]},
          async saveSchoolState(data,userId){window.__writes.push(data.users.find(u=>u.id===userId)?.role)},
          async appendResult(){throw Error('Unexpected student write')},async signOut(){}
        };
      },JACOB);
      await page.addScriptTag({content:read('app.js').toString()});
      await page.locator('[data-action="learn-fractions"]').click();
    } else await page.evaluate(id=>{
      window.cleanup=JacobFractionLesson.mount(document.querySelector('#app'),{user:{id,role:'teacher'},onExit:()=>{window.cleanup();document.querySelector('#app').textContent='Afsluttet';}});
    },JACOB);
    await page.waitForFunction(()=>document.querySelector('[data-fo-still]')?.naturalWidth>0 && document.querySelector('[data-fo-dance]')?.naturalWidth>0);
    if (await page.locator('[data-fo-mute]').getAttribute('aria-pressed') === 'true') await page.locator('[data-fo-mute]').click();
    return page;
  }
  async function layout(page) {
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
    const rail=await page.locator('.fo-card').boundingBox(), work=await page.locator('.fl-workspace').boundingBox();
    assert.ok(rail.x+rail.width<=work.x+1 || rail.y+rail.height<=work.y+1,'coach overlaps mathematics');
  }
  async function toFinish(page,mode) {
    await page.locator(`[data-fa-mode="${mode}"]`).click();
    const simple=mode==='plus'||mode==='minus';
    if(simple) {
      await page.locator(`[data-fa-operation="${mode==='plus'?'+':'-'}"]`).click();
      await page.locator('[data-fa-rule="common"]').click();
      await page.locator('[data-fa-method="extend"]').click();
      await page.locator('[data-fa-factor="3"]').click();
      await page.locator('[data-fa-extension-rule="multiplyBoth"]').click();
      await page.locator('[data-fa-answer="numerator"]').fill('3');
      await page.locator('[data-fa-answer="denominator"]').fill('6');
      await page.locator('[data-fa-check]').click();
      await page.locator('[data-fa-answer="numerator"]').fill(mode==='plus'?'4':'2');
      await page.locator('[data-fa-check]').click();
    } else {
      await page.locator(`[data-fl-operation="${mode==='multiply'?'*':':'}"]`).click();
      if(mode==='division') {
        await page.locator('[data-fl-rule="reciprocal"]').click();
        await page.locator('[data-fl-token="d"]').click();await page.locator('[data-fl-slot="numerator"]').click();
        await page.locator('[data-fl-token="c"]').click();await page.locator('[data-fl-slot="denominator"]').click();
      }
      await page.locator('[data-fl-rule="multiply"]').click();
      await page.locator('[data-fl-answer="numerator"]').fill(mode==='multiply'?'3':'4');
      await page.locator('[data-fl-answer="denominator"]').fill(mode==='multiply'?'8':'6');
      await page.locator('[data-fl-check-answer]').click();
    }
    assert.equal(await page.locator('[data-ff-stage="assess"]').count(),1);
    assert.equal(await page.locator('.fo-celebrating').count(),0,'no early celebration');
    assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
  }
  try {
    for(const [mode,width] of [['division',1440],['multiply',1366],['plus',768],['minus',320]]) {
      const page=await open(width,false,width===320);
      const initial=await page.locator('[data-fo-bubble]').innerText();
      await page.locator('[data-fo-shout]').click();
      assert.notEqual(await page.locator('[data-fo-bubble]').innerText(),initial);
      assert.equal(await page.evaluate(()=>window.__sounds.length),0);
      await page.locator('[data-fo-mute]').click();await page.locator('[data-fo-shout]').click();
      assert.equal(await page.evaluate(()=>window.__sounds.length),1);
      await page.locator('[data-fo-mute]').click();
      await toFinish(page,mode);await layout(page);
      await completeFinish(page,mode==='minus'?'no':'yes');
      const started=Date.now();
      await page.waitForSelector('.fo-celebrating');
      assert.equal(await page.locator('[data-fo-dance]').isVisible(),true);
      assert.equal(await page.locator('[data-fo-still]').isVisible(),false);
      assert.equal(await page.locator('[data-fl-next],[data-fa-next]').isDisabled(),true);
      if(width===320) assert.equal(await page.locator('[data-fo-dance]').evaluate(e=>getComputedStyle(e).animationName),'none');
      await page.screenshot({path:path.join(out,`${mode}-${width}.png`),fullPage:true});
      await page.waitForTimeout(750);
      await page.locator('[data-fl-next],[data-fa-next]').dispatchEvent('click');
      assert.equal(await page.locator('[data-ff-stage="done"]').count(),1);
      assert.equal(await page.locator('[data-fl-next],[data-fa-next]').isDisabled(),true);
      await page.waitForSelector('.fo-celebrating',{state:'detached',timeout:4500});
      const elapsed=Date.now()-started;assert.ok(elapsed>=3750&&elapsed<5500,`celebration timing ${elapsed}ms`);
      assert.equal(await page.locator('[data-fo-still]').isVisible(),true);
      assert.equal(await page.locator('[data-fo-dance]').isVisible(),false);
      assert.equal(await page.locator('[data-fl-next],[data-fa-next]').isDisabled(),false);
      assert.equal(await page.locator('.fl-count').innerText(),'1 gennemført');await layout(page);
      await page.locator('[data-fl-next],[data-fa-next]').click();
      assert.equal(await page.locator('.fo-celebrating').count(),0);
      await page.locator('[data-fl-exit],[data-fa-exit]').click();
      assert.equal(await page.locator('#app').innerText(),'Afsluttet');await page.close();
      console.log('PASS',mode,width,'normal portrait, changing speech, sound toggle, complete lesson and four-second celebration; no overlap');
    }
    const page=await open(390,true);
    await toFinish(page,'multiply');await completeFinish(page);
    await page.locator('[data-fa-mode="minus"]').click();
    await page.waitForTimeout(4300);
    assert.equal(await page.locator('.fo-celebrating').count(),0);assert.match(await page.locator('#fl-title').innerText(),/minus/);
    await page.locator('[data-action="toggle-jacob-view"]').click();await page.waitForSelector('.teacher-layout');
    assert.equal(await page.locator('.fo-layout').count(),0);
    assert.equal(await page.evaluate(()=>window.__profile.role),'teacher');assert.ok(await page.evaluate(()=>window.__writes.every(r=>r==='teacher')));
    await page.evaluate(id=>{
      for(const user of [null,{}, {id:'invalid',role:'unknown'}]) {
        const el=document.createElement('div');document.body.append(el);JacobFractionLesson.mount(el,{user});
        if(el.innerHTML)throw Error('Lesson exposed without a valid profile');el.remove();
      }
    },JACOB);
    await page.close();assert.deepEqual(errors,[]);
    console.log('PASS 390px full-app entry, cancellation on mode change, teacher toggle, valid-profile access and no browser errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
