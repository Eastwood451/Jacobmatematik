/* Headless preview af atomangrebet: video + stillbilleder. Skriver til SKAK_NUKE_OUT
   (standard /workspace/reports/skak-nuke-preview/). */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const out = process.env.SKAK_NUKE_OUT || '/workspace/reports/skak-nuke-preview';
const origin = 'https://skak-nuke-preview.invalid';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, recordVideo: { dir: path.join(out, 'raw'), size: { width: 1180, height: 820 } } });
  const page = await ctx.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"><style>body{margin:0;background:#f6efe2}</style></head><body><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>` });
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
  });
  const shot = name => page.screenshot({ path: path.join(out, name) });
  const answer = async (v, slow = true) => {
    const input = page.locator('input[name="answer"]:not([disabled])');
    await input.waitFor();
    if (slow) await input.pressSequentially(String(v), { delay: 120 }); else await input.fill(String(v));
    await page.waitForTimeout(250);
    await page.locator('[data-form="answer"] button[type="submit"]').click();
  };
  const ans = () => page.evaluate(() => testGame.state.problem.answer);
  const setup = (fen, damage, turns) => page.evaluate(([f, d, t]) => {
    const m = SkakCore.newMeta(); m.w.turns = t; m.b.turns = t;
    Object.assign(testGame.state, { fen: f, meta: m, status: SkakCore.gameStatus(f), phase: 'solve', problem: { text: '3 + 4', answer: 7, kind: 'let' }, damage: d, lockUntil: 0, moves: [], lastMove: null });
  }, [fen, damage, turns]);

  await page.goto(origin);
  await page.locator('[data-act="start-cpu"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.sk-board img')].every(i => i.complete));
  await page.waitForTimeout(600);
  await shot('01-start-hp-bjaelker-klar-om-3-traek.png');

  // Midt i spillet, cooldown klar
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  await setup(fen, {}, 3);
  await answer(7, false);
  await page.waitForTimeout(800);
  await shot('02-atomangreb-klar.png');
  await page.locator('[data-act="nuke"]').click();
  await page.waitForTimeout(500);
  await shot('03-stykke-1-gange.png');
  await answer(-1);
  await page.waitForTimeout(400);
  await shot('04-forkert-svar-proev-igen.png');
  await answer(await ans());
  await page.waitForTimeout(400);
  await answer(await ans());
  await page.waitForTimeout(300);
  await shot('05-stykke-3-broek.png');
  await answer(await ans());
  await page.waitForTimeout(700);
  await shot('06-vaelg-maal-kongen-kan-ikke-rammes.png');
  // Ram dronningen (5 → 4 liv)
  await page.locator('[data-sq="d8"]').click();
  await page.waitForTimeout(260);
  await shot('07-missil.png');
  await page.waitForTimeout(450);
  await shot('08-svampesky.png');
  await page.waitForTimeout(900);
  await shot('09-dronning-4-af-5-liv-klar-om-3-traek.png');
  await page.waitForTimeout(1600);

  // Drab: springer med 1 liv tilbage → lynnedslag efter svampeskyen
  await setup(fen, { c6: 1 }, 6);
  await answer(7, false);
  await page.waitForTimeout(500);
  await page.locator('[data-act="nuke"]').click();
  for (let i = 0; i < 3; i++) { await answer(await ans(), false); await page.waitForTimeout(200); }
  await page.waitForTimeout(400);
  await page.locator('[data-sq="c6"]').click();
  await page.waitForTimeout(620);
  await shot('10-springer-draebt-lynnedslag.png');
  await page.waitForTimeout(2200);
  await shot('11-efter-drab.png');

  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(out, 'skak-nuke-preview.webm'));
  fs.rmSync(path.join(out, 'raw'), { recursive: true, force: true });
  await browser.close();
  console.log('preview written to', out);
})().catch(e => { console.error(e); process.exitCode = 1; });
