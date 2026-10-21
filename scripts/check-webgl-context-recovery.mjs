// WebGL loss / restore regression. Hero media is local; ImageKit is guarded.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
if (!executablePath) throw new Error('Edge or Chrome is required');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, {
      viewport: { width, height: 844 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('video-bg')?.classList.contains('is-webgl-ready'), { timeout: 20000 });

    const support = await page.evaluate(() => {
      const canvas = document.querySelector('#video-webgl');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      const ext = gl?.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      window.__testHeroGL = { canvas, gl, ext };
      return true;
    });
    assert(support, 'WEBGL_lose_context is required for the recovery test');

    await page.evaluate(() => window.__testHeroGL.ext.loseContext());
    await page.waitForFunction(() => !document.getElementById('video-bg').classList.contains('is-webgl-ready'));
    await page.waitForTimeout(380); // CSS opacity transition
    const lost = await page.evaluate(() => {
      const video = document.getElementById('hero-video');
      const bg = document.getElementById('video-bg');
      return {
        nativeOpacity: Number(getComputedStyle(video).opacity),
        webglOpacity: Number(getComputedStyle(window.__testHeroGL.canvas).opacity),
        fallbackImage: getComputedStyle(bg).backgroundImage,
        source: video.currentSrc,
        isLost: window.__testHeroGL.gl.isContextLost(),
      };
    });
    assert.equal(lost.isLost, true);
    assert.equal(lost.nativeOpacity, 1, 'Native fallback video must be visible on GPU loss');
    assert.equal(lost.webglOpacity, 0, 'Lost WebGL canvas must be hidden');
    assert(lost.fallbackImage.includes('hero-first-frame-'), 'First-frame still missing from GPU fallback');

    // Recover the original context; React must rebuild every GPU resource and
    // only expose the new renderer after it draws a decoded video frame.
    await page.evaluate(() => window.__testHeroGL.ext.restoreContext());
    await page.waitForFunction(() => {
      const current = document.querySelector('#video-webgl');
      return current && current !== window.__testHeroGL.canvas
        && document.getElementById('video-bg').classList.contains('is-webgl-ready');
    }, { timeout: 20000 });
    const restored = await page.evaluate(() => ({
      nativeVideoReady: document.getElementById('hero-video').readyState,
      newCanvas: document.querySelector('#video-webgl') !== window.__testHeroGL.canvas,
      contextLost: (document.querySelector('#video-webgl').getContext('webgl2')
        || document.querySelector('#video-webgl').getContext('webgl')).isContextLost(),
      source: document.getElementById('hero-video').currentSrc,
    }));
    assert(restored.nativeVideoReady >= 2);
    assert(restored.newCanvas && !restored.contextLost, 'WebGL must be reinitialized with a live context');
    assert.equal(restored.source, lost.source, 'GPU recovery should not re-fetch or swap the media source');
    assert.deepEqual(errors, []);
    assert.equal(getSafeMediaReport(page).urls.length, 0, 'Unexpected ImageKit access');
    console.log(`PASS ${width}px: GPU loss reveals native video + poster; restore rebuilds WebGL; no CDN requests`);
    await page.close();
  }
} finally {
  await browser.close();
}
