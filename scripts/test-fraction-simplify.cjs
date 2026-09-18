/* Deterministic arithmetic and offline browser tests. No real users or database writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const simplify=fs.readFileSync(path.join(root,'fraction-simplify.js'),'utf8');
const source=simplify+'\n'+fs.readFileSync(path.join(root,'fraction-lesson.js'),'utf8');
const css=['fraction-lesson.css','fraction-multiply.css','fraction-simplify.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const out=path.join(root,'test-results/fraction-simplify');fs.mkdirSync(out,{recursive:true});
const sandbox={window:{}};vm.runInNewContext(simplify,sandbox);
const make=sandbox.window.JacobFractionFinish.create;
const gcd=(a,b)=>{while(b)[a,b]=[b,a%b];return a;};
function act(model,key,value,top='',bottom='') {
  const attr='data-ff-'+key;
  const button={dataset:{['ff'+key[0].toUpperCase()+key.slice(1)]:String(value)},hasAttribute:name=>name===attr};
  model.action(button,{querySelector:selector=>({value:selector.includes('numerator')?String(top):String(bottom)})});
}
for(let n=1;n<=70;n++) for(let d=1;d<=70;d++) {
  const model=make(n,d);let a=n,b=d;
  while(gcd(a,b)>1) {
    act(model,'choice','fine');assert.match(model.html(),/data-ff-stage="assess"/);
    act(model,'choice','reduce');act(model,'choice','divideBoth');
    act(model,'divisor','1');assert.match(model.html(),/data-ff-stage="divisor"/);
    let divisor=2;while(a%divisor||b%divisor)divisor++;
    act(model,'divisor',divisor);assert.match(model.html(),/data-ff-stage="answer"/);
    act(model,'check','',a/divisor,b/divisor);a/=divisor;b/=divisor;
    if(gcd(a,b)===1) break;
  }
  if(model.html().includes('data-ff-stage="assess"')) act(model,'choice','fine');
  assert.match(model.html(),/data-ff-stage="ready"/);
  assert.equal(model.done,false);
  act(model,'choice',(n+d)%2?'yes':'no');assert.equal(model.done,true);
  assert.match(model.html(),new RegExp(`fl-numerator">${n/gcd(n,d)}<`));
  assert.match(model.html(),new RegExp(`fl-denominator">${d/gcd(n,d)}<`));
}
console.log('PASS 4,900 fractions, prime/irreducible fractions, valid partial divisors, repeated reduction, exact final value and both praise messages.');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});
 const errors=[];
 async function mount(width=1280) {
  const p=await browser.newPage({viewport:{width,height:1000},hasTouch:width<1000,isMobile:width<600});p.setDefaultTimeout(7000);
  p.on('pageerror',error=>errors.push(error.message));await p.route('**/*',route=>route.abort());
  await p.setContent('<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f1e8"><main id="app"></main></body></html>');
  await p.addStyleTag({content:css});await p.addScriptTag({content:source});
  await p.evaluate(()=>{window.exit=JacobFractionLesson.mount(document.querySelector('#app'),{user:{id:'c8b8e1c4-3264-40e9-a43d-0eb6214a0183',role:'teacher'},onExit:()=>{window.exit();document.querySelector('#app').innerHTML='Afsluttet';}});});
  await p.locator('[data-fl-operation=":"]').click();await p.locator('[data-fl-rule="reciprocal"]').click();
  for(const [token,slot] of [['d','numerator'],['c','denominator']]) {await p.locator(`[data-fl-token="${token}"]`).click();await p.locator(`[data-fl-slot="${slot}"]`).click();}
  assert.equal(await p.locator('[data-fl-answer]').count(),0);
  await p.locator('[data-fl-rule="multiply"]').click();
  await p.locator('[data-fl-answer="numerator"]').fill('4');await p.locator('[data-fl-answer="denominator"]').fill('6');await p.locator('[data-fl-check-answer]').click();
  return p;
 }
 const stage=p=>p.locator('.ff-panel').getAttribute('data-ff-stage');
 try {
  for(const width of [1280,320,390,768]) {
   const p=await mount(width);
   assert.equal(await p.locator('#fl-question').innerText(),'Vil du aflevere brøken sådan her?');
   assert.deepEqual(await p.locator('[data-ff-choice]').allTextContents(),['Ja - den er fin!','Nej - den skal først forlænges!','Nej - den skal først forkortes!']);
   for(const choice of ['fine','extend']) {await p.locator(`[data-ff-choice="${choice}"]`).click();assert.equal(await stage(p),'assess');}
   await p.locator('[data-ff-choice="reduce"]').click();
   assert.equal(await p.locator('#fl-question').innerText(),'Hvordan forkorter man en brøk?');
   assert.deepEqual(await p.locator('[data-ff-choice]').allTextContents(),['Man trækker fra i tælleren','Man trækker fra i tæller og nævner','Man dividerer med samme tal i tæller og nævner']);
   for(const choice of ['subtractTop','subtractBoth']) {await p.locator(`[data-ff-choice="${choice}"]`).click();assert.equal(await stage(p),'rule');}
   await p.locator('[data-ff-choice="divideBoth"]').click();
   assert.equal(await p.locator('#fl-question').innerText(),'Hvilket tal vil du dividere med?');
   for(const divisor of ['3','4']) {await p.locator(`[data-ff-divisor="${divisor}"]`).click();assert.equal(await stage(p),'divisor');}
   await p.locator('[data-ff-divisor="2"]').click();
   assert.deepEqual(await p.locator('.ff-term small').allTextContents(),['÷ 2','÷ 2']);
   const top=p.locator('[data-ff-answer="numerator"]'),bottom=p.locator('[data-ff-answer="denominator"]');
   assert.equal(await top.inputValue(),'');assert.equal(await bottom.inputValue(),'');
   assert.equal(await p.locator('.fl-count').innerText(),'0 gennemført');assert.equal(await p.locator('[data-fl-next]').count(),0);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await p.locator('[data-ff-answer]').evaluateAll(els=>els.every(el=>{const a=el.getBoundingClientRect(),b=el.closest('.ff-equation').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right;})));
   await p.screenshot({path:path.join(out,`division-${width}.png`),fullPage:true});
   if(width===1280) {
    for(const [a,b] of [['',''],['2',''],['2','0'],['-2','3'],['2.0','3'],['2e0','3'],['7','3'],['2','7'],['4','6']]) {
     await top.fill(a);await bottom.fill(b);await p.locator('[data-ff-check]').click();assert.equal(await stage(p),'answer');
     assert.equal(await p.locator('.fl-count').innerText(),'0 gennemført');
    }
    assert.match(await p.locator('#fl-feedback').innerText(),/samme værdi/);
    assert.equal(await p.locator('.fl-answer-input.incorrect').count(),0);
    await top.fill('2');await bottom.fill('');await p.locator('[data-fl-notation]').click();assert.equal(await top.inputValue(),'2');
    await top.evaluate(el=>{el.value='"><img src=x onerror="window.injected=1">';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await p.locator('[data-fl-notation]').click();assert.equal(await p.locator('.fl-page img').count(),0);
   }
   await top.fill('2');await top.press('Enter');assert.equal(await bottom.evaluate(el=>el===document.activeElement),true);
   await bottom.fill('3');await bottom.press('Enter');assert.equal(await stage(p),'ready');
   assert.equal(await p.locator('#fl-question').innerText(),'Er du klar til at aflevere?');
   assert.equal(await p.locator('.fl-count').innerText(),'0 gennemført');
   const finalAnswer=width===320?'no':'yes';
   await p.locator(`[data-ff-choice="${finalAnswer}"]`).evaluate(el=>{for(let i=0;i<25;i++)el.click();});
   assert.equal(await p.locator('#fl-question').innerText(),finalAnswer==='yes'?'FLOT! Du cooker de brøker!':'JO, champ! Brøken kan ikke forkortes yderligere! Du har gjort det godt!');
   assert.equal(await p.locator('.fl-count').innerText(),'1 gennemført');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:path.join(out,`complete-${width}.png`),fullPage:true});
   await p.locator('[data-fl-exit]').click();await p.waitForTimeout(700);
   assert.equal(await p.locator('#app').innerText(),'Afsluttet');await p.close();
  }
  assert.deepEqual(errors,[]);
  const summary='PASS exact questions/options, wrong rules/divisors/answers, both small division annotations, empty fields, keyboard, preserved inputs, escaping, final yes/no, single completion and exit cleanup at 1280/320/390/768px.\n';
  console.log(summary);fs.writeFileSync(path.join(out,'summary.txt'),summary);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
