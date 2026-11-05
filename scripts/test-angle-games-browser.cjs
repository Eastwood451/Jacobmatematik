/* Headless play-through + screenshots for the three angle games. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/workspace/reports/vinkel-spil-preview";
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

async function fulfillFromDisk(route, urlPath) {
  let rel = urlPath === "/" ? "angles-games-preview.html" : decodeURIComponent(urlPath.replace(/^\//, ""));
  rel = rel.split("?")[0];
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return route.fulfill({ status: 404, body: "missing " + rel });
  }
  const ext = path.extname(file).toLowerCase();
  return route.fulfill({ status: 200, contentType: MIME[ext] || "application/octet-stream", body: fs.readFileSync(file) });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() =>
    chromium.launch({ headless: true })
  );
  try {
    for (const [label, viewport] of [
      ["desktop", { width: 1100, height: 900 }],
      ["mobile", { width: 390, height: 844 }],
    ]) {
      const context = await browser.newContext({ viewport });
      await context.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.hostname !== "angles.local") return route.abort();
        return fulfillFromDisk(route, u.pathname);
      });
      await context.addInitScript(() => {
        window.Audio = function () {
          const a = {
            play() { return Promise.resolve(); },
            pause() {}, load() {}, removeAttribute() {},
            set onended(fn) { a._onended = fn; }, get onended() { return a._onended; },
            set onerror(fn) { a._onerror = fn; }, get onerror() { return a._onerror || null; },
          };
          return a;
        };
      });

      const page = await context.newPage();
      page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
      await page.goto("http://angles.local/angles-games-preview.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-ang-hub]");
      await page.waitForTimeout(200);
      await shot(page, `00-hub-${label}.png`);

      // --- Battleship ---
      await page.locator('[data-ang-hub="battleship"]').click();
      await page.waitForSelector("[data-ag-battleship]");
      await page.waitForTimeout(200);
      await shot(page, `01-battleship-menu-${label}.png`);
      await page.locator('[data-ag="mode-cpu"]').click();
      await page.waitForSelector(".ag-grid");
      await page.waitForTimeout(150);
      await shot(page, `02-battleship-board-${label}.png`);
      // Tap correct tile
      const targetText = await page.locator(".ag-target strong").textContent();
      const deg = Number(String(targetText).replace("°", ""));
      await page.locator(`.ag-tile[data-deg="${deg}"]`).first().click();
      await page.waitForTimeout(500);
      await shot(page, `03-battleship-hit-${label}.png`);
      // Back to hub
      await page.locator('[data-ag="exit"]').click();
      await page.waitForSelector("[data-ang-hub]");

      // --- Dennis ---
      await page.locator('[data-ang-hub="dennis"]').click();
      await page.waitForSelector("[data-ag-dennis]");
      await page.waitForTimeout(200);
      await shot(page, `04-dennis-level1-${label}.png`);
      // Level 1: go 4 east
      await page.locator('[data-ag="steps"][data-v="4"]').click();
      await page.locator('[data-ag="add-go"]').click();
      await page.locator('[data-ag="run"]').click();
      await page.waitForTimeout(2500);
      await shot(page, `05-dennis-after-run-${label}.png`);
      await page.locator('[data-ag="exit"]').click();
      await page.waitForSelector("[data-ang-hub]");

      // --- Ninja ---
      await page.locator('[data-ang-hub="ninja"]').click();
      await page.waitForSelector("[data-ag-ninja]");
      await page.waitForTimeout(200);
      await shot(page, `06-ninja-ready-${label}.png`);
      await page.locator('[data-ag="start"]').click();
      await page.waitForTimeout(900);
      // Simulate a swipe on canvas
      const canvas = page.locator("[data-ag-canvas]");
      const box = await canvas.boundingBox();
      assert.ok(box);
      const x0 = box.x + box.width * 0.3;
      const y0 = box.y + box.height * 0.5;
      const x1 = box.x + box.width * 0.3 + box.width * 0.2 * Math.cos(Math.PI / 4);
      const y1 = box.y + box.height * 0.5 - box.width * 0.2 * Math.sin(Math.PI / 4);
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x1, y1, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      await shot(page, `07-ninja-play-${label}.png`);
      await page.locator('[data-ag="exit"]').first().click();
      await page.waitForSelector("[data-ang-hub]");

      // --- Words ---
      await page.locator('[data-ang-hub="words"]').click();
      await page.waitForSelector("[data-ag-words]");
      await page.waitForTimeout(200);
      await shot(page, `09-words-play-${label}.png`);
      const correctKind = await page.getAttribute("[data-ag-words]", "data-ag-correct");
      assert.ok(correctKind, "data-ag-correct");
      await page.locator(`[data-ag-word="${correctKind}"]`).click();
      await page.waitForTimeout(700);
      await shot(page, `10-words-answer-${label}.png`);
      await page.locator('[data-ag="exit"]').first().click();
      await page.waitForSelector("[data-ang-hub]");
      await shot(page, `08-hub-again-${label}.png`);

      // Tracking: battleship + dennis + ninja + words starts
      const tracks = await page.evaluate(() => window.__tracks);
      const ids = tracks.filter((t) => t.e === "exercise_start").map((t) => t.exercise_id);
      assert.ok(ids.includes("angle_battleship"), "battleship start");
      assert.ok(ids.includes("dennis_blindfold"), "dennis start");
      assert.ok(ids.includes("angle_ninja"), "ninja start");
      assert.ok(ids.includes("angle_words"), "words start");
      console.log("ok", label, "tracks", ids.join(","));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log("angle games browser checks passed →", OUT);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
