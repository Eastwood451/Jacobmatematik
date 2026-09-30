const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = new Map();
const calls = [];
let actor = {id:'self-a',role:'student',self_registered:true,local_results_only:true};
const storage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
const client = {
 auth:{getUser:async()=>({data:{user:{id:actor.id}}}),signInWithPassword:async()=>({}),signOut:async()=>({}),signUp:async opts=>{calls.push(['signup',opts]);return {data:{user:{id:actor.id},session:{}}};}},
 rpc:async(name)=>{calls.push(['rpc',name]);return {data:name==='self_registration_enabled'?true:{classes:[],users:[{...actor,selfRegistered:true}]}};},
 from(name){calls.push(['from',name]);let result={data:name==='profiles'?{...actor}:name==='results'?[]:{data:{classes:[],users:[{...actor}]}}};const q={select(){return q;},eq(){return q;},single(){return Promise.resolve(result);},order(){return q;},range(){return Promise.resolve(result);},insert(row){calls.push(['insert',name,row]);result={data:{id:'remote-1'}};return q;}};return q;}
};
const context={window:{JACOBMATEMATIK_SUPABASE:{url:'https://test.invalid',publishableKey:'public'},supabase:{createClient:()=>client}},localStorage:storage,crypto:require('node:crypto').webcrypto,TextEncoder,console};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../supabase-backend.js'),'utf8'),context);
const b=context.window.JacobBackend;
(async()=>{
 let loaded=await b.loadDatabase();
 assert.equal(loaded.database.users[0].resultStorage,'local');
 assert(!calls.some(c=>c[0]==='from'&&c[1]==='results'),'self must not read remote results');
 await assert.rejects(b.appendResult(actor.id,{problem:'2+3'}),/samtykke/);
 await assert.rejects(b.signUp('test','secret1',false),/samtykke/);
 assert(!calls.some(c=>c[0]==='signup'));
 b.grantLocalConsent();
 const result={problem:'2+3',correct:true,timestamp:'2026-09-30',topic:'addition'};
 assert.equal(await b.appendResult(actor.id,result),null);
 b.saveLocalFpsScore(12);
 assert.equal(b.readLocalProgress().results.length,1);
 assert.equal(b.readLocalProgress().fpsBest,12);
 assert(!calls.some(c=>c[0]==='insert'),'self must never insert server results');
 loaded=await b.loadDatabase(); assert.equal(loaded.database.users[0].results.length,1);
 actor={id:'self-b',role:'student',self_registered:true,local_results_only:true}; await b.loadDatabase(); b.grantLocalConsent();
 assert.equal(b.readLocalProgress().results.length,0,'separate students on shared device');
 await b.appendResult(actor.id,{problem:'1+1'});
 actor={id:'self-a',role:'student',self_registered:true,local_results_only:true};await b.loadDatabase(); b.clearLocalProgress();
 assert.equal(b.readLocalProgress().results.length,0);assert.equal(b.readLocalProgress().fpsBest,0);
 assert.equal(JSON.parse(data.get('jm-local-progress-v1:self-b')).results.length,1);
 actor={id:'teacher-created',role:'student',self_registered:false,local_results_only:false,teacher_id:'teacher'};
 loaded=await b.loadDatabase();assert.equal(loaded.database.users[0].resultStorage,'server');
 assert.equal(await b.appendResult(actor.id,result),'remote-1');
 assert(calls.some(c=>c[0]==='insert'&&c[2].student_id===actor.id));
 await assert.rejects(b.appendResult('different-user',result));
 actor={id:'existing-class-student',role:'student',self_registered:true,local_results_only:false,teacher_id:'teacher'};
 loaded=await b.loadDatabase();assert.equal(loaded.database.users[0].resultStorage,'server');
 assert.equal(await b.getResultStorageForSession(),'server');
 assert.equal(await b.appendResult(actor.id,result),'remote-1');
 actor={id:'unknown',role:'student'};await b.loadDatabase();await assert.rejects(b.appendResult(actor.id,result));
 actor={id:'self-c',role:'student',self_registered:true,local_results_only:true};await b.signUp('self-c','secret1',true);await b.loadDatabase();
 assert(b.hasLocalConsent());assert.equal(calls.find(c=>c[0]==='signup')[1].options.data.local_results_consent,'2026-09-30');
 console.log('PASS: consent, no remote self results, reload, account isolation, FPS, deletion, and teacher-created writes.');
})().catch(e=>{console.error(e);process.exitCode=1});

