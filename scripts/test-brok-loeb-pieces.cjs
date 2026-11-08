/* Brøk-løb: de dumme skakbrikker erstatter hajerne.
   Lokal fixture. Ingen login, database eller udgivelse. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.BL_OUT || path.join(ROOT, "test-results", "brok-loeb-pieces");
fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webp": "image/webp" };
const IDS = ["p", "n", "b", "r", "q", "k"];
const NAMES = {
  p: ["Surling", "bonde"], n: ["Erling Ærgerlig", "springer"], b: ["Broder Brok", "løber"],
  r: ["Gunnar Giderik", "tårn"], q: ["Eksamens-Else", "dronning"], k: ["Kejser Dummo", "konge"],
};

const src = fs.readFileSync(path.join(ROOT, "brok-loeb.js"), "utf8");
assert.doesNotMatch(src, /shark|spriteShark|hvidhaj|haj/i, "haj-stien er væk");
assert.match(src, /Når Erling, Gunnar, Else eller Kejser Dummo spærrer vejen/);
assert.match(src, /Løb, saml stjerner og undgå forhindringerne/);
assert.match(src, /assets\/brok-loeb\//);
assert.match(fs.readFileSync(path.join(ROOT, "module-loader.js"), "utf8"), /brok-loeb\.js\?v=20261108-skakbrikker1/);
assert.match(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), /module-loader\.js\?v=20261108-skakbrikker1/);
for (const id of IDS) {
  const file = path.join(ROOT, "assets", "figurer", "skak", `b-${id}.webp`);
  assert.ok(fs.existsSync(file), file);
  assert.match(src, new RegExp(`b-${id}\\.webp`));
}
assert.doesNotMatch(src, /assets\/brok-loeb\/b-|generated|dummerter\.webp/);
console.log("statiske tjek: original skakkunst, ingen haj, danske sætninger urørt");

function pageHtml(seed, failKing) {
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="brok-loeb.css"></head>
<body style="margin:0;background:#f6f1e7">
<div id="root"></div>
<script src="brok-loeb-core.js"></script><script src="brok-loeb.js"></script>
<script>
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
window.__failKing=${failKing ? "true" : "false"};
window.__dispose=JacobBrokLoeb.mount(document.getElementById("root"),{random:mulberry32(${seed})});
</script></body></html>`;
}

async function fulfill(route, failKing) {
  const url = new URL(route.request().url());
  if (url.hostname !== "brok.local") return route.abort();
  if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: pageHtml(11, failKing) });
  if (failKing && url.pathname.endsWith("/b-k.webp")) return route.fulfill({ status: 404, body: "missing king" });
  const rel = decodeURIComponent(url.pathname.replace(/^\//, "")).split("?")[0];
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "missing " + rel });
  return route.fulfill({ status: 200, contentType: MIME[path.extname(file).toLowerCase()] || "application/octet-stream", body: fs.readFileSync(file) });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    async function open(viewport, mobile, { failKing = false, video = false } = {}) {
      const context = await browser.newContext({
        viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1,
        ...(video ? { recordVideo: { dir: OUT, size: { width: viewport.width, height: viewport.height } } } : {}),
      });
      await context.route("**/*", (route) => fulfill(route, failKing));
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push("pageerror: " + e));
      page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text()); });
      await page.goto("http://brok.local/");
      await page.waitForSelector("[data-bl-ready]");
      return { context, page, errors };
    }
    function unexpected(list) {
      return list.filter((line) => !/Failed to load resource|net::ERR_|favicon|404/i.test(line));
    }

    const desktop = await open({ width: 1280, height: 800 }, false, { video: true });
    const page = desktop.page;
    const errors = desktop.errors;
    const intro = await page.locator(".bl-card p").first().innerText();
    assert.match(intro, /Erling, Gunnar, Else eller Kejser Dummo/);
    assert.equal(await page.locator("h1").innerText(), "Brøk-løb");
    const loaded = await page.evaluate(() => {
      const chars = JacobBrokLoeb.CHARS;
      return {
        order: Object.keys(chars),
        files: JacobBrokLoeb.EVIL_PIECES.map((p) => [p.id, p.file, p.name, p.role, p.h]),
        pieces: window.__dispose.debug.pieces(),
      };
    });
    assert.deepEqual(loaded.order, ["erling", "gunnar", "else", "dummo"]);
    assert.deepEqual(loaded.files.map((row) => row[0]), IDS);
    for (const piece of loaded.pieces) {
      const [name, role] = NAMES[piece.id];
      assert.equal(piece.loaded, true, piece.id + " skal indlæses");
      assert.equal(piece.name, name);
      assert.equal(piece.role, role);
      assert.equal(piece.src, `assets/figurer/skak/b-${piece.id}.webp`);
      assert.ok(piece.w < 360 && piece.h > 280 && piece.h <= 512, `${piece.id} er beskåret original (${piece.w}x${piece.h})`);
      assert.ok(piece.clear > 1000, `${piece.id} beholder gennemsigtig kant`);
      assert.ok(piece.mid && piece.mid[3] > 200, `${piece.id} har synlig krop`);
      assert.ok(piece.worldH > 1.45 && piece.worldH < 2.05, `${piece.id} er højere end et hop og lavere end port-figurerne`);
      assert.ok(piece.worldW > 0.7 && piece.worldW < 1.28, `${piece.id} passer i banen (${piece.worldW})`);
    }
    console.log("assets:", loaded.pieces.map((p) => `${p.id} ${p.name} ${p.w}x${p.h} verden ${p.worldW.toFixed(2)}x${p.worldH.toFixed(2)}`).join(" | "));

    const variety = await page.evaluate(() => {
      const d = window.__dispose.debug;
      d.start();
      d.state.paused = true;
      const spawned = d.spawnPieces(12, 1, 9);
      d.park();
      for (let i = 0; i < 220; i++) d.spawnPatternAt(5000 + i * 18);
      const obstacles = d.state.obstacles;
      return {
        spawned,
        kinds: [...new Set(obstacles.map((o) => o.kind))],
        pieceIds: [...new Set(obstacles.filter((o) => o.kind === "piece").map((o) => o.pieceId))],
        shark: obstacles.some((o) => o.kind === "shark" || /shark|haj/i.test(o.kind || "")),
      };
    });
    assert.equal(variety.spawned.length, 12);
    assert.deepEqual([...new Set(variety.spawned.slice(0, 6))].sort(), [...IDS].sort());
    assert.deepEqual([...new Set(variety.spawned.slice(6))].sort(), [...IDS].sort());
    assert.equal(variety.shark, false);
    for (const kind of ["hydrant", "wall", "bar", "orange", "piece"]) assert.ok(variety.kinds.includes(kind), "mangler " + kind);
    assert.deepEqual(variety.pieceIds.sort(), [...IDS].sort());
    console.log("spawn-variation:", variety.pieceIds.join(","), "mønstre:", variety.kinds.join(","));

    const hits = await page.evaluate(() => {
      const d = window.__dispose.debug;
      const s = d.state;
      const stats = Object.fromEntries(d.pieces().map((p) => [p.id, p]));
      function run(spec) {
        d.park();
        s.paused = true;
        s.mode = "run";
        s.lives = 3; s.invuln = spec.invuln || 0; s.y = spec.y || 0; s.vy = 0; s.slide = spec.slide || 0;
        s.lane = spec.lane ?? 1; s.x = spec.x ?? 0; s.stumble = 0;
        s.obstacles = [{
          kind: spec.kind || "piece", pieceId: spec.pieceId || "b", lane: spec.oLane ?? 1,
          at: s.dist + (spec.ahead ?? 0.2), type: spec.type || "tall",
          w: spec.w ?? stats.b.worldW, h: spec.h ?? stats.b.worldH,
          sp: {}, rot: 0, hit: false, vy: 0, fly: 0, roll: spec.roll || 0,
        }];
        const startAt = s.obstacles[0].at;
        d.tick(1 / 60);
        const o = s.obstacles[0];
        return { lives: s.lives, hit: !!o.hit, x: Math.round(s.x * 1000) / 1000, y: Math.round(s.y * 1000) / 1000, rolled: Math.round((startAt - o.at) * 1000) / 1000 };
      }
      return {
        centered: run({}),
        jumped: run({ y: 1.45 }),
        narrowMiss: run({ x: 0.7, w: stats.b.worldW, h: stats.b.worldH, pieceId: "b" }),
        wideHit: run({ x: 0.7, w: stats.k.worldW, h: stats.k.worldH, pieceId: "k" }),
        otherLane: run({ lane: 0, x: -1.3, oLane: 1 }),
        immune: run({ invuln: 2 }),
        hydrantGround: run({ kind: "hydrant", type: "low", w: 0.8, h: 1.05 }),
        hydrantJump: run({ kind: "hydrant", type: "low", w: 0.8, h: 1.05, y: 1.45 }),
        barSlide: run({ kind: "bar", type: "high", w: 1.3, h: 2, slide: 0.75 }),
        barStand: run({ kind: "bar", type: "high", w: 1.3, h: 2 }),
        orange: run({ kind: "orange", type: "tall", w: 1.25, h: 1.25, roll: 4.5, ahead: 2, invuln: 2 }),
      };
    });
    assert.equal(hits.centered.hit, true, "midt i banen rammer brikken");
    assert.equal(hits.centered.lives, 2);
    assert.equal(hits.jumped.hit, true, "et hop rydder ikke en høj brik");
    assert.equal(hits.narrowMiss.hit, false, "smal brik rammer ikke ved siden af kroppen");
    assert.equal(hits.wideHit.hit, true, "bred konge rammer samme sideværts afstand");
    assert.equal(hits.otherLane.hit, false, "nabobanen er fri");
    assert.equal(hits.immune.hit, false);
    assert.equal(hits.hydrantGround.hit, true, "lav forhindring rammer stadig på jorden");
    assert.equal(hits.hydrantJump.hit, false, "hop rydder stadig brandhanen");
    assert.equal(hits.barSlide.hit, false, "duk rydder stadig banneret");
    assert.equal(hits.barStand.hit, true, "banneret rammer stadig oprejst");
    assert.ok(hits.orange.rolled > 0.05 && hits.orange.rolled < 0.2, "appelsinen ruller stadig");
    console.log("kollision ok", JSON.stringify({ narrow: hits.narrowMiss, wide: hits.wideHit }));

    async function shoot(target, name) {
      await target.evaluate(() => {
        const d = window.__dispose.debug;
        d.start();
        d.setInvulnerable(true);
        d.park();
        d.state.paused = true;
        d.state.lane = 1; d.state.x = 0;
        d.lineup(5.4);
      });
      await wait(1800);
      await target.screenshot({ path: path.join(OUT, name) });
      const shown = await target.evaluate(() => {
        const pieces = window.__dispose.debug.state.obstacles.filter((o) => o.kind === "piece" && !o.hit);
        return { ids: pieces.map((o) => o.pieceId), shark: window.__dispose.debug.state.obstacles.some((o) => o.kind === "shark") };
      });
      assert.deepEqual(shown.ids, IDS);
      assert.equal(shown.shark, false);
    }
    await shoot(page, "desktop-onde-brikker.png");

    await page.evaluate(() => {
      const d = window.__dispose.debug;
      d.park();
      d.setInvulnerable(true);
      d.lineup(12);
      d.state.paused = false;
      d.state.lane = 1;
    });
    await wait(650);
    await page.screenshot({ path: path.join(OUT, "desktop-loeb-med-brikker.png") });
    await page.keyboard.press("ArrowLeft");
    await wait(280);
    await page.keyboard.press("ArrowUp");
    await wait(220);
    const moved = await page.evaluate(() => ({ lane: window.__dispose.debug.state.lane, y: window.__dispose.debug.state.y, mode: window.__dispose.debug.state.mode }));
    assert.equal(moved.lane, 0, "baneskift virker stadig");
    assert.ok(moved.y > 0.2, "hop virker stadig");
    await page.screenshot({ path: path.join(OUT, "desktop-hop-ved-brikker.png") });

    await page.evaluate(() => { const d = window.__dispose.debug; d.park(); d.state.paused = false; d.gateSoon(); });
    await page.waitForSelector("[data-bl-question]:not([hidden])", { timeout: 8000 });
    const gate = await page.evaluate(() => ({
      src: document.querySelector("[data-bl-q-img]").getAttribute("src"),
      who: document.querySelector("[data-bl-q-who]").textContent,
      text: document.querySelector("[data-bl-q-text]").textContent,
      options: document.querySelectorAll("[data-bl-opt]").length,
    }));
    assert.match(gate.src, /^assets\/brok-loeb\/(erling|gunnar|else|dummo)\.webp$/);
    assert.match(gate.who, /spærrer vejen/);
    assert.ok(gate.text.trim().length > 8, "brøkspørgsmålet vises");
    assert.equal(gate.options, 4);
    const correct = await page.evaluate(() => window.__dispose.debug.state.question.correctIndex);
    await page.click(`[data-bl-opt="${correct}"]`);
    await wait(800);
    const after = await page.evaluate(() => ({ mode: window.__dispose.debug.state.mode, correct: window.__dispose.debug.state.correct }));
    assert.equal(after.mode, "run");
    assert.equal(after.correct, 1);
    console.log("port og brøkspørgsmål urørt:", gate.src);
    await page.evaluate(() => { window.__dispose.debug.state.paused = true; });
    assert.deepEqual(unexpected(errors), [], "desktop-konsol: " + unexpected(errors).join(" | "));

    for (const [label, viewport, mobile] of [
      ["mobil-portraet-onde-brikker.png", { width: 390, height: 844 }, true],
      ["mobil-landskab-onde-brikker.png", { width: 844, height: 390 }, true],
    ]) {
      const opened = await open(viewport, mobile);
      await shoot(opened.page, label, 3.8);
      await opened.page.evaluate(() => {
        const d = window.__dispose.debug;
        d.park();
        d.setInvulnerable(true);
        d.lineup(8);
        d.state.paused = false;
        d.state.lane = 1;
        d.state.x = 0;
      });
      await wait(620);
      await opened.page.screenshot({ path: path.join(OUT, label.replace(".png", "-taet.png")) });
      await opened.page.evaluate(() => {
        const d = window.__dispose.debug;
        d.park();
        d.state.paused = false;
        d.setInvulnerable(false);
        d.state.lives = 3;
        d.state.lane = 1; d.state.x = 0; d.state.y = 0; d.state.vy = 0;
        d.state.obstacles = [{ kind: "piece", pieceId: "p", lane: 1, at: d.state.dist + 0.15, type: "tall", w: 0.99, h: 1.72, sp: {}, rot: 0, hit: false, vy: 0, fly: 0 }];
      });
      await wait(250);
      const lives = await opened.page.evaluate(() => window.__dispose.debug.state.lives);
      assert.ok(lives < 3, label + " rammer brikken under løb");
      assert.deepEqual(unexpected(opened.errors), [], label + ": " + unexpected(opened.errors).join(" | "));
      await opened.context.close();
    }

    const missing = await open({ width: 1280, height: 800 }, false, { failKing: true });
    const failed = await missing.page.evaluate(() => {
      const d = window.__dispose.debug;
      const pieces = d.pieces();
      d.start();
      d.state.paused = true;
      const spawned = d.spawnPieces(15, 0, 8);
      return {
        king: pieces.find((p) => p.id === "k"),
        others: pieces.filter((p) => p.id !== "k").every((p) => p.loaded),
        spawned,
        shark: d.state.obstacles.some((o) => o.kind === "shark"),
      };
    });
    assert.equal(failed.king.loaded, false);
    assert.equal(failed.others, true);
    assert.equal(failed.spawned.includes("k"), false);
    assert.equal(new Set(failed.spawned).size, 5);
    assert.equal(failed.shark, false);
    assert.deepEqual(unexpected(missing.errors), [], "manglende konge: " + unexpected(missing.errors).join(" | "));
    await missing.context.close();
    console.log("manglende konge falder tilbage uden haj:", failed.spawned.join(""));
    const video = desktop.page.video();
    await desktop.context.close();
    if (video) {
      const saved = await video.path();
      fs.copyFileSync(saved, path.join(OUT, "desktop-loeb.webm"));
    }
    console.log("brok-loeb pieces checks passed → " + OUT);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
