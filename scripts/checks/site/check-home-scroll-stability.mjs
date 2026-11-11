// A late Hero video load must never pull readers back to the top.
// Test with production files and real local Hero MP4, while guarding ImageKit.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';

const binary = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(binary, 'Chrome/Edge is required');
const port = 5386;
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:' + port + '/';
let preview;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = await chromium.launch({ executablePath: binary, headless: true });

try {
  if (!process.env.PORTFOLIO_URL) {
    preview = spawn(process.execPath, ['./node_modules/vite/bin/vite.js',
      'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { cwd: process.cwd(), stdio: 'ignore' });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if ((await fetch(base, { signal: AbortSignal.timeout(800) })).ok) {
          ready = true; break;
        }
      } catch {}
      await sleep(140);
    }
    assert(ready, 'Build first with npm run build; production preview must start');
  }

  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, {
      viewport: { width, height: width < 500 ? 844 : 900 },
      isMobile: width < 500, hasTouch: width < 500,
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__scrollAuditEvents = [];
      for (const name of ['load', 'pageshow']) {
        window.addEventListener(name, () =>
          window.__scrollAuditEvents.push({
            name, at: performance.now(), y: scrollY,
          }), { capture: true });
      }
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 120,
      downloadThroughput: 360 * 1024, uploadThroughput: 140 * 1024,
    });
    try {
      await page.goto(new URL('index.html', base).href, {
        waitUntil: 'domcontentloaded', timeout: 18000,
      });
      await page.waitForFunction(() =>
        document.documentElement.scrollHeight > innerHeight * 2);
      assert(await page.evaluate(() => scrollY <= 3),
        'Fresh unanchored visit must begin at Hero');
      const movedAt = await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight * .55);
        return performance.now();
      });
      const scrolled = await page.evaluate(() => scrollY);
      assert(scrolled > 400, 'Audit failed to scroll below Hero');
      await page.waitForFunction(() =>
        window.__scrollAuditEvents.some(entry => entry.name === 'load'),
        null, { timeout: 20000 });
      await sleep(500);
      const lateLoad = await page.evaluate(() => ({
        y: scrollY, events: window.__scrollAuditEvents,
      }));
      assert(lateLoad.events.find(entry => entry.name === 'load').at > movedAt,
        'Network throttling did not delay load until after user scrolling');
      assert(lateLoad.events.some(entry => entry.name === 'pageshow'),
        'Expected the real pageshow event');
      assert(Math.abs(lateLoad.y - scrolled) < 4,
        'Late load/pageshow interrupted reading: ' + JSON.stringify(lateLoad));
      console.log('PASS', width, 'slow MP4 load/pageshow preserve scroll',
        Math.round(scrolled) + 'px');

      // Native browser history should return the reader to the previous spot.
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
      });
      await page.goto(new URL('works.html', base).href, {
        waitUntil: 'domcontentloaded',
      });
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForFunction(() => scrollY > 400, null, { timeout: 7000 });
      const restored = await page.evaluate(() => scrollY);
      assert(Math.abs(restored - scrolled) < 90,
        'Back navigation failed to restore scroll: ' + restored + '/' + scrolled);
      console.log('PASS', width, 'browser Back preserves reading position',
        Math.round(restored) + 'px');

      await page.goto(new URL('index.html#projects', base).href, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(() =>
        location.hash === '#projects' && scrollY > 400,
        null, { timeout: 8000 });
      await sleep(200);
      assert(await page.evaluate(() => scrollY > 400),
        'Deep-link anchor was forced to Hero');
      assert.deepEqual(errors, [], 'Unexpected JavaScript error');
      assert.equal(getSafeMediaReport(page).urls.length, 0,
        'Real ImageKit traffic is forbidden in local tests');
      console.log('PASS', width, 'deep link #projects stays at target; no ImageKit');
    } finally {
      await page.close();
    }
  }
  console.log('HOME_SCROLL_STABILITY_PASS: 6 device/behavior combinations');
} finally {
  await browser.close();
  if (preview) {
    preview.kill('SIGTERM');
    await sleep(200);
  }
}
