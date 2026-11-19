/* Headless preview: video + stills af hver døds-effekt. Skriver til SKAK_DEATH_OUT
   (standard /workspace/reports/skak-death-preview/). */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const out = process.env.SKAK_DEATH_OUT || '/workspace/reports/skak-death-preview';
const origin = 'https://skak-death-preview.invalid';
const CASES = [
  ['p', 'bonde', 'grøn slim'], ['n', 'springer', 'lynnedslag'], ['b', 'løber', 'ildkugle'],
  ['r', 'tårn', 'smuldrer til sten'], ['q', 'dronning', 'stjerne-eksplosion'],
];
const fenFor = t => `4k3/8/8/3${t}4/8/8/8/3RK3 w - - 0 1`;
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
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
  for (const [t, name, fx] of CASES) {
    await page.evaluate(f => Object.assign(testGame.state, { fen: f, status: SkakCore.gameStatus(f), phase: 'solve', problem: { text: '1 + 1', answer: 2, kind: 'let' }, selected: null, targets: [], lastMove: null, lockUntil: 0, myColor: 'w' }), fenFor(t));
    await page.locator('input[name="answer"]').fill('2');
    await page.locator('[data-form="answer"] button[type="submit"]').click();
    await page.waitForSelector('.sk-board:not(.locked)');
    await page.waitForFunction(() => [...document.querySelectorAll('.sk-board img')].every(i => i.complete));
    await label(`Tårn slår ${name}: ${fx}`);
    await board.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.locator('[data-sq="d1"]').click();
    await page.locator('[data-sq="d5"]').click();
    await page.waitForTimeout({ p: 230, n: 160, b: 420, r: 430, q: 320 }[t]);
    await board.screenshot({ path: path.join(out, `still-${t}-${{ p: 'groen-slim', n: 'lynnedslag', b: 'ildkugle', r: 'sten', q: 'stjerner' }[t]}.png`) });
    await page.waitForTimeout(1500);
  }
  // Konge (kan ikke slås i rigtigt skak — vises via demo-API'et)
  await label('Konge: sort hul (kun demo — en konge kan ikke slås)');
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const img = [...document.querySelectorAll('.sk-board img')].find(i => /b-k\.webp/.test(i.getAttribute('src')));
    const sq = img.closest('[data-sq]').dataset.sq;
    SkakAnim.playDeath(document.querySelector('.sk-board'), sq, 'k');
  });
  await page.waitForTimeout(380);
  await board.screenshot({ path: path.join(out, 'still-k-sort-hul.png') });
  await page.waitForTimeout(1300);
  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(out, 'skak-death-preview.webm'));
  fs.rmSync(path.join(out, 'raw'), { recursive: true, force: true });
  await browser.close();
  console.log('preview written to', out);
})().catch(e => { console.error(e); process.exitCode = 1; });
