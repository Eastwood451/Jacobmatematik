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
assert.match(fs.readFileSync('module-loader.js', 'utf8'), /plus-penalhus\.js/);
assert.match(fs.readFileSync('module-loader.js', 'utf8'), /plus-penalhus\.css/);
assert.doesNotMatch(fs.readFileSync('index.html', 'utf8'), /src=["']plus-penalhus\.js/);

for (const who of ['obbe', 'luigi']) {
  assert.ok(fs.existsSync(path.join('assets/figurer/plus-penalhus', `${who}-cartoon-v5.webp`)));
}
assert.doesNotMatch(source, /pp-puppet|pp-arm-svg|OBBE_POSES/);
for (const clip of [
  ...Array.from({ length: 18 }, (_, i) => `count-${i + 1}`),
  ...Array.from({ length: 100 }, (_, i) => `sum-${Math.floor(i / 10)}-${i % 10}`),
]) {
  const file = path.join('assets/figurer/plus-penalhus/audio-v2', `${clip}.mp3`);
  assert.ok(fs.existsSync(file) && fs.statSync(file).size > 1000, `${clip} must ship with the game`);
}

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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 },
      recordVideo: { dir: `${out}/video`, size: { width: 960, height: 675 } } });
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
      window.__speech = [];
      window.__nativePlay = HTMLMediaElement.prototype.play;
      // Deterministic audio completion: test queue order, not CI audio hardware.
      HTMLMediaElement.prototype.play = function () {
        __speech.push(this.src.split('/').pop());
        setTimeout(() => this.dispatchEvent(new Event('ended')), 320);
        return Promise.resolve();
      };
      window.__timings = { clicks: [], released: {}, landed: {} };
      document.getElementById('root').addEventListener('click', event => {
        const button = event.target.closest('[data-pp-throw]');
        if (button && !button.disabled) __timings.clicks.push({ at: performance.now(),
          who: button.dataset.ppThrow, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
      }, true);
      new MutationObserver(() => {
        document.querySelectorAll('[data-pp-flight]').forEach(el => {
          __timings.released[el.dataset.ppFlight] ??= performance.now();
        });
        document.querySelectorAll('[data-pp-item]').forEach(el => {
          __timings.landed[el.dataset.ppItem] ??= performance.now();
        });
      }).observe(document.body, { childList: true, subtree: true });
    });
    async function verifyTiming() {
      const timings = await page.evaluate(() => __timings);
      assert.ok(timings.clicks.length > 0);
      timings.clicks.forEach((click, i) => {
        const windup = (click.who === 'obbe' ? 7 : 4) * (click.reduced ? 80 : 50);
        const expectedFlight = (1500 - windup) / 2;
        const release = timings.released[i + 1];
        const elapsed = timings.landed[i + 1] - release;
        assert.ok(release - click.at >= windup - 10 && release - click.at < windup + 100,
          'Character windup keeps its original pace');
        assert.ok(elapsed >= expectedFlight - 15 && elapsed < expectedFlight + 100,
          `Click ${i + 1} flew for ${elapsed}ms; expected ${expectedFlight}ms`);
      });
    }
    async function verifyLayout() {
      const boxes = await page.locator('.pp-item').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()));
      const canvasBox = await page.locator('#pp-canvas').boundingBox();
      boxes.forEach((a, i) => {
        assert.ok(a.left >= canvasBox.x && a.right <= canvasBox.x + canvasBox.width);
        assert.ok(a.top >= canvasBox.y && a.bottom <= canvasBox.y + canvasBox.height);
        boxes.slice(i + 1).forEach(b => {
          assert.ok(a.right + 10 <= b.left || b.right + 10 <= a.left || a.bottom + 10 <= b.top || b.bottom + 10 <= a.top,
            'Every card has its own slot, including counted/celebrating cards');
        });
      });
    }
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
    await page.evaluate(() => {
      window.__heads = [];
      const end = performance.now() + 1100;
      const sample = () => {
        const canvas = document.querySelector('[data-pp-cel="obbe"]');
        const pixels = canvas.getContext('2d').getImageData(70, 0, 120, 125).data;
        let mass = 0, x = 0, y = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          const alpha = pixels[i];
          mass += alpha; x += ((i - 3) / 4 % 120) * alpha;
          y += Math.floor((i - 3) / 4 / 120) * alpha;
        }
        __heads.push({ x: x / mass, y: y / mass, mass });
        if (performance.now() < end) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.locator('[data-pp-throw="obbe"]').click({ timeout: 15000 });
    const windup = await page.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return { flights: document.querySelectorAll('.pp-flight').length,
        pixels: document.querySelector('[data-pp-cel="obbe"]').toDataURL() };
    });
    assert.notEqual(windup.pixels, idlePixels);
    assert.equal(windup.flights, 0, 'Nothing flies before the hand releases');
    await page.waitForSelector('.pp-flight');
    assert.equal(await page.locator('#pp-answer-panel').isHidden(), true);
    await page.screenshot({ path: `${out}/obbe-throw-mid.png`, fullPage: true });
    await page.waitForTimeout(700);
    const heads = await page.evaluate(() => __heads);
    const base = heads[0];
    assert.ok(heads.length > 8);
    assert.ok(heads.every(h => Math.hypot(h.x - base.x, h.y - base.y) < 3),
      'Head stays registered instead of jumping when the arm extends');
    assert.ok(heads.every(h => h.mass > base.mass * .9), 'Cel interpolation does not flash transparent');
    // Audio has finished while the first item is still in flight.
    // Use a separate task below to assert this, without changing head sampling.
    for (let i = 0; i < 1; i++) await page.locator('[data-pp-throw="obbe"]').click({ timeout: 15000 });
    for (let i = 0; i < 3; i++) await page.locator('[data-pp-throw="luigi"]').click({ timeout: 15000 });
    await page.waitForSelector('#pp-answer-panel:not([hidden])', { timeout: 20000 });
    assert.equal(await page.locator('.pp-item').count(), 5);
    await verifyTiming();
    await verifyLayout();
    assert.deepEqual(await page.evaluate(() => __speech), ['count-1.mp3', 'count-2.mp3', 'count-1.mp3', 'count-2.mp3', 'count-3.mp3']);
    await page.locator('[data-pp-item="1"]').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => __speech.at(-1)), 'count-1.mp3');
    await page.locator('[data-pp-digit="4"]').click();
    await page.locator('[data-pp-submit]').click();
    await page.waitForFunction(() => document.querySelector('#pp-feedback')?.textContent.includes('Tæl dem'));
    assert.equal(await page.evaluate(() => __results.length), 1);
    assert.equal(await page.evaluate(() => __results[0].correct), false);
    assert.equal(await page.evaluate(() => __speech.filter(s => s.startsWith('sum-')).length), 0);
    await page.locator('[data-pp-digit="5"]').click();
    await page.locator('[data-pp-submit]').click();
    await page.waitForSelector('[data-pp-next]:visible');
    assert.equal(await page.evaluate(() => __results[1].correct), true);
    assert.equal(await page.evaluate(() => __results[1].topic), 'plusPenalhus');
    assert.equal(await page.evaluate(() => __speech.at(-1)), 'sum-2-3.mp3');
    await verifyLayout();
    await page.screenshot({ path: `${out}/desktop-done.png`, fullPage: true });
    await page.locator('[data-pp-next]').click();
    await page.evaluate(() => { window.__timings = { clicks: [], released: {}, landed: {} }; });
    assert.equal(await page.locator('#pp-a').innerText(), '1');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-pp-throw="obbe"]').click();
    await page.locator('[data-pp-throw="luigi"]').click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#pp-answer-panel').isHidden(), true, 'Wait for both items to land');
    await page.waitForSelector('#pp-answer-panel:not([hidden])');
    assert.equal(await page.locator('.pp-item').count(), 2);
    await verifyTiming();
    await verifyLayout();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/mobile-count.png`, fullPage: true });
    await page.evaluate(() => __dispose());
    assert.equal(await page.locator('.pp-game').count(), 0);

    // Android's Remove animations setting exposes this media preference. A click
    // must still show a whole-body windup and a travelling object, not teleport it.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      window.__timings = { clicks: [], released: {}, landed: {} };
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
      const windup = await page.evaluate(async who => {
        await new Promise(resolve => setTimeout(resolve, 150));
        return { hands: document.querySelectorAll('.pp-hand-loaded').length,
          items: document.querySelectorAll('.pp-item').length,
          flights: document.querySelectorAll('.pp-flight').length,
          pixels: document.querySelector(`[data-pp-cel="${who}"]`).toDataURL() };
      }, who);
      assert.notEqual(windup.pixels, before, `${who} winds up with reduced motion`);
      assert.equal(windup.hands, 1);
      assert.equal(windup.items, landed, 'No instant landing');
      assert.equal(windup.flights, 0, 'Windup precedes release');
      // Sample the brief flight in one browser call so CI round trips cannot
      // consume its whole lifetime between finding it and reading its position.
      const { from, to, landedDuringFlight } = await page.evaluate(async () => {
        const started = performance.now();
        let flight;
        while (!(flight = document.querySelector('.pp-flight'))) {
          if (performance.now() - started > 3000) throw Error('Object was never released');
          await new Promise(requestAnimationFrame);
        }
        const from = flight.getBoundingClientRect().toJSON();
        await new Promise(resolve => setTimeout(resolve, 250));
        return { from, to: flight.getBoundingClientRect().toJSON(),
          landedDuringFlight: document.querySelectorAll('.pp-item').length };
      });
      assert.ok(Math.hypot(to.x - from.x, to.y - from.y) > 10, `${who}'s item visibly travels`);
      assert.equal(landedDuringFlight, landed, 'Count only landed objects');
      await page.screenshot({ path: `${out}/${who}-reduced-motion-flight.png`, fullPage: true });
      await page.waitForSelector('.pp-flight', { state: 'detached' });
      assert.equal(await page.locator('.pp-item').count(), landed + 1);
    }
    await page.waitForSelector('#pp-answer-panel:not([hidden])');
    await verifyTiming();
    await page.evaluate(() => __dispose());
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      window.__timings = { clicks: [], released: {}, landed: {} };
      window.__dispose = PlusPenalhus.mount(document.getElementById('root'), {
        user: { id: 'guest', role: 'guest' }, tasks: [{ a: 2, b: 0 }],
      });
    });
    await page.locator('[data-pp-throw="obbe"]').click();
    const overlap = await page.evaluate(async () => {
      const button = document.querySelector('[data-pp-throw="obbe"]');
      const started = performance.now();
      while (button.disabled) {
        if (performance.now() - started > 3000) throw Error('Next throw stayed locked');
        await new Promise(requestAnimationFrame);
      }
      const firstFlights = document.querySelectorAll('.pp-flight').length;
      const firstItems = document.querySelectorAll('.pp-item').length;
      button.click();
      while (document.querySelectorAll('.pp-flight').length < 2) {
        if (performance.now() - started > 3000) throw Error('Throws never overlapped');
        await new Promise(requestAnimationFrame);
      }
      return { firstFlights, firstItems, flights: document.querySelectorAll('.pp-flight').length };
    });
    assert.equal(overlap.firstItems, 0);
    assert.equal(overlap.firstFlights, 1, 'Next throw unlocks before the previous landing');
    assert.equal(overlap.flights, 2, 'Two same-actor items fly together');
    await page.waitForSelector('#pp-answer-panel:not([hidden])');
    await verifyTiming();
    await verifyLayout();
    await page.evaluate(() => __dispose());
    // Maximum supported sum. Both actors may throw together; slots are reserved
    // in accepted-click order rather than whichever flight happens to finish first.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      window.__timings = { clicks: [], released: {}, landed: {} };
      window.__dispose = PlusPenalhus.mount(document.getElementById('root'), {
        user: { id: 'guest', role: 'guest' }, tasks: [{ a: 9, b: 9 }],
      });
    });
    for (let i = 0; i < 9; i++) {
      await page.locator('[data-pp-throw="obbe"]').click();
      await page.locator('[data-pp-throw="luigi"]').click();
    }
    await page.waitForSelector('#pp-answer-panel:not([hidden])');
    assert.equal(await page.locator('.pp-item').count(), 18);
    await verifyTiming();
    for (const width of [320, 390, 720, 980, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      await verifyLayout();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    for (const el of await page.locator('.pp-item').all()) await el.click();
    await verifyLayout();
    await page.locator('[data-pp-digit="1"]').click();
    await page.locator('[data-pp-digit="8"]').click();
    await page.locator('[data-pp-submit]').click();
    await page.waitForSelector('[data-pp-next]:visible');
    assert.equal(await page.evaluate(() => __speech.at(-1)), 'sum-9-9.mp3');
    await verifyLayout();
    await page.evaluate(() => __dispose());
    // Verify the shipped MP3s actually decode and finish in Chromium too.
    await page.evaluate(() => {
      window.__played = [];
      window.__audioErrors = [];
      HTMLMediaElement.prototype.play = function () {
        const clip = this.src.split('/').pop();
        this.addEventListener('ended', () => __played.push(clip), { once: true });
        const promise = __nativePlay.call(this);
        promise.catch(error => __audioErrors.push(error.message));
        return promise;
      };
      window.__dispose = PlusPenalhus.mount(document.getElementById('root'), {
        user: { id: 'guest', role: 'guest' }, tasks: [{ a: 5, b: 3 }],
      });
    });
    await page.locator('[data-pp-throw="obbe"]').click();
    for (let i = 1; i < 5; i++) await page.locator('[data-pp-throw="obbe"]').click();
    for (let i = 0; i < 3; i++) await page.locator('[data-pp-throw="luigi"]').click();
    await page.waitForFunction(() => __played.includes('count-4.mp3') && __played.includes('count-5.mp3'));
    await page.waitForSelector('#pp-answer-panel:not([hidden])');
    await page.locator('[data-pp-digit="8"]').click();
    await page.locator('[data-pp-submit]').click();
    await page.waitForFunction(() => __played.includes('sum-5-3.mp3'));
    assert.deepEqual(await page.evaluate(() => __audioErrors), []);
    await page.evaluate(() => __dispose());
    assert.deepEqual(errors, []);
    console.log('PASS: half flight time with unchanged poses in normal/reduced motion, no overlaps at 320–1280px, Danish counting/equations, quotas, answers, cleanup.');
  } catch (error) {
    console.error('Browser errors:', errors);
    throw error;
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
