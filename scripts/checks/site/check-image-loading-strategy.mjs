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
    .evaluateAll(images => images.map(image => image.hasAttribute('src')));
  assert.equal(initialHome.length, 4, 'Mobile Featured first page must render four cards');
  assert.deepEqual(initialHome, [true, true, false, false],
    'Only the near first row should request imagery on first mobile Hero load');
  assert(await page.locator('#impact-awards .impact-award-grid-card img')
    .evaluateAll(images => images.every(image => !image.hasAttribute('src'))),
  'Distant award thumbnails must not compete with Hero');

  await page.locator('#projects').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('#projects .comet-archive__cover')]
    .every(image => image.complete && image.naturalWidth > 0));
  await page.locator('.comet-archive-pagination button').nth(1).click();
  await page.waitForFunction(() => {
    const button = document.querySelectorAll('.comet-archive-pagination button')[1];
    const images = [...document.querySelectorAll('#projects .comet-archive__cover')];
    return button?.getAttribute('aria-selected') === 'true'
      && images.length === 4 && images.every(image => image.complete && image.naturalWidth > 0);
  });
  console.log('PASS mobile Featured: near-row loading and decoded second-page navigation');

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
    const firstPass = await desktop.locator('#projects .comet-archive__cover')
      .evaluateAll(images => images.map(image => image.hasAttribute('src')));
    assert.equal(firstPass.length, 8);
    assert.deepEqual(firstPass, [true,true,true,true,false,false,false,false],
      'Desktop Featured second row must not load before approaching it');
    console.log('PASS desktop Featured: four covers, next row deferred');
  } finally { await desktop.close(); }
  assert.deepEqual(errors, [], 'No page errors');
  console.log('IMAGE_LOADING_STRATEGY_PASS');
} finally {
  await page.close();
  await context.close();
  await browser.close();
  if (server) server.kill('SIGTERM');
}
