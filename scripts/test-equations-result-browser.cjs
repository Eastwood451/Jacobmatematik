/* Real browser checks for the result's slide, morph and two-second fade. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<!doctype html><html lang="en"><body style="margin:0;background:#eeeaf2"><main id="root"></main></body></html>');
  await page.addStyleTag({content:fs.readFileSync('equations.css','utf8')});
  await page.evaluate(()=>{
   window.__spoken=[];
   window.Audio=function(url){this.currentTime=0;this.preload='';this.play=()=>{window.__spoken.push(url);return Promise.resolve();};this.pause=()=>{};};
  });
  await page.addScriptTag({content:fs.readFileSync('equations.js','utf8')});
  const click=action=>page.locator(`[data-eq="${action}"]`).first().click();
  const prepare=async(reduced=false)=>{
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.evaluate(()=>{window.__dispose?.();window.__dispose=window.JacobEquations.mount(document.getElementById('root'));});
   await click('next');
   for(const side of ['left','right','left','right'])await click(side);
   await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  };
  const phase=name=>page.locator(`.eq-module[data-result-phase="${name}"]`).waitFor();
  const expressions=async(left,right)=>{
   assert.equal(await page.locator('.eq-expression-left').textContent(),left);
   assert.equal(await page.locator('.eq-expression-right').textContent(),right);
  };
  const dir='test-results/equations-result';fs.mkdirSync(dir,{recursive:true});
  await prepare();await expressions('x + 2 − 2','6 − 2');
  await page.screenshot({path:dir+'/1-before.png',fullPage:true});
  await click('next');await phase('sliding');
  assert(await page.locator('[data-eq="next"]').isDisabled());
  await page.waitForFunction(()=>document.querySelector('.eq-subtraction').getAnimations().some(a=>a.currentTime>=250));
  const slide=await page.locator('.eq-expression-left .eq-subtraction').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41);
  assert(slide<0,'minus two moves left into the original two');
  await page.screenshot({path:dir+'/2-sliding.png',fullPage:true});
  await phase('fading');
  assert.equal(await page.locator('.eq-expression-left .eq-start-value').textContent(),'0');
  assert.equal(await page.locator('.eq-expression-right .eq-start-value').textContent(),'4');
  assert(!await page.evaluate(()=>window.__spoken.at(-1).includes('-done.mp3')),'final narration waits until the zero disappears');
  assert.equal(await page.locator('.eq-addition-group').evaluate(el=>el.getAnimations()[0].effect.getTiming().duration),2000);
  await page.screenshot({path:dir+'/3-zero-and-four.png',fullPage:true});
  await page.waitForFunction(()=>document.querySelector('.eq-addition-group')?.getAnimations().some(a=>a.currentTime>=1000));
  const opacity=await page.locator('.eq-addition-group').evaluate(el=>Number(getComputedStyle(el).opacity));
  assert(opacity>0&&opacity<1,'zero fades gradually');
  assert.equal(await page.locator('.eq-expression-right .eq-start-value').evaluate(el=>Number(getComputedStyle(el).opacity)),1);
  await page.screenshot({path:dir+'/4-fading.png',fullPage:true});
  await phase('done');await expressions('x','4');
  assert(await page.locator('[data-eq="next"]').isEnabled());
  assert(await page.evaluate(()=>window.__spoken.at(-1).includes('en-done.mp3')));
  await page.screenshot({path:dir+'/5-done.png',fullPage:true});
  // A reset during the fade cancels all pending writes and narration.
  await prepare();await click('next');await phase('fading');await click('reset');
  await expressions('x + 2','6');
  assert.equal(await page.locator('.eq-module').getAttribute('data-result-phase'),'idle');
  assert.equal(await page.locator('.eq-equation').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().duration===2000).length),0);
  // Changing language during the slide restores the ready-to-simplify equation.
  await prepare();await click('next');await phase('sliding');
  await page.evaluate(()=>{document.documentElement.lang='da';document.dispatchEvent(new Event('jm-langchange'));});
  await expressions('x + 2 − 2','6 − 2');
  assert.equal(await page.locator('[data-eq="next"]').textContent(),'Vis resultatet');
  await click('next');await phase('fading');
  await page.evaluate(()=>window.__dispose());
  assert.equal(await page.locator('.eq-equation').evaluate(el=>el.getAnimations({subtree:true}).length),0);
  // Reduced motion reaches the same answer immediately, including on mobile.
  await page.setViewportSize({width:390,height:844});
  await prepare(true);await click('next');await phase('done');await expressions('x','4');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:dir+'/6-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: slide into both numbers, 0 and 4, exact 2000ms zero fade, final narration, reset/language/disposal cancellation, reduced motion and mobile layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
