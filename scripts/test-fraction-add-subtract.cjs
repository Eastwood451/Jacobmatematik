/* Offline tests, fake profiles only. Run from the repository root with Playwright installed. */
require('./test-fraction-beginner.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'fraction-add-subtract.js'),'utf8');
const sandbox={window:{JacobFractionLesson:{isEnabled:()=>false}}};
vm.runInNewContext(source,sandbox);
const api=sandbox.window.JacobFractionAddSubtract;
const gcd=(a,b)=>{while(b)[a,b]=[b,a%b];return a;};
const pool=[];for(let d=2;d<=12;d++)for(let n=1;n<d;n++)if(gcd(n,d)===1)pool.push([n,d]);
let count=0;
for(const [a,b] of pool)for(const [c,d] of pool)for(const op of ['+','-']) {
  if(op==='-' && a*d<=c*b)continue;
  const p={a,b,c,d,op},q=api.plan(p);
  assert.equal(q.denominator%b,0);assert.equal(q.denominator%d,0);
  assert.equal(q.numerators[0]*b,a*q.denominator);assert.equal(q.numerators[1]*d,c*q.denominator);
  assert.equal(q.numerator*b*d,(op==='+' ? a*d+c*b:a*d-c*b)*q.denominator);
  assert.ok(q.numerator>0);count++;
}
for(const op of ['+','-'])for(let i=0;i<3000;i++) {
  const p=api.createProblem(op,i,()=>((i*733)%3000)/3000),q=api.plan(p);
  assert.equal(p.op,op);assert.notEqual(p.b,p.d);assert.equal(gcd(p.a,p.b),1);assert.equal(gcd(p.c,p.d),1);
  assert.ok(q.factors.some(f=>f>1));assert.ok(q.factors.every(f=>f>=1 && f<=3));assert.ok(q.numerator>0 && q.numerator<=12);assert.ok(q.denominator<=12);
}
assert.equal(api.plan(api.createProblem('+')).numerator,4);assert.equal(api.plan(api.createProblem('+')).denominator,6);
assert.equal(api.plan(api.createProblem('-')).numerator,2);assert.equal(api.plan(api.createProblem('-')).denominator,6);
assert.throws(()=>api.plan({a:1,b:2,c:1,d:2,op:'-'}));assert.throws(()=>api.createProblem(':'));
console.log(`PASS ${count} exact arithmetic plans and 6,000 generated problems; nonzero positive subtraction, unlike denominators and valid extension factors.`);
if(process.argv.includes('--arithmetic-only'))process.exit(0);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {completeFinish}=require('./fraction-finish-support.cjs');
const names=['fraction-simplify.js','fraction-lesson.js','fraction-add-subtract.js'];
const scripts=names.map(name=>fs.readFileSync(path.join(root,name),'utf8'));
const css=['styles.css','fraction-lesson.css','fraction-multiply.css','fraction-simplify.css','fraction-add-subtract.css'].map(name=>fs.readFileSync(path.join(root,name),'utf8')).join('\n');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const out=path.join(root,'test-results/fraction-add-subtract');fs.mkdirSync(out,{recursive:true});
const JACOB='c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
const errors=[];const reports=[];
function pass(text){reports.push(text);console.log('PASS',text);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined,args:['--no-sandbox']});
 async function open({width=1280,kind='jacob',full=false}={}) {
   const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width<900,isMobile:width<600});
   page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.abort());
   await page.setContent('<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app" class="app-shell"></main></body></html>');
   await page.addStyleTag({content:css});
   for(const content of scripts)await page.addScriptTag({content});
   if(full) {
     await page.evaluate(({id,kind})=>{
       const teacher={id,role:'teacher',username:'Jacob',name:'Jacob',results:[]};
       const student={id:'s1',role:'student',username:'test',name:'Testelev',classId:'c1',results:[]};
       const other={id:'other',role:'teacher',username:'other',name:'Anden lærer',results:[]};
       const own=kind==='jacob'?teacher:kind==='student'?student:other;
       const db={classes:[{id:'c1',name:'Testklasse'}],users:[teacher,student,other]};
       window.__profile=own;window.__writes=[];
       window.JacobBackend={configured:true,
         async loadDatabase(){return{database:JSON.parse(JSON.stringify(db)),currentUserId:own.id}},
         async loadSchoolState(){return JSON.parse(JSON.stringify(db))},async loadResults(){return[]},
         async saveSchoolState(data,id){window.__writes.push({id,role:data.users.find(u=>u.id===id)?.role})},
         async appendResult(){throw Error('Unexpected student result write')},async signOut(){window.__profile=null}
       };
     },{id:JACOB,kind});
     await page.addScriptTag({content:app});await page.waitForSelector('.topbar');
   } else await page.evaluate(({id,kind})=>{
     const user=kind==='jacob'?{id,role:'teacher'}:{id:'other',role:'student',name:'Jacob'};
     window.cleanup=JacobFractionLesson.mount(document.querySelector('#app'),{user,onExit:()=>{window.cleanup();document.querySelector('#app').textContent='Afsluttet';}});
   },{id:JACOB,kind});
   return page;
 }
 async function noOverflow(page) {
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   for(const input of await page.locator('[data-fa-answer]').all()) {
     const box=await input.boundingBox();const eq=await input.locator('xpath=ancestor::*[contains(@class,"fa-equation")]').boundingBox();
     assert.ok(box.x>=eq.x-1 && box.x+box.width<=eq.x+eq.width+1);
   }
 }
 async function toFinish(page,op,{wrong=false,capture=''}={}) {
   const terms=await page.locator('.fl-expression .fl-numerator,.fl-expression .fl-denominator').allTextContents();
   const [a,b,c,d]=terms.map(Number),p={a,b,c,d,op},q=api.plan(p);
   if(wrong) {await page.locator(`[data-fa-operation="${op==='+'?'-':'+'}"]`).click();assert.equal(await page.locator('[data-fa-phase="operation"]').count(),1);}
   await page.locator(`[data-fa-operation="${op}"]`).click();await page.waitForSelector('[data-fa-phase="rule"]');
   if(op==='+') assert.equal(await page.locator('#fl-question').innerText(),'Hvordan lægger man to brøker sammen?');
   else assert.equal(await page.locator('#fl-question').innerText(),'Hvordan trækker man en brøk fra en anden?');
   if(wrong)for(const value of ['both','keep']) {
     await page.locator(`[data-fa-rule="${value}"]`).click();assert.equal(await page.locator('[data-fa-phase="rule"]').count(),1);
   }
   await page.locator('[data-fa-rule="common"]').click();
   for(let i=0;i<2;i++) {
     if(q.factors[i]===1)continue;
     const n=i===0?a:c,den=i===0?b:d,k=q.factors[i];
     await page.waitForSelector('[data-fa-phase="method"]');
     assert.match(await page.locator('#fl-question').innerText(),i===0 ? /første/:/anden/);
     if(wrong) {await page.locator('[data-fa-method="reduce"]').click();assert.equal(await page.locator('[data-fa-phase="method"]').count(),1);}
     await page.locator('[data-fa-method="extend"]').click();
     if(wrong) {await page.locator(`[data-fa-factor="${k===2?3:2}"]`).click();assert.equal(await page.locator('[data-fa-phase="factor"]').count(),1);}
     await page.locator(`[data-fa-factor="${k}"]`).click();
     if(wrong)for(const rule of ['addTop','addBoth']) {
       await page.locator(`[data-fa-extension-rule="${rule}"]`).click();assert.equal(await page.locator('[data-fa-phase="extensionRule"]').count(),1);
     }
     await page.locator('[data-fa-extension-rule="multiplyBoth"]').click();
     assert.equal(await page.locator('[data-fa-answer="numerator"]').inputValue(),'');
     assert.equal(await page.locator('[data-fa-answer="denominator"]').inputValue(),'');
     assert.deepEqual(await page.locator('.fa-term small').allTextContents(),[`· ${k}`,`· ${k}`]);
     await noOverflow(page);
     if(capture)await page.screenshot({path:path.join(out,`${capture}-extend-${i}.png`),fullPage:true});
     if(wrong) {
       await page.locator('[data-fa-check]').click();assert.equal(await page.locator('[data-fa-phase="extensionAnswer"]').count(),1);
       await page.locator('[data-fa-answer="numerator"]').fill(String(n));await page.locator('[data-fa-answer="denominator"]').fill(String(den));
       await page.locator('[data-fa-check]').click();assert.match(await page.locator('#fl-feedback').innerText(),/samme værdi/);
       for(const value of ['0','-1','2.5','1e2','<b>']) {
         await page.locator('[data-fa-answer="denominator"]').fill(value);await page.locator('[data-fa-check]').click();
         assert.equal(await page.locator('[data-fa-phase="extensionAnswer"]').count(),1);
       }
     }
     await page.locator('[data-fa-answer="numerator"]').fill(String(n*k));
     await page.locator('[data-fa-answer="numerator"]').press('Enter');
     assert.equal(await page.evaluate(()=>document.activeElement.dataset.faAnswer),'denominator');
     await page.locator('[data-fa-answer="denominator"]').fill(String(den*k));
     await page.locator('[data-fa-answer="denominator"]').press('Enter');
   }
   await page.waitForSelector('[data-fa-phase="combine"]');
   assert.equal(await page.locator('[data-fa-answer]').count(),1);
   assert.equal(await page.locator('.fa-kept-denominator').innerText(),String(q.denominator));
   await noOverflow(page);
   if(capture)await page.screenshot({path:path.join(out,`${capture}-combine.png`),fullPage:true});
   if(wrong) {
     await page.locator('[data-fa-answer="numerator"]').fill('0');await page.locator('[data-fa-check]').click();
     assert.equal(await page.locator('[data-fa-phase="combine"]').count(),1);
   }
   await page.locator('[data-fa-answer="numerator"]').fill(String(q.numerator));
   await page.locator('[data-fa-check]').evaluate(el=>{for(let i=0;i<30;i++)el.click();});
   assert.equal(await page.locator('[data-ff-stage="assess"]').count(),1);
   assert.equal(await page.locator('.ff-equation .fl-numerator').innerText(),String(q.numerator));
   assert.equal(await page.locator('.ff-equation .fl-denominator').innerText(),String(q.denominator));
   return q;
 }
 try {
   for(const op of ['+','-']) {
     const page=await open();await page.locator(`[data-fa-mode="${op==='+'?'plus':'minus'}"]`).click();
     await toFinish(page,op,{wrong:true,capture:op==='+'?'desktop-plus':'desktop-minus'});
     assert.equal(await page.locator('.fl-count').innerText(),'0 gennemført');
     await completeFinish(page,op==='+'?'yes':'no');
     assert.match(await page.locator('#fl-question').innerText(),op==='+'?/FLOT! Du cooker/:/JO, champ!/);
     assert.equal(await page.locator('.fl-count').innerText(),'1 gennemført');
     for(const target of (op==='+'?[{a:1,b:6,c:1,d:4},{a:3,b:4,c:1,d:6}]:[{a:1,b:4,c:1,d:6}])) {
       const nextIndex=Number((await page.locator('.fl-count').innerText()).split(' ')[0]);
       let r;
       for(let j=0;j<10000;j++){const candidate=(j+.5)/10000,x=api.createProblem(op,nextIndex,()=>candidate);if(['a','b','c','d'].every(k=>x[k]===target[k])){r=candidate;break;}}
       assert.notEqual(r,undefined);await page.evaluate(r=>{Math.random=()=>r;},r);
       await page.waitForTimeout(650);await page.locator('[data-fa-next]').click();
       const q=await toFinish(page,op);assert.ok(q.factors.every(k=>k>1));
       await completeFinish(page);assert.equal(await page.locator('.fl-count').innerText(),`${nextIndex+1} gennemført`);
     }
     await page.close();
   }
   pass('Full plus/minus flows: exact rule choices, wrong answers, both extensions, kept denominator, empty fields, Enter, mixed values >1, shared finish and one-time scoring.');
   for(const width of [320,390,768])for(const op of ['+','-']) {
     const page=await open({width});await page.locator(`[data-fa-mode="${op==='+'?'plus':'minus'}"]`).tap();
     await toFinish(page,op,{capture:`${op==='+'?'plus':'minus'}-${width}`});await completeFinish(page);await noOverflow(page);
     await page.screenshot({path:path.join(out,`${op==='+'?'plus':'minus'}-${width}-done.png`),fullPage:true});
     await page.close();
   }
   pass('Plus and minus at 320/390/768px with touch mode switching, visible fractional inputs and no horizontal overflow.');
   const full=await open({full:true});await full.locator('[data-action="learn-fractions"]').click();
   await full.locator('[data-fa-mode="plus"]').click();await full.locator('[data-fa-operation="+"]').click();
   await full.locator('[data-fa-mode="minus"]').click();await full.waitForTimeout(1000);
   assert.equal(await full.locator('[data-fa-phase="operation"]').count(),1);assert.match(await full.locator('#fl-title').innerText(),/minus/);
   await toFinish(full,'-');await full.locator('[data-action="toggle-jacob-view"]').click();await full.waitForSelector('.teacher-layout');
   assert.equal(await full.locator('.fa-page').count(),0);assert.equal(await full.evaluate(()=>window.__profile.role),'teacher');
   assert.ok(await full.evaluate(()=>window.__writes.every(w=>w.role==='teacher')));
   await full.locator('[data-action="learn-fractions"]').click();await full.locator('[data-fa-mode="plus"]').click();
   await full.locator('[data-fa-exit]').click();await full.waitForSelector('.student-home-layout');
   await full.close();
   pass('Actual app entry and teacher toggle work; mode switches cancel pending timers; exit and backend switch preserve teacher role without student writes.');
   for(const kind of ['student','other']) {
     const page=await open({kind,full:true});
     await page.locator('[data-action="learn-fractions"]').click();
     for(const mode of ['plus','minus','mixed']) {
       await page.locator(`[data-fa-mode="${mode}"]`).click();
       assert.equal(await page.locator('[data-fa-mode][aria-pressed="true"]').getAttribute('data-fa-mode'),mode);
       assert.equal(await page.locator('.fl-page').count(),1);
       assert.equal(await page.locator('.fl-pilot').count(),0);
     }
     await page.close();
   }
   pass('Students and other teachers can open addition, subtraction and mixed lessons without a test badge.');
   assert.deepEqual(errors,[]);pass('No uncaught browser errors.');
   fs.writeFileSync(path.join(out,'summary.txt'),reports.join('\n')+'\n');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
