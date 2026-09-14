const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'foodtruck.js'),'utf8');
function setup(){
 const dom=new JSDOM('<div id="root"></div>',{runScripts:'outside-only',url:'https://example.test'});
 const w=dom.window, timers=new Map();let tid=0;
 w.matchMedia=()=>({matches:true});w.setTimeout=fn=>{timers.set(++tid,fn);return tid;};w.clearTimeout=id=>timers.delete(id);
 w.eval(source);const node=w.document.querySelector('#root'),dispose=w.LuigiFoodtruck.mount(node);
 return {w,node,dispose,timers,flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}},q:s=>node.querySelector(s),submit(value){node.querySelector('input').value=value;node.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}};
}
test('exact fractions, equivalent fractions, integers and invalid input',()=>{
 const t=setup(),f=t.w.LuigiFoodtruck.answerMatches;
 for(const v of ['3/5','6/10',' 9 / 15 '])assert.equal(f(v,3,5),true);
 for(const v of ['5/3','3/0','0/0','0.6','3/5/1','3e0/5','-3/-5','<script>','99999/1',''])assert.equal(f(v,3,5),false,v);
 assert.equal(f('1',5,5),true);assert.equal(f('1',3,5),false);assert.equal(f('3/2',9,6),true);t.dispose();
});
test('first order follows the tomato example; later orders vary and include improper fractions',()=>{
 const t=setup(),game=t.w.LuigiFoodtruck;const first=game.createOrder(0);
 assert.equal(first.guests,5);assert.equal(first.steps[0].amount,3);assert.equal(first.steps[0].id,'tomato');
 for(let i=0;i<20;i++){const order=game.createOrder(i);assert.equal(order.steps.length,5);for(const item of order.steps)assert.ok(game.answerMatches(`${item.amount}/${order.guests}`,item.amount,order.guests));}
 assert.equal(game.fraction(9,6),'3/2');assert.equal(game.fraction(5,5),'1');t.dispose();
});
test('wrong answers do not add food; repeat submits cannot skip ingredients; all five complete the burger',()=>{
 const t=setup();t.submit('5/3');assert.equal(t.q('#ft-layer-count').textContent,'0 / 5 lag');assert.equal(t.q('input').getAttribute('aria-invalid'),'true');
 for(const [i,value] of ['6/10','1/5','1','2/5','2/5'].entries()){
  t.submit(value);for(let j=0;j<10;j++)t.submit(value);
  assert.equal(t.q('#ft-layer-count').textContent,`${i+1} / 5 lag`);assert.ok(t.q('input').disabled);t.flush();
 }
 assert.match(t.q('#ft-task').textContent,/Buon appetito/);assert.equal(t.q('.ft-burger').getAttribute('aria-label'),'Færdig burger');
 t.q('[data-ft-next]').click();assert.equal(t.q('#ft-served').textContent,'1');assert.equal(t.q('#ft-guests').textContent,'6 BURGERE');assert.equal(t.q('#ft-layer-count').textContent,'0 / 5 lag');t.dispose();
});
test('touch keypad inserts fractions, replaces selected errors, and deletes; cleanup cancels transitions',()=>{
 const t=setup();for(const key of ['3','/','5'])t.q(`[data-ft-key="${key}"]`).click();assert.equal(t.q('input').value,'3/5');
 t.q('[data-ft-key="⌫"]').click();assert.equal(t.q('input').value,'3/');t.q('input').select();t.q('[data-ft-key="6"]').click();assert.equal(t.q('input').value,'6');
 t.submit('3/5');assert.equal(t.timers.size,1);t.dispose();assert.equal(t.timers.size,0);t.flush();assert.equal(t.q('#ft-layer-count').textContent,'1 / 5 lag');
});
test('signed-in student and teacher can enter and return; login and guest have no foodtruck link',async()=>{
 const dom=new JSDOM('<main id="app"></main>',{runScripts:'outside-only',url:'https://example.test'}),w=dom.window;
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.eval(source);
 let appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
 // Expose state only in this local test fixture; production authentication is unchanged.
 appSource=appSource.replace('  start();','  window.testApp={state,render,renderStudentHome,renderLogin}; start();');
 w.eval(appSource);const a=w.testApp;
 assert.equal(w.document.querySelector('[data-action="foodtruck"]'),null);
 for(const role of ['student','teacher']){
  a.state.user={id:'test',name:'Test',role,results:[],assignedTables:[]};a.state.view='student';a.renderStudentHome();
  assert.ok(w.document.querySelector('[data-action="foodtruck"]'));w.document.querySelector('[data-action="foodtruck"]').click();
  assert.ok(w.document.querySelector('#ft-answer'));assert.ok(w.document.body.classList.contains('foodtruck-active'));
  w.document.querySelector('[data-action="foodtruck-home"]').click();assert.equal(a.state.view,role==='teacher'?'teacher':'student');assert.equal(w.document.querySelector('#ft-answer'),null);assert.equal(w.document.body.classList.contains('foodtruck-active'),false);
  a.state.user=null;a.renderLogin();assert.equal(w.document.querySelector('[data-action="foodtruck"]'),null);assert.equal(w.document.body.classList.contains('foodtruck-active'),false);
 }
 a.state.user={id:'guest',name:'Gæst',role:'guest',results:[]};a.state.view='student';a.renderStudentHome();
 assert.equal(w.document.querySelector('[data-action="foodtruck"]'),null);
 dom.window.close();
});
