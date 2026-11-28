// Run with Playwright in NODE_PATH. All pupil data stays in the test browser.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function test() {
  const browser = await chromium.launch({ channel:"chrome" });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.addInitScript(() => {
      localStorage.setItem("jm-lang", "da");
      localStorage.setItem("jm-analytics-consent-v1", JSON.stringify({ value:"denied", at:Date.now() }));
      const student = { role:"student", id:"test", username:"test", name:"Test", password:"test", results:[] };
      localStorage.setItem("jacobmatematik-db-v1", JSON.stringify({ users:[student] }));
      window.played = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        this.addEventListener("playing", () => window.played.push(this.currentSrc.split("/").pop()), { once:true });
        return play.call(this);
      };
    });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
    await page.locator("#username").fill("test");
    await page.locator("#password").fill("test");
    await page.locator("#password").press("Enter");
    const openTopic = name => page.locator(`.topic-card[data-topic="${name}"]`).click();
    const choose = n => page.locator(`[data-value="${n}"]`).click();
    const prompt = name => page.getByRole("heading", { name, exact:true }).waitFor();
    const direction = () => page.locator(".nl-pointer").evaluate(el => getComputedStyle(el).transform);
    const back = page.getByRole("button", { name:"Forrige trin", exact:true });
    const forward = page.getByRole("button", { name:"Næste trin", exact:true });
    const clock = page.locator(".nl-clock");

    await openTopic("negatives");
    await choose(0);
    await prompt("Hvor starter du?");
    await choose(1);
    await prompt("Plus betyder: Gå til højre.");
    assert(await clock.isVisible());
    await page.waitForFunction(() => parseFloat(document.querySelector(".nl-clock").style.getPropertyValue("--remaining")) < 85);
    await back.click();
    await prompt("Hvor starter du?");
    assert(await clock.isHidden());
    await choose(1);
    await forward.click();
    await prompt("Minus betyder, at retningen vender.");
    await back.click();
    await prompt("Plus betyder: Gå til højre.");
    await prompt("Minus betyder, at retningen vender.");
    await prompt("Hvor lander du?");
    assert(await clock.isHidden());
    assert(await forward.isDisabled());
    await back.click();
    await prompt("Minus betyder, at retningen vender.");
    await forward.click();
    await prompt("Hvor lander du?");
    assert.match(await direction(), /^matrix\(-1,/);
    await choose(-1);
    await prompt("Prøv igen. Hvor lander du?");
    await choose(-2);
    await prompt("Flot!");
    await page.waitForFunction(() => window.played.includes("flot.mp3"));
    await page.locator(".nl-next").click();

    await page.setViewportSize({ width:390, height:844 });
    await choose(4);
    await prompt("Minus betyder, at retningen vender.");
    await prompt("Endnu et minus vender retningen igen!");
    assert.match(await direction(), /^matrix\(-1,/);
    await prompt("Hvor lander du nu?");
    assert.match(await direction(), /^matrix\(1,/);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator(".nl-replay").click();
    await prompt("Hvor lander du nu?");
    await page.getByRole("button", { name:"6", exact:true }).press("Enter");
    await prompt("Flot!");
    await page.locator(".nl-next").click();
    await prompt("Start med de positive tal.");
    await page.getByText("Hvad er 2 gange PLUS 3?", {exact:true}).waitFor();
    await choose(0);
    assert(await page.locator(".nl-vectors").isHidden());
    await choose(6);
    await prompt("2 × 3 er 6.");
    assert.equal(await page.locator(".nl-vector").count(), 2);
    await back.click();
    await page.getByText("Hvad er 2 gange PLUS 3?", {exact:true}).waitFor();
    await choose(6);
    await forward.click();
    await prompt("Minus vender retningen.");
    await back.click();
    await prompt("2 × 3 er 6.");
    await page.getByText("2 af 2 pile · Spidsen er på 6.").waitFor();
    const chainTip = () => page.locator(".nl-vector:last-child").evaluate(el => {
      const rect = el.getBoundingClientRect();
      const direction = getComputedStyle(el.parentElement).transform;
      return new DOMMatrix(direction).a < 0 ? rect.left : rect.right;
    });
    const tickCenter = n => page.locator(`[data-value="${n}"]`).evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    await prompt("Minus vender retningen.");
    assert.equal(await page.locator(".nl-sign.active").getAttribute("data-sign"), "operand");
    const firstTip = await page.locator(".nl-vector").first().evaluate(el => el.getBoundingClientRect().right);
    assert(await page.locator('[data-value="3"] span').isVisible());
    assert(Math.abs(firstTip - await tickCenter(3)) < 1);
    assert(Math.abs(await chainTip() - await tickCenter(6)) < 1);
    await page.waitForFunction(() => {
      const matrix = new DOMMatrix(getComputedStyle(document.querySelector(".nl-vectors")).transform);
      return matrix.b < -0.5;
    });
    await prompt("Hvor lander du?");
    assert(Math.abs(await chainTip() - await tickCenter(-6)) < 1);
    await choose(-6);
    await prompt("Flot!");
    await page.locator(".nl-next").click();
    await page.getByText("Hvad er 2 gange 3?", {exact:true}).waitFor();
    await choose(6);
    await prompt("2 × 3 er 6.");
    await prompt("Minus vender retningen.");
    assert.equal(await page.locator(".nl-sign.active").getAttribute("data-sign"), "first");
    await prompt("Endnu et minus vender retningen endnu en gang!");
    assert.equal(await page.locator(".nl-sign.active").getAttribute("data-sign"), "operand");
    assert(Math.abs(await chainTip() - await tickCenter(-6)) < 1);
    await prompt("Hvor lander du?");
    assert(Math.abs(await chainTip() - await tickCenter(6)) < 1);
    await choose(6);
    await prompt("Flot!");
    const results = await page.evaluate(() => JSON.parse(localStorage.getItem("jacobmatematik-db-v1")).users[0].results);
    assert.deepEqual(results.map(r => [r.problem, r.answer, r.correct]), [["1 + (-3)", -1, false], ["4 − (-2)", 6, true], ["2 × (-3)", -6, true], ["-2 × (-3)", 6, true]]);
    const clips = await page.evaluate(() => window.played);
    for (const clip of ["start", "plus", "minus", "igen", "landing", "landing-igen", "flot"]) assert(clips.includes(clip + ".mp3"), clip);
    assert(clips.includes("eksempel.mp3"));
    for (const clip of ["positive-eksempel.mp3", "positive-dobbelt.mp3", "vend-igen.mp3"]) assert(clips.includes(clip), clip);
    assert(clips.filter(clip => clip === "vending.mp3").length >= 2);

    await page.locator("[data-action=home]").click();
    await openTopic("negatives");
    await choose(1);
    await page.locator("[data-action=home]").click();
    await openTopic("addition");
    const [a,b] = (await page.locator(".expression").innerText()).split("+").map(Number);
    await page.keyboard.type(String(a + b));
    await page.keyboard.press("Enter");
    await page.getByText("Opgave 2", { exact:true }).waitFor();
    assert.deepEqual(errors, []);
    console.log("Verified all four lessons, positive-product choices, vector lengths, sign changes, audio, navigation and saved results.");
  } finally {
    await browser.close();
  }
}

test().catch(error => { console.error(error); process.exitCode = 1; });
