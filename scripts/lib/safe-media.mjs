// All Playwright browser tests must use these helpers.
// No request to ImageKit is allowed to reach the network in regular tests.
// Media playback is fulfilled with tiny, locally generated MP4 fixtures.
import { fileURLToPath } from 'node:url';

const IMAGEKIT_URL = /^https?:\/\/(?:[a-z0-9-]+\.)*imagekit\.io(?:[/?#:]|$)/i;
const LANDSCAPE = fileURLToPath(new URL('../fixtures/test-landscape.mp4', import.meta.url));
const PORTRAIT = fileURLToPath(new URL('../fixtures/test-portrait.mp4', import.meta.url));

// Project IDs 04, 05, 11, 12, 13 use portrait videos in src/data/projects.js.
// Update this mapping when new portrait videos are added to the portfolio.
const PORTRAIT_FILES = new Set([
  'chagee-commercial.mp4',
  'a-day-with-cat.mp4',
  'ugc-earbuds-ad.mp4',
  'seat-cushion-ad.mp4',
  'pet-red-light-therapy.mp4',
]);
const reports = new WeakMap();

export async function protectImageKit(target) {
  const report = { fulfilled: 0, blocked: 0, urls: [] };
  reports.set(target, report);
  await target.route(IMAGEKIT_URL, async route => {
    const url = route.request().url();
    report.urls.push(url);
    let path;
    try {
      path = new URL(url).pathname;
    } catch {
      report.blocked++;
      await route.abort('blockedbyclient');
      return;
    }
    if (!path.toLowerCase().endsWith('.mp4')) {
      report.blocked++;
      await route.abort('blockedbyclient');
      return;
    }
    const name = decodeURIComponent(path.split('/').at(-1));
    const fixture = PORTRAIT_FILES.has(name) ? PORTRAIT : LANDSCAPE;
    report.fulfilled++;
    await route.fulfill({
      status: 200,
      path: fixture,
      contentType: 'video/mp4',
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
        'accept-ranges': 'bytes',
      },
    });
  });
  return report;
}

export async function createSafePage(browser, options) {
  const page = await browser.newPage(options);
  await protectImageKit(page); // Install before goto(), click() or any media loading.
  return page;
}

export async function createSafeContext(browser, options) {
  const context = await browser.newContext(options);
  await protectImageKit(context); // Covers every page created by this context.
  return context;
}

export function getSafeMediaReport(target) {
  const report = reports.get(target);
  if (!report) throw new Error('ImageKit test guard is not installed.');
  return { fulfilled: report.fulfilled, blocked: report.blocked, urls: [...report.urls] };
}
