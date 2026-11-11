const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8');

function element() {
  return {
    id:'',
    hidden:false,
    innerHTML:'',
    attachShadow() { return element(); },
    querySelector() { return element(); },
    querySelectorAll() { return [element()]; },
    setAttribute() {},
    addEventListener() {},
    append() {},
    focus() {},
  };
}

function run({ referrer, session = new Map() }) {
  const sessionStorage = {
    getItem:key => session.has(key) ? session.get(key) : null,
    setItem:(key, value) => session.set(key, String(value)),
  };
  const appended = [];
  const document = {
    referrer,
    getElementById:() => null,
    body:{ append:node => appended.push(node) },
    createElement:() => element(),
    addEventListener() {},
    cookie:'',
  };
  const window = { document, sessionStorage, localStorage:{ getItem:() => null, setItem() {}, removeItem() {} }, addEventListener() {} };
  const context = { window, document, sessionStorage, localStorage:window.localStorage, location:{ hostname:'jacobmatematik.dk', pathname:'/' }, navigator:{}, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { appended, session, jmTrack:window.jmTrack };
}

const android = run({ referrer:'android-app://dk.jacobmatematik.app' });
assert.equal(android.appended.length, 0);
assert.equal(android.session.get('jm-android-app'), '1');
assert.equal(typeof android.jmTrack, 'function');
android.jmTrack('page_view', { exercise_name:'should-not-send' });

const later = run({ referrer:'https://jacobmatematik.dk/', session:android.session });
assert.equal(later.appended.length, 0);
assert.equal(later.session.get('jm-android-app'), '1');

const browser = run({ referrer:'https://www.google.com/' });
assert.equal(browser.appended.length, 1);
assert.equal(browser.session.has('jm-android-app'), false);

const direct = run({ referrer:'' });
assert.equal(direct.appended.length, 1);

console.log('PASS: Android app skips analytics and the cookie banner; browser visits still ask.');
