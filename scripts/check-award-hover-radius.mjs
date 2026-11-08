import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
try {
 for (const width of [320,390,720,1024,1440]) for (const lang of ['zh','en']) {
  const page = await createSafePage(browser,{viewport:{width,height:900}});
  try {
   await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
   await page.goto(new URL('index.html',process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/').href,{waitUntil:'domcontentloaded'});
   const cards=page.locator('#impact-awards .impact-award-grid-card');
   assert.equal(await cards.count(),8);
   for (const index of [0,7]) {
    const image=cards.nth(index).locator('img');
    await image.scrollIntoViewIfNeeded();
    const geometry=await image.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {ratio:r.width/r.height,radius:parseFloat(s.borderTopLeftRadius),fit:s.objectFit};});
    assert(Math.abs(geometry.ratio-540/960)<.02 && geometry.radius>0 && geometry.fit==='contain',`${width} ${lang}: invalid image geometry`);
   }
   assert.equal(getSafeMediaReport(page).urls.length,0);
  } finally { await page.close(); }
 }
 console.log('Award image ratios and corners passed.');
} finally { await browser.close(); }
