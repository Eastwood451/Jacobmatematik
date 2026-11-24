/* Lokale screenshots af The Quest (kort over tårnet + ceremoni). Profil-stub, ingen backend.
   NODE_PATH skal pege på playwright. QUEST_SHOT_DIR = output-mappe. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const outDir = process.env.QUEST_SHOT_DIR || path.join(root, 'quest-shots');
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace('  start();', '  window.__jmTest={state,render,renderStudentHome}; start();');
if (!appSource.includes('window.__jmTest=')) throw new Error('hook failed');

const JACOB = 'c8b8e1c4-3264-40e9-a43d-0eb6214a0183';
async function stub(page, base, { id = JACOB, seen = null, lang = 'da' } = {}) {
  await page.addInitScript(({ id, seen, lang }) => {
    try {
      localStorage.setItem('jm-analytics-consent-v1', JSON.stringify({ value: 'denied', at: Date.now() }));
      localStorage.setItem('jm-lang', lang);
      if (seen != null) localStorage.setItem('jm-quest-seen-v1:' + id, String(seen)); else localStorage.removeItem('jm-quest-seen-v1:' + id);
    } catch {}
  }, { id, seen, lang });
  await page.route('**/app.js*', r => r.fulfill({ contentType: 'application/javascript; charset=utf-8', body: appSource }));
  await page.route('**/supabase-config.js*', r => r.fulfill({ contentType: 'application/javascript; charset=utf-8', body: 'window.JACOBMATEMATIK_SUPABASE={};' }));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__jmTest);
  await page.evaluate(id => {
    const t = window.__jmTest; let n = 0;
    const at = () => new Date(Date.UTC(2026, 10, 1, 8, 0, n++)).toISOString();
    const results = [];
    for (let k = 0; k <= 10; k++) for (let r = 0; r < 3; r++) results.push({ topic: 'numbers', problem: `Antal ${k}`, correct: true, responseTime: 3, timestamp: at() });
    for (let p = 0; p < 48; p++) for (let r = 0; r < 3; r++) results.push({ topic: 'addition', problem: `${Math.floor(p / 10)} + ${p % 10}`, correct: true, responseTime: 3, timestamp: at() });
    t.state.user = { id, name: 'Jacob', username: 'jacob', role: 'student', results, assignedTables: [], assignedLetters: [], assignedNumbers: [], assignedAddends: [], assignedAddendSeconds: [] };
    t.state.view = 'student';
    t.renderStudentHome();
  }, id);
  await page.evaluate(() => {
    const r = document.getElementById('jm-cookie-settings')?.shadowRoot; r?.querySelector('[data-choice="denied"]')?.click();
  });
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const shots = [];
  try {
    // Desktop: Jacob, hvidt bælte netop taget → ceremoni vises én gang.
    let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, recordVideo: { dir: outDir, size: { width: 1280, height: 900 } } });
    let page = await ctx.newPage();
    await stub(page, base, { seen: 0 });
    await page.waitForSelector('.quest-ceremony');
    for (const [ms, name] of [[1700, 'ceremony-1-title'], [1700, 'ceremony-2-belt'], [2700, 'ceremony-3-full']]) {
      await page.waitForTimeout(ms);
      const file = path.join(outDir, `${name}-desktop.png`); await page.screenshot({ path: file }); shots.push(path.basename(file));
    }
    const bd = await page.evaluate(() => { const e = document.querySelector('.qc-backdrop'); const cs = getComputedStyle(e); const o = document.querySelector('.quest-ceremony'); return { opacity: cs.opacity, bg: cs.backgroundImage.slice(0, 60), overlayOpacity: getComputedStyle(o).opacity, filter: getComputedStyle(o).filter, bodyFilter: getComputedStyle(document.body).filter, mix: getComputedStyle(e).mixBlendMode }; });
    console.log('backdrop', JSON.stringify(bd));
    await page.click('.qc-ready');
    await page.waitForSelector('.quest-ceremony', { state: 'detached' });
    const video = page.video();
    await page.locator('#quest-root').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    let file = path.join(outDir, 'dashboard-desktop.png'); await page.screenshot({ path: file }); shots.push(path.basename(file));
    file = path.join(outDir, 'quest-card-white.png'); await page.locator('.quest-card').screenshot({ path: file }); shots.push(path.basename(file));
    // Reload: ingen ceremoni igen.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ctx.close();
    if (video) { const v = await video.path(); fs.renameSync(v, path.join(outDir, 'ceremony-white-desktop.webm')); shots.push('ceremony-white-desktop.webm'); }

    // Tjek: samme bruger, ceremoni allerede set → ingen pop-up.
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();
    await stub(page, base, { seen: 1 });
    await page.waitForSelector('.quest-card');
    await page.waitForTimeout(900);
    if (await page.$('.quest-ceremony')) throw new Error('ceremony shown twice');
    // Andre brugere ser intet.
    await ctx.close();
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();
    await stub(page, base, { id: 'stub-student', seen: null });
    await page.waitForSelector('.math-tower');
    await page.waitForTimeout(600);
    if (await page.$('#quest-root, .quest-card, .quest-ceremony')) throw new Error('quest visible for non-gated user');
    await ctx.close();

    // Kort med syntetiske etager (samme mount-API): grønt bælte og højeste bælte (blåt).
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage();
    await stub(page, base, { seen: 1 });
    await page.waitForSelector('.quest-card');
    const remount = (held, partial) => page.evaluate(({ held, partial }) => {
      const mem = new Map([['jm-quest-seen-v1:x', String(held)]]);
      const storage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, v) };
      const floors = Array.from({ length: 8 }, (_, i) => i < held ? { score: 100, units: null } : i === held ? partial : { score: 0, units: null });
      floors[4].practice = { topic: 'tableDrill' };
      const old = document.getElementById('quest-root'); const slot = old.cloneNode(false); old.replaceWith(slot);
      window.JacobQuest.mount(slot, { userId: 'x', floors, storage, noCeremony: true });
    }, { held, partial });
    await remount(4, { score: 31 / 81 * 100, units: { built: 31, total: 81, kind: 'bricks' }, practice: { topic: 'tableDrill' } });
    file = path.join(outDir, 'quest-card-closeup.png'); await page.locator('.quest-card').screenshot({ path: file }); shots.push(path.basename(file));
    await remount(8, { score: 100, units: null });
    file = path.join(outDir, 'quest-card-blue.png'); await page.locator('.quest-card').screenshot({ path: file }); shots.push(path.basename(file));
    if (await page.evaluate(() => window.JacobQuest.showCeremony(7)) !== null) throw new Error('black ceremony must be unavailable');
    await page.evaluate(() => window.JacobQuest.showCeremony(4));
    await page.waitForTimeout(6300);
    file = path.join(outDir, 'ceremony-blue-desktop.png'); await page.screenshot({ path: file }); shots.push(path.basename(file));
    await ctx.close();

    // Mobil 390.
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page = await ctx.newPage();
    await stub(page, base, { seen: 1 });
    await page.waitForSelector('.quest-card');
    await page.locator('.quest-card').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('.quest-card').scrollIntoView({ block: 'start' }));
    file = path.join(outDir, 'dashboard-mobile-390.png'); await page.screenshot({ path: file }); shots.push(path.basename(file));
    // Ceremoni for 10'er-venner (Luigi) og sort bælte på mobil – genafspilning via API.
    await page.evaluate(() => window.JacobQuest.showCeremony(2));
    await page.waitForTimeout(6300);
    file = path.join(outDir, 'ceremony-orange-mobile-390.png'); await page.screenshot({ path: file }); shots.push(path.basename(file));
    await page.evaluate(() => window.JacobQuest.showCeremony(3));
    await page.waitForTimeout(6300);
    file = path.join(outDir, 'ceremony-green-mobile-390.png'); await page.screenshot({ path: file }); shots.push(path.basename(file));
    await ctx.close();

    // Desktop: sort bælte + engelsk + reduced motion.
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    page = await ctx.newPage();
    await stub(page, base, { seen: 1, lang: 'en' });
    await page.waitForSelector('.quest-card');
    await page.evaluate(() => window.JacobQuest.showCeremony(4));
    await page.waitForTimeout(400);
    file = path.join(outDir, 'ceremony-blue-en-reduced-motion.png'); await page.screenshot({ path: file }); shots.push(path.basename(file));
    await page.keyboard.press('Escape');
    file = path.join(outDir, 'quest-card-en.png'); await page.locator('.quest-card').screenshot({ path: file }); shots.push(path.basename(file));
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(shots.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
