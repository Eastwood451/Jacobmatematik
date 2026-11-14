/* Builds the exercise screenshots for the student shortcut cards (assets/genveje/<id>.webp).
   Local static server + profile stub; no backend calls. Requires Playwright + Python Pillow.
   Usage: node scripts/build-genveje-shots.cjs [id,id,...]   (CHROME_PATH optional) */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'genveje');
const rawDir = process.env.GENVEJE_RAW_DIR || path.join(require('node:os').tmpdir(), 'genveje-raw');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(rawDir, { recursive: true });
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
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

const clickText = text => async page => { await page.getByRole('button', { name: text }).first().click(); };
const wait = ms => async page => { await page.waitForTimeout(ms); };
// Answer a few drill prompts so the grid shows filled squares, like a drill in progress.
const answerDrill = count => async page => {
  for (let i = 0; i < count; i++) {
    const text = await page.locator('.table-drill-answer').first().innerText();
    const m = text.match(/(\d+)\s*([×÷])\s*(\d+)\s*=/);
    if (!m) break;
    const a = Number(m[1]), b = Number(m[3]);
    const answer = m[2] === '×' ? a * b : a / b;
    await page.keyboard.type(String(answer));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(260);
  }
};
// focus: selector whose box is the important part; maxH caps the height (CSS px) taken from its top.
const SHOTS = [
  { id: 'learn-fractions', open: '[data-action="learn-fractions"]', focus: '.fl-workspace', anchorBottom: true },
  { id: 'distributive', open: '[data-topic="distributive"]', focus: '.question-top', fixedW: 520, top: 12 },
  { id: 'basics', open: '[data-topic="basics"]', want: /[×÷]\s*0|0\s*[×÷]/, focus: '.question-top', fixedW: 520, top: 12 },
  { id: 'negatives', open: '[data-topic="negatives"]', want: /\(-\d|^-\d|−\d/, focus: '.question-top', fixedW: 520, top: 12 },
  { id: 'pemdas', open: '[data-topic="pemdas"]', focus: '.question-top', fixedW: 520, top: 12 },
  { id: 'divisionDrill', open: '[data-topic="divisionDrill"]', steps: [answerDrill(22)], focus: '.table-drill-layout' },
  { id: 'divisionLollipops', open: '[data-topic="divisionLollipops"]', focus: '.division-lollipop-layout', maxH: 500 },
  { id: 'multiplicationColumn', open: '[data-topic="multiplicationColumn"]', focus: '.multi-layout', maxH: 460 },
  { id: 'tableDrill', open: '[data-topic="tableDrill"]', steps: [answerDrill(30)], focus: '.table-drill-layout' },
  { id: 'multiplication', open: '[data-topic="multiplication"]', focus: '.question-top', fixedW: 520, top: 12 },
  { id: 'subtractionDrill', open: '[data-topic="subtractionDrill"]', focus: '.question-top', fixedW: 590, top: 6 },
  { id: 'subtractionBorrowing', open: '[data-topic="subtractionBorrowing"]', focus: '.subtraction-layout', maxH: 500 },
  { id: 'ten-friends', open: '[data-action="ten-friends"]', steps: [clickText(/Find pizzamakkerne/), wait(1200)], focus: '.pf-work', maxH: 560 },
  { id: 'addition', open: '[data-topic="addition"]', focus: '.question-top', fixedW: 520, top: 12 },
  { id: 'additionColumn', open: '[data-topic="additionColumn"]', focus: '.column-addition-card', maxH: 640 },
  { id: 'marley-addition', open: '[data-action="marley-addition"]', focus: '.ma-game', maxH: 600 },
  { id: 'plus-penalhus', open: '[data-action="plus-penalhus"]', focus: '.pp-game', maxH: 660 },
  { id: 'numbers', open: '[data-topic="numbers"]', focus: '.question-top', fixedW: 680, top: 12 },
  { id: 'clock', open: '[data-action="clock"]', focus: '.cl-module', maxH: 700 },
  { id: 'letters', open: '[data-topic="letters"]', focus: '.letter-learning-card' },
  { id: 'skak', open: '[data-action="skak"]', steps: [clickText(/Start kamp/), wait(1500)], focus: '.sk-game', maxH: 700 },
  { id: 'angles', open: '[data-action="angles"]', steps: [async page => { await page.locator('.ag-hub-card').nth(2).click(); }, wait(900), async page => { await page.locator('[data-ag="go"]').first().click(); }, wait(2600)], focus: '.ang-stage' },
  { id: 'fraction-runner', open: '[data-action="fraction-runner"]', steps: [clickText(/Start løbet/), wait(2600)], focus: '.bl-stage' },
];

async function launch() {
  const executablePath = process.env.CHROME_PATH || undefined;
  return chromium.launch({ executablePath, headless: !executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', ...(executablePath ? ['--headless=new'] : [])] });
}

async function home(page) {
  await page.evaluate(() => {
    const t = window.__jmTest;
    t.state.user = { id: 'stub-student', name: 'Elev', username: 'elev', role: 'student', results: [], assignedTables: [], assignedLetters: [], assignedNumbers: [], assignedAddends: [], assignedAddendSeconds: [] };
    t.state.view = 'student';
    t.renderStudentHome();
  });
  await page.waitForTimeout(250);
}

function cropFor(box, maxH, page) {
  const ratio = 1.6;
  let { x, y, width: w, height: h } = box;
  if (maxH && h > maxH) h = maxH;
  if (w / h > ratio) { const nh = w / ratio; y -= (nh - h) / 2; h = nh; }
  else { const nw = h * ratio; x -= (nw - w) / 2; w = nw; }
  x = Math.max(0, Math.min(x, page.w - w)); y = Math.max(0, y);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(Math.min(w, page.w)), height: Math.round(h) };
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.5 });
  await page.addInitScript(() => { try { localStorage.setItem('jm-analytics-consent-v1', JSON.stringify({ value: 'denied', at: Date.now() })); } catch {} });
  await page.route('**/app.js*', route => route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: appSource }));
  await page.route('**/supabase-config.js*', route => route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: 'window.JACOBMATEMATIK_SUPABASE={};' }));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__jmTest);
  await page.addStyleTag({ content: '#jm-cookie-settings{display:none!important}' }).catch(() => {});
  const made = [];
  for (const shot of SHOTS) {
    if (only && !only.has(shot.id)) continue;
    await home(page);
    await page.locator(`.topic-tower ${shot.open}, .topic-tower-extras ${shot.open}`).first().click();
    await page.waitForTimeout(2200);
    for (let tries = 0; shot.want && tries < 25; tries++) {
      const text = await page.locator('.expression').first().innerText().catch(() => '');
      if (shot.want.test(text)) break;
      await home(page);
      await page.locator(`.topic-tower ${shot.open}, .topic-tower-extras ${shot.open}`).first().click();
      await page.waitForTimeout(900);
    }
    for (const step of shot.steps || []) await step(page);
    await page.evaluate(() => scrollTo(0, 0));
    await page.addStyleTag({ content: '#jm-cookie-settings,.site-header,header.app-header{visibility:hidden!important}' }).catch(() => {});
    const box = await page.locator(shot.focus).first().boundingBox();
    if (!box) throw new Error(`No focus box for ${shot.id}`);
    const clip = shot.anchorBottom
      ? { x: Math.round(box.x), y: Math.round(box.y + box.height + 8 - box.width / 1.6), width: Math.round(box.width), height: Math.round(box.width / 1.6) }
      : shot.fixedW
      ? { x: Math.round(box.x + box.width / 2 - shot.fixedW / 2), y: Math.round(box.y + (shot.top || 0)), width: shot.fixedW, height: Math.round(shot.fixedW / 1.6) }
      : cropFor(box, shot.maxH, { w: 1280 });
    const vh = clip.y + clip.height + 10;
    if (vh > 1000) await page.setViewportSize({ width: 1280, height: Math.ceil(vh) });
    const raw = path.join(rawDir, `${shot.id}.png`);
    await page.screenshot({ path: raw, clip });
    await page.setViewportSize({ width: 1280, height: 1000 });
    made.push(shot.id);
    console.log('captured', shot.id, JSON.stringify(clip));
  }
  await browser.close();
  server.close();
  // Resize to 600x375 WebP.
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
raw, out = sys.argv[1], sys.argv[2]
for i in sys.argv[3:]:
    im = Image.open(f"{raw}/{i}.png").convert("RGB").resize((600, 375), Image.LANCZOS)
    im.save(f"{out}/{i}.webp", "WEBP", quality=72, method=6)
# "Blandet træning": a 2x2 collage of four different exercises, because the system mixes them.
import os
parts = ["pemdas", "tableDrill", "subtractionBorrowing", "numbers"]
if all(os.path.exists(f"{out}/{p}.webp") for p in parts):
    sheet = Image.new("RGB", (600, 375), (243, 238, 255))
    for n, p in enumerate(parts):
        tile = Image.open(f"{out}/{p}.webp").convert("RGB").resize((294, 184), Image.LANCZOS)
        sheet.paste(tile, (4 + (n % 2) * 298, 3 + (n // 2) * 187))
    sheet.save(f"{out}/mixed.webp", "WEBP", quality=72, method=6)
`, rawDir, outDir, ...made], { stdio: 'inherit' });
  console.log('wrote', made.length, 'images to', outDir);
}

main().catch(err => { console.error(err); server.close(); process.exit(1); });
