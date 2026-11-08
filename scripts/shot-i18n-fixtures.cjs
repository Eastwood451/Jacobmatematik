/* FIXTURE tests only. Not a real teacher or student login.
   Supabase is stubbed. Users exist only in this browser's localStorage.
   Profile ids match the existing gates; the gates themselves are not changed. */
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("/tmp/node_modules/puppeteer-core");

const BASE = process.env.JM_BASE || "http://127.0.0.1:8765";
const OUT = "/opt/cursor/artifacts";
const LABEL = "FIXTURE-NOT-REAL-ACCOUNT";
const TEACHER_ID = "c8b8e1c4-3264-40e9-a43d-0eb6214a0183";
const STUDENT_GATE_ID = "3af639de-b0e0-496a-a5b7-b732e49d1fa7";
const AUDIO_WORDS = new Set(["abe","bæver","cacao","delfin","egern","fisk","gris","hund","isbjørn","jaguar","kat","løve","mus","næsehorn","orm","pingvin","quokka","ræv","sæl","tiger","ugle","vaskebjørn","wok","xylofon","yver","zebra","æsel","økse","ål"]);
const DANSK = /[æøåÆØÅ]|\b(opgave|opgaver|rigtig|forkert|næste|tilbage|træning|hjælp|vælg|skriv|lært|driller|gangestykke|brøk|klik|prøv|slet|trin)\b/i;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function fixtureDb() {
  const now = new Date().toISOString();
  return {
    classes: [{ id: "c-fixture", name: "Fixture class" }],
    users: [
      { id: TEACHER_ID, role: "teacher", name: "Fixture Teacher", username: "fixture-teacher", password: "fixture-only" },
      {
        id: STUDENT_GATE_ID, role: "student", name: "Fixture Pupil", username: "fixture-pupil", password: "fixture-only",
        classId: "c-fixture", results: [
          { topic: "addition", problem: "2 + 2", correct: true, answer: 4, correctAnswer: 4, responseTime: 2.2, timestamp: now },
        ],
      },
    ],
  };
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function leftovers(page, surface) {
  await settle(page);
  const found = await page.evaluate((source, words) => {
    const re = new RegExp(source, "i");
    const audio = new Set(words);
    const skip = ".pp-game, .cl-module, .marley-page, [data-i18n-skip]";
    const out = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) return;
        if (parent.closest && parent.closest(skip)) return;
        const value = node.nodeValue.replace(/\s+/g, " ").trim();
        if (value.length > 2 && re.test(value) && !audio.has(value)) out.push(value.slice(0, 180));
        return;
      }
      if (node.nodeType === 1 && node.closest && node.closest(skip)) return;
      if (node.shadowRoot) walk(node.shadowRoot);
      let child = node.firstChild;
      while (child) { const next = child.nextSibling; walk(child); child = next; }
      if (node.nodeType === 1 && !(node.closest && node.closest(skip))) {
        for (const name of ["aria-label", "placeholder", "alt", "title"]) {
          const value = node.getAttribute(name);
          if (value && value.length > 2 && re.test(value) && !audio.has(value)) out.push("@" + name + ": " + value.slice(0, 180));
        }
      }
    }
    walk(document.body);
    return [...new Set(out)];
  }, DANSK.source, [...AUDIO_WORDS]);
  return { surface, kind: LABEL, danish: found };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
}

async function boot(browser, { lang, seed }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = request.url();
    if (url.includes("supabase-config.js")) {
      request.respond({ status: 200, contentType: "application/javascript", body: "window.JACOBMATEMATIK_SUPABASE={};" });
      return;
    }
    if (url.includes("supabase-js")) {
      request.respond({ status: 200, contentType: "application/javascript", body: "window.supabase={};" });
      return;
    }
    request.continue();
  });
  await page.evaluateOnNewDocument((language, database) => {
    if (!localStorage.getItem("jm-lang")) localStorage.setItem("jm-lang", language);
    if (database && !localStorage.getItem("jacobmatematik-db-v1")) localStorage.setItem("jacobmatematik-db-v1", JSON.stringify(database));
  }, lang, seed || null);
  await page.goto(BASE + "/?lang=" + lang, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector("#jm-cookie-settings")?.shadowRoot?.querySelector('[data-choice="denied"]')?.click());
  return page;
}

