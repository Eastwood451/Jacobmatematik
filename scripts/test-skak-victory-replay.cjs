/* Offline browser: SKAKMAT!-moment, sejrs-skærm (Kaptajn Kvadratrod) og replay.
   Ingen login/DB. Kør fra repository-rod. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const origin = 'https://skak-test.invalid';

const MATE_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
const MATE_MOVES = [
  { by: 'w', san: 'e4', from: 'e2', to: 'e4' },
  { by: 'b', san: 'e5', from: 'e7', to: 'e5' },
  { by: 'w', san: 'Bc4', from: 'f1', to: 'c4' },
  { by: 'b', san: 'Nc6', from: 'b8', to: 'c6' },
  { by: 'w', san: 'Qh5', from: 'd1', to: 'h5' },
  { by: 'b', san: 'Nf6', from: 'g8', to: 'f6' },
  { by: 'w', san: 'Qxf7#', from: 'h5', to: 'f7' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const errors = [];
  fs.mkdirSync('test-results/skak', { recursive: true });

  try {
    async function open(width) {
      const page = await browser.newPage({
        viewport: { width, height: width < 600 ? 844 : 900 },
        isMobile: width < 600,
        hasTouch: width < 600,
      });
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/') {
          return route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"></head><body style="margin:0;background:#f4efe4"><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>`,
          });
        }
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
          return route.fulfill({ status: 404, body: 'Not found' });
        }
        const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
        return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
      });
      await page.goto(origin);
      await page.locator('[data-act="start-cpu"]').click();
      await page.waitForSelector('.sk-play');
      return page;
    }

    async function seedMateWin(page, finale) {
      await page.evaluate(({ fen, moves, finale }) => {
        Object.assign(testGame.state, {
          fen,
          moves,
          lastMove: { from: 'h5', to: 'f7' },
          myColor: 'w',
          status: SkakCore.gameStatus(fen),
          phase: 'over',
          finale,
          replayPly: moves.length,
          victoryLine: 'SKAKMAT! Det er sådan man knækker nødder!',
          problem: null,
          selected: null,
          targets: [],
          buyType: null,
          drops: [],
          feedback: '',
          obbe: finale === 'mate-flash' ? 'SKAKMAT! Sejt klaret!' : 'Gå frem og tilbage i dine træk — find det afgørende hug!',
        });
        testGame.render();
      }, { fen: MATE_FEN, moves: MATE_MOVES, finale });
    }

    for (const width of [1280, 390]) {
      const page = await open(width);

      // 1) SKAKMAT!-moment
      await seedMateWin(page, 'mate-flash');
      await page.waitForSelector('.sk-mate-banner');
      assert.equal(await page.locator('.sk-mate-banner strong').innerText(), 'SKAKMAT!');
      assert.ok(await page.locator('[data-sq="e8"]').evaluate(el => el.classList.contains('skakmat')));
      await page.screenshot({ path: `test-results/skak/mate-flash-${width}.png`, fullPage: true });

      // 2) Sejrs-skærm med Kaptajn Kvadratrod
      await seedMateWin(page, 'victory');
      await page.waitForSelector('.sk-victory-overlay');
      assert.match(await page.locator('#sk-victory-title').innerText(), /SKAKMAT/);
      assert.equal(await page.locator('.sk-kaptajn-pose').getAttribute('src'), 'assets/figurer/kaptajn-kvadratrod.webp');
      await page.waitForFunction(() => {
        const img = document.querySelector('.sk-kaptajn-pose');
        return img && img.complete && img.naturalWidth > 0 && Number(getComputedStyle(img).opacity) > 0.9;
      });
      assert.equal(await page.locator('[data-act="replay"]').isVisible(), true);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `test-results/skak/victory-${width}.png`, fullPage: true });
      await page.locator('.sk-victory-card').screenshot({ path: `test-results/skak/victory-card-${width}.png` });

      // 3) Replay
      await page.locator('[data-act="replay"]').click();
      await page.waitForSelector('.sk-replay');
      assert.match(await page.locator('.sk-replay-pos').innerText(), /halvtræk 7\/7/);
      await page.locator('[data-act="replay-first"]').click();
      assert.equal(await page.locator('.sk-replay-pos').innerText(), 'Startstilling');
      assert.equal(await page.locator('[data-sq="e2"] img').count(), 1);
      await page.locator('[data-act="replay-next"]').click();
      assert.equal(await page.locator('[data-sq="e4"] img').count(), 1);
      await page.locator('[data-act="replay-last"]').click();
      assert.ok(await page.locator('[data-sq="e8"]').evaluate(el => el.classList.contains('skakmat')));
      assert.equal(await page.locator('[data-act="replay-prev"]').isEnabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${width}px no horizontal scroll`);
      await page.screenshot({ path: `test-results/skak/replay-${width}.png`, fullPage: true });

      await page.evaluate(() => testGame());
      await page.close();
    }

    assert.deepEqual(errors, []);
    console.log('PASS: SKAKMAT banner, victory overlay with Kaptajn art, and replay controls on desktop + mobile.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
