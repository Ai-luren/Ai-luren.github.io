/**
 * Regression: from Works, "Home" means the Hero (NOT history.back()), while
 * Featured / Expertise / Contact must land at the real post-React coordinates.
 * Browser Back/Forward scroll restoration is independently tested elsewhere.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';

const executablePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const width of [320, 390, 760, 1440]) {
    for (const lang of ['zh', 'en']) {
      for (const destination of ['top', 'projects', 'recognition', 'contact']) {
        const page = await createSafePage(browser, { viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.addInitScript(value => localStorage.setItem('ailuren-lang', value), lang);
          await page.goto(new URL('works.html', base).href, { waitUntil: 'domcontentloaded' });
          await page.locator('.library-grid .comet-archive__item').first().waitFor();
          await page.evaluate(() => scrollTo({ top: 650, behavior: 'instant' }));
          if (destination === 'top') {
            const brand = page.locator('.library-page-navigation .cinema-player__brand--home-return');
            assert.equal(await brand.getAttribute('href'), './index.html#top',
              'Explicit Home action must always target the opening Hero');
            await brand.click();
          } else if (width <= 760) {
            await page.locator('.library-page-navigation .cinema-player__close').click();
            await page.locator('#library-menu[open]').waitFor();
            await page.locator(`#library-menu a[href$="#${destination}"]`).click();
          } else {
            await page.locator(`.library-page-navigation a[href$="#${destination}"]`).click();
          }
          await page.waitForURL(url => url.pathname.endsWith('/index.html') &&
            url.hash === '#' + destination);
          await page.locator('#projects .comet-card').first().waitFor();
          await page.waitForTimeout(640); // covers late React / GSAP layout reconciliation
          const state = await page.evaluate(destination => {
            const el = destination === 'top' ? document.getElementById('top')
              : destination === 'contact' ? document.querySelector('#profile .closing-card')
              : document.querySelector('#' + destination + ' .section-intro');
            const rect = el.getBoundingClientRect();
            const nav = document.querySelector('header').getBoundingClientRect();
            const css = getComputedStyle(document.documentElement);
            const offset = Math.max(parseFloat(css.scrollPaddingTop) || 0, nav.bottom + 12);
            return {
              top: rect.top, bottom: rect.bottom, height: rect.height,
              offset, scroll: scrollY, viewport: innerHeight,
              max: document.documentElement.scrollHeight - innerHeight,
              heroVisible: document.getElementById('top').getBoundingClientRect().bottom > 100,
            };
          }, destination);
          const tag = `${width}px ${lang} Works → ${destination}`;
          if (destination === 'top') {
            assert(state.scroll <= 3 && state.heroVisible,
              tag + ': Home must start at Hero, not last reading position: ' + JSON.stringify(state));
          } else if (destination === 'contact') {
            // The closing card is the final element: at document bottom, there
            // is no reason to append a blank screen just to reach offset 88px.
            assert(state.top > state.offset - 3 && state.top < state.viewport * .68,
              tag + ': the cooperation card must be immediately in view: ' + JSON.stringify(state));
            assert(state.bottom <= state.viewport + 3,
              tag + ': contact actions must not be below the fold: ' + JSON.stringify(state));
          } else {
            assert(Math.abs(state.top - state.offset) < 7,
              tag + ': heading must land below sticky nav at the canonical offset: ' + JSON.stringify(state));
          }
          assert.deepEqual(errors, [], tag + ': unexpected browser errors');
          console.log('PASS', tag, 'anchor', Math.round(state.top), 'scroll', Math.round(state.scroll));
        } finally { await page.close(); }
      }
    }
  }
  console.log('CROSS_PAGE_SECTION_NAVIGATION_PASS: 4 widths × 2 languages × 4 destinations');
} finally { await browser.close(); }
