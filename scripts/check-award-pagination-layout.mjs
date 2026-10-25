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
  for (const width of [320, 340, 360, 374, 375, 389, 390, 430, 500, 720, 760, 768, 1024, 1440]) {
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
          await dots.last().tap();
          assert.equal(await dots.last().getAttribute('aria-selected'),'true',tag+': eighth dot cannot be selected');
          await dots.first().tap();
          assert.equal(await dots.first().getAttribute('aria-selected'),'true',tag+': first dot cannot be reselected');
        }
        assert.deepEqual(errors,[],tag+': JS error');
        assert.equal(getSafeMediaReport(page).urls.length,0,tag+': ImageKit request');
        console.log('PASS',tag,'award pagination / readable evidence label / 0 CDN');
      } finally {await page.close();}
    }
  }
} finally {await browser.close();}
console.log('PASS: award pagination / evidence semantics on 14 widths × 2 languages');
