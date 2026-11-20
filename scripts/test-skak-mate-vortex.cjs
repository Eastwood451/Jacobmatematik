/* Offline browser: ved skakmat suges den matte konge ned i en sort hvirvel,
   FØR "Du vandt/tabte"-teksten vises. Begge farver, CPU-mat (computeren sætter mat),
   og prefers-reduced-motion får en kort fade i stedet for hvirvelen. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const origin = 'https://skak-mate-vortex-test.invalid';

// Hvid sætter mat: tårn a1-a8. Sort konge på g8.
const WHITE_MATES = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
// Sort (os) sætter mat: tårn a8-a1. Hvid konge på g1.
const BLACK_MATES = 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1';
// Hvid flytter springeren c3-e4; computeren (sort, niveau 3) sætter baglinje-mat med Ta1#.
const CPU_WILL_MATE = 'r5k1/5ppp/8/8/8/2N5/5PPP/6K1 w - - 0 1';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const errors = [];
  async function open(reducedMotion = 'no-preference') {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, reducedMotion });
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
  async function setPosition(page, fen, { myColor = 'w', aiLevel = 3 } = {}) {
    await page.evaluate(({ f, myColor, aiLevel }) => {
      Object.assign(testGame.state, {
        fen: f, status: SkakCore.gameStatus(f), phase: 'solve',
        problem: { text: '1 + 1', answer: 2, kind: 'let' },
        selected: null, targets: [], lastMove: null, lockUntil: 0,
        myColor, aiLevel, matedSq: null,
      });
    }, { f: fen, myColor, aiLevel });
    await page.locator('input[name="answer"]').fill('2');
    await page.locator('[data-form="answer"] button[type="submit"]').click();
    await page.waitForSelector('.sk-board:not(.locked)');
  }
  function overText(page) {
    return page.locator('.sk-status.over').textContent();
  }

  try {
    // 1) Vi (hvid) sætter sort konge mat — hvirvel FØR "Du vandt"
    const p1 = await open();
    await setPosition(p1, WHITE_MATES);
    await p1.locator('[data-sq="a1"]').click();
    await p1.locator('[data-sq="a8"]').click();
    await p1.waitForSelector('.sk-fx-layer[data-death="vortex"]', { timeout: 2000 });
    const mid1 = await p1.evaluate(() => ({
      phase: testGame.state.phase,
      over: Boolean(document.querySelector('.sk-status.over')),
      sucked: Boolean(document.querySelector('[data-sq="g8"] .sk-piece.sk-sucked, [data-sq="g8"] .sk-piece.sk-vanished')),
      vortex: Boolean(document.querySelector('.sk-fx-layer[data-death="vortex"]')),
      status: document.querySelector('.sk-status')?.textContent || '',
    }));
    assert.equal(mid1.phase, 'mate-fx', 'fase er mate-fx mens hvirvelen kører');
    assert.equal(mid1.over, false, 'ingen "over"-status midt i hvirvelen');
    assert.ok(mid1.vortex, 'hvirvel-lag vises');
    assert.equal(mid1.status.trim(), 'Skakmat!');
    await p1.waitForFunction(() => testGame.state.phase === 'over', null, { timeout: 3000 });
    const end1 = await p1.evaluate(() => ({
      phase: testGame.state.phase,
      matedSq: testGame.state.matedSq,
      king: Boolean(document.querySelector('[data-sq="g8"] .sk-piece')),
      vortex: Boolean(document.querySelector('.sk-fx-layer[data-death="vortex"]')),
      text: document.querySelector('.sk-status.over')?.textContent || '',
    }));
    assert.equal(end1.phase, 'over');
    assert.equal(end1.matedSq, 'g8');
    assert.equal(end1.king, false, 'sort konge er væk efter hvirvelen');
    assert.equal(end1.vortex, false, 'hvirvel-lag er ryddet op');
    assert.match(end1.text, /vandt/i);
    assert.match(end1.text, /skakmat/i);
    await p1.close();

    // 2) Vi (sort) sætter hvid konge mat — virker for begge farver
    const p2 = await open();
    await setPosition(p2, BLACK_MATES, { myColor: 'b' });
    await p2.locator('[data-sq="a8"]').click();
    await p2.locator('[data-sq="a1"]').click();
    await p2.waitForSelector('.sk-fx-layer[data-death="vortex"]', { timeout: 2000 });
    assert.equal(await p2.evaluate(() => testGame.state.phase), 'mate-fx');
    assert.equal(await p2.locator('.sk-status.over').count(), 0);
    await p2.waitForFunction(() => testGame.state.phase === 'over', null, { timeout: 3000 });
    const end2 = await p2.evaluate(() => ({
      matedSq: testGame.state.matedSq,
      king: Boolean(document.querySelector('[data-sq="g1"] .sk-piece')),
      text: document.querySelector('.sk-status.over')?.textContent || '',
    }));
    assert.equal(end2.matedSq, 'g1');
    assert.equal(end2.king, false, 'hvid konge er væk efter hvirvelen');
    assert.match(end2.text, /vandt/i);
    await p2.close();

    // 3) Computeren sætter os mat (samme hook som computerTurn)
    const p3 = await open();
    await setPosition(p3, CPU_WILL_MATE, { aiLevel: 3 });
    await p3.locator('[data-sq="c3"]').click();
    await p3.locator('[data-sq="e4"]').click();
    // Vent på computerens mat-træk + hvirvel (træk-animation + tænkepause)
    await p3.waitForSelector('.sk-fx-layer[data-death="vortex"]', { timeout: 6000 });
    const mid3 = await p3.evaluate(() => ({
      phase: testGame.state.phase,
      over: Boolean(document.querySelector('.sk-status.over')),
      matedSq: testGame.state.matedSq,
    }));
    assert.equal(mid3.phase, 'mate-fx');
    assert.equal(mid3.over, false, 'ingen over-besked mens computeren har sat mat');
    assert.equal(mid3.matedSq, 'g1');
    await p3.waitForFunction(() => testGame.state.phase === 'over', null, { timeout: 3000 });
    const end3 = await p3.evaluate(() => ({
      king: Boolean(document.querySelector('[data-sq="g1"] .sk-piece')),
      text: document.querySelector('.sk-status.over')?.textContent || '',
    }));
    assert.equal(end3.king, false, 'vores konge er væk efter computerens mat');
    assert.match(end3.text, /tabte/i);
    assert.match(end3.text, /skakmat/i);
    await p3.close();

    // 4) prefers-reduced-motion: kort fade, ingen hvirvel-lag, stadig før over-besked
    const rm = await open('reduce');
    const t0 = Date.now();
    await setPosition(rm, WHITE_MATES);
    await rm.locator('[data-sq="a1"]').click();
    await rm.locator('[data-sq="a8"]').click();
    await rm.waitForFunction(() => testGame.state.phase === 'mate-fx' || testGame.state.phase === 'over', null, { timeout: 2000 });
    const midRm = await rm.evaluate(() => ({
      phase: testGame.state.phase,
      fx: document.querySelectorAll('.sk-fx-layer').length,
    }));
    if (midRm.phase === 'mate-fx') {
      assert.equal(midRm.fx, 0, 'reduced motion: intet fx-lag');
      await rm.waitForFunction(() => testGame.state.phase === 'over', null, { timeout: 2000 });
    }
    const ms = Date.now() - t0;
    const endRm = await rm.evaluate(() => ({
      king: Boolean(document.querySelector('[data-sq="g8"] .sk-piece')),
      text: document.querySelector('.sk-status.over')?.textContent || '',
    }));
    assert.equal(endRm.king, false);
    assert.match(endRm.text, /vandt/i);
    assert.ok(ms < 2500, `reduced motion blev færdig hurtigt (${ms} ms)`);
    await rm.close();

    assert.deepEqual(errors, []);
    console.log('PASS: skak mate vortex — hvid mat, sort mat, computer-mat, reduced motion');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
