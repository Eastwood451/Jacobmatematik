const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'test-results', 'suggestions');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
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

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();

  // Desktop: button in footer + open modal
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-jm-suggest]');
    await page.locator('[data-jm-suggest]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, 'button-desktop.png'), fullPage: false });
    await page.click('[data-jm-suggest]');
    await page.waitForSelector('#jm-suggest-dialog[open]');
    await page.fill('#jm-suggest-message', 'Et eksempel på et forslag til siden.');
    await page.screenshot({ path: path.join(outDir, 'modal-desktop.png'), fullPage: false });
    await page.close();
  }

  // Mobile (Samsung-ish): modal
  {
    const galaxy = devices['Galaxy S9+'] || { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' };
    const context = await browser.newContext({ ...galaxy, viewport: { width: 360, height: 780 } });
    const page = await context.newPage();
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-jm-suggest]');
    await page.click('[data-jm-suggest]');
    await page.waitForSelector('#jm-suggest-dialog[open]');
    await page.fill('#jm-suggest-message', 'Mobilforslag fra S22-størrelse.');
    await page.screenshot({ path: path.join(outDir, 'modal-mobile.png'), fullPage: false });
    await context.close();
  }

  // Admin table preview
  {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(base + '/scripts/suggestions-admin-preview.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#site-suggestions-panel');
    await page.screenshot({ path: path.join(outDir, 'admin-table.png'), fullPage: true });
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
