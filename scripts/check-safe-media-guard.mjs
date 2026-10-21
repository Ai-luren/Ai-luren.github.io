// Isolated smoke test: checks playback through the ImageKit interception layer.
// It does not navigate to ImageKit or request any external video bytes.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find(existsSync);
if (!executablePath) throw new Error('Chrome / Edge / Chromium is required.');

const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const [file, portrait] of [
    ['watsons-commercial.mp4', false],
    ['ugc-earbuds-ad.mp4', true],
  ]) {
    const page = await createSafePage(browser, { viewport: { width: 800, height: 800 } });
    await page.setContent('<video muted playsinline preload="none"></video>');
    await page.evaluate(async url => {
      const video = document.querySelector('video');
      video.src = url;
      await video.play();
    }, `https://ik.imagekit.io/Ailuren/tr:orig-true/videos/${file}`);
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > .15);
    const [width, height] = await page.locator('video').evaluate(v => [v.videoWidth, v.videoHeight]);
    assert.equal(width < height, portrait, `${file}: fixture orientation`);
    const report = getSafeMediaReport(page);
    assert(report.fulfilled > 0, `${file}: video request was intercepted`);
    assert.equal(report.blocked, 0);
    console.log(`${file}: playable local fixture ${width}x${height}, ${report.fulfilled} intercepted request(s), 0 ImageKit network transfers`);
    await page.close();
  }
  const page = await createSafePage(browser);
  await page.goto('data:text/html,<title>blocked ImageKit route test</title>');
  await page.evaluate(async () => {
    try { await fetch('https://ik.imagekit.io/Ailuren/should-be-blocked.txt'); } catch {}
  });
  const report = getSafeMediaReport(page);
  assert(report.blocked > 0, 'Unexpected ImageKit resource must be denied');
  console.log('Unknown ImageKit resource: blocked safely, 0 outbound transfers');
  await page.close();
} finally {
  await browser.close();
}
