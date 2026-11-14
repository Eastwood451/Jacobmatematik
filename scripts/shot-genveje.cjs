/* Screenshots of the student shortcut list ("Vælg et område" + "Andre genveje") with a local profile stub.
   Usage: node scripts/shot-genveje.cjs <out.png> [width=1280] [lang=da]. Also asserts images load and no layout shift. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const [out = path.join(root, 'genveje.png'), widthArg = '1280', lang = 'da'] = process.argv.slice(2);
const width = Number(widthArg);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace('  start();', '  window.__jmTest={state,render,renderStudentHome}; start();');

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.CHROME_PATH || undefined;
  const browser = await chromium.launch({ executablePath, headless: !executablePath, args: ['--no-sandbox', ...(executablePath ? ['--headless=new'] : [])] });
  const mobile = width < 600;
  const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await page.addInitScript(l => { localStorage.setItem('jm-analytics-consent-v1', JSON.stringify({ value: 'denied', at: Date.now() })); if (l === 'en') localStorage.setItem('jm-lang', 'en'); }, lang);
  await page.route('**/app.js*', route => route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: appSource }));
  await page.route('**/supabase-config.js*', route => route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: 'window.JACOBMATEMATIK_SUPABASE={};' }));
  await page.goto(base + (lang === 'en' ? '/?lang=en' : '/'));
  await page.waitForFunction(() => window.__jmTest);
  await page.evaluate(() => {
    const t = window.__jmTest;
    t.state.user = { id: 'stub-student', name: 'Elev', username: 'elev', role: 'student', results: [], assignedTables: [], assignedLetters: [], assignedNumbers: [], assignedAddends: [], assignedAddendSeconds: [] };
    t.state.view = 'student';
    t.renderStudentHome();
  });
  await page.waitForTimeout(600);
  const cards = page.locator('.topic-tower .topic-card, .topic-tower-extras .topic-card');
  const count = await cards.count();
  const before = await cards.evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  const area = await page.evaluate(() => {
    const label = [...document.querySelectorAll('.section-label')].find(e => e.nextElementSibling?.classList.contains('topic-tower'));
    const extras = document.querySelector('.topic-tower-extras');
    const top = label.getBoundingClientRect().top + scrollY, bottom = extras.getBoundingClientRect().bottom + scrollY;
    return { top, height: bottom - top };
  });
  await page.setViewportSize({ width, height: Math.ceil(area.top + area.height + 40) });
  await page.waitForFunction(() => [...document.querySelectorAll('.genvej-shot img')].every(img => img.complete && img.naturalWidth > 0), null, { timeout: 15000 });
  await page.addStyleTag({ content: '#jm-cookie-settings{display:none!important}' });
  const after = await cards.evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  const shifted = before.filter((h, i) => Math.abs(h - after[i]) > 1).length;
  const missing = await page.evaluate(() => [...document.querySelectorAll('.topic-tower .topic-card, .topic-tower-extras .topic-card')].filter(c => !c.querySelector('.genvej-shot img[alt]:not([alt=""])') || !c.querySelector('.genvej-what') || !c.querySelector('.genvej-gain')).map(c => c.dataset.topic || c.dataset.action));
  const forbidden = await page.evaluate(() => /læringsmål/i.test(document.querySelector('.topic-tower').innerText + document.querySelector('.topic-tower-extras').innerText));
  await page.screenshot({ path: out, clip: { x: 0, y: area.top - 10, width, height: area.height + 20 } });
  console.log(JSON.stringify({ out, width, lang, cards: count, layoutShiftCards: shifted, missingParts: missing, forbiddenWord: forbidden, sample: await page.locator('.genvej-gain').first().innerText() }));
  await browser.close();
  server.close();
  if (missing.length || forbidden || shifted) process.exit(1);
})().catch(err => { console.error(err); server.close(); process.exit(1); });
