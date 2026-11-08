/* Shared-app language switch. Not a real account.
   Proves one click does not navigate or reload, and an open question keeps
   its expression, typed answer, question number and correction. */
const fs = require("node:fs");
const path = require("node:path");
function loadPuppeteer() {
  const candidates = [
    process.env.PUPPETEER_MODULE,
    "/tmp/node_modules/puppeteer-core",
    "/tmp/jm-shot/node_modules/puppeteer-core",
    "puppeteer-core",
    "puppeteer",
    "C:\\Users\\jacob\\AppData\\Local\\npm-cache\\_npx\\eb04a49c817a2f9c\\node_modules\\puppeteer-core"
  ].filter(Boolean);
  for (const mod of candidates) {
    try { return require(mod); } catch (_) {}
  }
  throw new Error("Could not load puppeteer-core");
}
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/opt/google/chrome/chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return "/opt/google/chrome/chrome";
}
function launchOpts() {
  const opts = {
    executablePath: findChrome(),
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  };
  if (process.env.JM_USER_DATA_DIR) {
    const dir = path.join(process.env.JM_USER_DATA_DIR, "prof-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    fs.mkdirSync(dir, { recursive: true });
    opts.userDataDir = dir;
  }
  return opts;
}
const puppeteer = loadPuppeteer();

const BASE = process.env.JM_BASE || "http://127.0.0.1:8765";
const TEACHER_ID = "c8b8e1c4-3264-40e9-a43d-0eb6214a0183";
const STUDENT_GATE_ID = "3af639de-b0e0-496a-a5b7-b732e49d1fa7";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function fixtureDb() {
  return {
    classes: [{ id: "c-fixture", name: "Fixture class" }],
    users: [
      { id: TEACHER_ID, role: "teacher", name: "Fixture Teacher", username: "fixture-teacher", password: "fixture-only" },
      { id: STUDENT_GATE_ID, role: "student", name: "Fixture Pupil", username: "fixture-pupil", password: "fixture-only", classId: "c-fixture", results: [] },
    ],
  };
}

async function boot(browser, lang, seed) {
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

async function click(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) throw new Error("missing " + sel);
    el.click();
  }, selector);
}

async function snap(page) {
  return page.evaluate(() => ({
    href: location.href,
    navs: performance.getEntriesByType("navigation").length,
    answer: document.querySelector("#answer")?.value || "",
    expression: document.querySelector(".expression")?.textContent?.replace(/\s+/g, " ").trim() || "",
    question: document.querySelector("[data-i18n-key=exercise_question_n]")?.textContent || "",
    qArg: document.querySelector("[data-i18n-key=exercise_question_n]")?.getAttribute("data-i18n-arg-n") || "",
    hint: document.querySelector("[data-i18n-key=exercise_hint_type_below]")?.textContent || "",
    placeholder: document.querySelector("#answer")?.getAttribute("placeholder") || "",
    keypad: document.querySelector("[data-i18n-aria-label=exercise_keypad]")?.getAttribute("aria-label") || "",
    round: document.querySelector("[data-i18n-aria-label=exercise_round_label]")?.getAttribute("aria-label") || "",
    feedback: document.querySelector("[data-i18n-key=exercise_feedback_correct_is]")?.textContent || "",
    next: document.querySelector("[data-i18n-key=exercise_feedback_tap_next]")?.textContent || "",
    shown: document.querySelector(".correction-answer, .correction-wheel strong")?.textContent || "",
    wrongDots: document.querySelectorAll(".progress-dot.wrong").length,
    prompt: document.querySelector("[data-i18n-key=home_prompt]")?.textContent || "",
  }));
}

