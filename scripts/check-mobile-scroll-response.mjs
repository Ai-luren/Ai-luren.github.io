// Mobile background scroll: local Hero only; never request ImageKit resources.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(executablePath, 'Chromium browser required');
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
try {
  for (const width of [390, 430, 1440]) {
    const mobile = width <= 760;
    const page = await createSafePage(browser, { viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__scrollTest = { seeks: [], refreshes: 0 };
      const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(value) {
          if (this.id === 'hero-video') window.__scrollTest.seeks.push({ value, pending: this.seeking });
          return desc.set.call(this, value);
        }
      });
    });
    try {
      await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#hero-video')?.readyState >= 2, { timeout: 20000 });
      await page.waitForTimeout(200);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      for (let i = 1; i <= 35; i++) {
        await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), i * 95);
        await page.waitForTimeout(36);
      }
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => {
        const video = document.getElementById('hero-video');
        const progress = +document.documentElement.style.getPropertyValue('--scroll-progress');
        const bg = document.getElementById('video-bg');
        return {
          expected: progress * video.duration,
          actual: video.currentTime,
          ready: video.readyState,
          seeking: video.seeking,
          seeks: window.__scrollTest.seeks.length,
          pending: window.__scrollTest.seeks.filter(item => item.pending).length,
          overflow: document.documentElement.scrollWidth - innerWidth,
          videoUrl: video.currentSrc,
          fixedBg: getComputedStyle(bg).position === 'fixed',
          stableMobileHeightRule: [...document.styleSheets].some(sheet => {
            try { return [...sheet.cssRules].some(rule => rule.cssText.includes('#video-bg') && rule.cssText.includes('100lvh')); }
            catch { return false; }
          })
        };
      });
      assert(state.ready >= 2 && !state.seeking);
      assert(Math.abs(state.actual - state.expected) <= .12, 'Hero did not settle after swipe');
      assert(state.seeks >= 8, 'Hero no longer responds to scrolling');
      if (mobile) {
        assert(state.seeks <= 30, 'Decoder received excessive seek requests');
        assert.equal(state.pending, 0, 'Interrupted pending decoder seek');
        assert(state.stableMobileHeightRule, 'Missing stable 100lvh mobile background');
      }
      assert(state.fixedBg && state.overflow <= 1 && state.videoUrl.includes('assets/videos/hero/'));
      assert.equal(getSafeMediaReport(page).urls.length, 0);
      assert.deepEqual(errors, [], 'Browser errors');
      if (mobile) {
        await page.evaluate(() => {
          if (window.ScrollTrigger) {
            const refresh = window.ScrollTrigger.refresh;
            window.ScrollTrigger.refresh = function (...args) {
              window.__scrollTest.refreshes++;
              return refresh.apply(this, args);
            };
          }
        });
        await page.setViewportSize({ width, height: 770 });
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.__scrollTest.refreshes), 0, 'Mobile height-only resize refreshed all GSAP triggers');
      }
      console.log('PASS ' + width + 'px: ' + state.seeks + ' seeks, ' + state.pending + ' pending overwrites, settle error ' + Math.abs(state.actual - state.expected).toFixed(3) + 's; no CDN');
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
