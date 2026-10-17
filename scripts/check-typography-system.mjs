/**
 * Step 02: verify that section headings and reading hierarchy remain coherent
 * on the home page and the works library in Chinese and English.
 *
 * PORTFOLIO_URL=http://127.0.0.1:5181/ npm run check:typography
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const port = 5212;
const suppliedBase = process.env.PORTFOLIO_URL;
const base = suppliedBase || `http://127.0.0.1:${port}/`;
const executable = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executable, 'Edge or Chrome is required');
const widths = [320, 360, 390, 430, 500, 760, 761, 820, 1024, 1280, 1440, 1920];
let devServer;

async function ready() {
  for (let i = 0; i < 100; i++) {
    if (devServer?.exitCode != null) throw new Error('Vite exited while starting');
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Unable to reach ${base}`);
}

try {
  if (!suppliedBase) {
    devServer = spawn(process.execPath, [
      './node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
      '--port', String(port), '--strictPort',
    ], { cwd: process.cwd(), stdio: 'ignore' });
    await ready();
  }
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    for (const width of widths) for (const lang of ['zh','en']) {
      const home = await browser.newPage({ viewport: { width, height: 900 } });
      const works = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        const errors = [];
        home.on('pageerror', e => errors.push(`home ${e.message}`));
        works.on('pageerror', e => errors.push(`works ${e.message}`));
        await Promise.all([home, works].map(p => p.addInitScript(language => localStorage.setItem('ailuren-lang', language), lang)));
        await home.goto(new URL('index.html#impact-programs', base).href, { waitUntil: 'domcontentloaded' });
        await works.goto(new URL('works.html', base).href, { waitUntil: 'domcontentloaded' });
        await home.locator('#impact-programs .impact-logo-shell').waitFor({ state: 'attached' });
        await works.locator('.library-grid .comet-archive__card').first().waitFor({ state: 'attached' });

        const homeStyle = await home.evaluate(() => {
          const el = s => document.querySelector(s);
          const metric = s => {
            const element = el(s);
            if (!element) return null;
            const computed = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return { size: parseFloat(computed.fontSize), line: parseFloat(computed.lineHeight),
              family: computed.fontFamily, weight: parseInt(computed.fontWeight),
              width: box.width, height: box.height, clipped: element.scrollWidth > element.clientWidth + 2 };
          };
          return {
            section: metric('#recognition .section-title'),
            projects: metric('#projects .section-title'),
            lab: metric('#experiments .section-title'),
            awardBody: metric('#impact-awards .impact-award-description'),
            platformMeta: metric('#impact-programs .impact-platform-mobile-meta'),
            platformIntro: metric('#impact-programs .impact-platform-mobile-manifesto p'),
            platformSignature: metric('#impact-programs .impact-platform-mobile-signature'),
            platformHead: metric('#impact-programs .impact-platform-mobile-network-head'),
            platformTitle: metric('#impact-programs .impact-platform-mobile-tile strong'),
            platformRole: metric('#impact-programs .impact-platform-mobile-tile span'),
            pageWidth: document.documentElement.scrollWidth,
          };
        });
        const libraryStyle = await works.evaluate(() => {
          const get = s => {
            const element = document.querySelector(s);
            if (!element) return null;
            const css = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return { size: parseFloat(css.fontSize), family: css.fontFamily,
              weight: parseInt(css.fontWeight), width: rect.width, height: rect.height,
              clipped: element.scrollWidth > element.clientWidth + 2 };
          };
          return { heading: get('.library-intro .page-title'),
            intro: get('.library-intro > p:last-child'),
            project: get('.library-grid .comet-archive__title'),
            detail: get('.library-grid .comet-archive__details strong'),
            pageWidth: document.documentElement.scrollWidth };
        });
        const tag = `${width}px ${lang}`;
        assert(Math.abs(homeStyle.section.size - libraryStyle.heading.size) < 1,
          `${tag}: home & works page heading sizes differ (${homeStyle.section.size} vs ${libraryStyle.heading.size})`);
        assert.equal(homeStyle.section.family, libraryStyle.heading.family, `${tag}: heading families differ`);
        assert.equal(homeStyle.section.weight, libraryStyle.heading.weight, `${tag}: heading weights differ`);
        assert(homeStyle.lab.size < homeStyle.projects.size, 'AI Lab must be a subordinate heading');
        if (width === 760) assert(homeStyle.section.size <= 42,
          `${tag}: heading jumps too high just before desktop boundary`);
        if (width === 761) assert(homeStyle.section.size >= 39,
          `${tag}: desktop heading drops too low just after mobile boundary`);
        assert(homeStyle.awardBody.size >= (width <= 760 ? 12 : 13), `${tag}: award body is too small`);
        if (width <= 760) {
          for (const [label, minimum] of [['platformMeta', 10], ['platformIntro', 12],
            ['platformSignature', 10], ['platformHead', 10],
            ['platformTitle', 12], ['platformRole', 11]]) {
            const value = homeStyle[label];
            assert(value && value.size >= minimum, `${tag}: ${label} only ${value?.size}px`);
            assert(!value.clipped, `${tag}: ${label} is horizontally clipped`);
          }
        }
        assert(libraryStyle.intro.size >= (width <= 760 ? 13 : 14), `${tag}: library intro too small`);
        assert(homeStyle.pageWidth <= width + 2 && libraryStyle.pageWidth <= width + 2,
          `${tag}: body overflow (${homeStyle.pageWidth} / ${libraryStyle.pageWidth})`);
        assert.deepEqual(errors, [], `${tag}: page errors`);
        console.log(`PASS ${tag}: heading ${homeStyle.section.size}px / award ${homeStyle.awardBody.size}px / library intro ${libraryStyle.intro.size}px`);
      } finally {
        await home.close();
        await works.close();
      }
    }
  } finally { await browser.close(); }
  console.log('PASS: Step 02 typography across 12 widths, 2 languages and 2 pages');
} finally {
  if (devServer) {
    devServer.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
