/* Isolated browser tests. Only fake profiles; no real accounts or database writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const gcd=(a,b)=>b ? gcd(b,a%b) : a;
const phase=page=>page.locator('.fl-page').getAttribute('data-fl-phase');
const count=page=>page.locator('.fl-count').innerText();
const top=page=>page.locator('[data-fl-answer="numerator"]');
const bottom=page=>page.locator('[data-fl-answer="denominator"]');
async function completeReduction(page,n,d,{reply='yes'}={}) {
  const before=await count(page);
  assert.equal(await phase(page),'submitCheck');
  const factor=gcd(n,d);
  await page.locator(`[data-fl-submit-check="${factor>1 ? 'reduce':'submit'}"]`).click();
  if(factor>1) {
    assert.equal(await phase(page),'simplifyRule');
    await page.locator('[data-fl-reduce-rule="divideBoth"]').click();
    await page.locator(`[data-fl-divisor="${factor}"]`).click();
    assert.deepEqual(await page.locator('.fl-inline-divisor').allTextContents(),[`÷ ${factor}`,`÷ ${factor}`]);
    assert.equal(await top(page).inputValue(),'');assert.equal(await bottom(page).inputValue(),'');
    await top(page).fill(String(n/factor));await bottom(page).fill(String(d/factor));
    await page.locator('[data-fl-check-answer]').click();
  }
  assert.equal(await phase(page),'readyToSubmit');
  assert.equal(await count(page),before);
  await page.locator(`[data-fl-ready="${reply}"]`).evaluate(el=>{for(let i=0;i<25;i++)el.click()});
  assert.equal(await phase(page),'done');
  assert.equal(await count(page),`${parseInt(before,10)+1} gennemført`);
  return {n:n/factor,d:d/factor,skipped:factor===1};
}
module.exports={completeReduction};
async function main() {
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const source=fs.readFileSync(path.join(root,'fraction-lesson.js'),'utf8');
  const css=['fraction-lesson.css','fraction-multiply.css','fraction-reduce.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
  const out=path.join(root,'test-results/fraction-reduce');fs.mkdirSync(out,{recursive:true});
  const JACOB='c8b8e1c4-3264-40e9-a43d-0eb6214a0183',errors=[],reports=[];
  const pass=s=>{reports.push(s);console.log('PASS',s)};
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});
  async function mount({width=1280,problem}={}) {
    const p=await browser.newPage({viewport:{width,height:1000},hasTouch:width<900,isMobile:width<600});
    p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
    await p.route('**/*',r=>r.abort());
    await p.setContent('<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f1e8"><main id="app"></main></body></html>');
    await p.addStyleTag({content:css});
    // Deterministic arithmetic fixture in test source only; production has no bypass.
    const script=problem ? source.replace('if (index === 0) return { a:1,b:2,c:3,d:4,notation };',`if (index === 0) return ${JSON.stringify({...problem,notation:'stacked'})};`) : source;
    await p.addScriptTag({content:script});
    await p.evaluate(id=>{window.dispose=JacobFractionLesson.mount(document.querySelector('#app'),{user:{id,role:'teacher'},onExit:()=>{window.dispose();document.querySelector('#app').textContent='Afsluttet'}})},JACOB);
    return p;
  }
  async function product(p,n=4,d=6) {
    await p.locator('[data-fl-operation=":"]').click();await p.locator('[data-fl-rule="reciprocal"]').click();
    for(const [token,slot] of [['d','numerator'],['c','denominator']]) {
      await p.locator(`[data-fl-token="${token}"]`).click();await p.locator(`[data-fl-slot="${slot}"]`).click();
    }
    assert.equal(await p.locator('.fl-result').count(),0,'Do not reveal the multiplication result early');
    await p.locator('[data-fl-rule="multiply"]').click();
    await top(p).fill(String(n));await bottom(p).fill(String(d));await bottom(p).press('Enter');
    assert.equal(await phase(p),'submitCheck');assert.equal(await count(p),'0 gennemført');
    assert.equal(await p.locator('[data-fl-next]').isDisabled(),true);
  }
  async function choose(p,divisor) {
    await p.locator('[data-fl-submit-check="reduce"]').click();
    await p.locator('[data-fl-reduce-rule="divideBoth"]').click();
    await p.locator(`[data-fl-divisor="${divisor}"]`).click();
  }
  async function fits(p) {
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no document overflow');
    assert.ok(await p.locator('[data-fl-answer],.fl-inline-divisor').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect(),box=el.closest('.fl-solution-equation').getBoundingClientRect();return r.left>=box.left && r.right<=box.right})), 'no clipped inputs or divisor badges');
  }
  try {
    const p=await mount();await product(p);
    assert.equal(await p.locator('#fl-question').innerText(),'Vil du aflevere brøken sådan her?');
    assert.deepEqual(await p.locator('[data-fl-submit-check]').allTextContents(),['Ja - den er fin!','Nej - den skal først forlænges!','Nej - den skal først forkortes!']);
    for(const v of ['submit','extend']){await p.locator(`[data-fl-submit-check="${v}"]`).click();assert.equal(await phase(p),'submitCheck')}
    await p.screenshot({path:path.join(out,'desktop-assessment.png'),fullPage:true});
    await p.locator('[data-fl-submit-check="reduce"]').click();
    assert.deepEqual(await p.locator('[data-fl-reduce-rule]').allTextContents(),['Man trækker fra i tælleren','Man trækker fra i tæller og nævner','Man dividerer med samme tal i tæller og nævner']);
    for(const v of ['subtractNumerator','subtractBoth']){await p.locator(`[data-fl-reduce-rule="${v}"]`).click();assert.equal(await phase(p),'simplifyRule')}
    await p.locator('[data-fl-reduce-rule="divideBoth"]').click();
    for(const v of [1,3,4]){await p.locator(`[data-fl-divisor="${v}"]`).click();assert.equal(await phase(p),'simplifyDivisor')}
    await p.locator('[data-fl-divisor="2"]').click();
    assert.deepEqual(await p.locator('.fl-inline-divisor').allTextContents(),['÷ 2','÷ 2']);
    assert.equal(await top(p).inputValue(),'');assert.equal(await bottom(p).inputValue(),'');
    await fits(p);await p.screenshot({path:path.join(out,'desktop-division.png'),fullPage:true});
    for(const [n,d] of [['',''],['2',''],['-2','3'],['2e0','3'],['2.0','3'],['abc','3'],['2','0'],['1','3'],['2','2']]) {
      await top(p).fill(n);await bottom(p).fill(d);await p.locator('[data-fl-check-answer]').click();
      assert.equal(await phase(p),'simplifyAnswer');assert.equal(await count(p),'0 gennemført');
      assert.equal(await top(p).inputValue(),n);assert.equal(await bottom(p).inputValue(),d);
    }
    await top(p).fill('4');await bottom(p).fill('6');await p.locator('[data-fl-check-answer]').click();
    assert.match(await p.locator('.fl-feedback').innerText(),/rigtige værdi/);
    assert.equal(await p.locator('.fl-answer-input.incorrect').count(),0);
    await top(p).evaluate(el=>{el.value='"><img src=x onerror="window.injected=1">';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await p.locator('[data-fl-notation]').click();assert.equal(await p.locator('.fl-page img').count(),0);
    assert.equal(await p.evaluate(()=>window.injected),undefined);
    await top(p).fill('2');await top(p).press('Enter');assert.ok(await bottom(p).evaluate(el=>el===document.activeElement));
    await bottom(p).fill('3');await p.locator('[data-fl-notation]').click();
    assert.equal(await top(p).inputValue(),'2');assert.equal(await bottom(p).inputValue(),'3');
    assert.deepEqual(await p.locator('.fl-inline-divisor').allTextContents(),['÷ 2','÷ 2']);
    await p.locator('[data-fl-check-answer]').evaluate(el=>{for(let i=0;i<30;i++)el.click()});
    assert.equal(await phase(p),'readyToSubmit');assert.equal(await count(p),'0 gennemført');
    await p.locator('[data-fl-ready="no"]').evaluate(el=>{for(let i=0;i<30;i++)el.click()});
    assert.equal(await p.locator('#fl-question').innerText(),'JO, champ! Brøken kan ikke forkortes yderligere! Du har gjort det godt!');
    assert.equal(await count(p),'1 gennemført');
    assert.deepEqual(await p.locator('.fl-result .fl-fraction').allTextContents(),['23']);
    await p.screenshot({path:path.join(out,'desktop-finished.png'),fullPage:true});
    await p.waitForTimeout(650);await p.locator('[data-fl-next]').evaluate(el=>{for(let i=0;i<30;i++)el.click()});
    assert.equal(await phase(p),'operation');assert.equal(await count(p),'1 gennemført');
    pass('4/6: exact questions, wrong choices, divisor validation, two division badges, strict input, escaping, retained state, Enter, reassurance and one-time scoring.');
    await p.close();
    const multi=await mount({problem:{a:3,b:8,c:3,d:4}});await product(multi,12,24);
    for(const [divisor,n,d,expectedPhase] of [[2,6,12,'submitCheck'],[3,2,4,'submitCheck'],[2,1,2,'readyToSubmit']]) {
      await choose(multi,divisor);await top(multi).fill(String(n));await bottom(multi).fill(String(d));await bottom(multi).press('Enter');
      assert.equal(await phase(multi),expectedPhase);assert.equal(await count(multi),'0 gennemført');
    }
    await multi.locator('[data-fl-ready="yes"]').click();
    assert.equal(await multi.locator('#fl-question').innerText(),'FLOT! Du cooker de brøker!');
    pass('Accept any common divisor and repeat until irreducible: 12/24 -> 6/12 -> 2/4 -> 1/2.');await multi.close();
    for(const [problem,n,d] of [[{a:1,b:2,c:1,d:3},3,2],[{a:3,b:4,c:1,d:4},12,4],[{a:3,b:8,c:3,d:4},12,24]]) {
      const q=await mount({problem});await product(q,n,d);await completeReduction(q,n,d);
      assert.equal(await q.locator('#fl-question').innerText(),'FLOT! Du cooker de brøker!');await q.close();
    }
    pass('Already irreducible answers, integer results with denominator 1, and a divisor above 10 all work.');
    for(const width of [320,390,768]) {
      const q=await mount({width});await product(q);await fits(q);
      await choose(q,2);await fits(q);await q.screenshot({path:path.join(out,`division-${width}.png`),fullPage:true});
      await top(q).fill('2');await bottom(q).fill('3');await q.locator('[data-fl-check-answer]').tap();
      await q.locator('[data-fl-ready="yes"]').tap();await fits(q);await q.close();
    }
    pass('Touch interaction and un-clipped fraction inputs at 320px, 390px and 768px.');
    const exiting=await mount();await product(exiting);await choose(exiting,2);
    await exiting.locator('[data-fl-exit]').click();await exiting.waitForTimeout(700);
    assert.equal(await exiting.locator('#app').innerText(),'Afsluttet');await exiting.close();
    const timer=await mount();await product(timer);await completeReduction(timer,4,6);await timer.locator('[data-fl-exit]').click();await timer.waitForTimeout(700);
    assert.equal(await timer.locator('#app').innerText(),'Afsluttet');await timer.close();
    assert.deepEqual(errors,[]);pass('Exit during reduction or completion cancels safely; no uncaught browser errors.');
    fs.writeFileSync(path.join(out,'summary.txt'),reports.join('\n')+'\n');
  } finally {await browser.close()}
}
if(require.main===module) main().catch(e=>{console.error(e);process.exitCode=1});
