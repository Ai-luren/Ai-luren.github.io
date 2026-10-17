/**
 * Step 01 regression: the Platform Creator content must never disappear
 * between the mobile and desktop CSS breakpoints.
 *
 * Run: npm run check:impact-platform
 * Or test a production preview:
 *   PORTFOLIO_URL=http://127.0.0.1:5181/ npm run check:impact-platform
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const host = '127.0.0.1';
const port = 5207;
const suppliedBase = process.env.PORTFOLIO_URL;
const base = suppliedBase || `http://${host}:${port}/`;
const browserPath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(browserPath, 'Edge/Chrome is required for responsive browser checks');

const WIDTHS = [320, 360, 390, 430, 500, 501, 600, 720, 721, 760, 761, 820, 1024, 1440, 1920];
const LANGS = ['zh', 'en'];
let server;

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    if (server && server.exitCode !== null) throw new Error('Vite exited before readiness');
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch { /* Server is starting */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Dev server did not start at ${base}`);
}

try {
  if (!suppliedBase) {
    server = spawn(process.execPath, ['./node_modules/vite/bin/vite.js',
      '--host', host, '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    await waitForServer();
  }

  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    for (const width of WIDTHS) {
      for (const lang of LANGS) {
        const page = await browser.newPage({ viewport: { width, height: 850 } });
        try {
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.addInitScript(language => {
            localStorage.setItem('ailuren-lang', language);
          }, lang);
          await page.goto(new URL('index.html#impact-programs', base).href, {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });
          await page.locator('#impact-programs .impact-logo-shell').waitFor({ state: 'attached' });
          await page.locator('#impact-programs').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));

          const state = await page.evaluate(() => {
            const root = document.querySelector('#impact-programs .impact-logo-shell');
            const mobile = root?.querySelector('.impact-platform-mobile-card');
            const desktop = root?.querySelector('.impact-platform-desktop-card');
            const visible = el => {
              if (!el) return false;
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' &&
                rect.width > 0 && rect.height > 0;
            };
            const rootRect = root?.getBoundingClientRect();
            const shown = visible(mobile) ? mobile : visible(desktop) ? desktop : null;
            const tiles = shown?.querySelectorAll('.impact-platform-mobile-tile, .impact-platform-desktop-tile') || [];
            const images = [...tiles].map(el => el.querySelector('img'));
            return {
              visibleMobile: visible(mobile),
              visibleDesktop: visible(desktop),
              panelHeight: Math.round(rootRect?.height || 0),
              title: document.querySelector('#impact-programs-heading')?.textContent?.trim(),
              shownTiles: tiles.length,
              imageSources: images.filter(img => img?.getAttribute('src')).length,
              pageWidth: document.documentElement.scrollWidth,
              viewport: innerWidth,
              clipped: [...tiles].filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.left < rootRect.left - 2 || rect.right > rootRect.right + 2;
              }).length,
            };
          });
          const tag = `${width}px ${lang}`;
          const expectedMobile = width <= 760;
          assert.equal(state.visibleMobile, expectedMobile, `${tag}: mobile platform visibility; ${JSON.stringify(state)}`);
          assert.equal(state.visibleDesktop, !expectedMobile, `${tag}: desktop platform visibility; ${JSON.stringify(state)}`);
          assert(state.panelHeight >= 200, `${tag}: platform card collapsed to ${state.panelHeight}px`);
          assert.equal(state.shownTiles, 8, `${tag}: platform identities are not all present`);
          assert.equal(state.imageSources, 8, `${tag}: platform logos are missing`);
          assert.equal(state.clipped, 0, `${tag}: platform tiles extend beyond the glass panel`);
          assert(state.pageWidth <= width + 2, `${tag}: document overflows horizontally (${state.pageWidth}px)`);
          assert.equal(errors.length, 0, `${tag}: JavaScript errors: ${errors.join(' | ')}`);
          console.log(`PASS ${tag}: ${expectedMobile ? 'mobile' : 'desktop'} card, 8 identities, ${state.panelHeight}px tall`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log('PASS: Platform Creator breakpoints (home page / zh+en / 320–1920px)');
} finally {
  if (server) {
    server.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
