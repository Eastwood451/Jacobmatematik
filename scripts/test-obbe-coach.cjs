const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  let time = 20000, visible = true, observer, nextTimer = 0;
  const listeners = {}, timers = new Map(), clips = [], spoken = [], saved = new Map();
  const bubble = { textContent:'' }, toggle = { textContent:'', setAttribute(){} };
  const card = { classList:{ toggle(){}, remove(){} }, querySelector:s => s === '[data-obbe-bubble]' ? bubble : toggle };
  const document = { hidden:false, querySelectorAll:() => visible ? [card] : [], getElementById:() => ({}), addEventListener:(e,f) => listeners[e]=f };
  class Audio {
    constructor(url) { this.url=url; this.paused=true; clips.push(this); }
    play() { this.paused=false; return Promise.resolve(); }
    pause() { this.paused=true; }
  }
  const window = { addEventListener(){}, speechSynthesis:{ cancel(){}, getVoices:() => [], speak:s => spoken.push(s) }, SpeechSynthesisUtterance:class {} };
  const env = { window, document, Audio, SpeechSynthesisUtterance:window.SpeechSynthesisUtterance,
    Date:{now:() => time}, Math, localStorage:{getItem:k => saved.get(k), setItem:(k,v) => saved.set(k,v)},
    setTimeout:f => {timers.set(++nextTimer,f);return nextTimer;}, clearTimeout:id => timers.delete(id),
    MutationObserver:class { constructor(f){observer=f;} observe(){} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'obbe-coach.js'),'utf8'),env);
  const coach = window.ObbeCoach;
  const flush = async () => { for(const [id,f] of [...timers]) {timers.delete(id);f();} await Promise.resolve(); };
  const click = selector => listeners.click({target:{closest:s => s === selector ? card : null}});
  const drill = {sessionId:'table',currentIndex:0,pairs:Array(81),completedAt:null};
  coach.onDrill(drill); await flush();
  assert.match(clips.at(-1).url,/obbe-kom-nuuu/);
  coach.onDrill(drill); await flush(); assert.equal(clips.length,1,'rerender must not replay');
  drill.currentIndex=10; time+=13000; coach.onDrill(drill); await flush();
  assert.equal(clips.length,2); assert.notEqual(clips[0].url,clips[1].url);
  drill.currentIndex=20; time+=1000; coach.onDrill(drill); await flush(); assert.equal(clips.length,2,'throttle rapid answers');
  click('[data-obbe-mute]'); assert.equal(clips.at(-1).paused,true); assert.equal(saved.get('jacobmatematik-obbe-muted'),'true');
  click('[data-obbe-shout]'); await flush(); assert.equal(clips.length,2,'mute keeps bubbles but prevents audio');
  click('[data-obbe-mute]');
  for(let i=0;i<15;i++) { const before=bubble.textContent; click('[data-obbe-shout]'); await flush(); assert.notEqual(bubble.textContent,before); }
  drill.completedAt=time; coach.onDrill(drill); await flush(); assert.match(clips.at(-1).url,/gennemfoert/);
  const completedCount=clips.length; coach.onDrill(drill); await flush(); assert.equal(clips.length,completedCount);
  coach.onDrill({...drill,sessionId:'division',completedAt:null,currentIndex:0,troubleRound:true}); await flush();
  assert.match(clips.at(-1).url,/obbe-igen/);
  click('[data-obbe-shout]'); visible=false; observer(); await flush(); assert.equal(clips.at(-1).paused,true,'navigation cancels speech');
  visible=true; click('[data-obbe-shout]'); await flush(); document.hidden=true; listeners.visibilitychange(); assert.equal(clips.at(-1).paused,true);
  document.hidden=false;
  Audio.prototype.play = () => Promise.reject(new Error('unsupported audio'));
  click('[data-obbe-shout]'); await flush(); await Promise.resolve(); assert.equal(spoken.length,1,'speech fallback');
  assert.match(coach.render(true),/Øbbe Øvdig/);
  for(const clip of clips) assert.ok(fs.existsSync(path.join(root,clip.url)),`missing ${clip.url}`);
  console.log('PASS: drill start/progress/completion, rerenders, throttle, no immediate repeats, mute persistence, navigation cancellation, Danish speech fallback and audio assets.');
})();
