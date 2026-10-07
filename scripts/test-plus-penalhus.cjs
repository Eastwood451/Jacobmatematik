/* Isolated fake users only: no live authentication or database writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync('plus-penalhus.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const game = sandbox.window.PlusPenalhus;

const deck = game.makeDeck();
assert.ok(deck.length >= 45);
assert.equal(new Set(deck.map(t => `${t.a},${t.b}`)).size, deck.length);
for (const task of deck) {
  assert.ok(task.a >= 1 && task.a <= 9);
  assert.ok(task.b >= 1 && task.b <= 9);
  assert.ok(task.a + task.b <= 10);
}
for (const role of ['student', 'teacher', 'guest']) assert.equal(game.isEnabled({ id: 'test', role }), true);
for (const user of [null, {}, { id: 'test', role: 'admin' }, { role: 'student' }]) assert.equal(game.isEnabled(user), false);

assert.match(app, /plusPenalhus:\s*\{\s*name:\s*"Plus-penalhus"/);
assert.match(app, /data-action="plus-penalhus"/);
assert.match(app, /window\.PlusPenalhus\.mount/);
assert.match(app, /state\.view==="plus-penalhus"/);
assert.match(fs.readFileSync('index.html', 'utf8'), /plus-penalhus\.js/);
assert.match(fs.readFileSync('index.html', 'utf8'), /plus-penalhus\.css/);

for (const who of ['obbe', 'luigi']) {
  assert.ok(fs.existsSync(path.join('assets/figurer/plus-penalhus', `${who}-cartoon-v3.webp`)));
}
assert.doesNotMatch(source, /pp-puppet|pp-arm-svg|OBBE_POSES/);

let playwright;
try { playwright = require('playwright'); } catch { playwright = null; }

(async () => {
  if (!playwright) {
    console.log('PASS: deck, permissions, app wiring, cartoon atlases (browser unavailable).');
    return;
  }
  const { chromium } = playwright;
  const css = ['styles.css', 'cinematic-theme.css', 'plus-penalhus.css'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const out = 'test-results/plus-penalhus';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'pilot.local' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html></html>' });
      if (url.hostname === 'pilot.local' && url.pathname.startsWith('/assets/')) {
        const p = path.join(process.cwd(), url.pathname);
        if (fs.existsSync(p)) return route.fulfill({ path: p });
      }
      return route.abort();
    });
    await page.goto('http://pilot.local').catch(() => {});
    await page.setContent(`<!doctype html><html lang="da"><head><base href="http://pilot.local/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      window.__results = [];
      window.__dispose = PlusPenalhus.mount(document.getElementById('root'), {
        user: { id: 'guest', role: 'guest' },
        tasks: [{ a: 2, b: 3 }, { a: 1, b: 1 }],
        onResult: async r => { window.__results.push(r); },
      });
    });
    assert.equal(await page.locator('#pp-a').innerText(), '2');
    assert.equal(await page.locator('#pp-b').innerText(), '3');
    assert.equal(await page.locator('#pp-answer-panel').isHidden(), true);
    await page.waitForFunction(() => !document.querySelector('[data-pp-throw="obbe"]').disabled);
    assert.equal(await page.locator('[data-pp-cel]').count(), 2);
    const cel = page.locator('[data-pp-cel="obbe"]');
    const idlePixels = await cel.evaluate(el => el.toDataURL());
    await page.locator('[data-pp-throw="obbe"]').click({ timeout: 15000 });
    await page.waitForTimeout(260);
    assert.notEqual(await cel.evaluate(el => el.toDataURL()), idlePixels);
    assert.equal(await page.locator('.pp-flight').count(), 0, 'Nothing flies before the hand releases');
    await page.waitForSelector('.pp-flight');
    assert.equal(await page.locator('#pp-answer-panel').isHidden(), true);
    await page.screenshot({ path: `${out}/obbe-throw-mid.png`, fullPage: true });
    await page.waitForTimeout(700);
    for (let i = 0; i < 1; i++) await page.locator('[data-pp-throw="obbe"]').click({ timeout: 15000 });
    for (let i = 0; i < 3; i++) await page.locator('[data-pp-throw="luigi"]').click({ timeout: 15000 });
    await page.waitForSelector('#pp-answer-panel:not([hidden])', { timeout: 20000 });
    assert.equal(await page.locator('.pp-item').count(), 5);
    await page.locator('[data-pp-digit="4"]').click();
    await page.locator('[data-pp-submit]').click();
    await page.waitForFunction(() => document.querySelector('#pp-feedback')?.textContent.includes('Tæl dem'));
    assert.equal(await page.evaluate(() => __results.length), 1);
    assert.equal(await page.evaluate(() => __results[0].correct), false);
    await page.locator('[data-pp-digit="5"]').click();
    await page.locator('[data-pp-submit]').click();
    await page.waitForSelector('[data-pp-next]:visible');
    assert.equal(await page.evaluate(() => __results[1].correct), true);
    assert.equal(await page.evaluate(() => __results[1].topic), 'plusPenalhus');
    await page.screenshot({ path: `${out}/desktop-done.png`, fullPage: true });
    await page.locator('[data-pp-next]').click();
    assert.equal(await page.locator('#pp-a').innerText(), '1');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-pp-throw="obbe"]').click();
    await page.locator('[data-pp-throw="luigi"]').click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#pp-answer-panel').isHidden(), true, 'Wait for both items to land');
    await page.waitForSelector('#pp-answer-panel:not([hidden])');
    assert.equal(await page.locator('.pp-item').count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/mobile-count.png`, fullPage: true });
    await page.evaluate(() => __dispose());
    assert.equal(await page.locator('.pp-game').count(), 0);

    // Android's Remove animations setting exposes this media preference. A click
    // must still show a whole-body windup and a travelling object, not teleport it.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      window.__dispose = PlusPenalhus.mount(document.getElementById('root'), {
        user: { id: 'guest', role: 'guest' }, tasks: [{ a: 1, b: 1 }],
      });
    });
    await page.waitForFunction(() => !document.querySelector('[data-pp-throw="obbe"]').disabled);
    for (const who of ['obbe', 'luigi']) {
      const actorCel = page.locator(`[data-pp-cel="${who}"]`);
      const before = await actorCel.evaluate(el => el.toDataURL());
      const landed = await page.locator('.pp-item').count();
      await page.locator(`[data-pp-throw="${who}"]`).click();
      await page.waitForTimeout(240);
      assert.notEqual(await actorCel.evaluate(el => el.toDataURL()), before, `${who} winds up with reduced motion`);
      assert.equal(await page.locator('.pp-hand-loaded').count(), 1);
      assert.equal(await page.locator('.pp-item').count(), landed, 'No instant landing');
      assert.equal(await page.locator('.pp-flight').count(), 0, 'Windup precedes release');
      await page.waitForSelector('.pp-flight');
      const from = await page.locator('.pp-flight').evaluate(el => el.getBoundingClientRect().toJSON());
      await page.waitForTimeout(250);
      const to = await page.locator('.pp-flight').evaluate(el => el.getBoundingClientRect().toJSON());
      assert.ok(Math.hypot(to.x - from.x, to.y - from.y) > 10, `${who}'s item visibly travels`);
      assert.equal(await page.locator('.pp-item').count(), landed, 'Count only landed objects');
      await page.screenshot({ path: `${out}/${who}-reduced-motion-flight.png`, fullPage: true });
      await page.waitForSelector('.pp-flight', { state: 'detached' });
      assert.equal(await page.locator('.pp-item').count(), landed + 1);
    }
    await page.waitForSelector('#pp-answer-panel:not([hidden])');
    await page.evaluate(() => __dispose());
    assert.deepEqual(errors, []);
    console.log('PASS: cartoon throws and visible flights in normal/reduced motion, quotas, answers, cleanup.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
