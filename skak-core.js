/* Skak med regnestykker — ren spillogik (ingen DOM). Bruges af skak.js og af scripts/test-skak.cjs. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SkakCore = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  function lib() {
    if (!root.ChessLib && typeof require === "function") require("./skak-chess-lib.js");
    if (!root.ChessLib) throw new Error("chess.js mangler");
    return root.ChessLib;
  }
  const newChess = fen => { const { Chess } = lib(); return fen ? new Chess(fen) : new Chess(); };

  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const RULES = Object.freeze({
    firstBuyAfterTurns: 3,   // man skal have lavet 3 træk før første køb
    cooldownTurns: 4,        // mindst 4 egne træk mellem to køb
    maxBuys: 4,              // højst 4 ekstra brikker pr. spil
    wrongAnswerWaitMs: 3000, // forkert svar = 3 sekunders pause + nyt stykke
  });
  const MOVE_LEVELS = Object.freeze({
    let: { label: "Let", hint: "Plus og minus til 20" },
    mellem: { label: "Mellem", hint: "Små tabeller og plus til 100" },
    svaer: { label: "Svær", hint: "Hele den lille tabel og minus til 100" },
  });
  const AI_LEVELS = Object.freeze({
    1: { label: "Let", depth: 1, randomMoveChance: 0.3, noise: 90 },
    2: { label: "Mellem", depth: 2, randomMoveChance: 0.05, noise: 12 },
    3: { label: "Svær", depth: 3, randomMoveChance: 0, noise: 0 },
  });
  const SHOP = Object.freeze([
    { type: "p", name: "Bonde", tier: 1, difficulty: "Let-mellem", stars: 1 },
    { type: "n", name: "Springer", tier: 2, difficulty: "Mellem", stars: 2 },
    { type: "b", name: "Løber", tier: 2, difficulty: "Mellem", stars: 2 },
    { type: "r", name: "Tårn", tier: 3, difficulty: "Svær", stars: 3 },
    { type: "q", name: "Dronning", tier: 4, difficulty: "Meget svær", stars: 4 },
  ]);
  const PIECE_NAMES = { p: "bonde", n: "springer", b: "løber", r: "tårn", q: "dronning", k: "konge" };
  const shopItem = type => SHOP.find(item => item.type === type) || null;

  const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];

  // kind: "let" | "mellem" | "svaer" (træk) eller 1-4 (køb af brik).
  function makeProblem(kind, rng = Math.random) {
    const add = (a, b) => ({ text: `${a} + ${b}`, answer: a + b });
    const sub = (a, b) => ({ text: `${a} − ${b}`, answer: a - b });
    const mul = (a, b) => ({ text: `${a} × ${b}`, answer: a * b });
    let problem;
    if (kind === "let") {
      if (rng() < 0.5) { const a = randInt(rng, 1, 10); problem = add(a, randInt(rng, 1, Math.min(10, 20 - a))); }
      else { const a = randInt(rng, 5, 20); problem = sub(a, randInt(rng, 1, a)); }
    } else if (kind === "mellem") {
      if (rng() < 0.5) problem = mul(pick(rng, [2, 3, 4, 5, 10]), randInt(rng, 1, 10));
      else problem = add(randInt(rng, 10, 89), randInt(rng, 1, 9));
    } else if (kind === "svaer") {
      if (rng() < 0.6) problem = mul(randInt(rng, 2, 10), randInt(rng, 2, 10));
      else { const a = randInt(rng, 30, 99); problem = sub(a, randInt(rng, 11, a - 10)); }
    } else if (kind === 1) {
      // 2-cifret ± 1-cifret med tierovergang
      const unit = randInt(rng, 2, 9), b = randInt(rng, 10 - unit, 9);
      if (rng() < 0.5) problem = add(randInt(rng, 1, 8) * 10 + unit, b);
      else { const a = randInt(rng, 2, 9) * 10 + randInt(rng, 0, 7); problem = sub(a, randInt(rng, (a % 10) + 1, 9)); }
    } else if (kind === 2) {
      problem = mul(randInt(rng, 6, 9), randInt(rng, 6, 9));
    } else if (kind === 3) {
      if (rng() < 0.5) problem = mul(randInt(rng, 12, 39), randInt(rng, 3, 9));
      else { const b = randInt(rng, 6, 9), q = randInt(rng, 6, 12); problem = { text: `${b * q} : ${b}`, answer: q }; }
    } else if (kind === 4) {
      if (rng() < 0.5) problem = mul(randInt(rng, 12, 25), randInt(rng, 11, 19));
      else { const a = randInt(rng, 6, 12), b = randInt(rng, 6, 12), c = randInt(rng, 11, 49); problem = { text: `${a} × ${b} + ${c}`, answer: a * b + c }; }
    } else {
      throw new Error("Ukendt opgavetype: " + kind);
    }
    return { ...problem, kind };
  }

  function checkAnswer(problem, raw) {
    const value = String(raw ?? "").trim().replace(/\s+/g, "").replace(/^−/, "-");
    if (!/^-?\d+$/.test(value)) return false;
    return Number(value) === problem.answer;
  }

  const newPlayerMeta = () => ({ turns: 0, buys: 0, lastBuyTurn: null, strikes: 0, lastStrikeTurn: null });
  const newMeta = () => ({ w: newPlayerMeta(), b: newPlayerMeta() });

  function buyStatus(player, { inCheck = false } = {}) {
    const p = player || newPlayerMeta();
    if (p.buys >= RULES.maxBuys) return { ok: false, turnsLeft: Infinity, reason: `Du har brugt alle ${RULES.maxBuys} ekstra brikker.` };
    if (inCheck) return { ok: false, turnsLeft: 0, reason: "Du står i skak. Red kongen først." };
    if (p.turns < RULES.firstBuyAfterTurns) {
      const n = RULES.firstBuyAfterTurns - p.turns;
      return { ok: false, turnsLeft: n, reason: `Butikken åbner om ${n} ${n === 1 ? "træk" : "træk"}.` };
    }
    if (p.lastBuyTurn != null && p.turns - p.lastBuyTurn < RULES.cooldownTurns) {
      const n = RULES.cooldownTurns - (p.turns - p.lastBuyTurn);
      return { ok: false, turnsLeft: n, reason: `Næste køb om ${n} træk.` };
    }
    return { ok: true, turnsLeft: 0, reason: "" };
  }

  function recordTurn(player, { bought = false, struck = false } = {}) {
    const p = { ...newPlayerMeta(), ...(player || {}) };
    return {
      turns: p.turns + 1,
      buys: p.buys + (bought ? 1 : 0),
      lastBuyTurn: bought ? p.turns : p.lastBuyTurn,
      strikes: p.strikes + (struck ? 1 : 0),
      lastStrikeTurn: struck ? p.turns : p.lastStrikeTurn,
    };
  }

  // ---------- Atomangreb (power-up, kun mod computeren) ----------
  // 3 rigtige stykker i træk (gange, division, brøk) låser ét angreb op. Et angreb bruger hele turen.
  // Mindst STRIKE.cooldownTurns almindelige egne træk før første angreb og mellem to angreb.
  const STRIKE = Object.freeze({ cooldownTurns: 3, problems: 3, wrongAnswerWaitMs: 1200 });
  const PIECE_HP = Object.freeze({ p: 1, n: 2, b: 2, r: 3, q: 5 });
  const maxHp = type => PIECE_HP[type] || 0; // kongen har ingen HP og kan ikke rammes

  function strikeStatus(player, { inCheck = false } = {}) {
    const p = { ...newPlayerMeta(), ...(player || {}) };
    const since = p.lastStrikeTurn == null ? p.turns : p.turns - p.lastStrikeTurn - 1;
    if (since < STRIKE.cooldownTurns) {
      const n = STRIKE.cooldownTurns - since;
      return { ok: false, turnsLeft: n, reason: `Klar om ${n} træk` };
    }
    if (inCheck) return { ok: false, turnsLeft: 0, reason: "Du står i skak. Red kongen først." };
    return { ok: true, turnsLeft: 0, reason: "Klar!" };
  }

  // step 0 = gange, 1 = division, 2 = brøk (heltalssvar, så samme svarfelt kan bruges)
  function makeStrikeProblem(step, rng = Math.random) {
    if (step === 0) {
      const a = randInt(rng, 3, 9), b = randInt(rng, 3, 9);
      return { text: `${a} × ${b}`, answer: a * b, kind: "nuke-mul" };
    }
    if (step === 1) {
      const b = randInt(rng, 2, 9), q = randInt(rng, 2, 10);
      return { text: `${b * q} : ${b}`, answer: q, kind: "nuke-div" };
    }
    if (step === 2) {
      const d = pick(rng, [2, 3, 4, 5, 10]);
      const n = pick(rng, Array.from({ length: d - 1 }, (_, i) => i + 1).filter(x => { let a = x, b = d; while (b) [a, b] = [b, a % b]; return a === 1; }));
      const whole = d * randInt(rng, 2, 10);
      return { text: `${n}/${d} af ${whole}`, answer: (whole / d) * n, kind: "nuke-frac" };
    }
    throw new Error("Ukendt angrebsstykke: " + step);
  }

  const squareOf = (r, f) => FILES[f] + (8 - r);
  function pieceAt(fen, square) {
    try { return newChess(fen).get(square) || null; } catch (_) { return null; }
  }
  function hpOf(fen, damage, square) {
    const piece = pieceAt(fen, square);
    if (!piece || !maxHp(piece.type)) return null;
    const max = maxHp(piece.type);
    const dmg = Math.max(0, Number(damage?.[square]) || 0);
    return { type: piece.type, color: piece.color, max, hp: Math.max(0, max - dmg) };
  }
  function removeRaw(fen, color, square) {
    const chess = newChess(fen);
    chess.remove(square);
    const tokens = chess.fen().split(" ");
    tokens[1] = color === "w" ? "b" : "w";
    tokens[3] = "-";
    tokens[4] = "0";
    if (color === "b") tokens[5] = String(Number(tokens[5]) + 1);
    return tokens.join(" ");
  }
  function passRaw(fen, color) {
    const tokens = String(fen).split(" ");
    tokens[1] = color === "w" ? "b" : "w";
    tokens[3] = "-";
    tokens[4] = String(Number(tokens[4] || 0) + 1);
    if (color === "b") tokens[5] = String(Number(tokens[5]) + 1);
    return tokens.join(" ");
  }
  // Fjendtlige brikker (aldrig kongen), der må rammes. Et dræbende angreb må ikke give modstanderen skak
  // (samme regel som købte brikker), så et angreb aldrig kan give skak eller skakmat.
  function strikeTargets(fen, color, damage = {}) {
    const chess = newChess(fen);
    if (chess.turn() !== color || chess.inCheck() || chess.isGameOver()) return [];
    const out = [];
    const board = chess.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.color === color || !maxHp(piece.type)) continue;
      const square = squareOf(r, f);
      const info = hpOf(fen, damage, square);
      const lethal = info.hp <= 1;
      const next = lethal ? removeRaw(fen, color, square) : passRaw(fen, color);
      try { if (newChess(next).inCheck()) continue; } catch (_) { continue; }
      out.push(square);
    }
    return out;
  }
  function applyStrike(fen, color, square, damage = {}) {
    if (!strikeTargets(fen, color, damage).includes(square)) throw new Error("Den brik kan ikke rammes.");
    const info = hpOf(fen, damage, square);
    const hp = info.hp - 1;
    const next = { ...damage };
    let newFen;
    if (hp <= 0) { delete next[square]; newFen = removeRaw(fen, color, square); }
    else { next[square] = info.max - hp; newFen = passRaw(fen, color); }
    return { fen: newFen, damage: next, square, type: info.type, killed: hp <= 0, hp: Math.max(0, hp), max: info.max };
  }
  // Flyt skade med brikken ved et almindeligt træk (info fra applyMove). Forfremmede brikker er friske.
  function moveDamage(damage, info) {
    const next = { ...(damage || {}) };
    if (!info) return next;
    if (info.capturedSq) delete next[info.capturedSq];
    const d = next[info.from];
    delete next[info.from];
    delete next[info.to];
    if (d && !info.promotion) next[info.to] = d;
    if (info.rookFrom && info.rookTo) {
      const rd = next[info.rookFrom];
      delete next[info.rookFrom];
      if (rd) next[info.rookTo] = rd;
    }
    return next;
  }

  const FILES = "abcdefgh";
  function dropRanks(color, type) {
    if (color === "w") return type === "p" ? [2] : [1, 2];
    return type === "p" ? [7] : [7, 8];
  }
  function placeRaw(fen, color, type, square) {
    const chess = newChess(fen);
    if (!chess.put({ type, color }, square)) throw new Error("Brikken kunne ikke placeres.");
    const tokens = chess.fen().split(" ");
    tokens[1] = color === "w" ? "b" : "w";
    tokens[3] = "-";
    tokens[4] = "0";
    if (color === "b") tokens[5] = String(Number(tokens[5]) + 1);
    return tokens.join(" ");
  }
  // Tomme felter på egne to bagerste rækker, hvor brikken ikke giver skak (bønder kun på 2./7. række).
  function dropSquares(fen, color, type) {
    if (!shopItem(type)) return [];
    const chess = newChess(fen);
    if (chess.turn() !== color || chess.inCheck() || chess.isGameOver()) return [];
    const squares = [];
    for (const rank of dropRanks(color, type)) {
      for (const file of FILES) {
        const square = file + rank;
        if (chess.get(square)) continue;
        try {
          const after = newChess(placeRaw(fen, color, type, square));
          if (after.inCheck()) continue; // modstanderen må ikke stå i skak af en købt brik
          squares.push(square);
        } catch (_) { /* ugyldig stilling */ }
      }
    }
    return squares;
  }
  function applyDrop(fen, color, type, square) {
    if (!dropSquares(fen, color, type).includes(square)) throw new Error("Brikken må ikke stå der.");
    return { fen: placeRaw(fen, color, type, square), drop: { color, type, square } };
  }

  function applyMove(fen, from, to, promotion = "q") {
    const chess = newChess(fen);
    const move = chess.move({ from, to, promotion }); // kaster ved ulovligt træk
    const flags = String(move.flags || "");
    let rookFrom = null, rookTo = null, capturedSq = null;
    if (flags.includes("k")) {
      rookFrom = move.color === "w" ? "h1" : "h8";
      rookTo = move.color === "w" ? "f1" : "f8";
    } else if (flags.includes("q")) {
      rookFrom = move.color === "w" ? "a1" : "a8";
      rookTo = move.color === "w" ? "d1" : "d8";
    }
    if (flags.includes("e")) {
      // En passant: den slåede bonde står på to-filen og from-rækken
      capturedSq = move.to[0] + move.from[1];
    } else if (move.captured) {
      capturedSq = move.to;
    }
    return {
      fen: chess.fen(),
      san: move.san,
      from: move.from,
      to: move.to,
      captured: move.captured || null,
      promotion: move.promotion || null,
      flags,
      color: move.color,
      piece: move.piece,
      rookFrom,
      rookTo,
      capturedSq,
    };
  }
  function legalTargets(fen, from) {
    try { return newChess(fen).moves({ square: from, verbose: true }).map(m => m.to); } catch (_) { return []; }
  }
  function turnOf(fen) { return String(fen).split(" ")[1] === "b" ? "b" : "w"; }
  function inCheck(fen) { return newChess(fen).inCheck(); }
  function boardOf(fen) { return newChess(fen).board(); }

  function gameStatus(fen) {
    const chess = newChess(fen);
    const turn = chess.turn();
    if (chess.isCheckmate()) {
      const winner = turn === "w" ? "b" : "w";
      return { over: true, result: winner === "w" ? "1-0" : "0-1", winner, reason: "skakmat" };
    }
    if (chess.isStalemate()) return { over: true, result: "1/2-1/2", winner: null, reason: "pat" };
    if (chess.isInsufficientMaterial()) return { over: true, result: "1/2-1/2", winner: null, reason: "for lidt materiale" };
    if (chess.isDraw()) return { over: true, result: "1/2-1/2", winner: null, reason: "remis" };
    return { over: false, result: null, winner: null, reason: "", check: chess.inCheck(), turn };
  }

  // ---------- Computer (lille alpha-beta) ----------
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  function evaluate(chess) {
    let score = 0;
    const board = chess.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      let v = VALUE[piece.type];
      const centre = (3.5 - Math.abs(f - 3.5)) + (3.5 - Math.abs(r - 3.5));
      if (piece.type === "n" || piece.type === "b") v += centre * 4;
      if (piece.type === "p") v += centre * 2 + (piece.color === "w" ? (6 - r) : (r - 1)) * 6;
      if (piece.type === "q") v += centre * 1;
      score += piece.color === "w" ? v : -v;
    }
    return score;
  }
  function orderMoves(moves) {
    return moves.sort((a, b) => ((b.captured ? VALUE[b.captured] * 10 - VALUE[b.piece] : 0) + (b.promotion ? 800 : 0))
      - ((a.captured ? VALUE[a.captured] * 10 - VALUE[a.piece] : 0) + (a.promotion ? 800 : 0)));
  }
  function negamax(chess, depth, alpha, beta, ctx) {
    ctx.nodes++;
    if (depth === 0 || ctx.nodes > ctx.maxNodes || Date.now() > ctx.deadline) return (chess.turn() === "w" ? 1 : -1) * evaluate(chess);
    const moves = chess.moves({ verbose: true });
    if (!moves.length) return chess.inCheck() ? -100000 - depth : 0;
    let best = -Infinity;
    for (const move of orderMoves(moves)) {
      chess.move(move);
      const score = -negamax(chess, depth - 1, -beta, -alpha, ctx);
      chess.undo();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }
  function chooseComputerMove(fen, level = 2, rng = Math.random, { maxNodes = 40000, timeLimitMs = 1500 } = {}) {
    const cfg = AI_LEVELS[level] || AI_LEVELS[2];
    const chess = newChess(fen);
    const moves = orderMoves(chess.moves({ verbose: true }));
    if (!moves.length) return null;
    const pickMove = m => ({ from: m.from, to: m.to, promotion: m.promotion || undefined, san: m.san });
    if (rng() < cfg.randomMoveChance) return pickMove(pick(rng, moves));
    const ctx = { nodes: 0, maxNodes, deadline: Date.now() + timeLimitMs };
    let best = null, bestScore = -Infinity;
    for (const move of moves) {
      chess.move(move);
      let score = -negamax(chess, cfg.depth - 1, -Infinity, cfg.noise ? Infinity : -bestScore, ctx);
      chess.undo();
      if (cfg.noise) score += (rng() * 2 - 1) * cfg.noise;
      if (score > bestScore) { bestScore = score; best = move; }
    }
    return pickMove(best);
  }

  return Object.freeze({
    START_FEN, RULES, MOVE_LEVELS, AI_LEVELS, SHOP, PIECE_NAMES, shopItem,
    makeProblem, checkAnswer, newPlayerMeta, newMeta, buyStatus, recordTurn,
    STRIKE, PIECE_HP, maxHp, strikeStatus, makeStrikeProblem, hpOf, strikeTargets, applyStrike, moveDamage,
    dropSquares, applyDrop, applyMove, legalTargets, turnOf, inCheck, boardOf, gameStatus,
    evaluateFen: fen => evaluate(newChess(fen)), chooseComputerMove,
  });
});
