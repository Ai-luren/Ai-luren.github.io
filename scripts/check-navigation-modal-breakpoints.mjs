// Regression: modal menu focus must remain inside the menu, and rotating into
// the 761px+ text-navigation layout must unlock the page immediately.
// The shared media guard ensures zero ImageKit outbound requests.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Chrome or Edge is required');
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const cases = [
  { path: 'index.html', button: 'header .nav-toggle', dialog: '#mobile-nav-drawer', activeNav: '#primary-nav .site-primary-nav' },
  { path: 'works.html', button: '.library-page-navigation .cinema-player__close', dialog: '#library-menu', activeNav: '.library-page-navigation .site-primary-nav' },
];
const readState = page => page.evaluate(() => ({
  focusInMenu: Boolean(document.activeElement?.closest('#mobile-nav-drawer,#library-menu')),
  active: document.activeElement?.getAttribute('class') || document.activeElement?.tagName,
  openHome: document.getElementById('mobile-nav-drawer')?.classList.contains('is-open') || false,
  libraryDialogOpen: document.getElementById('library-menu')?.open || false,
  inert: document.querySelector('main')?.inert || false,
  scrollLocked: getComputedStyle(document.body).overflowY === 'hidden',
  mobileNavClass: document.body.classList.contains('mobile-nav-open'),
}));
const isOpen = state => state.openHome || state.libraryDialogOpen;
try {
  for (const { path, button, dialog, activeNav } of cases) {
    for (const lang of ['zh', 'en']) {
      const mobileWidth = lang === 'zh' ? 760 : 390;
      const tabletWidth = lang === 'zh' ? 761 : 820;
      const page = await createSafePage(browser, { viewport: { width: mobileWidth, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(language => {
        localStorage.setItem('ailuren-language', language);
      }, lang);
      await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded' });
      await page.locator(button).click();

      let state = await readState(page);
      assert(isOpen(state), path + ' menu did not open');
      assert(state.focusInMenu, path + ' initial focus outside modal');
      assert(state.scrollLocked, path + ' missing scroll lock');
      assert.equal(await page.locator(dialog).isVisible(), true);

      const inMenu = () => page.evaluate(() => Boolean(document.activeElement?.closest('#mobile-nav-drawer,#library-menu')));
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        assert(await inMenu(), path + ' Tab escaped modal');
      }
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Shift+Tab');
        assert(await inMenu(), path + ' Shift+Tab escaped modal');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(450);
      state = await readState(page);
      assert(!isOpen(state) && !state.scrollLocked && !state.inert, path + ' Escape did not fully restore page');
      await page.locator(button).click();
      assert(isOpen(await readState(page)));
      await page.setViewportSize({ width: tabletWidth, height: 900 });
      await page.waitForTimeout(90);
      state = await readState(page);
      assert(!isOpen(state), path + ' modal survived mobile-to-tablet change');
      assert(!state.scrollLocked && !state.inert && !state.mobileNavClass, path + ' page remains locked after resize');
      assert(await page.locator(activeNav).isVisible(), path + ' text nav not visible');
      assert.equal(await page.locator(activeNav + ' > li > a').count(), 4);
      assert(!state.focusInMenu, path + ' focus remained in hidden menu');
      // Resizing back should allow the mobile menu to open and close normally.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator(button).click();
      assert((await readState(page)).focusInMenu, path + ' reopening lost modal focus');
      // Rotation while the exit animation is in progress must not leave timers locking the page.
      if (path === 'index.html') {
        await page.locator('#mobile-nav-drawer a[href="#projects"]').click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.setViewportSize({ width: 820, height: 900 });
      await page.waitForTimeout(470);
      state = await readState(page);
      assert(!isOpen(state) && !state.inert && !state.scrollLocked, path + ' stale close timer retained state');
      assert.deepEqual(errors, [], path + ' page script errors');
      assert.equal(getSafeMediaReport(page).urls.length, 0);
      console.log(`PASS ${path} ${lang}: modal focus, Tab/Shift+Tab, Escape, ${mobileWidth}→${tabletWidth}px crossing, interrupted close, no ImageKit`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
