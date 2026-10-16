// Run against a Vite production preview to catch extracted CSS order regressions.
// PORTFOLIO_URL=http://127.0.0.1:5182/ REVIEW_SCREENSHOTS=/outside/repo node scripts/capture-final-review.mjs
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5182/';
const out = process.env.REVIEW_SCREENSHOTS;
assert(out, 'Set REVIEW_SCREENSHOTS to a directory outside the Git repository.');
mkdirSync(out, { recursive: true });
const destination = realpathSync(out);
const fromRepo = relative(realpathSync(process.cwd()), destination);
assert(fromRepo.startsWith(`..${sep}`) || fromRepo === '..', 'Screenshots must remain outside the repository.');
const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(executablePath, 'An installed Chromium browser is required.');
const browser = await chromium.launch({ executablePath, headless: true });
const report = { base, capturedAt: new Date().toISOString(), pages: [], failures: [] };
let mediaRequests = 0;

async function settle(page) {
  // GSAP reveals use opacity/transforms; wait at the actual scroll position.
  await page.waitForTimeout(750);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function scrollTo(page, top) {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top);
  await settle(page);
}
async function decodeMedia(page) {
  return page.evaluate(async () => {
    const seen = new Map();
    const tasks = [];
    const decode = async (image, src, type) => {
      if (!src || seen.has(src)) return;
      seen.set(src, true);
      const result = { src, type };
      try {
        await Promise.race([image.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('decode timeout')), 12000))]);
        Object.assign(result, { ok: image.complete && image.naturalWidth > 0, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight });
      } catch (error) { Object.assign(result, { ok: false, error: String(error), complete: image.complete, width: image.naturalWidth }); }
      return result;
    };
    for (const img of document.images) {
      const r = img.getBoundingClientRect();
      if (r.width && r.height && img.currentSrc) tasks.push(decode(img, img.currentSrc, 'img'));
    }
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      for (const pseudo of [null, '::before', '::after']) {
        const css = getComputedStyle(el, pseudo).backgroundImage;
        for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const img = new Image(); img.src = new URL(match[1], location.href).href;
          tasks.push(decode(img, img.src, pseudo ? `background${pseudo}` : 'background'));
        }
      }
    }
    return (await Promise.all(tasks)).filter(Boolean);
  });
}
async function ready(page, selector) {
  await page.waitForSelector(selector, { state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'));
}
async function walk(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.round(page.viewportSize().height * .72);
  for (let y = 0; y < height; y += step) await scrollTo(page, y);
  return decodeMedia(page);
}
async function heroState(page) {
  await page.waitForFunction(() => { const v = document.getElementById('hero-video'); return v?.readyState >= 2 && !v.seeking; }, undefined, { timeout: 20000 });
  await page.waitForFunction(() => { const c = document.getElementById('video-webgl'); return !c || getComputedStyle(c).opacity === '1'; });
  await settle(page);
  return page.evaluate(() => {
    const v = document.getElementById('hero-video'), c = document.getElementById('video-webgl');
    const sample = document.createElement('canvas'); sample.width = sample.height = 32;
    const ctx = sample.getContext('2d'); ctx.drawImage(v, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let light = 0; for (let i = 0; i < data.length; i += 4) light += Math.max(data[i], data[i + 1], data[i + 2]);
    return { src: v.currentSrc, readyState: v.readyState, time: v.currentTime, seeking: v.seeking, size: [v.videoWidth, v.videoHeight], sourceMeanMaxChannel: light / 1024, webgl: c ? { size: [c.width, c.height], opacity: getComputedStyle(c).opacity, ready: c.parentElement.classList.contains('is-webgl-ready'), contextLost: (c.getContext('webgl2') || c.getContext('webgl'))?.isContextLost() ?? null } : null };
  });
}
async function platformState(page) {
  return page.evaluate(() => {
    const size = s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return { display: getComputedStyle(e).display, width: r.width, height: r.height }; };
    const desktop = innerWidth >= 761;
    return { desktop, shell: size('.impact-logo-shell'), card: size(desktop ? '.impact-platform-desktop-card' : '.impact-platform-mobile-card'), grid: size(desktop ? '.impact-platform-desktop-grid' : '.impact-platform-mobile-grid'), loop: document.querySelector('.logo-loop') ? size('.logo-loop') : null, logos: [...document.querySelectorAll(desktop ? '.impact-platform-desktop-grid img' : '.impact-platform-mobile-grid img')].map(i => ({ src: i.currentSrc, complete: i.complete, width: i.naturalWidth })) };
  });
}
async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: resolve(destination, `${name}.png`), fullPage });
}
async function section(page, id, name, record) {
  const y = await page.locator(id).evaluate(e => scrollY + e.getBoundingClientRect().top - 106);
  await scrollTo(page, y);
  const assets = await decodeMedia(page);
  assert(assets.every(a => a.ok), `Undecoded section assets: ${name}`);
  await settle(page);
  await shot(page, name);
  record.sections.push({ name, assets });
}
async function capture(path, width, height, lang) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const home = path === 'index.html';
  const name = `${home ? 'home' : 'works'}-${lang}-${width}`;
  const record = { name, viewport: { width, height }, console: [], pageErrors: [], requestFailed: [], httpErrors: [], imageResponses: [], sections: [] };
  report.pages.push(record);
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) record.console.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', e => record.pageErrors.push(e.message));
  page.on('requestfailed', r => record.requestFailed.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', r => {
    if (r.status() >= 400) record.httpErrors.push({ url: r.url(), status: r.status() });
    if (r.request().resourceType() === 'image') record.imageResponses.push({ url: r.url(), status: r.status(), contentType: r.headers()['content-type'] });
  });
  await page.route('https://ik.imagekit.io/**', route => { mediaRequests++; return route.abort('blockedbyclient'); });
  await page.addInitScript(lang => localStorage.setItem('ailuren-lang', lang), lang);
  try {
    await page.goto(new URL(path, base).href, { waitUntil: 'domcontentloaded' });
    await ready(page, home ? '.impact-logo-shell' : '.library-grid .comet-archive__card');
    record.assets = await walk(page);
    assert(record.assets.every(a => a.ok), `Undecoded media: ${name}`);
    await scrollTo(page, 0);
    if (home) {
      record.hero = await heroState(page);
      await shot(page, `${name}-hero-stable`);
    }
    record.dom = await page.evaluate(() => ({ lang: document.documentElement.lang, title: document.title, overflow: document.documentElement.scrollWidth > innerWidth + 1, cards: document.querySelectorAll('.comet-archive__card').length, awardHeading: document.querySelector('#impact-awards-heading')?.textContent }));
    assert(record.dom.lang === lang || record.dom.lang.startsWith(`${lang}-`));
    assert(!record.dom.overflow, `${name}: horizontal page overflow`);
    if (home) assert.equal(record.dom.awardHeading, lang === 'en' ? 'AI Awards & Recognition' : 'AI 获奖荣誉');
    if (!home) assert.equal(record.dom.cards, 15);
    await shot(page, `${name}-full`, true);
    if (home) {
      await section(page, '#projects', `${name}-selected-work`, record);
      await section(page, '#impact-programs', `${name}-platforms`, record);
      record.platform = await platformState(page);
      {
        assert.equal(record.platform.card.display, 'block');
        assert(record.platform.shell.height > 200 && record.platform.grid.height > 100, 'Platform grid collapsed');
        assert.equal(record.platform.logos.length, 8);
        assert(record.platform.logos.every(i => i.complete && i.width > 0));
      }
      await section(page, '#impact-awards', `${name}-awards`, record);
      await section(page, '#impact-reach', `${name}-media`, record);
      if (lang === 'zh') {
        await scrollTo(page, await page.locator('#impact-awards').evaluate(e => scrollY + e.getBoundingClientRect().top - 106));
        await page.locator('.impact-award-card').first().click();
        await page.waitForSelector('#impact-award-lightbox');
        const media = await decodeMedia(page); assert(media.every(a => a.ok));
        await settle(page); await shot(page, `${name}-award-viewer`);
        record.awardViewerAssets = media;
        await page.keyboard.press('Escape');
      }
    } else {
      await section(page, '.library-grid', `${name}-grid-viewport`, record);
      if (lang === 'zh') for (const [index, format] of [[0, 'landscape'], [3, 'portrait']]) {
        await page.locator('.library-grid .comet-archive__card').nth(index).click();
        await page.waitForSelector('.cinema-player[open]');
        await page.waitForFunction(format => document.querySelector('.cinema-player')?.dataset.format === format, format);
        const assets = await decodeMedia(page); assert(assets.every(a => a.ok));
        await settle(page);
        const state = await page.locator('.cinema-player video').evaluate(v => ({ paused: v.paused, time: v.currentTime, hasSrc: v.hasAttribute('src'), preload: v.preload }));
        assert(state.paused && state.time === 0 && !state.hasSrc && state.preload === 'none');
        record[format] = { state, assets };
        await shot(page, `${name}-player-${format}`);
        await page.keyboard.press('Escape');
      }
    }
    assert.equal(record.pageErrors.length, 0, `${name}: pageerror`);
    assert.equal(record.httpErrors.length, 0, `${name}: HTTP errors`);
    // Hero warmup and navigation may intentionally abort old media requests.
    record.unexpectedFailures = record.requestFailed.filter(r => !r.error.includes('ERR_ABORTED'));
    assert.equal(record.unexpectedFailures.length, 0, `${name}: request failure`);
    console.log(`PASS ${name}: decoded media, screenshots, DOM and network verified`);
  } finally { await page.close(); }
}
try {
  const languages = ['zh', 'en'];
  for (const [w,h] of [[1440,900],[390,844]]) for (const lang of languages) {
    for (const path of ['index.html','works.html']) {
      try { await capture(path,w,h,lang); } catch(error) { report.failures.push(String(error)); console.error(error); }
    }
  }
  assert.equal(mediaRequests, 0, 'Screenshot run must never request ImageKit videos.');
} finally {
  report.imagekitVideoRequests = mediaRequests;
  writeFileSync(resolve(destination, 'browser-verification.json'), JSON.stringify(report,null,2));
  await browser.close();
}
assert.deepEqual(report.failures, [], 'See browser-verification.json for capture failures.');
console.log(`Saved verified screenshots and DOM/network logs to ${destination}`);
