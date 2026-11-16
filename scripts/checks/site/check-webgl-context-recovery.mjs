// Legacy command name retained for older workflows.
// The published cinematic Hero has NO WebGL renderer on any device.
// Guard against CRT, scanlines, black masks, stale grading and wrong posters.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Edge or Chrome is required');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const browser = await chromium.launch({ executablePath, headless: true });

try {
  for (const width of [320, 390, 720, 740, 761, 1024, 1440]) {
    const page = await createSafePage(browser, {
      viewport: { width, height: width < 761 ? 844 : 900 },
      isMobile: width <= 720,
      hasTouch: width <= 720,
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('ailuren-video-tuning-v18', JSON.stringify({
        brightness: 1, saturation: 0, crt: 100, noise: 100, mask: 100,
      }));
    });
    try {
      await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#hero-video')?.readyState >= 2,
        { timeout: 20000 });
      await page.waitForTimeout(660);
      const data = await page.evaluate(() => {
        const video = document.querySelector('#hero-video');
        const get = selector => getComputedStyle(document.querySelector(selector));
        const masks = ['#hero-profile-mask', '#video-dim', '#video-overlay', '#video-vignette'];
        return {
          experience: document.documentElement.dataset.heroExperience,
          src: video.currentSrc,
          poster: video.getAttribute('poster'),
          duration: video.duration,
          currentTime: video.currentTime,
          videoOpacity: Number(get('#hero-video').opacity),
          videoFilter: get('#hero-video').filter,
          masks: masks.map(selector => ({ selector, display: get(selector).display })),
          webgl: Boolean(document.querySelector('#video-webgl')),
          backgroundPoster: get('#hero-first-frame').backgroundImage,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      const version = width <= 760 ? 'hero-mobile-pingpong' : 'hero';
      const poster = width <= 720 ? 'hero-first-frame-mobile' : 'hero-first-frame-desktop';
      assert.equal(data.experience, 'cinematic', width + 'px: homepage journey missing');
      assert.equal(data.webgl, false, width + 'px: WebGL post-processing must remain retired');
      assert.equal(data.videoOpacity, 1, width + 'px: native video must be visible');
      assert.equal(data.videoFilter, 'none', width + 'px: CRT/black video filter must stay disabled');
      assert(data.masks.every(item => item.display === 'none'),
        width + 'px: one or more black masks are visible: ' + JSON.stringify(data.masks));
      assert(data.poster === null || data.poster === '', width + 'px: native poster duplicates the responsive first-frame layer');
      assert(data.backgroundPoster.includes(poster), width + 'px: wrong first-frame still');
      assert(data.src.includes(version), width + 'px: wrong film source ' + data.src);
      assert(data.duration >= (width <= 760 ? 29.9 : 14.8) && data.duration <= (width <= 760 ? 30.1 : 15.3),
        width + 'px: unexpected mobile ping-pong / desktop scrub film duration ' + data.duration);
      assert.equal(data.overflow, 0, width + 'px: horizontal overflow');

      await page.evaluate(() => scrollTo({
        top: Math.round((document.documentElement.scrollHeight - innerHeight) * .35),
        behavior: 'instant',
      }));
      await page.waitForTimeout(550);
      const advanced = await page.evaluate(() => document.querySelector('#hero-video').currentTime);
      assert(advanced > 1, width + 'px: native film failed to follow scrolling');
      assert.deepEqual(errors, [], width + 'px: JS errors');
      assert.equal(getSafeMediaReport(page).urls.length, 0, width + 'px: unexpected CDN traffic');
      console.log('PASS '+ width +'px: native 15s film, no WebGL/CRT/masks, matched poster, active scrub');
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