async function login(page, username) {
  await page.waitForSelector("#login-form");
  await page.$eval("#username", (el, value) => { el.value = value; }, username);
  await page.$eval("#password", el => { el.value = "fixture-only"; });
  await page.click('#login-form button[type="submit"]');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "/opt/google/chrome/chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const report = { label: LABEL, realAccount: false, surfaces: [] };

  const guest = await boot(browser, { lang: "en" });
  if (await guest.$("[data-action=guest-login]")) await guest.click("[data-action=guest-login]");
  await guest.waitForFunction(() => document.body.innerText.includes("What do you want to practise"));
  await guest.evaluate(() => document.querySelector('[data-action="learn-fractions"]').click());
  await guest.waitForFunction(() => document.body.innerText.includes("Learn fractions"));

  async function mark(page, surface) {
    const row = await leftovers(page, surface);
    report.surfaces.push(row);
    if (row.danish.length) console.log(surface, row.danish.slice(0, 12));
    return row;
  }

  await guest.evaluate(() => document.querySelector('[data-fl-operation="+"]').click());
  await guest.waitForFunction(() => /try again/i.test(document.body.innerText));
  await mark(guest, "fraction division: wrong operation");
  await guest.evaluate(() => document.querySelector('[data-fl-operation=":"]').click());
  await guest.waitForFunction(() => /which rule/i.test(document.body.innerText));
  await guest.evaluate(() => document.querySelector('[data-fl-rule="add"]').click());
  await guest.waitForFunction(() => /that rule is for adding fractions/i.test(document.body.innerText));
  await mark(guest, "fraction division: wrong rule");
  await guest.evaluate(() => document.querySelector('[data-fl-rule="reciprocal"]').click());
  await guest.waitForFunction(() => /flip the second fraction yourself/i.test(document.body.innerText));
  await guest.evaluate(() => {
    document.querySelector('[data-fl-token="c"]').click();
    document.querySelector('[data-fl-slot="numerator"]').click();
  });
  await guest.waitForFunction(() => /not there/i.test(document.body.innerText));
  await mark(guest, "fraction division: wrong flip");
  await guest.evaluate(() => {
    document.querySelector('[data-fl-token="d"]').click();
    document.querySelector('[data-fl-slot="numerator"]').click();
    document.querySelector('[data-fl-token="c"]').click();
    document.querySelector('[data-fl-slot="denominator"]').click();
  });
  await guest.waitForFunction(() => /how do you multiply a fraction/i.test(document.body.innerText));
  await guest.evaluate(() => document.querySelector('[data-fl-rule="add"]').click());
  await guest.waitForFunction(() => /now we multiply/i.test(document.body.innerText));
  await mark(guest, "fraction division: wrong multiply rule");
  await guest.evaluate(() => document.querySelector('[data-fl-rule="multiply"]').click());
  await guest.waitForSelector('[data-fl-answer="numerator"]');
  await guest.type('[data-fl-answer="numerator"]', "1");
  await guest.type('[data-fl-answer="denominator"]', "1");
  await guest.click("[data-fl-check-answer]");
  await guest.waitForFunction(() => /not yet/i.test(document.body.innerText));
  await mark(guest, "fraction division: wrong product");
  await guest.click('[data-fl-answer="numerator"]', { clickCount: 3 });
  await guest.type('[data-fl-answer="numerator"]', "4");
  await guest.click('[data-fl-answer="denominator"]', { clickCount: 3 });
  await guest.type('[data-fl-answer="denominator"]', "6");
  await guest.click("[data-fl-check-answer]");
  await guest.waitForFunction(() => /simplify|hand the fraction|ready/i.test(document.body.innerText));
  await mark(guest, "fraction division: simplify step");
  const simplifyWrong = await guest.$('[data-ff-choice="fine"]');
  if (simplifyWrong) {
    await simplifyWrong.click();
    await guest.waitForFunction(() => /not yet|simplify/i.test(document.body.innerText));
    await mark(guest, "fraction division: wrong simplify choice");
  }
  await shot(guest, "en-fraction-simplify");
  await guest.close();

  const teacher = await boot(browser, { lang: "en", seed: fixtureDb() });
  await login(teacher, "fixture-teacher");
  await teacher.waitForFunction(() => document.body.innerText.includes("Teacher home") || document.body.innerText.includes("Fixture class"));
  const configured = await teacher.evaluate(() => Boolean(window.JacobBackend && window.JacobBackend.configured));
  assert(configured === false, "fixture must not enable the real database");
  await mark(teacher, "teacher portal fixture home");
  await shot(teacher, "en-teacher-fixture");
  await teacher.evaluate(() => document.querySelector('[data-action="sandbox"], .sandbox-link, [data-action="skak"]')?.click() || document.querySelector("[data-action=sandbox]")?.click());
  if (!(await teacher.$(".sk-game, [data-action=skak]"))) {
    const opened = await teacher.evaluate(() => {
      const button = [...document.querySelectorAll("button,a")].find(el => /sandbox/i.test(el.textContent) || el.dataset.action === "sandbox");
      if (button) { button.click(); return true; }
      return false;
    });
    assert(opened, "fixture teacher should see sandbox because the gate id matches");
  }
  await teacher.waitForFunction(() => document.body.innerText.includes("Sandbox") || document.body.innerText.includes("Chess with sums") || document.querySelector("[data-action=skak]"));
  if (await teacher.$("[data-action=skak]")) await teacher.evaluate(() => document.querySelector("[data-action=skak]").click());
  await teacher.waitForSelector(".sk-game", { timeout: 15000 });
  await mark(teacher, "chess menu fixture");
  await shot(teacher, "en-skak-fixture");
  await teacher.evaluate(() => document.querySelector('[data-act="start-cpu"]').click());
  await teacher.waitForSelector('input[name="answer"]');
  await teacher.type('input[name="answer"]', "0");
  await teacher.click('.sk-problem button[type="submit"], .sk-answer button[type="submit"], form button[type="submit"]');
  await teacher.waitForFunction(() => /not quite|wait/i.test(document.body.innerText));
  await mark(teacher, "chess wrong answer fixture");
  await shot(teacher, "en-skak-wrong-fixture");
  await teacher.evaluate(() => document.querySelector('[data-act="menu"]').click());
  await teacher.waitForSelector("[data-act=exit]");
  await teacher.evaluate(() => document.querySelector('[data-act="exit"]').click());
  await teacher.waitForFunction(() => document.body.innerText.includes("Sandbox"));
  await teacher.evaluate(() => document.querySelector('[data-action="angles"]').click());
  await teacher.waitForFunction(() => document.body.innerText.includes("Angles"));
  await mark(teacher, "angles hub fixture");
  await shot(teacher, "en-angles-hub-fixture");
  await teacher.evaluate(() => document.querySelector('[data-ang-hub="lesson"]').click());
  await teacher.waitForFunction(() => /angle|bend|degree/i.test(document.body.innerText));
  await mark(teacher, "angles lesson first screen fixture");
  await shot(teacher, "en-angles-lesson-fixture");
  await teacher.close();

  const pupil = await boot(browser, { lang: "en", seed: fixtureDb() });
  await login(pupil, "fixture-pupil");
  await pupil.waitForFunction(() => document.body.innerText.includes("What do you want to practise"));
  assert(await pupil.evaluate(() => document.body.innerText.includes("Fraction run")), "permitted student gate should show the runner");
  await pupil.evaluate(() => document.querySelector('[data-action="fraction-runner"]').click());
  await pupil.waitForFunction(() => document.body.innerText.includes("Start the run") || document.body.innerText.includes("Fraction run"));
  await mark(pupil, "fraction runner start fixture");
  await shot(pupil, "en-runner-fixture");
  await pupil.reload({ waitUntil: "networkidle0" });
  await pupil.waitForFunction(() => document.body.innerText.includes("What do you want to practise") || document.body.innerText.includes("Fraction run") || document.body.innerText.includes("Good to see you"));
  const stillEnglish = await pupil.evaluate(() => localStorage.getItem("jm-lang") === "en" && !document.body.innerText.includes("Godt at se dig") && !document.body.innerText.includes("Hvad vil du øve"));
  assert(stillEnglish, "fixture language did not persist");
  report.persistence = "fixture pupil reload stayed English; not a real account";

  await pupil.evaluate(() => localStorage.setItem("jm-lang", "da"));
  await pupil.reload({ waitUntil: "networkidle0" });
  await pupil.waitForFunction(() => document.body.innerText.includes("Hvad vil du øve") || document.body.innerText.includes("Godt at se dig"));
  if (await pupil.$("#login-form")) await login(pupil, "fixture-pupil");
  await pupil.waitForFunction(() => document.body.innerText.includes("Hvad vil du øve"));
  assert(!(await pupil.evaluate(() => document.body.innerText.includes("What do you want to practise"))), "Danish fixture home showed English");
  await shot(pupil, "da-fixture-home");
  report.danishRegression = "fixture pupil home stayed Danish after jm-lang=da";
  await pupil.close();
  await browser.close();

  const bad = report.surfaces.filter(row => row.danish.length);
  fs.writeFileSync(path.join(OUT, "i18n-fixture-report.json"), JSON.stringify(report, null, 2));
  console.log(LABEL);
  for (const row of report.surfaces) console.log(row.surface + ": " + row.danish.length);
  console.log(report.persistence);
  console.log(report.danishRegression);
  if (bad.length) {
    console.log(JSON.stringify(bad, null, 2));
    process.exit(1);
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
