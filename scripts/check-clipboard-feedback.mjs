// Clipboard API rejection and legacy fallback should never falsely report success.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage } from './lib/safe-media.mjs';
const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
if (!executablePath) throw new Error('A browser is required');
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
try {
  for (const [scenario, clipboardResult, legacyResult, expected] of [
    ['primary succeeds', true, false, '已复制：'],
    ['primary denied, legacy succeeds', false, true, '已复制：'],
    ['primary and legacy denied', false, false, '复制失败'],
  ]) {
    const page = await createSafePage(browser, { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.addInitScript(({ clipboardResult, legacyResult }) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => clipboardResult ? Promise.resolve() : Promise.reject(new Error('permission denied')) },
      });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: () => legacyResult });
    }, { clipboardResult, legacyResult });
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    await page.locator('.copy-link[data-copy]').click();
    await page.waitForFunction(prefix => document.querySelector('.copy-status')?.textContent?.includes(prefix), expected);
    const text = await page.locator('.copy-status').textContent();
    assert(text.includes(expected), `${scenario}: wrong feedback ${text}`);
    if (expected === '复制失败') assert(!text.includes('已复制'));
    console.log(`PASS ${scenario}: ${text}`);
    await page.close();
  }
} finally {
  await browser.close();
}
