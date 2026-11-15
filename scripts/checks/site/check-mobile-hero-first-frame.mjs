// Mobile Safari failure-mode regression using a local browser: never requests ImageKit.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';

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
    await page.route(/\/assets\/videos\/hero\/hero(?:-mobile)?(?:-[a-z0-9_-]+)?\.mp4(?:[?#].*)?$/i, route => route.abort('blockedbyclient'));
    await page.goto(new URL('index.html', base).href, { waitUntil: 'load' });
    await page.waitForTimeout(800); // includes the existing loader fade-out transition
    const state = await page.evaluate(() => {
      const bg = document.getElementById('video-bg');
      const video = document.getElementById('hero-video');
      return {
        poster: video.poster,
        backgroundImage: getComputedStyle(bg).backgroundImage,
        stillImage: getComputedStyle(document.getElementById('hero-first-frame')).backgroundImage,
        stillOpacity: getComputedStyle(document.getElementById('hero-first-frame')).opacity,
        preload: video.preload,
        readyState: video.readyState,
        prematureWebgl: bg.classList.contains('is-webgl-ready'),
        loader: getComputedStyle(document.getElementById('loading')).visibility,
      };
    });
    // Accept both fingerprinted production assets and local .webp?t= revisions.
    const target = width === 390 ? 'hero-first-frame-mobile' : 'hero-first-frame-desktop';
    const imageFile = new RegExp(target + '(?:-[A-Za-z0-9]+)?\\.webp(?:[?#]|[\"\\x27)]|$)');
    assert(imageFile.test(state.backgroundImage), 'Missing '+width+'px fallback image: '+state.backgroundImage);
    assert.equal(state.poster, '', 'Native poster must be absent; CSS first-frame is the only source');
    assert.equal(state.preload, 'auto', 'Mobile and desktop must preload Hero from first paint');
    assert(state.stillImage.includes(target), 'First-frame foreground fallback missing');
    assert.equal(state.stillOpacity, '1', 'Still must cover pending media and WebGL');
    assert.equal(state.prematureWebgl, false, 'No WebGL renderer should initialize while the native video loads');
    assert.equal(state.loader, 'hidden', 'Loader never exited when media failed');
    const imageUrl = state.stillImage.match(/url\(["']?(.+?)["']?\)/)?.[1];
    assert(imageUrl, 'CSS first-frame URL missing for '+width+'px');
    const stillResponse = await page.request.get(imageUrl);
    assert.equal(stillResponse.status(), 200, 'Vite first-frame asset missing in production');
    assert.match(stillResponse.headers()['content-type'] ?? '', /image\/webp/);
    assert.deepEqual(failures, []);
    // Cursor blink is a compositor CSS animation, not a permanent GSAP tween.
    // The offscreen Hero must not keep an infinite JS ticker awake.
    const cursor = await page.locator('#hero-title .text-type__cursor').evaluate(el => ({
      name: getComputedStyle(el).animationName,
      duration: getComputedStyle(el).animationDuration,
      gsapTweens: window.gsap?.getTweensOf(el)?.length ?? 0,
    }));
    assert.equal(cursor.name, 'text-type-cursor-blink');
    assert.equal(cursor.duration, '0.5s');
    assert.equal(cursor.gsapTweens, 0, 'Hero cursor must not own an infinite GSAP tween');
    await page.evaluate(() => scrollTo({top:Math.max(0,document.querySelector('#recognition').offsetTop),behavior:'instant'}));
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#hero-title .text-type__cursor').evaluate(
      el => getComputedStyle(el).animationPlayState), 'paused',
    'Offscreen Hero cursor animation should be paused');
    const completeRole = await page.locator('#hero-title .text-type__content').textContent();
    await page.waitForTimeout(2200);
    assert.equal(await page.locator('#hero-title .text-type__content').textContent(), completeRole,
      'Offscreen Hero must not keep rerendering the typewriter');
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
  if (state.gl) {
    await page.waitForTimeout(460);
    const opacity = await page.locator('#hero-first-frame').evaluate(el => Number(getComputedStyle(el).opacity));
    assert(opacity < .06, 'Hero static still must fade after WebGL is ready');
  }
  console.log(`PASS local mobile MP4 decode: readyState=${state.ready}, WebGL=${state.gl}`);
  await page.close();
} finally {
  await browser.close();
}
