/* Headless play-through + screenshots for Brøk-løb (desktop, mobil portræt, mobil landskab). */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.BL_OUT || "/workspace/reports/brok-loeb-preview";
fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webp": "image/webp" };

async function fulfill(route, urlPath) {
  let rel = urlPath === "/" ? "brok-loeb-preview.html" : decodeURIComponent(urlPath.replace(/^\//, ""));
  rel = rel.split("?")[0];
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "missing " + rel });
  return route.fulfill({ status: 200, contentType: MIME[path.extname(file).toLowerCase()] || "application/octet-stream", body: fs.readFileSync(file) });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fpsReport = [];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const [label, viewport, mobile] of [
      ["desktop", { width: 1280, height: 800 }, false],
      ["mobil-portraet", { width: 390, height: 844 }, true],
      ["mobil-landskab", { width: 844, height: 390 }, true],
    ]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
      await context.route("**/*", (route) => { const u = new URL(route.request().url()); return u.hostname === "brok.local" ? fulfill(route, u.pathname) : route.abort(); });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto("http://brok.local/");
      await page.waitForSelector("[data-bl-ready]");
      await wait(400);
      await page.screenshot({ path: path.join(OUT, `${label}-1-start.png`) });

      await page.click("[data-bl-go]");
      await page.evaluate(() => window.__dispose.debug.setInvulnerable(true));
      await wait(1600);
      // Baneskift: piletast (desktop) eller swipe (mobil)
      if (mobile) {
        const box = await page.locator("[data-bl-canvas]").boundingBox();
        const cx = box.x + box.width / 2, cy = box.y + box.height * 0.6;
        await page.evaluate(({ cx, cy }) => {
          const c = document.querySelector("[data-bl-canvas]");
          const ev = (type, x) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: cy, pointerId: 7, bubbles: true, pointerType: "touch" }));
          ev("pointerdown", cx); ev("pointermove", cx - 20); ev("pointermove", cx - 70); ev("pointerup", cx - 70);
        }, { cx, cy });
      } else await page.keyboard.press("ArrowLeft");
      await wait(250);
      let st = await page.evaluate(() => ({ lane: window.__dispose.debug.state.lane, dist: window.__dispose.debug.state.dist }));
      assert.equal(st.lane, 0, "baneskift til venstre virker");
      assert.ok(st.dist > 5, "Øbbe løber fremad");
      await page.screenshot({ path: path.join(OUT, `${label}-2-loeb-baneskift.png`) });
      await page.keyboard.press("ArrowUp");
      await wait(220);
      await page.screenshot({ path: path.join(OUT, `${label}-3-hop.png`) });
      await wait(700);

      // FPS (headless, software-rendering → konservativt tal)
      await wait(1500);
      const fps = await page.evaluate(() => window.__dispose.debug.fps());
      fpsReport.push(`${label}: ~${fps} fps`);

      // Slowmotion-spørgsmål: rigtigt svar
      await page.evaluate(() => window.__dispose.debug.gateSoon());
      await page.waitForSelector("[data-bl-question]:not([hidden])", { timeout: 8000 });
      await wait(500);
      const ts = await page.evaluate(() => window.__dispose.debug.state.timeScale);
      assert.ok(ts < 0.3, "tiden går i slowmotion (" + ts + ")");
      await page.screenshot({ path: path.join(OUT, `${label}-4-slowmo-spoergsmaal.png`) });
      const ci = await page.evaluate(() => window.__dispose.debug.state.question.correctIndex);
      await page.click(`[data-bl-opt="${ci}"]`);
      await wait(350);
      await page.screenshot({ path: path.join(OUT, `${label}-5-rigtigt-svar.png`) });
      await wait(900);
      await page.screenshot({ path: path.join(OUT, `${label}-6-igennem.png`) });
      st = await page.evaluate(() => ({ mode: window.__dispose.debug.state.mode, correct: window.__dispose.debug.state.correct }));
      assert.equal(st.mode, "run"); assert.equal(st.correct, 1);

      // Forkert svar → regel + eksempel, mister et liv
      await page.evaluate(() => window.__dispose.debug.setInvulnerable(false));
      await page.evaluate(() => window.__dispose.debug.gateSoon());
      await page.waitForSelector("[data-bl-question]:not([hidden])", { timeout: 8000 });
      await wait(400);
      const wi = await page.evaluate(() => (window.__dispose.debug.state.question.correctIndex + 1) % window.__dispose.debug.state.question.options.length);
      const livesBefore = await page.evaluate(() => window.__dispose.debug.state.lives);
      await page.click(`[data-bl-opt="${wi}"]`);
      await page.waitForSelector("[data-bl-q-feedback]:not([hidden])");
      await wait(300);
      await page.screenshot({ path: path.join(OUT, `${label}-7-forkert-svar-regel.png`) });
      await page.click("[data-bl-next]");
      await wait(200);
      const livesAfter = await page.evaluate(() => window.__dispose.debug.state.lives);
      assert.equal(livesAfter, livesBefore - 1, "forkert svar koster et liv");
      await page.screenshot({ path: path.join(OUT, `${label}-8-snubler.png`) });

      // Pause
      await page.click("[data-bl-pause]");
      await page.waitForSelector("[data-bl-paused]:not([hidden])");
      const d1 = await page.evaluate(() => window.__dispose.debug.state.dist); await wait(400);
      const d2 = await page.evaluate(() => window.__dispose.debug.state.dist);
      assert.equal(d1, d2, "pause stopper spillet");
      await page.screenshot({ path: path.join(OUT, `${label}-9-pause.png`) });
      await page.click("[data-bl-quit]");
      await page.waitForSelector("[data-bl-over]:not([hidden])");
      await wait(200);
      await page.screenshot({ path: path.join(OUT, `${label}-10-slut-det-har-du-oevet.png`) });
      const results = await page.evaluate(() => window.__results.length);
      assert.equal(results, 2, "to svar logget");
      const best = await page.evaluate(() => localStorage.getItem("jm_brok_loeb_best"));
      assert.ok(Number(best) > 0, "bedste score gemt");
      assert.deepEqual(errors, [], "ingen JS-fejl");
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, "fps.txt"), fpsReport.join("\n") + "\n");
  console.log(fpsReport.join("\n"));
  console.log("brok-loeb browser checks passed → " + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
