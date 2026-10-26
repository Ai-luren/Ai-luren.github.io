import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Chrome/Edge required');
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL ?? 'http://127.0.0.1:5174/';
const overlap = (a,b) => a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top;

try {
  for (const width of [320, 340, 360, 374, 375, 389, 390, 430, 500, 720, 721, 744, 760, 768, 820, 900, 1023, 1024, 1279, 1280, 1440]) {
    for (const lang of ['zh','en']) {
      const page = await createSafePage(browser, {
        viewport: { width, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: width <= 760,
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const tag = width + 'px ' + lang;
      try {
        await page.addInitScript(l => localStorage.setItem('ailuren-lang',l),lang);
        await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
        const region=page.locator('#impact-awards');
        const dots=page.locator('#impact-awards .impact-award-pagination button');
        await dots.first().waitFor({state:'attached'});
        const output=await region.evaluate(node=>{
          const box=e=>e.getBoundingClientRect().toJSON();
          const dotRects=[...node.querySelectorAll('.impact-award-pagination button')].map(box);
          const prev=box(node.querySelector('.impact-award-rail-nav--prev'));
          const next=box(node.querySelector('.impact-award-rail-nav--next'));
          const note=node.querySelector('.impact-evidence-note');
          return {
            dots:dotRects,prev,next,
            noteFont:parseFloat(getComputedStyle(note).fontSize),
            noteText:note.textContent,
            noteWidth:note.getBoundingClientRect().width,
            overflow:document.documentElement.scrollWidth-innerWidth,
          };
        });
        assert.equal(output.dots.length,8,tag+': missing pagination target');
        assert.equal(output.noteFont,11,tag+': unreadable award top label');
        assert(output.overflow<=1,tag+': horizontal overflow');
        assert(output.noteText.includes(lang==='en'?'AWARDS & SHOWCASES':'荣誉与展映'),tag+': awards/showcases label is inaccurate');
        if (width<=720) {
          // The glass section uses scroll-reveal visibility. Move to the section
          // before exercising pointer events, not just reading geometry.
          await region.scrollIntoViewIfNeeded();
          await dots.last().waitFor({state:'visible'});
          for(const dot of output.dots) {
            assert(!overlap(dot,output.prev),tag+': pagination collides with previous arrow');
            assert(!overlap(dot,output.next),tag+': pagination collides with next arrow');
            assert(dot.width >=24 && dot.height>=44,tag+': dot touch size below approved minimum');
          }
          assert(output.prev.width>=44 && output.prev.height>=44,tag+': arrow touch size too small');
          assert(output.next.width>=44 && output.next.height>=44,tag+': arrow touch size too small');
          // The eighth item must remain reachable by tapping, including 320px.
          // Page transitions decode the target thumbnail before committing the
          // selected state. Assert the settled result, not the tap microtask.
          await dots.last().tap();
          await page.waitForFunction(() => document.querySelectorAll('#impact-awards .impact-award-pagination button')[7]?.getAttribute('aria-selected') === 'true', null, { timeout: 6000 });
          assert.equal(await dots.last().getAttribute('aria-selected'),'true',tag+': eighth dot cannot be selected');
          await dots.first().tap();
          await page.waitForFunction(() => document.querySelectorAll('#impact-awards .impact-award-pagination button')[0]?.getAttribute('aria-selected') === 'true', null, { timeout: 6000 });
          assert.equal(await dots.first().getAttribute('aria-selected'),'true',tag+': first dot cannot be reselected');
        }
        if (width >= 721) {
          const gallery = await region.evaluate(node => {
            const stage = node.querySelector('.impact-award-stage');
            const rail = node.querySelector('.impact-award-rail');
            const { paddingLeft, paddingRight } = getComputedStyle(rail);
            const rect = rail.getBoundingClientRect();
            const left = rect.left + parseFloat(paddingLeft);
            const right = rect.right - parseFloat(paddingRight);
            const columns = parseInt(getComputedStyle(stage).getPropertyValue('--award-columns'), 10);
            const cards = [...rail.querySelectorAll(':scope > li .impact-award-card-content > img')];
            const results = cards.slice(0, columns + 1).map(img => {
              const r = img.getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, visible: r.left >= left - 1 && r.right <= right + 1 };
            });
            return { columns, results, left, right };
          });
          const expected = width < 1280 ? 3 : 4;
          assert.equal(gallery.columns, expected, tag + ': wrong desktop/tablet visible columns');
          assert(gallery.results.slice(0, expected).every(item => item.visible), tag + ': one of the visible award images is clipped');
          assert(!gallery.results.at(-1).visible, tag + ': carousel accidentally shows an extra complete poster');
          const first = gallery.results[0];
          assert(gallery.results.slice(0, expected).every(item => Math.abs(item.top - first.top) < 2 && Math.abs(item.bottom - first.bottom) < 2), tag + ': award posters are uneven heights');
        }
        assert.deepEqual(errors,[],tag+': JS error');
        assert.equal(getSafeMediaReport(page).urls.length,0,tag+': ImageKit request');
        console.log('PASS',tag,'award pagination / readable evidence label / 0 CDN');
      } finally {await page.close();}
    }
  }
} finally {await browser.close();}
console.log('PASS: award pagination / evidence semantics on 21 widths × 2 languages');
