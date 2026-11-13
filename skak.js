/* Skak med regnestykker — UI. Lazy-loades via module-loader.js ("skak"). Kræver skak-chess-lib.js + skak-core.js. */
(() => {
  "use strict";
  const Core = window.SkakCore;
  const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const CHARACTERS = {
    w: { k: "Kaptajn Kvadratrod", q: "Superheltepigen", b: "Matematik-Marley", n: "Luigi Lækkermat", r: "Øbbe Øvdig", p: "Divisions-Dennis" },
    b: { k: "Kejser Dummo", q: "Eksamens-Else", b: "Broder Brok", n: "Erling Ærgerlig", r: "Gunnar Giderik", p: "Surling" },
  };
  const PIECE_ART = "assets/figurer/skak/";
  const DROP_LETTER = { p: "B", n: "S", b: "L", r: "T", q: "D" };
  const PRAISE = ["Flot regnet!", "Sådan! Trækket er dit.", "Godt gået!", "Rigtigt! Vælg en brik.", "Skarpt regnet!"];
  const VICTORY_LINES = [
    "SKAKMAT! Det er sådan man knækker nødder!",
    "Kongen er toast — og du er stjernen!",
    "Åh ja! Matematik-mat, baby!",
    "Ingen chance! Kaptajn Kvadratrod er stolt!",
    "Boom! Du har knækket koden — og kongen!",
  ];
  const KAPTAJN_ART = "assets/figurer/kaptajn-kvadratrod.webp";
  const MATE_FLASH_MS = 2400;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const colorName = c => (c === "w" ? "Hvid" : "Sort");
  const prefersReducedMotion = () => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  };

  function pieceHtml(color, type) {
    return `<span class="sk-piece sk-character ${color} sk-character-${type}" aria-hidden="true">
      <img src="${PIECE_ART}${color}-${type}.webp" alt="" draggable="false" decoding="async" width="384" height="512">
      <span class="sk-piece-fallback" hidden>${GLYPH[type]}</span>
      <span class="sk-piece-role">${GLYPH[type]}</span></span>`;
  }

  function charactersHtml() {
    return `<details class="sk-characters"><summary>Mød brikkerne · De kloge mod de dumme</summary>
      <div class="sk-teams">${["w", "b"].map(color => `<section><h3>${color === "w" ? "De kloge · Hvid" : "De dumme · Sort"}</h3>
        <ul>${["k", "q", "r", "b", "n", "p"].map(type => `<li>${pieceHtml(color, type)}<span><strong>${esc(CHARACTERS[color][type])}</strong><small>${esc(Core.PIECE_NAMES[type])}</small></span></li>`).join("")}</ul></section>`).join("")}</div></details>`;
  }

  function mount(root, { user = null, backend = window.JacobBackend, onExit } = {}) {
    if (!root) throw new Error("Skak mangler en rod");
    const client = backend?.realtimeClient || null;
    const canOnline = Boolean(client && backend?.configured && user?.id && user.role !== "guest");
    let disposed = false;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms); timers.add(id); return id; };
    let pollId = null;

    const s = {
      screen: "menu", mode: "cpu", aiLevel: 2, mathLevel: "let",
      fen: Core.START_FEN, myColor: "w", meta: Core.newMeta(), moves: [], lastMove: null,
      phase: "idle", problem: null, selected: null, targets: [], buyType: null, drops: [],
      lockUntil: 0, feedback: "", feedbackKind: "", obbe: "Klar til skak? Regn et stykke for at købe dit træk!",
      status: Core.gameStatus(Core.START_FEN), online: { game: null, error: "", busy: false, joinCode: "" },
      // finale: null | "mate-flash" | "victory" | "replay"
      finale: null, victoryLine: "", replayPly: 0,
    };

    // ---------- fælles spil-flow ----------
    function newLocalGame() {
      Object.assign(s, { screen: "game", mode: "cpu", fen: Core.START_FEN, myColor: "w", meta: Core.newMeta(), moves: [], lastMove: null,
        status: Core.gameStatus(Core.START_FEN), feedback: "", obbe: "Du er hvid og starter. Regn stykket for at købe dit første træk!",
        finale: null, victoryLine: "", replayPly: 0 });
      startMyTurn();
    }
    function iWonStatus(st = s.status) {
      if (!st?.over || !st.result || st.result === "1/2-1/2") return false;
      const winner = st.winner || (st.result === "1-0" ? "w" : st.result === "0-1" ? "b" : null);
      return winner === s.myColor;
    }
    function enterGameOver(statusOverride = null) {
      if (statusOverride) s.status = statusOverride;
      else if (!s.status?.over) s.status = Core.gameStatus(s.fen);
      s.phase = "over";
      s.selected = null; s.targets = []; s.drops = []; s.problem = null; s.buyType = null;
      const st = s.status;
      if (st.reason === "skakmat") {
        s.finale = "mate-flash";
        s.obbe = iWonStatus(st) ? "SKAKMAT! Sejt klaret!" : "Av — skakmat. Kig på brættet, og prøv igen!";
        render();
        const delay = prefersReducedMotion() ? 400 : (iWonStatus(st) ? MATE_FLASH_MS : 1800);
        later(() => {
          if (disposed || s.phase !== "over" || s.finale !== "mate-flash") return;
          if (iWonStatus(st)) {
            s.finale = "victory";
            s.victoryLine = pick(VICTORY_LINES);
          } else {
            s.finale = null;
          }
          render();
        }, delay);
        return;
      }
      s.finale = null;
      render();
    }
    function startReplay() {
      if (s.phase !== "over" || !s.moves.length) return;
      s.finale = "replay";
      s.replayPly = s.moves.length;
      s.obbe = "Gå frem og tilbage i dine træk — find det afgørende hug!";
      render();
    }
    function setReplayPly(ply) {
      if (s.finale !== "replay") return;
      s.replayPly = Math.max(0, Math.min(s.moves.length, ply));
      render();
    }
    function displayFen() {
      if (s.finale === "replay") return Core.fenAtPly(s.moves, s.replayPly);
      return s.fen;
    }
    function displayLastMove() {
      if (s.finale === "replay") {
        if (s.replayPly <= 0) return null;
        const m = s.moves[s.replayPly - 1];
        return m ? (m.drop ? { to: m.square } : { from: m.from, to: m.to }) : null;
      }
      return s.lastMove;
    }
    function startMyTurn() {
      s.status = Core.gameStatus(s.fen);
      if (s.status.over) { enterGameOver(); return; }
      if (Core.turnOf(s.fen) !== s.myColor) { s.phase = "wait"; render(); return; }
      Object.assign(s, { phase: "solve", problem: Core.makeProblem(s.mathLevel), selected: null, targets: [], buyType: null, drops: [] });
      if (s.status.check) s.obbe = "Pas på, du står i skak! Regn hurtigt og red kongen.";
      render();
    }
    function myBuyStatus() { return Core.buyStatus(s.meta[s.myColor], { inCheck: Core.inCheck(s.fen) }); }

    function submitAnswer(raw) {
      if (Date.now() < s.lockUntil || !s.problem) return;
      const problem = s.problem;
      const correct = Core.checkAnswer(problem, raw);
      if (s.phase === "solve") {
        if (correct) {
          Object.assign(s, { phase: "move", problem: null, feedback: "", obbe: pick(PRAISE) });
        } else {
          wrongAnswer(problem, "Ikke helt.", () => { s.problem = Core.makeProblem(s.mathLevel); });
        }
      } else if (s.phase === "buy-solve") {
        const item = Core.shopItem(s.buyType);
        if (correct) {
          const drops = Core.dropSquares(s.fen, s.myColor, s.buyType);
          Object.assign(s, { phase: "place", problem: null, drops, feedback: "",
            obbe: `Wow! Du har købt en ${item.name.toLowerCase()}. Tryk på et grønt felt for at sætte den ind.` });
        } else {
          wrongAnswer(problem, `Købet af ${item.name.toLowerCase()} gik ikke igennem.`, () => {
            Object.assign(s, { phase: "solve", buyType: null, problem: Core.makeProblem(s.mathLevel) });
          });
        }
      }
      render();
    }
    function wrongAnswer(problem, title, after) {
      const wait = Core.RULES.wrongAnswerWaitMs;
      s.lockUntil = Date.now() + wait;
      s.feedbackKind = "wrong";
      s.feedback = `${title} ${problem.text} = ${problem.answer}. Vent ${Math.round(wait / 1000)} sekunder…`;
      s.obbe = "Det gør ikke noget. Prøv igen om lidt!";
      later(() => { s.lockUntil = 0; s.feedback = ""; after(); render(); }, wait);
    }
    function startBuy(type) {
      if (!["solve", "move"].includes(s.phase) || Date.now() < s.lockUntil) return;
      const status = myBuyStatus();
      if (!status.ok || !Core.dropSquares(s.fen, s.myColor, type).length) return;
      const item = Core.shopItem(type);
      Object.assign(s, { phase: "buy-solve", buyType: type, problem: Core.makeProblem(item.tier), selected: null, targets: [], feedback: "",
        obbe: `En ${item.name.toLowerCase()} koster et ${item.difficulty.toLowerCase()} regnestykke. Køb tager hele din tur.` });
      render();
    }
    function cancelBuy() {
      if (!["buy-solve", "place"].includes(s.phase) || Date.now() < s.lockUntil) return;
      Object.assign(s, { phase: "solve", buyType: null, drops: [], problem: Core.makeProblem(s.mathLevel), obbe: "Okay, ingen ekstra brik. Regn for at købe et træk." });
      render();
    }
    function tapSquare(sq) {
      if (s.phase === "move") {
        if (s.selected && s.targets.includes(sq)) { makeMove(s.selected, sq); return; }
        const board = Core.boardOf(s.fen);
        const piece = board[8 - Number(sq[1])][sq.charCodeAt(0) - 97];
        if (piece && piece.color === s.myColor) { s.selected = sq; s.targets = Core.legalTargets(s.fen, sq); }
        else { s.selected = null; s.targets = []; }
        render();
      } else if (s.phase === "place" && s.drops.includes(sq)) {
        placePiece(sq);
      }
    }
    function makeMove(from, to) {
      let result;
      try { result = Core.applyMove(s.fen, from, to, "q"); } catch (_) { s.selected = null; s.targets = []; render(); return; }
      finishMyTurn(result.fen, { by: s.myColor, san: result.san, from, to }, false);
    }
    function placePiece(sq) {
      let result;
      try { result = Core.applyDrop(s.fen, s.myColor, s.buyType, sq); } catch (_) { return; }
      finishMyTurn(result.fen, { by: s.myColor, drop: s.buyType, square: sq, san: `+${DROP_LETTER[s.buyType]}@${sq}` }, true);
    }
    function finishMyTurn(fen, record, bought) {
      s.meta = { ...s.meta, [s.myColor]: Core.recordTurn(s.meta[s.myColor], { bought }) };
      s.fen = fen; s.moves = [...s.moves, record];
      s.lastMove = record.drop ? { to: record.square } : { from: record.from, to: record.to };
      Object.assign(s, { selected: null, targets: [], drops: [], buyType: null, problem: null });
      s.status = Core.gameStatus(fen);
      if (bought) s.obbe = "Ny brik på brættet! Nu er det modstanderens tur.";
      if (s.status.over) {
        enterGameOver();
        if (s.mode === "online") sendOnlineMove(record);
        return;
      }
      s.phase = "wait";
      if (s.mode === "cpu") {
        render();
        later(computerTurn, 450);
      } else {
        sendOnlineMove(record);
      }
    }
    function computerTurn() {
      const move = Core.chooseComputerMove(s.fen, s.aiLevel);
      if (!move) { startMyTurn(); return; }
      const result = Core.applyMove(s.fen, move.from, move.to, move.promotion || "q");
      const color = Core.turnOf(s.fen);
      s.meta = { ...s.meta, [color]: Core.recordTurn(s.meta[color]) };
      s.fen = result.fen; s.moves = [...s.moves, { by: color, san: result.san, from: result.from, to: result.to }];
      s.lastMove = { from: result.from, to: result.to };
      if (result.captured) s.obbe = `Av, computeren slog din ${Core.PIECE_NAMES[result.captured]}. Regn videre!`;
      else s.obbe = "Computeren har flyttet. Din tur!";
      startMyTurn();
    }

    // ---------- online ----------
    function normalizeMeta(meta) {
      const m = meta && typeof meta === "object" ? meta : {};
      return { w: { ...Core.newPlayerMeta(), ...(m.w || {}) }, b: { ...Core.newPlayerMeta(), ...(m.b || {}) } };
    }
    const friendlyError = error => {
      const msg = String(error?.message || error || "");
      if (/not found/i.test(msg)) return "Koden findes ikke. Tjek den og prøv igen.";
      if (/own game/i.test(msg)) return "Du kan ikke spille mod dig selv. Giv koden til en anden.";
      if (/already started/i.test(msg)) return "Den kamp er allerede i gang.";
      if (/expired/i.test(msg)) return "Koden er udløbet. Bed om en ny.";
      if (/not your turn/i.test(msg)) return "Det er ikke din tur.";
      return "Der skete en fejl med forbindelsen. Prøv igen.";
    };
    async function rpc(name, args) {
      const { data, error } = await client.rpc(name, args || {});
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    }
    async function createOnline() {
      if (!canOnline || s.online.busy) return;
      s.online.busy = true; s.online.error = ""; render();
      try {
        const game = await rpc("create_chess_game");
        s.online.game = game; s.myColor = "w"; s.mode = "online"; s.screen = "lobby";
        startPolling();
      } catch (error) { console.error(error); s.online.error = friendlyError(error); }
      s.online.busy = false; render();
    }
    async function joinOnline(code) {
      if (!canOnline || s.online.busy) return;
      const clean = String(code || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(clean)) { s.online.error = "Koden har 5 tegn."; render(); return; }
      s.online.busy = true; s.online.error = ""; render();
      try {
        const game = await rpc("join_chess_game", { p_code: clean });
        s.mode = "online"; s.myColor = game.white_id === user.id ? "w" : "b";
        applyRemote(game, true);
        startPolling();
      } catch (error) { console.error(error); s.online.error = friendlyError(error); }
      s.online.busy = false; render();
    }
    function applyRemote(game, force = false) {
      const prev = s.online.game;
      if (!force && prev && prev.version === game.version) return;
      s.online.game = game;
      if (game.status === "waiting") { s.screen = "lobby"; render(); return; }
      s.screen = "game";
      s.fen = game.fen; s.meta = normalizeMeta(game.meta); s.moves = Array.isArray(game.moves) ? game.moves : [];
      const last = s.moves[s.moves.length - 1];
      s.lastMove = last ? (last.drop ? { to: last.square } : { from: last.from, to: last.to }) : null;
      if (game.status === "finished") {
        stopPolling();
        const st = Core.gameStatus(s.fen);
        if (game.result) {
          const winner = game.result === "1-0" ? "w" : game.result === "0-1" ? "b" : null;
          s.status = { over: true, result: game.result, winner, reason: game.result_reason || st.reason || "slut" };
        } else {
          s.status = st;
        }
        if (s.phase !== "over") enterGameOver();
        else render();
        return;
      }
      if (Core.turnOf(s.fen) === s.myColor) {
        const midTurn = ["move", "buy-solve", "place"].includes(s.phase) || (s.phase === "solve" && s.problem) || Date.now() < s.lockUntil;
        if (!midTurn || force) {
          s.obbe = last ? `${opponentName()} har flyttet (${last.san || ""}). Din tur!` : "Du starter. Regn for at købe dit første træk!";
          startMyTurn();
          return;
        }
      } else {
        s.phase = "wait";
      }
      render();
    }
    function opponentName() {
      const g = s.online.game;
      if (!g) return "Modstanderen";
      return (s.myColor === "w" ? g.black_name : g.white_name) || "Modstanderen";
    }
    async function pollOnce() {
      const game = s.online.game;
      if (!game || disposed) return;
      try {
        const { data, error } = await client.from("chess_games").select("*").eq("id", game.id).maybeSingle();
        if (error) throw error;
        if (data) applyRemote(data);
      } catch (error) { console.warn("Skak: kunne ikke hente kampen", error); }
    }
    function startPolling() { stopPolling(); pollId = setInterval(pollOnce, 2000); }
    function stopPolling() { if (pollId) clearInterval(pollId); pollId = null; }
    async function sendOnlineMove(record) {
      const game = s.online.game;
      render();
      const status = s.status;
      try {
        const row = await rpc("submit_chess_move", {
          p_game: game.id, p_version: game.version, p_fen: s.fen, p_move: record, p_meta: s.meta,
          p_status: status.over ? "finished" : "active", p_result: status.over ? status.result : null, p_reason: status.over ? status.reason : null,
        });
        s.online.game = row;
        if (row.status === "finished") stopPolling();
      } catch (error) {
        console.error(error);
        s.obbe = "Trækket kunne ikke sendes. Jeg henter kampen igen.";
        const { data } = await client.from("chess_games").select("*").eq("id", game.id).maybeSingle();
        if (data) applyRemote(data, true);
      }
    }
    async function resign() {
      if (s.mode === "cpu") {
        enterGameOver({ over: true, result: s.myColor === "w" ? "0-1" : "1-0", winner: s.myColor === "w" ? "b" : "w", reason: "opgivet" });
        return;
      }
      if (!s.online.game) return;
      try { const row = await rpc("resign_chess_game", { p_game: s.online.game.id }); applyRemote(row, true); }
      catch (error) { console.error(error); }
    }

    // ---------- tegning ----------
    function boardHtml() {
      const fen = displayFen();
      const board = Core.boardOf(fen);
      const flip = s.myColor === "b";
      const st = Core.gameStatus(fen);
      const mateFlash = s.finale === "mate-flash" || (s.finale === "replay" && st.reason === "skakmat");
      const checkKing = st.reason === "skakmat" ? Core.turnOf(fen) : (Core.inCheck(fen) ? Core.turnOf(fen) : null);
      const last = displayLastMove();
      const cells = [];
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const r = flip ? 7 - i : i, f = flip ? 7 - j : j;
        const sq = String.fromCharCode(97 + f) + (8 - r);
        const piece = board[r][f];
        const cls = ["sk-sq", (r + f) % 2 ? "dark" : "light"];
        if (s.finale !== "replay" && s.selected === sq) cls.push("selected");
        if (s.finale !== "replay" && s.targets.includes(sq)) cls.push(piece ? "capture" : "target");
        if (s.finale !== "replay" && s.phase === "place" && s.drops.includes(sq)) cls.push("drop");
        if (last && (last.from === sq || last.to === sq)) cls.push("last");
        if (piece && piece.type === "k" && piece.color === checkKing) cls.push(mateFlash || st.reason === "skakmat" ? "skakmat" : "check");
        const label = piece ? `${sq}: ${colorName(piece.color).toLowerCase()} ${Core.PIECE_NAMES[piece.type]} · ${CHARACTERS[piece.color][piece.type]}` : sq;
        const coord = (j === 0 ? `<i class="sk-rank">${8 - r}</i>` : "") + (i === 7 ? `<i class="sk-file">${String.fromCharCode(97 + f)}</i>` : "");
        cells.push(`<button type="button" class="${cls.join(" ")}" data-sq="${sq}" aria-label="${esc(label)}" title="${esc(label)}">${piece ? pieceHtml(piece.color, piece.type) : ""}${coord}</button>`);
      }
      const locked = s.finale === "replay" || s.finale === "mate-flash" || !["move", "place"].includes(s.phase);
      const mateBanner = s.finale === "mate-flash"
        ? `<div class="sk-mate-banner" role="status" aria-live="assertive"><span class="sk-mate-burst" aria-hidden="true"></span><strong>SKAKMAT!</strong></div>`
        : "";
      return `<div class="sk-board-stage${s.finale === "mate-flash" ? " is-mate" : ""}">${mateBanner}<div class="sk-board${locked ? " locked" : ""}" role="grid" aria-label="Skakbræt">${cells.join("")}</div></div>`;
    }
    function victoryHtml() {
      if (s.finale !== "victory") return "";
      const line = s.victoryLine || VICTORY_LINES[0];
      return `<div class="sk-overlay sk-victory-overlay" role="dialog" aria-modal="true" aria-labelledby="sk-victory-title">
        <div class="sk-victory-card sk-victory-boom">
          <p class="sk-eyebrow">Sejr</p>
          <h2 id="sk-victory-title" class="sk-victory-title">SKAKMAT!</h2>
          <div class="sk-kaptajn-hero" aria-hidden="true">
            <div class="sk-kaptajn-stage">
              <div class="sk-kaptajn-glow"></div>
              <span class="sk-impact-lines"></span>
              <img class="sk-kaptajn-pose" src="${KAPTAJN_ART}" alt="" width="220" height="330" decoding="async">
              <span class="sk-kaptajn-shades">
                <svg viewBox="0 0 100 36" width="88" height="32" focusable="false">
                  <ellipse cx="28" cy="20" rx="22" ry="12" fill="#1d1630"/>
                  <ellipse cx="72" cy="20" rx="22" ry="12" fill="#1d1630"/>
                  <path d="M48 18h4" stroke="#1d1630" stroke-width="5" stroke-linecap="round"/>
                  <path d="M8 16h8" stroke="#1d1630" stroke-width="4" stroke-linecap="round"/>
                  <path d="M84 16h8" stroke="#1d1630" stroke-width="4" stroke-linecap="round"/>
                  <path class="sk-shade-shine" d="M14 16h22" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
                  <path class="sk-shade-shine" d="M58 16h18" stroke="#fff8" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </span>
              <span class="sk-kaptajn-glint"></span>
            </div>
            <span class="sk-kaptajn-thumb">
              <span class="sk-thumb-burst"></span>
              <svg viewBox="0 0 96 96" width="120" height="120" focusable="false">
                <path fill="#ffd24a" stroke="#1d1630" stroke-width="4.5" stroke-linejoin="round" d="M40 42V16c0-8 6-13 13-13s13 5 13 13v18"/>
                <path fill="#ffe9a0" stroke="#1d1630" stroke-width="4.5" stroke-linejoin="round" d="M20 42h52l5 9c5 13 2 30-7 36H28c-9-5-13-20-11-32l3-13z"/>
                <path fill="#1d1630" d="M33 54h8v24h-8zm15 0h8v24h-8zm15 0h8v24h-8z"/>
                <circle class="sk-thumb-spark" cx="80" cy="26" r="6" fill="#fff" stroke="#1d1630" stroke-width="2"/>
                <circle class="sk-thumb-spark" cx="88" cy="42" r="4" fill="#ffd24a" stroke="#1d1630" stroke-width="2"/>
              </svg>
            </span>
          </div>
          <p class="sk-victory-line">„${esc(line)}”</p>
          <p class="sk-victory-sub">Kaptajn Kvadratrod giver dig et kæmpe thumbs up.</p>
          <div class="sk-victory-actions">
            <button type="button" class="btn full" data-act="replay">Se dine træk igen</button>
            <button type="button" class="btn secondary" data-act="${s.mode === "cpu" ? "start-cpu" : "menu"}">${s.mode === "cpu" ? "Ny kamp" : "Til menu"}</button>
          </div>
        </div>
      </div>`;
    }
    function replayBarHtml() {
      if (s.finale !== "replay") return "";
      const total = s.moves.length;
      const ply = s.replayPly;
      const move = ply > 0 ? s.moves[ply - 1] : null;
      const fullNo = ply === 0 ? 0 : Math.ceil(ply / 2);
      const side = !move ? "" : (move.by === "w" ? " · Hvid" : " · Sort");
      const san = move?.san ? ` · ${esc(move.san)}` : "";
      const label = ply === 0
        ? "Startstilling"
        : `Træk ${fullNo}${side}${san} · halvtræk ${ply}/${total}`;
      return `<section class="sk-replay" aria-label="Gense dine træk">
        <h3>Se dine træk igen</h3>
        <p class="sk-replay-pos" aria-live="polite">${label}</p>
        <div class="sk-replay-controls">
          <button type="button" class="sk-replay-btn" data-act="replay-first" ${ply <= 0 ? "disabled" : ""} aria-label="Første stilling" title="Første">⏮</button>
          <button type="button" class="sk-replay-btn" data-act="replay-prev" ${ply <= 0 ? "disabled" : ""} aria-label="Forrige træk" title="Tilbage">◀</button>
          <button type="button" class="sk-replay-btn" data-act="replay-next" ${ply >= total ? "disabled" : ""} aria-label="Næste træk" title="Frem">▶</button>
          <button type="button" class="sk-replay-btn" data-act="replay-last" ${ply >= total ? "disabled" : ""} aria-label="Sidste stilling" title="Sidste">⏭</button>
        </div>
        <div class="sk-replay-actions">
          <button type="button" class="btn secondary" data-act="replay-victory">Tilbage til sejren</button>
          <button type="button" class="btn" data-act="${s.mode === "cpu" ? "start-cpu" : "menu"}">${s.mode === "cpu" ? "Ny kamp" : "Til menu"}</button>
        </div>
      </section>`;
    }
    function problemHtml() {
      if (!s.problem) return "";
      const lock = Date.now() < s.lockUntil;
      const buying = s.phase === "buy-solve";
      const item = buying ? Core.shopItem(s.buyType) : null;
      return `<form class="sk-problem${buying ? " buying" : ""}" data-form="answer" autocomplete="off">
        <span class="sk-problem-label">${buying ? `Køb ${esc(item.name.toLowerCase())} · ${"★".repeat(item.stars)} ${esc(item.difficulty)}` : "Køb dit træk"}</span>
        <div class="sk-problem-row"><strong class="sk-problem-text">${esc(s.problem.text)} =</strong>
        <input name="answer" inputmode="numeric" pattern="-?[0-9]*" aria-label="Dit svar" ${lock ? "disabled" : ""} required>
        <button class="btn" type="submit" ${lock ? "disabled" : ""}>Svar</button></div>
        ${buying ? `<button type="button" class="sk-link" data-act="cancel-buy">Fortryd køb</button>` : ""}
      </form>`;
    }
    function shopHtml() {
      const status = myBuyStatus();
      const active = ["solve", "move"].includes(s.phase) && Date.now() >= s.lockUntil;
      const meta = s.meta[s.myColor];
      const items = Core.SHOP.map(item => {
        const hasSquare = Core.dropSquares(s.fen, s.myColor, item.type).length > 0;
        const disabled = !active || !status.ok || !hasSquare;
        const character = CHARACTERS[s.myColor][item.type];
        const title = `${character} · ${item.name}${hasSquare ? "" : " · Ingen ledige felter på dine bagerste rækker"}`;
        return `<button type="button" class="sk-shop-item" data-buy="${item.type}" ${disabled ? "disabled" : ""} title="${esc(title)}" aria-label="${esc(title)}">
          ${pieceHtml(s.myColor, item.type)}<strong>${esc(item.name)}</strong><span class="sk-shop-character">${esc(character)}</span><small>${"★".repeat(item.stars)} ${esc(item.difficulty)}</small></button>`;
      }).join("");
      const note = status.ok ? "Køb tager hele din tur. Brikken sættes på dine to bagerste rækker." : esc(status.reason);
      return `<section class="sk-shop" aria-label="Køb ekstra brik"><h3>Køb en ekstra brik <small>${meta.buys}/${Core.RULES.maxBuys} brugt</small></h3>
        <div class="sk-shop-grid">${items}</div><p class="sk-shop-note">${note}</p></section>`;
    }
    function statusLine() {
      if (s.phase === "over") {
        const st = s.status.over ? s.status : Core.gameStatus(s.fen);
        const g = s.online.game;
        const result = g?.result || st.result;
        const reason = g?.result_reason || st.reason;
        if (!result) return "Kampen er slut.";
        if (result === "1/2-1/2") return `Uafgjort (${esc(reason)}).`;
        const winner = result === "1-0" ? "w" : "b";
        return winner === s.myColor ? `Du vandt! (${esc(reason)}) 🎉` : `Du tabte (${esc(reason)}). Prøv igen!`;
      }
      if (s.phase === "wait") return s.mode === "cpu" ? "Computeren tænker…" : `Venter på ${esc(opponentName())}…`;
      if (s.phase === "solve") return "Din tur: regn stykket for at købe et træk.";
      if (s.phase === "move") return s.selected ? "Tryk på et felt med en prik." : "Træk købt! Tryk på en af dine brikker.";
      if (s.phase === "buy-solve") return "Regn det svære stykke for at købe brikken.";
      if (s.phase === "place") return "Tryk på et grønt felt for at sætte brikken ind.";
      return "";
    }
    function movesHtml() {
      if (!s.moves.length) return `<p class="sk-moves empty">Ingen træk endnu.</p>`;
      const cell = m => m ? `<span class="${m.drop ? "drop" : ""}">${esc(m.san || "?")}</span>` : "<span></span>";
      const rows = [];
      for (let i = 0; i < s.moves.length; i += 2) rows.push(`<li><b>${i / 2 + 1}.</b>${cell(s.moves[i])}${cell(s.moves[i + 1])}</li>`);
      return `<ol class="sk-moves">${rows.slice(-8).join("")}</ol>`;
    }
    function renderMenu() {
      const lvl = Object.entries(Core.MOVE_LEVELS).map(([key, v]) => `<button type="button" class="sk-chip${s.mathLevel === key ? " on" : ""}" data-math="${key}"><strong>${v.label}</strong><small>${v.hint}</small></button>`).join("");
      const ai = Object.entries(Core.AI_LEVELS).map(([key, v]) => `<button type="button" class="sk-chip${String(s.aiLevel) === key ? " on" : ""}" data-ai="${key}"><strong>${v.label}</strong></button>`).join("");
      root.innerHTML = `<div class="sk-game sk-menu">
        <nav class="sk-nav"><button type="button" data-act="exit">← Tilbage</button><span class="sk-beta">Beta</span></nav>
        <header class="sk-hero"><img src="assets/figurer/obbe-ovdig.png" alt="" width="120" height="120"><div><span class="sk-eyebrow">Nyt spil</span><h1>Skak med regnestykker</h1>
        <p>Før hvert træk skal du regne et lille stykke. Regn et sværere stykke, og køb en ekstra brik: jo sværere, jo bedre brik.</p></div></header>
        <section class="sk-panel"><h2>Regne-niveau for træk</h2><div class="sk-chips">${lvl}</div></section>
        <div class="sk-modes">
          <section class="sk-panel sk-mode"><h2>🤖 Mod computeren</h2><p>Virker også uden internet.</p><div class="sk-chips small">${ai}</div>
            <button type="button" class="btn full" data-act="start-cpu">Start kamp</button></section>
          <section class="sk-panel sk-mode"><h2>🧑‍🤝‍🧑 Mod en anden bruger</h2>
            ${canOnline ? `<p>Lav en kode og giv den til din modstander, eller skriv en kode du har fået.</p>
              <button type="button" class="btn full" data-act="create-online" ${s.online.busy ? "disabled" : ""}>Lav en kampkode</button>
              <form class="sk-join" data-form="join" autocomplete="off"><input name="code" maxlength="5" placeholder="KODE" aria-label="Kampkode" value="${esc(s.online.joinCode)}"><button class="btn secondary" type="submit" ${s.online.busy ? "disabled" : ""}>Deltag</button></form>
              <p class="sk-error" role="alert">${esc(s.online.error)}</p>`
              : `<p>Kræver at begge spillere er logget ind og online.</p>`}
          </section>
        </div>
        ${charactersHtml()}
        <details class="sk-rules"><summary>Regler for ekstra brikker</summary><ul>
          ${Core.SHOP.map(i => `<li><strong>${esc(i.name)}</strong>: ${"★".repeat(i.stars)} ${esc(i.difficulty)} opgave</li>`).join("")}
          <li>Butikken åbner efter ${Core.RULES.firstBuyAfterTurns} træk. Derefter højst ét køb pr. ${Core.RULES.cooldownTurns} træk og ${Core.RULES.maxBuys} køb i alt.</li>
          <li>Et køb bruger hele din tur. Brikken sættes på et tomt felt på dine to bagerste rækker (bønder kun på 2./7. række) og må ikke give skak.</li>
          <li>Forkert svar: ${Core.RULES.wrongAnswerWaitMs / 1000} sekunders pause og et nyt stykke.</li>
          <li>Bønder, der når sidste række, bliver automatisk til en dronning.</li></ul></details>
      </div>`;
    }
    function renderLobby() {
      const g = s.online.game;
      root.innerHTML = `<div class="sk-game sk-lobby"><nav class="sk-nav"><button type="button" data-act="leave-online">← Tilbage</button></nav>
        <section class="sk-panel sk-code-panel"><span class="sk-eyebrow">Giv koden til din modstander</span><div class="sk-code">${esc(g?.code || "…")}</div>
        <p>Din modstander åbner Skak, vælger "Mod en anden bruger" og skriver koden. Du spiller hvid.</p><p class="sk-wait">Venter på modstander…</p>
        <button type="button" class="btn secondary" data-act="cancel-online">Aflys</button></section></div>`;
    }
    function renderGame() {
      const g = s.online.game;
      const title = s.mode === "cpu" ? `Mod computeren · ${Core.AI_LEVELS[s.aiLevel].label}` : `Mod ${esc(opponentName())}${g ? ` · kode ${esc(g.code)}` : ""}`;
      const myTurnPanel = ["solve", "buy-solve"].includes(s.phase) ? problemHtml() : "";
      const showShop = s.phase !== "over" && s.finale !== "replay";
      const overActions = s.phase === "over" && s.finale !== "victory" && s.finale !== "mate-flash"
        ? `<button type="button" data-act="replay"${s.moves.length ? "" : " disabled"}>Se dine træk igen</button>
           <button type="button" data-act="${s.mode === "cpu" ? "start-cpu" : "menu"}">${s.mode === "cpu" ? "Ny kamp" : "Til menu"}</button>`
        : "";
      root.innerHTML = `<div class="sk-game sk-play${s.finale === "mate-flash" ? " sk-mate-mode" : ""}${s.finale === "victory" ? " sk-victory-mode" : ""}">
        <nav class="sk-nav"><button type="button" data-act="${s.mode === "cpu" ? "menu" : "leave-online"}">← Menu</button><span class="sk-title">${title}</span>
          ${s.phase === "over" ? overActions : `<button type="button" data-act="resign">Giv op</button>`}</nav>
        <div class="sk-layout">
          <div class="sk-board-wrap">${boardHtml()}<p class="sk-status${s.phase === "over" ? " over" : ""}${s.finale === "mate-flash" ? " mate" : ""}" role="status">${s.finale === "mate-flash" ? "SKAKMAT!" : statusLine()}</p></div>
          <aside class="sk-side">
            <div class="sk-obbe"><img src="assets/figurer/obbe-ovdig.png" alt="Øbbe" width="78" height="78"><p>${esc(s.obbe)}</p></div>
            ${myTurnPanel}
            ${s.feedback ? `<p class="sk-feedback ${s.feedbackKind}" role="alert">${esc(s.feedback)}</p>` : ""}
            ${s.phase === "place" ? `<button type="button" class="btn secondary full" data-act="cancel-buy">Fortryd (brikken går tabt)</button>` : ""}
            ${replayBarHtml()}
            ${showShop ? shopHtml() : ""}
            <section class="sk-log"><h3>Træk <small>du er ${colorName(s.myColor).toLowerCase()}</small></h3>${movesHtml()}</section>
          </aside>
        </div>
        ${victoryHtml()}
      </div>`;
      const input = root.querySelector('input[name="answer"]');
      if (input && !input.disabled) input.focus({ preventScroll: true });
      else if (s.finale === "victory") root.querySelector("[data-act=\"replay\"]")?.focus({ preventScroll: true });
    }
    function render() {
      if (disposed) return;
      if (s.screen === "menu") renderMenu();
      else if (s.screen === "lobby") renderLobby();
      else renderGame();
    }

    // ---------- events ----------
    function onClick(event) {
      const sqBtn = event.target.closest("[data-sq]");
      if (sqBtn && root.contains(sqBtn)) { tapSquare(sqBtn.dataset.sq); return; }
      const buy = event.target.closest("[data-buy]");
      if (buy) { startBuy(buy.dataset.buy); return; }
      const math = event.target.closest("[data-math]");
      if (math) { s.mathLevel = math.dataset.math; render(); return; }
      const ai = event.target.closest("[data-ai]");
      if (ai) { s.aiLevel = Number(ai.dataset.ai); render(); return; }
      const act = event.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      if (act === "exit") { onExit?.(); return; }
      if (act === "start-cpu") { timers.forEach(clearTimeout); timers.clear(); newLocalGame(); return; }
      if (act === "menu") { timers.forEach(clearTimeout); timers.clear(); stopPolling(); s.screen = "menu"; s.mode = "cpu"; s.online.game = null; s.finale = null; render(); return; }
      if (act === "cancel-buy") { cancelBuy(); return; }
      if (act === "resign") { if (window.confirm("Vil du give op?")) resign(); return; }
      if (act === "replay") { startReplay(); return; }
      if (act === "replay-first") { setReplayPly(0); return; }
      if (act === "replay-prev") { setReplayPly(s.replayPly - 1); return; }
      if (act === "replay-next") { setReplayPly(s.replayPly + 1); return; }
      if (act === "replay-last") { setReplayPly(s.moves.length); return; }
      if (act === "replay-victory") {
        if (iWonStatus() && s.status.reason === "skakmat") {
          s.finale = "victory";
          if (!s.victoryLine) s.victoryLine = pick(VICTORY_LINES);
        } else {
          s.finale = null;
        }
        render();
        return;
      }
      if (act === "create-online") { createOnline(); return; }
      if (act === "cancel-online" || act === "leave-online") {
        const g = s.online.game;
        if (act === "cancel-online" && g && g.status === "waiting") rpc("resign_chess_game", { p_game: g.id }).catch(() => {});
        stopPolling(); s.online.game = null; s.screen = "menu"; s.mode = "cpu"; s.finale = null; render(); return;
      }
    }
    function onSubmit(event) {
      const form = event.target.closest("[data-form]");
      if (!form) return;
      event.preventDefault();
      const data = new FormData(form);
      if (form.dataset.form === "answer") submitAnswer(data.get("answer"));
      if (form.dataset.form === "join") { s.online.joinCode = String(data.get("code") || ""); joinOnline(s.online.joinCode); }
    }
    function onAssetError(event) {
      const img = event.target;
      if (img.tagName !== "IMG" || !img.parentElement?.classList.contains("sk-character")) return;
      img.hidden = true;
      img.parentElement.classList.add("is-fallback");
      img.parentElement.querySelector(".sk-piece-fallback").hidden = false;
    }
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("error", onAssetError, true);
    render();

    const api = () => {
      disposed = true;
      timers.forEach(clearTimeout); timers.clear(); stopPolling();
      root.removeEventListener("click", onClick);
      root.removeEventListener("submit", onSubmit);
      root.removeEventListener("error", onAssetError, true);
    };
    api.state = s; // til tests/screenshots
    api.render = render;
    api.enterGameOver = enterGameOver;
    return api;
  }

  window.JacobSkak = Object.freeze({ mount });
})();
