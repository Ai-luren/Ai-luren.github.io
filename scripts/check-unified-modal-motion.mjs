// Tests the real modal animation lifecycle (not only the source CSS).
// All pages must use guarded media to prevent ImageKit CDN traffic.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'A browser is required');
const browser = await chromium.launch({ headless: true, executablePath });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const cases = [
  { path: 'works.html', trigger: '.library-grid .comet-archive__card', modal: '.cinema-player', content: '.cinema-player__layout', close: '.cinema-player__close' },
  { path: 'index.html', trigger: '#projects .comet-archive__card', modal: '.cinema-player', content: '.cinema-player__layout', close: '.cinema-player__close' },
  { path: 'index.html', trigger: '#impact-awards .impact-award-card', modal: '.impact-award-lightbox', content: '.impact-award-lightbox figure', close: '.impact-award-lightbox .cinema-player__close' },
  { path: 'index.html', trigger: '[data-social-profile-trigger]', modal: '.impact-profile-lightbox', content: '.impact-profile-dialog', close: '.impact-profile-lightbox .cinema-player__close' },
];
const opacity = (page, sel) => page.locator(sel).evaluate(el => Number(getComputedStyle(el).opacity));
try {
  for (const width of [390, 820, 1440]) {
    for (const reduce of [false, true]) {
      for (const c of cases) {
        const page = await createSafePage(browser, {
          viewport: { width, height: 900 }, reducedMotion: reduce ? 'reduce' : 'no-preference',
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(new URL(c.path, base).href, { waitUntil: 'domcontentloaded' });
        const trigger = page.locator(c.trigger).first();
        await trigger.scrollIntoViewIfNeeded();
        await trigger.evaluate(el => { el.focus(); el.click(); });
        await page.locator(c.modal).waitFor({ state: 'attached' });
        await page.waitForTimeout(reduce ? 40 : 340);
        const open = await opacity(page, c.content);
        assert(open >= .98, `${width}px ${c.modal}: content never became visible (${open})`);
        await page.locator(c.close).evaluate(el => { el.click(); el.click(); });
        if (!reduce) {
          await page.waitForTimeout(65);
          assert(await page.locator(c.modal).count(), 'Modal should remain during exit');
          const during = await opacity(page, c.content);
          assert(during < .99 && during > 0, `${c.modal} exit is not interpolated (${during})`);
        }
        await page.locator(c.modal).waitFor({ state: 'detached', timeout: 5000 });
        await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), c.trigger, { timeout: 1500 });
        assert(await trigger.evaluate(el => el === document.activeElement), `${c.modal}: trigger focus not restored`);
        const locks = await page.evaluate(() => ({
          overflowY: getComputedStyle(document.body).overflowY,
          inert: document.querySelector('main')?.inert ?? false,
        }));
        assert(!locks.inert && locks.overflowY !== 'hidden', `${c.modal}: body stayed locked`);

        // Quick open-close while entering must not leave a stuck overlay.
        if (!reduce) {
          await trigger.evaluate(el => { el.focus(); el.click(); });
          await page.locator(c.modal).waitFor({ state: 'attached' });
          await page.waitForTimeout(50);
          await page.locator(c.close).evaluate(el => el.click());
          await page.locator(c.modal).waitFor({ state: 'detached', timeout: 5000 });
          await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), c.trigger, { timeout: 1500 });
          assert(await trigger.evaluate(el => el === document.activeElement));
        }
        assert.deepEqual(errors, []);
        assert.equal(getSafeMediaReport(page).urls.length, 0);
        console.log(`PASS ${width}px ${reduce ? 'reduce' : 'normal'} ${c.modal}: entry/exit, double-close, interruption, focus, no CDN`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
