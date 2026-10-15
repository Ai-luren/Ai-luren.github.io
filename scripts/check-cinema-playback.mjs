import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
try {
  for (const width of [1440, 393]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(new URL('works.html', base).href);
    const cards = page.locator('.library-grid .comet-archive__card');
    for (const index of [0, 1, 0]) {
      await cards.nth(index).click();
      const video = page.locator('.cinema-player video');
      assert.deepEqual(await video.evaluate(v => [v.paused, v.currentTime, v.autoplay, v.muted, v.controls]), [true, 0, false, false, true]);
      assert.deepEqual(await video.evaluate(v => [v.hasAttribute('src'), v.readyState, v.preload]), [false, 0, 'none']);
      assert(await page.locator('.cinema-player__poster').isVisible());
      await page.locator('.cinema-player__play').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.cinema-player video')?.readyState >= 1);
      await page.waitForFunction(() => { const v = document.querySelector('.cinema-player video'); return !v.paused && v.currentTime > 0; });
      assert.equal(await video.evaluate(v => !v.muted && v.volume > 0), true);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.cinema-player__poster')).opacity === '0');
      await video.evaluate(v => v.pause());
      assert(await video.evaluate(v => v.paused));
      await page.locator('.cinema-player__play').click();
      await page.waitForFunction(() => !document.querySelector('.cinema-player video').paused);
      // Hold the media reference to verify the detached player stops on close.
      await video.evaluate(v => window.closedTestVideo = v);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.cinema-player', { state: 'detached' });
      assert(await page.evaluate(() => window.closedTestVideo.paused));
    }
    await cards.first().click();
    const video = page.locator('.cinema-player video');
    await page.locator('.cinema-player__play').click();
    await page.waitForFunction(() => !document.querySelector('.cinema-player video').paused);
    await page.waitForFunction(() => document.querySelector('.cinema-player__stage')?.dataset.playbackState === 'playing');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert(await video.evaluate(v => v.paused));
    await page.evaluate(() => { delete document.hidden; });
    await page.locator('.cinema-player__play').waitFor({ state: 'visible' });
    assert(await video.evaluate(v => v.paused));
    // Simulate a browser rejecting the user-initiated play request.
    await video.evaluate(v => { v.play = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError')); });
    await page.locator('.cinema-player__play').click();
    await page.waitForFunction(() => /播放未能开始|Playback was blocked/.test(document.querySelector('.cinema-player__start').textContent));
    assert(await page.locator('.cinema-player__play').isVisible());
    await page.locator('.cinema-player__close').click();
    console.log(`${width}px: paused open, poster, keyboard play, sound enabled, pause, reopen/switch, ESC, background pause and rejected-play recovery passed`);
    await page.close();
  }
} finally { await browser.close(); }
