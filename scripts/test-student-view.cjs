const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('student-view.js', 'utf8');
const id = 'c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
const session = new Map(), local = new Map();
const storage = map => ({ getItem:key=>map.get(key)||null, setItem:(key,value)=>map.set(key,value), removeItem:key=>map.delete(key) });
function boot() {
 const root={sessionStorage:storage(session),localStorage:storage(local),document:{body:null,addEventListener(){}},addEventListener(){},setInterval(){}};
 vm.runInNewContext(source,{window:root});return root.JacobStudentView;
}
let view=boot();
const jacob={id,role:'teacher',results:[]}, pupil={id:'pupil',role:'student',results:[{correct:true}]};
const pupilBefore=JSON.stringify(pupil);
view.bind(jacob);view.set(true);
assert.equal(view.active(),true);
assert.equal(jacob.role,'teacher');assert.equal(jacob.id,id);
jacob.results.push({topic:'addition',correct:true});view.save();
assert.equal(JSON.parse(local.get('jm-student-view-results:'+id)).length,1);
view=boot();assert.equal(view.active(),false,'Stored presentation flag is not identity');
const reloaded={id,role:'teacher',results:[]};view.bind(reloaded);
assert.equal(view.active(),true);assert.equal(reloaded.results.length,1);
view.bind(reloaded);assert.equal(reloaded.results.length,1,'Binding twice does not duplicate progress');
view.set(false);assert.equal(view.active(),false);assert.equal(session.has('jm-student-view'),false);
view.bind(pupil);view.set(true);assert.equal(view.active(),false);assert.equal(JSON.stringify(pupil),pupilBefore);
view.bind({id:'another-teacher',role:'teacher',results:[]});view.set(true);assert.equal(view.active(),false);
view.bind({id,role:'student',results:[]});view.set(true);assert.equal(view.active(),false);
console.log('Student view persistence, identity isolation, reload and exit checks passed');
