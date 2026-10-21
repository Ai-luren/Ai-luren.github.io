// The original Hailuo LED award webp contains a 2–3px bright vertical seam.
// Keep only that artwork trimmed while preserving the viewer's geometry and
// all other award images. Browser checks must never reach ImageKit.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Chrome/Edge required');
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
try {
  for (const width of [390, 820, 1198, 1440]) {
    const page = await createSafePage(browser, {
      viewport: { width, height: width === 1198 ? 1808 : 900 },
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    await page.locator('#impact-awards .impact-award-card').first().evaluate(node => node.click());
    await page.locator('.impact-award-lightbox figure > img').waitFor({ state: 'visible' });
    const initial = await page.evaluate(() => {
      const img = document.querySelector('.impact-award-lightbox figure > img');
      const style = getComputedStyle(img);
      const rect = img.getBoundingClientRect();
      return {
        sourceWidth: img.naturalWidth,
        width: rect.width,
        border: style.borderRightWidth,
        clip: style.clipPath,
        radius: style.borderRadius,
        hasClass: img.classList.contains('impact-award-image--trim-right'),
      };
    });
    assert.equal(initial.sourceWidth, 1124);
    assert.equal(initial.border, '0px');
    assert(initial.hasClass);
    assert(initial.clip.includes('0.36%'), 'Seam correction not applied');
    assert(initial.width > 0 && initial.radius.endsWith('px'));

    await page.locator('.impact-award-lightbox-nav--next').evaluate(node => node.click());
    const next = await page.locator('.impact-award-lightbox figure > img').evaluate(node => ({
      clip: getComputedStyle(node).clipPath,
      className: node.className,
    }));
    assert.equal(next.clip, 'none', 'Other awards must not be cropped');
    assert.equal(next.className, '');
    assert.deepEqual(errors, []);
    assert.equal(getSafeMediaReport(page).urls.length, 0);
    console.log(`PASS ${width}px: source seam trimmed proportionally, borderless rounded viewer, next image intact, zero CDN`);
    await page.close();
  }
} finally {
  await browser.close();
}
