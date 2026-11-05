/* Dedicated screenshots for Dennis rework preview. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/workspace/reports/dennis-rework-preview";
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
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: true });
  console.log("wrote", dest);
}

async function openDennis(page) {
  await page.goto("http://angles.local/angles-games-preview.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ang-hub]");
  await page.locator('[data-ang-hub="dennis"]').click();
  await page.waitForSelector("[data-ag-dennis]");
  await page.waitForTimeout(250);
}

async function waitReady(page) {
  await page.waitForSelector('[data-ag="run"]:not([disabled])', { timeout: 8000 });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() =>
    chromium.launch({ headless: true })
  );
  try {
    const views = [
      ["desktop", { width: 1100, height: 900 }],
      ["mobile", { width: 390, height: 844 }],
      ["landscape", { width: 844, height: 390 }],
    ];
    for (const [label, viewport] of views) {
      const context = await browser.newContext({ viewport });
      await context.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.hostname !== "angles.local") return route.abort();
        return fulfillFromDisk(route, u.pathname);
      });
      await context.addInitScript(() => {
        window.Audio = function () {
          return {
            play() { return Promise.resolve(); },
            pause() {}, load() {}, removeAttribute() {},
            set onended(fn) { this._onended = fn; }, get onended() { return this._onended; },
            set onerror(fn) { this._onerror = fn; }, get onerror() { return this._onerror || null; },
          };
        };
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => console.error("PAGEERROR", e.message));

      await openDennis(page);
      await shot(page, `01-start-${label}.png`);

      // Angle choice highlighted
      await page.locator('[data-ag="deg"][data-v="90"]').click();
      await page.locator('[data-ag="dir-ccw"]').click();
      await page.waitForTimeout(150);
      await shot(page, `02-angle-choice-${label}.png`);

      // Reset to ligeud and walk for mid-walk + goal shots
      await page.locator('[data-ag="reset"]').click();
      await waitReady(page);
      await page.locator('[data-ag="deg"][data-v="0"]').click();
      await page.locator('[data-ag="run"]').click();
      await page.waitForTimeout(280);
      await shot(page, `03-mid-walk-${label}.png`);

      // Walk remaining steps; capture the moment he reaches pizza
      let gotGoal = false;
      for (let i = 0; i < 6; i++) {
        await waitReady(page);
        if (await page.locator(".ang-finish").count()) break;
        if (await page.locator('[data-ag="run"]').count() === 0) break;
        await page.locator('[data-ag="deg"][data-v="0"]').click();
        await page.locator('[data-ag="run"]').click();
        // After the step that lands on pizza, msg flashes briefly
        await page.waitForTimeout(520);
        const msg = await page.locator("[data-ag-msg]").textContent().catch(() => "");
        if (String(msg).includes("pizza")) {
          await shot(page, `04-goal-${label}.png`);
          gotGoal = true;
          break;
        }
      }
      if (!gotGoal) {
        await page.waitForTimeout(200);
        await shot(page, `04-goal-${label}.png`);
      }

      // Tracking sanity
      const tracks = await page.evaluate(() => window.__tracks || []);
      const ids = tracks.filter((t) => t.e === "exercise_start").map((t) => t.exercise_id);
      assert.ok(ids.includes("dennis_blindfold"), "dennis_blindfold start tracked");

      await context.close();
    }
    console.log("dennis rework shots done");
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
