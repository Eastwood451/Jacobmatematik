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
assert.match(index, /suggestions\.css/);
assert.match(index, /suggestions\.js/);

const backend = read('supabase-backend.js');
assert.match(backend, /submitSiteSuggestion/);
assert.match(backend, /listSiteSuggestions/);
assert.match(backend, /deleteSiteSuggestion/);

const app = read('app.js');
assert.match(app, /renderSiteSuggestions/);
assert.match(app, /exportSiteSuggestionsCsv/);
assert.match(app, /toggle-site-suggestions/);
assert.match(app, /delete-site-suggestion/);

const strings = read('i18n-strings.js');
assert.match(strings, /"suggest_button"/);
assert.match(strings, /Do you have a suggestion for jacobmatematik\.dk\?/);

const css = read('suggestions.css');
assert.doesNotMatch(css, /position:\s*fixed/);
assert.match(css, /#jm-suggest-dialog/);
assert.match(css, /padding-bottom:\s*96px/);
assert.match(css, /min-height:\s*44px/);

const landings = [
  'en/index.html',
  'en/for-teachers/index.html',
  'til-elever/index.html',
  'til-laerere/index.html',
  'broeker/index.html',
];
for (const file of landings) {
  const html = read(file);
  assert.match(html, /suggestions\.js/, `missing suggestions.js on ${file}`);
  assert.match(html, /suggestions\.css/, `missing suggestions.css on ${file}`);
}

const document = {
  readyState: 'complete',
  documentElement: { lang: 'da' },
  body: {
    children: [],
    append(node) { this.children.push(node); },
  },
  querySelector(sel) {
    if (sel === 'footer.site-links' || sel === 'footer.lp-footer') {
      return {
        append(node) { this._btn = node; },
        _btn: null,
      };
    }
    if (sel === '[data-jm-suggest]') return this._mounted || null;
    return null;
  },
  getElementById() { return null; },
  createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      children: [],
      attributes: {},
      className: '',
      textContent: '',
      innerHTML: '',
      type: '',
      id: '',
      setAttribute(name, value) { this.attributes[name] = value; if (name === 'data-jm-suggest') document._mounted = this; },
      getAttribute(name) { return this.attributes[name]; },
      append(...nodes) { this.children.push(...nodes); },
      addEventListener() {},
      querySelector() { return { addEventListener() {}, textContent: '', placeholder: '', focus() {}, disabled: false }; },
      closest() { return null; },
    };
    return el;
  },
  addEventListener() {},
};
const footer = { append(node) { document._mounted = node; this.button = node; }, button: null };
document.querySelector = sel => {
  if (sel === 'footer.site-links' || sel === 'footer.lp-footer') return footer;
  if (sel === '[data-jm-suggest]') return document._mounted || null;
  return null;
};

const sandbox = {
  window: {
    JacobLang: { get: () => 'da' },
    JACOBMATEMATIK_SUPABASE: {},
    location: { pathname: '/' },
  },
  document,
  localStorage: { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); } },
  console,
};
sandbox.window.document = document;
sandbox.window.localStorage = sandbox.localStorage;
vm.runInNewContext(read('suggestions.js'), sandbox);
assert.equal(typeof sandbox.window.JacobSuggestions.open, 'function');
assert.ok(footer.button, 'button should mount in footer');
assert.match(footer.button.textContent, /Har du et forslag til jacobmatematik\.dk\?/);
assert.equal(footer.button.attributes['data-jm-suggest'], '');
assert.doesNotMatch(footer.button.className || '', /fixed/);

console.log('suggestions checks passed');
