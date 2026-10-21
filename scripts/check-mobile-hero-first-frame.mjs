// Mobile Safari failure-mode regression using a local browser: never requests ImageKit.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
if (!executablePath) throw new Error('A Chromium browser is required for the smoke test');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, {
      viewport: { width, height: 844 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    // Simulates cellular media load delays without downloading Hero MP4.
    await page.route(/\/assets\/hero(?:-mobile)?-[^/]+\.mp4$/, route => route.abort('blockedbyclient'));
    await page.goto(new URL('index.html', base).href, { waitUntil: 'load' });
    await page.waitForTimeout(800); // includes the existing loader fade-out transition
    const state = await page.evaluate(() => {
      const bg = document.getElementById('video-bg');
      const video = document.getElementById('hero-video');
      return {
        poster: video.poster,
        backgroundImage: getComputedStyle(bg).backgroundImage,
        preload: video.preload,
        readyState: video.readyState,
        prematureWebgl: bg.classList.contains('is-webgl-ready'),
        loader: getComputedStyle(document.getElementById('loading')).visibility,
      };
    });
    const target = width === 390 ? 'hero-first-frame-mobile-' : 'hero-first-frame-desktop-';
    assert(state.backgroundImage.includes(target), `Missing ${width}px fallback image: ${state.backgroundImage}`);
    assert(state.poster.includes('hero-first-frame-mobile-'), 'No media element poster');
    assert.equal(state.preload, width === 390 ? 'auto' : 'metadata');
    assert.equal(state.prematureWebgl, false, 'Black WebGL canvas may be exposed before video decode');
    assert.equal(state.loader, 'hidden', 'Loader never exited when media failed');
    const posterResponse = await page.request.get(state.poster);
    assert.equal(posterResponse.status(), 200);
    assert.match(posterResponse.headers()['content-type'] ?? '', /image\/webp/);
    assert.deepEqual(failures, []);
    const report = getSafeMediaReport(page);
    assert.equal(report.fulfilled + report.blocked, 0, 'Unexpected ImageKit request');
    console.log(`PASS ${width}px: fallback poster available, ${state.preload} preload, no black WebGL/loader deadlock`);
    await page.close();
  }

  // Real Hero media is local to the preview; verifies transition without CDN.
  const page = await createSafePage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('index.html', base).href, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#hero-video')?.readyState >= 2, { timeout: 15000 });
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const bg = document.getElementById('video-bg');
    const v = document.getElementById('hero-video');
    return { ready: v.readyState, duration: v.duration, preload: v.preload, gl: bg.classList.contains('is-webgl-ready') };
  });
  assert(state.ready >= 2 && state.duration > 0);
  assert.equal(state.preload, 'auto');
  assert.deepEqual(errors, []);
  console.log(`PASS local mobile MP4 decode: readyState=${state.ready}, WebGL=${state.gl}`);
  await page.close();
} finally {
  await browser.close();
}
