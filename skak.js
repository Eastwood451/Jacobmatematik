/* Skak med regnestykker — UI. Lazy-loades via module-loader.js ("skak"). Kræver skak-chess-lib.js + skak-core.js. */
(() => {
  "use strict";
  const Core = window.SkakCore;
  const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const DROP_LETTER = { p: "B", n: "S", b: "L", r: "T", q: "D" };
  const PRAISE = ["Flot regnet!", "Sådan! Trækket er dit.", "Godt gået!", "Rigtigt! Vælg en brik.", "Skarpt regnet!"];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const colorName = c => (c === "w" ? "Hvid" : "Sort");

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
    };

    // ---------- fælles spil-flow ----------
    function newLocalGame() {
      Object.assign(s, { screen: "game", mode: "cpu", fen: Core.START_FEN, myColor: "w", meta: Core.newMeta(), moves: [], lastMove: null,
        status: Core.gameStatus(Core.START_FEN), feedback: "", obbe: "Du er hvid og starter. Regn stykket for at købe dit første træk!" });
      startMyTurn();
    }
    function startMyTurn() {
      s.status = Core.gameStatus(s.fen);
      if (s.status.over) { s.phase = "over"; render(); return; }
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
      if (s.status.over) s.phase = "over"; else s.phase = "wait";
      if (bought) s.obbe = "Ny brik på brættet! Nu er det modstanderens tur.";
      if (s.mode === "cpu") {
        render();
        if (!s.status.over) later(computerTurn, 450);
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
      if (game.status === "finished") { s.phase = "over"; s.status = Core.gameStatus(s.fen); stopPolling(); render(); return; }
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
        s.status = { over: true, result: s.myColor === "w" ? "0-1" : "1-0", winner: s.myColor === "w" ? "b" : "w", reason: "opgivet" };
        s.phase = "over"; render(); return;
      }
      if (!s.online.game) return;
      try { const row = await rpc("resign_chess_game", { p_game: s.online.game.id }); applyRemote(row, true); }
      catch (error) { console.error(error); }
    }

    // ---------- tegning ----------
    function boardHtml() {
      const board = Core.boardOf(s.fen);
      const flip = s.myColor === "b";
      const checkKing = Core.inCheck(s.fen) ? Core.turnOf(s.fen) : null;
      const cells = [];
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const r = flip ? 7 - i : i, f = flip ? 7 - j : j;
        const sq = String.fromCharCode(97 + f) + (8 - r);
        const piece = board[r][f];
        const cls = ["sk-sq", (r + f) % 2 ? "dark" : "light"];
        if (s.selected === sq) cls.push("selected");
        if (s.targets.includes(sq)) cls.push(piece ? "capture" : "target");
        if (s.phase === "place" && s.drops.includes(sq)) cls.push("drop");
        if (s.lastMove && (s.lastMove.from === sq || s.lastMove.to === sq)) cls.push("last");
        if (piece && piece.type === "k" && piece.color === checkKing) cls.push("check");
        const label = piece ? `${sq}: ${colorName(piece.color).toLowerCase()} ${Core.PIECE_NAMES[piece.type]}` : sq;
        const coord = (j === 0 ? `<i class="sk-rank">${8 - r}</i>` : "") + (i === 7 ? `<i class="sk-file">${String.fromCharCode(97 + f)}</i>` : "");
        cells.push(`<button type="button" class="${cls.join(" ")}" data-sq="${sq}" aria-label="${label}">${piece ? `<span class="sk-piece ${piece.color}">${GLYPH[piece.type]}</span>` : ""}${coord}</button>`);
      }
      const locked = !["move", "place"].includes(s.phase);
      return `<div class="sk-board${locked ? " locked" : ""}" role="grid" aria-label="Skakbræt">${cells.join("")}</div>`;
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
        return `<button type="button" class="sk-shop-item" data-buy="${item.type}" ${disabled ? "disabled" : ""} title="${hasSquare ? "" : "Ingen ledige felter på dine bagerste rækker"}">
          <span class="sk-piece ${s.myColor}">${GLYPH[item.type]}</span><strong>${esc(item.name)}</strong><small>${"★".repeat(item.stars)} ${esc(item.difficulty)}</small></button>`;
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
      root.innerHTML = `<div class="sk-game sk-play">
        <nav class="sk-nav"><button type="button" data-act="${s.mode === "cpu" ? "menu" : "leave-online"}">← Menu</button><span class="sk-title">${title}</span>
          ${s.phase === "over" ? `<button type="button" data-act="${s.mode === "cpu" ? "start-cpu" : "menu"}">${s.mode === "cpu" ? "Ny kamp" : "Til menu"}</button>` : `<button type="button" data-act="resign">Giv op</button>`}</nav>
        <div class="sk-layout">
          <div class="sk-board-wrap">${boardHtml()}<p class="sk-status${s.phase === "over" ? " over" : ""}" role="status">${statusLine()}</p></div>
          <aside class="sk-side">
            <div class="sk-obbe"><img src="assets/figurer/obbe-ovdig.png" alt="Øbbe" width="78" height="78"><p>${esc(s.obbe)}</p></div>
            ${myTurnPanel}
            ${s.feedback ? `<p class="sk-feedback ${s.feedbackKind}" role="alert">${esc(s.feedback)}</p>` : ""}
            ${s.phase === "place" ? `<button type="button" class="btn secondary full" data-act="cancel-buy">Fortryd (brikken går tabt)</button>` : ""}
            ${s.phase !== "over" ? shopHtml() : ""}
            <section class="sk-log"><h3>Træk <small>du er ${colorName(s.myColor).toLowerCase()}</small></h3>${movesHtml()}</section>
          </aside>
        </div></div>`;
      const input = root.querySelector('input[name="answer"]');
      if (input && !input.disabled) input.focus({ preventScroll: true });
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
      if (act === "menu") { timers.forEach(clearTimeout); timers.clear(); stopPolling(); s.screen = "menu"; s.mode = "cpu"; s.online.game = null; render(); return; }
      if (act === "cancel-buy") { cancelBuy(); return; }
      if (act === "resign") { if (window.confirm("Vil du give op?")) resign(); return; }
      if (act === "create-online") { createOnline(); return; }
      if (act === "cancel-online" || act === "leave-online") {
        const g = s.online.game;
        if (act === "cancel-online" && g && g.status === "waiting") rpc("resign_chess_game", { p_game: g.id }).catch(() => {});
        stopPolling(); s.online.game = null; s.screen = "menu"; s.mode = "cpu"; render(); return;
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
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    render();

    const api = () => {
      disposed = true;
      timers.forEach(clearTimeout); timers.clear(); stopPolling();
      root.removeEventListener("click", onClick);
      root.removeEventListener("submit", onSubmit);
    };
    api.state = s; // til tests/screenshots
    return api;
  }

  window.JacobSkak = Object.freeze({ mount });
})();
