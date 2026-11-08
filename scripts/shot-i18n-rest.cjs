/* FIXTURE tests only. Not a real teacher, student, or online chess account.
   Supabase is stubbed. Class create/delete confirms stay in this browser.
   Delete and remove dialogs are dismissed, so nothing is removed. */
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
    classes: [
      { id: "c-fixture", name: "Fixture class" },
      { id: "c-fixture-b", name: "Fixture class B" },
    ],
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

async function clickSel(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) throw new Error("missing " + sel);
    el.click();
  }, selector);
}

async function waitText(page, pattern, timeout = 8000) {
  try {
    await page.waitForFunction(source => new RegExp(source, "i").test(document.body.innerText), { timeout }, pattern.source);
  } catch (error) {
    const info = await page.evaluate(() => ({
      phase: document.querySelector("[data-fa-phase]")?.getAttribute("data-fa-phase") || document.querySelector("[data-fl-phase]")?.getAttribute("data-fl-phase") || "",
      q: document.querySelector("#fl-question")?.innerText || "",
      fb: document.querySelector("#fl-feedback")?.innerText || "",
    }));
    throw new Error(pattern + " not seen. " + JSON.stringify(info));
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "/opt/google/chrome/chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const report = { label: LABEL, realAccount: false, productionWrites: false, surfaces: [], limitations: [] };
  const failures = [];

  async function mark(page, surface) {
    const row = await leftovers(page, surface);
    report.surfaces.push(row);
    if (row.danish.length) {
      console.log(surface, row.danish.slice(0, 14));
      failures.push(surface + ": " + row.danish.slice(0, 8).join(" | "));
    }
    return row;
  }

  const switched = await boot(browser, { lang: "da" });
  if (await switched.$("[data-action=guest-login]")) await switched.click("[data-action=guest-login]");
  await waitText(switched, /Hvad vil du øve/);
  await clickSel(switched, '.topic-card[data-topic="addition"]');
  await waitText(switched, /Skriv dit svar nedenfor/);
  await clickSel(switched, '[data-key="7"]');
  const beforeSwitch = await switched.evaluate(() => ({
    href: location.href,
    navs: performance.getEntriesByType("navigation").length,
    answer: document.querySelector("#answer")?.value || "",
    lang: document.documentElement.lang,
  }));
  assert(beforeSwitch.answer === "7", "typed answer before switch, got " + beforeSwitch.answer);
  await clickSel(switched, "[data-jm-lang-switch] [data-set-lang=en]");
  await waitText(switched, /Type your answer below/);
  const afterSwitch = await switched.evaluate(() => ({
    href: location.href,
    navs: performance.getEntriesByType("navigation").length,
    answer: document.querySelector("#answer")?.value || "",
    lang: document.documentElement.lang,
  }));
  assert(afterSwitch.href === beforeSwitch.href, "language switch navigated: " + afterSwitch.href);
  assert(afterSwitch.navs === beforeSwitch.navs, "language switch reloaded the document");
  assert(afterSwitch.answer === "7", "typed answer lost on switch, got " + afterSwitch.answer);
  assert(afterSwitch.lang === "en", "document lang stayed " + afterSwitch.lang);
  await clickSel(switched, "[data-jm-lang-switch] [data-set-lang=da]");
  await waitText(switched, /Skriv dit svar nedenfor/);
  const back = await switched.evaluate(() => document.querySelector("#answer")?.value || "");
  assert(back === "7", "typed answer lost switching back, got " + back);
  report.switch = { reload: false, hrefUnchanged: true, answerPreserved: "7", evidence: "shot-i18n-rest in-app DA|EN buttons" };
  await switched.close();

  const guest = await boot(browser, { lang: "en" });
  if (await guest.$("[data-action=guest-login]")) await guest.click("[data-action=guest-login]");
  await waitText(guest, /What do you want to practise/);
  await clickSel(guest, '[data-action="learn-fractions"]');
  await waitText(guest, /Learn fractions/);

  async function finishAssess(page) {
    const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
    const nums = await page.evaluate(() => {
      const n = document.querySelector(".ff-equation .fl-numerator")?.textContent;
      const d = document.querySelector(".ff-equation .fl-denominator")?.textContent;
      return { n: Number(n), d: Number(d) };
    });
    const g = gcd(nums.n, nums.d);
    if (g > 1) {
      await clickSel(page, '[data-ff-choice="reduce"]');
      await waitText(page, /How do you simplify|divide/i);
      await clickSel(page, '[data-ff-choice="divideBoth"]');
      await clickSel(page, `[data-ff-divisor="${g}"]`);
      await page.waitForSelector('[data-ff-answer="numerator"]');
      await page.type('[data-ff-answer="numerator"]', String(nums.n / g));
      await page.type('[data-ff-answer="denominator"]', String(nums.d / g));
      await clickSel(page, "[data-ff-check]");
    } else {
      await clickSel(page, '[data-ff-choice="fine"]');
    }
    await waitText(page, /ready to hand|Are you ready|klar/i);
    await clickSel(page, '[data-ff-choice="yes"]');
    await waitText(page, /cooking these fractions|Next/);
  }

  await clickSel(guest, '[data-fl-operation="+"]');
  await waitText(guest, /try again/i);
  await mark(guest, "division wrong op");
  await clickSel(guest, '[data-fl-operation=":"]');
  await waitText(guest, /which rule/i);
  await clickSel(guest, '[data-fl-rule="reciprocal"]');
  await waitText(guest, /flip the second fraction/i);
  await guest.evaluate(() => {
    document.querySelector('[data-fl-token="d"]').click();
    document.querySelector('[data-fl-slot="numerator"]').click();
    document.querySelector('[data-fl-token="c"]').click();
    document.querySelector('[data-fl-slot="denominator"]').click();
  });
  await waitText(guest, /how do you multiply a fraction/i);
  await clickSel(guest, '[data-fl-rule="multiply"]');
  await guest.waitForSelector('[data-fl-answer="numerator"]');
  await guest.type('[data-fl-answer="numerator"]', "4");
  await guest.type('[data-fl-answer="denominator"]', "6");
  await clickSel(guest, "[data-fl-check-answer]");
  await waitText(guest, /hand the fraction|simplify|ready/i);
  await finishAssess(guest);
  await mark(guest, "division result");

  await clickSel(guest, '[data-fa-mode="plus"]');
  await waitText(guest, /What kind of sum is this/i);
  await clickSel(guest, '[data-fa-operation=":"]');
  await waitText(guest, /sign between the fractions is plus/i);
  await mark(guest, "plus wrong operation");
  await clickSel(guest, '[data-fa-operation="+"]');
  await waitText(guest, /How do you add two fractions/i);
  await clickSel(guest, '[data-fa-rule="both"]');
  await waitText(guest, /denominators are not calculated/i);
  await mark(guest, "plus wrong rule");
  await clickSel(guest, '[data-fa-rule="common"]');
  await waitText(guest, /first fraction be simplified or extended/i);
  await clickSel(guest, '[data-fa-method="reduce"]');
  await waitText(guest, /needs to be extended/i);
  await clickSel(guest, '[data-fa-method="extend"]');
  await waitText(guest, /Which number will you (extend|expand)/i);
  await clickSel(guest, '[data-fa-factor="2"]');
  await waitText(guest, /has to become/i);
  await clickSel(guest, '[data-fa-factor="3"]');
  await waitText(guest, /How do you (extend|expand) a fraction/i);
  await clickSel(guest, '[data-fa-extension-rule="addBoth"]');
  await waitText(guest, /same number/i);
  await clickSel(guest, '[data-fa-extension-rule="multiplyBoth"]');
  await guest.waitForSelector('[data-fa-answer="numerator"]');
  await guest.type('[data-fa-answer="numerator"]', "9");
  await guest.type('[data-fa-answer="denominator"]', "9");
  await clickSel(guest, "[data-fa-check]");
  await waitText(guest, /Try again/i);
  await mark(guest, "plus wrong extension");
  await guest.click('[data-fa-answer="numerator"]', { clickCount: 3 });
  await guest.type('[data-fa-answer="numerator"]', "3");
  await guest.click('[data-fa-answer="denominator"]', { clickCount: 3 });
  await guest.type('[data-fa-answer="denominator"]', "6");
  await clickSel(guest, "[data-fa-check]");
  await waitText(guest, /Add the numerators/i);
  await guest.type('[data-fa-answer="numerator"]', "1");
  await clickSel(guest, "[data-fa-check]");
  await waitText(guest, /Try again/i);
  await mark(guest, "plus wrong combine");
  await guest.click('[data-fa-answer="numerator"]', { clickCount: 3 });
  await guest.type('[data-fa-answer="numerator"]', "4");
  await clickSel(guest, "[data-fa-check]");
  await waitText(guest, /hand the fraction|simplify|ready|fine/i);
  await finishAssess(guest);
  await mark(guest, "plus result");

  await clickSel(guest, '[data-fa-mode="minus"]');
  await waitText(guest, /What kind of sum is this/i);
  await clickSel(guest, '[data-fa-operation="+"]');
  await waitText(guest, /sign between the fractions is minus/i);
  await mark(guest, "minus wrong operation");
  await clickSel(guest, '[data-fa-operation="-"]');
  await waitText(guest, /How do you subtract/i);
  await clickSel(guest, '[data-fa-rule="both"]');
  await waitText(guest, /denominators are not calculated/i);
  await clickSel(guest, '[data-fa-rule="common"]');
  await waitText(guest, /second fraction be simplified or extended/i);
  await clickSel(guest, '[data-fa-method="extend"]');
  await waitText(guest, /Which number will you (extend|expand)/i);
  await clickSel(guest, '[data-fa-factor="3"]');
  await waitText(guest, /How do you (extend|expand) a fraction/i);
  await clickSel(guest, '[data-fa-extension-rule="multiplyBoth"]');
  await guest.waitForSelector('[data-fa-answer="numerator"]');
  await guest.type('[data-fa-answer="numerator"]', "3");
  await guest.type('[data-fa-answer="denominator"]', "6");
  await clickSel(guest, "[data-fa-check]");
  await waitText(guest, /Subtract the second numerator/i);
  await guest.type('[data-fa-answer="numerator"]', "9");
  await clickSel(guest, "[data-fa-check]");
  await waitText(guest, /Try again/i);
  await mark(guest, "minus wrong combine");
  await guest.click('[data-fa-answer="numerator"]', { clickCount: 3 });
  await guest.type('[data-fa-answer="numerator"]', "2");
  await clickSel(guest, "[data-fa-check]");
  await waitText(guest, /hand the fraction|simplify|ready/i);
  await finishAssess(guest);
  await mark(guest, "minus result");

  await clickSel(guest, '[data-fa-mode="multiply"]');
  await waitText(guest, /What kind of sum is this/i);
  await clickSel(guest, '[data-fl-operation="+"]');
  await waitText(guest, /dot between the two fractions means multiply/i);
  await mark(guest, "multiply wrong operation");
  await clickSel(guest, '[data-fl-operation="*"]');
  await waitText(guest, /How do you multiply a fraction/i);
  await clickSel(guest, '[data-fl-rule="add"]');
  await waitText(guest, /that rule is for adding|now we multiply/i);
  await mark(guest, "multiply wrong rule");
  await clickSel(guest, '[data-fl-rule="multiply"]');
  await guest.waitForSelector('[data-fl-answer="numerator"]');
  await guest.type('[data-fl-answer="numerator"]', "1");
  await guest.type('[data-fl-answer="denominator"]', "1");
  await clickSel(guest, "[data-fl-check-answer]");
  await waitText(guest, /Not yet\. Multiply|Not quite yet/i);
  await mark(guest, "multiply wrong product");
  await guest.click('[data-fl-answer="numerator"]', { clickCount: 3 });
  await guest.type('[data-fl-answer="numerator"]', "3");
  await guest.click('[data-fl-answer="denominator"]', { clickCount: 3 });
  await guest.type('[data-fl-answer="denominator"]', "8");
  await clickSel(guest, "[data-fl-check-answer]");
  await waitText(guest, /hand the fraction|simplify|ready/i);
  await finishAssess(guest);
  await mark(guest, "multiply result");
  await guest.close();

  const teacher = await boot(browser, { lang: "en", seed: fixtureDb() });
  const dialogs = [];
  teacher.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await login(teacher, "fixture-teacher");
  await waitText(teacher, /Teacher portal|right now/i);
  await clickSel(teacher, '[data-action="toggle-student-form"]');
  await teacher.waitForSelector("#student-name");
  await mark(teacher, "teacher create-student form");
  await teacher.type("#student-name", "Fixture Ada");
  await teacher.type("#student-username", "fixture-ada");
  await teacher.type("#student-password", "fixture-only");
  await clickSel(teacher, '#student-form button[type="submit"]');
  await waitText(teacher, /Fixture Ada/);
  await mark(teacher, "teacher student created locally");
  await teacher.type("#class-name", "Fixture class C");
  await clickSel(teacher, '#class-form button[type="submit"]');
  await waitText(teacher, /Fixture class C/);
  await mark(teacher, "teacher class created locally");
  await clickSel(teacher, '[data-action="toggle-class-rename-form"]');
  await teacher.waitForSelector("#class-rename");
  await mark(teacher, "teacher rename form");
  await clickSel(teacher, '[data-action="delete-class"]');
  await teacher.waitForFunction(() => document.body.dataset.jmDialogs === "1" || true);
  await new Promise(r => setTimeout(r, 200));
  assert(dialogs.some(message => /Delete Fixture/.test(message)), "delete confirm was not English: " + dialogs.join(" || "));
  assert(!dialogs.some(message => /Vil du slette/.test(message)), "delete confirm stayed Danish");
  report.dialogs = dialogs.slice();
  await clickSel(teacher, '[data-class="c-fixture"]');
  await teacher.waitForSelector(`[data-student="${STUDENT_GATE_ID}"]`);
  await clickSel(teacher, `[data-student="${STUDENT_GATE_ID}"]`);
  await clickSel(teacher, '[data-action="remove-student"]');
  await new Promise(r => setTimeout(r, 200));
  assert(dialogs.some(message => /Remove Fixture Pupil/.test(message)), "remove confirm was not English: " + dialogs.join(" || "));
  await mark(teacher, "teacher after dismissed confirms");

  async function openAngle(start) {
    if (!(await teacher.$(`[data-angles-start="${start}"]`))) {
      if (await teacher.$('[data-action="home"]')) await clickSel(teacher, '[data-action="home"]');
      if (await teacher.$('[data-action="sandbox"]')) await clickSel(teacher, '[data-action="sandbox"]');
    }
    await teacher.waitForSelector(`[data-angles-start="${start}"]`, { timeout: 10000 });
    await clickSel(teacher, `[data-angles-start="${start}"]`);
  }
  await openAngle("battleship");
  await teacher.waitForSelector('[data-ag="mode-cpu"]', { timeout: 15000 });
  await mark(teacher, "battleship menu");
  await clickSel(teacher, '[data-ag="mode-cpu"]');
  await teacher.waitForSelector("[data-ag-tile]", { timeout: 15000 });
  const target = await teacher.$eval(".ag-target strong", el => el.textContent.replace("°", "").trim());
  await teacher.evaluate(deg => {
    const tiles = [...document.querySelectorAll("[data-ag-tile]")];
    const wrong = tiles.find(el => el.dataset.deg !== deg);
    wrong.click();
  }, target);
  await waitText(teacher, /frozen/i);
  await mark(teacher, "battleship wrong");
  await teacher.waitForFunction(deg => {
    const el = document.querySelector(`[data-deg="${deg}"]`);
    return el && !el.disabled;
  }, {}, target);
  await teacher.evaluate(deg => document.querySelector(`[data-deg="${deg}"]`).click(), target);
  await waitText(teacher, /sank a ship|Hit!/i);
  await mark(teacher, "battleship hit");
  await clickSel(teacher, '[data-ag="exit"]');
  await openAngle("words");
  await teacher.waitForSelector("[data-ag-word]", { timeout: 15000 });
  await clickSel(teacher, "[data-ag-word]");
  await teacher.waitForFunction(() => /Right!|Not /.test(document.body.innerText));
  await mark(teacher, "words first pick");
  await teacher.waitForFunction(() => !document.querySelector("[data-ag-word]")?.disabled, { timeout: 4000 }).catch(() => {});
  await teacher.evaluate(() => {
    const buttons = [...document.querySelectorAll("[data-ag-word]:not([disabled])")];
    if (buttons[buttons.length - 1]) buttons[buttons.length - 1].click();
  });
  await mark(teacher, "words second pick");
  await clickSel(teacher, '[data-ag="exit"]');
  await openAngle("stop");
  await teacher.waitForSelector('[data-ag="go"]', { timeout: 15000 });
  await mark(teacher, "stop ready");
  await clickSel(teacher, '[data-ag="go"]');
  await clickSel(teacher, '[data-ag="stop"]');
  await waitText(teacher, /You stopped at|PAST IT|PERFECT|GOOD|CLOSE/i);
  await mark(teacher, "stop result");
  await clickSel(teacher, '[data-ag="exit"]');
  await openAngle("dennis");
  await teacher.waitForSelector('[data-ag="add-go"]', { timeout: 15000 });
  await mark(teacher, "dennis hint");
  await clickSel(teacher, '[data-ag="steps"][data-v="1"]');
  await clickSel(teacher, '[data-ag="add-go"]');
  await clickSel(teacher, '[data-ag="run"]');
  await waitText(teacher, /Dennis is walking|walked into|found the fish|Not there yet/i, 12000);
  await mark(teacher, "dennis run result");
  await clickSel(teacher, '[data-ag="exit"]');
  await openAngle("ninja");
  await teacher.waitForSelector("[data-ag-canvas]", { timeout: 15000 });
  await mark(teacher, "ninja hud");
  const box = await teacher.$eval("[data-ag-canvas]", el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await teacher.mouse.move(box.x + 30, box.y + box.h / 2);
  await teacher.mouse.down();
  await teacher.mouse.move(box.x + Math.min(box.w - 20, 280), box.y + box.h / 2 + 40, { steps: 12 });
  await teacher.mouse.up();
  const ninjaFb = await teacher.waitForFunction(() => (document.querySelector("[data-ag-fb]")?.textContent || "").trim(), { timeout: 4000 }).then(() => true).catch(() => false);
  if (ninjaFb) await mark(teacher, "ninja swipe feedback");
  else report.limitations.push("Ninja canvas swipe did not produce a feedback string in this run. HUD text was scanned. Canvas fillText stays Danish until the game redraws from a language function.");
  await teacher.close();

  const pupil = await boot(browser, { lang: "en", seed: fixtureDb() });
  await pupil.evaluate(() => {
    let current = window.JacobBrokLoeb;
    Object.defineProperty(window, "JacobBrokLoeb", {
      configurable: true,
      get() { return current; },
      set(api) {
        const mount = api && api.mount;
        current = api && mount ? {
          CHARS: api.CHARS,
          mount() {
            const dispose = mount.apply(this, arguments);
            window.__jmRunnerDebug = dispose && dispose.debug;
            return dispose;
          },
        } : api;
      },
    });
  });
  await login(pupil, "fixture-pupil");
  await waitText(pupil, /What do you want to practise|Hi /i);
  await clickSel(pupil, '[data-action="fraction-runner"]');
  await pupil.waitForSelector("[data-bl-go]", { timeout: 15000 });
  await mark(pupil, "runner start");
  await clickSel(pupil, "[data-bl-go]");
  await pupil.waitForFunction(() => window.__jmRunnerDebug, { timeout: 8000 });
  await pupil.evaluate(() => window.__jmRunnerDebug.gateSoon());
  const asked = await pupil.waitForSelector("[data-bl-opt]", { timeout: 12000 }).then(() => true).catch(() => false);
  if (!asked) {
    report.limitations.push("Runner question did not open after the existing debug.gateSoon hook. Canvas obstacle text is not in the DOM.");
  } else {
    await mark(pupil, "runner question");
    await pupil.evaluate(() => {
      const q = window.__jmRunnerDebug.state.question;
      const wrong = q.options.findIndex((_, i) => i !== q.correctIndex);
      document.querySelector(`[data-bl-opt="${wrong}"]`).click();
    });
    await waitText(pupil, /Not quite! The right answer is/i);
    await mark(pupil, "runner wrong feedback");
    await clickSel(pupil, "[data-bl-next]");
    await pupil.evaluate(() => window.__jmRunnerDebug.gateSoon());
    await pupil.waitForSelector("[data-bl-opt]", { timeout: 12000 });
    await pupil.evaluate(() => {
      const q = window.__jmRunnerDebug.state.question;
      document.querySelector(`[data-bl-opt="${q.correctIndex}"]`).click();
    });
    await waitText(pupil, /Right! \+/);
    await mark(pupil, "runner correct feedback");
  }
  await pupil.close();

  const chess = await boot(browser, { lang: "en", seed: fixtureDb() });
  await login(chess, "fixture-teacher");
  await waitText(chess, /Teacher portal|right now/i);
  await chess.evaluate(uid => {
    const games = {};
    let polls = 0;
    window.JacobBackend.configured = true;
    window.JacobBackend.realtimeClient = {
      async rpc(name, args) {
        const Core = window.SkakCore;
        if (name === "create_chess_game") {
          games.current = {
            id: "fixture-game", code: "ABCDE", status: "waiting",
            white_id: uid, white_name: "Fixture Teacher", black_id: null, black_name: null,
            version: 1, fen: Core.START_FEN, moves: [],
            meta: { w: Core.newPlayerMeta(), b: Core.newPlayerMeta() },
          };
          return { data: games.current, error: null };
        }
        if (name === "join_chess_game") {
          const code = String((args && args.p_code) || "");
          if (code === "ZZZZZ") return { data: null, error: { message: "not found" } };
          return { data: null, error: { message: "own game" } };
        }
        if (name === "resign_chess_game") return { data: games.current, error: null };
        return { data: null, error: { message: "not found" } };
      },
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    polls += 1;
                    const game = games.current;
                    if (game && game.status === "waiting" && polls >= 2) {
                      game.status = "active";
                      game.black_id = "simulated-peer";
                      game.black_name = "Simulated peer";
                      game.version = 2;
                    }
                    return { data: game || null, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  }, TEACHER_ID);
  if (await chess.$('[data-action="sandbox"]')) await clickSel(chess, '[data-action="sandbox"]');
  await chess.waitForSelector('[data-action="skak"]');
  await clickSel(chess, '[data-action="skak"]');
  await chess.waitForSelector('[data-act="start-cpu"]', { timeout: 15000 });
  await mark(chess, "chess menu with simulated online client");
  await clickSel(chess, '[data-act="start-cpu"]');
  await chess.waitForSelector(".sk-problem-text");
  await chess.type('input[name="answer"]', "0");
  await clickSel(chess, '.sk-problem button[type="submit"]');
  await waitText(chess, /Not quite/i);
  await mark(chess, "chess wrong answer");
  await chess.waitForFunction(() => {
    const input = document.querySelector('input[name="answer"]');
    return input && !input.disabled;
  }, { timeout: 8000 });
  const solved = await chess.evaluate(() => {
    const raw = document.querySelector(".sk-problem-text").textContent.replace("=", "").trim();
    const expr = raw.replace(/×/g, "*").replace(/−/g, "-").replace(/÷/g, "/").replace(/:/g, "/");
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) throw new Error("unexpected problem " + raw);
    return String(Function('"use strict"; return (' + expr + ")")());
  });
  await chess.click('input[name="answer"]', { clickCount: 3 });
  await chess.type('input[name="answer"]', solved);
  await clickSel(chess, '.sk-problem button[type="submit"]');
  await waitText(chess, /Move bought|Tap one of your pieces/i);
  await mark(chess, "chess correct answer");
  await chess.evaluate(() => {
    const own = [...document.querySelectorAll("[data-sq]")].find(el => /white/.test(el.getAttribute("aria-label") || ""));
    if (own) own.click();
  });
  await chess.waitForFunction(() => document.querySelector("[data-sq].target, .sk-square.target, [data-sq].capture"));
  await chess.evaluate(() => document.querySelector("[data-sq].target, [data-sq].capture").click());
  await waitText(chess, /computer has moved|Your turn|thinking/i, 10000);
  await mark(chess, "chess after one move");
  await clickSel(chess, '[data-act="menu"]');
  await chess.waitForSelector('[data-act="create-online"]');
  await chess.type('input[name="code"]', "AB");
  await clickSel(chess, '.sk-join button[type="submit"]');
  await waitText(chess, /code has 5 characters/i);
  await mark(chess, "chess online short code");
  await chess.click('input[name="code"]', { clickCount: 3 });
  await chess.type('input[name="code"]', "ZZZZZ");
  await clickSel(chess, '.sk-join button[type="submit"]');
  await waitText(chess, /does not exist/i);
  await mark(chess, "chess online unknown code");
  await clickSel(chess, '[data-act="create-online"]');
  await waitText(chess, /Give the code to your opponent/i);
  await mark(chess, "chess online lobby simulated");
  await waitText(chess, /Simulated peer|You start|Your turn/i, 8000);
  await mark(chess, "chess simulated peer joined");
  report.online = "In-memory rpc and poll only. No Supabase request. Not two browsers and not a real opponent.";
  await chess.close();

  const danish = await boot(browser, { lang: "da", seed: fixtureDb() });
  const daDialogs = [];
  danish.on("dialog", async dialog => { daDialogs.push(dialog.message()); await dialog.dismiss(); });
  if (await danish.$("[data-action=guest-login]")) {
    await login(danish, "fixture-teacher");
  } else await login(danish, "fixture-teacher");
  await waitText(danish, /Lærerportal|lige nu/);
  await clickSel(danish, '[data-action="delete-class"]');
  await new Promise(r => setTimeout(r, 300));
  assert(daDialogs.some(message => /Vil du slette/.test(message)), "Danish delete confirm changed: " + daDialogs.join(" || "));
  await clickSel(danish, '[data-action="learn-fractions"]');
  await waitText(danish, /Lær brøkregning/);
  await clickSel(danish, '[data-fa-mode="plus"]');
  await waitText(danish, /Hvilken type regnestykke/);
  await clickSel(danish, '[data-fa-operation=":"]');
  await waitText(danish, /Tegnet mellem brøkerne er plus/);
  const daBody = await danish.evaluate(() => document.body.innerText);
  assert(/Tegnet mellem brøkerne er plus/.test(daBody), "Danish plus feedback was translated");
  assert(!/sign between the fractions is plus/.test(daBody), "English plus feedback leaked into Danish");
  report.danishRegression = "teacher delete confirm and fraction plus wrong-operation stayed Danish";
  await danish.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, "i18n-rest-report.json"), JSON.stringify(report, null, 2));
  if (failures.length) {
    console.log(JSON.stringify(report.limitations, null, 2));
    throw new Error("Danish leftovers:\n" + failures.join("\n"));
  }
  console.log(JSON.stringify({ surfaces: report.surfaces.map(row => row.surface), limitations: report.limitations, dialogs: report.dialogs, online: report.online, switch: report.switch }, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
