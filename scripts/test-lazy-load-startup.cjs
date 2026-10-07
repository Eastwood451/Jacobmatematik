/* Ensures startup only eagers auth/shell; games load via JacobModules. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const index = fs.readFileSync('index.html', 'utf8');
const loaderSrc = fs.readFileSync('module-loader.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

// SEO landing must stay crawlable without JS.
assert.match(index, /<h1>Gratis matematikøvelser der gør træning til leg<\/h1>/);
assert.match(index, /meta name="description"/);
assert.match(index, /application\/ld\+json/);
assert.match(index, /Start gratis træning/);

// Eager scripts: auth + shell only (plus analytics/install).
const eagerScripts = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].split('?')[0]);
const allowed = new Set([
  'analytics.js',
  'install-app.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'supabase-config.js',
  'supabase-backend.js',
  'module-loader.js',
  'app.js',
]);
for (const src of eagerScripts) {
  assert.ok(allowed.has(src), `unexpected eager script: ${src}`);
}
assert.ok(eagerScripts.includes('module-loader.js'));
assert.ok(eagerScripts.includes('app.js'));

const lazyJs = [
  'marley.js', 'marley-addition.js', 'plus-penalhus.js', 'foodtruck.js',
  'pizza-friends.js', 'fraction-lesson.js', 'fraction-simplify.js',
  'fraction-add-subtract.js', 'fraction-obbe.js', 'fps-trial-entry.js',
  'dennis-audio.js', 'obbe-coach.js',
];
for (const name of lazyJs) {
  assert.doesNotMatch(index, new RegExp(`src=["']${name.replace('.', '\\.')}`));
  assert.match(loaderSrc, new RegExp(name.replace('.', '\\.')));
}

const lazyCss = [
  'marley.css', 'marley-addition.css', 'plus-penalhus.css', 'foodtruck.css',
  'pizza-friends.css', 'fraction-lesson.css', 'fraction-multiply.css',
  'fraction-simplify.css', 'fraction-add-subtract.css', 'fraction-obbe.css',
];
for (const name of lazyCss) {
  assert.doesNotMatch(index, new RegExp(`href=["']${name.replace('.', '\\.')}`));
  assert.match(loaderSrc, new RegExp(name.replace('.', '\\.')));
}

// Shell CSS still eager
for (const name of ['styles.css', 'login-cinematic.css', 'cinematic-theme.css', 'local-results.css', 'install-app.css']) {
  assert.match(index, new RegExp(`href=["']${name.replace('.', '\\.')}`));
}

// Loader exposes API and covers main games
const sandbox = { window: {}, document: {
  querySelectorAll: () => [],
  scripts: [],
  head: { appendChild() {} },
  createElement: () => ({ setAttribute() {}, onload: null, onerror: null }),
} };
// Minimal document.scripts array-like
sandbox.document.scripts = [];
vm.runInNewContext(loaderSrc, sandbox);
assert.equal(typeof sandbox.window.JacobModules.load, 'function');
for (const key of ['marley', 'marley-addition', 'plus-penalhus', 'ten-friends', 'foodtruck', 'learn-fractions', 'obbe-coach', 'fps-trial-entry', 'dennis-audio']) {
  assert.ok(sandbox.window.JacobModules.modules[key], `missing module map: ${key}`);
}

// App waits for modules before mount
assert.match(app, /ensureModule\("marley-addition"/);
assert.match(app, /ensureModule\("plus-penalhus"/);
assert.match(app, /ensureModule\("ten-friends"/);
assert.match(app, /ensureModule\("learn-fractions"/);
assert.match(app, /ensureModule\("marley"/);
assert.match(app, /ensureModule\("foodtruck"/);
assert.match(app, /gameModuleEnabled/);
assert.match(app, /JacobModules\?\.load\("fps-trial-entry"\)/);
assert.match(app, /JacobModules\?\.load\("dennis-audio"\)/);
assert.match(app, /load\("obbe-coach"\)/);

// Home cards must not require window.* APIs before load
assert.doesNotMatch(app, /canPlayMarleyAddition = \(\) => window\.MarleyAddition/);
assert.doesNotMatch(app, /canLearnFractions = \(\) => window\.JacobFractionLesson/);

console.log('lazy-load startup checks passed');
