/* Headless screenshots + drag progression for Vinkler. NODE_PATH must include playwright. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/workspace/reports/vinkler-modul-preview';
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function fulfillFromDisk(route, urlPath) {
  let rel = urlPath === '/' ? 'angles-preview.html' : decodeURIComponent(urlPath.replace(/^\//, ''));
  rel = rel.split('?')[0];
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return route.fulfill({ status: 404, body: 'missing ' + rel });
  }
  const ext = path.extname(file).toLowerCase();
  const body = fs.readFileSync(file);
  return route.fulfill({ status: 200, contentType: MIME[ext] || 'application/octet-stream', body });
}

async function tanGroovePixels(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("[data-ang-canvas]");
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d");
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 180) continue;
      if (r > 190 && g < 140) continue;
      if (r > 120 && g > 80 && b < 160 && g > b && r - b > 30) n += 1;
    }
    return n;
  });
}

async function dragRay(page, degrees) {
  await page.evaluate((degrees) => {
    const canvas = document.querySelector('[data-ang-canvas]');
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2 + 8 * (rect.height / canvas.height);
    const R = Math.min(rect.width, rect.height) * 0.38;
    const rad = (degrees * Math.PI) / 180;
    const x = cx + R * Math.cos(rad);
    const y = cy - R * Math.sin(rad);
    const opts = (type, clientX, clientY) => ({
      bubbles: true, cancelable: true, clientX, clientY, pointerId: 1, pointerType: 'mouse',
      buttons: type === 'pointerup' ? 0 : 1, isPrimary: true,
    });
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts('pointerdown', x, y)));
    window.dispatchEvent(new PointerEvent('pointermove', opts('pointermove', x, y)));
    window.dispatchEvent(new PointerEvent('pointerup', opts('pointerup', x, y)));
  }, degrees);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await context.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname !== 'angles.local') return route.abort();
      return fulfillFromDisk(route, u.pathname);
    });
    // Mute audio autoplay failures
    await context.addInitScript(() => {
      window.Audio = function () {
        const a = {
          _onended: null,
          play() { setTimeout(() => { if (a._onended) a._onended(); }, 40); return Promise.resolve(); },
          pause() {}, load() {}, removeAttribute() {},
          set onended(fn) { a._onended = fn; }, get onended() { return a._onended; },
          set onerror(fn) {}, get onerror() { return null; },
        };
        return a;
      };
    });

    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
    await page.goto('http://angles.local/angles-preview.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-ang-hub]', { timeout: 10000 });
    await page.waitForTimeout(200);
    await page.locator('[data-ang-hub="lesson"]').click();
    await page.waitForSelector('[data-ang-root]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '01-intro-desktop.png'), fullPage: true });
    const introGroove = await tanGroovePixels(page);
    assert.ok(introGroove > 40, `intro should still show the teaching groove, got ${introGroove}`);

    for (let i = 0; i < 5; i++) {
      const next = page.locator('[data-ang="intro-next"]');
      if (await next.isVisible()) { await next.click(); await page.waitForTimeout(250); }
    }
    await page.screenshot({ path: path.join(OUT, '02-intro-90-desktop.png'), fullPage: true });
    await page.locator('[data-ang="intro-start"]').click();
    await page.waitForSelector('[data-ang="check-precise"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '03-precise-60-desktop.png'), fullPage: true });

    for (const target of [60, 45, 15]) {
      await dragRay(page, target);
      await page.waitForTimeout(80);
      await page.locator('[data-ang="check-precise"]').click();
      await page.waitForTimeout(500);
    }
    await page.waitForSelector('[data-ang="check-feel"]');
    await page.screenshot({ path: path.join(OUT, '04-feel-45-desktop.png'), fullPage: true });
    const feelGroove = await tanGroovePixels(page);
    assert.ok(feelGroove < 8, `feel step has no target groove, got ${feelGroove}`);

    for (const target of [45, 90, 60]) {
      await dragRay(page, target - 3);
      await page.waitForTimeout(80);
      await page.locator('[data-ang="check-feel"]').click();
      await page.waitForTimeout(900);
    }
    await page.waitForSelector('[data-ang="check-pipe"]');
    await page.screenshot({ path: path.join(OUT, '05-pipe-desktop.png'), fullPage: true });
    assert.equal(await page.getAttribute("[data-ang-canvas]", "data-ang-groove"), "hidden");

    await dragRay(page, 38);
    await page.waitForTimeout(80);
    const hiddenGroove = await tanGroovePixels(page);
    assert.ok(hiddenGroove < 8, `groove hidden before Tilfreds, got ${hiddenGroove}`);
    assert.equal(await page.locator('[data-ang="check-pipe"]').innerText(), "Tilfreds");
    await page.screenshot({ path: path.join(OUT, '05b-pipe-before-tilfreds-desktop.png'), fullPage: true });
    await page.locator('[data-ang="check-pipe"]').click();
    await page.waitForSelector('[data-ang-groove="revealed"]');
    const shownGroove = await tanGroovePixels(page);
    assert.ok(shownGroove > 40, `groove visible after Tilfreds, got ${shownGroove}`);
    await page.screenshot({ path: path.join(OUT, '05c-pipe-after-tilfreds-desktop.png'), fullPage: true });
    await page.waitForFunction(() => /Lidt/.test(document.querySelector("[data-ang-feedback]")?.textContent || ""));

    await dragRay(page, 58);
    await page.locator('[data-ang="check-pipe"]').click();
    await page.waitForTimeout(2200);
    await page.waitForSelector('.ang-finish');
    await page.screenshot({ path: path.join(OUT, '06-done-desktop.png'), fullPage: true });

    const results = await page.evaluate(() => window.__anglesResults);
    assert.ok(results.length >= 7, `expected >=7 results, got ${results.length}`);
    assert.ok(results.every((r) => r.topic === 'angles'));
    assert.equal(await page.evaluate(() => window.__anglesDone), true);

    // Mobile
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname !== 'angles.local') return route.abort();
      return fulfillFromDisk(route, u.pathname);
    });
    await mobile.addInitScript(() => {
      window.Audio = function () {
        const a = {
          _onended: null,
          play() { setTimeout(() => { if (a._onended) a._onended(); }, 40); return Promise.resolve(); },
          pause() {}, load() {}, removeAttribute() {},
          set onended(fn) { a._onended = fn; }, get onended() { return a._onended; },
          set onerror(fn) {}, get onerror() { return null; },
        };
        return a;
      };
    });
    const mpage = await mobile.newPage();
    await mpage.goto('http://angles.local/angles-preview.html', { waitUntil: 'domcontentloaded' });
    await mpage.waitForSelector('[data-ang-hub]', { timeout: 10000 });
    await mpage.locator('[data-ang-hub="lesson"]').click();
    await mpage.waitForSelector('[data-ang-root]', { timeout: 10000 });
    await mpage.waitForTimeout(300);
    await mpage.screenshot({ path: path.join(OUT, '07-intro-mobile.png'), fullPage: true });
    await mpage.locator('[data-ang="intro-skip"]').click();
    await mpage.waitForSelector('[data-ang="check-precise"]');
    await mpage.waitForTimeout(200);
    await mpage.screenshot({ path: path.join(OUT, '08-precise-mobile.png'), fullPage: true });
    for (const target of [60, 45, 15]) {
      await dragRay(mpage, target);
      await mpage.waitForTimeout(80);
      await mpage.locator('[data-ang="check-precise"]').click();
      await mpage.waitForTimeout(500);
    }
    await mpage.waitForSelector('[data-ang="check-feel"]');
    for (const target of [45, 90, 60]) {
      await dragRay(mpage, target - 3);
      await mpage.waitForTimeout(80);
      await mpage.locator('[data-ang="check-feel"]').click();
      await mpage.waitForTimeout(900);
    }
    await mpage.waitForSelector('[data-ang="check-pipe"]');
    await dragRay(mpage, 38);
    await mpage.waitForTimeout(80);
    const mobileHidden = await tanGroovePixels(mpage);
    assert.ok(mobileHidden < 8, `mobile groove hidden, got ${mobileHidden}`);
    await mpage.screenshot({ path: path.join(OUT, '09-pipe-before-tilfreds-mobile.png'), fullPage: true });
    await mpage.locator('[data-ang="check-pipe"]').click();
    await mpage.waitForSelector('[data-ang-groove="revealed"]');
    const mobileShown = await tanGroovePixels(mpage);
    assert.ok(mobileShown > 40, `mobile groove shown, got ${mobileShown}`);
    await mpage.screenshot({ path: path.join(OUT, '10-pipe-after-tilfreds-mobile.png'), fullPage: true });
    await mobile.close();
    await page.close();
  } finally {
    await browser.close();
  }
  console.log('angles browser checks passed');
  console.log('screenshots:', fs.readdirSync(OUT).join(', '));
})().catch((err) => { console.error(err); process.exit(1); });