(async () => {
  const browser = await puppeteer.launch(launchOpts());
  const evidence = {};

  const page = await boot(browser, "da");
  if (await page.$("[data-action=guest-login]")) await click(page, "[data-action=guest-login]");
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=home_prompt]")?.textContent === "Hvad vil du øve i dag?");
  const beforeHome = await snap(page);
  await click(page, "[data-jm-lang-switch] [data-set-lang=en]");
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=home_prompt]")?.textContent === "What do you want to practise today?");
  const englishHome = await snap(page);
  assert(englishHome.href === beforeHome.href, "EN click navigated");
  assert(englishHome.navs === beforeHome.navs, "EN click reloaded");
  await click(page, "[data-jm-lang-switch] [data-set-lang=da]");
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=home_prompt]")?.textContent === "Hvad vil du øve i dag?");
  const danishAgain = await snap(page);
  assert(danishAgain.href === beforeHome.href, "DA click navigated");
  assert(danishAgain.navs === beforeHome.navs, "DA click reloaded");

  await click(page, "[data-jm-lang-switch] [data-set-lang=en]");
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=home_prompt]")?.textContent.includes("practise"));
  await click(page, '.topic-card[data-topic="addition"]');
  await page.waitForSelector("#answer");
  await click(page, '[data-key="7"]');
  const typed = await snap(page);
  assert(typed.answer === "7", "typed answer missing");
  assert(typed.hint === "Type your answer below.", typed.hint);
  assert(typed.placeholder === "Your answer", typed.placeholder);
  assert(typed.keypad === "Number keypad", typed.keypad);
  assert(typed.round === "Answers this round", typed.round);
  assert(/^Question \d+$/.test(typed.question), typed.question);

  await click(page, "[data-jm-lang-switch] [data-set-lang=da]");
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=exercise_hint_type_below]")?.textContent === "Skriv dit svar nedenfor.");
  const back = await snap(page);
  assert(back.href === typed.href, "switch navigated mid-question");
  assert(back.navs === typed.navs, "switch reloaded mid-question");
  assert(back.answer === "7", "answer lost going to Danish");
  assert(back.expression === typed.expression, "expression changed");
  assert(back.qArg === typed.qArg, "question number changed");
  assert(back.question === "Opgave " + typed.qArg, back.question);
  assert(back.placeholder === "Dit svar", back.placeholder);
  assert(back.keypad === "Taltastatur", back.keypad);

  await click(page, "[data-jm-lang-switch] [data-set-lang=en]");
  await page.waitForFunction(() => document.querySelector("#answer")?.getAttribute("placeholder") === "Your answer");
  const forth = await snap(page);
  assert(forth.answer === "7", "answer lost going back to English");
  assert(forth.expression === typed.expression, "expression changed on return");
  assert(forth.qArg === typed.qArg, "question arg changed on return");

  await click(page, '[data-key="delete"]');
  const correct = Function('"use strict"; return (' + typed.expression.replace(/×/g, "*").replace(/−/g, "-") + ")")();
  const wrongDigit = String((Number(correct) + 3) % 10);
  await click(page, `[data-key="${wrongDigit}"]`);
  await click(page, '[data-key="enter"]');
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=exercise_feedback_correct_is]")?.textContent === "The correct answer is");
  const wrongEn = await snap(page);
  assert(wrongEn.shown === String(correct), "shown answer " + wrongEn.shown);
  assert(wrongEn.qArg === typed.qArg, "wrong answer advanced the question");
  assert(wrongEn.expression === typed.expression, "expression replaced after wrong answer");
  assert(wrongEn.wrongDots === 1, "wrong dot missing");
  assert(wrongEn.next === "Tap the answer for the next question", wrongEn.next);
  assert(wrongEn.answer === "", "correction replaced the open input");

  await click(page, "[data-jm-lang-switch] [data-set-lang=da]");
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=exercise_feedback_correct_is]")?.textContent === "Det korrekte svar er");
  const wrongDa = await snap(page);
  assert(wrongDa.href === wrongEn.href && wrongDa.navs === wrongEn.navs, "feedback switch navigated or reloaded");
  assert(wrongDa.shown === wrongEn.shown, "correct answer number changed");
  assert(wrongDa.qArg === wrongEn.qArg && wrongDa.expression === wrongEn.expression, "question changed with the feedback language");
  assert(wrongDa.wrongDots === 1, "progress dot reset");
  assert(wrongDa.next === "Tryk på svaret for næste opgave", wrongDa.next);

  await page.evaluate(() => window.JacobI18n.switchLang("en"));
  await page.waitForFunction(() => document.querySelector("[data-i18n-key=exercise_feedback_correct_is]")?.textContent === "The correct answer is");
  const wrongEnAgain = await snap(page);
  assert(wrongEnAgain.navs === wrongDa.navs && wrongEnAgain.shown === wrongDa.shown && wrongEnAgain.qArg === wrongDa.qArg, "switchLang restarted the question");
  evidence.addition = { expression: typed.expression, question: typed.qArg, shown: wrongEn.shown, navigations: wrongEnAgain.navs };
  await page.close();

  const pupil = await boot(browser, "en", fixtureDb());
  await pupil.waitForSelector("#login-form");
  await pupil.$eval("#username", el => { el.value = "fixture-pupil"; });
  await pupil.$eval("#password", el => { el.value = "fixture-only"; });
  await pupil.click('#login-form button[type="submit"]');
  await pupil.waitForSelector('[data-action="fraction-runner"]', { timeout: 15000 });
  await click(pupil, '[data-action="fraction-runner"]');
  await pupil.waitForSelector("[data-bl-canvas]", { timeout: 15000 });
  await pupil.waitForFunction(() => document.querySelector("[data-bl-canvas]")?.dataset.i18nSchool === "SCHOOL");
  await click(pupil, "[data-bl-go]");
  await pupil.waitForFunction(() => {
    const state = document.querySelector("[data-bl-canvas]")?.__jmRunState?.();
    return state && state.mode === "run" && state.dist > 8;
  }, { timeout: 10000 });
  const runBefore = await pupil.evaluate(() => document.querySelector("[data-bl-canvas]").__jmRunState());
  const navBefore = await pupil.evaluate(() => performance.getEntriesByType("navigation").length);
  const hrefBefore = await pupil.evaluate(() => location.href);
  await click(pupil, "[data-jm-lang-switch] [data-set-lang=da]");
  await pupil.waitForFunction(() => document.querySelector("[data-bl-canvas]")?.dataset.i18nSchool === "SKOLE");
  const runAfter = await pupil.evaluate(() => ({
    state: document.querySelector("[data-bl-canvas]").__jmRunState(),
    navs: performance.getEntriesByType("navigation").length,
    href: location.href,
  }));
  assert(runAfter.href === hrefBefore && runAfter.navs === navBefore, "runner switch navigated");
  assert(runAfter.state.mode === "run", "runner restarted: " + runAfter.state.mode);
  assert(runAfter.state.dist >= runBefore.dist, "runner distance reset");
  assert(runAfter.state.lives === runBefore.lives, "runner lives changed during the language click");
  evidence.runner = { before: runBefore, school: "SKOLE", mode: runAfter.state.mode };
  await pupil.close();

  const teacher = await boot(browser, "en", fixtureDb());
  await teacher.waitForSelector("#login-form");
  await teacher.$eval("#username", el => { el.value = "fixture-teacher"; });
  await teacher.$eval("#password", el => { el.value = "fixture-only"; });
  await teacher.click('#login-form button[type="submit"]');
  await teacher.waitForSelector('[data-action="sandbox"]', { timeout: 15000 });
  await click(teacher, '[data-action="sandbox"]');
  await teacher.waitForSelector('[data-angles-start="dennis"]');
  await click(teacher, '[data-angles-start="dennis"]');
  await teacher.waitForSelector('text[data-i18n-key="angles_dennis_marker"]', { timeout: 15000 });
  const dennisBefore = await teacher.evaluate(() => ({
    text: document.querySelector('text[data-i18n-key="angles_dennis_marker"]').textContent,
    fromObject: window.JacobI18n.t("angles_dennis_marker"),
    orders: document.querySelector(".ag-cmd-list")?.textContent || "",
    href: location.href,
    navs: performance.getEntriesByType("navigation").length,
  }));
  assert(dennisBefore.text === "Dennis" && dennisBefore.text === dennisBefore.fromObject, "SVG marker is not the semantic entry");
  await click(teacher, "[data-jm-lang-switch] [data-set-lang=da]");
  await teacher.waitForFunction(() => document.documentElement.lang === "da");
  const dennisAfter = await teacher.evaluate(() => ({
    text: document.querySelector('text[data-i18n-key="angles_dennis_marker"]').textContent,
    orders: document.querySelector(".ag-cmd-list")?.textContent || "",
    go: Boolean(document.querySelector('[data-ag="add-go"]')),
    href: location.href,
    navs: performance.getEntriesByType("navigation").length,
  }));
  assert(dennisAfter.text === "Dennis", "SVG text left the semantic entry");
  assert(dennisAfter.go, "Dennis was remounted away from the board");
  assert(dennisAfter.orders === dennisBefore.orders, "Dennis orders changed");
  assert(dennisAfter.href === dennisBefore.href && dennisAfter.navs === dennisBefore.navs, "Dennis switch navigated");
  evidence.dennisSvg = { text: dennisAfter.text, stayedOnBoard: dennisAfter.go };
  await teacher.close();

  await browser.close();
  console.log(JSON.stringify(evidence, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
