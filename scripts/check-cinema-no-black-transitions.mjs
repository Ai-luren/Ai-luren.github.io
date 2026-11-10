// Real local MP4 and existing WebP posters only. Never fetch ImageKit.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const browserPath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(browserPath, 'Chrome/Edge is required for local media checks');
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function isPoster(url, stem) {
  try { return decodeURIComponent(new URL(url).pathname).includes(stem) && /\.webp(?:\?|$)/.test(url); }
  catch { return false; }
}
const posterState = page => page.locator('.cinema-player__poster').evaluate(img => ({
  ready: img.complete && img.naturalWidth > 0,
  visible: getComputedStyle(img).opacity !== '0',
  source: decodeURIComponent(img.currentSrc),
  playing: Boolean(img.closest('.cinema-player')?.querySelector('video')?.getAttribute('src')),
}));
const currentId = page => page.locator('.cinema-player[open]').getAttribute('data-project-id');
const currentVersion = page => page.locator('.cinema-player__versions .cinema-player__version')
  .evaluateAll(buttons => buttons.findIndex(item => item.getAttribute('aria-pressed') === 'true'));
let checks = 0;
try {
  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, { viewport: { width, height: width < 500 ? 844 : 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let delayedRequests = 0;
    await page.route(/\.webp(?:\?|$)/i, async route => {
      if (route.request().resourceType() === 'image' && isPoster(route.request().url(), 'MEXC Member Perks - Version B')) {
        delayedRequests++;
        await delay(2600);
      }
      try { await route.fallback(); } catch { /* page may have closed */ }
    });
    try {
      await page.goto(new URL('works.html', base).href, { waitUntil: 'domcontentloaded' });
      await page.locator('.library-grid .comet-archive__card[data-project-id="16"]').click();
      await page.locator('.cinema-player[open]').waitFor();
      assert((await posterState(page)).ready, 'Main poster must be ready when opened');
      assert.equal(await currentVersion(page), 0);
      const buttonB = page.locator('.cinema-player__version').nth(1);
      await buttonB.click();
      await page.waitForTimeout(180);
      assert.equal(await currentVersion(page), 0, 'Version swapped before B poster decoded');
      assert((await posterState(page)).ready, 'Current poster was lost while B was pending');
      assert.equal(await buttonB.getAttribute('aria-busy'), 'true');
      await page.waitForFunction(() =>
        document.querySelectorAll('.cinema-player__version')[1]?.getAttribute('aria-pressed') === 'true', null, { timeout: 12000 });
      assert((await posterState(page)).ready, 'B poster not decoded when made visible');
      assert(delayedRequests >= 1, 'Delayed B poster was not actually requested');
      assert.equal((await posterState(page)).playing, false, 'Switch must not download a video');
      assert.equal(getSafeMediaReport(page).urls.length, 0, 'ImageKit request before Play');
      console.log('PASS', width, 'delayed A/B poster retains outgoing image then swaps decoded new poster');
      checks++;

      // A second request that finishes late must not override a newer choice.
      await page.locator('.cinema-player__version').first().click();
      await page.waitForFunction(() =>
        document.querySelectorAll('.cinema-player__version')[0]?.getAttribute('aria-pressed') === 'true');
      assert((await posterState(page)).ready);
      await page.locator('.cinema-player__close').click();
      await page.locator('.cinema-player').waitFor({ state: 'detached' });
      assert.deepEqual(errors, [], 'No JavaScript errors');
    } finally { await page.close(); }
  }

  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, { viewport: { width, height: width < 500 ? 844 : 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let delayedRequests = 0;
    await page.route(/\.webp(?:\?|$)/i, async route => {
      if (route.request().resourceType() === 'image' && isPoster(route.request().url(), '/player-posters/commercial/MEXC No More Waiting.webp')) {
        delayedRequests++;
        await delay(3500);
      }
      try { await route.fallback(); } catch {}
    });
    try {
      await page.goto(new URL('works.html', base).href, { waitUntil: 'domcontentloaded' });
      await page.locator('.library-grid .comet-archive__card[data-project-id="19"]').click();
      await page.locator('.cinema-player[open]').waitFor();
      assert((await posterState(page)).ready);
      await page.locator('.cinema-player__work-nav button').last().click();
      await page.waitForTimeout(1750); // deliberately longer than the old 1.5s timeout
      assert.equal(await currentId(page), '19', 'Changed work before slow poster decoded');
      assert((await posterState(page)).ready, 'Old work poster missing during slow navigation');
      await page.waitForFunction(() =>
        document.querySelector('.cinema-player[open]')?.dataset.projectId === '17', null, { timeout: 14000 });
      assert((await posterState(page)).ready, 'New work has an empty poster');
      assert(delayedRequests >= 1);
      assert.equal(getSafeMediaReport(page).urls.length, 0);
      assert.deepEqual(errors, []);
      console.log('PASS', width, '3.5s next-work poster preserves previous frame');
      checks++;
    } finally { await page.close(); }
  }

  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, { viewport: { width, height: width < 500 ? 844 : 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const localRequests = [];
    await page.route(/\/assets\/videos\/works\/.*\.mp4(?:[?#]|$)/i, async route => {
      localRequests.push(route.request().url());
      await delay(1450); // simulated buffer/slow initial local MP4 read
      try { await route.fallback(); } catch {}
    });
    try {
      await page.goto(new URL('works.html', base).href, { waitUntil: 'domcontentloaded' });
      await page.locator('.library-grid .comet-archive__card[data-project-id="17"]').click();
      await page.locator('.cinema-player[open]').waitFor();
      assert((await posterState(page)).ready);
      await page.locator('.cinema-player__play').click();
      await page.waitForTimeout(550);
      assert((await posterState(page)).ready && (await posterState(page)).visible,
        'Buffered video exposed a blank/hidden poster before its first frame');
      await page.waitForFunction(() => {
        const v = document.querySelector('.cinema-player video');
        return v && v.currentTime > 0 && document.querySelector('.cinema-player__poster.is-revealed');
      }, null, { timeout: 15000 });
      const v = await page.locator('.cinema-player video').evaluate(video => ({
        src: video.currentSrc, nativeSize: [video.videoWidth, video.videoHeight],
      }));
      assert(v.src.includes('/assets/videos/works/'), 'Video playback did not use local MP4');
      assert(localRequests.length >= 1, 'No real local MP4 was requested');
      assert.equal(getSafeMediaReport(page).urls.length, 0);
      assert.deepEqual(errors, []);
      console.log('PASS', width, '1.45s delayed local MP4 displays poster until decoded frame');
      checks++;
    } finally { await page.close(); }
  }
  // A missing version poster falls back to an already decoded card cover.
  {
    const page = await createSafePage(browser, { viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/\.webp(?:\?|$)/i, async route => {
      if (route.request().resourceType() === 'image' && isPoster(route.request().url(), 'MEXC Member Perks - Version B')) {
        await route.fulfill({ status: 404, body: '' });
      } else await route.fallback();
    });
    try {
      await page.goto(new URL('works.html', base).href);
      await page.locator('.library-grid .comet-archive__card[data-project-id="16"]').click();
      await page.locator('.cinema-player[open]').waitFor();
      await page.locator('.cinema-player__version').nth(1).click();
      await page.waitForFunction(() =>
        document.querySelectorAll('.cinema-player__version')[1]?.getAttribute('aria-pressed') === 'true', null, { timeout: 12000 });
      const state = await posterState(page);
      assert(state.ready && state.source.includes('project-covers/'), 'Poster 404 must fall back to decoded cover');
      assert.equal(getSafeMediaReport(page).urls.length, 0);
      assert.deepEqual(errors, []);
      console.log('PASS 390 missing B poster uses ready cover, no black/MP4 traffic');
      checks++;
    } finally { await page.close(); }
  }

  // Late responses must neither override a canceled request nor reopen a
  // dismissed dialog.
  {
    const page = await createSafePage(browser, { viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/\.webp(?:\?|$)/i, async route => {
      if (route.request().resourceType() === 'image' && isPoster(route.request().url(), 'MEXC Member Perks - Version B')) await delay(2200);
      try { await route.fallback(); } catch {}
    });
    try {
      await page.goto(new URL('works.html', base).href);
      await page.locator('.library-grid .comet-archive__card[data-project-id="16"]').click();
      await page.locator('.cinema-player[open]').waitFor();
      await page.locator('.cinema-player__version').nth(1).click();
      await page.waitForTimeout(130);
      await page.locator('.cinema-player__version').first().click();
      await page.waitForTimeout(2350);
      assert.equal(await currentVersion(page), 0, 'Canceled B request replaced active A');
      assert((await posterState(page)).ready);
      await page.locator('.cinema-player__version').nth(1).click();
      await page.waitForFunction(() =>
        document.querySelectorAll('.cinema-player__version')[1]?.getAttribute('aria-pressed') === 'true');
      await page.locator('.cinema-player__close').click();
      await page.locator('.cinema-player').waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
      assert.equal(getSafeMediaReport(page).urls.length, 0);
      console.log('PASS 390 rapid A/B cancel, delayed response ignored, safe close');
      checks++;
    } finally { await page.close(); }
  }

  // A playing local MP4 must pause on the existing decoded frame while the
  // next version is still downloading its WebP poster.
  {
    const page = await createSafePage(browser, { viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/\.webp(?:\?|$)/i, async route => {
      if (route.request().resourceType() === 'image' && isPoster(route.request().url(), 'MEXC Member Perks - Version B')) await delay(2300);
      try { await route.fallback(); } catch {}
    });
    try {
      await page.goto(new URL('works.html', base).href);
      await page.locator('.library-grid .comet-archive__card[data-project-id="16"]').click();
      await page.locator('.cinema-player[open]').waitFor();
      await page.locator('.cinema-player__play').click();
      await page.waitForFunction(() => {
        const video = document.querySelector('.cinema-player video');
        return video?.currentTime > 0 && Boolean(document.querySelector('.cinema-player__poster.is-revealed'));
      }, null, { timeout: 12000 });
      await page.locator('.cinema-player__version').nth(1).click();
      await page.waitForTimeout(200);
      assert.equal(await currentVersion(page), 0, 'Video switched too early');
      assert(await page.locator('.cinema-player video').evaluate(v => v.paused && v.currentTime > 0),
        'Outgoing real MP4 must freeze until the new poster is decoded');
      await page.waitForFunction(() =>
        document.querySelectorAll('.cinema-player__version')[1]?.getAttribute('aria-pressed') === 'true', null, { timeout: 12000 });
      assert((await posterState(page)).ready, 'New version displayed without decoded poster');
      assert.equal(getSafeMediaReport(page).urls.length, 0);
      assert.deepEqual(errors, []);
      console.log('PASS 390 real local MP4 freezes visible frame while version B poster loads');
      checks++;
    } finally { await page.close(); }
  }

  console.log('CINEMA_NO_BLACK_PASS', checks, 'local MP4, mobile and desktop checks');
} finally { await browser.close(); }
