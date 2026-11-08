import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createCoverStudio } from '../tools/cover-studio/server.mjs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'ailuren-black-cover-'));
for (const relative of ['src', 'assets/images', 'index.html', 'works.html']) {
  await fs.cp(path.join(root, relative), path.join(fixture, relative), { recursive: true });
}
await fs.writeFile(path.join(fixture, 'package.json'), '{"type":"module"}\n');
await fs.symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'));
let studio, browser;
try {
  studio = await createCoverStudio({ projectRoot: fixture, port: 5349 });
  browser = await chromium.launch({
    executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    headless: true,
  });
  const page = await createSafePage(browser, { viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(studio.url);
  await page.waitForFunction(() => document.querySelectorAll('#ux-gallery .ux-project-image').length === 8);
  async function checkBackground(...selectors) {
    const backgrounds = await page.evaluate(selectors =>
      selectors.map(selector => {
        const el = document.querySelector(selector);
        if (!el) return { selector, exists: false };
        return { selector, exists: true, background: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage };
      }), selectors);
    for (const item of backgrounds) {
      assert(item.exists, 'Missing visual surface: ' + item.selector);
      assert.equal(item.background, 'rgb(0, 0, 0)', 'Non-black media surface: ' + item.selector);
      assert.equal(item.image, 'none', 'Unwanted background gradient: ' + item.selector);
    }
  }
  await checkBackground('#ux-gallery .ux-project-image', '#ux-gallery .ux-project-image>img');

  await page.locator('#ux-gallery .ux-project-image').first().click();
  await checkBackground('#ux-editor .ux-cover-picture', '#ux-editor .ux-poster-picture',
    '#ux-editor .ux-cover-picture>img', '#ux-editor .ux-poster-picture>img');
  await page.locator('#ux-history-cover').click();
  await checkBackground('#ux-history-dialog .ux-history-image');
  await page.locator('#ux-history-close').click();

  await page.locator('#ux-close-editor').click();
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('.ux-new-project-tile').click();
  await checkBackground('#ux-new-editor .ux-new-player-picture', '#ux-new-editor #preview-wrap');
  assert.equal(getSafeMediaReport(page).urls.length, 0);
  assert.deepEqual(errors, []);
  console.log('BLACK_COVER_BACKDROPS_PASS: gallery, details 3:4 and poster, history, creation previews; safe media guard');
} finally {
  if (browser) await browser.close();
  if (studio) await studio.close();
  await fs.rm(fixture, { recursive: true, force: true });
}
