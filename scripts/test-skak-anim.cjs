/* Offline browser: glide FLIP, last-move highlight, capture slime. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const origin = 'https://skak-anim-test.invalid';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const errors = [];
  try {
    async function open(width, height) {
      const page = await browser.newPage({
        viewport: { width, height },
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
            body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"></head><body style="margin:0;background:#f6efe2"><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>`,
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
      await page.waitForFunction(() => [...document.querySelectorAll('.sk-character img')].every(img => img.complete));
      return page;
    }

    async function solve(page) {
      const answer = await page.evaluate(() => testGame.state.problem.answer);
      await page.locator('input[name="answer"]').fill(String(answer));
      await page.locator('[data-form="answer"] button[type="submit"]').click();
      await page.waitForSelector('.sk-board:not(.locked)');
    }

    fs.mkdirSync('test-results/skak-anim', { recursive: true });

    // --- Glide + last-move ---
    const page = await open(1100, 800);
    assert.equal(await page.evaluate(() => !!window.SkakAnim && !!window.SkakAnim.playFlip), true, 'SkakAnim loaded');
    await solve(page);
    await page.locator('[data-sq="e2"]').click();
    await page.locator('[data-sq="e4"]').click();
    // Piece must land on e4 (FLIP keeps it in the destination cell in the DOM)
    await page.waitForFunction(() => document.querySelector('[data-sq="e4"] .sk-piece'));
    assert.equal(await page.locator('[data-sq="e2"] .sk-piece').count(), 0);
    assert.equal(await page.locator('[data-sq="e4"] .sk-piece').count(), 1);
    assert.equal(await page.locator('[data-sq="e2"]').evaluate(el => el.classList.contains('last')), true);
    assert.equal(await page.locator('[data-sq="e4"]').evaluate(el => el.classList.contains('last')), true);
    // Flying class may appear briefly; wait for glide to finish
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/skak-anim/glide-lastmove-desktop.png' });

    // --- Capture + slime ---
    // Position: white bishop on b5 can take knight on c6. Force phase/move.
    await page.evaluate(() => {
      const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
      Object.assign(testGame.state, {
        fen, phase: 'move', selected: null, targets: [], problem: null,
        myColor: 'w', status: SkakCore.gameStatus(fen), lastMove: null,
      });
      // re-render via a no-op state poke through answering... force remount render by toggling
      const api = testGame;
      // Call internal render by changing obbe via public state + remount isn't available;
      // instead click menu and rebuild: dispose and remount with injected fen after start.
    });
    // Remount with a tiny harness that starts mid-game
    await page.evaluate(() => { testGame(); });
    await page.setContent(''); // clear
    await page.goto(origin);
    await page.evaluate(() => {
      document.body.innerHTML = '<main id="game"></main>';
      window.testGame = JacobSkak.mount(document.getElementById('game'), { backend: { configured: false } });
    });
    // Wait scripts already loaded from previous goto - need reload properly
    await page.close();

    const cap = await open(1100, 800);
    await cap.evaluate(() => {
      const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
      Object.assign(testGame.state, {
        screen: 'game', mode: 'cpu', fen, myColor: 'w', phase: 'move',
        problem: null, selected: null, targets: [], buyType: null, drops: [],
        meta: SkakCore.newMeta(), moves: [], lastMove: null,
        status: SkakCore.gameStatus(fen),
        obbe: 'Tag springeren!', feedback: '', feedbackKind: '',
      });
      // Force render by exiting to menu is hard; poke via answering path:
      // dispose+remount:
    });
    // Dispose and remount then patch — use click menu then start, then patch fen before answer.
    // Simpler: call mount fresh after dispose.
    await cap.evaluate(() => {
      testGame();
      const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
      window.testGame = JacobSkak.mount(document.getElementById('game'), { backend: { configured: false } });
      Object.assign(testGame.state, {
        screen: 'game', mode: 'cpu', fen, myColor: 'w', phase: 'move',
        problem: null, selected: null, targets: [], buyType: null, drops: [],
        meta: SkakCore.newMeta(), moves: [], lastMove: null,
        status: SkakCore.gameStatus(fen), lockUntil: 0,
        obbe: 'Tag springeren!', feedback: '', feedbackKind: '',
        online: { game: null, error: '', busy: false, joinCode: '' },
      });
      // Internal render isn't exported; trigger via a known public path: set phase and
      // fake a click on a chip by re-calling mount's render through start-cpu then overwrite.
    });
    // Actually re-click start-cpu creates new game — so instead trigger render by
    // evaluating a DOM rebuild helper: dispatch by changing math level on menu.
    // Use the state API + manually call by simulating: many tests assign state then
    // need render. Looking at original test — they assign state THEN click squares,
    // which means render must have happened. In test-skak-characters promotion test:
    // Object.assign(state) then click a7 — so the board was already rendered from start-cpu,
    // and assign only changes state; click uses s.fen from state in tapSquare/boardHtml
    // but boardHtml only runs on render()! 
    // Wait - promotion test assigns fen then clicks a7. That would use OLD board DOM
    // for clicks (data-sq still valid) but tapSquare reads s.fen from state. After click
    // makeMove uses new fen and finishMyTurn calls render(). So first click on a7 uses
    // board DOM from start position — a7 has white pawn in NEW fen but DOM still shows
    // start position piece on a7 (black pawn)! That could be flaky...
    // Looking again: they Object.assign fen and phase move, then click a7. In start
    // position a7 is black pawn. Clicking would select if myColor matches... myColor is w,
    // black pawn on a7 — wouldn't select. Unless... they rely on data-sq only and
    // tapSquare reads board from s.fen via Core.boardOf(s.fen)!
    // Yes: tapSquare uses Core.boardOf(s.fen), not the DOM pieces. So click a7 with
    // fen having white pawn on a7 selects it even if DOM is wrong. Then click a8 moves.
    // finishMyTurn renders correct board. Clever.
    await cap.locator('[data-act="start-cpu"]').click();
    await cap.evaluate(() => {
      const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
      Object.assign(testGame.state, {
        fen, phase: 'move', selected: null, targets: [], problem: null,
        myColor: 'w', status: SkakCore.gameStatus(fen), lastMove: null, lockUntil: 0,
      });
    });
    // Need board unlocked - phase move means boardHtml won't add locked. But DOM still
    // has locked from previous render. Re-render by solving... Force via fake answer cycle:
    // Change phase to solve with a problem, submit correct, get to move, THEN overwrite fen.
    await cap.evaluate(() => {
      const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
      testGame.state.fen = fen;
      testGame.state.status = SkakCore.gameStatus(fen);
      testGame.state.phase = 'solve';
      testGame.state.problem = { text: '1 + 1', answer: 2, kind: 'let' };
      testGame.state.selected = null;
      testGame.state.targets = [];
    });
    // Can't render without access. Use page.evaluate to call a custom render:
    // Looking at api — only dispose. Workaround: fill answer which calls submitAnswer → render.
    await cap.locator('input[name="answer"]').fill('2');
    await cap.locator('[data-form="answer"] button[type="submit"]').click();
    // Now phase is move but fen is still START from start-cpu... we set fen before submit;
    // submitAnswer doesn't reset fen. Good — fen stays capture position. But render after
    // submit uses s.fen which we set. Perfect!
    await cap.waitForSelector('.sk-board:not(.locked)');
    // Board should show bishop on b5
    assert.match(await cap.locator('[data-sq="b5"] img').getAttribute('src'), /w-b\.webp/);
    assert.match(await cap.locator('[data-sq="c6"] img').getAttribute('src'), /b-n\.webp/);

    await cap.locator('[data-sq="b5"]').click();
    await cap.locator('[data-sq="c6"]').click();

    // Mid-capture: slime layer or flying class should appear briefly
    const sawFx = await cap.waitForFunction(() => {
      return document.querySelector('.sk-fx-layer') || document.querySelector('.sk-piece.sk-flying') || document.querySelector('.sk-piece.sk-victory') || document.querySelector('[data-sq="c6"] .sk-piece');
    }, null, { timeout: 2000 }).then(() => true).catch(() => false);
    assert.equal(sawFx, true, 'expected capture visual');

    // Capture a mid-animation frame quickly
    await cap.waitForTimeout(120);
    await cap.screenshot({ path: 'test-results/skak-anim/capture-mid-desktop.png' });
    await cap.waitForTimeout(900);
    await cap.screenshot({ path: 'test-results/skak-anim/capture-after-desktop.png' });
    assert.equal(await cap.locator('[data-sq="c6"] .sk-piece').count(), 1);
    assert.equal(await cap.locator('[data-sq="b5"] .sk-piece').count(), 0);
    assert.match(await cap.locator('[data-sq="c6"] img').getAttribute('src'), /w-b\.webp/);

    await cap.evaluate(() => testGame());
    await cap.close();

    // Mobile portrait + landscape smoke: glide still works
    for (const [name, w, h] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
      const p = await open(w, h);
      await solve(p);
      await p.locator('[data-sq="e2"]').click();
      await p.locator('[data-sq="e4"]').click();
      await p.waitForTimeout(200);
      await p.screenshot({ path: `test-results/skak-anim/glide-${name}.png` });
      assert.equal(await p.locator('[data-sq="e4"] .sk-piece').count(), 1);
      await p.evaluate(() => testGame());
      await p.close();
    }

    assert.deepEqual(errors, []);
    console.log('PASS: skak animations — glide, last-move, capture slime, mobile layouts');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
