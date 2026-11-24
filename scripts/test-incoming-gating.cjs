'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

/* Incoming! er åbent for alle, der kan spille de andre spil, når INCOMING_PUBLIC er true.
   Gæster følger gameModuleEnabled (som skak og Brøk-løb). Flaget kan sættes til false igen,
   så kun Jacobs to profiler (ikke gæst, ikke «Se som elev») har adgang. */
const app=fs.readFileSync('app.js','utf8');
const enabled=app.match(/const gameModuleEnabled = [^\n]+/)[0];
const idsLine=app.match(/const ANGLES_PROFILE_IDS = [^\n]+/)[0];
const angleIds=idsLine.match(/new Set\((\[[^\]]+\])\)/)[1];
const gate=app.match(/const INCOMING_PUBLIC = [^\n]+\n\s*const canPlayIncoming = [^\n]+/)[0];
assert.match(gate, /const INCOMING_PUBLIC = true/);
assert.ok(idsLine.includes(angleIds), "profil-id'erne er bevaret, så flaget kan lukke igen");
const gateSrc=`${idsLine}\n${enabled}\n${gate}`;
const gateFn=vm.runInNewContext(`(state => { const isStudentView = () => false; ${gateSrc}; return canPlayIncoming; })`, {});
const can=user=>gateFn({user})();
assert.equal(can({id:'c8b8e1c4-3264-40e9-a43d-0eb6214a0183',role:'teacher'}),true);
assert.equal(can({id:'3af639de-b0e0-496a-a5b7-b732e49d1fa7',role:'student'}),true);
assert.equal(can({id:'ordinary-student',role:'student'}),true,'almindelig elev');
assert.equal(can({id:'another-teacher',role:'teacher'}),true,'almindelig lærer');
assert.equal(can({id:'guest-1',role:'guest'}),true,'gæst kan spille som de andre spil');
assert.equal(can({id:'c8b8e1c4-3264-40e9-a43d-0eb6214a0183',role:'guest'}),true,'gæst-rolle');
assert.equal(can({id:'admin-1',role:'admin'}),false,'admin er ikke en spilrolle');
assert.equal(can({role:'student'}),false,'elev uden id');
assert.equal(can(null),false,'ikke logget ind');
const closedFn=vm.runInNewContext(`((state, preview=false) => { const isStudentView = () => preview; ${idsLine}\n${enabled}\n${gate.replace('const INCOMING_PUBLIC = true','const INCOMING_PUBLIC = false')}; return canPlayIncoming; })`, {});
const closedCan=(user,preview=false)=>closedFn({user},preview)();
assert.equal(closedCan({id:'c8b8e1c4-3264-40e9-a43d-0eb6214a0183',role:'teacher'}),true,'flaget kan lukke til Jacob igen');
assert.equal(closedCan({id:'3af639de-b0e0-496a-a5b7-b732e49d1fa7',role:'student'}),true,'flaget kan lukke til Jacob igen');
assert.equal(closedCan({id:'ordinary-student',role:'student'}),false,'lukket flag skjuler andre elever');
assert.equal(closedCan({id:'another-teacher',role:'teacher'}),false,'lukket flag skjuler andre lærere');
assert.equal(closedCan({id:'guest-1',role:'guest'}),false,'lukket flag følger den gamle profil-gate');
assert.equal(closedCan({id:'c8b8e1c4-3264-40e9-a43d-0eb6214a0183',role:'teacher'},true),false,'lukket flag skjuler Se som elev');
assert.match(app,/return canPlayIncoming\(\) \? `<button[^`]*data-action="incoming"/,'kortet er gated');
assert.match(app,/if \(!canPlayIncoming\(\)\) \{ state\.view=/,'renderIncoming er gated');
assert.match(app,/action === "incoming" \? canPlayIncoming/,'action er gated');
assert.match(app,/incoming:'\[data-action="incoming"\]'/,'?start=incoming bruger samme action som kortet');
assert.match(app,/anglesCard\(\) \+ incomingCard\(\) \+ runnerCard\(\)/,'kortet ligger ved Vinkler i Andre genveje');

const listeners=new Map(),element={innerHTML:'',querySelector(){return null;}};
const document={body:{classList:{toggle(){},add(){},remove(){}}},getElementById(){return element;},addEventListener(type,fn){listeners.set(type,fn);},querySelector(){return null;},querySelectorAll(){return [];},documentElement:{lang:'da'}};
let preview=false,mounts=0,disposes=0;
const window={JacobBackend:{configured:false},JacobStudentView:{active:()=>preview,bind(){}},addEventListener(){},JacobIncoming:{mount(){mounts++;return ()=>disposes++;}},JacobIncomingCore:{},THREE:{}};
const source=app.replace(/  start\(\);\s*\}\)\(\);/,'  window.__incomingTest={state,canPlayIncoming,incomingCard,renderIncoming,leaveIncoming,moduleApiReady};\n})();');
assert.ok(source.includes('window.__incomingTest='));
vm.runInNewContext(source,{window,document,console,localStorage:{getItem(){return null;}},sessionStorage:{getItem(){return null;}},location:{search:''},URLSearchParams,setTimeout,clearTimeout,performance:{now:()=>0}});
const t=window.__incomingTest;
function user(id,role){t.state.user=id?{id,role,name:'Test',results:[],assignedLetters:[],assignedTables:[],assignedNumbers:[],assignedAddends:[],assignedAddendSeconds:[]}:null;t.state.view='incoming';}
(async()=>{
 for(const [id,role,allowed] of [
  ['c8b8e1c4-3264-40e9-a43d-0eb6214a0183','teacher',true],
  ['3af639de-b0e0-496a-a5b7-b732e49d1fa7','student',true],
  ['ordinary-student','student',true],['another-teacher','teacher',true],['guest','guest',true],
  ['c8b8e1c4-3264-40e9-a43d-0eb6214a0183','guest',true],['admin-1','admin',false],[null,null,false]
 ]){user(id,role);assert.equal(t.canPlayIncoming(),allowed);assert.equal(t.incomingCard().includes('data-action="incoming"'),allowed);}
 user('c8b8e1c4-3264-40e9-a43d-0eb6214a0183','teacher');preview=true;assert.equal(t.canPlayIncoming(),true,'offentligt flag vises også i Se som elev');assert.equal(t.incomingCard().includes('data-action="incoming"'),true);preview=false;
 assert.equal(t.moduleApiReady('incoming'),true);
 await t.renderIncoming();assert.equal(mounts,1);t.leaveIncoming();assert.equal(disposes,1);
 const loading=t.renderIncoming();user(null,null);await loading;assert.equal(mounts,1,'changing identity during module loading must prevent mounting');
 user('c8b8e1c4-3264-40e9-a43d-0eb6214a0183','teacher');const entering=t.renderIncoming();user('admin-1','admin');await entering;assert.equal(mounts,1,'losing access while loading must prevent mounting');
 assert.equal(fs.readFileSync('incoming.js','utf8').includes("fire:'Fyr!'"),true);
 for(let i=1;i<=8;i++)assert.ok(fs.statSync(`assets/incoming/audio/captain-${i}.mp3`).size>1000,`Danish one-liner ${i} exists`);
 console.log('PASS Incoming gating: public for elev, lærer og gæst, flaget kan lukkes, identitet tjekkes efter indlæsning, teardown og otte lydfiler.');
})().catch(e=>{console.error(e);process.exitCode=1;});
