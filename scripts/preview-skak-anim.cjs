/* Headless preview frames for skak glide + slime. Writes to /workspace/reports/skak-anim-preview/ */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const out = process.env.SKAK_ANIM_OUT || '/workspace/reports/skak-anim-preview';
const origin = 'https://skak-anim-preview.invalid';

fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(out, 'frames'), { recursive: true });

(async () => {
  const SkakStart = () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    async function open(width, height) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/') {
          return route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"><style>body{margin:0;background:#f3e8d4}</style></head><body><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>`,
          });
        }
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
        const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
        return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
      });
      await page.goto(origin);
      await page.locator('[data-act="start-cpu"]').click();
      await page.waitForFunction(() => [...document.querySelectorAll('.sk-character img')].every(img => img.complete));
      return page;
    }

    async function goToMovePhase(page, fen) {
      await page.evaluate(f => {
        Object.assign(testGame.state, {
          fen: f,
          phase: 'solve',
          problem: { text: '2 + 2', answer: 4, kind: 'let' },
          selected: null, targets: [], lockUntil: 0,
          status: SkakCore.gameStatus(f),
          myColor: 'w',
        });
      }, fen);
      await page.locator('input[name="answer"]').fill('4');
      await page.locator('[data-form="answer"] button[type="submit"]').click();
      await page.waitForSelector('.sk-board:not(.locked)');
    }

    // 1) Desktop glide mid-move frames
    {
      const page = await open(1200, 820);
      await goToMovePhase(page, SkakStart());
      await page.locator('[data-sq="e2"]').click();
      const shotBoard = async (name) => {
        const board = page.locator('.sk-board-wrap');
        await board.screenshot({ path: path.join(out, name) });
      };
      // Start move and capture frames during FLIP
      const movePromise = page.locator('[data-sq="e4"]').click();
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(55);
        await shotBoard(`frames/glide-desktop-${String(i).padStart(2, '0')}.png`);
      }
      await movePromise;
      await page.waitForTimeout(200);
      await shotBoard('01-glide-lastmove-desktop.png');
      await page.screenshot({ path: path.join(out, '01b-glide-full-desktop.png'), fullPage: true });
      await page.close();
    }

    // 2) Capture victory + slime mid frames
    {
      const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
      const page = await open(1200, 820);
      await goToMovePhase(page, fen);
      await page.locator('.sk-board-wrap').screenshot({ path: path.join(out, '02-before-capture-desktop.png') });
      await page.locator('[data-sq="b5"]').click();
      const click = page.locator('[data-sq="c6"]').click();
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(70);
        await page.locator('.sk-board-wrap').screenshot({ path: path.join(out, `frames/capture-desktop-${String(i).padStart(2, '0')}.png`) });
      }
      await click;
      await page.waitForTimeout(100);
      await page.locator('.sk-board-wrap').screenshot({ path: path.join(out, '03-capture-mid-desktop.png') });
      await page.waitForTimeout(600);
      await page.locator('.sk-board-wrap').screenshot({ path: path.join(out, '04-capture-after-desktop.png') });
      await page.screenshot({ path: path.join(out, '04b-capture-full-desktop.png'), fullPage: true });
      await page.close();
    }

    // 3) Mobile portrait + landscape capture mid
    for (const [label, w, h] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
      const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
      const page = await open(w, h);
      await goToMovePhase(page, fen);
      await page.locator('[data-sq="b5"]').click();
      const click = page.locator('[data-sq="c6"]').click();
      await page.waitForTimeout(180);
      await page.screenshot({ path: path.join(out, `05-capture-mid-${label}.png`), fullPage: true });
      await click;
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, `06-capture-after-${label}.png`), fullPage: true });
      await page.close();
    }

    // 4) Portrait glide
    {
      const page = await open(390, 844);
      await goToMovePhase(page, SkakStart());
      await page.locator('[data-sq="e2"]').click();
      const click = page.locator('[data-sq="e4"]').click();
      await page.waitForTimeout(140);
      await page.screenshot({ path: path.join(out, '07-glide-mid-portrait.png'), fullPage: true });
      await click;
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(out, '08-glide-lastmove-portrait.png'), fullPage: true });
      await page.close();
    }

    // 5) Landscape glide
    {
      const page = await open(844, 390);
      await goToMovePhase(page, SkakStart());
      await page.locator('[data-sq="e2"]').click();
      const click = page.locator('[data-sq="e4"]').click();
      await page.waitForTimeout(140);
      await page.screenshot({ path: path.join(out, '09-glide-mid-landscape.png'), fullPage: true });
      await click;
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(out, '10-glide-lastmove-landscape.png'), fullPage: true });
      await page.close();
    }

    console.log('preview written to', out);
  } finally {
    await browser.close();
  }

})().catch(err => { console.error(err); process.exitCode = 1; });
