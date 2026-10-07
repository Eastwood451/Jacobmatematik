/* Decode and play all shipped learning clips without accounts or external services. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const app = fs.readFileSync('app.js', 'utf8');
const declaration = app.match(/const LETTER_ITEMS = \[[\s\S]+?const LETTER_KEYS =/)[0];
const sandbox = { window: {} };
vm.runInNewContext(declaration.replace('const LETTER_KEYS =', 'window.letters = LETTER_ITEMS;'), sandbox);
assert.equal(sandbox.window.letters.length, 29);
const clips = sandbox.window.letters.map(item => item.audio);
const version = fs.readFileSync('plus-penalhus.js', 'utf8').match(/const AUDIO_VERSION = '([^']+)'/)[1];
for (let n = 1; n <= 18; n++) clips.push(`assets/figurer/plus-penalhus/audio/count-${n}.mp3?v=${version}`);
for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) {
  clips.push(`assets/figurer/plus-penalhus/audio/sum-${a}-${b}.mp3?v=${version}`);
}
assert.equal(new Set(clips).size, 147);
for (const clip of clips) {
  assert.ok(new URL(clip, 'https://speech-test.invalid/').searchParams.get('v'));
  assert.ok(fs.existsSync(clip.split('?')[0]), clip);
}

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
    args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ locale: 'en-US' });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'speech-test.invalid') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="da"></html>' });
      const file = path.resolve('.' + url.pathname);
      if (!file.startsWith(path.resolve('assets') + path.sep)) return route.abort();
      return route.fulfill({ path: file, contentType: 'audio/mpeg' });
    });
    await page.goto('https://speech-test.invalid/');
    const results = await page.evaluate(async clips => {
      Object.defineProperty(window, 'speechSynthesis', { get() { throw Error('Learning clips must not use browser TTS'); } });
      const results = [];
      for (const clip of clips) {
        const audio = new Audio(clip);
        audio.playbackRate = 8;
        audio.volume = 0;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(Error('Playback timed out: ' + clip)), 10000);
          audio.onended = () => { clearTimeout(timeout); resolve(); };
          audio.onerror = () => { clearTimeout(timeout); reject(Error('Decode failed: ' + clip)); };
          audio.play().catch(error => { clearTimeout(timeout); reject(error); });
        });
        results.push({ clip, duration: audio.duration });
      }
      return results;
    }, clips);
    assert.equal(results.length, 147);
    for (const { clip, duration } of results) assert.ok(duration > .2 && duration < 15, `${clip}: ${duration}s`);
    console.log('PASS: all 118 plus/count clips and 29 versioned alphabet clips decode and finish in English Chromium without browser TTS.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
