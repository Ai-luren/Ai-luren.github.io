import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';

const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(executablePath, 'Chrome/Edge required');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const width of [360, 390, 720, 721, 1024, 1279, 1280, 1440]) {
    for (const lang of ['zh', 'en']) {
      const page = await createSafePage(browser, { viewport: { width, height: 844 }, hasTouch: width <= 720 });
      try {
        await page.addInitScript(l => localStorage.setItem('ailuren-lang', l), lang);
        await page.goto(new URL('index.html', process.env.PORTFOLIO_URL ?? 'http://127.0.0.1:5174/').href, { waitUntil: 'domcontentloaded' });
        const cards = page.locator('#impact-awards .impact-award-grid-card');
        await cards.first().waitFor({ state: 'attached' });
        assert.equal(await cards.count(), 8, `${width} ${lang}: all awards must be present`);
        const layout = await page.locator('.impact-award-grid').evaluate(grid => ({ columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, captions: getComputedStyle(grid.querySelector('.impact-award-grid-caption')).display, overflow: document.documentElement.scrollWidth - innerWidth }));
        assert.equal(layout.columns, width >= 1280 ? 8 : 4, `${width} ${lang}: wrong column count`);
        assert.equal(layout.captions === 'none', width <= 720, `${width} ${lang}: wrong caption visibility`);
        assert(layout.overflow <= 1, `${width} ${lang}: horizontal overflow`);
        assert.equal(await page.locator('#impact-awards .impact-award-rail-nav, #impact-awards .impact-award-pagination').count(), 0);
        await cards.last().scrollIntoViewIfNeeded();
        await cards.last().click();
        await page.locator('#impact-award-lightbox').waitFor({ state: 'visible' });
        assert(await page.locator('#impact-award-lightbox-title').innerText(), `${width} ${lang}: missing viewer title`);
        await page.keyboard.press('Escape');
        await page.locator('#impact-award-lightbox').waitFor({ state: 'hidden' });
        assert(await cards.last().evaluate(el => document.activeElement === el), `${width} ${lang}: focus not restored`);
        assert.equal(getSafeMediaReport(page).urls.length, 0);
      } finally { await page.close(); }
    }
  }
  console.log('Award grid: responsive layouts, viewer and focus passed.');
} finally { await browser.close(); }
