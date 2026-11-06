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
assert.match(app, /runner:'\[data-action="fraction-runner"\]'/, "?start=runner bruger samme action som kortet");
assert.match(app, /anglesCard\(\) \+ runnerCard\(\)/, "kortet ligger ved Vinkler i Andre genveje");
assert.match(app, /"fraction-runner":"Brøk-løb"/, "tracking-navn");
assert.match(app, /const SKAK_BANNER_PUBLIC = false;\n\s*const canSeeSkakBanner = \(\) => SKAK_BANNER_PUBLIC \? canPlaySkak\(\) : canPlayRunner\(\)/, "skak-banneret åbnes med ét flag");
assert.match(app, /canPlayRunner\(\) \? `<a class="home-game-banner runner-banner"[^`]*data-action="fraction-runner"/, "brøk-banneret bruger samme gate som kortet");
assert.match(app, /canSeeSkakBanner\(\) \? `<a class="home-game-banner skak-banner"[^`]*data-action="skak"/, "skak-banneret er selv gated");
assert.match(app, /assets\/brok-loeb\/obbe-back\.webp/, "Øbbe bagfra");
assert.match(app, /assets\/brok-loeb\/erling\.webp/, "forhindring på vejen");
assert.match(app, /assets\/figurer\/skak\/w-p\.webp/, "pingvin-brik");
assert.match(app, /assets\/figurer\/skak\/w-b\.webp/, "puddel-brik");
assert.match(app, /assets\/figurer\/skak\/w-q\.webp/, "superhelt-brik");
assert.match(app, /Løb med Øbbe og knus brøkreglerne!/);
assert.match(app, /Slå brikkerne og regn dig til sejren!/);
const bannerGate = [app.match(/const gameModuleEnabled = [^\n]+/)[0], app.match(/const canPlaySkak = [^\n]+/)[0], gate, app.match(/const SKAK_BANNER_PUBLIC = [^\n]+\n\s*const canSeeSkakBanner = [^\n]+/)[0]].join("\n");
const seeBanner = vm.runInNewContext(`(state => { ${bannerGate}; return canSeeSkakBanner; })`, {});
const see = (user) => seeBanner({ user })();
assert.equal(see({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "teacher" }), true);
assert.equal(see({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true);
assert.equal(see({ id: "11111111-2222-3333-4444-555555555555", role: "student" }), false, "anden elev ser ikke skak-banneret");
assert.equal(see({ id: "99999999-2222-3333-4444-555555555555", role: "teacher" }), false, "anden lærer ser ikke skak-banneret");
assert.equal(see({ id: "guest-1", role: "guest" }), false, "gæst ser ikke skak-banneret");
assert.equal(see(null), false, "ikke logget ind");
const openedGate = bannerGate.replace("const SKAK_BANNER_PUBLIC = false", "const SKAK_BANNER_PUBLIC = true");
const seeOpened = vm.runInNewContext(`(state => { ${openedGate}; return canSeeSkakBanner; })`, {});
const opened = (user) => seeOpened({ user })();
assert.equal(opened({ id: "ordinary-student", role: "student" }), true, "flaget alene åbner banneret for andre elever");
assert.equal(opened({ id: "ordinary-teacher", role: "teacher" }), true, "flaget alene åbner banneret for andre lærere");
assert.equal(opened({ role: "guest", id: "guest-1" }), true, "flaget følger canPlaySkak");
assert.equal(opened(null), false, "flaget giver ikke banner uden bruger");
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
    await page.evaluate(() => {
      window.JacobSkak = { mount(root, opts) { root.innerHTML = '<button type="button" data-sk-exit>Tilbage</button>'; root.querySelector("[data-sk-exit]").onclick = () => opts.onExit(); return () => {}; } };
    });
    const user = (id, role) => page.evaluate(({ id, role }) => {
      const t = window.__t; t.state.user = { id, role, name: "Test", username: "test", results: [], assignedLetters: [], assignedNumbers: [], assignedTables: [], assignedAddends: [], assignedAddendSeconds: [] };
      t.state.view = role === "teacher" ? "teacher" : "student"; t.render();
    }, { id, role });
    await user("3af639de-b0e0-496a-a5b7-b732e49d1fa7", "student");
    assert.equal(await page.locator(".runner-card").count(), 1, "Jacobs elevprofil ser kortet");
    assert.equal(await page.locator(".runner-banner").count(), 1, "Jacobs elevprofil ser Brøk-løb-banneret");
    assert.equal(await page.locator(".skak-banner").count(), 1, "Jacobs elevprofil ser Skak-banneret");
    assert.equal(await page.locator(".home-game-links > *").count(), 4, "banner-rækken har de to eksisterende plus Brøk-løb og Skak");
    assert.equal(await page.locator('[data-action="fraction-runner"]').first().evaluate((el) => el.classList.contains("runner-banner")), true, "?start=runner rammer banneret, som har samme action som kortet");
    const OUT = process.env.BL_OUT || "test-results/brok-loeb"; fs.mkdirSync(OUT, { recursive: true });
    await page.waitForFunction(() => [...document.querySelectorAll(".home-game-links img")].every((img) => img.complete && img.naturalWidth > 0));
    await page.locator(".home-game-links").screenshot({ path: OUT + "/jacob-banner-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".home-game-links").screenshot({ path: OUT + "/jacob-banner-mobile.png" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "mobil hjem må ikke scrolle vandret");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator(".runner-card").scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + "/app-kort-andre-genveje.png" });
    await page.locator(".runner-card").click();
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
    await page.locator(".runner-card").click();
    await page.locator("[data-bl-ready]").waitFor();
    await page.locator("[data-bl-start] [data-bl-exit]").click();
    const last = await page.evaluate(() => window.__track.filter((e) => e[1] === "fraction_runner").map((e) => e[0]));
    assert.deepEqual(last.slice(-2), ["exercise_start", "exercise_end"], "afbrudt → exercise_end: " + last);
    await page.locator(".runner-banner").click();
    await page.locator("#brok-loeb-root [data-bl-start]").waitFor();
    const fromBanner = await page.evaluate(() => window.__track.filter((e) => e[1] === "fraction_runner").map((e) => e[0]));
    assert.equal(fromBanner.at(-1), "exercise_start", "banneret starter samme spil og tracking: " + fromBanner);
    await page.locator("[data-bl-start] [data-bl-exit]").click();
    await page.locator(".skak-banner").click();
    await page.locator("#skak-root [data-sk-exit]").waitFor();
    const skakTrack = await page.evaluate(() => window.__track.filter((e) => e[1] === "skak").map((e) => e[0]));
    assert.ok(skakTrack.includes("exercise_start"), "skak-banneret tracker som skak-kortet: " + skakTrack);
    await page.locator("[data-sk-exit]").click();
    assert.equal(await page.locator("#skak-root").count(), 0, "skak-banneret kommer hjem igen");
    await user("c8b8e1c4-3264-40e9-a43d-0eb6214a0183", "teacher");
    await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
    assert.equal(await page.locator(".runner-card").count(), 1, "Jacobs lærerprofil ser kortet");
    assert.equal(await page.locator(".runner-banner").count(), 1, "Jacobs lærerprofil ser Brøk-løb-banneret");
    assert.equal(await page.locator(".skak-banner").count(), 1, "Jacobs lærerprofil ser Skak-banneret");
    await page.locator(".runner-card").click();
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
      assert.equal(await page.locator(".runner-banner").count(), 0, `${role} ${id} ser ikke Brøk-løb-banneret`);
      assert.equal(await page.locator(".skak-banner").count(), 0, `${role} ${id} ser ikke Skak-banneret`);
      if (id === "ordinary-student") {
        assert.equal(await page.locator(".home-game-links > *").count(), 2, "andre elever har kun Erling FPS og foodtruck");
        await page.locator(".home-game-links").screenshot({ path: OUT + "/elev-uden-banner-desktop.png" });
      }
      await page.evaluate(() => { window.__t.state.view = "fraction-runner"; window.__t.render(); });
      await page.waitForTimeout(80);
      assert.equal(await page.locator("#brok-loeb-root").count(), 0, `${role}: tvunget view omgår ikke gaten`);
    }
    await page.evaluate(() => { window.__t.state.user = null; window.__t.render(); });
    assert.equal(await page.locator(".home-game-links").count(), 0, "ikke logget ind ser ingen spil-bannere");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log("brok-loeb browser gating checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
