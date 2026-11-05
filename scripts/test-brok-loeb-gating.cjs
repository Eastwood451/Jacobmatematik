/* Brøk-løb-gating: kun Jacobs profiler ser kortet (samme mønster som Vinkler).
   Statiske tjek + rigtig app.js i headless chromium med falske brugere (ingen login/database). */
const assert = require("node:assert/strict"); const fs = require("node:fs"); const vm = require("node:vm");
const app = fs.readFileSync("app.js", "utf8");
const gate = app.match(/const RUNNER_PROFILE_IDS = [^\n]+\n\s*const canPlayRunner = [^\n]+/)[0];
const angleIds = app.match(/const ANGLES_PROFILE_IDS = new Set\((\[[^\]]+\])\)/)[1];
assert.ok(gate.includes(angleIds), "samme to profil-id'er som Vinkler");
const gateFn = vm.runInNewContext(`(state => { ${gate}; return canPlayRunner; })`, {});
const can = (user) => gateFn({ user })();
assert.equal(can({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "teacher" }), true);
assert.equal(can({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true);
assert.equal(can({ id: "11111111-2222-3333-4444-555555555555", role: "student" }), false, "anden elev");
assert.equal(can({ id: "99999999-2222-3333-4444-555555555555", role: "teacher" }), false, "anden lærer");
assert.equal(can({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "guest" }), false, "gæst-rolle");
assert.equal(can(null), false, "ikke logget ind");
assert.match(app, /return canPlayRunner\(\) \? `<button[^`]*data-action="fraction-runner"/, "kortet er gated");
assert.match(app, /if \(!canPlayRunner\(\)\) \{ state\.view=/, "renderRunner er gated");
assert.match(app, /action === "fraction-runner" \? canPlayRunner/, "action er gated");
assert.match(app, /runner:'\[data-action="fraction-runner"\]'/, "?start=runner klikker kun kortet");
assert.match(app, /anglesCard\(\) \+ runnerCard\(\)/, "kortet ligger ved Vinkler i Andre genveje");
assert.match(app, /"fraction-runner":"Brøk-løb"/, "tracking-navn");
const plain = fs.readFileSync("brok-loeb.js", "utf8") + fs.readFileSync("brok-loeb-core.js", "utf8");
assert.doesNotMatch(plain, /jmTrack/, "spillet tracker ikke selv (app.js gør det → ingen dobbelttælling)");
console.log("brok-loeb static gating checks passed");

if (process.env.SKIP_BROWSER) process.exit(0);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const source = app.replace(/  start\(\);\s*\}\)\(\);/, "  window.__t={state,render};\n})();");
assert(source.includes("window.__t="));
const css = ["styles.css", "cinematic-theme.css", "brok-loeb.css"].map((p) => fs.readFileSync(p, "utf8")).join("\n");
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox"] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.href === "https://runner-test.invalid/") return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="da"><head><meta charset="utf-8"></head><body><main id="app"></main></body></html>' });
      if (u.origin === "https://runner-test.invalid" && u.pathname.startsWith("/assets/")) {
        const f = "." + decodeURIComponent(u.pathname);
        if (fs.existsSync(f)) return route.fulfill({ contentType: f.endsWith(".webp") ? "image/webp" : "image/png", body: fs.readFileSync(f) });
      }
      return route.abort();
    });
    await page.goto("https://runner-test.invalid/");
    await page.addStyleTag({ content: css });
    await page.evaluate(() => { window.JacobBackend = { configured: false }; window.__track = []; window.jmTrack = (name, props) => window.__track.push([name, props && props.exercise_id, props && props.exercise_name]); });
    await page.addScriptTag({ content: fs.readFileSync("brok-loeb-core.js", "utf8") });
    await page.addScriptTag({ content: fs.readFileSync("brok-loeb.js", "utf8") });
    await page.addScriptTag({ content: source });
    const user = (id, role) => page.evaluate(({ id, role }) => {
      const t = window.__t; t.state.user = { id, role, name: "Test", username: "test", results: [], assignedLetters: [], assignedNumbers: [], assignedTables: [], assignedAddends: [], assignedAddendSeconds: [] };
      t.state.view = role === "teacher" ? "teacher" : "student"; t.render();
    }, { id, role });
    await user("3af639de-b0e0-496a-a5b7-b732e49d1fa7", "student");
    assert.equal(await page.locator('[data-action="fraction-runner"]').count(), 1, "Jacobs elevprofil ser kortet");
    const OUT = process.env.BL_OUT || "test-results/brok-loeb"; fs.mkdirSync(OUT, { recursive: true });
    await page.locator('[data-action="fraction-runner"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + "/app-kort-andre-genveje.png" });
    await page.locator('[data-action="fraction-runner"]').click();
    await page.locator("#brok-loeb-root [data-bl-start]").waitFor();
    await page.locator("[data-bl-ready]").waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + "/app-startskaerm.png" });
    await page.locator("[data-bl-go]").click();
    await page.waitForTimeout(300);
    const tracked = await page.evaluate(() => window.__track.filter((e) => e[1] === "fraction_runner"));
    assert.ok(tracked.some((e) => e[0] === "exercise_start" && e[2] === "Brøk-løb"), "exercise_start tracket: " + JSON.stringify(tracked));
    await page.locator("[data-bl-pause]").click();
    await page.locator("[data-bl-quit]").click();
    await page.locator("[data-bl-over]:not([hidden])").waitFor();
    await page.locator("[data-bl-over] [data-bl-exit]").click();
    assert.equal(await page.locator("#brok-loeb-root").count(), 0, "Tilbage forlader spillet");
    const after = await page.evaluate(() => window.__track.filter((e) => e[1] === "fraction_runner").map((e) => e[0]));
    assert.ok(after.includes("exercise_complete"), "afsluttet løb → exercise_complete: " + after);
    // Gå ind og straks ud igen fra startskærmen → exercise_end (ikke complete)
    await page.locator('[data-action="fraction-runner"]').click();
    await page.locator("[data-bl-ready]").waitFor();
    await page.locator("[data-bl-start] [data-bl-exit]").click();
    const last = await page.evaluate(() => window.__track.filter((e) => e[1] === "fraction_runner").map((e) => e[0]));
    assert.deepEqual(last.slice(-2), ["exercise_start", "exercise_end"], "afbrudt → exercise_end: " + last);
    await user("c8b8e1c4-3264-40e9-a43d-0eb6214a0183", "teacher");
    await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
    assert.equal(await page.locator('[data-action="fraction-runner"]').count(), 1, "Jacobs lærerprofil ser kortet");
    await page.locator('[data-action="fraction-runner"]').click();
    await page.locator("#brok-loeb-root [data-bl-start]").waitFor();
    await page.locator("[data-bl-ready]").waitFor();
    await page.locator("[data-bl-start] [data-bl-exit]").click();
    assert.equal(await page.locator("#brok-loeb-root").count(), 0, "Jacobs lærerprofil forlader spillet");
    for (const [id, role] of [
      ["ordinary-student", "student"],
      ["11111111-2222-3333-4444-555555555555", "student"],
      ["ordinary-teacher", "teacher"],
      ["99999999-2222-3333-4444-555555555555", "teacher"],
      ["guest-1", "guest"],
      ["c8b8e1c4-3264-40e9-a43d-0eb6214a0183", "guest"],
      ["3af639de-b0e0-496a-a5b7-b732e49d1fa7", "guest"],
      ["admin-1", "admin"],
    ]) {
      await user(id, role);
      await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
      assert.equal(await page.locator('[data-action="fraction-runner"]').count(), 0, `${role} ${id} ser ikke kortet`);
      await page.evaluate(() => { window.__t.state.view = "fraction-runner"; window.__t.render(); });
      await page.waitForTimeout(80);
      assert.equal(await page.locator("#brok-loeb-root").count(), 0, `${role}: tvunget view omgår ikke gaten`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log("brok-loeb browser gating checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
