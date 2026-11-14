/* Smoke checks for the site-suggestions feature (no live Supabase writes). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const migration = read('supabase/migrations/20261113153000_site_suggestions.sql');
assert.match(migration, /create table if not exists public\.site_suggestions/);
assert.match(migration, /submit_site_suggestion/);
assert.match(migration, /list_site_suggestions/);
assert.match(migration, /delete_site_suggestion/);
assert.match(migration, /can_manage_self_registered/);
assert.match(migration, /grant execute on function public\.submit_site_suggestion\(text\) to anon, authenticated/);
assert.doesNotMatch(migration, /service_role/);

const index = read('index.html');
assert.match(index, /suggestions\.css\?v=20261114-postkasse2/);
assert.match(index, /suggestions\.js\?v=20261114-postkasse2/);

const backend = read('supabase-backend.js');
assert.match(backend, /submitSiteSuggestion/);
assert.match(backend, /listSiteSuggestions/);
assert.match(backend, /deleteSiteSuggestion/);

const app = read('app.js');
assert.match(app, /renderSiteSuggestions/);
assert.match(app, /exportSiteSuggestionsCsv/);
assert.match(app, /toggle-site-suggestions/);
assert.match(app, /delete-site-suggestion/);
assert.match(app, /class="streak"/);
assert.match(app, /dashboard-head/);

const strings = read('i18n-strings.js');
assert.match(strings, /"suggest_button"/);
assert.match(strings, /Forbedringsforslag - skriv til jacobmatematik\.dk/);
assert.match(strings, /Suggestions - write to jacobmatematik\.dk/);
assert.doesNotMatch(strings, /Har du et forslag til jacobmatematik\.dk\?/);

const css = read('suggestions.css');
assert.doesNotMatch(css, /position:\s*fixed/);
assert.match(css, /#jm-suggest-dialog/);
assert.match(css, /padding-bottom:\s*96px/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /\.jm-suggest-mailbox/);
assert.match(css, /\.jm-suggest-aside/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /max-width:\s*560px/);

const js = read('suggestions.js');
assert.match(js, /Forbedringsforslag - skriv til jacobmatematik\.dk/);
assert.match(js, /Suggestions - write to jacobmatematik\.dk/);
assert.match(js, /data-jm-suggest-mailbox/);
assert.match(js, /jm-postkasse-letter/);
assert.match(js, /clipPath/);
assert.match(js, /jm-postkasse-slot-/);
const bodyAt = js.indexOf('x="10" y="24" width="44" height="40"');
const letterAt = js.indexOf('class="jm-postkasse-letter"');
const lipAt = js.indexOf('x="16.5" y="32" width="31" height="2.2"');
assert.ok(bodyAt >= 0 && letterAt > bodyAt, 'letter must be painted in front of the mailbox body');
assert.ok(lipAt > letterAt, 'slot lip must sit on top of the letter so it appears to enter the slot');
assert.match(css, /translateY\(4px\)/);
assert.doesNotMatch(css, /translateY\(-/);
assert.match(js, /MutationObserver/);
assert.match(js, /JacobSuggestions = \{ open: openDialog, mount: mountButton, mountMailbox: mountMailboxCards \}/);
assert.doesNotMatch(js, /Har du et forslag til jacobmatematik\.dk\?/);

const landings = [
  'en/index.html',
  'en/for-teachers/index.html',
  'til-elever/index.html',
  'til-laerere/index.html',
  'broeker/index.html',
];
for (const file of landings) {
  const html = read(file);
  assert.match(html, /suggestions\.js\?v=20261114-postkasse2/, `missing cache-busted suggestions.js on ${file}`);
  assert.match(html, /suggestions\.css\?v=20261114-postkasse2/, `missing cache-busted suggestions.css on ${file}`);
}

function makeEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    style: {},
    children: [],
    attributes: {},
    className: '',
    classList: {
      contains(name) { return (` ${el.className} `).includes(` ${name} `); },
    },
    textContent: '',
    innerHTML: '',
    type: '',
    id: '',
    parentElement: null,
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    append(...nodes) {
      for (const node of nodes) {
        node.parentElement = this;
        this.children.push(node);
      }
    },
    insertBefore(node, ref) {
      node.parentElement = this;
      const idx = this.children.indexOf(ref);
      if (idx < 0) this.children.push(node);
      else this.children.splice(idx, 0, node);
    },
    addEventListener() {},
    querySelector(sel) { return queryAll(this, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(this, sel); },
    closest() { return null; },
  };
  return el;
}

function walk(node, acc = []) {
  acc.push(node);
  for (const child of node.children || []) walk(child, acc);
  return acc;
}

function matches(node, sel) {
  if (!node || !sel) return false;
  if (sel === '[data-jm-suggest]') return Object.prototype.hasOwnProperty.call(node.attributes || {}, 'data-jm-suggest');
  if (sel === '[data-jm-suggest-mailbox]') return Object.prototype.hasOwnProperty.call(node.attributes || {}, 'data-jm-suggest-mailbox');
  if (sel === '.jm-suggest-entry') return (` ${node.className} `).includes(' jm-suggest-entry ');
  if (sel === '.jm-suggest-mailbox') return (` ${node.className} `).includes(' jm-suggest-mailbox ');
  if (sel === '.jm-suggest-aside') return (` ${node.className} `).includes(' jm-suggest-aside ');
  if (sel === '.streak') return (` ${node.className} `).includes(' streak ');
  if (sel === '.hero-line .streak') return (` ${node.className} `).includes(' streak ');
  if (sel === 'footer.site-links' || sel === 'footer.lp-footer') return node.tagName === 'FOOTER';
  if (sel === '#app') return node.id === 'app';
  if (sel === '.hero-line') return (` ${node.className} `).includes(' hero-line ');
  if (sel === '.dashboard-head') return (` ${node.className} `).includes(' dashboard-head ');
  return false;
}

function queryAll(root, sel) {
  return walk(root).filter(node => matches(node, sel));
}

const footer = makeEl('footer');
footer.className = 'site-links';
const appRoot = makeEl('main');
appRoot.id = 'app';
const hero = makeEl('section');
hero.className = 'hero-line';
const greeting = makeEl('div');
const streak = makeEl('div');
streak.className = 'streak';
streak.innerHTML = '<span>I alt løst</span><strong>83 opgaver</strong>';
hero.append(greeting, streak);
appRoot.append(hero);
const body = makeEl('body');
body.append(appRoot, footer);

const document = {
  readyState: 'complete',
  documentElement: { lang: 'da' },
  body,
  getElementById(id) { return walk(body).find(node => node.id === id) || null; },
  querySelector(sel) {
    if (sel === 'footer.site-links' || sel === 'footer.lp-footer') return footer;
    if (sel === '[data-jm-suggest]') return queryAll(body, '[data-jm-suggest]')[0] || null;
    if (sel === '.jm-suggest-entry') return queryAll(body, '.jm-suggest-entry')[0] || null;
    if (sel === '.hero-line .streak') return streak;
    if (sel === '.dashboard-head') return null;
    if (sel === '#app') return appRoot;
    return queryAll(body, sel)[0] || null;
  },
  querySelectorAll(sel) { return queryAll(body, sel); },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {},
};

const sandbox = {
  window: {
    JacobLang: { get: () => 'da' },
    JACOBMATEMATIK_SUPABASE: {},
    location: { pathname: '/' },
    MutationObserver: undefined,
  },
  document,
  localStorage: { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); } },
  console,
};
sandbox.window.document = document;
sandbox.window.localStorage = sandbox.localStorage;
vm.runInNewContext(read('suggestions.js'), sandbox);

assert.equal(typeof sandbox.window.JacobSuggestions.open, 'function');
assert.equal(typeof sandbox.window.JacobSuggestions.mountMailbox, 'function');
assert.ok(footer.children.length, 'button should mount in footer');
const footerBtn = footer.children[0];
assert.match(footerBtn.textContent, /Forbedringsforslag - skriv til jacobmatematik\.dk/);
assert.equal(footerBtn.attributes['data-jm-suggest'], '');
assert.match(footerBtn.className, /jm-suggest-entry/);
assert.doesNotMatch(footerBtn.className || '', /fixed/);

sandbox.window.JacobSuggestions.mountMailbox();
const mailbox = hero.querySelector('[data-jm-suggest-mailbox]');
assert.ok(mailbox, 'mailbox card should sit beside the streak card');
assert.equal(mailbox.attributes['aria-label'], 'Forbedringsforslag - skriv til jacobmatematik.dk');
assert.match(mailbox.className, /jm-suggest-mailbox/);
assert.equal(hero.querySelector('.jm-suggest-aside')?.children.includes(streak) || hero.children.some(child => child.classList.contains('jm-suggest-aside') && child.children.includes(streak)), true);
const aside = hero.children.find(child => (` ${child.className} `).includes(' jm-suggest-aside '));
assert.ok(aside, 'streak and mailbox share an aside so they stay in one row');
assert.equal(aside.children[0], mailbox);
assert.equal(aside.children[1], streak);
assert.equal(footer.children.length, 1, 'mailbox must not replace the footer entry');

console.log('suggestions checks passed');
