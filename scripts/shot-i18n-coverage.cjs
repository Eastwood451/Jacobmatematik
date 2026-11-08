/* Collect leftover Danish UI in the public English exercise flows. */
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("/tmp/node_modules/puppeteer-core");

const BASE = process.env.JM_BASE || "http://127.0.0.1:8765";
const OUT = "/opt/cursor/artifacts";
const DANSK = /[æøåÆØÅ]|\b(opgave|opgaver|rigtig|forkert|næste|tilbage|træning|svar|hjælp|vælg|skriv|lært|driller|gangestykke|brøk|klik|prøv|slet|trin)\b/i;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function leftovers(page) {
  await settle(page);
  return page.evaluate((source) => {
    const re = new RegExp(source, "i");
    const skip = ".pp-game, .cl-module, .marley-page, [data-i18n-skip]";
    const found = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) return;
        if (parent.closest && parent.closest(skip)) return;
        const value = node.nodeValue.replace(/\s+/g, " ").trim();
        if (value.length > 2 && re.test(value)) found.push(value.slice(0, 220));
        return;
      }
      if (node.nodeType === 1 && node.closest && node.closest(skip)) return;
      if (node.shadowRoot) walk(node.shadowRoot);
      let child = node.firstChild;
      while (child) { walk(child); child = child.nextSibling; }
      if (node.nodeType === 1) {
        for (const name of ["aria-label", "title", "placeholder", "alt"]) {
          const value = node.getAttribute && node.getAttribute(name);
          if (value && value.length > 2 && re.test(value) && !(node.closest && node.closest(skip))) found.push("@" + name + ": " + value.slice(0, 220));
        }
      }
    }
    walk(document.body);
    return [...new Set(found)];
  }, DANSK.source);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
}

