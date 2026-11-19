/* Offline browser: hver slået brik dør på sin egen måde (pr. briktype),
   angriberen laver sejrshop, effekten ryddes op, spillet blokeres ikke,
   og prefers-reduced-motion slår effekterne fra. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const origin = 'https://skak-death-test.invalid';

// Hvidt tårn på a1 slår en sort brik på a5 (minimal, lovlig stilling).
const CASES = [
  ['p', 'slime'], ['n', 'lightning'], ['b', 'fireball'], ['r', 'rubble'], ['q', 'stars'],
];
const fenFor = t => `4k3/8/8/${t}7/8/8/8/R3K3 w - - 0 1`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const errors = [];
  async function open(width, height, reducedMotion = 'no-preference') {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, reducedMotion });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/') {
        return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"></head><body style="margin:0;background:#f6efe2"><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>` });
      }
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
      return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
    });
    await page.goto(origin);
    await page.locator('[data-act="start-cpu"]').click();
    return page;
  }
  // Sæt stilling og få UI til at rendere den via en løst opgave (samme greb som test-skak-anim).
  async function setPosition(page, fen) {
    await page.evaluate(f => {
      Object.assign(testGame.state, { fen: f, status: SkakCore.gameStatus(f), phase: 'solve', problem: { text: '1 + 1', answer: 2, kind: 'let' }, selected: null, targets: [], lastMove: null, lockUntil: 0, myColor: 'w' });
    }, fen);
    await page.locator('input[name="answer"]').fill('2');
    await page.locator('[data-form="answer"] button[type="submit"]').click();
    await page.waitForSelector('.sk-board:not(.locked)');
  }
  try {
    // Ren mapning
    const page0 = await open(1100, 800);
    const kinds = await page0.evaluate(() => ['p', 'n', 'b', 'r', 'q', 'k', 'P', 'x', null].map(t => SkakAnim.deathKind(t)));
    assert.deepEqual(kinds, ['slime', 'lightning', 'fireball', 'rubble', 'stars', 'blackhole', 'slime', 'slime', 'slime']);
    await page0.close();

    for (const [vw, vh, label] of [[1100, 800, 'desktop'], [390, 844, 'portrait'], [844, 390, 'landscape']]) {
      for (const [type, kind] of CASES) {
        const page = await open(vw, vh);
        await setPosition(page, fenFor(type));
        await page.locator('[data-sq="a1"]').click();
        const t0 = Date.now();
        await page.locator('[data-sq="a5"]').click();
        await page.waitForSelector(`.sk-fx-layer[data-death="${kind}"]`, { timeout: 1500 });
        // Spillet er allerede opdateret (effekten er rent visuel og blokerer ikke)
        assert.equal(await page.evaluate(() => testGame.state.fen.split(' ')[0]), '4k3/8/8/R7/8/8/8/4K3', `${label} ${type}: fen updated immediately`);
        assert.match(await page.locator('[data-sq="a5"] img').getAttribute('src'), /w-r\.webp/);
        await page.waitForSelector('.sk-piece.sk-victory', { timeout: 1500 });
        await page.waitForFunction(() => !document.querySelector('.sk-fx-layer'), null, { timeout: 2500 });
        const ms = Date.now() - t0;
        assert.ok(ms < 2000, `${label} ${type}: fx cleaned up (${ms} ms)`);
        await page.evaluate(() => testGame());
        await page.close();
      }
    }

    // Konge: kan ikke slås i rigtigt spil; demo-API'et viser sort hul uden at ændre spillet.
    const kp = await open(1100, 800);
    const fenBefore = await kp.evaluate(() => testGame.state.fen);
    await kp.evaluate(() => SkakAnim.playDeath(document.querySelector('.sk-board'), 'e8', 'k'));
    await kp.waitForSelector('.sk-fx-layer[data-death="blackhole"]');
    assert.equal(await kp.evaluate(() => testGame.state.fen), fenBefore);
    await kp.close();

    // prefers-reduced-motion: ingen effektlag, men trækket gennemføres
    const rm = await open(1100, 800, 'reduce');
    await setPosition(rm, fenFor('q'));
    await rm.locator('[data-sq="a1"]').click();
    await rm.locator('[data-sq="a5"]').click();
    await rm.waitForTimeout(300);
    assert.equal(await rm.locator('.sk-fx-layer').count(), 0, 'reduced motion: no fx');
    assert.match(await rm.locator('[data-sq="a5"] img').getAttribute('src'), /w-r\.webp/);
    await rm.close();

    assert.deepEqual(errors, []);
    console.log('PASS: skak death effects — 5 capture types × desktop/portrait/landscape, king demo, reduced motion');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
