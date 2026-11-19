/* Atomangreb online: to browser-kontekster (hvid + sort) mod den rigtige migration i en lokal PGlite-database.
   Klientens Supabase-kald (rpc + select) sendes til PGlite som den indloggede bruger. Ingen rigtig Supabase.
   Kør: PGLITE_MODULE=…/@electric-sql/pglite PLAYWRIGHT_MODULE=… CHROME_PATH=… node scripts/test-skak-nuke-online.cjs
   SKAK_PREVIEW_DIR=<mappe> gemmer screenshots + video af begge spillere. Uden PGlite: SKIP (exit 0). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite')); }
catch (_) { console.log('SKIP: @electric-sql/pglite ikke installeret (sæt PGLITE_MODULE)'); process.exit(0); }
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const origin = 'https://skak-nuke-online.invalid';
const preview = process.env.SKAK_PREVIEW_DIR ? path.resolve(process.env.SKAK_PREVIEW_DIR) : null;
const USERS = {
  w: { id: '11111111-1111-4111-8111-111111111111', name: 'Alma', role: 'student' },
  b: { id: '22222222-2222-4222-8222-222222222222', name: 'Bo', role: 'student' },
};
const ARG_TYPES = { p_game: 'uuid', p_version: 'integer', p_fen: 'text', p_move: 'jsonb', p_meta: 'jsonb', p_status: 'text', p_result: 'text', p_reason: 'text', p_square: 'text', p_code: 'text', p_nuke: 'boolean' };
const RPCS = new Set(['create_chess_game', 'join_chess_game', 'submit_chess_move', 'submit_chess_strike', 'resign_chess_game']);

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key, name text);
    insert into public.profiles values ('${USERS.w.id}', '${USERS.w.name}'), ('${USERS.b.id}', '${USERS.b.name}');
  `);
  for (const f of ['20261009070553_skak_games.sql', '20261119143000_skak_nuke_online.sql']) {
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'));
  }
  // Som PostgREST: kald som brugeren (rollen authenticated) i én transaktion.
  const asUser = (uid, fn) => db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    await tx.query('set local role authenticated');
    return fn(tx);
  });
  const rpcLog = [];
  async function rpc(uid, name, args) {
    if (!RPCS.has(name)) throw new Error('unknown rpc ' + name);
    const keys = Object.keys(args || {});
    keys.forEach(k => { if (!ARG_TYPES[k]) throw new Error('bad arg ' + k); });
    const params = keys.map(k => (ARG_TYPES[k] === 'jsonb' && args[k] != null ? JSON.stringify(args[k]) : args[k]));
    const sql = `select to_jsonb(r) as row from public.${name}(${keys.map((k, i) => `${k} => $${i + 1}::${ARG_TYPES[k]}`).join(', ')}) r`;
    rpcLog.push(name);
    return asUser(uid, async tx => (await tx.query(sql, params)).rows[0].row);
  }
  const selectGame = (uid, id) => asUser(uid, async tx => (await tx.query('select to_jsonb(g) as row from public.chess_games g where id = $1', [id])).rows[0]?.row || null);
  const serverGame = async id => (await db.query('select to_jsonb(g) as row from public.chess_games g where id = $1', [id])).rows[0].row;

  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const errors = [];
  if (preview) fs.mkdirSync(preview, { recursive: true });
  async function openAs(color) {
    const user = USERS[color];
    const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, ...(preview ? { recordVideo: { dir: path.join(preview, 'raw'), size: { width: 1000, height: 760 } } } : {}) });
    await context.exposeFunction('__rpc', (name, args) => rpc(user.id, name, args));
    await context.exposeFunction('__row', id => selectGame(user.id, id));
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${color}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${color} console: ${m.text()}`); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="skak.css"></head><body style="margin:0"><main id="game"></main><script src="skak-chess-lib.js"></script><script src="skak-core.js"></script><script src="skak-anim.js"></script><script src="skak.js"></script><script>
        const client = {
          rpc: async (name, args) => { try { return { data: await window.__rpc(name, args || {}), error: null }; } catch (e) { return { data: null, error: { message: String(e && e.message || e) } }; } },
          from: () => ({ select: () => ({ eq: (_c, id) => ({ maybeSingle: async () => ({ data: await window.__row(id), error: null }) }) }) }),
        };
        window.testGame = JacobSkak.mount(document.getElementById("game"), { user: ${JSON.stringify(user)}, backend: { configured: true, realtimeClient: client } });
      </script></body></html>` });
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'x' });
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
      return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
    });
    await page.goto(origin);
    return { page, context };
  }
  const shot = async (page, name) => { if (preview) await page.screenshot({ path: path.join(preview, name) }); };
  const state = (page, fn) => page.evaluate(fn);
  async function answer(page, value) {
    await page.locator('input[name="answer"]:not([disabled])').fill(String(value));
    await page.locator('[data-form="answer"] button[type="submit"]').click();
  }
  const answerNow = page => page.evaluate(() => testGame.state.problem.answer);
  const waitPhase = (page, phases, timeout = 8000) => page.waitForFunction(p => p.includes(testGame.state.phase), phases, { timeout });
  async function playMove(page, from, to) {
    await waitPhase(page, ['solve']);
    await answer(page, await answerNow(page));
    await page.locator(`[data-sq="${from}"]`).click();
    await page.locator(`[data-sq="${to}"]`).click();
    await page.waitForFunction(() => testGame.state.phase === 'wait', null, { timeout: 4000 });
  }
  async function unlockNuke(page) {
    await waitPhase(page, ['solve']);
    await answer(page, await answerNow(page));
    await page.locator('[data-act="nuke"]').click();
    for (let i = 0; i < 3; i++) await answer(page, await answerNow(page));
    await waitPhase(page, ['nuke-target'], 3000);
  }

  let W, B;
  try {
    W = await openAs('w');
    B = await openAs('b');
    // ---------- menu: "☑ Nuclear strike!" ----------
    assert.equal(await W.page.locator('[data-rule="cpu-nuke"]').isChecked(), true, 'mod computeren: til');
    assert.equal(await W.page.locator('[data-rule="online-nuke"]').isChecked(), false, 'online: fra som standard');
    await W.page.locator('[data-rule="online-nuke"]').check();
    await W.page.locator('[data-rule="online-nuke"]').scrollIntoViewIfNeeded();
    await shot(W.page, '01-menu-checkbox-nuclear-strike.png');
    await W.page.locator('[data-act="create-online"]').click();
    await W.page.waitForSelector('.sk-code-panel [data-rule-badge="on"]');
    const code = await state(W.page, () => testGame.state.online.game.code);
    assert.match(code, /^[A-Z2-9]{5}$/);
    await shot(W.page, '02-lobby-kode-og-regel-til.png');

    await B.page.locator('input[name="code"]').fill(code);
    await B.page.locator('[data-form="join"] button[type="submit"]').click();
    await B.page.waitForSelector('.sk-board');
    await W.page.waitForSelector('.sk-board', { timeout: 6000 });
    for (const P of [W, B]) {
      assert.equal(await P.page.locator('[data-rule-badge="on"]').count(), 1, 'begge ser at reglen er til');
      assert.equal(await P.page.locator('.sk-hp').count(), 30, 'HP-bjælker hos begge');
      assert.equal(await P.page.locator('.sk-nuke').count(), 1);
    }
    await shot(B.page, '03-sort-ser-regel-til.png');
    const gameId = await state(W.page, () => testGame.state.online.game.id);
    assert.equal((await serverGame(gameId)).nuke, true);

    // ---------- tre almindelige træk hver (synkroniseret via RPC + polling) ----------
    const moves = [[W, 'e2', 'e4'], [B, 'e7', 'e5'], [W, 'g1', 'f3'], [B, 'b8', 'c6'], [W, 'f1', 'c4'], [B, 'g8', 'f6']];
    for (const [P, from, to] of moves) await playMove(P.page, from, to);
    await waitPhase(W.page, ['solve'], 8000);
    assert.equal((await W.page.locator('.sk-nuke-label').textContent()).trim(), 'Klar!');

    // ---------- hvid bomber sort dronning (ikke dræbende) ----------
    await unlockNuke(W.page);
    assert.equal(await W.page.locator('[data-sq="e8"].nuke-target').count(), 0, 'kongen kan ikke rammes');
    await shot(W.page, '04-hvid-vaelger-maal.png');
    await W.page.locator('[data-sq="d8"]').click();
    await W.page.waitForSelector('.sk-fx-layer[data-strike="hit"]');
    await W.page.waitForTimeout(500);
    await shot(W.page, '05-hvid-missil.png');
    // serveren har valideret og gemt angrebet
    await W.page.waitForFunction(() => testGame.state.online.game.moves.at(-1)?.strike === 'd8', null, { timeout: 4000 });
    let g = await serverGame(gameId);
    assert.deepEqual(g.damage, { d8: 1 });
    assert.deepEqual(g.moves.at(-1), { by: 'w', strike: 'd8', san: '☢d8', type: 'q', killed: false, hp: 4, max: 5 });
    assert.equal(g.meta.w.strikes, 1);
    // sort modtager angrebet: animation, HP 4/5, besked
    await B.page.waitForSelector('.sk-fx-layer[data-strike="hit"]', { timeout: 6000 });
    await B.page.waitForTimeout(700);
    await shot(B.page, '06-sort-modtager-angreb.png');
    await B.page.waitForFunction(() => testGame.state.damage.d8 === 1, null, { timeout: 3000 });
    assert.equal(await B.page.locator('[data-sq="d8"] .sk-hp i.on').count(), 4, 'sort ser 4/5 liv');
    assert.match(await B.page.locator('.sk-obbe p').textContent(), /ramte din dronning på d8/);
    await W.page.waitForTimeout(1200);
    assert.equal((await W.page.locator('.sk-nuke-label').textContent()).trim(), 'Klar om 3 træk', 'cooldown hos hvid');
    assert.equal(await W.page.locator('[data-sq="d8"] .sk-hp i.on').count(), 4, 'hvid ser også 4/5');
    await shot(W.page, '07-hvid-cooldown-klar-om-3.png');

    // ---------- sort svarer igen: dræbende angreb på hvid bonde h2 ----------
    await B.page.waitForTimeout(1400);
    await unlockNuke(B.page);
    await B.page.locator('[data-sq="h2"]').click();
    await B.page.waitForSelector('.sk-fx-layer[data-strike="kill"]');
    await W.page.waitForSelector('.sk-fx-layer[data-strike="kill"]', { timeout: 6000 });
    await W.page.waitForTimeout(900);
    await shot(W.page, '08-hvid-modtager-draebende-angreb.png');
    g = await serverGame(gameId);
    assert.equal(g.moves.at(-1).killed, true);
    assert.equal(g.fen.split(' ')[0], 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PP1/RNBQK2R', 'h2 væk, dronning står');
    await W.page.waitForFunction(() => !new ChessLib.Chess(testGame.state.fen).get('h2'), null, { timeout: 3000 });
    assert.match(await W.page.locator('.sk-obbe p').textContent(), /bombede din bonde på h2/);

    // ---------- serveren afviser snyd: cooldown og angreb uden for tur ----------
    const cheat = await W.page.evaluate(async () => (await (window.__rpc('submit_chess_strike', { p_game: testGame.state.online.game.id, p_version: testGame.state.online.game.version, p_square: 'f6' }).then(() => 'ok', e => String(e.message || e)))));
    assert.match(cheat, /cooling down/, 'cooldown håndhæves på serveren');
    const offTurn = await B.page.evaluate(async () => (await (window.__rpc('submit_chess_strike', { p_game: testGame.state.online.game.id, p_version: testGame.state.online.game.version, p_square: 'a2' }).then(() => 'ok', e => String(e.message || e)))));
    assert.match(offTurn, /Not your turn|version_conflict/);

    // skaden følger dronningen, når sort flytter den
    await playMove(W.page, 'd2', 'd3');
    await playMove(B.page, 'd8', 'e7');
    g = await serverGame(gameId);
    assert.deepEqual(g.damage, { e7: 1 }, 'skade flyttet på serveren');
    await W.page.waitForFunction(() => testGame.state.damage.e7 === 1, null, { timeout: 4000 });
    assert.equal(await W.page.locator('[data-sq="e7"] .sk-hp i.on').count(), 4);

    // ---------- kamp uden reglen: begge ser "slået fra", ingen HP/atomknap ----------
    await W.page.locator('[data-act="leave-online"]').click();
    await B.page.locator('[data-act="leave-online"]').click();
    await W.page.locator('[data-rule="online-nuke"]').uncheck();
    await W.page.locator('[data-act="create-online"]').click();
    await W.page.waitForSelector('.sk-code-panel [data-rule-badge="off"]');
    const code2 = await state(W.page, () => testGame.state.online.game.code);
    await B.page.locator('input[name="code"]').fill(code2);
    await B.page.locator('[data-form="join"] button[type="submit"]').click();
    await B.page.waitForSelector('.sk-board');
    await W.page.waitForSelector('.sk-board', { timeout: 6000 });
    for (const P of [W, B]) {
      assert.equal(await P.page.locator('[data-rule-badge="off"]').count(), 1);
      assert.equal(await P.page.locator('.sk-hp').count(), 0);
      assert.equal(await P.page.locator('.sk-nuke').count(), 0);
    }
    await shot(B.page, '09-kamp-uden-regel-slaaet-fra.png');
    const g2 = await serverGame(await state(W.page, () => testGame.state.online.game.id));
    assert.equal(g2.nuke, false);

    assert.deepEqual(errors, []);
    assert.ok(rpcLog.filter(n => n === 'submit_chess_strike').length >= 4);
    console.log('PASS: nuke online browser — checkbox (cpu on / online off), rule badge for both, synced hit + kill between two players, server cooldown/turn rejection, damage follows piece, rule-off game');
  } finally {
    const videos = [];
    for (const P of [W, B]) { if (P) { const v = P.page.video(); await P.context.close(); if (v) videos.push(await v.path()); } }
    await browser.close();
    if (preview && videos.length === 2) {
      const { execFileSync } = require('node:child_process');
      try {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', videos[0], '-i', videos[1], '-filter_complex',
          '[0:v]pad=iw+8:ih:0:0:white,drawtext=text=Hvid (Alma):x=12:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[a];[1:v]drawtext=text=Sort (Bo):x=12:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[b];[a][b]hstack=inputs=2',
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', path.join(preview, 'skak-nuke-online-to-spillere.mp4')]);
      } catch (e) { console.warn('ffmpeg:', e.message); }
    }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