async function ready(page) {
  await page.goto(BASE + "/?lang=en", { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.setItem("jm-lang", "en"));
  await page.waitForFunction(() => document.body.innerText.includes("Guest") || document.body.innerText.includes("Good to see you"));
  const cookie = await page.$("#jm-cookie-settings");
  if (cookie) {
    await page.evaluate(() => {
      const root = document.querySelector("#jm-cookie-settings")?.shadowRoot;
      root?.querySelector('[data-choice="denied"]')?.click();
    });
  }
  if (await page.$("[data-action=guest-login]")) await page.click("[data-action=guest-login]");
  await page.waitForFunction(() => document.body.innerText.includes("Hi Guest!") || document.body.innerText.includes("Choose a topic"));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "/opt/google/chrome/chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const report = {};

  await ready(page);
  const fps = await page.evaluate(() => {
    const card = document.querySelector("#fps-trial-entry, .home-fps-card, .fps-trial-entry");
    return card ? card.innerText : "";
  });
  report.fpsCard = { text: fps, danish: (fps.match(DANSK) || []).slice(0, 12) };
  await shot(page, "en-coverage-home");

  async function openHome() {
    const already = await page.evaluate(() => document.body.innerText.includes("What do you want to practise"));
    if (already) return;
    const clicked = await page.evaluate(() => {
      const home = document.querySelector("[data-action=home]");
      if (home) { home.click(); return "home"; }
      const exit = document.querySelector("[data-fl-exit], [data-fa-exit], [data-pf-exit], [data-action=foodtruck-home]");
      if (exit) { exit.click(); return "exit"; }
      return "";
    });
    if (!clicked) throw new Error("No way home");
    try {
      await page.waitForFunction(() => document.body.innerText.includes("What do you want to practise"), { timeout: 8000 });
    } catch (error) {
      const sample = await page.evaluate(() => document.body.innerText.slice(0, 500));
      throw new Error("Home did not return. Page said: " + sample);
    }
  }

  await page.click('[data-action="learn-fractions"]');
  await page.waitForFunction(() => document.body.innerText.includes("Learn fractions"), { timeout: 15000 });
  await page.click('[data-fl-operation="+"]');
  await page.waitForFunction(() => /try again|prøv igen|division|gangestykke/i.test(document.body.innerText));
  report.fractions = await leftovers(page);
  await shot(page, "en-fractions-wrong");

  await openHome();
  await page.click('[data-action="ten-friends"]');
  await page.waitForSelector("[data-pf-start]", { timeout: 15000 });
  report.tenFriendsIntro = await leftovers(page);
  await page.click("[data-pf-start]");
  await page.waitForSelector("[data-pf-answer]");
  await page.click("[data-pf-hint]");
  await page.click('[data-pf-answer="1"]');
  await new Promise(r => setTimeout(r, 400));
  report.tenFriendsPlay = await leftovers(page);
  await shot(page, "en-ten-friends");

  await openHome();
  const foodCard = await page.$('[data-action="foodtruck"]');
  if (foodCard) await foodCard.click();
  else {
    await page.evaluate(async () => {
      const host = document.createElement("div");
      host.id = "i18n-foodtruck-host";
      document.body.appendChild(host);
      await window.JacobModules.load("foodtruck");
      window.LuigiFoodtruck.mount(host);
    });
  }
  await page.waitForSelector("#ft-question", { timeout: 15000 });
  await page.click("[data-ft-hint]");
  await page.click('#ft-answer-form button[type="submit"]');
  await page.waitForFunction(() => /not yet|ikke helt|try again|prøv igen/i.test(document.body.innerText));
  report.foodtruck = await leftovers(page);
  await shot(page, "en-foodtruck-wrong");

  await page.evaluate(() => document.getElementById("i18n-foodtruck-host")?.remove());
  await openHome();
  await page.click('.topic-card[data-topic="pemdas"]');
  await page.waitForFunction(() => /type your answer|skriv dit svar|multiply before/i.test(document.body.innerText));
  const pemdas = await page.$eval(".expression", el => el.textContent);
  await page.click('[data-key="1"]');
  await page.click('[data-key="enter"]');
  await page.waitForFunction(() => /correct answer|korrekte svar/i.test(document.body.innerText));
  report.pemdas = { problem: pemdas, danish: await leftovers(page) };
  await shot(page, "en-pemdas-wrong");

  await page.click("[data-action=continue-after-correction]");
  await page.waitForFunction(() => /question\s+2/i.test(document.body.innerText));
  await openHome();
  await page.click('.topic-card[data-topic="tableDrill"]');
  await page.waitForSelector("#answer-form", { timeout: 15000 });
  await page.click('[data-key="1"]');
  await page.click('[data-key="enter"]');
  await new Promise(r => setTimeout(r, 500));
  report.tableDrill = await leftovers(page);
  await shot(page, "en-table-drill");

  await openHome();
  await page.click('.topic-card[data-topic="multiplication"]');
  await page.waitForFunction(() => document.body.innerText.includes("Type your answer below."));
  await page.click('[data-key="1"]');
  await page.click('[data-key="enter"]');
  await page.waitForFunction(() => document.body.innerText.includes("The correct answer is"));
  report.multiplication = await leftovers(page);
  await shot(page, "en-multiplication-wrong");

  fs.writeFileSync(path.join(OUT, "i18n-coverage-gaps.json"), JSON.stringify(report, null, 2));
  const summary = Object.entries(report).map(([key, value]) => {
    const list = Array.isArray(value) ? value : value.danish || value.text || [];
    const n = Array.isArray(list) ? list.length : 0;
    return key + ": " + n;
  }).join("\n");
  console.log(summary);
  console.log("--- fractions ---");
  console.log((report.fractions || []).slice(0, 25).join("\n"));
  console.log("--- ten ---");
  console.log([].concat(report.tenFriendsIntro, report.tenFriendsPlay).slice(0, 20).join("\n"));
  console.log("--- food ---");
  console.log((report.foodtruck || []).slice(0, 25).join("\n"));
  console.log("--- pemdas ---");
  console.log((report.pemdas.danish || []).slice(0, 15).join("\n"));
  console.log("--- drill ---");
  console.log((report.tableDrill || []).slice(0, 15).join("\n"));
  console.log("--- mult ---");
  console.log((report.multiplication || []).slice(0, 15).join("\n"));
  console.log("--- fps ---");
  console.log(report.fpsCard.text);
  await page.evaluate(() => { localStorage.setItem("jm-lang", "da"); location.href = "/"; });
  await page.waitForFunction(() => document.body.innerText.includes("Godt at se dig"));
  await page.click("[data-action=guest-login]");
  await page.waitForFunction(() => document.body.innerText.includes("Hej Gæst!"));
  await page.click('.topic-card[data-topic="pemdas"]');
  await page.waitForFunction(() => document.body.innerText.includes("Gang før plus.") || document.body.innerText.includes("Skriv dit svar nedenfor."));
  const danishPemdas = await page.evaluate(() => document.body.innerText.includes("The correct answer is") || document.body.innerText.includes("Multiply before you add."));
  if (danishPemdas) throw new Error("Danish PEMDAS showed English copy");
  await page.screenshot({ path: path.join(OUT, "da-pemdas.png"), fullPage: false });
  console.log("danish pemdas stayed Danish");
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
