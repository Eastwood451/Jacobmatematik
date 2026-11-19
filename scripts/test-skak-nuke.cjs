/* Atomangreb: HP-/strike-/cooldown-logik (ren Node) + browserflow mod computeren. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../skak-core.js');
require('../skak-chess-lib.js');
const { Chess } = globalThis.ChessLib;

function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

// ---------- HP ----------
assert.deepEqual({ ...S.PIECE_HP }, { p: 1, n: 2, b: 2, r: 3, q: 5 });
assert.equal(S.maxHp('k'), 0, 'kongen har ingen HP');

// ---------- opgaver: gange, division, brøk ----------
const r = rng(11);
for (let i = 0; i < 300; i++) {
  const m = S.makeStrikeProblem(0, r); assert.equal(m.kind, 'nuke-mul'); const [a, b] = m.text.split(' × ').map(Number); assert.equal(a * b, m.answer);
  const d = S.makeStrikeProblem(1, r); assert.equal(d.kind, 'nuke-div'); const [x, y] = d.text.split(' : ').map(Number); assert.equal(x / y, d.answer); assert.ok(Number.isInteger(d.answer));
  const f = S.makeStrikeProblem(2, r); assert.equal(f.kind, 'nuke-frac');
  const mm = f.text.match(/^(\d+)\/(\d+) af (\d+)$/); assert.ok(mm, f.text);
  const [n, den, whole] = mm.slice(1).map(Number);
  assert.ok(n < den && Number.isInteger(f.answer) && f.answer === whole / den * n, f.text);
  assert.equal(S.checkAnswer(f, String(f.answer)), true);
}
assert.throws(() => S.makeStrikeProblem(3));

// ---------- cooldown: 3 almindelige egne træk før første angreb og mellem angreb ----------
let me = S.newPlayerMeta();
const label = () => S.strikeStatus(me).reason;
assert.equal(label(), 'Klar om 3 træk'); assert.equal(S.strikeStatus(me).ok, false);
me = S.recordTurn(me); assert.equal(label(), 'Klar om 2 træk');
me = S.recordTurn(me); assert.equal(label(), 'Klar om 1 træk');
me = S.recordTurn(me); assert.equal(S.strikeStatus(me).ok, true); assert.equal(label(), 'Klar!');
assert.equal(S.strikeStatus(me, { inCheck: true }).ok, false, 'ikke i skak');
me = S.recordTurn(me, { struck: true });
assert.equal(me.strikes, 1); assert.equal(me.lastStrikeTurn, 3);
assert.equal(label(), 'Klar om 3 træk');
me = S.recordTurn(me); me = S.recordTurn(me); assert.equal(label(), 'Klar om 1 træk');
me = S.recordTurn(me); assert.equal(S.strikeStatus(me).ok, true);
// Køb tæller som et almindeligt træk for cooldown
me = S.recordTurn(me, { struck: true }); me = S.recordTurn(me, { bought: true }); assert.equal(label(), 'Klar om 2 træk');

// ---------- mål: aldrig kongen, aldrig egne, aldrig noget der giver skak ----------
const start = S.START_FEN;
const t0 = S.strikeTargets(start, 'w');
assert.equal(t0.length, 15, '15 sorte brikker uden kongen');
assert.ok(!t0.includes('e8'));
assert.ok(t0.every(sq => sq[1] === '7' || sq[1] === '8'));
assert.deepEqual(S.strikeTargets(start, 'b'), [], 'ikke din tur');
// Fjerner man en brik, der blokerer for et angreb på kongen, ville det give skak → ikke et mål (når det er dræbende)
const pinFen = '4k3/4p3/8/8/8/8/8/4RK2 w - - 0 1';
assert.ok(!S.strikeTargets(pinFen, 'w').includes('e7'), 'bonde (1 liv) der skærmer kongen kan ikke rammes');
const pinQ = '4k3/4q3/8/8/8/8/8/4RK2 w - - 0 1';
assert.ok(S.strikeTargets(pinQ, 'w').includes('e7'), 'ikke-dræbende træffer er ok');
assert.ok(!S.strikeTargets(pinQ, 'w', { e7: 4 }).includes('e7'), 'sidste træffer ville give skak → ikke ok');
// I skak → ingen mål
assert.deepEqual(S.strikeTargets('4k3/8/8/8/8/8/4q3/4K3 w - - 0 1', 'w'), []);

// ---------- applyStrike: HP falder, ved 0 fjernes brikken, turen skifter ----------
for (const [type, hp] of Object.entries(S.PIECE_HP)) {
  let fen = `4k3/8/8/3${type}4/8/8/8/3RK3 w - - 0 1`;
  let dmg = {};
  for (let hit = 1; hit <= hp; hit++) {
    const res = S.applyStrike(fen, 'w', 'd5', dmg);
    assert.equal(res.type, type);
    assert.equal(res.hp, hp - hit);
    assert.equal(res.killed, hit === hp, `${type} hit ${hit}`);
    assert.equal(S.turnOf(res.fen), 'b');
    const c = new Chess(res.fen);
    if (res.killed) { assert.equal(c.get('d5'), undefined); assert.equal(res.damage.d5, undefined); }
    else { assert.equal(c.get('d5').type, type); assert.equal(S.hpOf(res.fen, res.damage, 'd5').hp, hp - hit); }
    // giv turen tilbage til hvid uden at flytte noget
    fen = res.fen.replace(' b ', ' w ');
    dmg = res.damage;
  }
}
assert.throws(() => S.applyStrike(start, 'w', 'e8', {}), /kan ikke rammes/);
assert.throws(() => S.applyStrike(start, 'w', 'e2', {}), /kan ikke rammes/);
// Et dræbt tårn fjerner også rokaderetten
const castle = S.applyStrike('r3k3/8/8/8/8/8/8/R3K3 w Qq - 0 1', 'w', 'a8', { a8: 2 });
assert.equal(castle.killed, true);
assert.equal(castle.fen.split(' ')[2], 'Q');
assert.equal(S.gameStatus(castle.fen).over, false);

// ---------- skaden følger brikken ----------
let mv = S.applyMove('4k3/8/8/3q4/8/8/8/3RK3 b - - 0 1', 'd5', 'a5');
assert.deepEqual(S.moveDamage({ d5: 3 }, mv), { a5: 3 });
mv = S.applyMove('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5');
assert.deepEqual(S.moveDamage({ d5: 3, d1: 1 }, mv), { d5: 1 }, 'slået brik mister sin skade, angriberen beholder sin');
mv = S.applyMove('r3k3/8/8/8/8/8/8/4K3 b q - 0 1', 'e8', 'c8');
assert.deepEqual(S.moveDamage({ a8: 2 }, mv), { d8: 2 }, 'rokade flytter tårnets skade');
mv = S.applyMove('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7', 'a8', 'q');
assert.deepEqual(S.moveDamage({ a7: 0.5 }, mv), {}, 'forfremmet brik er frisk');

console.log('PASS: nuke core — HP, problems, cooldown, targets, strike, damage transfer');

// ---------- Browser ----------
if (process.env.SKAK_NUKE_SKIP_BROWSER) process.exit(0);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const origin = 'https://skak-nuke-test.invalid';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const errors = [];
  async function open(width, height) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"></head><body style="margin:0"><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>window.testGame=JacobSkak.mount(document.getElementById("game"),{backend:{configured:false}})</script></body></html>` });
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
      return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
    });
    await page.goto(origin);
    await page.locator('[data-act="start-cpu"]').click();
    return page;
  }
  const answerNow = page => page.evaluate(() => testGame.state.problem.answer);
  async function answer(page, value) {
    await page.locator('input[name="answer"]:not([disabled])').fill(String(value));
    await page.locator('[data-form="answer"] button[type="submit"]').click();
  }
  try {
    for (const [w, h, label] of [[1100, 820, 'desktop'], [390, 844, 'portrait'], [844, 390, 'landscape']]) {
      const page = await open(w, h);
      // HP-bjælker på alle brikker undtagen kongerne
      assert.equal(await page.locator('.sk-hp').count(), 30, `${label}: 30 HP bars`);
      assert.equal(await page.locator('[data-sq="e1"] .sk-hp, [data-sq="e8"] .sk-hp').count(), 0);
      assert.equal(await page.locator('[data-sq="d8"] .sk-hp i').count(), 5);
      // Cooldown-indikator ved start
      assert.equal((await page.locator('.sk-nuke-label').textContent()).trim(), 'Klar om 3 træk');
      assert.equal(await page.locator('[data-act="nuke"]').isDisabled(), true);
      // Spring 3 egne træk frem via state (samme greb som de andre skak-tests), og stil en kendt stilling
      await page.evaluate(() => {
        const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
        const m = SkakCore.newMeta(); m.w.turns = 3; m.b.turns = 3;
        Object.assign(testGame.state, { fen, meta: m, status: SkakCore.gameStatus(fen), phase: 'solve', problem: { text: '1 + 1', answer: 2, kind: 'let' }, damage: {}, lockUntil: 0 });
      });
      await answer(page, 2); // render → fase "move"
      assert.equal((await page.locator('.sk-nuke-label').textContent()).trim(), 'Klar!');
      await page.locator('[data-act="nuke"]').click();
      assert.equal(await page.evaluate(() => testGame.state.phase), 'nuke-solve');
      // 1: gange (forkert svar → kort besked, samme stykke igen)
      const first = await page.evaluate(() => testGame.state.problem.text);
      assert.match(first, /×/);
      await answer(page, -1);
      await page.waitForSelector('.sk-feedback.wrong');
      assert.match(await page.locator('.sk-feedback').textContent(), /prøv igen/i);
      await page.waitForSelector('input[name="answer"]:not([disabled])', { timeout: 3000 });
      assert.equal(await page.evaluate(() => testGame.state.problem.text), first, 'samme stykke igen');
      await answer(page, await answerNow(page));
      assert.match(await page.evaluate(() => testGame.state.problem.text), / : /);
      await answer(page, await answerNow(page));
      assert.match(await page.evaluate(() => testGame.state.problem.text), /\/\d+ af /);
      await answer(page, await answerNow(page));
      assert.equal(await page.evaluate(() => testGame.state.phase), 'nuke-target');
      assert.equal(await page.locator('.sk-sq.nuke-target').count(), 15);
      assert.equal(await page.locator('[data-sq="e8"].nuke-target').count(), 0, 'kongen kan ikke rammes');
      // Kongen og egne brikker ignoreres
      await page.locator('[data-sq="e8"]').click();
      await page.locator('[data-sq="e2"]').click();
      assert.equal(await page.evaluate(() => testGame.state.phase), 'nuke-target');
      // Ram dronningen: 5 → 4 liv, brikken bliver stående
      await page.locator('[data-sq="d8"]').click();
      await page.waitForSelector('.sk-fx-layer[data-strike="hit"]');
      const st = await page.evaluate(() => ({ phase: testGame.state.phase, dmg: testGame.state.damage, meta: testGame.state.meta.w, fen: testGame.state.fen }));
      assert.equal(st.dmg.d8, 1); assert.equal(st.meta.strikes, 1); assert.equal(st.meta.lastStrikeTurn, 3);
      assert.equal(new Chess(st.fen).get('d8').type, 'q');
      assert.equal(await page.locator('[data-sq="d8"] .sk-hp i.on').count(), 4);
      // Computeren svarer; derefter er det min tur, og cooldown viser 3 træk
      await page.waitForFunction(() => testGame.state.phase === 'solve', null, { timeout: 6000 });
      assert.equal((await page.locator('.sk-nuke-label').textContent()).trim(), 'Klar om 3 træk');
      // Skaden følger dronningen, hvis computeren flyttede den
      const after = await page.evaluate(() => ({ dmg: testGame.state.damage, fen: testGame.state.fen }));
      const qSq = Object.keys(after.dmg)[0];
      if (qSq) assert.equal(new Chess(after.fen).get(qSq)?.type, 'q');
      if (label === 'desktop') await page.screenshot({ path: 'test-results/skak-nuke-cooldown.png' });
      await page.evaluate(() => testGame());
      await page.close();
    }

    // Drab: bonde (1 liv) fjernes, og spillet fortsætter lovligt
    const kp = await open(1100, 820);
    await kp.evaluate(() => {
      const fen = '4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1';
      const m = SkakCore.newMeta(); m.w.turns = 5;
      Object.assign(testGame.state, { fen, meta: m, status: SkakCore.gameStatus(fen), phase: 'solve', problem: { text: '1 + 1', answer: 2, kind: 'let' }, damage: {}, lockUntil: 0 });
    });
    await answer(kp, 2);
    await kp.locator('[data-act="nuke"]').click();
    for (let i = 0; i < 3; i++) await answer(kp, await answerNow(kp));
    await kp.locator('[data-sq="d5"]').click();
    await kp.waitForSelector('.sk-fx-layer[data-strike="kill"]');
    assert.equal(await kp.evaluate(() => new ChessLib.Chess(testGame.state.fen).get('d5')), undefined);
    assert.equal(await kp.locator('[data-sq="d5"] .sk-piece').count(), 0);
    await kp.waitForSelector('.sk-fx-layer[data-death="slime"]', { timeout: 1500 });
    await kp.waitForFunction(() => testGame.state.phase === 'solve' || testGame.state.phase === 'over', null, { timeout: 6000 });
    await kp.evaluate(() => testGame());
    await kp.close();

    // Online uden reglen (chess_games.nuke = false): ingen atomknap og ingen HP-bjælker, badge "slået fra"
    const op = await open(1100, 820);
    await op.evaluate(() => { testGame.state.mode = 'online'; testGame.state.online.game = { id: 'x', code: 'ABCDE', nuke: false, version: 1 }; testGame.state.phase = 'wait'; });
    await op.evaluate(() => { testGame.state.problem = { text: '1 + 1', answer: 2, kind: 'let' }; testGame.state.phase = 'solve'; });
    await answer(op, 2);
    assert.equal(await op.locator('.sk-nuke').count(), 0);
    assert.equal(await op.locator('.sk-hp').count(), 0);
    assert.equal(await op.locator('[data-rule-badge="off"]').count(), 1);
    await op.close();

    // "☑ Nuclear strike!" i menuen: til som standard mod computeren; slået fra → klassisk skak
    const cp = await open(1100, 820);
    await cp.locator('[data-act="menu"]').click();
    const cpuBox = cp.locator('[data-rule="cpu-nuke"]');
    assert.equal(await cpuBox.isChecked(), true, 'mod computeren: til som standard');
    assert.match(await cp.locator('label.sk-rule-toggle').first().textContent(), /Nuclear strike!/);
    await cp.locator('label.sk-rule-toggle').first().click();
    assert.equal(await cpuBox.isChecked(), false);
    await cp.locator('[data-act="start-cpu"]').click();
    assert.equal(await cp.locator('.sk-nuke').count(), 0, 'regel fra: intet atomangreb');
    assert.equal(await cp.locator('.sk-hp').count(), 0, 'regel fra: ingen HP-bjælker');
    assert.equal(await cp.locator('[data-rule-badge="off"]').count(), 1);
    await cp.locator('[data-act="menu"]').click();
    assert.equal(await cp.locator('[data-rule="cpu-nuke"]').isChecked(), false, 'valget huskes i menuen');
    await cp.locator('[data-rule="cpu-nuke"]').check();
    await cp.locator('[data-act="start-cpu"]').click();
    assert.equal(await cp.locator('.sk-nuke').count(), 1);
    assert.equal(await cp.locator('[data-rule-badge="on"]').count(), 1);
    await cp.close();

    assert.deepEqual(errors, []);
    console.log('PASS: nuke browser — HP bars, cooldown label, 3-problem unlock with retry, king untargetable, hit/kill, CPU continues, online rule off hidden, menu checkbox on/off');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
