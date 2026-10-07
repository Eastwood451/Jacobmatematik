const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const saved=new Map([['test',JSON.stringify({coins:100,owned:[],equipped:{},correct:0,lastEatAt:Date.now()})]]);
let callback,mode='wag',paused=false,equipment,plays=[];
const scene={play(n){mode=n==='roam'?'wag':n==='outfit'?'smile':n;plays.push(mode);callback(mode)},getState:()=>mode,pause(v){paused=v},isPaused:()=>paused,setEquipment(v){equipment={...v}},destroy(){}};
const nodes=new Map();
function node(){return {dataset:{},textContent:'',innerHTML:'',value:'',focus(){},setAttribute(){},remove(){}}}
const root={innerHTML:'',handlers:{},contains:()=>true,querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},querySelectorAll:()=>[],addEventListener(n,f){this.handlers[n]=f},removeEventListener(n){delete this.handlers[n]}};
const context={window:{MarleyWardrobe:{},MarleyCartoonScene:{async create(h,c){callback=c;return scene}}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},document:{},console};
vm.runInNewContext(fs.readFileSync('marley.js','utf8'),context);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function buy(id){const html=nodes.get('.marley-items').innerHTML;const match=html.match(new RegExp('<button[^>]*data-item="'+id+'"[^>]*>'));assert(match);const b={dataset:{marley:'buy',item:id},disabled:match[0].includes(' disabled')};root.handlers.click({target:{closest:()=>b}});}
const value=()=>JSON.parse(saved.get('test'));
(async()=>{
 const dispose=context.window.MarleyMath.mount(root,{onExit(){},storageKey:'test'});await flush();
 buy('treat');assert.equal(value().coins,97,'old 90-second timestamp must not prevent feeding');assert.equal(mode,'eat');
 buy('treat');assert.equal(value().coins,97,'double click while chewing must not charge again');
 mode='wag';callback(mode);buy('treat');assert.equal(value().coins,94,'next treat available immediately after chewing');
 mode='wag';callback(mode);buy('cap');assert.equal(value().coins,82);assert.equal(equipment.head,'cap');
 buy('cap');assert.equal(equipment.head,null);assert.equal(value().coins,82,'owned clothing toggles without charging');
 buy('cap');assert.equal(equipment.head,'cap');
 buy('bone');assert.equal(mode,'bone');assert.equal(equipment.toy,'bone');const coins=value().coins;
 mode='wag';callback(mode);buy('bone');assert.equal(mode,'bone');assert.equal(value().coins,coins,'owned toy can be played with repeatedly');
 buy('ball');assert.equal(mode,'ball');buy('skate');assert.equal(mode,'skate');
 assert.equal(value().owned.filter(x=>x==='bone').length,1);
 dispose();assert.equal(root.handlers.click,undefined);
 console.log('PASS: repeated treats, double-click protection, clothing on/off, persistent equipment and reusable toys.');
})().catch(e=>{console.error(e);process.exitCode=1});
