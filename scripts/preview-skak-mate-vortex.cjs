/* Headless preview: video + stills af skakmat-hvirvelen. Skriver til
   SKAK_VORTEX_OUT (standard /workspace/reports/skak-king-vortex-preview/). */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const out = process.env.SKAK_VORTEX_OUT || '/workspace/reports/skak-king-vortex-preview';
const origin = 'https://skak-mate-vortex-preview.invalid';
const MATE_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(out, 'raw'), { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 760 }, recordVideo: { dir: path.join(out, 'raw'), size: { width: 960, height: 760 } } });
  const page = await ctx.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"><style>body{margin:0;background:#f6efe2}#lbl{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99;background:#1a1028dd;color:#fff;font:700 22px system-ui;padding:6px 16px;border-radius:10px}</style></head><body><div id="lbl"></div><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>` });
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
  });
  await page.goto(origin);
  await page.locator('[data-act="start-cpu"]').click();
  const label = t => page.evaluate(x => { document.getElementById('lbl').textContent = x; }, t);
  const board = page.locator('.sk-board-wrap');

  await page.evaluate(f => Object.assign(testGame.state, {
    fen: f, status: SkakCore.gameStatus(f), phase: 'solve',
    problem: { text: '1 + 1', answer: 2, kind: 'let' },
    selected: null, targets: [], lastMove: null, lockUntil: 0, myColor: 'w', matedSq: null,
  }), MATE_IN_1);
  await page.locator('input[name="answer"]').fill('2');
  await page.locator('[data-form="answer"] button[type="submit"]').click();
  await page.waitForSelector('.sk-board:not(.locked)');
  await page.waitForFunction(() => [...document.querySelectorAll('.sk-board img')].every(i => i.complete));
  await label('Mat i ét træk: tårnet sætter mat');
  await board.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await board.screenshot({ path: path.join(out, 'still-1-foer-mat.png') });

  await page.locator('[data-sq="a1"]').click();
  await page.locator('[data-sq="a8"]').click();
  await label('Skakmat! Kongen suges ned i hvirvelen');
  await page.waitForSelector('.sk-fx-layer[data-death="vortex"]', { timeout: 2000 });
  await page.waitForTimeout(280);
  await board.screenshot({ path: path.join(out, 'still-2-hvirvel-midte.png') });
  await page.waitForTimeout(420);
  await board.screenshot({ path: path.join(out, 'still-3-kongen-forsvinder.png') });
  await page.waitForFunction(() => testGame.state.phase === 'over', null, { timeout: 3000 });
  await page.waitForTimeout(500);
  await label('Kampen er slut — kongen er væk');
  await board.screenshot({ path: path.join(out, 'still-4-efter-besked.png') });
  await page.waitForTimeout(1400);

  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  const destWebm = path.join(out, 'skak-king-vortex-preview.webm');
  const destMp4 = path.join(out, 'skak-king-vortex-preview.mp4');
  fs.renameSync(webm, destWebm);
  fs.rmSync(path.join(out, 'raw'), { recursive: true, force: true });
  const ff = spawnSync('ffmpeg', ['-y', '-i', destWebm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', destMp4], { encoding: 'utf8' });
  if (ff.status !== 0) {
    console.error(ff.stderr);
    throw new Error('ffmpeg failed');
  }
  await browser.close();
  console.log('preview written to', out);
})().catch(e => { console.error(e); process.exitCode = 1; });
