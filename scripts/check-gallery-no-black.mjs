import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(executablePath);
const browser=await chromium.launch({executablePath,headless:true});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';

try{
  for(const [width,lang] of [[390,'zh'],[390,'en'],[430,'zh']]){
    const page=await createSafePage(browser,{viewport:{width,height:844},deviceScaleFactor:1});
    await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Slow artwork requests by 480ms to test nonblank transitions.
    await page.route(/\/assets\/images\/.*\.webp(?:\?.*)?$/i,async route=>{
      if(route.request().url().includes('/project-covers/')||route.request().url().includes('/awards/')){
        await new Promise(resolve=>setTimeout(resolve,480));
      }
      try{await route.fallback();}catch{}
    });
    try{
      await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
      const cover=page.locator('#projects .comet-archive__cover');
      await cover.first().waitFor({state:'attached'});
      await page.waitForFunction(()=>[...document.querySelectorAll('#projects .comet-archive__cover')].every(img=>img.complete && img.naturalWidth>0),null,{timeout:15000});
      assert.equal(await cover.count(),4);
      const first=await page.locator('#projects .comet-archive__title').first().textContent();
      await page.locator('#projects .comet-archive-pagination button').last().evaluate(e=>e.click());
      await page.waitForTimeout(80);
      const interim=await page.locator('#projects .comet-archive__title').first().textContent();
      if(interim===first){
        assert(await cover.evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),'Outgoing projects were cleared');
      }
      await page.waitForFunction(()=>document.querySelector('#projects .comet-archive-pagination button:last-child')?.getAttribute('aria-selected')==='true',null,{timeout:14000});
      assert(await cover.evaluateAll(imgs=>imgs.length===4 && imgs.every(img=>img.complete&&img.naturalWidth>0)),'Blank new featured cover');
      assert.equal(await page.locator('#projects .comet-archive__item').first().evaluate(el=>getComputedStyle(el).opacity),'1');

      await page.locator('#impact-awards').scrollIntoViewIfNeeded();
      const oldImage=page.locator('#impact-awards .impact-award-card img');
      await page.waitForFunction(()=>{const img=document.querySelector('#impact-awards .impact-award-card img');return img?.complete && img.naturalWidth>0;},null,{timeout:14000});
      const oldSrc=await oldImage.getAttribute('src');
      await page.locator('#impact-awards .impact-award-pagination button').last().evaluate(e=>e.click());
      await page.waitForTimeout(85);
      if((await oldImage.getAttribute('src'))===oldSrc){
        assert(await oldImage.evaluate(img=>img.complete&&img.naturalWidth>0),'Outgoing award not decoded');
      }
      await page.waitForFunction(()=>document.querySelector('#impact-awards .impact-award-pagination button:last-child')?.getAttribute('aria-selected')==='true',null,{timeout:14000});
      assert.notEqual(await oldImage.getAttribute('src'),oldSrc,'Award thumbnail did not change');
      assert(await oldImage.evaluate(img=>img.complete&&img.naturalWidth>0),'Award new frame blank');
      assert.equal(await page.locator('#impact-awards .impact-award-rail > li').evaluate(el=>getComputedStyle(el).opacity),'1');

      await page.locator('#impact-awards .impact-award-card').first().evaluate(e=>e.click());
      await page.locator('.impact-award-lightbox').waitFor({state:'visible'});
      const viewer=page.locator('.impact-award-lightbox figure > img');
      await page.waitForFunction(()=>{const img=document.querySelector('.impact-award-lightbox figure > img');return img?.complete&&img.naturalWidth>0;},null,{timeout:14000});
      const viewerSrc=await viewer.getAttribute('src');
      await page.locator('.impact-award-lightbox-nav--next').evaluate(e=>e.click());
      await page.waitForFunction(src=>{const img=document.querySelector('.impact-award-lightbox figure > img');return img?.getAttribute('src')!==src&&img.complete&&img.naturalWidth>0;},viewerSrc,{timeout:14000});
      assert.equal(getSafeMediaReport(page).urls.length,0);
      assert.deepEqual(errors,[]);
      console.log('PASS',width,lang,'featured, awards gallery and viewer stay decoded, no dark fade or ImageKit');
    }finally{await page.close()}
  }
}finally{await browser.close()}
