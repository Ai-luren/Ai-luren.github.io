import { createSafePage, createSafeContext } from '../../lib/safe-media.mjs';
// Run against a local Vite dev/preview server. Set PORTFOLIO_URL for a subpath build.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const autoWorks = JSON.parse(readFileSync(new URL('../../../src/data/auto-projects.json', import.meta.url)));
const countFor = category => ({ commercial: 6, 'short-film': 3, social: 3, visual: 2 }[category] || 0) +
  autoWorks.filter(work => work.category === category).length;
const defaultCount = countFor('commercial');
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
    assert.equal(await video.evaluate(v => {
      const phone = window.innerWidth <= 760;
      return v.controls === !phone && v.paused && !v.getAttribute('src') && v.preload === 'none';
    }), true, 'Desktop uses native controls; phones use the custom bar and neither preloads video');
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
      assert.equal(await page.locator('.library-grid .comet-archive__card').count(), defaultCount);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      for (const [category, count] of [['commercial', countFor('commercial')], ['short-film', countFor('short-film')], ['social', countFor('social')], ['visual', countFor('visual')]]) {
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
      assert.equal(new URL(page.url()).pathname, new URL(url).pathname, 'Project click stays in the library.');
      assert.equal(new URL(page.url()).searchParams.get('watch'),
        await trigger.getAttribute('data-project-id'), 'Opening a work creates its share URL');
      assert.equal(await page.evaluate(() => document.activeElement.matches('.cinema-player__close')), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('.cinema-player')), true);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.cinema-player', { state: 'detached' });
      assert.equal(new URL(page.url()).searchParams.get('watch'),null,'Closing a work restores base library URL');
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
      const langBefore = await page.locator('html').getAttribute('lang');
      await page.locator('.library-page-navigation .cinema-player__language [data-switch-lang="' + (langBefore === 'zh-CN' ? 'en' : 'zh') + '"]').click();
      assert.notEqual(await page.locator('html').getAttribute('lang'), langBefore);
      assert.equal(await page.locator('.library-back').count(),0,'Redundant in-page back link was removed.');
      const home = page.locator('.library-page-navigation .cinema-player__brand--home-return');
      assert.equal(await home.isVisible(), true, 'Shared home return is present on desktop and mobile.');
      assert.equal(await home.getAttribute('href'), './index.html#top');
      await home.click();
      assert.equal(new URL(page.url()).hash,'#top','Home return must open the Hero.');
      assert((await page.evaluate(()=>scrollY))<=3,'Home must open at Hero scroll 0.');
      await page.waitForSelector('.comet-archive__card', { state: 'attached' });
      assert.equal(await page.locator('.comet-archive__card').count(),8);
      await page.locator('#projects').scrollIntoViewIfNeeded();
      await page.locator('.comet-archive__card').first().click();
      await page.waitForSelector('.cinema-player[open]');
      await assertPlayer(page);
      await page.locator('.cinema-player__close').click();
      await page.waitForSelector('.cinema-player', { state: 'detached' });
      const more = page.locator('#projects .archive-more a');
      assert.equal(await more.count(), 1, 'Exactly one library link should exist.');
      await more.scrollIntoViewIfNeeded();
      await more.waitFor({state:'visible',timeout:10000});
      await page.waitForTimeout(450); // Existing GSAP alignment finishes after visibility flips.
      // Read related rectangles after the scroll entrance settles.
      const { hit, archive, title, header } = await more.evaluate(element => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { hit: element.getBoundingClientRect().toJSON(), archive: rect('.comet-archive'), title: rect('#projects-title'), header: rect('#projects .section-intro') };
      });
      assert.equal(await page.locator('#projects-featured-note').count(),0,'Remove redundant Featured count caption');
      assert(hit.width >= 44 && hit.height >= 44, 'Library text link needs a visible touch target.');
      assert.equal(await more.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
      if (width <= 720) {
        assert(Math.abs(hit.x - archive.x)<2, 'Mobile Browse All text must start at the card grid left edge.');
        assert(hit.y >= title.bottom + 6, 'Mobile Browse All must sit below the Featured heading.');
        assert(hit.y + hit.height <= header.y + header.height + 2,
          'Mobile Browse All must remain inside the heading block, before the work grid.');
        assert.equal(await page.locator('#projects .comet-archive-pagination').count(),0);
        assert.equal(await page.locator('#projects-library-link a').count(), 1);
        const mobileRhythm=await page.evaluate(()=>({
          gap:parseFloat(getComputedStyle(document.querySelector('#projects .comet-archive')).rowGap),
          flight:document.querySelector('.hero-journey-flight--after-projects')?.getBoundingClientRect().height || 0,
        }));
        assert(mobileRhythm.gap<=16.1,'Eight card rows must keep their compact editorial gap');
        if(!await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches))
          assert(mobileRhythm.flight>=68&&mobileRhythm.flight<=96.1,
            'Mobile film chapter transition should not insert an extra blank screen');
      } else {
        assert(Math.abs(hit.x + hit.width - archive.x - archive.width)<4.5,
          'Desktop Browse All should still align with the work area right edge.');
        assert(hit.y>=header.y && hit.y+hit.height<=header.y+header.height+2,'Desktop link belongs in heading row.');
        assert(Math.abs(title.y+title.height-hit.y-hit.height)<5,'Desktop link and heading share a bottom baseline.');
        assert(Math.abs(title.x-archive.x)<2,'Desktop heading begins at content edge.');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await more.click();
      await page.waitForSelector('.library-grid .comet-archive__card');
      assert.equal(await page.locator('.library-grid .comet-archive__card').count(), defaultCount);
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log('作品库回归通过：8 视口 × 2 语言，唯一文字入口、桌面标题同排靠右、手机标题下方靠左、分类、页面往返和播放器交互。');
} finally {
  await browser.close();
}
