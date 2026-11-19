/* Atomangreb online: migrationen testet mod en lokal Postgres i WASM (PGlite) – ingen rigtig Supabase.
   Kør: PGLITE_MODULE=/sti/til/node_modules/@electric-sql/pglite node scripts/test-skak-nuke-online-sql.cjs
   Uden PGlite installeret springes testen over (exit 0). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite')); }
catch (_) { console.log('SKIP: @electric-sql/pglite ikke installeret (sæt PGLITE_MODULE)'); process.exit(0); }
const S = require('../skak-core.js');

const root = path.resolve(__dirname, '..');
const W = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const X = '33333333-3333-4333-8333-333333333333';

(async () => {
  const db = new PGlite();
  // Minimal Supabase-stub: roller, auth.uid() og profiles.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key, name text);
    insert into public.profiles values ('${W}', 'Hvid Test'), ('${B}', 'Sort Test'), ('${X}', 'Udenfor');
  `);
  for (const f of ['20261009070553_skak_games.sql', '20261119143000_skak_nuke_online.sql']) {
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'));
  }
  // Migrationen skal kunne køres to gange (idempotent).
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261119143000_skak_nuke_online.sql'), 'utf8'));

  const as = async (uid, sql, params = []) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`);
    return (await db.query(sql, params)).rows;
  };
  const rpcRow = async (uid, sql, params) => (await as(uid, sql, params))[0];
  const rejects = async (uid, sql, params, re, msg) => {
    let err = null;
    try { await as(uid, sql, params); } catch (e) { err = e; }
    assert.ok(err, msg + ' (ingen fejl)');
    assert.match(err.message, re, msg + ': ' + err.message);
  };
  const STRIKE = 'select * from public.submit_chess_strike($1, $2, $3, $4, $5, $6)';
  const MOVE = 'select * from public.submit_chess_move($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)';
  const strike = (uid, g, sq, st = 'active', res = null, why = null) => rpcRow(uid, STRIKE, [g.id, g.version, sq, st, res, why]);
  // Et almindeligt træk sendt som klienten gør (chess.js validerer i klienten).
  async function move(uid, g, from, to, meta) {
    const info = S.applyMove(g.fen, from, to, 'q');
    const st = S.gameStatus(info.fen);
    const side = S.turnOf(g.fen);
    const m = meta || { ...g.meta, [side]: S.recordTurn(g.meta[side]) };
    return rpcRow(uid, MOVE, [g.id, g.version, info.fen, JSON.stringify({ by: side, san: info.san, from, to, promotion: info.promotion }), JSON.stringify(m),
      st.over ? 'finished' : 'active', st.over ? st.result : null, st.over ? st.reason : null]);
  }
  const setFen = (g, fen, meta, damage = {}) => db.query('update public.chess_games set fen = $2, meta = $3::jsonb, damage = $4::jsonb where id = $1 returning *',
    [g.id, fen, JSON.stringify(meta), JSON.stringify(damage)]).then(r => r.rows[0]);
  const metaWith = (wTurns, bTurns, extra = {}) => ({ w: { ...S.newPlayerMeta(), turns: wTurns, ...(extra.w || {}) }, b: { ...S.newPlayerMeta(), turns: bTurns, ...(extra.b || {}) } });

  // ---------- regel-flag ----------
  let off = await rpcRow(W, 'select * from public.create_chess_game()');
  assert.equal(off.nuke, false, 'default: fra (gamle klienter uden parameter virker stadig)');
  let g = await rpcRow(W, 'select * from public.create_chess_game($1)', [true]);
  assert.equal(g.nuke, true);
  assert.deepEqual(g.damage, {});
  assert.equal(g.meta.w.strikes, 0);
  g = await rpcRow(B, 'select * from public.join_chess_game($1)', [g.code]);
  assert.equal(g.status, 'active'); assert.equal(g.nuke, true, 'begge spillere ser reglen');
  // hjælpefunktionerne kan ikke kaldes af klienter
  await db.exec('set role authenticated');
  await rejects(W, "select public.skak_board('8/8/8/8/8/8/8/8 w - - 0 1')", [], /permission denied/, 'interne hjælpere er lukkede');
  await db.exec('reset role');

  // ---------- cooldown: 3 almindelige egne træk først ----------
  await rejects(W, STRIKE, [g.id, g.version, 'd8', 'active', null, null], /cooling down/, 'cooldown før 3 træk');
  g = await move(W, g, 'e2', 'e4'); g = await move(B, g, 'e7', 'e5');
  g = await move(W, g, 'g1', 'f3'); g = await move(B, g, 'b8', 'c6');
  // klienten forsøger at snyde med meta (turns/strikes) – serveren ignorerer det
  const cheat = { w: { turns: 99, buys: 0, lastBuyTurn: null, strikes: -5, lastStrikeTurn: null }, b: { turns: 0 } };
  g = await move(W, g, 'f1', 'c4', cheat);
  assert.equal(g.meta.w.turns, 3, 'serveren tæller selv træk'); assert.equal(g.meta.w.strikes, 0); assert.equal(g.meta.b.turns, 2, 'modstanderens meta kan ikke ændres');
  await rejects(W, STRIKE, [g.id, g.version, 'd8', 'active', null, null], /Not your turn/, 'kun på egen tur');
  g = await move(B, g, 'g8', 'f6');
  assert.equal(S.strikeStatus(g.meta.w).ok, true, 'klient og server er enige om cooldown');

  // ---------- ugyldige mål ----------
  for (const [sq, why] of [['e8', 'kongen'], ['e4', 'egen brik'], ['e6', 'tomt felt'], ['z9', 'ugyldigt felt']]) {
    await rejects(W, STRIKE, [g.id, g.version, sq, 'active', null, null], /Invalid target/, why);
  }
  await rejects(W, STRIKE, [g.id, g.version - 1, 'd8', 'active', null, null], /version_conflict/, 'version');
  await rejects(X, STRIKE, [g.id, g.version, 'd8', 'active', null, null], /Game not found/, 'fremmed bruger');
  await rejects(W, STRIKE, [g.id, g.version, 'd8', 'finished', '1-0', 'skakmat'], /Invalid result/, 'et angreb kan ikke vinde kampen');
  // atomangreb kan ikke sendes som almindeligt træk
  await rejects(W, MOVE, [g.id, g.version, g.fen.replace(' w ', ' b '), JSON.stringify({ by: 'w', strike: 'd8' }), JSON.stringify(g.meta), 'active', null, null], /submit_chess_strike/, 'strike via move-RPC');

  // ---------- træffer: serveren beregner stilling, skade, meta og trækket ----------
  const before = g;
  const local = S.applyStrike(before.fen, 'w', 'd8', before.damage);
  g = await strike(W, g, 'd8');
  assert.equal(g.fen, local.fen, 'serverens FEN = klientens FEN');
  assert.deepEqual(g.damage, local.damage);
  assert.deepEqual(g.damage, { d8: 1 });
  assert.equal(g.meta.w.strikes, 1); assert.equal(g.meta.w.lastStrikeTurn, 3); assert.equal(g.meta.w.turns, 4);
  assert.deepEqual(g.moves.at(-1), { by: 'w', strike: 'd8', san: '☢d8', type: 'q', killed: false, hp: 4, max: 5 });
  assert.equal(g.version, before.version + 1);
  assert.equal(S.strikeStatus(g.meta.w).reason, 'Klar om 3 træk');
  // skaden følger dronningen (d8 → e7)
  g = await move(B, g, 'd8', 'e7');
  assert.deepEqual(g.damage, { e7: 1 }, 'skade følger brikken');
  // cooldown efter angreb
  g = await move(W, g, 'e1', 'g1'); // rokade
  g = await move(B, g, 'a7', 'a6');
  await rejects(W, STRIKE, [g.id, g.version, 'e7', 'active', null, null], /cooling down/, 'cooldown efter angreb');

  // ---------- drab: brik fjernes; tårn på hjørnet fjerner rokaderet ----------
  let k = await rpcRow(W, 'select * from public.create_chess_game($1)', [true]);
  k = await rpcRow(B, 'select * from public.join_chess_game($1)', [k.code]);
  k = await setFen(k, 'r3k3/8/8/8/8/8/8/R3K3 w Qq - 4 9', metaWith(5, 5), { a8: 2 });
  const lk = S.applyStrike(k.fen, 'w', 'a8', k.damage);
  k = await strike(W, k, 'a8');
  assert.equal(k.fen, lk.fen); assert.equal(k.fen.split(' ')[2], 'Q'); assert.deepEqual(k.damage, {});
  assert.equal(k.moves.at(-1).killed, true); assert.equal(k.moves.at(-1).san, '☢×a8');
  // sort angriber også (fuldtræk tæller op)
  k = await setFen(k, '4k3/8/8/3P4/8/8/8/4K3 b - - 0 12', metaWith(5, 5));
  const lb = S.applyStrike(k.fen, 'b', 'd5', {});
  k = await strike(B, k, 'd5');
  assert.equal(k.fen, lb.fen, 'sort: ' + k.fen);

  // ---------- dræbende angreb der giver skak afvises; ikke-dræbende er ok ----------
  let p = await rpcRow(W, 'select * from public.create_chess_game($1)', [true]);
  p = await rpcRow(B, 'select * from public.join_chess_game($1)', [p.code]);
  p = await setFen(p, '4k3/4p3/8/8/8/8/8/4RK2 w - - 0 1', metaWith(5, 5));
  await rejects(W, STRIKE, [p.id, p.version, 'e7', 'active', null, null], /would give check/, 'bonde der skærmer kongen');
  p = await setFen(p, '4k3/4q3/8/8/8/8/8/4RK2 w - - 0 1', metaWith(5, 5), { e7: 4 });
  await rejects(W, STRIKE, [p.id, p.version, 'e7', 'active', null, null], /would give check/, 'sidste træffer på skærmende dronning');
  p = await setFen(p, '4k3/4q3/8/8/8/8/8/4RK2 w - - 0 1', metaWith(5, 5), { e7: 3 });
  p = await strike(W, p, 'e7');
  assert.deepEqual(p.damage, { e7: 4 });
  // i skak → intet angreb
  p = await setFen(p, '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1', metaWith(5, 5));
  await rejects(W, STRIKE, [p.id, p.version, 'e2', 'active', null, null], /in check/, 'ikke i skak');
  // angreb der giver pat → uafgjort er tilladt
  p = await setFen(p, 'k7/2Q5/1p6/8/8/8/8/K7 w - - 0 1', metaWith(5, 5));
  const lp = S.applyStrike(p.fen, 'w', 'b6', {});
  const st = S.gameStatus(lp.fen);
  assert.equal(st.reason, 'pat');
  p = await strike(W, p, 'b6', 'finished', st.result, st.reason);
  assert.equal(p.status, 'finished'); assert.equal(p.result, '1/2-1/2');

  // ---------- regel fra: ingen angreb, ingen skade ----------
  let o = await rpcRow(W, 'select * from public.create_chess_game($1)', [false]);
  o = await rpcRow(B, 'select * from public.join_chess_game($1)', [o.code]);
  o = await setFen(o, o.fen, metaWith(5, 5));
  await rejects(W, STRIKE, [o.id, o.version, 'd8', 'active', null, null], /Nuclear strike is off/, 'regel fra');
  o = await move(W, o, 'e2', 'e4');
  assert.deepEqual(o.damage, {});

  // ---------- skade-flytning matcher SkakCore.moveDamage (en passant, rokade, forfremmelse) ----------
  const cases = [
    ['4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5', { d5: 3, d1: 1 }],
    ['r3k3/8/8/8/8/8/8/4K3 b q - 0 1', 'e8', 'c8', { a8: 2 }],
    ['4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7', 'a8', {}],
    ['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5', 'd6', { e5: 0 }],
    ['4k3/8/8/2rpP3/8/8/8/4K3 w - d6 0 1', 'e5', 'd6', { c5: 2 }],
  ];
  for (const [fen, from, to, dmg] of cases) {
    const info = S.applyMove(fen, from, to, 'q');
    const want = S.moveDamage(dmg, info);
    const [{ d }] = (await db.query('select public.skak_move_damage($1, $2, $3::jsonb, $4::jsonb) as d', [fen, info.fen, JSON.stringify(dmg), JSON.stringify({ from, to, promotion: info.promotion })])).rows;
    const clean = Object.fromEntries(Object.entries(want).filter(([, v]) => v >= 1));
    assert.deepEqual(d, clean, `${fen} ${from}-${to}`);
  }

  // ---------- skak_attacked mod chess.js på tilfældige stillinger ----------
  require('../skak-chess-lib.js');
  const { Chess } = globalThis.ChessLib;
  let checked = 0;
  for (let game = 0; game < 40; game++) {
    const c = new Chess();
    for (let ply = 0; ply < 60 && !c.isGameOver(); ply++) {
      const moves = c.moves();
      c.move(moves[(game * 31 + ply * 17) % moves.length]);
      const [{ chk }] = (await db.query('select public.skak_in_check(public.skak_board($1), $2) as chk', [c.fen(), c.turn()])).rows;
      assert.equal(chk, c.inCheck(), c.fen());
      checked++;
    }
  }
  // placement round-trip
  const [{ pl }] = (await db.query("select public.skak_placement(public.skak_board($1)) as pl", [S.START_FEN])).rows;
  assert.equal(pl, S.START_FEN.split(' ')[0]);
  console.log(`PASS: nuke online SQL — rule flag, cooldown, targets, king/own/empty, check rules, kill+castling, black strike, stalemate draw, rule off, meta/damage authority, damage transfer, ${checked} in-check positions vs chess.js`);
})().catch(e => { console.error(e); process.exitCode = 1; });
