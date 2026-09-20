// Run with Playwright available in NODE_PATH. No requests reach Google or Supabase.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const key = 'jm-analytics-consent-v1';
const id = 'G-G4CQCVHLVR';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let googleRequests = 0;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'www.googletagmanager.com') {
        googleRequests++;
        return route.fulfill({ contentType: 'text/javascript', body: '/* Test stub: never sends real analytics. */' });
      }
      if (!['jacobmatematik.dk', 'localhost'].includes(url.hostname)) return route.abort();
      let filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['index.html', 'fps.html', 'privatliv.html', 'analytics.js'].includes(filename)) return route.abort();
      let body = await fs.readFile(path.join(base, filename), 'utf8');
      if (filename.endsWith('.html')) {
        // Keep the real page markup and consent script; isolate from game/auth side effects.
        body = body.replace(/<script\b(?![^>]*src="analytics\.js)[^>]*>[\s\S]*?<\/script>/g, '');
      }
      return route.fulfill({ contentType: filename.endsWith('.js') ? 'text/javascript' : 'text/html', body });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://jacobmatematik.dk/?email=private@example.test#access_token=secret');
    await page.getByRole('button', { name: 'Afvis statistik', exact: true }).waitFor();
    assert.equal(googleRequests, 0, 'No Google request before a choice');
    await page.getByRole('button', { name: 'Afvis statistik', exact: true }).click();
    await page.reload();
    assert.equal(googleRequests, 0, 'Refusal survives reload');
    assert.equal(await page.getByRole('button', { name: 'Accepter statistik' }).isVisible(), false);
    await page.getByRole('button', { name: 'Cookieindstillinger' }).click();
    await page.getByRole('button', { name: 'Accepter statistik' }).click();
    await page.waitForFunction(() => !!document.querySelector('script[src*="googletagmanager.com"]'));
    const config = await page.evaluate(() => window.dataLayer.map(x => Array.from(x)).find(x => x[0] === 'config'));
    assert.equal(config[1], id);
    assert.equal(config[2].page_location, 'https://jacobmatematik.dk/');
    assert.equal(config[2].page_referrer, '');
    assert.equal(config[2].allow_google_signals, false);
    assert.equal(await page.evaluate(() => window['ga-disable-G-G4CQCVHLVR']), false);
    await page.waitForLoadState('networkidle');
    assert.equal(googleRequests, 1);
    await page.getByRole('button', { name: 'Cookieindstillinger' }).click();
    await page.getByRole('button', { name: 'Accepter statistik' }).click();
    assert.equal(await page.evaluate(() => window.dataLayer.filter(x => x[0] === 'config').length), 1, 'No duplicate page views');
    const other = await context.newPage();
    await other.goto('https://jacobmatematik.dk/fps.html?room=private');
    assert.equal(await other.evaluate(() => window.dataLayer.find(x => x[0] === 'config')[2].page_location), 'https://jacobmatematik.dk/fps.html');
    await context.addCookies([{ name: '_ga', value: 'test', domain: '.jacobmatematik.dk', path: '/', secure: true }]);
    await page.getByRole('button', { name: 'Cookieindstillinger' }).click();
    await page.getByRole('button', { name: 'Afvis statistik', exact: true }).click();
    await other.waitForFunction(() => window['ga-disable-G-G4CQCVHLVR'] === true);
    assert.equal((await context.cookies()).some(cookie => cookie.name.startsWith('_ga')), false, 'Cookies removed on withdrawal');
    const beforeReload = googleRequests;
    await other.reload();
    assert.equal(googleRequests, beforeReload, 'No reload tracking after withdrawal');
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ value: 'granted', at: Date.now() - 181 * 86400000 })), key);
    await page.reload();
    assert.equal(await page.getByRole('button', { name: 'Accepter statistik' }).isVisible(), true, 'Expired consent prompts again');
    assert.equal(googleRequests, beforeReload);
    await page.goto('http://localhost/');
    await page.getByRole('button', { name: 'Accepter statistik' }).click();
    assert.equal(googleRequests, beforeReload, 'Local testing never pollutes real Analytics');
    await page.goto('https://jacobmatematik.dk/privatliv.html');
    assert.equal(await page.getByRole('heading', { name: 'Cookies og privatliv', exact: true }).count(), 1);
    const bounds = await page.locator('#jm-cookie-settings').locator('.panel').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Consent fits mobile viewport');
    await fs.mkdir(path.join(base, 'test-results/analytics'), { recursive: true });
    await page.screenshot({ path: path.join(base, 'test-results/analytics/mobile.png') });
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
    });
    await page.reload();
    await page.getByRole('button', { name: 'Afvis statistik', exact: true }).click();
    assert.equal(await page.evaluate(() => window['ga-disable-G-G4CQCVHLVR']), true);
    assert.deepEqual(errors, []);
    console.log('PASS: consent gate, refusal/acceptance, persistence, sanitized URLs, single initialization, both pages, cross-tab withdrawal, cookie deletion, expiry, localhost exclusion, mobile layout and blocked storage.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
