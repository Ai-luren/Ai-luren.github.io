/** Portfolio directory inside the established cinema dialog: discovery,
 * responsive geometry, source scope, caption action and history contract. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
try {
  for (const width of [320, 390, 760, 1024, 1440]) {
    for (const lang of ['zh', 'en']) {
      const page = await createSafePage(browser, { viewport: { width, height: width < 400 ? 844 : 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(value => localStorage.setItem('ailuren-lang', value), lang);
      try {
        await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
        await page.locator('#projects .comet-archive__card').first().click();
        const player = page.locator('.cinema-player[open]');
        await player.waitFor({ timeout: 12000 });
        assert.equal(await player.locator('.cinema-player__count').textContent(), '1 / 8');
        // Only ONE catalogue trigger, in the original caption-side share slot.
        const trigger = player.locator('.cinema-player__directory-trigger');
        assert.equal(await trigger.count(), 1);
        assert.equal(await trigger.locator('xpath=..').getAttribute('class'), 'cinema-player__caption-actions');
        assert.equal(await player.locator('.cinema-player__work-nav .cinema-player__directory-trigger').count(), 0);
        assert.equal(await player.locator('.cinema-player__share').count(), 0);
        assert.equal(await player.locator('.cinema-player__sequence > button').count(), 2);
        const centerBefore = await player.locator('.cinema-player__stage').evaluate(node => {
          const rect = node.getBoundingClientRect(); return rect.left + rect.width / 2;
        });
        await trigger.click();
        const directory = player.locator('#cinema-work-directory');
        await directory.waitFor({ state: 'visible' });
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        assert.equal(await directory.locator('.cinema-directory__filter').count(), 6);
        assert.equal(await directory.locator('.cinema-directory__filter[data-scope="featured"]').getAttribute('aria-pressed'), 'true',
          'Featured viewer must open with Featured tab, not All Work');
        assert.equal(await directory.locator('.cinema-directory__item').count(), 8,
          'Featured viewer shows eight featured works by default');
        await directory.locator('.cinema-directory__filter[data-scope="all"]').click();
        assert.equal(await directory.locator('.cinema-directory__item').count(), 19,
          'All Work remains available on deliberate selection');
        // Browsing another tab without picking a film must NOT silently
        // change the selected work range when the directory is reopened.
        await directory.locator('.cinema-directory__close').click();
        await trigger.click();
        assert.equal(await directory.locator('.cinema-directory__filter[data-scope="featured"]').getAttribute('aria-pressed'), 'true',
          'Reopening after a temporary All Work exploration restores Featured');
        assert.equal(await directory.locator('.cinema-directory__item').count(), 8);
        assert.equal(await player.locator('video').getAttribute('src'), null, 'Browsing directory cannot fetch video bytes');
        assert.equal(await directory.locator('.cinema-directory__share, .cinema-player__share').count(), 0, 'Copy link UI is gone');
        const boxes = await directory.evaluate(node => {
          const outer = node.getBoundingClientRect();
          const list = node.querySelector('.cinema-directory__list').getBoundingClientRect();
          const stage = document.querySelector('.cinema-player__stage').getBoundingClientRect();
          const filters = [...node.querySelectorAll('.cinema-directory__filter')].map(button => {
            const rect = button.getBoundingClientRect(), label = button.firstElementChild;
            return { left: rect.left, right: rect.right, clipped: label.scrollWidth > label.clientWidth };
          });
          const paragraph = document.querySelector('.cinema-player__caption-actions p')?.getBoundingClientRect();
          const text = document.querySelector('.cinema-player__directory-trigger span')?.getBoundingClientRect();
          return { outer: { left: outer.left, right: outer.right }, listHeight: list.height,
            filmRight: stage.right, filmCenter: stage.left + stage.width / 2,
            captionBaselineDelta: paragraph && text ? text.top + text.height / 2 - (paragraph.top + paragraph.height / 2) : 0,
            filters, overflow: document.documentElement.scrollWidth - innerWidth };
        });
        assert(boxes.overflow < 3 && boxes.outer.left >= -1 && boxes.outer.right <= width + 1,
          `${width}/${lang}: directory must fit viewport ${JSON.stringify(boxes)}`);
        assert(boxes.listHeight >= 120, `${width}/${lang}: scrollable thumbnail area disappeared`);
        for (const filter of boxes.filters) {
          assert(!filter.clipped && filter.left >= boxes.outer.left && filter.right <= boxes.outer.right + 1,
            `${width}/${lang}: filter label clipped ${JSON.stringify(filter)}`);
        }
        assert(Math.abs(boxes.filmCenter - centerBefore) <= 1.5,
          `${width}/${lang}: opening directory cannot shift film center`);
        assert(Math.abs(boxes.captionBaselineDelta) <= 1.5, `${width}/${lang}: label and directory should be vertically aligned`);
        if (width >= 1320) assert(boxes.filmRight + 6 <= boxes.outer.left, 'Docked film and list cannot overlap');
        await directory.locator('[data-scope="visual"]').click();
        assert.equal(await directory.locator('.cinema-directory__item').count(), 2);
        await directory.locator('[data-project-id="14"]').click();
        await page.waitForFunction(() => document.querySelector('.cinema-player[open]')?.dataset.projectId === '14');
        assert.equal(await player.locator('.cinema-player__count').textContent(), '2 / 2');
        if (width >= 1320) {
          assert.equal(await directory.count(), 1, 'Wide desktop directory stays open until dismissed');
          assert.equal(await player.locator('.cinema-player__layout').getAttribute('inert'), null,
            'Wide desktop playback controls must not become inert');
          await player.locator('.cinema-player__sequence > button').first().click();
          await page.waitForFunction(() => document.querySelector('.cinema-player[open]')?.dataset.projectId === '15');
          assert.equal(await player.locator('.cinema-player__count').textContent(), '1 / 2');
          assert.equal(await directory.count(), 1);
        } else {
          assert.equal(await directory.count(), 0, 'Compact sheet closes after choosing a work');
          await trigger.click();
        }
        await player.locator('[data-scope="all"]').click();
        await player.locator('.cinema-directory__item[data-project-id="19"]').click();
        await page.waitForFunction(() => document.querySelector('.cinema-player[open]')?.dataset.projectId === '19');
        assert.equal(await player.locator('.cinema-player__count').textContent(), '1 / 19');
        assert.equal(await player.locator('.cinema-player__version').count(), 3, 'Original A/B/C version track remains independent');
        if (width >= 1320) {
          assert.equal(await directory.count(),1, 'Desktop still displays catalogue after a cross-category choice');
          await player.locator('.cinema-player__version').nth(1).click();
          await page.waitForFunction(() => document.querySelectorAll('.cinema-player__version[aria-pressed="true"]')[0]?.textContent !== document.querySelectorAll('.cinema-player__version')[0]?.textContent);
          assert.equal(await directory.count(), 1, 'Switching the A/B/C version must not dismiss the desktop list');
          await player.locator('.cinema-player__sequence > button').last().click();
          await page.waitForFunction(() => document.querySelector('.cinema-player[open]')?.dataset.projectId === '17');
          assert.equal(await directory.count(), 1, 'Work arrows remain usable while list is open');
        } else {
          assert.equal(await directory.count(), 0);
          await trigger.click();
        }
        await page.keyboard.press('Escape');
        assert.equal(await directory.count(), 0, 'Escape first closes only the directory');
        assert.equal(await player.getAttribute('data-project-id'), width >= 1320 ? '17' : '19');
        await page.keyboard.press('Escape');
        await player.waitFor({ state: 'detached' });
        assert.deepEqual(errors, [], `${width}/${lang}: no runtime errors`);
        assert.equal(getSafeMediaReport(page).urls.length, 0, 'No real video CDN access');
        console.log('PASS_CINEMA_DIRECTORY_HOME', width, lang);
      } finally { await page.close(); }
    }
  }
  // Rotated devices and accessibility zoom: the ordinary three-row filter
  // header must not eat the actual scrollable list on a 280–500px tall screen.
  for (const [width, height] of [[320, 280], [393, 280], [760, 393], [852, 393], [1024, 500]]) {
    for (const lang of ['zh', 'en']) {
      const page = await createSafePage(browser, { viewport: { width, height } });
      await page.addInitScript(value => localStorage.setItem('ailuren-lang', value), lang);
      try {
        await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
        await page.locator('#projects .comet-archive__card').first().click();
        await page.locator('.cinema-player[open]').waitFor();
        await page.locator('.cinema-player__directory-trigger').click();
        await page.waitForTimeout(310);
        const measured = await page.locator('.cinema-directory').evaluate(node => {
          const r = node.getBoundingClientRect();
          const list = node.querySelector('.cinema-directory__list').getBoundingClientRect();
          const filters = [...node.querySelectorAll('.cinema-directory__filter')].map(button => ({
            height: button.getBoundingClientRect().height,
            clipped: button.firstElementChild.scrollWidth > button.firstElementChild.clientWidth,
          }));
          return { panel: { x: r.x, right: r.right, y: r.y, bottom: r.bottom },
            listHeight: list.height, filters, overflow: document.documentElement.scrollWidth - innerWidth };
        });
        assert(measured.panel.x >= -1 && measured.panel.right <= width + 1
          && measured.panel.y >= -1 && measured.panel.bottom <= height + 1,
          `${width}×${height}/${lang}: short-height directory out of bounds`);
        assert(measured.listHeight >= 75, `${width}×${height}/${lang}: no selectable gallery visible`);
        assert(measured.filters.every(item => item.height >= 44 && !item.clipped),
          `${width}×${height}/${lang}: short-height category labels must fit`);
        assert(measured.overflow < 3);
        await page.locator('.cinema-directory__filter[data-scope="visual"]').click();
        await page.locator('.cinema-directory__item[data-project-id="14"]').click();
        await page.waitForFunction(() => document.querySelector('.cinema-player[open]')?.dataset.projectId === '14');
        console.log('PASS_CINEMA_DIRECTORY_SHORT_VIEWPORT', width, height, lang);
      } finally { await page.close(); }
    }
  }
  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, { viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(new URL('works.html?watch=14', base).href, { waitUntil: 'domcontentloaded' });
      const player = page.locator('.cinema-player[open]');
      await player.waitFor({ timeout: 12000 });
      const initialHistory = await page.evaluate(() => history.length);
      await player.locator('.cinema-player__directory-trigger').click();
      assert.equal(await player.locator('.cinema-directory__filter[data-scope="visual"]').getAttribute('aria-pressed'), 'true',
        'Direct Visual work opens directory in its category');
      assert.equal(await player.locator('.cinema-directory__item').count(), 2);
      assert.equal(await player.locator('.cinema-directory__share, .cinema-player__share').count(), 0,
        'No copy link action anywhere in viewer');
      await player.locator('[data-scope="commercial"]').click();
      await player.locator('.cinema-directory__item[data-project-id="16"]').click();
      await page.waitForFunction(() => document.querySelector('.cinema-player[open]')?.dataset.projectId === '16');
      assert.equal(new URL(page.url()).searchParams.get('watch'), '16');
      assert.equal(await page.evaluate(() => history.length), initialHistory,
        'Cross-category catalogue selection must replace, not push history');
      assert.equal(await page.locator('.library-filters [data-category="visual"]').getAttribute('aria-pressed'), 'true',
        'Return should preserve source category');
      if (width >= 1320) {
        assert.equal(await player.locator('.cinema-directory').count(), 1, 'Desktop list remains open on selection');
      } else {
        assert.equal(await player.locator('.cinema-directory').count(), 0, 'Mobile sheet closes on selection');
      }
      await player.locator('.cinema-player__close').click();
      await player.waitFor({ state: 'detached' });
      assert.equal(await page.locator('.library-grid .comet-archive__card').count(), 2);
      await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.locator('.cinema-player[open]').waitFor();
      assert.equal(await page.locator('.cinema-player[open]').getAttribute('data-project-id'), '16');
      assert.deepEqual(errors, []);
      console.log('PASS_CINEMA_DIRECTORY_SHARE_AND_HISTORY', width);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
