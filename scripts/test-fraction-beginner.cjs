/* Exhaust every selectable problem, including unreduced intermediate results. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sandbox = {window:{}};
const load = file => {
  // Observe the private pool only in this test; no test API is shipped.
  const source = fs.readFileSync(path.join(root,file),'utf8');
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'window.testPool = PAIRS;})();'),sandbox);
  return sandbox.window.testPool;
};
const productPool = load('fraction-lesson.js');
const productAPI = sandbox.window.JacobFractionLesson;
const sumPool = load('fraction-add-subtract.js');
const sumAPI = sandbox.window.JacobFractionAddSubtract;
let checked=0;
function small(n) { assert.ok(Number.isInteger(n) && n>0 && n<=12, `Too difficult: ${n}`); }
function checkSum(p) {
  const q=sumAPI.plan(p);
  [p.a,p.b,p.c,p.d,q.denominator,q.numerator,...q.numerators].forEach(small);
  assert.ok(q.factors.every(f=>f>=1 && f<=3));
  assert.ok(p.a<=5 && p.c<=5);
  assert.ok(p.a<p.b && p.c<p.d);
  assert.ok([4,6,8,10,12].includes(q.denominator));
  assert.ok(p.op==='+' || p.a*p.d>p.c*p.b);
  checked++;
}
function checkProduct(p) {
  // Check BOTH multiplication and division before any cancellation can hide
  // large products from the pupil's actual answer-entry step.
  [p.a,p.b,p.c,p.d,p.a*p.c,p.b*p.d,p.a*p.d,p.b*p.c].forEach(small);
  assert.ok(p.a<p.b && p.c<p.d);
  assert.notEqual(p.a*p.d,p.c*p.b);
  checked++;
}
assert.ok(sumPool.length>10 && productPool.length>10,'Preserve problem variety');
for(const op of ['+','-']) {
  checkSum(sumAPI.createProblem(op,0));
  for(const index of [1,2,1001,1002]) for(let i=0;i<sumPool.length;i++) {
    checkSum(sumAPI.createProblem(op,index,()=>(i+.5)/sumPool.length));
  }
}
checkProduct(productAPI.createProblem(0));
for(const index of [1,2,1001,1002]) for(let i=0;i<productPool.length;i++) {
  const p=productAPI.createProblem(index,()=>(i+.5)/productPool.length);
  checkProduct(p);
  assert.equal(p.notation,index%2 ? 'colon':'stacked');
}
for(const r of [0,1-Number.EPSILON]) {
  for(const op of ['+','-'])checkSum(sumAPI.createProblem(op,1,()=>r));
  checkProduct(productAPI.createProblem(1,()=>r));
}
for(const bad of [-1,1,NaN,Infinity]) {
  assert.throws(()=>sumAPI.createProblem('+',1,()=>bad));
  assert.throws(()=>productAPI.createProblem(1,()=>bad));
}
// The reported 9/11 + 9/10 can no longer occur anywhere in the pool.
assert.ok(sumPool.every(([a,b,c,d])=>b!==11 && d!==11));
console.log(`PASS: all ${sumPool.length} plus/minus pairs and ${productPool.length} multiplication/division pairs; ${checked} checks including later rounds. Common denominators and all intermediate terms <=12, extension factors <=3.`);
