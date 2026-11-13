'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const listeners=new Map(),element={innerHTML:'',querySelector(){return null;}};
const document={body:{classList:{toggle(){},add(){},remove(){}}},getElementById(){return element;},addEventListener(type,fn){listeners.set(type,fn);},querySelector(){return null;},querySelectorAll(){return [];},documentElement:{lang:'da'}};
let preview=false,mounts=0,disposes=0;
const window={JacobBackend:{configured:false},JacobStudentView:{active:()=>preview,bind(){}},addEventListener(){},JacobIncoming:{mount(){mounts++;return ()=>disposes++;}},JacobIncomingCore:{},THREE:{}};
const source=fs.readFileSync('app.js','utf8').replace(/  start\(\);\s*\}\)\(\);/,'  window.__incomingTest={state,canPlayIncoming,incomingCard,renderIncoming,leaveIncoming,moduleApiReady};\n})();');
assert.ok(source.includes('window.__incomingTest='));
vm.runInNewContext(source,{window,document,console,localStorage:{getItem(){return null;}},sessionStorage:{getItem(){return null;}},location:{search:''},URLSearchParams,setTimeout,clearTimeout,performance:{now:()=>0}});
const t=window.__incomingTest;
function user(id,role){t.state.user=id?{id,role,name:'Test',results:[],assignedLetters:[],assignedTables:[],assignedNumbers:[],assignedAddends:[],assignedAddendSeconds:[]}:null;t.state.view='incoming';}
(async()=>{
 for(const [id,role,allowed] of [
  ['c8b8e1c4-3264-40e9-a43d-0eb6214a0183','teacher',true],
  ['3af639de-b0e0-496a-a5b7-b732e49d1fa7','student',true],
  ['ordinary-student','student',false],['another-teacher','teacher',false],['guest','guest',false],
  ['c8b8e1c4-3264-40e9-a43d-0eb6214a0183','guest',false],[null,null,false]
 ]){user(id,role);assert.equal(t.canPlayIncoming(),allowed);assert.equal(t.incomingCard().includes('data-action="incoming"'),allowed);}
 user('c8b8e1c4-3264-40e9-a43d-0eb6214a0183','teacher');preview=true;assert.equal(t.canPlayIncoming(),false);assert.equal(t.incomingCard(),'');preview=false;
 assert.equal(t.moduleApiReady('incoming'),true);
 await t.renderIncoming();assert.equal(mounts,1);t.leaveIncoming();assert.equal(disposes,1);
 const loading=t.renderIncoming();user('ordinary-student','student');await loading;assert.equal(mounts,1,'changing identity during module loading must prevent mounting');
 user('c8b8e1c4-3264-40e9-a43d-0eb6214a0183','teacher');const entering=t.renderIncoming();preview=true;await entering;assert.equal(mounts,1,'student preview activated while loading must prevent mounting');
 assert.equal(fs.readFileSync('incoming.js','utf8').includes("fire:'Affyr klogskab!'"),true);
 for(let i=1;i<=8;i++)assert.ok(fs.statSync(`assets/incoming/audio/captain-${i}.mp3`).size>1000,`Danish one-liner ${i} exists`);
 console.log('PASS Incoming gating: both Jacob profiles, all other roles blocked, student preview hidden, identity rechecked after loading, teardown and eight audio files.');
})().catch(e=>{console.error(e);process.exitCode=1;});
