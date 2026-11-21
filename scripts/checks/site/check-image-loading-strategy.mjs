// Cover scheduling contract for Home Featured, All Work, awards and the closed cinema.
// Run without real ImageKit requests: all pages use the shared protected context.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createSafeContext, getSafeMediaReport } from '../../lib/safe-media.mjs';

const browserPath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(browserPath, 'Chrome or Edge required');
const port = 5219;
const base = process.env.PORTFOLIO_URL || `http://127.0.0.1:${port}/`;
let server;
if (!process.env.PORTFOLIO_URL) {
  server = spawn(process.execPath, ['./node_modules/vite/bin/vite.js',
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite server exited');
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) break; }
    catch { /* server is starting */ }
    if (attempt === 79) throw new Error('Cannot reach test server');
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const context = await createSafeContext(browser, { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
// Avoid transferring Hero MP4s while testing image loading and initial priority.
await context.route(/\/assets\/videos\/hero\/.*\.mp4(?:[?#]|$)/i, route => route.abort('blockedbyclient'));
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
  await page.locator('#projects .comet-archive__cover').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(350);
  const initialHome = await page.locator('#projects .comet-archive__cover')
    .evaluateAll(images => images.map(image => ({
      loaded:image.hasAttribute('src'),
      top:image.getBoundingClientRect().top,
    })));
  assert.equal(initialHome.length, 8, 'Mobile Featured displays eight cards in one 2x4 grid');
  // First mobile row must have image URLs at initial React render. Waiting for
  // IntersectionObserver leaves black cards on fast Hero-to-Works navigation.
  assert(initialHome.slice(0,2).every(item => item.loaded),
    'First mobile Featured row must be requested on mount');
  // Additional rows retain the bounded ahead-of-scroll prefetch strategy.
  assert(initialHome.slice(2).every(item => !item.loaded || item.top <= 852 + 520 + 24),
    'Deferred covers must stay within the mobile 520px preload margin');
  assert(await page.locator('#impact-awards .impact-award-grid-card img')
    .evaluateAll(images => images.every(image => !image.hasAttribute('src'))),
  'Distant award thumbnails must not compete with Hero');

  // Scroll through each real 2-card row, not directly to the final row:
  // skipped rows should not preload until the visitor actually approaches.
  for(const first of [0,2,4,6]){
    await page.locator('#projects .comet-archive__cover').nth(first).scrollIntoViewIfNeeded();
    await page.waitForFunction(index => [...document.querySelectorAll('#projects .comet-archive__cover')]
      .slice(index,index+2).every(image => image.complete && image.naturalWidth > 0),
      first,{timeout:10000});
  }
  assert(await page.locator('#projects .comet-archive__cover')
    .evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)),
    'All eight Featured covers must decode once their rows were visited');
  assert.equal(await page.locator('.comet-archive-pagination').count(),0);
  console.log('PASS mobile Featured: all eight covers decode progressively as rows enter the viewport');

  await page.locator('#impact-awards').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('#impact-awards .impact-award-grid-card img')]
    .length === 8 && [...document.querySelectorAll('#impact-awards .impact-award-grid-card img')]
      .every(image => image.complete && image.naturalWidth > 0));
  console.log('PASS award thumbnails: no initial requests, all eight load on approach');

  const works = await context.newPage();
  works.on('pageerror', error => errors.push(error.message));
  try {
    await works.goto(new URL('works.html?category=social', base).href, { waitUntil: 'domcontentloaded' });
    await works.locator('.library-grid .comet-archive__cover').first().waitFor({ state: 'attached' });
    let priorities = await works.locator('.library-grid .comet-archive__cover')
      .evaluateAll(images => images.map(image => [image.loading, image.fetchPriority]));
    assert.deepEqual(priorities.slice(0, 4), [
      ['eager','high'],['eager','high'],['eager','auto'],['eager','auto'],
    ], 'Mobile All Work must load first row high, second row normal');
    const media = await works.locator('link[data-library-cover-category]')
      .evaluateAll(links => links.map(link => [link.dataset.libraryCoverCategory, link.media]));
    assert(media.every(([category, medium]) => category === 'social' ? medium !== 'not all' : medium === 'not all'),
      'Direct category navigation must not preload unrelated categories');
    for (const category of ['short-film', 'visual']) {
      await works.goto(new URL('works.html?category=' + category, base).href, { waitUntil: 'domcontentloaded' });
      await works.locator('.library-grid .comet-archive__cover').first().waitFor({ state: 'attached' });
      await works.waitForFunction(() => [...document.querySelectorAll('.library-grid .comet-archive__cover')]
        .slice(0, 2).every(image => image.complete && image.naturalWidth > 0));
      const links = await works.locator('link[data-library-cover-category]')
        .evaluateAll(els => els.map(el => [el.dataset.libraryCoverCategory, el.media]));
      assert(links.every(([id, medium]) => id === category ? medium !== 'not all' : medium === 'not all'),
        category + ': only current category should prefetch');
    }
    await works.setViewportSize({ width: 1440, height: 900 });
    await works.waitForFunction(() => [...document.querySelectorAll('.library-grid .comet-archive__cover')]
      .slice(0, 4).every(image => image.fetchPriority === 'high'));
    await works.locator('button[data-category="commercial"]').click();
    await works.locator('button[data-category="commercial"][aria-pressed="true"]').waitFor();
    priorities = await works.locator('.library-grid .comet-archive__cover')
      .evaluateAll(images => images.map(image => [image.loading, image.fetchPriority]));
    assert.deepEqual(priorities.slice(0, 8), [
      ...Array.from({ length: 4 }, () => ['eager','high']),
      ...Array.from({ length: 4 }, () => ['eager','auto']),
    ], 'Desktop All Work must use 4 high-priority then 4 normal-priority covers');
    await works.locator('.library-grid .comet-archive__cover').first().waitFor();
    await works.locator('.library-grid .comet-archive__card').first().click();
    await works.locator('.cinema-player[open]').waitFor();
    assert.equal(getSafeMediaReport(context).urls.length, 0, 'ImageKit requests without Play');
    console.log('PASS All Work: direct categories, viewport resize, tab switch, player opened without video');
  } finally { await works.close(); }

  const desktop = await context.newPage();
  try {
    await desktop.setViewportSize({ width: 1440, height: 900 });
    await desktop.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    await desktop.locator('#projects .comet-archive__cover').first().waitFor({ state: 'attached' });
    await desktop.waitForTimeout(350);
    // A bounded 700px look-ahead works on desktop: no unrelated
    // offscreen artwork burst, but cards have time to decode before arrival.
    const initial = await desktop.locator('#projects .comet-archive__cover')
      .evaluateAll(images => images.map(image => {
        const rect = image.getBoundingClientRect();
        return { loaded: image.hasAttribute('src'), top: rect.top, bottom: rect.bottom };
      }));
    assert.equal(initial.length, 8);
    const rootMargin = 700;
    const windowHeight = desktop.viewportSize().height;
    assert(initial.slice(0,4).every(image => image.loaded),
      'Desktop first Featured row must start loading at React mount');
    assert(initial.slice(4).every(image => image.top <= windowHeight + rootMargin || !image.loaded),
      'Desktop other rows must defer beyond the approaching viewport');
    await desktop.locator('#projects .comet-archive__cover').first().scrollIntoViewIfNeeded();
    await desktop.waitForFunction(() => [...document.querySelectorAll('#projects .comet-archive__cover')]
      .slice(0, 4).every(image => image.complete && image.naturalWidth > 0));
    console.log('PASS desktop Featured: far covers deferred, first-row covers decoded on approach');
  } finally { await desktop.close(); }
  // Slow links / Data Saver should keep the immediately visible first row,
  // while later Featured cards wait until the visitor approaches the gallery.
  // No media requests may escape the protected context.
  const slow = await context.newPage();
  slow.on('pageerror', error => errors.push(error.message));
  try {
    await slow.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { effectiveType: '3g', saveData: true },
      });
    });
    await slow.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    await slow.locator('#projects .comet-archive__cover').first().waitFor({ state: 'attached' });
    await slow.waitForTimeout(350);
    const slowFirstPaint = await slow.locator('#projects .comet-archive__cover')
      .evaluateAll(images => images.map(image => image.hasAttribute('src')));
    assert(slowFirstPaint.slice(0, 2).every(Boolean), 'Slow network: first Featured row loads immediately');
    assert(slowFirstPaint.slice(2).every(loaded => !loaded),
      'Slow network: distant Featured rows do not contend with initial Hero requests');
    await slow.locator('#projects .comet-archive__cover').nth(2).scrollIntoViewIfNeeded();
    await slow.waitForFunction(() => [...document.querySelectorAll('#projects .comet-archive__cover')]
      .slice(2, 4).every(image => image.complete && image.naturalWidth > 0));
    console.log('PASS slow/Data Saver homepage: first row immediate, further rows load on approach');
  } finally { await slow.close(); }
  assert.deepEqual(errors, [], 'No page errors');
  console.log('IMAGE_LOADING_STRATEGY_PASS');
} finally {
  await page.close();
  await context.close();
  await browser.close();
  if (server) server.kill('SIGTERM');
}
