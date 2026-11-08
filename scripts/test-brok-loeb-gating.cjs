/* Brøk-løb er åbent for alle, der kan spille de andre spil, når RUNNER_PUBLIC er true.
   Gæster følger gameModuleEnabled (som skak): de kan spille, men hjemmebanner-rækken er skjult.
   Skak-banneret følger canPlaySkak, når SKAK_BANNER_PUBLIC er true.
   Begge flag kan sættes til false igen.
   Browserdelen er en STUB-TEST: profiler sættes ind i hukommelsen. Der er intet Supabase-login
   og dermed ingen rigtig kontotest. Skak-bannerets første klik bruger en stub-mount, så tracking
   kan tælles; til sidst loades de rigtige skak-scripts, og både Brøk-løb og Skak åbnes. */
const assert = require("node:assert/strict"); const fs = require("node:fs"); const vm = require("node:vm");
const app = fs.readFileSync("app.js", "utf8");
const enabled = app.match(/const gameModuleEnabled = [^\n]+/)[0];
const gate = app.match(/const RUNNER_PROFILE_IDS = [^\n]+\n\s*const RUNNER_PUBLIC = [^\n]+\n\s*const canPlayRunner = [^\n]+/)[0];
const angleIds = app.match(/const ANGLES_PROFILE_IDS = new Set\((\[[^\]]+\])\)/)[1];
assert.match(gate, /const RUNNER_PUBLIC = true/);
assert.ok(gate.includes(angleIds), "profil-id'erne er bevaret, så flaget kan lukke igen");
const gateFn = vm.runInNewContext(`(state => { ${enabled}\n${gate}; return canPlayRunner; })`, {});
const can = (user) => gateFn({ user })();
assert.equal(can({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "teacher" }), true);
assert.equal(can({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true);
assert.equal(can({ id: "11111111-2222-3333-4444-555555555555", role: "student" }), true, "anden elev");
assert.equal(can({ id: "ordinary-student", role: "student" }), true, "almindelig elev");
assert.equal(can({ id: "99999999-2222-3333-4444-555555555555", role: "teacher" }), true, "anden lærer");
assert.equal(can({ id: "ordinary-teacher", role: "teacher" }), true, "almindelig lærer");
assert.equal(can({ id: "guest-1", role: "guest" }), true, "gæst kan spille som de andre spil");
assert.equal(can({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "guest" }), true, "gæst-rolle");
assert.equal(can({ id: "admin-1", role: "admin" }), false, "admin er ikke en spilrolle");
assert.equal(can({ role: "student" }), false, "elev uden id");
assert.equal(can(null), false, "ikke logget ind");
const closedRunner = vm.runInNewContext(`(state => { ${enabled}\n${gate.replace("const RUNNER_PUBLIC = true", "const RUNNER_PUBLIC = false")}; return canPlayRunner; })`, {});
const closedCan = (user) => closedRunner({ user })();
assert.equal(closedCan({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "teacher" }), true, "flaget kan lukke til Jacob igen");
assert.equal(closedCan({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true, "flaget kan lukke til Jacob igen");
assert.equal(closedCan({ id: "ordinary-student", role: "student" }), false, "lukket flag skjuler andre elever");
assert.equal(closedCan({ id: "guest-1", role: "guest" }), false, "lukket flag følger den gamle profil-gate");
assert.match(app, /return canPlayRunner\(\) \? `<button[^`]*data-action="fraction-runner"/, "kortet er gated");
assert.match(app, /if \(!canPlayRunner\(\)\) \{ state\.view=/, "renderRunner er gated");
assert.match(app, /action === "fraction-runner" \? canPlayRunner/, "action er gated");
assert.match(app, /runner:'\[data-action="fraction-runner"\]'/, "?start=runner bruger samme action som kortet");
assert.match(app, /anglesCard\(\) \+ runnerCard\(\)/, "kortet ligger ved Vinkler i Andre genveje");
assert.match(app, /"fraction-runner":"Brøk-løb"/, "tracking-navn");
assert.match(app, /const SKAK_BANNER_PUBLIC = true;\n\s*const canSeeSkakBanner = \(\) => SKAK_BANNER_PUBLIC \? canPlaySkak\(\) : canPlayRunner\(\)/, "skak-banneret styres med ét flag");
assert.match(app, /canPlayRunner\(\) \? `<a class="home-game-banner runner-banner"[^`]*data-action="fraction-runner"/, "brøk-banneret bruger samme gate som kortet");
assert.match(app, /canSeeSkakBanner\(\) \? `<a class="home-game-banner skak-banner"[^`]*data-action="skak"/, "skak-banneret er selv gated");
assert.match(app, /if \(isGuest\(\) \|\| !state\.user\) return ""/, "gæster og udloggede har ingen hjemmebanner-række");
const homeCss = fs.readFileSync("styles.css", "utf8");
assert.doesNotMatch(homeCss, /student-home-layout::before/, "hjemmets baggrund har ikke et afklippet lag mellem kolonnerne");
assert.match(homeCss, /body\.site-authenticated:has\(\.student-home-layout\)\{[^}]*linear-gradient\(180deg,#fcf7ee 0%,#f7efe3 55%,#faf4ea 100%\)/, "hjemskærmen har én lodret baggrund");
assert.match(app, /assets\/brok-loeb\/obbe-back\.webp/, "Øbbe bagfra");
assert.match(app, /assets\/brok-loeb\/erling\.webp/, "forhindring på vejen");
assert.match(app, /assets\/figurer\/skak\/w-p\.webp/, "pingvin-brik");
assert.match(app, /assets\/figurer\/skak\/w-b\.webp/, "puddel-brik");
assert.match(app, /assets\/figurer\/skak\/w-q\.webp/, "superhelt-brik");
assert.match(app, /Løb med Øbbe og knus brøkreglerne!/);
assert.match(app, /Slå brikkerne og regn dig til sejren!/);
const bannerGate = [enabled, app.match(/const canPlaySkak = [^\n]+/)[0], gate, app.match(/const SKAK_BANNER_PUBLIC = [^\n]+\n\s*const canSeeSkakBanner = [^\n]+/)[0]].join("\n");
const seeBanner = vm.runInNewContext(`(state => { ${bannerGate}; return canSeeSkakBanner; })`, {});
const see = (user) => seeBanner({ user })();
assert.equal(see({ id: "c8b8e1c4-3264-40e9-a43d-0eb6214a0183", role: "teacher" }), true);
assert.equal(see({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true);
assert.equal(see({ id: "ordinary-student", role: "student" }), true, "andre elever ser skak-banneret");
assert.equal(see({ id: "ordinary-teacher", role: "teacher" }), true, "andre lærere ser skak-banneret");
assert.equal(see({ id: "guest-1", role: "guest" }), true, "flaget følger canPlaySkak");
assert.equal(see({ id: "admin-1", role: "admin" }), false, "admin kan ikke spille skak");
assert.equal(see(null), false, "ikke logget ind");
const closedBannerSrc = bannerGate.replace("const RUNNER_PUBLIC = true", "const RUNNER_PUBLIC = false").replace("const SKAK_BANNER_PUBLIC = true", "const SKAK_BANNER_PUBLIC = false");
const seeClosed = vm.runInNewContext(`(state => { ${closedBannerSrc}; return canSeeSkakBanner; })`, {});
const closedSee = (user) => seeClosed({ user })();
assert.equal(closedSee({ id: "3af639de-b0e0-496a-a5b7-b732e49d1fa7", role: "student" }), true, "begge flag fra slår Jacob-profilen til igen");
assert.equal(closedSee({ id: "ordinary-student", role: "student" }), false, "begge flag fra skjuler banneret for andre");
assert.equal(closedSee({ id: "guest-1", role: "guest" }), false, "begge flag fra skjuler banneret for gæster");
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
    ]) {
      await user(id, role);
      await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
      assert.equal(await page.locator(".runner-card").count(), 1, `${role} ${id} ser Brøk-løb-kortet`);
      assert.equal(await page.locator(".runner-banner").count(), 1, `${role} ${id} ser Brøk-løb-banneret`);
      assert.equal(await page.locator(".skak-banner").count(), 1, `${role} ${id} ser Skak-banneret`);
      assert.equal(await page.locator(".home-game-links > *").count(), 4, `${role} ${id} ser alle fire hjemmebannere`);
      assert.equal(await page.locator(".angles-card").count(), 0, "vinkler er stadig kun Jacobs profiler");
      if (id === "ordinary-student") {
        await page.waitForFunction(() => [...document.querySelectorAll(".home-game-links img")].every((img) => img.complete && img.naturalWidth > 0));
        await page.locator(".home-game-links").screenshot({ path: OUT + "/elev-banner-desktop.png" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator(".home-game-links").screenshot({ path: OUT + "/elev-banner-mobile.png" });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "mobil hjem må ikke scrolle vandret");
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator(".runner-banner").click();
        await page.locator("#brok-loeb-root [data-bl-start]").waitFor();
        await page.locator("[data-bl-ready]").waitFor();
        await page.waitForTimeout(300);
        await page.screenshot({ path: OUT + "/elev-brok-loeb-start.png" });
        await page.locator("[data-bl-start] [data-bl-exit]").click();
        assert.equal(await page.locator("#brok-loeb-root").count(), 0, "almindelig elev forlader spillet");
      }
    }
    for (const [id, role] of [
      ["guest-1", "guest"],
      ["c8b8e1c4-3264-40e9-a43d-0eb6214a0183", "guest"],
      ["3af639de-b0e0-496a-a5b7-b732e49d1fa7", "guest"],
    ]) {
      await user(id, role);
      await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
      assert.equal(await page.locator(".home-game-links").count(), 0, `${role} ${id} ser ingen hjemmebannere, som ved de andre spil`);
      assert.equal(await page.locator(".runner-card").count(), 1, `${role} ${id} kan stadig åbne Brøk-løb fra Andre genveje`);
      assert.equal(await page.locator(".skak-card").count(), 1, `${role} ${id} kan stadig åbne skak`);
      await page.locator(".runner-card").click();
      await page.locator("#brok-loeb-root [data-bl-start]").waitFor();
      await page.locator("[data-bl-start] [data-bl-exit]").click();
      assert.equal(await page.locator("#brok-loeb-root").count(), 0, `${role} forlader spillet`);
    }
    await user("admin-1", "admin");
    await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
    assert.equal(await page.locator('[data-action="fraction-runner"]').count(), 0, "admin ser ikke Brøk-løb");
    assert.equal(await page.locator(".skak-banner").count(), 0, "admin ser ikke Skak-banneret");
    await page.evaluate(() => { window.__t.state.view = "fraction-runner"; window.__t.render(); });
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#brok-loeb-root").count(), 0, "admin: tvunget view omgår ikke gaten");
    // Rigtige modul-scripts. Brugerne er stadig indsat i hukommelsen — ikke et login.
    await page.addStyleTag({ content: fs.readFileSync("skak.css", "utf8") });
    await page.addScriptTag({ content: fs.readFileSync("skak-chess-lib.js", "utf8") });
    await page.addScriptTag({ content: fs.readFileSync("skak-core.js", "utf8") });
    await page.addScriptTag({ content: fs.readFileSync("skak.js", "utf8") });
    assert.equal(await page.evaluate(() => typeof window.JacobSkak.mount), "function", "rigtig skak-mount er loadet");
    for (const [id, role, label] of [
      ["ordinary-student", "student", "almindelig elev uden allowlist"],
      ["3af639de-b0e0-496a-a5b7-b732e49d1fa7", "student", "allowlist-elev"],
      ["ordinary-teacher", "teacher", "almindelig lærer"],
      ["c8b8e1c4-3264-40e9-a43d-0eb6214a0183", "teacher", "allowlist-lærer"],
    ]) {
      await user(id, role);
      await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
      assert.equal(await page.locator(".runner-banner").count(), 1, `${label} ser Brøk-løb-banneret`);
      assert.equal(await page.locator(".skak-banner").count(), 1, `${label} ser Skak-banneret`);
      if (role === "student" && id === "ordinary-student") assert.equal(await page.locator(".angles-card").count(), 0, "vinkler er ikke åbnet for almindelige elever");
      await page.locator(".runner-banner").click();
      await page.locator("#brok-loeb-root [data-bl-start]").waitFor();
      await page.locator("[data-bl-ready]").waitFor();
      if (id === "ordinary-teacher") await page.screenshot({ path: OUT + "/laerer-brok-loeb-start.png" });
      await page.locator("[data-bl-start] [data-bl-exit]").click();
      assert.equal(await page.locator("#brok-loeb-root").count(), 0, `${label} forlader Brøk-løb`);
      await page.evaluate(() => { window.__t.state.view = "student"; window.__t.render(); });
      await page.locator(".skak-banner").click();
      await page.locator("#skak-root [data-act='start-cpu']").waitFor();
      assert.match(await page.locator("#skak-root").innerText(), /Start kamp/, `${label} er inde i rigtig skak-menu`);
      if (id === "ordinary-student") await page.screenshot({ path: OUT + "/elev-skak-start.png" });
      if (id === "c8b8e1c4-3264-40e9-a43d-0eb6214a0183") await page.screenshot({ path: OUT + "/allowlist-laerer-skak-start.png" });
      await page.locator("#skak-root [data-act='exit']").click();
      assert.equal(await page.locator("#skak-root").count(), 0, `${label} forlader Skak`);
    }
    await page.evaluate(() => { window.__t.state.user = null; window.__t.render(); });
    assert.equal(await page.locator(".home-game-links").count(), 0, "ikke logget ind ser ingen spil-bannere");
    assert.equal(await page.locator('[data-action="fraction-runner"]').count(), 0, "ikke logget ind kan ikke starte Brøk-løb");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log("brok-loeb browser gating checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
