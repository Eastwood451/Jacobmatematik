/* Deterministic mid-animation frames via WAAPI currentTime. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const out = process.env.SKAK_ANIM_OUT || '/workspace/reports/skak-anim-preview';
const origin = 'https://skak-anim-mid.invalid';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 780 }, deviceScaleFactor: 2 });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><link rel="stylesheet" href="skak.css"><style>body{margin:0;background:#f3e8d4}</style></head><body><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>`,
      });
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
  });
  await page.goto(origin);
  await page.locator('[data-act="start-cpu"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.sk-character img')].every(img => img.complete));

  // Build a capture position and take FLIP mid-frame by pausing animations
  const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
  await page.evaluate(f => {
    Object.assign(testGame.state, {
      fen: f, phase: 'solve', problem: { text: '1+1', answer: 2, kind: 'let' },
      selected: null, targets: [], lockUntil: 0, status: SkakCore.gameStatus(f), myColor: 'w',
    });
  }, fen);
  await page.locator('input[name="answer"]').fill('2');
  await page.locator('[data-form="answer"] button[type="submit"]').click();
  await page.waitForSelector('.sk-board:not(.locked)');

  // Patch SkakAnim.playFlip to pause at 40% for screenshot hook
  await page.evaluate(() => {
    const orig = SkakAnim.playFlip;
    window.__skakShotReady = null;
    window.SkakAnim = Object.assign({}, SkakAnim, {
      playFlip(board, firsts, info) {
        const p = orig.call(SkakAnim, board, firsts, info);
        // Pause all animations on flying pieces + fx layer
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.getAnimations().forEach(a => {
              try { a.currentTime = Math.min((a.effect?.getTiming?.().duration || 450) * 0.4, a.effect?.getTiming?.().duration || 450); a.pause(); } catch (_) {}
            });
            window.__skakShotReady = true;
          });
        });
        return p;
      },
    });
  });

  await page.locator('[data-sq="b5"]').click();
  await page.locator('[data-sq="c6"]').click();
  await page.waitForFunction(() => window.__skakShotReady === true, null, { timeout: 3000 });
  await page.waitForTimeout(50);
  await page.locator('.sk-board-wrap').screenshot({ path: path.join(out, '11-capture-paused-mid-desktop.png') });
  await page.screenshot({ path: path.join(out, '11b-capture-paused-full.png'), fullPage: true });

  // Resume and let finish, then glide mid for e2-e4 on fresh game
  await page.evaluate(() => document.getAnimations().forEach(a => { try { a.play(); } catch (_) {} }));
  await page.waitForTimeout(900);
  await page.close();

  // Fresh page for glide mid
  const page2 = await browser.newPage({ viewport: { width: 1100, height: 780 }, deviceScaleFactor: 2 });
  await page2.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><link rel="stylesheet" href="skak.css"><style>body{margin:0;background:#f3e8d4}</style></head><body><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>`,
      });
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
  });
  await page2.goto(origin);
  await page2.locator('[data-act="start-cpu"]').click();
  await page2.waitForFunction(() => [...document.querySelectorAll('.sk-character img')].every(img => img.complete));
  await page2.evaluate(() => {
    Object.assign(testGame.state, {
      phase: 'solve', problem: { text: '1+1', answer: 2, kind: 'let' }, lockUntil: 0, selected: null, targets: [],
    });
  });
  await page2.locator('input[name="answer"]').fill('2');
  await page2.locator('[data-form="answer"] button[type="submit"]').click();
  await page2.waitForSelector('.sk-board:not(.locked)');
  await page2.evaluate(() => {
    const orig = SkakAnim.playFlip;
    window.__skakShotReady = null;
    window.SkakAnim = Object.assign({}, SkakAnim, {
      playFlip(board, firsts, info) {
        const p = orig.call(SkakAnim, board, firsts, info);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.getAnimations().forEach(a => {
            try { a.currentTime = (a.effect?.getTiming?.().duration || 450) * 0.45; a.pause(); } catch (_) {}
          });
          window.__skakShotReady = true;
        }));
        return p;
      },
    });
  });
  await page2.locator('[data-sq="e2"]').click();
  await page2.locator('[data-sq="e4"]').click();
  await page2.waitForFunction(() => window.__skakShotReady === true);
  await page2.waitForTimeout(40);
  await page2.locator('.sk-board-wrap').screenshot({ path: path.join(out, '12-glide-paused-mid-desktop.png') });
  await page2.screenshot({ path: path.join(out, '12b-glide-paused-full.png'), fullPage: true });
  await page2.close();
  await browser.close();
  console.log('mid frames written');
})().catch(e => { console.error(e); process.exitCode = 1; });
