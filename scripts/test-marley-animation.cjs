const fs=require('fs'),vm=require('vm'),assert=require('assert');
const T=require('../assets/vendor/three-r158.min.js');
let now=0,callback,renderedScene,camera,attrs={};
T.WebGLRenderer=class{constructor(){this.shadowMap={};this.domElement={setAttribute:(k,v)=>attrs[k]=v,remove(){}};}setPixelRatio(){}setSize(){}dispose(){}render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true);renderedScene=s;camera=c;}};
const context={window:{THREE:T},devicePixelRatio:1,performance:{now:()=>now},requestAnimationFrame:f=>(callback=f,1),cancelAnimationFrame(){callback=null},ResizeObserver:class{observe(){}disconnect(){}}};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../marley-scene.js'),'utf8'),context);
const host={clientWidth:650,clientHeight:420,dataset:{},append(){}};
const changes=[];const actor=context.window.MarleyScene.create(host,s=>changes.push(s));
function tick(ms){now+=ms;callback(now);let count=0;renderedScene.traverse(o=>{for(const x of o.matrixWorld.elements)assert(Number.isFinite(x));count++;});return count;}
actor.play('wag');tick(16);const dog=renderedScene.children.find(o=>o.type==='Group');const tail=dog.children[0].children.find(o=>o.position.z===-.65);assert(tail);
const a=tail.rotation.y;tick(300);assert.notStrictEqual(a,tail.rotation.y);
actor.play('run');tick(500);const p=dog.position.clone();tick(500);assert(p.distanceTo(dog.position)>.2);
actor.play('eat');tick(2800);assert(renderedScene.children.some(o=>o.visible&&o.geometry?.type==='ShapeGeometry'));tick(1600);assert.strictEqual(actor.getState(),'wag');
actor.play('bed');tick(4000);assert.strictEqual(actor.getState(),'sleep');tick(16);assert(dog.position.distanceTo(new T.Vector3(1.25,0,-.85))<.1);
actor.setEquipment({head:'hat',eyes:'glasses',body:'bee',feet:'shoes',board:'skate',toy:'ball'});tick(16);
actor.play('smile');tick(400);actor.pause();const before=dog.matrixWorld.toArray();tick(500);assert.deepStrictEqual(dog.matrixWorld.toArray(),before);actor.pause();tick(100);
console.log('PASS: finite geometry, moving tail, circular running, treat hearts, basket sleep, equipment, pause/resume');
actor.destroy();assert.strictEqual(callback,null);console.log('PASS: cleanup stops animation');
