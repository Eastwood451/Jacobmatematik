/* Offline browser regression: real board, shop, promotion and image failure.
   No login, database or external requests. Run from repository root. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const origin = 'https://skak-test.invalid';
const expected = {
  a1: ['w-r', 'Øbbe Øvdig'], b1: ['w-n', 'Luigi Lækkermat'], c1: ['w-b', 'Matematik-Marley'],
  d1: ['w-q', 'Superheltepigen'], e1: ['w-k', 'Kaptajn Kvadratrod'], a2: ['w-p', 'Divisions-Dennis'],
  a8: ['b-r', 'Gunnar Giderik'], b8: ['b-n', 'Erling Ærgerlig'], c8: ['b-b', 'Broder Brok'],
  d8: ['b-q', 'Eksamens-Else'], e8: ['b-k', 'Kejser Dummo'], a7: ['b-p', 'Surling'],
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const errors = [];
  try {
    async function open(width, failKing = false) {
      const page = await browser.newPage({ viewport: { width, height: 1080 }, isMobile: width < 600, hasTouch: width < 600 });
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="da"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"></head><body style="margin:0"><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>' });
        if (failKing && url.pathname.endsWith('/w-k.webp')) return route.abort();
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
        const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
        return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
      });
      await page.goto(origin);
      await page.locator('[data-act="start-cpu"]').click();
      await page.waitForFunction(() => [...document.querySelectorAll('.sk-character img')].every(img => img.complete));
      return page;
    }
    async function artAt(page, square, id, name) {
      const cell = page.locator(`[data-sq="${square}"]`);
      assert.match(await cell.locator('img').getAttribute('src'), new RegExp(`/${id}\\.webp$`));
      assert.ok((await cell.getAttribute('aria-label')).includes(name), `${square} should identify ${name}`);
      assert.equal(await cell.locator('img').evaluate(img => img.naturalWidth > 0), true, `${id} must load`);
    }
    fs.mkdirSync('test-results/skak', { recursive: true });
    for (const width of [1280, 390, 320]) {
      const page = await open(width);
      assert.equal(await page.locator('.sk-board button').count(), 64);
      assert.equal(await page.locator('.sk-board .sk-character img').count(), 32);
      for (const [square, [id, name]] of Object.entries(expected)) await artAt(page, square, id, name);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}px must not scroll horizontally`);
      assert.equal(await page.locator('.sk-board').evaluate(board => {
        const cells = [...board.children].map(cell => cell.getBoundingClientRect());
        return cells.every(cell => Math.abs(cell.width - cell.height) < 1);
      }), true, 'board cells remain square');
      for (const [type, name] of [['p', 'Divisions-Dennis'], ['n', 'Luigi Lækkermat'], ['b', 'Matematik-Marley'], ['r', 'Øbbe Øvdig'], ['q', 'Superheltepigen']]) {
        const button = page.locator(`[data-buy="${type}"]`);
        assert.ok((await button.getAttribute('aria-label')).includes(name));
        assert.match(await button.locator('img').getAttribute('src'), new RegExp(`/w-${type}\\.webp$`));
      }
      await page.screenshot({ path: `test-results/skak/characters-${width}.png`, fullPage: true });

      // A solved task still buys a normal legal move; artwork follows the pawn.
      const answer = await page.evaluate(() => testGame.state.problem.answer);
      await page.locator('input[name="answer"]').fill(String(answer));
      await page.locator('[data-form="answer"] button[type="submit"]').click();
      await page.locator('[data-sq="e2"]').click();
      assert.equal(await page.locator('[data-sq="e4"]').evaluate(cell => cell.classList.contains('target')), true);
      await page.locator('[data-sq="e4"]').click();
      await artAt(page, 'e4', 'w-p', 'Divisions-Dennis');
      await page.evaluate(() => testGame());
      await page.close();
    }

    const black = await open(390);
    await black.evaluate(() => Object.assign(testGame.state, { myColor: 'b', phase: 'move', fen: SkakCore.applyMove(SkakCore.START_FEN, 'e2', 'e4').fen }));
    await black.locator('[data-sq="b8"]').click();
    assert.equal(await black.locator('.sk-board button').first().getAttribute('data-sq'), 'h1', 'black sees the flipped board');
    await artAt(black, 'e8', 'b-k', 'Kejser Dummo');
    for (const [type, name] of [['p', 'Surling'], ['n', 'Erling Ærgerlig'], ['b', 'Broder Brok'], ['r', 'Gunnar Giderik'], ['q', 'Eksamens-Else']]) {
      const button = black.locator(`[data-buy="${type}"]`);
      assert.ok((await button.getAttribute('aria-label')).includes(name));
      assert.match(await button.locator('img').getAttribute('src'), new RegExp(`/b-${type}\\.webp$`));
    }
    await black.evaluate(() => testGame());
    await black.close();

    const promotion = await open(1280);
    await promotion.evaluate(() => Object.assign(testGame.state, { phase: 'move', fen: '8/P6k/8/8/8/8/8/K7 w - - 0 1', selected: null, targets: [] }));
    await promotion.locator('[data-sq="a7"]').click();
    await promotion.locator('[data-sq="a8"]').click();
    await artAt(promotion, 'a8', 'w-q', 'Superheltepigen');
    await promotion.evaluate(() => testGame());
    await promotion.close();

    const fallback = await open(390, true);
    assert.equal(await fallback.locator('[data-sq="e1"] .sk-piece-fallback').isVisible(), true, 'missing art keeps the king playable and identifiable');
    assert.equal(await fallback.locator('[data-sq="e1"] img').isVisible(), false);
    await artAt(fallback, 'd1', 'w-q', 'Superheltepigen');
    await fallback.evaluate(() => testGame());
    await fallback.close();
    assert.deepEqual(errors, []);
    console.log('PASS: 12 character identities, 32 starting pieces, white/black shops, mobile layouts, legal move, queen promotion and image fallback.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
