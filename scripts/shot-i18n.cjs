/* Representative Danish and English exercise flows. Screenshots land in /opt/cursor/artifacts. */
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("/tmp/node_modules/puppeteer-core");

const BASE = process.env.JM_BASE || "http://127.0.0.1:8765";
const OUT = "/opt/cursor/artifacts";
const chrome = process.env.CHROME || "/opt/google/chrome/chrome";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function shot(page, name) {
  const file = path.join(OUT, name + ".png");
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function text(page) {
  return page.evaluate(() => document.body.innerText);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--lang=en-US", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const notes = [];

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());

  await page.goto(BASE + "/?lang=en", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.innerText.includes("Good to see you") || document.body.innerText.includes("Guest"));
  assert(page.url().indexOf("lang=") === -1, "lang query should be stored and removed");
  const stored = await page.evaluate(() => localStorage.getItem("jm-lang"));
  assert(stored === "en", "explicit /?lang=en must persist, got " + stored);
  assert((await text(page)).includes("Good to see you"), "English login");
  assert(!(await text(page)).includes("Godt at se dig"), "Danish login heading should be gone");
  await page.waitForFunction(() => {
    const root = document.querySelector("#jm-cookie-settings")?.shadowRoot;
    return root && root.textContent.includes("May we measure visits?");
  });
  await page.evaluate(() => document.querySelector("#jm-cookie-settings").shadowRoot.querySelector('[data-choice="denied"]').click());
  await shot(page, "en-login");
  notes.push("en-login: English login");

  await page.click("[data-action=guest-login]");
  await page.waitForFunction(() => document.body.innerText.includes("Hi Guest!"));
  assert((await text(page)).includes("What do you want to practise today?"), "English home");
  assert((await text(page)).includes("Maths Tower"), "Tower title");
  assert((await text(page)).includes("Pencil-case addition"), "Protected exercise stays listed");
  assert((await text(page)).includes("Learn the clock"), "Clock stays listed");
  await shot(page, "en-home");
  notes.push("en-home: guest home");

  await page.click('.topic-card[data-topic="addition"]');
  await page.waitForFunction(() => document.body.innerText.includes("Type your answer below."));
  const expr = await page.$eval(".expression", el => el.textContent.trim());
  const [a, b] = expr.split("+").map(part => Number(part.trim()));
  const wrong = String((a + b + 3) % 10);
  await page.click(`[data-key="${wrong}"]`);
  await page.click('[data-key="enter"]');
  await page.waitForFunction(() => document.body.innerText.includes("The correct answer is"));
  assert((await text(page)).includes(String(a + b)), "shows the right total");
  assert(!(await text(page)).includes("Det korrekte svar er"), "Danish correction gone");
  await shot(page, "en-addition-wrong");
  notes.push("en-addition-wrong: " + expr + " wrong " + wrong);

  await page.click("[data-action=continue-after-correction]");
  await page.waitForFunction(() => /question\s+2/i.test(document.body.innerText));
  const expr2 = await page.$eval(".expression", el => el.textContent.trim());
  const [c, d] = expr2.split("+").map(part => Number(part.trim()));
  const answer = String(c + d);
  if (answer.length === 2) {
    await page.click(`[data-key="${answer[0]}"]`);
    await page.click(`[data-key="${answer[1]}"]`);
  } else await page.click(`[data-key="${answer}"]`);
  await page.click('[data-key="enter"]');
  await page.waitForFunction(() => /question\s+3/i.test(document.body.innerText));
  await page.click('[data-action="home"]');
  await page.waitForFunction(() => document.body.innerText.includes("Hi Guest!"));
  const homeAfter = await text(page);
  assert(homeAfter.includes("2 problems") || homeAfter.includes("1 problem"), "result count in English");
  await shot(page, "en-home-after-results");
  notes.push("en-home-after-results");

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.innerText.includes("Good to see you"));
  assert(await page.evaluate(() => localStorage.getItem("jm-lang")) === "en", "reload keeps English");
  await page.type("#username", "no-such-user");
  await page.type("#password", "wrong-password");
  await page.click('#login-form button[type="submit"]');
  await page.waitForFunction(() => document.body.innerText.includes("does not match") || document.body.innerText.includes("passer ikke"), { timeout: 20000 });
  const loginText = await text(page);
  assert(loginText.includes("That username or password does not match."), "English login error");
  await shot(page, "en-login-error");
  notes.push("en-login-error");

  await page.click("[data-jm-lang-switch] [data-set-lang=da]");
  await page.waitForFunction(() => document.body.innerText.includes("Godt at se dig"));
  assert(await page.evaluate(() => localStorage.getItem("jm-lang")) === "da", "DA stores da");
  await shot(page, "da-login");
  notes.push("da-login after switch");

  await page.click("[data-action=guest-login]");
  await page.waitForFunction(() => document.body.innerText.includes("Hej Gæst!"));
  await page.click('.topic-card[data-topic="addition"]');
  await page.waitForFunction(() => document.body.innerText.includes("Skriv dit svar nedenfor."));
  const daExpr = await page.$eval(".expression", el => el.textContent.trim());
  const [e, f] = daExpr.split("+").map(part => Number(part.trim()));
  await page.click(`[data-key="${(e + f + 1) % 10}"]`);
  await page.click('[data-key="enter"]');
  await page.waitForFunction(() => document.body.innerText.includes("Det korrekte svar er"));
  await shot(page, "da-addition-wrong");
  notes.push("da-addition-wrong");

  await page.setViewport({ width: 390, height: 844 });
  await shot(page, "da-addition-wrong-mobile");
  await page.setViewport({ width: 1280, height: 800 });

  await page.click("[data-action=home]");
  await page.waitForFunction(() => document.body.innerText.includes("Hej Gæst!"));
  await page.click('[data-action="plus-penalhus"]');
  await page.waitForFunction(() => document.querySelector(".pp-game h1"), { timeout: 15000 });
  const penal = await page.$eval(".pp-game h1", el => el.textContent.trim());
  const penalHint = await page.$eval("#pp-canvas-hint", el => el.textContent.trim());
  assert(penal === "Plus-penalhus", "protected title must stay Danish, got " + penal);
  assert(penalHint === "Klik på Øbbe og Luigi", "protected hint must stay Danish, got " + penalHint);
  await shot(page, "en-pref-but-penalhus-stays-danish");

  await page.click("[data-jm-lang-switch] [data-set-lang=en]");
  await page.waitForFunction(() => document.querySelector(".pp-game h1"));
  const penalEn = await page.$eval(".pp-game h1", el => el.textContent.trim());
  const hintEn = await page.$eval("#pp-canvas-hint", el => el.textContent.trim());
  assert(penalEn === "Plus-penalhus", "English mode must not translate protected title, got " + penalEn);
  assert(hintEn.includes("Øbbe"), "English mode must not rename Øbbe inside Plus-penalhus, got " + hintEn);
  await shot(page, "en-plus-penalhus-still-danish");
  notes.push("plus-penalhus still Danish in English mode");

  await page.click("[data-pp-exit]");
  await page.waitForFunction(() => document.body.innerText.includes("Learn the clock"));
  await page.click('[data-action="clock"]');
  await page.waitForFunction(() => document.querySelector(".cl-module h1"), { timeout: 15000 });
  const clockTitle = await page.$eval(".cl-module h1", el => el.textContent.trim());
  assert(/klokken|viser|Lær|Hvad|minut/i.test(clockTitle), "clock must stay Danish, got " + clockTitle);
  assert(!/what time|learn the/i.test(clockTitle), "clock title was translated: " + clockTitle);
  await shot(page, "en-clock-still-danish");
  notes.push("clock still Danish: " + clockTitle);

  await page.goto(BASE + "/en/", { waitUntil: "domcontentloaded" });
  const cta = await page.$eval("a.lp-btn", el => el.getAttribute("href"));
  assert(cta.indexOf("lang=en") !== -1, "English CTA must enter the app in English, got " + cta);
  assert(await page.evaluate(() => localStorage.getItem("jm-lang")) === "en", "/en/ must set English");
  await shot(page, "en-landing");
  notes.push("en landing CTA " + cta);

  fs.writeFileSync(path.join(OUT, "i18n-flow-notes.txt"), notes.join("\n"));
  console.log(notes.join("\n"));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
