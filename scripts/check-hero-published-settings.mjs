// Regression: a visitor with stale local video tuning must see the same
// published Hero as a new visitor; do not fetch ImageKit during the check.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage } from './lib/safe-media.mjs';

const browserPath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
if (!browserPath) throw new Error('Browser unavailable');
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
try {
  const results = [];
  for (const hasStaleSettings of [false, true]) {
    const page = await createSafePage(browser, { viewport: { width: 1440, height: 900 } });
    if (hasStaleSettings) {
      await page.addInitScript(() => {
        localStorage.setItem('ailuren-hero-mask-v2', '5');
        localStorage.setItem('ailuren-video-tuning-v18', JSON.stringify({
          brightness: 5, saturation: 0, pixelMaster: 100, crtMaster: 100,
          vignette: 0, glow: 99,
        }));
      });
    }
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    const settings = await page.evaluate(() => ({
      mask: getComputedStyle(document.documentElement).getPropertyValue('--hero-mask-strength').trim(),
      saturation: getComputedStyle(document.documentElement).getPropertyValue('--video-saturation').trim(),
      brightness: getComputedStyle(document.documentElement).getPropertyValue('--video-brightness').trim(),
      settings: window.__videoTuning,
      legacyEditorPresent: !!document.querySelector('#video-tuner'),
    }));
    assert.equal(settings.legacyEditorPresent, false);
    results.push(settings);
    await page.close();
  }
  assert.deepEqual(results[0], results[1], 'Stale browser localStorage changed published Hero');
  assert.equal(results[0].mask, '0.60');
  assert.equal(results[0].brightness, '0.63');
  assert.equal(results[0].saturation, '0.80');
  console.log('PASS: new and returning visitors receive identical published Hero settings');
} finally {
  await browser.close();
}
