/* Local dashboard screenshots for the mailbox suggestion card. No live backend writes. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const outDir = process.env.POSTKASSE_SHOT_DIR || root;
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

function overlaps(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

function patchApp(source) {
  const next = source.replace('  start();', '  window.__jmTest={state,render,renderStudentHome,renderTeacher,renderLogin}; start();');
  if (!next.includes('window.__jmTest=')) throw new Error('Could not hook app.js for the local dashboard stub');
  return next;
}

const appSource = patchApp(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));

async function stubDashboard(page, role, base) {
  await page.addInitScript(() => {
    try { localStorage.setItem('jm-analytics-consent-v1', JSON.stringify({ value: 'denied', at: Date.now() })); } catch {}
  });
  await page.route('**/app.js*', route => route.fulfill({
    contentType: 'application/javascript; charset=utf-8',
    body: appSource,
  }));
  await page.route('**/supabase-config.js*', route => route.fulfill({
    contentType: 'application/javascript; charset=utf-8',
    body: 'window.JACOBMATEMATIK_SUPABASE={};',
  }));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__jmTest);
  await page.evaluate(role => {
    const t = window.__jmTest;
    const results = Array.from({ length: 83 }, () => ({
      topic: 'addition',
      correct: true,
      timestamp: new Date().toISOString(),
      time: 3,
    }));
    t.state.user = {
      id: role === 'teacher' ? 'stub-teacher' : 'stub-student',
      name: role === 'teacher' ? 'Jacob' : 'Elev',
      username: role === 'teacher' ? 'jacob' : 'elev',
      role,
      results,
      assignedTables: [],
      assignedLetters: [],
      assignedNumbers: [],
      assignedAddends: [],
      assignedAddendSeconds: [],
    };
    t.state.view = role === 'teacher' ? 'teacher' : 'student';
    t.state.activeClassId = 'c1';
    if (role === 'teacher') t.renderTeacher();
    else t.renderStudentHome();
  }, role);
  await page.waitForSelector('[data-jm-suggest-mailbox]');
  if (role === 'student') await page.waitForSelector('.hero-line .streak');
  await dismissCookiePanel(page);
  await page.locator('[data-jm-suggest-mailbox]').evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
}

async function dismissCookiePanel(page) {
  const open = await page.evaluate(() => {
    const panel = document.getElementById('jm-cookie-settings')?.shadowRoot?.querySelector('#consent-panel');
    return Boolean(panel && panel.hidden !== true);
  });
  if (!open) return;
  await page.evaluate(() => {
    const root = document.getElementById('jm-cookie-settings')?.shadowRoot;
    root?.querySelector('[data-choice="denied"]')?.click();
  });
  await page.waitForFunction(() => {
    const panel = document.getElementById('jm-cookie-settings')?.shadowRoot?.querySelector('#consent-panel');
    return !panel || panel.hidden === true;
  });
}

async function assertNoOverlap(page) {
  const boxes = await page.evaluate(() => {
    const mailbox = document.querySelector('[data-jm-suggest-mailbox]');
    const streak = document.querySelector('.hero-line .streak');
    const cookie = document.getElementById('jm-cookie-settings')?.shadowRoot?.querySelector('.settings');
    const box = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return { mailbox: box(mailbox), streak: box(streak), cookie: box(cookie) };
  });
  if (!boxes.mailbox) throw new Error('Mailbox card is missing');
  if (boxes.streak && overlaps(boxes.mailbox, boxes.streak)) {
    throw new Error(`Mailbox overlaps streak card: ${JSON.stringify(boxes)}`);
  }
  if (boxes.cookie && overlaps(boxes.mailbox, boxes.cookie)) {
    throw new Error(`Mailbox overlaps cookie settings: ${JSON.stringify(boxes)}`);
  }
  return boxes;
}

async function shot(page, name) {
  const dest = path.join(outDir, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log('wrote', dest);
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/opt/ungoogled-chromium/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await stubDashboard(page, 'student', base);
    await page.waitForTimeout(400);
    await assertNoOverlap(page);
    await shot(page, 'dashboard-desktop.png');
    await page.click('[data-jm-suggest-mailbox]');
    await page.waitForSelector('#jm-suggest-dialog[open]');
    await page.fill('#jm-suggest-message', 'Et eksempel på et forbedringsforslag.');
    await shot(page, 'modal-desktop.png');
    await page.close();
  }

  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    await stubDashboard(page, 'student', base);
    const mailbox = page.locator('[data-jm-suggest-mailbox]');
    await mailbox.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await assertNoOverlap(page);
    await shot(page, 'dashboard-mobile.png');
    await mailbox.click();
    await page.waitForSelector('#jm-suggest-dialog[open]');
    await page.fill('#jm-suggest-message', 'Mobilforslag fra 390 px.');
    await shot(page, 'modal-mobile.png');
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await stubDashboard(page, 'teacher', base);
    await page.waitForTimeout(300);
    await shot(page, 'dashboard-teacher-desktop.png');
    await page.close();
  }

  await browser.close();
  server.close();
  console.log('screenshots written to', outDir);
}

main().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
