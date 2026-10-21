import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5183/';
const screenshots = process.env.NAV_DESKTOP_SCREENSHOTS;
if (screenshots) mkdirSync(screenshots, { recursive: true });
const executablePath = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find(existsSync);
assert(executablePath, 'Chrome or Edge is required for this browser check.');
const browser = await chromium.launch({ executablePath, headless: true });
const expected = {
  zh: ['精选作品', '全部作品', '专业实力', '联系'],
  en: ['Featured', 'All Work', 'Expertise', 'Contact'],
};

try {
  for (const width of [1024, 1102, 1440, 1920]) {
    const page = await createSafePage(browser, { viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('index.html#projects', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#primary-nav .site-primary-nav');

    for (const lang of ['zh', 'en']) {
      if (lang === 'en') await page.locator('.nav-lang').click();
      const links = page.locator('#primary-nav .site-primary-nav > li > a');
      assert.deepEqual(await links.allTextContents(), expected[lang], `${width}px home ${lang} labels`);
      assert.equal(await page.locator('#primary-nav [data-impact-trigger]').count(), 0);
      assert.equal(await page.locator('#primary-nav .site-primary-nav__submenu').count(), 0);
      assert.equal(await page.locator('#primary-nav [data-impact-nav] svg').count(), 0);
      const geometry = await links.evaluateAll(anchors => anchors.map(anchor => {
        const rect = anchor.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }));
      assert(geometry.every(rect => rect.width > 0 && rect.left >= 0 && rect.right <= width), `${width}px nav fits viewport`);
      assert(geometry.slice(1).every((rect, index) => rect.left >= geometry[index].right), `${width}px nav links do not overlap`);

      await page.locator('#primary-nav [data-impact-nav]').click();
      await page.waitForFunction(() => location.hash === '#recognition');
      await page.waitForTimeout(120);
      assert(await page.locator('#primary-nav [data-impact-nav]').evaluate(el => el.classList.contains('is-active')));
      for (const id of ['impact-awards', 'impact-programs', 'impact-reach', 'experiments']) {
        await page.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' }), id);
        await page.waitForTimeout(160);
        assert(await page.locator('#primary-nav [data-impact-nav]').evaluate(el => el.classList.contains('is-active')), `${width}px ${lang} Expertise active at #${id}`);
      }
      await page.evaluate(() => document.getElementById('experiments').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(160);
      assert(await page.locator('#primary-nav [data-impact-nav]').evaluate(el => el.classList.contains('is-active')), 'AI Lab remains within Expertise');
      await page.locator('#primary-nav a[href="#contact"]').click();
      await page.waitForFunction(() => location.hash === '#contact');
      assert(await page.locator('#primary-nav a[href="#contact"]').evaluate(el => el.classList.contains('is-active')), 'Contact must show selected underline');
      assert.equal(await page.locator('#primary-nav .is-active').count(), 1, 'Only one active nav item');
      await page.locator('#primary-nav a[href="#projects"]').click();
      await page.waitForFunction(() => location.hash === '#projects');
      assert(await page.locator('#primary-nav a[href="#projects"]').evaluate(el => el.classList.contains('is-active')));
      if (screenshots && width === 1440) await page.locator('body > header').screenshot({ path: `${screenshots}/after-${lang}.png` });
    }
    assert.deepEqual(errors, [], `${width}px home page errors`);
    await page.close();

    const works = await createSafePage(browser, { viewport: { width, height: 900 } });
    await works.goto(new URL('works.html?category=visual', base).href, { waitUntil: 'domcontentloaded' });
    await works.waitForSelector('.library-page-navigation .site-primary-nav');
    for (const lang of ['zh', 'en']) {
      if (lang === 'en') await works.locator('.library-page-navigation .cinema-player__language').click();
      const links = works.locator('.library-page-navigation .site-primary-nav > li > a');
      assert.deepEqual(await links.allTextContents(), expected[lang], `${width}px works ${lang} labels`);
      assert.equal(await works.locator('.library-page-navigation [data-impact-trigger]').count(), 0);
      assert.equal(await works.locator('.library-page-navigation .site-primary-nav__submenu').count(), 0);
      await works.locator('.library-page-navigation [data-impact-nav]').click();
      await works.waitForURL('**/index.html#recognition');
      assert.equal(new URL(works.url()).hash, '#recognition');
      await works.goto(new URL('works.html?category=visual', base).href, { waitUntil: 'domcontentloaded' });
      await works.waitForSelector('.library-page-navigation .site-primary-nav');
    }
    await works.close();
    console.log(`${width}px: home/library navigation, bilingual labels, Expertise anchor, active state and fit passed`);
  }

  const mobile = await createSafePage(browser, { viewport: { width: 390, height: 844 } });
  await mobile.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
  await mobile.locator('.nav-toggle').click();
  assert.deepEqual(await mobile.locator('#mobile-primary-nav a').evaluateAll(as => as.map(a => a.getAttribute('href'))), ['#projects', './works.html', '#recognition', '#contact']);
  assert.equal(await mobile.locator('#primary-nav .site-primary-nav').isVisible(), false);
  await mobile.close();
  console.log('390px: hamburger menu and four unified primary entries');
} finally {
  await browser.close();
}
