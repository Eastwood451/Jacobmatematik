/* Skak med regnestykker: regnestykker, køb af brikker, FEN/lovlige træk, computer og app-gating.
   Ingen live-database: online-delen testes kun via sin kontrakt (RPC-navne + migration). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const S = require('../skak-core.js');
require("../skak-chess-lib.js");
const { Chess } = globalThis.ChessLib;

// Deterministisk RNG
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

// ---------- regnestykker ----------
function evalText(text) {
  return Function(`"use strict";return (${text.replace(/×/g, "*").replace(/−/g, "-").replace(/ : /g, "/")})`)();
}
const kinds = ["let", "mellem", "svaer", 1, 2, 3, 4];
const maxAnswer = { let: 20, mellem: 100, svaer: 100, 1: 100, 2: 81, 3: 351, 4: 475 };
for (const kind of kinds) {
  const r = rng(7 + String(kind).length);
  for (let i = 0; i < 400; i++) {
    const p = S.makeProblem(kind, r);
    assert.equal(p.kind, kind);
    assert.equal(evalText(p.text), p.answer, `${kind}: ${p.text} = ${p.answer}`);
    assert.ok(Number.isInteger(p.answer) && p.answer >= 0 && p.answer <= maxAnswer[kind], `${kind}: svar uden for interval ${p.text}=${p.answer}`);
    assert.ok(S.checkAnswer(p, String(p.answer)));
    assert.ok(S.checkAnswer(p, ` ${p.answer} `));
    assert.ok(!S.checkAnswer(p, String(p.answer + 1)));
  }
}
// Tier 1 skal have tierovergang
{ const r = rng(3); for (let i = 0; i < 200; i++) { const p = S.makeProblem(1, r); const [a, op, b] = p.text.split(" "); const A = +a, B = +b;
  if (op === "+") assert.ok((A % 10) + B >= 10, p.text); else assert.ok((A % 10) < B, p.text); } }
// Sværhed stiger: gennemsnitligt svar pr. trin
const avg = kind => { const r = rng(11); let t = 0; for (let i = 0; i < 300; i++) t += S.makeProblem(kind, r).answer; return t / 300; };
assert.ok(avg(4) > avg(3) && avg(3) > avg(2) && avg(2) > avg("let"), "sværhed skal stige med brikkens værdi");
assert.equal(S.checkAnswer({ answer: 12 }, ""), false);
assert.equal(S.checkAnswer({ answer: 12 }, "12a"), false);
assert.equal(S.checkAnswer({ answer: 12 }, "1 2"), true);
assert.throws(() => S.makeProblem("umuligt"));

// Butik: jo sværere, jo bedre brik
assert.deepEqual(S.SHOP.map(i => i.type), ["p", "n", "b", "r", "q"]);
assert.deepEqual(S.SHOP.map(i => i.tier), [1, 2, 2, 3, 4]);

// ---------- købsregler ----------
let me = S.newPlayerMeta();
assert.equal(S.buyStatus(me).ok, false, "ingen køb før første træk");
assert.match(S.buyStatus(me).reason, /om 3 træk/);
for (let i = 0; i < 3; i++) me = S.recordTurn(me);
assert.equal(S.buyStatus(me).ok, true);
assert.equal(S.buyStatus(me, { inCheck: true }).ok, false, "ingen køb i skak");
me = S.recordTurn(me, { bought: true });
assert.deepEqual(me, { turns: 4, buys: 1, lastBuyTurn: 3 });
assert.equal(S.buyStatus(me).ok, false, "cooldown efter køb");
for (let i = 0; i < 2; i++) { me = S.recordTurn(me); assert.equal(S.buyStatus(me).ok, false); }
me = S.recordTurn(me);
assert.equal(S.buyStatus(me).ok, true, `køb igen efter ${S.RULES.cooldownTurns} træk`);
for (let k = 0; k < 3; k++) { me = S.recordTurn(me, { bought: true }); for (let i = 0; i < 3; i++) me = S.recordTurn(me); }
assert.equal(me.buys, 4);
assert.equal(S.buyStatus(me).ok, false, "maks 4 køb");
assert.match(S.buyStatus(me).reason, /alle 4/);

// ---------- placering af ekstra brik ----------
assert.deepEqual(S.dropSquares(S.START_FEN, "w", "n"), [], "ingen tomme felter i udgangsstillingen");
// Hvid har flyttet springer g1 og bonde e2; sort er i træk -> hvid må ikke placere
const afterNf3e4 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3";
assert.deepEqual(S.dropSquares(afterNf3e4, "b", "n"), [], "kun i egen tur");
assert.deepEqual(S.dropSquares(afterNf3e4, "w", "n").sort(), ["e2", "g1"]);
assert.deepEqual(S.dropSquares(afterNf3e4, "w", "p"), ["e2"], "bønder kun på 2. række");
assert.deepEqual(S.dropSquares(afterNf3e4, "w", "k"), [], "konger kan ikke købes");
const drop = S.applyDrop(afterNf3e4, "w", "q", "g1");
assert.equal(drop.fen.split(" ")[1], "b", "køb bruger turen");
assert.equal(drop.fen.split(" ")[3], "-");
assert.equal(new Chess(drop.fen).get("g1").type, "q");
assert.ok(new Chess(drop.fen).moves().length > 0, "FEN efter køb er gyldig og spilbar");
assert.throws(() => S.applyDrop(afterNf3e4, "w", "q", "e4"), /må ikke/);
assert.throws(() => S.applyDrop(afterNf3e4, "w", "p", "g1"), /må ikke/);
// Sort placering: kun række 7-8, fuldtræk tæller op
const blackToMove = "rnbqk1nr/pppp1ppp/8/2b1p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 3";
assert.deepEqual(S.dropSquares(blackToMove, "b", "r").sort(), ["e7", "f8"]);
const bDrop = S.applyDrop(blackToMove, "b", "r", "f8");
assert.equal(bDrop.fen.split(" ")[5], "4");
// Må ikke give skak: sort konge på e8 åben e-linje -> tårn på e1/e2 ville give skak
const openFile = "4k3/8/8/8/8/8/3P1P2/3K4 w - - 0 1";
const rookSquares = S.dropSquares(openFile, "w", "r");
assert.ok(!rookSquares.includes("e1") && !rookSquares.includes("e2"), "købt brik må ikke give skak");
assert.ok(rookSquares.includes("a1"));
// I skak: ingen placering
assert.deepEqual(S.dropSquares("4k3/8/8/8/8/8/8/r3K3 w - - 0 1", "w", "n"), []);

// ---------- træk og status ----------
const m = S.applyMove(S.START_FEN, "e2", "e4");
assert.equal(m.san, "e4");
assert.equal(S.turnOf(m.fen), "b");
assert.throws(() => S.applyMove(S.START_FEN, "e2", "e5"));
assert.deepEqual(S.legalTargets(S.START_FEN, "g1").sort(), ["f3", "h3"]);
assert.deepEqual(S.legalTargets(S.START_FEN, "e7"), [], "ikke modstanderens brikker");
const promo = S.applyMove("8/P6k/8/8/8/8/8/K7 w - - 0 1", "a7", "a8");
assert.equal(new Chess(promo.fen).get("a8").type, "q", "automatisk dronning");
const mate = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
assert.deepEqual(S.gameStatus(mate), { over: true, result: "0-1", winner: "b", reason: "skakmat" });
assert.equal(S.gameStatus("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").reason, "pat");
assert.equal(S.gameStatus("7k/8/6K1/8/8/8/8/8 w - - 0 1").reason, "for lidt materiale");
assert.equal(S.gameStatus(S.START_FEN).over, false);

// ---------- computer ----------
const mateIn1 = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
for (const level of [2, 3]) assert.equal(S.chooseComputerMove(mateIn1, level, () => 0.9).san, "Ra8#", `niveau ${level} finder mat i 1`);
{ // Lovlige træk i en hel kamp, inkl. stillinger med ekstra brikker
  const r = rng(99); let fen = S.applyDrop(afterNf3e4, "w", "n", "g1").fen; let plies = 0;
  while (!S.gameStatus(fen).over && plies < 40) {
    const mv = S.chooseComputerMove(fen, 1 + (plies % 2), r, { timeLimitMs: 300 });
    fen = S.applyMove(fen, mv.from, mv.to, mv.promotion || "q").fen; plies++;
  }
  assert.ok(plies > 0);
}
{ const t = Date.now(); S.chooseComputerMove("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", 3); assert.ok(Date.now() - t < 4000, "svær computer tænker under 4 sek."); }

// ---------- integration: lazy-load + gating ----------
const app = fs.readFileSync("app.js", "utf8");
const loader = fs.readFileSync("module-loader.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
for (const f of ["skak.js", "skak-core.js", "skak-chess-lib.js"]) {
  assert.match(loader, new RegExp(f.replace(".", "\\.")));
  assert.doesNotMatch(index, new RegExp(`src=["']${f.replace(".", "\\.")}`), `${f} må ikke loade ved opstart`);
}
assert.match(loader, /skak\.css/);
assert.doesNotMatch(index, /href=["']skak\.css/);
assert.match(app, /ensureModule\("skak", "skak"\)/);
assert.match(app, /SKAK_PROFILE_IDS = new Set\(\["c8b8e1c4-3264-40e9-a43d-0eb6214a0183"/);
assert.match(app, /state\.view==="skak"\) renderSkak\(\)/);
// Gating-funktionen: kun Jacob + testelev
const gate = app.match(/const SKAK_PROFILE_IDS = [^\n]+\n\s*const canPlaySkak = [^\n]+/)[0];
const gateFn = vm.runInNewContext(`(state => { ${gate}; return canPlaySkak; })`, {});
const canPlay = user => gateFn({ user })();
assert.equal(canPlay({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "teacher" }), true);
assert.equal(canPlay({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true);
assert.equal(canPlay({ id: "someone-else", role: "teacher" }), false);
assert.equal(canPlay({ id: "guest-1", role: "guest" }), false);
assert.equal(canPlay(null), false);
// Loader-kortet
const sandbox = { window: {}, document: { querySelectorAll: () => [], scripts: [], head: { appendChild() {} }, createElement: () => ({}) } };
vm.runInNewContext(loader, sandbox);
assert.equal(sandbox.window.JacobModules.modules.skak.js.map(s => s.split("?")[0]).join(","), "skak-chess-lib.js,skak-core.js,skak.js");

// Online-kontrakt: RPC'er i UI findes i migrationen, og tabellen har RLS
const ui = fs.readFileSync("skak.js", "utf8");
const migration = fs.readdirSync("supabase/migrations").find(f => /_skak_games\.sql$/.test(f));
assert.ok(migration, "skak-migration findes");
const sql = fs.readFileSync(`supabase/migrations/${migration}`, "utf8");
for (const fn of ["create_chess_game", "join_chess_game", "submit_chess_move", "resign_chess_game"]) {
  assert.match(ui, new RegExp(`"${fn}"`));
  assert.match(sql, new RegExp(`create or replace function public\\.${fn}`));
  assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`));
}
assert.match(sql, /alter table public\.chess_games enable row level security/);
assert.match(sql, /revoke all on table public\.chess_games from anon, authenticated/);
assert.match(sql, /using \(\(select auth\.uid\(\)\) = white_id or \(select auth\.uid\(\)\) = black_id\)/);
assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*chess_games/i, "ingen direkte skriveadgang");

console.log("skak checks passed");
