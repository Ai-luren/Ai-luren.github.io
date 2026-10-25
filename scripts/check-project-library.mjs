import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
// Run against a local Vite dev/preview server. Set PORTFOLIO_URL for a subpath build.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const executablePath = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find(existsSync);
if (!executablePath) throw new Error('Chrome / Edge / Chromium is required.');
const browser = await chromium.launch({ executablePath, headless: true });

async function assertPlayer(page) {
  if (await page.locator('.cinema-player video').count()) {
    const video = page.locator('.cinema-player video');
    assert.equal(await video.evaluate(v => v.controls && v.paused && !v.getAttribute('src') && v.preload === 'none'), true);
    assert.equal(await page.locator('.cinema-player__close').evaluate(button => button === document.activeElement), true);
    // Layout/navigation regression must not repeatedly play videos.
    // Actual playback is covered separately by check-cinema-playback.mjs
    // using a tiny locally fulfilled fixture.
    assert.equal(await page.locator('.cinema-player__play').isVisible(), true);
    assert.equal(await page.locator('.cinema-player__poster').isVisible(), true);
  } else assert.equal(await page.locator('.cinema-player__pending').isVisible(), true);
}

try {
  for (const width of [1280, 1440, 1680, 1920, 360, 375, 393, 430]) {
    for (const lang of ['zh', 'en']) {
      const page = await createSafePage(browser, { viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(value => localStorage.setItem('ailuren-lang', value), lang);
      await page.goto(new URL('works.html', base).href, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.library-grid .comet-archive__card');
      assert.equal(await page.locator('.library-grid .comet-archive__card').count(), 15);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      for (const [category, count] of [['commercial', 7], ['short-film', 3], ['social', 3], ['visual', 2], ['all', 15]]) {
        await page.locator(`[data-category="${category}"]`).click();
        assert.equal(await page.locator('.library-grid .comet-archive__card').count(), count);
        if (!count) assert.equal(await page.locator('.library-empty').isVisible(), true);
        // The overseas product ads directory is mapped by the stable social ID; verify actual media URLs.
        if (category === 'social') {
          await page.locator('.library-grid .comet-archive__card').first().click();
          await page.waitForSelector('.cinema-player[open]');
          await assertPlayer(page);
          await page.locator('.cinema-player__close').click();
        }
      }
      const trigger = page.locator('.library-grid .comet-archive__card').first();
      const url = page.url();
      await trigger.click();
      await page.waitForSelector('.cinema-player[open]');
      await assertPlayer(page);
      assert.equal(page.url(), url, 'Project click must not leave the library.');
      assert.equal(await page.evaluate(() => document.activeElement.matches('.cinema-player__close')), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('.cinema-player')), true);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.cinema-player', { state: 'detached' });
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
      const langBefore = await page.locator('html').getAttribute('lang');
      await page.locator('.library-page-navigation .cinema-player__language [data-switch-lang="' + (langBefore === 'zh-CN' ? 'en' : 'zh') + '"]').click();
      assert.notEqual(await page.locator('html').getAttribute('lang'), langBefore);
      if (width <= 720) {
        assert.equal(await page.locator('.library-back').isVisible(), true, 'Mobile library keeps its return link.');
        await page.locator('.library-back').click();
      } else {
        assert.equal(await page.locator('.library-back').isVisible(), false, 'Desktop library removes the redundant return link.');
        const featured = page.locator('.library-page-navigation .site-primary-nav a[href$="#projects"]');
        assert.equal(await featured.isVisible(), true, 'Desktop navigation keeps the Featured link.');
        await featured.click();
      }
      await page.waitForSelector('.comet-archive__card', { state: 'attached' });
      assert.equal(await page.locator('.comet-archive__card').count(), width <= 720 ? 4 : 8);
      await page.locator('#projects').scrollIntoViewIfNeeded();
      await page.locator('.comet-archive__card').first().click();
      await page.waitForSelector('.cinema-player[open]');
      await assertPlayer(page);
      await page.locator('.cinema-player__close').click();
      await page.waitForSelector('.cinema-player', { state: 'detached' });
      const more = page.locator('#projects .archive-more a');
      assert.equal(await more.count(), 1, 'Exactly one library link should exist.');
      await more.scrollIntoViewIfNeeded();
      // Read related rectangles in one frame while the existing GSAP entrance may still run.
      const { hit, archive, pagination, note } = await more.evaluate(element => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { hit: element.getBoundingClientRect().toJSON(), archive: rect('.comet-archive'), pagination: rect('.comet-archive-pagination'), note: rect('#projects-featured-note') };
      });
      assert(hit.width > 100 && hit.height >= 44, 'Library text link needs a visible touch target.');
      assert.equal(await more.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
      assert(Math.abs(hit.x + hit.width - archive.x - archive.width) < 2, 'Link should align with the work area right edge.');
      if (width <= 720) {
        assert(hit.y >= pagination.y + pagination.height + 20, 'Mobile link belongs below pagination.');
        assert(hit.y <= pagination.y + pagination.height + 28, 'Mobile pagination gap should stay compact.');
        assert.equal(await page.locator('#projects-library-link a').count(), 0);
      } else {
        assert(Math.abs(note.y + note.height / 2 - hit.y - hit.height / 2) < 2, 'Desktop note and link should share one row.');
        assert(Math.abs(note.x - archive.x) < 2);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await more.click();
      await page.waitForSelector('.library-grid .comet-archive__card');
      assert.equal(await page.locator('.library-grid .comet-archive__card').count(), 15);
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log('作品库回归通过：8 视口 × 2 语言，唯一文字入口、说明行对齐、分页下方位置、分类、页面往返和播放器交互。');
} finally {
  await browser.close();
}
