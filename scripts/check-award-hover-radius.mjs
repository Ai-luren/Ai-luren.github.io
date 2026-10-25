import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(executablePath);
const browser=await chromium.launch({executablePath,headless:true});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
try{
 for(const [width,lang] of [[320,'zh'],[390,'zh'],[390,'en'],[430,'zh'],[720,'zh'],[1024,'zh'],[1440,'zh'],[1440,'en']]){
  const mobile=width<=720;
  const page=await createSafePage(browser,{viewport:{width,height:900}});
  await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
  try{
   await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
   await page.locator('#impact-awards').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelector('#impact-awards .impact-award-card img')?.naturalWidth>0,null,{timeout:15000});
   if(mobile){
    // On deployed sites, the gallery CSS chunk can arrive after the cached
    // WebP has decoded. Wait for the final geometry, not just naturalWidth.
    await page.waitForFunction(() => {
      const img=document.querySelector('#impact-awards .impact-award-card img');
      if (!img?.complete || !img.naturalWidth) return false;
      const style=getComputedStyle(img),box=img.getBoundingClientRect();
      return style.objectFit==='cover' && parseFloat(style.borderTopLeftRadius)>=14
        && box.height>0 && Math.abs(box.width/box.height-540/960)<.04;
    },null,{timeout:14000});
    const getMedia=()=>page.locator('#impact-awards .impact-award-card img').evaluate(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return {ratio:r.width/r.height,fit:s.objectFit,radius:parseFloat(s.borderTopLeftRadius),ready:el.complete&&el.naturalWidth>0};
    });
    const first=await getMedia();
    assert(first.ready&&Math.abs(first.ratio-540/960)<0.04,width+': artwork wrong geometry '+JSON.stringify(first));
    assert(first.radius>=14&&first.fit==='cover');
    await page.locator('#impact-awards .impact-award-pagination button').last().evaluate(el=>el.click());
    await page.waitForFunction(()=>document.querySelector('#impact-awards .impact-award-pagination button:last-child')?.getAttribute('aria-selected')==='true',null,{timeout:15000});
    await page.waitForFunction(() => {
      const img=document.querySelector('#impact-awards .impact-award-card img');
      if (!img?.naturalWidth || !img.complete) return false;
      const style=getComputedStyle(img),box=img.getBoundingClientRect();
      return style.objectFit==='cover' && parseFloat(style.borderTopLeftRadius)>=14
        && box.height>0 && Math.abs(box.width/box.height-540/960)<.04;
    },null,{timeout:14000});
    const last=await getMedia();
    assert(last.ready&&Math.abs(last.ratio-540/960)<0.04&&last.radius>=14&&last.fit==='cover',width+': last artwork corners lost');
    console.log('PASS',width,lang,'artwork rounded on first and last award');
   }else{
    for(const suffix of ['prev','next']){
     const el=page.locator('#impact-awards .impact-award-rail-nav--'+suffix);
     if(suffix==='prev'){
      await page.locator('#impact-awards .impact-award-rail-nav--next').evaluate(node=>node.click());
      await page.waitForTimeout(400);
     }
     await el.scrollIntoViewIfNeeded();
     await page.waitForTimeout(150);
     const before=await el.evaluate(node=>getComputedStyle(node).transform);
     await el.hover();
     await page.waitForTimeout(220);
     const after=await el.evaluate(node=>getComputedStyle(node).transform);
     assert.equal(after,before,width+': '+suffix+' arrow loses its positioning transform on hover');
     assert.notEqual(after,'none');
    }
    console.log('PASS',width,lang,'desktop arrow transform stable on hover');
   }
   assert.equal(getSafeMediaReport(page).urls.length,0);
  }finally{await page.close();}
 }
}finally{await browser.close()}
